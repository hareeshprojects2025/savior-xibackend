import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ["DATABASE_URL"] = "sqlite:///./test_savior_fixes.db"
os.environ["BOLNA_WEBHOOK_SECRET"] = "test-secret"

# Fresh DB every run — pytest doesn't run the __main__ cleanup block
_db_path = os.path.join(os.path.dirname(__file__), "..", "test_savior_fixes.db")
if os.path.exists(_db_path):
    try:
        os.remove(_db_path)
    except PermissionError:
        pass

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app

import app.services.emergency_service as _es
import app.services.geocoding_service as _gs


async def _noop_geocode(location, landmark=None):  # type: ignore[no-untyped-def]
    return None


_gs.geocode_location = _noop_geocode  # type: ignore[method-assign]

# Undo test_e2e.py's global stub (it runs first alphabetically and replaces
# create_emergency with a no-merge helper) — this file needs the REAL one.
# Reload restores the original implementation; re-patch the endpoint binding.
import importlib
import app.api.v1.endpoints.emergency as _ep
import app.api.v1.endpoints.dispatch as _dispatch_mod

_es = importlib.reload(_es)
_ep.create_emergency = _es.create_emergency

# config.py caches BOLNA_WEBHOOK_SECRET at first import (possibly "" if
# test_e2e.py imported first) — pin the value the handler actually reads.
_dispatch_mod.BOLNA_WEBHOOK_SECRET = "test-secret"


async def _noop_background(emergency_id, location, landmark):  # type: ignore[no-untyped-def]
    return None


_es._geocode_and_pipeline = _noop_background  # type: ignore[attr-defined]

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

AUTH_HEADERS = {"Authorization": "Bearer test-secret"}

TRANSCRIPT_120 = (
    "assistant: Hello, you've reached SAVIOR AI Emergency Assistance. What emergency are you experiencing?\n"
    "user: experiencing an car, uh, car accident.\n"
    "assistant: Where did the car accident happen? Please provide the location.\n"
    "user: It is in Vidya Nagar, Hubli.\n"
    "assistant: Can you please tell me your name and if anyone is injured?\n"
    "user: Yes, my name is Samruddh.\n"
    "user: I am the only person injured.\n"
    "assistant: Can you describe your injuries?\n"
    "user: My leg, back pain, broken bone.\n"
    "user: Two vehicles have collided.\n"
    "user: There is petrol leakage. Sir, sir, fire is happening.\n"
    "assistant: Is there any landmark near the accident site?\n"
    "user: Yes, sir. Landmark is, uh, B.B. College.\n"
    "assistant: Thank you, Samruddh. To summarize: There is a road accident at Vidya Nagar, Hubli "
    "near B. B. College involving two vehicles. You are injured with leg and back pain and a broken bone. "
    "There is petrol leakage and a fire at the scene.\n"
)


def _create_emergency_row(**overrides):  # type: ignore[no-untyped-def]
    from app.models.emergency import Emergency

    db = TestSession()
    try:
        data = {
            "caller_name": "Unknown",
            "caller_phone": "+919113896575",
            "victim_name": None,
            "emergency_type": "Road Accident",
            "severity": None,
            "location": "Vidya Nagar, Hubli",
            "landmark": None,
            "victims": None,
            "description": None,
            "immediate_danger": None,
            "summary": None,
            "status": "pending",
            "bolna_call_id": "fix-call-001",
            **overrides,
        }
        row = Emergency(**data)
        db.add(row)
        db.commit()
        db.refresh(row)
        return row
    finally:
        db.close()


def _create_dispatch_record(emergency_id: int, call_id: str = "call-abc"):  # type: ignore[no-untyped-def]
    from app.models.dispatch_record import DispatchRecord

    db = TestSession()
    try:
        record = DispatchRecord(
            emergency_id=emergency_id,
            station_id=1,
            status="pending_call",
            dispatched_at=datetime.now(timezone.utc),
            call_id=call_id,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record
    finally:
        db.close()


def test_1_merge_update_same_bolna_call_id():
    # First report: early, partial — victims=0 false zero, no severity/landmark
    r1 = client.post("/api/emergency", json={
        "caller_name": "",
        "caller_phone": "+919113896575",
        "emergency_type": "Road Accident",
        "location": "Vidya Nagar, Hubli",
        "victims": 0,
        "bolna_call_id": "fix-call-001",
    })
    assert r1.status_code == 200, r1.text

    # Second report: same call_id with full intel
    r2 = client.post("/api/emergency", json={
        "caller_name": "Samruddh",
        "caller_phone": "+919113896575",
        "emergency_type": "Road Accident",
        "location": "Vidya Nagar, Hubli",
        "victims": 1,
        "severity": "Critical",
        "landmark": "B.B. College",
        "immediate_danger": "Fire, petrol leakage",
        "description": "Two vehicles collided, broken bone",
        "bolna_call_id": "fix-call-001",
    })
    assert r2.status_code == 200, r2.text

    rows = client.get("/api/emergencies").json()
    matches = [e for e in rows if e["bolna_call_id"] == "fix-call-001"]
    assert len(matches) == 1, f"Expected exactly 1 emergency, got {len(matches)}"
    e = matches[0]
    assert e["victims"] == 1, f"victims should be 1, got {e['victims']}"
    assert e["severity"] == "Critical"
    assert e["landmark"] == "B.B. College"
    assert e["caller_name"] == "Samruddh"
    assert e["immediate_danger"] == "Fire, petrol leakage"


def test_2_merge_update_no_empty_clobber():
    _create_emergency_row(caller_name="Harish", victims=2, bolna_call_id="fix-call-002")
    db = TestSession()
    try:
        from app.models.emergency import Emergency
        from app.schemas.emergency import EmergencyCreate
        from app.services.emergency_service import _merge_emergency_update

        e = db.query(Emergency).filter(Emergency.bolna_call_id == "fix-call-002").first()

        # Empty strings normalize to None via the validator → must not clobber
        updated = asyncio.run(_merge_emergency_update(
            db,
            e,
            EmergencyCreate(
                caller_name="",
                victims=0,
                severity="",
                emergency_type="Fire",
                location="Somewhere",
                bolna_call_id="fix-call-002",
            ),
        ))
        assert updated.caller_name == "Harish", "Empty caller_name must not clobber"
        assert updated.victims == 2, "victims=0 must not clobber an existing count"
        assert updated.severity is None, "Empty severity must not clobber"
        assert updated.location == "Somewhere"
    finally:
        db.close()


def test_3_ack_by_emergency_id():
    e = _create_emergency_row(bolna_call_id="fix-call-003")
    _create_dispatch_record(e.id, call_id="call-003")

    resp = client.post("/api/dispatch/ack", json={
        "emergency_id": str(e.id),
        "ack_status": "acknowledged",
    }, headers=AUTH_HEADERS)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "acknowledged"

    db = TestSession()
    try:
        from app.models.dispatch_record import DispatchRecord
        from app.models.emergency import Emergency

        record = db.query(DispatchRecord).filter(DispatchRecord.emergency_id == e.id).first()
        assert record.status.value == "acknowledged"
        emergency = db.query(Emergency).filter(Emergency.id == e.id).first()
        assert emergency.status.value == "dispatched"
        assert emergency.pipeline_status == "dispatched"
    finally:
        db.close()


def test_4_ack_matches_by_call_id_execution_id():
    e = _create_emergency_row(bolna_call_id="fix-call-004")
    _create_dispatch_record(e.id, call_id="stored-call")
    # Record's bolna_execution_id set — webhook carries only call_id (execution uuid)
    db = TestSession()
    try:
        from app.models.dispatch_record import DispatchRecord

        record = db.query(DispatchRecord).filter(DispatchRecord.emergency_id == e.id).first()
        record.bolna_execution_id = "4daab927-e667-4e57-8db8-9fc986068853"
        db.commit()
    finally:
        db.close()

    resp = client.post("/api/dispatch/ack", json={
        "call_id": "4daab927-e667-4e57-8db8-9fc986068853",
        "ack_status": "acknowledged",
    }, headers=AUTH_HEADERS)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "acknowledged"


def test_5_orphan_ack_surfaces_and_does_not_500():
    e = _create_emergency_row(bolna_call_id="fix-call-005")
    resp = client.post("/api/dispatch/ack", json={
        "emergency_id": str(e.id),
        "ack_status": "acknowledged",
    }, headers=AUTH_HEADERS)
    assert resp.status_code == 200, resp.text
    assert "orphan" in resp.json().get("reason", "").lower()


def test_6_ack_webhook_rejects_bad_secret():
    e = _create_emergency_row(bolna_call_id="fix-call-006")
    _create_dispatch_record(e.id)
    resp = client.post("/api/dispatch/ack", json={
        "emergency_id": str(e.id),
        "ack_status": "acknowledged",
    }, headers={"Authorization": "Bearer wrong-secret"})
    assert resp.status_code == 401


def test_7_transcript_intel_extractor():
    from app.services.transcript_service import extract_emergency_intel

    intel = extract_emergency_intel(TRANSCRIPT_120)
    assert intel.get("victims") == 1
    assert intel.get("caller_name") == "Samruddh"
    assert intel.get("landmark") == "B.B. College"
    assert "fire" in intel.get("immediate_danger", "").lower()
    assert "petrol" in intel.get("immediate_danger", "").lower()
    assert intel.get("severity") == "Critical"
    assert "road accident" in intel.get("summary", "").lower()


def test_8_transcript_complete_backfills_intel():
    e = _create_emergency_row(bolna_call_id="fix-call-008", victims=0, severity=None, landmark=None)
    resp = client.post("/api/transcript/complete", json={
        "id": "fix-call-008",
        "status": "completed",
        "user_number": "+919113896575",
        "transcript": TRANSCRIPT_120,
    })
    assert resp.status_code == 200, resp.text

    row = client.get(f"/api/emergencies/{e.id}").json()
    assert row["victims"] == 1, f"victims backfilled, got {row['victims']}"
    assert row["severity"] == "Critical"
    assert row["landmark"] == "B.B. College"
    assert row["caller_name"] == "Samruddh"
    assert row["summary"] is not None


def test_9_stuck_pipeline_sweep_recovers():
    from app.core import database as _db_module

    old_session = _db_module.SessionLocal
    _db_module.SessionLocal = TestSession
    try:
        from app.services.dispatch_service import _run_stuck_pipeline_sweep_once

        e = _create_emergency_row(
            bolna_call_id="fix-call-009",
            pipeline_status="validating",
            created_at=datetime.now(timezone.utc) - timedelta(minutes=30),
        )
        asyncio.run(_run_stuck_pipeline_sweep_once())

        db = TestSession()
        try:
            from app.models.emergency import Emergency

            row = db.query(Emergency).filter(Emergency.id == e.id).first()
            assert row.pipeline_status == "awaiting_location", \
                f"expected awaiting_location, got {row.pipeline_status}"
        finally:
            db.close()
    finally:
        _db_module.SessionLocal = old_session


if __name__ == "__main__":
    import traceback

    test_functions = [
        test_1_merge_update_same_bolna_call_id,
        test_2_merge_update_no_empty_clobber,
        test_3_ack_by_emergency_id,
        test_4_ack_matches_by_call_id_execution_id,
        test_5_orphan_ack_surfaces_and_does_not_500,
        test_6_ack_webhook_rejects_bad_secret,
        test_7_transcript_intel_extractor,
        test_8_transcript_complete_backfills_intel,
        test_9_stuck_pipeline_sweep_recovers,
    ]

    passed = 0
    failed = 0
    for fn in test_functions:
        try:
            fn()
            print(f"  PASS  {fn.__name__}")
            passed += 1
        except Exception as e:
            print(f"  FAIL  {fn.__name__}: {e}")
            traceback.print_exc()
            failed += 1

    try:
        if os.path.exists("./test_savior_fixes.db"):
            os.remove("./test_savior_fixes.db")
    except PermissionError:
        pass

    print(f"\n{'='*50}")
    print(f"  {passed} passed, {failed} failed, {passed+failed} total")
    print(f"{'='*50}")
    sys.exit(0 if failed == 0 else 1)
