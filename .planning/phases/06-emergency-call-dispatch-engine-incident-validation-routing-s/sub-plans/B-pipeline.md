---
phase: 06-dispatch-engine
plan: B
type: execute
wave: 2
depends_on:
  - A
files_modified:
  - backend/app/services/dispatch_service.py
  - backend/app/services/emergency_service.py
  - backend/app/api/v1/endpoints/dispatch.py
  - backend/app/api/v1/endpoints/location.py
  - backend/app/static/location.html
  - backend/app/main.py
  - backend/app/core/config.py
autonomous: true
requirements:
  - D-01
  - D-03
  - D-04
  - D-06
  - D-07
  - D-16
  - D-17
  - D-18
  - D-21
  - D-22
  - D-23
  - D-29
user_setup: []
must_haves:
  truths:
    - Emergency creation triggers SMS with location capture link (D-20)
    - Location capture page at /location/{emergency_id} uses browser Geolocation API (D-17, D-18)
    - Location received → pipeline auto-continues (district check → duplicate check → ranking) (D-21)
    - Fallback: Bolna agent location used if SMS location not received (D-22, D-23)
    - GET /emergencies/{id}/stations returns top 5 ranked stations with route data (D-01, D-05)
    - POST /emergencies/{id}/dispatch creates dispatch record + auto-updates status (D-03)
    - Webhook /dispatch/ack receives Bolna station ACK and updates status (D-31)
    - Outside coverage area sets requires_manual_review flag (D-26)
  artifacts:
    - backend/app/services/dispatch_service.py
    - backend/app/api/v1/endpoints/dispatch.py
    - backend/app/api/v1/endpoints/location.py
    - backend/app/static/location.html
  key_links:
    - dispatch_service.py orchestrates all Wave 1 services in correct order
    - emergency_service.py hooks into dispatch pipeline on creation
    - SMS sent via sms_service on emergency creation
    - WebSocket broadcasts dispatch status changes via ConnectionManager
---

# Sub-Plan B: Dispatch Pipeline + API (Wave 2)

<objective>
**Purpose:** Create the dispatch orchestration pipeline that ties all Wave 1 services together, build the API endpoints for the frontend to consume, and create the standalone location capture page. This wave makes the system functional end-to-end at the backend level.

**Output:** Working backend pipeline that validates, ranks, dispatches, and tracks ACKs — accessible via REST API endpoints.
</objective>

<context>
@.planning/phases/06-emergency-call-dispatch-engine-incident-validation-routing-s/06-CONTEXT.md
@.planning/phases/06-emergency-call-dispatch-engine-incident-validation-routing-s/06-RESEARCH.md
@backend/app/services/emergency_service.py
@backend/app/api/v1/endpoints/emergency.py
@backend/app/api/v1/endpoints/transcript.py
@backend/app/core/websocket.py
@backend/app/main.py
</context>

<tasks>

<task>
<name>Task 1: Dispatch Pipeline Service (Orchestration)</name>
<files>
  backend/app/services/dispatch_service.py
  backend/app/services/emergency_service.py (amend — hook pipeline on creation)
  backend/app/core/config.py (amend — add BASE_URL)
</files>
<type>backend</type>

<read_first>
- `@backend/app/services/emergency_service.py` — create_emergency pattern for hooking the pipeline
- `@backend/app/services/geospatial_service.py` — district check functions
- `@backend/app/services/duplicate_service.py` — duplicate detection functions
- `@backend/app/services/station_service.py` — station ranking functions
- `@backend/app/services/sms_service.py` — SMS sending functions
- `@backend/app/services/routing_service.py` — route computation
- `@backend/app/models/emergency.py` — Emergency model with new fields
- `@backend/app/core/config.py` — env var pattern
</read_first>

<action>
Create the dispatch orchestration service (`backend/app/services/dispatch_service.py`):

This is the central pipeline that coordinates all dispatch logic. Follow the existing service function pattern.

**Pipeline functions:**

1. `async run_validation_pipeline(db, emergency: Emergency) -> dict` — Run validation steps after location is captured (or after emergency creation if location already present):
   - If `emergency.latitude` and `emergency.longitude` exist:
     a. District check: call `get_district_for_emergency(lat, lng)`. Set `emergency.district_check` to result. If outside coverage → set `emergency.pipeline_status = "pending_manual_review"` and return early (D-26).
     b. Inside coverage → continue.
   - Set `emergency.pipeline_status = "validating"` (D-21 auto-continue after location received)
   - Return status dict with `district_check`, `duplicate_check`, status info

2. `async run_ranking_pipeline(db, emergency: Emergency) -> list[dict]` — After validation passes, run station ranking:
   - Call `get_stations_by_type(db, emergency.emergency_type)` (D-10)
   - For each station, call `compute_route()` concurrently with `asyncio.gather()` (anti-pattern avoidance per RESEARCH.md — don't call sequentially)
   - Sort by ETA ascending, take top 5 (D-05)
   - Set `emergency.pipeline_status = "ranked"`
   - Return ranked list with station details + route data
   - Per D-12: no service radius — all matching stations ranked

3. `async execute_dispatch(db, emergency_id: int, station_id: int) -> dict` — Execute dispatch when dispatcher confirms (D-01, D-03):
   - Get emergency and station records
   - Create `DispatchRecord` with `status="pending_call"` (D-31)
   - Update emergency: `status="dispatched"`, `pipeline_status="dispatched"`, `dispatch_record_id` (D-03)
   - Initialize `MessageService` (SimulatedMessageService for now) and call `send_dispatch()` (D-35)
   - Broadcast via WebSocket: `{"type": "dispatch_update", "emergency_id": id, "dispatch_status": "dispatched"}`
   - Return dispatch record + emergency update

4. `async auto_trigger_dispatch_pipeline(db, emergency: Emergency) -> None` — Called after emergency creation:
   - Send SMS with location capture link via `sms_service.send_sms()` (D-19, D-20)
   - If emergency already has lat/lng (from Bolna), call `run_validation_pipeline()` immediately (D-22 fallback)
   - If no lat/lng: set `pipeline_status = "awaiting_location"` — pipeline continues when location arrives (D-21)
   - Per D-16: check for duplicates before proceeding; if duplicate found, merge and abort pipeline

5. `async escalate_dispatch(db, dispatch_record_id: int) -> dict | None` — Called on ACK timeout or webhook failure:
   - Get current DispatchRecord
   - If `status != "pending_call"` → return None (already acknowledged — race condition guard per RESEARCH.md Pitfall 5)
   - Set current record to `status="escalated"`
   - Get next-ranked station for the same emergency
   - If no more stations → set emergency to `dispatch_failed` (D-33)
   - Create new DispatchRecord for next station with `status="pending_call"`
   - Call `send_dispatch()` with fresh call — no escalation context (D-34)
   - Broadcast `{"type": "dispatch_escalated", "emergency_id": id, "station_id": next_station_id}`
   - Return new dispatch record or None if all stations failed

**Emergency service amendments** (`backend/app/services/emergency_service.py`):
- In `create_emergency()`: After creating the emergency record, import and call `auto_trigger_dispatch_pipeline(db, record)` as a fire-and-forget background task. Per D-06 (dispatch panel auto-triggers), D-20 (SMS sent automatically).

**Config amendments** (`backend/app/core/config.py`):
- Add `BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")` — used for SMS location link construction (D-18, D-21)
</action>

<verify>
<automated>
cd backend && python -c "
from app.services.dispatch_service import (
    run_validation_pipeline,
    run_ranking_pipeline,
    execute_dispatch,
    auto_trigger_dispatch_pipeline,
    escalate_dispatch
)
from app.core.config import BASE_URL
print(f'Dispatch pipeline imports OK, BASE_URL={BASE_URL}')
"
</automated>
</verify>

<done>
- dispatch_service.py with all pipeline functions compiles and imports
- emergency_service create_emergency hooks dispatch pipeline
- BASE_URL config added
- Pipeline handles location-flow (SMS waiting vs existing coords)
</done>
</task>

<task>
<name>Task 2: Dispatch + Location Endpoints + Location HTML Page</name>
<files>
  backend/app/api/v1/endpoints/dispatch.py
  backend/app/api/v1/endpoints/location.py
  backend/app/static/location.html
  backend/app/main.py (amend)
</files>
<type>backend</type>

<read_first>
- `@backend/app/api/v1/endpoints/emergency.py` — Endpoint pattern (APIRouter, Depends(get_db), HTTPException, WebSocket broadcast)
- `@backend/app/api/v1/endpoints/transcript.py` — Webhook endpoint pattern
- `@backend/app/core/websocket.py` — ConnectionManager broadcast pattern
- `06-RESEARCH.md` — Lines 971-1006 (dispatch endpoint code example), lines 209-242 (route preview + location html)
</read_first>

<action>
Create two new endpoint files and the location HTML page:

**Dispatch endpoints** (`backend/app/api/v1/endpoints/dispatch.py`):
- `GET /emergencies/{emergency_id}/stations` — Returns ranked stations for an emergency:
  - If emergency `pipeline_status` is not yet "ranked", call `run_ranking_pipeline(db, emergency)`
  - Return `list[StationRankingOut]` (D-05: top 5 stations with full details: name, distance, ETA, route map)
  - 404 if emergency not found (D-02: driven from dispatch panel which fetches this)
  
- `POST /emergencies/{emergency_id}/dispatch` — Dispatcher confirms dispatch:
  - Body: `DispatchRequest` with `station_id`
  - Call `execute_dispatch(db, emergency_id, station_id)` (D-01: dispatcher confirms, D-03: auto-updates status)
  - Broadcast `dispatch_update` via WebSocket
  - Return `DispatchResponse` with dispatch_id and new status
  - 404 if emergency not found

- `GET /emergencies/{emergency_id}/dispatch/status` — Get current dispatch status:
  - Return latest DispatchRecord for this emergency (D-31: pending_call tracking)
  - Return dispatch status + WebSocket broadcast info
  - 404 if no dispatch record found

- `POST /dispatch/ack` — Webhook endpoint for Bolna station ACK (D-31, D-32, D-33):
  - Accept JSON body: `{"dispatch_record_id": int, "call_id": str, "ack_status": str}`
  - Validate dispatch record exists and status is "pending_call" (race condition guard)
  - Update DispatchRecord status based on ack_status
  - If "acknowledged" → mark emergency as "dispatched", broadcast `dispatch_update`
  - If "rejected" or "no_answer" → call `escalate_dispatch(db, dispatch_record_id)`
  - Return `{"status": "acknowledged"}` — matches existing webhook pattern from transcript.py
  - Log all incoming ACK webhooks for audit (D-34: fresh call context, no escalation info needed)

**Location capture endpoints** (`backend/app/api/v1/endpoints/location.py`):
- `GET /location/{emergency_id}` — Serve standalone location capture HTML page (D-17, D-18):
  - Return `HTMLResponse` with the content of `static/location.html`
  - Inject emergency_id and POST URL into the HTML (template substitution)
  - 404 if emergency not found

- `POST /location/{emergency_id}` — Receive captured location coordinates (D-21):
  - Accept `{"latitude": float, "longitude": float}`
  - Update emergency: set `latitude`, `longitude`, `location_captured=True`
  - Broadcast `{"type": "location_received", "emergency_id": id, "latitude": lat, "longitude": lng}`
  - Call `run_validation_pipeline(db, emergency)` to auto-continue pipeline (D-21)
  - Return `{"status": "success", "message": "Location received"}`
  - Validate lat/lng ranges (-90 to 90, -180 to 180)
  - 404 if emergency not found

**Location HTML page** (`backend/app/static/location.html`):
- Standalone HTML page (no React bundle) served by backend (D-18)
- Content: Simple mobile-friendly page with:
  - Title: "SAVIOR — Location Sharing"
  - Instructions: "Please allow location access to help responders reach you."
  - Auto-trigger `navigator.geolocation.getCurrentPosition()` on page load
  - On success: POST coordinates to `/api/location/{emergency_id}` (relative URL)
  - Success message: "Location shared successfully. Responders are on their way."
  - Error message if geolocation denied/fails: "Location access denied. Please enable location services or the operator will use your reported address."
  - Clean, minimal CSS (inline, responsive, India-mobile-friendly)
  - Fallback: manual lat/lng input fields if geolocation not available
  - Use `{{EMERGENCY_ID}}` as template placeholder that gets replaced by the FastAPI endpoint

**Main app amendments** (`backend/app/main.py`):
- Import and register dispatch and location routers:
  ```python
  from app.api.v1.endpoints.dispatch import router as dispatch_router
  from app.api.v1.endpoints.location import router as location_router
  ```
- Add: `app.include_router(dispatch_router, prefix="/api")`
- Add: `app.include_router(location_router, prefix="/api")`
- Mount static files for location.html:
  ```python
  from fastapi.staticfiles import StaticFiles
  app.mount("/static", StaticFiles(directory="app/static"), name="static")
  ```
</action>

<verify>
<automated>
cd backend && python -c "
from app.api.v1.endpoints.dispatch import router as dispatch_router
from app.api.v1.endpoints.location import router as location_router
print('Dispatch + Location endpoints registered OK')

# Check routes
routes = [r.path for r in dispatch_router.routes]
print(f'Dispatch routes: {routes}')
routes_l = [r.path for r in location_router.routes]
print(f'Location routes: {routes_l}')
assert any('/stations' in r for r in routes)
assert any('/dispatch' in r for r in routes)
"
</automated>
</verify>

<done>
- GET /emergencies/{id}/stations returns ranked station list
- POST /emergencies/{id}/dispatch creates dispatch record + updates status
- POST /dispatch/ack receives Bolna ACK webhook
- GET /location/{id} serves location capture page
- POST /location/{id} receives coordinates and triggers pipeline
- All routers registered in main.py
- Static files mount for location.html
</done>
</task>

</tasks>
