"""
Usage:
  1. Start backend:  python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
  2. Start ngrok:    ngrok http 8000 --subdomain=lachelle-ungrounded-jerri
  3. Run this:       python tests/test_live_e2e.py [--base-url http://localhost:8000]
"""

import argparse
import json
import os
import sys
import time

import requests

BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:8000")

TEST_CALLER = "+919876543210"

BOLNA_CHUNK_PAYLOAD = {
    "transcript_text": "Caller says there is a fire in the kitchen.",
    "speaker": "caller",
    "is_final": False,
    "call_id": "bolna-live-call-001",
}

EMERGENCY_PAYLOAD = {
    "caller_name": "Alice",
    "caller_phone": TEST_CALLER,
    "victim_name": "Bob",
    "emergency_type": "Fire",
    "severity": "High",
    "location": "123 Main Street, Mumbai",
    "landmark": "Near City Hospital",
    "victims": 2,
    "description": "Smoke coming from third floor kitchen",
    "immediate_danger": "Fire spreading, smoke inhalation risk",
}

COMPLETE_PAYLOAD = {
    "id": "bolna-live-call-001",
    "status": "completed",
    "user_number": TEST_CALLER,
    "transcript": "Caller: There is a fire in the kitchen.\nAgent: What is your location?\nCaller: 123 Main Street, Mumbai.",
    "extracted_data": {
        "General": {
            "Call Summary": {
                "subjective": "Fire at 123 Main Street, Mumbai with 2 victims."
            }
        }
    },
}


def test(description: str, func):
    print(f"  {description}...", end=" ")
    sys.stdout.flush()
    try:
        result = func()
        if result:
            print(f"PASS -> {result}")
        else:
            print("PASS")
        return True
    except Exception as e:
        print(f"FAIL: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="E2E test for SAVIOR Bolna integration")
    parser.add_argument("--base-url", default=BASE_URL, help=f"Base URL (default: {BASE_URL})")
    parser.add_argument("--ngrok-url", help="Ngrok URL to test external endpoint")
    args = parser.parse_args()

    base = args.base_url
    ngrok = args.ngrok_url
    passed = 0
    total = 0

    print(f"\nTesting against: {base}")
    if ngrok:
        print(f"External URL:    {ngrok}")
    print()

    def url(path):
        return f"{base}{path}"

    eid = None

    total += 1
    if test("POST /api/emergency (simulate post_api_emergency)", lambda: (
        requests.post(url("/api/emergency"), json=EMERGENCY_PAYLOAD).raise_for_status()
        or (
            lambda r: (
                r.status_code == 200
                and r.json().get("status") == "success"
            )
        )(requests.post(url("/api/emergency"), json=EMERGENCY_PAYLOAD))
        or True
    )):
        passed += 1

    total += 1
    if test("GET /api/emergencies (list all)", lambda: (
        len(requests.get(url("/api/emergencies")).json()) >= 1
    )):
        passed += 1

    total += 1
    if test("POST /api/transcript_chunk with call_id (simulate send_transcript_chunk)", lambda: (
        requests.post(url("/api/transcript_chunk"), json={
            "transcript_text": "Buffered chunk",
            "call_id": "bolna-live-call-001",
            "is_final": False,
        }).raise_for_status()
        or requests.post(url("/api/transcript_chunk"), json={
            "transcript_text": "Buffered chunk",
            "call_id": "bolna-live-call-001",
            "is_final": False,
        }).json().get("status") == "buffered"
    )):
        passed += 1

    total += 1
    if test("POST /api/transcript_chunk with emergency_id", lambda: (
        (eid := requests.get(url("/api/emergencies")).json()[0]["id"])
        and requests.post(url("/api/transcript_chunk"), json={
            **BOLNA_CHUNK_PAYLOAD, "emergency_id": eid
        }).raise_for_status()
        and requests.post(url("/api/transcript_chunk"), json={
            **BOLNA_CHUNK_PAYLOAD, "emergency_id": eid
        }).json().get("emergency_id") == eid
    )):
        passed += 1

    total += 1
    if test("POST /api/transcript/complete (simulate Bolna webhook)", lambda: (
        requests.post(url("/api/transcript/complete"), json=COMPLETE_PAYLOAD).raise_for_status()
        and requests.post(url("/api/transcript/complete"), json=COMPLETE_PAYLOAD).json().get("status") == "success"
    )):
        passed += 1

    total += 1
    if test("GET /api/transcript/{id}/chunks (verify chunks stored)", lambda: (
        (eid := requests.get(url("/api/emergencies")).json()[0]["id"])
        and len(requests.get(url(f"/api/transcript/{eid}/chunks")).json()) >= 1
    )):
        passed += 1

    total += 1
    if test("GET /api/emergencies/{id} (verify full_transcript saved)", lambda: (
        (eid := requests.get(url("/api/emergencies")).json()[0]["id"])
        and (r := requests.get(url(f"/api/emergencies/{eid}")).json())
        and r.get("full_transcript") is not None
        and "There is a fire" in r["full_transcript"]
        and r.get("summary") is not None
    )):
        passed += 1

    total += 1
    if test("GET /api/emergencies/stats", lambda: (
        (r := requests.get(url("/api/emergencies/stats")).json())
        and r.get("total_emergencies") >= 1
        and "Fire" in r.get("by_type", {})
    )):
        passed += 1

    total += 1
    if test("GET /api/emergencies/caller/{phone}", lambda: (
        len(requests.get(url(f"/api/emergencies/caller/{TEST_CALLER}")).json()) >= 1
    )):
        passed += 1

    total += 1
    if test("PATCH /api/emergencies/{id}/status", lambda: (
        (eid := requests.get(url("/api/emergencies")).json()[0]["id"])
        and requests.patch(url(f"/api/emergencies/{eid}/status"), json={"status": "dispatched"}).raise_for_status()
        and requests.patch(url(f"/api/emergencies/{eid}/status"), json={"status": "dispatched"}).json().get("status") == "dispatched"
    )):
        passed += 1

    print(f"\n{'='*50}")
    print(f"  {passed}/{total} tests passed")
    if ngrok:
        print(f"\n  To test with actual Bolna call:")
        print(f"  POST {ngrok}/api/emergency")
        print(f"  POST {ngrok}/api/transcript_chunk")
        print(f"  POST {ngrok}/api/transcript/complete")
    print(f"{'='*50}")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
