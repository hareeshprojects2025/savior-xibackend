"""
Make an outbound call via the Bolna AI API.

Usage:
    python tests/make_call.py                        # uses RECIPIENT_NUMBER from .env
    python tests/make_call.py --phone "+919999999999" # overrides .env
    python tests/make_call.py --track                 # poll until completed
    python tests/make_call.py --from-number "+918035739222"
"""

import argparse
import os
import sys
import time

import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

API_URL = "https://api.bolna.ai/call"
EXECUTION_URL = "https://api.bolna.ai/executions/{execution_id}"
STOP_URL = "https://api.bolna.ai/call/{execution_id}/stop"


def normalize_phone(phone: str) -> str:
    phone = phone.strip()
    if not phone.startswith("+"):
        phone = f"+91{phone}"
    return phone


def make_call(api_key: str, agent_id: str, recipient: str, from_number: str | None = None) -> dict:
    payload = {
        "agent_id": agent_id,
        "recipient_phone_number": recipient,
    }
    if from_number:
        payload["from_phone_number"] = from_number

    resp = requests.post(
        API_URL,
        json=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )

    if not resp.ok:
        try:
            err = resp.json()
        except Exception:
            err = resp.text
        raise RuntimeError(f"API error ({resp.status_code}): {err}")

    return resp.json()


STUCK_STATUSES = {"queued", "initiated", "ringing"}

def track_call(api_key: str, execution_id: str, interval: int = 5):
    stages = set()
    url = EXECUTION_URL.format(execution_id=execution_id)
    while True:
        resp = requests.get(
            url,
            headers={"Authorization": f"Bearer {api_key}"},
        )
        if not resp.ok:
            print(f"\n  Poll failed ({resp.status_code}): {resp.text}")
            break

        data = resp.json()
        status = data.get("call_status", data.get("status", "unknown"))
        if status not in stages:
            print(f"  → {status}")
            stages.add(status)

        if status == "completed":
            print(f"\n  Call completed — duration: {data.get('conversation_duration', '?')}s")
            print(f"  Cost: {data.get('total_cost', '?')}")
            if data.get("recording_url"):
                print(f"  Recording: {data['recording_url']}")
            return data

        if status in ("error", "failed", "cancelled"):
            print(f"\n  Call ended with status: {status}")
            return data

        time.sleep(interval)


def watch_and_kill(api_key: str, execution_id: str, max_ring_seconds: int, interval: int = 5):
    """Poll execution status; stop the call if stuck in queued/initiated/ringing too long."""
    url = EXECUTION_URL.format(execution_id=execution_id)
    stop_url = STOP_URL.format(execution_id=execution_id)
    elapsed = 0
    last_status = None

    print(f"\n  Watchdog: monitoring for {max_ring_seconds}s...")
    while elapsed < max_ring_seconds:
        resp = requests.get(url, headers={"Authorization": f"Bearer {api_key}"})
        if not resp.ok:
            print(f"\n  Poll failed ({resp.status_code}): {resp.text}")
            return

        data = resp.json()
        status = data.get("call_status", data.get("status", "unknown"))

        if status != last_status:
            print(f"  → {status}")
            last_status = status

        if status in ("completed", "error", "failed", "cancelled", "no-answer", "busy"):
            print(f"\n  Call resolved — {status}")
            return

        if status not in STUCK_STATUSES:
            print(f"\n  Call moved past stuck states — {status}")
            return

        time.sleep(interval)
        elapsed += interval

    # Timeout reached — stop if still stuck
    print(f"\n  ⚠ No answer after {max_ring_seconds}s — stopping call...")
    resp = requests.post(stop_url, headers={"Authorization": f"Bearer {api_key}"})
    if resp.ok:
        result = resp.json()
        print(f"  Stop result: {result.get('status', '?')}")
    else:
        print(f"  Stop failed ({resp.status_code}): {resp.text}")
    return


def main():
    parser = argparse.ArgumentParser(description="Make an outbound call via Bolna AI")
    parser.add_argument("--phone", help="Recipient phone (E.164 or plain Indian number)")
    parser.add_argument("--from-number", help="Caller ID (optional, uses account default)")
    parser.add_argument("--track", action="store_true", help="Poll for call completion")
    parser.add_argument("--max-ring", type=int, default=30, help="Max seconds to wait for answer before stopping (default: 30)")
    parser.add_argument("--api-key", help="Bolna API key (default: from .env)")
    parser.add_argument("--agent-id", help="Bolna agent UUID (default: from .env)")
    args = parser.parse_args()

    api_key = args.api_key or os.getenv("BOLNA_API_Key")
    agent_id = args.agent_id or os.getenv("AGENT_ID")
    recipient = args.phone or os.getenv("RECIPIENT_NUMBER")

    if not api_key:
        print("Error: BOLNA_API_Key not found in .env or --api-key")
        sys.exit(1)
    if not agent_id:
        print("Error: AGENT_ID not found in .env or --agent-id")
        sys.exit(1)
    if not recipient:
        print("Error: No recipient phone. Set RECIPIENT_NUMBER in .env or pass --phone")
        sys.exit(1)

    recipient = normalize_phone(recipient)
    print(f"Calling {recipient} via agent {agent_id}...")

    try:
        result = make_call(api_key, agent_id, recipient, args.from_number)
    except RuntimeError as e:
        print(f"Failed: {e}")
        sys.exit(1)

    execution_id = result.get("execution_id")
    status = result.get("status", "?")
    print(f"  status: {status}")
    print(f"  execution_id: {execution_id}")

    # Always run watchdog when we get execution_id (stops stuck calls)
    if execution_id:
        if status in STUCK_STATUSES:
            watch_and_kill(api_key, execution_id, args.max_ring)
        elif args.track:
            print("\nTracking call progress...")
            track_call(api_key, execution_id)


if __name__ == "__main__":
    main()
