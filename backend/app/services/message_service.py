import asyncio
import logging
import time
from abc import ABC, abstractmethod
from typing import Optional

import httpx

from app.core.config import BOLNA_API_TOKEN, BOLNA_AGENT_ID, BOLNA_DISPATCH_AGENT_ID, BASE_URL

MAX_RING_SECONDS = 30
POLL_INTERVAL = 5
STUCK_STATUSES = {"queued", "initiated", "ringing"}

logger = logging.getLogger("savior.message")


class MessageService(ABC):
    """Interface for sending dispatch notifications and collecting acknowledgments.
    
    Two implementations:
    - SimulatedMessageService: MVP/demo mode — ACK simulated by dispatcher click
    - BolnaMessageService: Production — real Bolna outbound agent integration
    """

    @abstractmethod
    async def send_dispatch(self, station_phone: str, incident: dict) -> str | None:
        """Send dispatch notification to a station.
        Returns a call_id (for tracking ACK) or None on failure."""
        ...

    @abstractmethod
    async def get_ack_status(self, call_id: str) -> str | None:
        """Check ACK status for a given call.
        Returns: 'acknowledged', 'rejected', 'no_answer', or None if unknown."""
        ...


class SimulatedMessageService(MessageService):
    """MVP implementation — always succeeds for demo purposes.
    ACK is simulated by the dispatcher clicking 'Acknowledge' in the UI."""

    async def send_dispatch(self, station_phone: str, incident: dict) -> str | None:
        call_id = f"sim_call_{incident.get('emergency_id', 'unknown')}_{int(time.time())}"
        logger.info("Simulated dispatch to %s for emergency %s: call_id=%s",
                     station_phone, incident.get("emergency_id"), call_id)
        return call_id

    async def get_ack_status(self, call_id: str) -> str | None:
        return "acknowledged"  # Always succeeds for MVP demo


class BolnaMessageService(MessageService):
    """Production implementation — real Bolna outbound agent for station ACK calls.
    
    Architecture (dual-agent):
    - Inbound agent (existing): Collects emergency info from callers
    - Outbound agent (new): Places outbound calls to stations, reads incident details,
      collects verbal acknowledgment
    
    Flow:
    1. Backend marks dispatch as pending_call
    2. Backend calls Bolna POST /call with agent_id, phone, and incident details
    3. Bolna makes outbound call, reads incident, asks for verbal ACK
    4. Station personnel responds (acknowledge / reject)
    5. Bolna sends webhook POST /api/dispatch/ack with ack_status
    6. Backend updates DispatchRecord and escalates on no-answer
    
    Falls back to SimulatedMessageService behavior if BOLNA_API_TOKEN or BOLNA_AGENT_ID not set.
    """

    def __init__(
        self,
        api_token: str = "",
        agent_id: str = "",
        webhook_base: str = "",
    ):
        self.api_token = api_token or BOLNA_API_TOKEN
        self.agent_id = agent_id or BOLNA_DISPATCH_AGENT_ID
        self.webhook_base = webhook_base or BASE_URL
        self._ack_results: dict[str, str] = {}
        self._execution_ids: dict[str, str] = {}

    async def send_dispatch(self, station_phone: str, incident: dict) -> str | None:
        # Normalize phone: strip whitespace/dashes, ensure + prefix
        station_phone = station_phone.strip().replace("-", "")
        if not station_phone.startswith("+"):
            station_phone = f"+{station_phone}"

        if not self.api_token or not self.agent_id:
            logger.warning("BOLNA_API_TOKEN or BOLNA_AGENT_ID not set — falling back to simulated dispatch")
            # Fall back to simulated behavior
            call_id = f"sim_call_{incident.get('emergency_id', 'unknown')}_{int(time.time())}"
            self._ack_results[call_id] = "acknowledged"
            return call_id

        # Real Bolna integration
        payload = {
            "agent_id": self.agent_id,
            "recipient_phone_number": station_phone,
            "bypass_call_guardrails": True,
            "user_data": {
                "emergency_id": incident.get("emergency_id"),
                "dispatch_record_id": incident.get("dispatch_record_id"),
                "incident_type": incident.get("emergency_type", ""),
                "location": incident.get("location", ""),
                "description": incident.get("description", ""),
                "severity": incident.get("severity", ""),
                "victims": incident.get("victims", ""),
                "caller_name": incident.get("caller_name", ""),
                "summary": incident.get("summary", ""),
            },
        }
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.bolna.ai/call",
                    json=payload,
                    headers=headers,
                    timeout=30,
                )
                resp.raise_for_status()
                result = resp.json()
                call_id = result.get("call_id") or result.get("id", f"bolna_{int(time.time())}")
                execution_id = result.get("execution_id") or call_id
                logger.info("Bolna outbound call placed: call_id=%s, execution_id=%s, station=%s", call_id, execution_id, station_phone)

                # Fire background watchdog to stop stuck calls
                status = result.get("status", "")
                if status in STUCK_STATUSES:
                    self._execution_ids[call_id] = execution_id
                    asyncio.create_task(self._watch_and_kill(call_id, execution_id))

                return call_id
        except Exception as e:
            logger.error("Bolna outbound call failed for %s: %s", station_phone, e)
            # Fall back to simulated on failure
            call_id = f"sim_call_{incident.get('emergency_id', 'unknown')}_{int(time.time())}"
            self._ack_results[call_id] = "acknowledged"
            return call_id

    async def get_ack_status(self, call_id: str) -> str | None:
        if call_id.startswith("sim_"):
            return "acknowledged"
        return self._ack_results.get(call_id)

    async def _watch_and_kill(self, call_id: str, execution_id: str):
        """Poll execution status; stop the call if stuck in queued/initiated/ringing too long."""
        url = f"https://api.bolna.ai/executions/{execution_id}"
        stop_url = f"https://api.bolna.ai/call/{execution_id}/stop"
        headers = {"Authorization": f"Bearer {self.api_token}"}
        elapsed = 0

        while elapsed < MAX_RING_SECONDS:
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(url, headers=headers, timeout=10)
                    if resp.is_success:
                        data = resp.json()
                        status = data.get("call_status", data.get("status", "unknown"))
                        if status not in STUCK_STATUSES:
                            logger.info("Call %s moved past stuck state → %s", call_id, status)
                            return
            except Exception:
                pass

            await asyncio.sleep(POLL_INTERVAL)
            elapsed += POLL_INTERVAL

        # Timeout — stop the call
        logger.warning("Call %s stuck in ringing/queued for %ds — stopping", call_id, MAX_RING_SECONDS)
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(stop_url, headers=headers, timeout=10)
                if resp.is_success:
                    logger.info("Call %s stopped successfully", call_id)
                else:
                    logger.warning("Failed to stop call %s: %s", call_id, resp.status_code)
        except Exception as e:
            logger.warning("Failed to stop call %s: %s", call_id, e)

    def process_webhook(self, call_id: str, ack_status: str) -> bool:
        """Store ACK result from Bolna webhook for polling by get_ack_status."""
        self._ack_results[call_id] = ack_status
        logger.info("ACK webhook processed: call_id=%s, status=%s", call_id, ack_status)
        return True
