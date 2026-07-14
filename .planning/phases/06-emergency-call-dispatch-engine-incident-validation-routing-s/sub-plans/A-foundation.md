---
phase: 06-dispatch-engine
plan: A
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/models/station.py
  - backend/app/models/dispatch_record.py
  - backend/app/models/emergency.py
  - backend/app/models/__init__.py
  - backend/app/schemas/station.py
  - backend/app/schemas/dispatch.py
  - backend/app/schemas/emergency.py
  - backend/app/services/station_service.py
  - backend/app/services/routing_service.py
  - backend/app/services/geospatial_service.py
  - backend/app/services/sms_service.py
  - backend/app/services/duplicate_service.py
  - backend/app/services/message_service.py
  - backend/app/core/config.py
  - backend/requirements/base.txt
  - backend/.env.example
autonomous: true
requirements:
  - D-08
  - D-09
  - D-10
  - D-11
  - D-12
  - D-13
  - D-14
  - D-15
  - D-16
  - D-19
  - D-20
  - D-24
  - D-25
  - D-26
  - D-27
  - D-28
  - D-30
  - D-35
user_setup: []
must_haves:
  truths:
    - Station model with name, type (police/fire/medical), lat/lng, address, phone
    - 17 stations seeded (6 police, 5 fire, 6 medical) for Hubli/Dharwad area
    - DispatchRecord model tracks dispatch lifecycle (pending_call → acknowledged → dispatch_failed)
    - Emergency model has location_captured, district_check, pipeline_status fields
    - Duplicate detection: same location + same type + 1-hour window → merge by appending
    - GeoJSON district boundary check via Shapely: outside → manual review flag
    - SMS service sends Fast2SMS to caller's phone using form-encoded httpx
    - Google Maps Routes API computes routes with Haversine fallback
    - MessageService interface defined (SimulatedMessageService for MVP, BolnaMessageService ready)
  artifacts:
    - backend/app/models/station.py
    - backend/app/models/dispatch_record.py
    - backend/app/schemas/station.py
    - backend/app/schemas/dispatch.py
    - backend/app/services/station_service.py
    - backend/app/services/routing_service.py
    - backend/app/services/geospatial_service.py
    - backend/app/services/sms_service.py
    - backend/app/services/duplicate_service.py
    - backend/app/services/message_service.py
  key_links:
    - Station ranking depends on routing_service for distance/ETA calculations
    - Duplicate detection runs at model/service level on emergency creation
    - SMS service uses httpx.AsyncClient (same pattern as geocoding_service.py)
    - GeoJSON coordinate order: Point(lng, lat) not Point(lat, lng)
---

# Sub-Plan A: Backend Foundation (Wave 1)

<objective>
**Purpose:** Create all backend data models, schemas, and core services needed for the dispatch engine. This is the foundation layer — models for stations and dispatch records, the emergency model gets pipeline status fields, and all standalone services (routing, geospatial, SMS, duplicate detection, message service) are built and importable.

**Output:** Working Station table with 17 seeded records, DispatchRecord table, enhanced Emergency model, and all backend services ready to be wired together in Wave 2.
</objective>

<context>
@.planning/phases/06-emergency-call-dispatch-engine-incident-validation-routing-s/06-CONTEXT.md
@.planning/phases/06-emergency-call-dispatch-engine-incident-validation-routing-s/06-RESEARCH.md
@backend/app/models/emergency.py
@backend/app/schemas/emergency.py
@backend/app/services/emergency_service.py
@backend/app/services/geocoding_service.py
@backend/app/core/config.py
@backend/app/core/database.py
@backend/data/districts.geojson
</context>

<tasks>

<task>
<name>Task 1: Station Model, Schema + DispatchRecord Model + Emergency Amendments</name>
<files>
  backend/app/models/station.py
  backend/app/models/dispatch_record.py
  backend/app/models/emergency.py (amend)
  backend/app/models/__init__.py (amend)
  backend/app/schemas/station.py
  backend/app/schemas/dispatch.py
  backend/app/schemas/emergency.py (amend)
</files>
<type>backend</type>

<read_first>
- `@backend/app/models/emergency.py` — Existing model pattern (SAEnum, Column types, Base)
- `@backend/app/schemas/emergency.py` — Existing schema pattern (BaseModel, from_attributes, model_validator)
- `@backend/app/models/__init__.py` — Export pattern
</read_first>

<action>
Create the following models and schemas:

**Station model** (`backend/app/models/station.py`):
- SQLAlchemy model `Station` with tablename `stations`
- Fields: `id` (PK, auto), `name` (String 255, not null), `type` (String 50, not null — values: "police", "fire", "medical"), `latitude` (Float, not null), `longitude` (Float, not null), `address` (Text, not null), `phone` (String 50, nullable)

**DispatchRecord model** (`backend/app/models/dispatch_record.py`):
- SQLAlchemy model `DispatchRecord` with tablename `dispatch_records`
- Fields: `id` (PK, auto), `emergency_id` (Integer, FK to emergencies.id, not null, indexed), `station_id` (Integer, FK to stations.id, not null), `status` (SAEnum — values: "pending_call", "acknowledged", "rejected", "no_answer", "escalated", "dispatch_failed"), `dispatched_at` (DateTime, nullable), `acknowledged_at` (DateTime, nullable), `created_at` (DateTime, default utcnow)
- Add `__tablename__`, `__repr__`

**Emergency model amendments** (`backend/app/models/emergency.py`):
- Add field: `location_captured` (Boolean, default False)
- Add field: `district_check` (String 50, nullable — values: "inside_coverage", "outside_coverage", "not_checked")
- Add field: `pipeline_status` (String 50, nullable, default None — values: "pending", "validating", "ranked", "dispatched", "dispatch_failed", "escalated")
- Add field: `dispatch_record_id` (Integer, nullable) — reference to the active dispatch record
- Add import for `Boolean` from sqlalchemy

**Station schemas** (`backend/app/schemas/station.py`):
- `StationCreate` — Pydantic with `name`, `type`, `latitude`, `longitude`, `address`, `phone` (Optional)
- `StationOut` — Pydantic with all fields + `id`, `Config.from_attributes = True`
- `StationRankingOut` — Pydantic with `station: StationOut`, `distance_km: float`, `eta_minutes: float`, `encoded_polyline: str`

**Dispatch schemas** (`backend/app/schemas/dispatch.py`):
- `DispatchStatus` — str Enum with values: "pending_call", "acknowledged", "rejected", "no_answer", "escalated", "dispatch_failed"
- `DispatchRequest` — Pydantic with `emergency_id: int`, `station_id: int`
- `DispatchResponse` — Pydantic with `status: str`, `dispatch_id: int`, `message: str`
- `DispatchRecordOut` — Pydantic with all DispatchRecord fields, `Config.from_attributes = True`

**__init__.py amendments** (`backend/app/models/__init__.py`):
- Import `Station`, `DispatchRecord` and add to `__all__`

Per D-08, D-09, D-10, D-11, D-12 (stations in MySQL, type matching, always available, no radius). Per D-03, D-31 (dispatch auto-updates status, pending_call tracking). Use same patterns as existing Emergency model (SAEnum, declarative Base).
</action>

<verify>
<automated>
cd backend && python -c "
from app.models.station import Station
from app.models.dispatch_record import DispatchRecord
from app.models.emergency import Emergency
# Check new fields exist
e = Emergency()
assert hasattr(e, 'location_captured')
assert hasattr(e, 'district_check')
assert hasattr(e, 'pipeline_status')
assert hasattr(e, 'dispatch_record_id')
from app.schemas.station import StationOut, StationRankingOut
from app.schemas.dispatch import DispatchResponse, DispatchRecordOut
print('Station + DispatchRecord models/schemas OK')
"
</automated>
</verify>

<done>
- Station model has all fields per D-09
- DispatchRecord model has all fields per D-31 + escalation tracking
- Emergency model has new pipeline/status fields
- All schemas compile and validate
- `models/__init__.py` exports new models
</done>
</task>

<task>
<name>Task 2: Station Service + Routing Service + Geospatial Service</name>
<files>
  backend/app/services/station_service.py
  backend/app/services/routing_service.py
  backend/app/services/geospatial_service.py
  backend/app/requirements/base.txt (amend — add shapely)
</files>
<type>backend</type>

<read_first>
- `@backend/app/services/emergency_service.py` — CRUD pattern (functions, db: Session, commit+refresh)
- `@backend/app/services/geocoding_service.py` — httpx.AsyncClient pattern, error handling
- `@backend/data/districts.geojson` — Existing Dharwad district boundary polygon
- `06-RESEARCH.md` — Lines 108-179 (routing service code), 615-663 (geospatial service code), 885-910 (station ranking code)
</read_first>

<action>
Create three service files following existing patterns (module-level async functions, db: Session param, commit+refresh):

**Station service** (`backend/app/services/station_service.py`):
- `get_stations_by_type(db, emergency_type: str) -> list[Station]` — Query stations where type matches (D-10: fire→fire, police→police, medical→medical). Lowercase normalization on both sides.
- `rank_stations(db, emergency_lat: float, emergency_lng: float, emergency_type: str, limit: int = 5) -> list[dict]` — Get matching stations, compute route for each concurrently via `asyncio.gather()`, sort by ETA ascending, return top N with `station`, `distance_km`, `eta_minutes`, `encoded_polyline` (D-01, D-05, D-12: all stations ranked, no radius limit)
- `seed_stations(db) -> int` — Check if stations table is empty. If empty, insert the 17 Hubli/Dharwad stations from 06-RESEARCH.md (6 police, 5 fire, 6 medical) using their exact names, addresses, lat/lng, and phone numbers. Commit and return count. Per D-13.
- Create a standalone seed script `backend/app/seed_stations.py` that calls `seed_stations()` then prints "Seeded {N} stations"
- All stations assumed always available per D-11 — no availability filter

**Routing service** (`backend/app/services/routing_service.py`):
- `compute_route(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> dict | None` — Google Maps Routes API via httpx.AsyncClient (same pattern as geocoding_service.py). Headers: `X-Goog-Api-Key`, `X-Goog-FieldMask: routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline`. POST to `https://routes.googleapis.com/directions/v2:computeRoutes`. Return `{distance_meters, duration_seconds, encoded_polyline}` from first route. On failure → call `_haversine_fallback`. Per D-27, D-28.
- `_haversine_fallback(lat1, lng1, lat2, lng2) -> dict` — Haversine great-circle distance (Earth radius 6371km), estimated speed 40 km/h for drive time approximation. Returns same dict shape as Google Maps response. This is the implementation when `GOOGLE_MAPS_API_KEY` is not set. Per D-28.
- `_parse_duration(duration_str: str) -> int` — Parse `"1234s"` to integer seconds
- Read `GOOGLE_MAPS_API_KEY` from `os.getenv("GOOGLE_MAPS_API_KEY", "")` — configured via `.env`
- Logger: `logging.getLogger("savior.routing")`

**Geospatial service** (`backend/app/services/geospatial_service.py`):
- `_load_districts() -> list[dict]` — Load and cache `backend/data/districts.geojson` at module level. Parse each feature with `shapely.geometry.shape()`. Add `name` from `properties.name`. Per D-24.
- `is_inside_coverage(lat: float, lng: float) -> tuple[bool, str]` — Construct `Point(lng, lat)` (CRITICAL: GeoJSON uses [lng, lat] order per Pitfall 1 in RESEARCH.md). Check `polygon.contains(point)`. Return `(is_inside, district_name)`.
- `get_district_for_emergency(lat: float, lng: float) -> dict` — Return `{"in_coverage_area": bool, "district": str, "requires_manual_review": bool}`. Outside coverage → `requires_manual_review=true`. Per D-26.
- Logger: `logging.getLogger("savior.geospatial")`
- Install shapely via `pip install shapely` and add to `requirements/base.txt` (alphabetical order)

**Config amendments** (`backend/app/core/config.py`):
- Add env var: `GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")`

**`.env.example` amendments:**
- Add `GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here`
</action>

<verify>
<automated>
cd backend && python -c "
# Test import
from app.services.station_service import rank_stations, seed_stations, get_stations_by_type
from app.services.routing_service import compute_route, _haversine_fallback
from app.services.geospatial_service import is_inside_coverage, get_district_for_emergency

# Test haversine fallback (Hubli to KIMS hospital)
result = _haversine_fallback(15.36, 75.12, 15.3618, 75.1307)
assert 'distance_meters' in result
assert 'duration_seconds' in result
assert 'encoded_polyline' in result
assert result['distance_meters'] > 0
print(f'Haversine fallback: {result[\"distance_meters\"]}m, {result[\"duration_seconds\"]}s')

# Test district check (Hubli center)
inside, name = is_inside_coverage(15.36, 75.12)
print(f'Hubli center: inside={inside}, district={name}')

# Test district check (Bangalore — outside)
outside, name_out = is_inside_coverage(12.97, 77.59)
print(f'Bangalore: inside={outside}')
assert not outside
"
</automated>
</verify>

<done>
- Station service can query by type and rank by ETA
- Routing service computes routes via Google Maps with Haversine fallback
- Geospatial service correctly identifies inside/outside Dharwad district
- Haversine fallback returns consistent distance/duration values
- Config has GOOGLE_MAPS_API_KEY
</done>
</task>

<task>
<name>Task 3: SMS Service + Duplicate Detection + MessageService Interface + Seed Data</name>
<files>
  backend/app/services/sms_service.py
  backend/app/services/duplicate_service.py
  backend/app/services/message_service.py
  backend/app/core/config.py (amend)
  backend/app/.env.example (amend)
  (station seed data inserted via station_service seed_stations function)
</files>
<type>backend</type>

<read_first>
- `@backend/app/services/geocoding_service.py` — httpx.AsyncClient pattern (data= not json= for form-encoded)
- `@backend/app/services/emergency_service.py` — CRUD pattern, Session usage
- `06-RESEARCH.md` — Lines 264-307 (Fast2SMS SMS code, CRITICAL: use `data=payload` not `json=payload` per Pitfall 2), lines 397-440 (MessageService interface)
</read_first>

<action>
Create three service files:

**SMS service** (`backend/app/services/sms_service.py`):
- `send_sms(phone: str, message: str) -> bool` — Send SMS via Fast2SMS API. POST to `https://www.fast2sms.com/dev/bulkV2` using `httpx.AsyncClient` with `data=payload` (form-encoded, NOT `json=` — critical gotcha per D-19 and RESEARCH.md Pitfall 2). Headers: `authorization: FAST2SMS_API_KEY`, `Content-Type: application/x-www-form-urlencoded`. Payload: `{"message": message, "language": "english", "route": "q", "numbers": phone}`. Return True if `result.get("return")` is truthy.
- If `FAST2SMS_API_KEY` not set → log warning and return False (graceful fallback, no crash)
- `LOCATION_SMS_TEMPLATE` constant: `"SAVIOR Alert: Please share your location for emergency response.\nClick: {location_url}\nLink expires in 5 minutes."`
- `build_location_sms(phone: str, emergency_id: int, base_url: str) -> tuple[str, str]` — Build phone + message with location URL `{base_url}/location/{emergency_id}`
- Logger: `logging.getLogger("savior.sms")`
- Per D-19 (Fast2SMS chosen), D-20 (SMS sent automatically on emergency creation)

**Duplicate detection** (`backend/app/services/duplicate_service.py`):
- `check_duplicate(db, location: str, emergency_type: str, created_at: datetime) -> Emergency | None` — Query for emergencies with same `location` string AND same `emergency_type` (case-insensitive) AND within 1-hour window of the given time. Return the first match or None. Per D-14.
- `merge_duplicate(db, existing: Emergency, new_data: EmergencyCreate) -> Emergency` — Append `new_data.description` to `existing.description` (with separator `"\n---\n"`). Append `new_data.caller_name` and `new_data.caller_phone` to existing record (format: `", {name} ({phone})"`). Caller info appends as a note. Commit and refresh. Return updated record. Per D-15.
- `is_duplicate(db, location: str, emergency_type: str, created_at: datetime) -> tuple[bool, Emergency | None]` — Combination function for use in pipeline: returns `(is_dup, existing_record)`.
- Per D-16 (auto on every new emergency creation — this service is called from the pipeline but does not auto-hook here)

**MessageService interface** (`backend/app/services/message_service.py`):
- `MessageService(ABC)` — Abstract base class with abstract methods:
  - `async send_dispatch(self, station_phone: str, incident: dict) -> str | None` — Returns call_id or None
  - `async get_ack_status(self, call_id: str) -> str | None` — Returns 'acknowledged', 'rejected', 'no_answer', or None
- `SimulatedMessageService(MessageService)` — MVP implementation (D-35):
  - `send_dispatch()` — Returns `f"sim_call_{incident['emergency_id']}_{int(time.time())}"`
  - `get_ack_status()` — Returns `"acknowledged"` (always succeeds for MVP demo)
- `BolnaMessageService(MessageService)` — Production stub ready (D-30, D-35):
  - `__init__(self, api_token: str, agent_id: str, webhook_base: str)` — Store config
  - `send_dispatch()` — TODO: call Bolna POST /call (stubbed, logs intent and returns simulated ID for now)
  - `get_ack_status()` — TODO: query Bolna execution status (stubbed, returns "acknowledged")
  - Add comprehensive docstrings explaining the Bolna integration flow per RESEARCH.md lines 376-394

**Config amendments** (`backend/app/core/config.py`):
- Add `FAST2SMS_API_KEY = os.getenv("FAST2SMS_API_KEY", "")`
- Add `BOLNA_API_TOKEN = os.getenv("BOLNA_API_TOKEN", "")`
- Add `BOLNA_AGENT_ID = os.getenv("BOLNA_AGENT_ID", "")`

**`.env.example` amendments:**
- Add `FAST2SMS_API_KEY=your_fast2sms_api_key_here`
- Add `BOLNA_API_TOKEN=bn-your_bolna_api_token_here`
- Add `BOLNA_AGENT_ID=your_outbound_agent_id_here`

**Seed stations** (part of station_service):
- Ensure `seed_stations()` function is callable independently. The task runner should execute it after migration:
  ```bash
  cd backend && python -c "from app.core.database import SessionLocal; from app.services.station_service import seed_stations; db = SessionLocal(); n = seed_stations(db); print(f'Seeded {n} stations'); db.close()"
  ```
</action>

<verify>
<automated>
cd backend && python -c "
from app.services.sms_service import send_sms, build_location_sms, LOCATION_SMS_TEMPLATE
from app.services.duplicate_service import check_duplicate, merge_duplicate
from app.services.message_service import MessageService, SimulatedMessageService, BolnaMessageService

# Test SMS builder
phone, msg = build_location_sms('9876543210', 42, 'http://localhost:8000')
assert '/location/42' in msg
print(f'SMS builder: {phone} → {msg[:60]}...')

# Test MessageService interface
sim = SimulatedMessageService()
import asyncio
cid = asyncio.run(sim.send_dispatch('1234567890', {'emergency_id': 42}))
assert cid and cid.startswith('sim_call_42')
ack = asyncio.run(sim.get_ack_status(cid))
assert ack == 'acknowledged'
print(f'SimulatedMessageService: call_id={cid}, ack={ack}')

# Test BolnaMessageService stub exists
bolna = BolnaMessageService('test_token', 'test_agent', 'http://localhost:8000/hook')
print('BolnaMessageService stub OK')
"
</automated>
</verify>

<done>
- SMS service sends Fast2SMS messages via form-encoded httpx
- Duplicate detection finds same location+type+1h window merges
- MessageService interface + SimulatedMessageService implemented
- BolnaMessageService stub ready for Wave 4
- All env vars added to config.py and .env.example
</done>
</task>

</tasks>
