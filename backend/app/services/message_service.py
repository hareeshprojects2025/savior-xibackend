import asyncio
import logging
import time
from abc import ABC, abstractmethod

import httpx

from app.core.config import BOLNA_API_TOKEN, BOLNA_AGENT_ID, BOLNA_DISPATCH_AGENT_ID, BASE_URL
from app.core.websocket import manager
from app.models.dispatch_record import DispatchRecord

MAX_RING_SECONDS = 30
MAX_CALL_SECONDS = 300
POLL_INTERVAL = 5
CALL_ATTEMPTS = 3
NO_ACK_GRACE_SECONDS = 20
STUCK_STATUSES = {"queued", "initiated", "ringing"}
TERMINAL_STATUSES = {"completed", "completed_by_user", "finished", "failed", "ended", "call_failed"}

logger = logging.getLogger("savior.message")


class DispatchCallError(Exception):
    """Raised when Bolna outbound call placement fails after retries."""


class MessageService(ABC):
    """Interface for sending dispatch notifications and collecting acknowledgments.
    
    Two implementations:
    - SimulatedMessageService: MVP/demo mode — ACK simulated by dispatcher click
    - BolnaMessageService: Production — real Bolna outbound agent integration
    """

    @abstractmethod
    async def send_dispatch(self, station_phone: str, incident: dict) -> str | None:
        """Send dispatch notification to a station.
        Returns a call_id (for tracking ACK) or None on failure.
        Raises DispatchCallError if call placement fails after retries."""
        ...

    @abstractmethod
    async def get_ack_status(self, call_id: str) -> str | None:
        """Check ACK status for a given call.
        Returns: 'acknowledged', 'rejected', 'no_answer', or None if unknown."""
        ...

    def get_execution_id(self, call_id: str) -> str | None:
        """Return the Bolna execution UUID for a placed call, if known."""
        return None


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
    2. Backend calls Bolna POST /call with agent_id, phone, and incident details (user_data)
    3. Bolna makes outbound call, reads incident, asks for verbal ACK
    4. Station personnel responds (acknowledge / reject)
    5. Bolna sends webhook POST /api/dispatch/ack with ack_status
    6. Backend updates DispatchRecord and escalates on no-answer

    Call placement retries with backoff and raises DispatchCallError on final failure —
    no silent simulation. Call lifecycle (ringing/connected/completed) is polled
    from Bolna executions and broadcast over WebSocket.
    
    Falls back to SimulatedMessageService behavior only if BOLNA_API_TOKEN or
    BOLNA_DISPATCH_AGENT_ID are not configured.
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
        self._dispatch_record_ids: dict[str, int] = {}

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
                "station_name": incident.get("station_name", ""),
                "station_type": incident.get("station_type", ""),
            },
        }
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }
        try:
            result = await self._place_call(payload, headers)
            # Normalize identifiers: prefer the execution UUID (what Bolna sends
            # in webhooks and what /executions/{id} polling uses), so ACK webhooks
            # can match the record even when the /call response shape varies.
            execution_id = (
                result.get("execution_id")
                or result.get("id")
                or result.get("call_id")
                or f"bolna_{int(time.time())}"
            )
            call_id = result.get("call_id") or execution_id
            dispatch_record_id = incident.get("dispatch_record_id")
            logger.info("Bolna outbound call placed: call_id=%s, execution_id=%s, station=%s", call_id, execution_id, station_phone)

            self._execution_ids[call_id] = execution_id
            if dispatch_record_id:
                self._dispatch_record_ids[call_id] = int(dispatch_record_id)

            # Fire background watchdog: polls execution status, broadcasts call lifecycle,
            # stops stuck calls
            asyncio.create_task(self._poll_execution_and_report(call_id, execution_id, dispatch_record_id))

            return call_id
        except DispatchCallError as e:
            logger.error("Bolna outbound call failed for %s after %d attempts: %s", station_phone, CALL_ATTEMPTS, e)
            raise

    async def _place_call(self, payload: dict, headers: dict) -> dict:
        """POST /call with exponential backoff retries. Raises DispatchCallError on final failure."""
        last_err: Exception | None = None
        for attempt in range(CALL_ATTEMPTS):
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.post(
                        "https://api.bolna.ai/call",
                        json=payload,
                        headers=headers,
                        timeout=30,
                    )
                if resp.is_success:
                    return resp.json()
                last_err = RuntimeError(f"Bolna /call HTTP {resp.status_code}: {resp.text[:300]}")
            except Exception as e:
                last_err = e
            if attempt < CALL_ATTEMPTS - 1:
                await asyncio.sleep(2 ** (attempt + 1))  # 2s, 4s backoff
        raise DispatchCallError(str(last_err)) from last_err

    async def get_ack_status(self, call_id: str) -> str | None:
        if call_id.startswith("sim_"):
            return "acknowledged"
        return self._ack_results.get(call_id)

    def get_execution_id(self, call_id: str) -> str | None:
        return self._execution_ids.get(call_id)

    async def _poll_execution_and_report(
        self,
        call_id: str,
        execution_id: str,
        dispatch_record_id: int | None,
    ) -> None:
        """Poll execution status; broadcast call lifecycle and stop stuck calls.

        - Ringing/queued past MAX_RING_SECONDS → stop the call
        - Terminal status → report and return
        - Otherwise → report status transitions until MAX_CALL_SECONDS
        """
        url = f"https://api.bolna.ai/executions/{execution_id}"
        headers = {"Authorization": f"Bearer {self.api_token}"}
        elapsed = 0
        last_report: str | None = None

        while elapsed < MAX_CALL_SECONDS:
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(url, headers=headers, timeout=10)
                    if resp.is_success:
                        data = resp.json()
                        status = data.get("call_status", data.get("status", "unknown"))
                        if status in TERMINAL_STATUSES:
                            self._report_call_status(call_id, dispatch_record_id, status)
                            # Give the agent/webhook a brief grace window to deliver a
                            # valid ACK; if none arrived, treat the call as unanswered
                            # and fail over to the next station instead of waiting out
                            # the full escalation timeout.
                            if dispatch_record_id is not None:
                                await self._escalate_if_unacked(dispatch_record_id)
                            return
                        if status != "unknown" and status != last_report:
                            self._report_call_status(call_id, dispatch_record_id, status)
                            last_report = status
                        if status in STUCK_STATUSES and elapsed >= MAX_RING_SECONDS:
                            logger.warning("Call %s stuck in %s for %ds — stopping", call_id, status, MAX_RING_SECONDS)
                            await self._stop_call(execution_id)
                            self._report_call_status(call_id, dispatch_record_id, "stopped")
                            return
            except Exception:
                pass

            await asyncio.sleep(POLL_INTERVAL)
            elapsed += POLL_INTERVAL

        logger.warning("Call %s did not complete within %ds", call_id, MAX_CALL_SECONDS)

    def _report_call_status(self, call_id: str, dispatch_record_id: int | None, status: str) -> None:
        """Persist call_status on the dispatch record and broadcast it."""
        emergency_id = None
        if dispatch_record_id:
            try:
                from app.core.database import SessionLocal

                db = SessionLocal()
                try:
                    record = db.query(DispatchRecord).filter(DispatchRecord.id == dispatch_record_id).first()
                    if record:
                        emergency_id = record.emergency_id
                        if record.call_status != status:
                            record.call_status = status
                            db.commit()
                finally:
                    db.close()
            except Exception as e:
                logger.error("Failed to persist call status %s for dispatch %s: %s", status, dispatch_record_id, e)

        if emergency_id is None or status == "unknown":
            return
        try:
            asyncio.create_task(manager.broadcast({
                "type": "dispatch_update",
                "emergency_id": emergency_id,
                "dispatch_record_id": dispatch_record_id,
                "call_status": status,
            }))
        except Exception as e:
            logger.error("Failed to broadcast call status %s: %s", status, e)

    async def _escalate_if_unacked(self, dispatch_record_id: int) -> None:
        """After a terminal call status, wait a short grace window for the station's
        ACK webhook to land, then escalate to the next station if none arrived."""
        await asyncio.sleep(NO_ACK_GRACE_SECONDS)
        try:
            from app.core.database import SessionLocal
            from app.models.dispatch_record import DispatchRecord, DispatchStatus
            from app.services.dispatch_service import escalate_dispatch

            db = SessionLocal()
            try:
                record = db.query(DispatchRecord).filter(DispatchRecord.id == dispatch_record_id).first()
                if not record or record.status != DispatchStatus.pending_call:
                    return
                logger.warning(
                    "Dispatch %d reached terminal call status with no ACK — escalating to next station",
                    dispatch_record_id,
                )
                await escalate_dispatch(db, dispatch_record_id)
            finally:
                db.close()
        except Exception as e:
            logger.error("Terminal-no-ACK escalation failed for dispatch %s: %s", dispatch_record_id, e)

    async def _stop_call(self, execution_id: str) -> None:
        """Force-stop a Bolna call that is stuck ringing/queued."""
        stop_url = f"https://api.bolna.ai/call/{execution_id}/stop"
        headers = {"Authorization": f"Bearer {self.api_token}"}
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(stop_url, headers=headers, timeout=10)
                if resp.is_success:
                    logger.info("Call %s stopped successfully", execution_id)
                else:
                    logger.warning("Failed to stop call %s: %s", execution_id, resp.status_code)
        except Exception as e:
            logger.warning("Failed to stop call %s: %s", execution_id, e)