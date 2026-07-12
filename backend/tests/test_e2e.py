import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ["DATABASE_URL"] = "sqlite:///./test_savior_e2e.db"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app

import app.services.emergency_service as _es
import app.services.geocoding_service as _gs

_gs.geocode_location = lambda loc, landmark=None: None
original_create = _es.create_emergency


async def _safe_create_emergency(db, data):
    from app.models.emergency import Emergency
    record = Emergency(**data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


_es.create_emergency = _safe_create_emergency
import app.api.v1.endpoints.emergency as _ep
_ep.create_emergency = _safe_create_emergency

test_engine = create_engine(os.environ["DATABASE_URL"], connect_args={"check_same_thread": False})
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

Base.metadata.create_all(bind=test_engine)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

TEST_CALLER = "+919876543210"

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

BOLNA_CHUNK_PAYLOAD = {
    "transcript_text": "Caller says there is a fire in the kitchen.",
    "speaker": "caller",
    "is_final": False,
    "call_id": "bolna-test-call-001",
}

COMPLETE_PAYLOAD = {
    "id": "bolna-test-call-001",
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


def test_1_create_emergency():
    resp = client.post("/api/emergency", json=EMERGENCY_PAYLOAD)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert data["status"] == "success"
    assert "Emergency recorded" in data["message"]


def test_2_list_emergencies():
    resp = client.get("/api/emergencies")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["caller_name"] == "Alice"
    assert data[0]["emergency_type"] == "Fire"
    assert data[0]["caller_phone"] == TEST_CALLER
    return data[0]["id"]


def test_3_transcript_chunk_without_emergency_id():
    resp = client.post("/api/transcript_chunk", json={
        "transcript_text": "Buffered chunk before emergency exists",
        "call_id": "bolna-test-call-001",
        "is_final": False,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "buffered"


def test_4_transcript_chunk_with_emergency_id():
    emergencies = client.get("/api/emergencies").json()
    eid = emergencies[0]["id"]
    payload = {**BOLNA_CHUNK_PAYLOAD, "emergency_id": eid}
    resp = client.post("/api/transcript_chunk", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("chunk_text") == BOLNA_CHUNK_PAYLOAD["transcript_text"]
    assert data.get("emergency_id") == eid
    return eid


def test_5_get_transcript_chunks():
    emergencies = client.get("/api/emergencies").json()
    eid = emergencies[0]["id"]
    resp = client.get(f"/api/transcript/{eid}/chunks")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["emergency_id"] == eid


def test_6_transcript_complete_webhook():
    resp = client.post("/api/transcript/complete", json=COMPLETE_PAYLOAD)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["emergency_id"] is not None
    return data["emergency_id"]


def test_7_verify_transcript_saved():
    emergencies = client.get("/api/emergencies").json()
    eid = emergencies[0]["id"]
    resp = client.get(f"/api/emergencies/{eid}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["full_transcript"] is not None
    assert data["full_transcript"] == COMPLETE_PAYLOAD["transcript"]
    assert data["summary"] is not None
    assert "2 victims" in data["summary"]
    assert data["description"] == EMERGENCY_PAYLOAD["description"]


def test_8_recent_emergencies():
    resp = client.get("/api/emergencies/recent?limit=5&offset=0")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1


def test_9_emergency_stats():
    resp = client.get("/api/emergencies/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_emergencies"] >= 1
    assert "Fire" in data["by_type"]
    assert data["by_type"]["Fire"] >= 1


def test_10_filter_by_type():
    resp = client.get("/api/emergencies/type/Fire")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["emergency_type"] == "Fire"


def test_11_filter_by_severity():
    resp = client.get("/api/emergencies/severity/High")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["severity"] == "High"


def test_12_filter_by_caller():
    resp = client.get(f"/api/emergencies/caller/{TEST_CALLER}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["caller_phone"] == TEST_CALLER


def test_13_update_status():
    emergencies = client.get("/api/emergencies").json()
    eid = emergencies[0]["id"]
    resp = client.patch(f"/api/emergencies/{eid}/status", json={"status": "dispatched"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "dispatched"


def test_14_cleanup():
    emergencies = client.get("/api/emergencies").json()
    for e in emergencies:
        client.delete(f"/api/emergencies/{e['id']}")
    resp = client.get("/api/emergencies")
    assert resp.status_code == 200
    assert len(resp.json()) == 0


if __name__ == "__main__":
    test_functions = [
        test_1_create_emergency,
        test_2_list_emergencies,
        test_3_transcript_chunk_without_emergency_id,
        test_4_transcript_chunk_with_emergency_id,
        test_5_get_transcript_chunks,
        test_6_transcript_complete_webhook,
        test_7_verify_transcript_saved,
        test_8_recent_emergencies,
        test_9_emergency_stats,
        test_10_filter_by_type,
        test_11_filter_by_severity,
        test_12_filter_by_caller,
        test_13_update_status,
        test_14_cleanup,
    ]

    passed = 0
    failed = 0
    for fn in test_functions:
        name = fn.__name__
        try:
            result = fn()
            if result is not None:
                print(f"  PASS  {name} -> {result}")
            else:
                print(f"  PASS  {name}")
            passed += 1
        except Exception as e:
            print(f"  FAIL  {name}: {e}")
            import traceback
            traceback.print_exc()
            failed += 1

    try:
        if os.path.exists("./test_savior_e2e.db"):
            os.remove("./test_savior_e2e.db")
    except PermissionError:
        pass

    print(f"\n{'='*50}")
    print(f"  {passed} passed, {failed} failed, {passed+failed} total")
    print(f"{'='*50}")
    sys.exit(0 if failed == 0 else 1)
