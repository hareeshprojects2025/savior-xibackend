---
phase: 06-dispatch-engine
plan: index
type: execute
wave: 0
depends_on:
  - phase-05-polish
files_modified:
  - backend/app/models/station.py
  - backend/app/models/dispatch_record.py
  - backend/app/models/emergency.py
  - backend/app/schemas/station.py
  - backend/app/schemas/dispatch.py
  - backend/app/schemas/emergency.py
  - backend/app/services/station_service.py
  - backend/app/services/routing_service.py
  - backend/app/services/geospatial_service.py
  - backend/app/services/sms_service.py
  - backend/app/services/duplicate_service.py
  - backend/app/services/dispatch_service.py
  - backend/app/services/message_service.py
  - backend/app/api/v1/endpoints/dispatch.py
  - backend/app/api/v1/endpoints/location.py
  - backend/app/static/location.html
  - backend/app/main.py
  - backend/app/core/config.py
  - backend/requirements/base.txt
  - backend/.env.example
  - frontend/src/pages/DispatchPage.tsx
  - frontend/src/components/dispatch/StationCard.tsx
  - frontend/src/components/dispatch/StationRanking.tsx
  - frontend/src/components/dispatch/RoutePreview.tsx
  - frontend/src/components/dispatch/EscalationTimer.tsx
  - frontend/src/hooks/useDispatch.ts
  - frontend/src/App.tsx
  - frontend/src/components/layout/Sidebar.tsx
  - frontend/src/lib/types.ts
  - frontend/src/hooks/EmergencyFeedContext.tsx
  - bolna-agent/custom-functions/station-ack.json
  - bolna-agent/prompts/station-ack-prompt.md
autonomous: false
requirements:
  - US-03
  - FR-07
  - D-01
  - D-02
  - D-03
  - D-04
  - D-05
  - D-06
  - D-07
  - D-08
  - D-09
  - D-10
  - D-11
  - D-12
  - D-13
  - D-14
  - D-15
  - D-16
  - D-17
  - D-18
  - D-19
  - D-20
  - D-21
  - D-22
  - D-23
  - D-24
  - D-25
  - D-26
  - D-27
  - D-28
  - D-29
  - D-30
  - D-31
  - D-32
  - D-33
  - D-34
  - D-35
user_setup: []
must_haves:
  truths:
    - Stations for Hubli/Dharwad seeded in MySQL with police/fire/medical types
    - Duplicate emergencies are merged (same location + same type + 1-hour window)
    - SMS sent to caller with geolocation capture link on emergency creation
    - District boundary check validates emergencies against Dharwad GeoJSON
    - Top 5 stations ranked by ETA for each emergency
    - Dispatch panel shows route preview before dispatcher confirms
    - Dispatcher confirms dispatch → emergency status auto-updates to "dispatched"
    - Station ACK tracked via MessageService (simulated for MVP, Bolna-ready)
    - Escalation: 2-min timeout on no-ACK → next station → dispatch_failed after all 5 fail
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
    - backend/app/services/dispatch_service.py
    - backend/app/services/message_service.py
    - backend/app/api/v1/endpoints/dispatch.py
    - backend/app/api/v1/endpoints/location.py
    - backend/app/static/location.html
    - backend/data/districts.geojson
    - frontend/src/pages/DispatchPage.tsx
    - frontend/src/components/dispatch/StationCard.tsx
    - frontend/src/components/dispatch/StationRanking.tsx
    - frontend/src/components/dispatch/RoutePreview.tsx
    - frontend/src/components/dispatch/EscalationTimer.tsx
    - frontend/src/hooks/useDispatch.ts
  key_links:
    - Station ranking depends on routing_service (Google Maps Routes API)
    - Dispatch pipeline orchestration in dispatch_service coordinates validation + ranking
    - Emergency model auto-triggers SMS + pipeline on creation
    - WebSocket broadcasts dispatch status changes to frontend in real-time
    - MessageService interface abstracts Bolna vs simulated ACK
---

# Phase 6: Dispatch Engine — Plan Index

<objective>
**Purpose:** Implement the complete automated emergency dispatch pipeline — incident validation (district check, duplicate detection, location capture via SMS), station ranking and routing, dispatch execution with dispatcher confirmation, and station ACK tracking via Bolna agent (simulated for MVP).

**Output:** Working end-to-end dispatch system where emergency creation triggers an SMS location capture request, runs through validation (district boundary check, duplicate detection), ranks top 5 matching stations with route preview, presents results in a new Dispatch Panel UI, and dispatches with ACK tracking and escalation logic.

**Execution Order:** Sub-plan A → Sub-plan B → Sub-plan C → Sub-plan D (sequential waves). Within each sub-plan, tasks execute sequentially per the wave.
</objective>

<execution_context>
@.opencode/gsd-core/workflows/execute-plan.md
@.opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/06-emergency-call-dispatch-engine-incident-validation-routing-s/06-CONTEXT.md
@.planning/phases/06-emergency-call-dispatch-engine-incident-validation-routing-s/06-RESEARCH.md
</context>

---

## Execution Wave Structure

```
Wave 1 (A — Foundation) ──► Wave 2 (B — Pipeline + API) ──► Wave 3 (C — Frontend) ──► Wave 4 (D — ACK)
```

All waves execute sequentially. Each wave matches one sub-plan.

| # | Sub-plan | Wave | Scope | Depends On |
|---|----------|------|-------|------------|
| A | [Backend Foundation](#sub-plan-a-backend-foundation-wave-1) | 1 | Station model, DispatchRecord model, Emergency amendments, core services (station, routing, geospatial, SMS, duplicate, MessageService) | None |
| B | [Dispatch Pipeline + API](#sub-plan-b-dispatch-pipeline--api-wave-2) | 2 | dispatch_service orchestration, endpoints (dispatch, location, station ACK webhook), location.html page, config | A |
| C | [Frontend Dispatch Panel](#sub-plan-c-frontend-dispatch-panel-wave-3) | 3 | DispatchPage, StationCard, StationRanking, RoutePreview, EscalationTimer, useDispatch hook, WS integration | B |
| D | [ACK + Bolna Integration](#sub-plan-d-ack--bolna-integration-wave-4) | 4 | BolnaMessageService, ACK webhook, escalation timer server-side, dispatch_failed handling, WS broadcast for dispatch events | C |

## Sub-Plan A: Backend Foundation (Wave 1)

**File location:** `sub-plans/A-foundation.md`
**Autonomous:** true
**Files modified:**
- `backend/app/models/station.py` (NEW)
- `backend/app/models/dispatch_record.py` (NEW)
- `backend/app/models/emergency.py` (AMEND)
- `backend/app/models/__init__.py` (AMEND)
- `backend/app/schemas/station.py` (NEW)
- `backend/app/schemas/dispatch.py` (NEW)
- `backend/app/schemas/emergency.py` (AMEND)
- `backend/app/services/station_service.py` (NEW)
- `backend/app/services/routing_service.py` (NEW)
- `backend/app/services/geospatial_service.py` (NEW)
- `backend/app/services/sms_service.py` (NEW)
- `backend/app/services/duplicate_service.py` (NEW)
- `backend/app/services/message_service.py` (NEW)
- `backend/app/core/config.py` (AMEND)
- `backend/requirements/base.txt` (AMEND)
- `backend/.env.example` (AMEND)
- `backend/data/districts.geojson` (EXISTS — use as-is)

## Sub-Plan B: Dispatch Pipeline + API (Wave 2)

**File location:** `sub-plans/B-pipeline.md`
**Autonomous:** true
**Depends on:** Sub-plan A
**Files modified:**
- `backend/app/services/dispatch_service.py` (NEW)
- `backend/app/api/v1/endpoints/dispatch.py` (NEW)
- `backend/app/api/v1/endpoints/location.py` (NEW)
- `backend/app/static/location.html` (NEW)
- `backend/app/main.py` (AMEND — register routers, serve static files)
- `backend/app/core/config.py` (AMEND — env vars)

## Sub-Plan C: Frontend Dispatch Panel (Wave 3)

**File location:** `sub-plans/C-frontend.md`
**Autonomous:** false (has checkpoint:human-verify for UI)
**Depends on:** Sub-plan B
**Files modified:**
- `frontend/src/pages/DispatchPage.tsx` (NEW)
- `frontend/src/components/dispatch/StationCard.tsx` (NEW)
- `frontend/src/components/dispatch/StationRanking.tsx` (NEW)
- `frontend/src/components/dispatch/RoutePreview.tsx` (NEW)
- `frontend/src/components/dispatch/EscalationTimer.tsx` (NEW)
- `frontend/src/hooks/useDispatch.ts` (NEW)
- `frontend/src/App.tsx` (AMEND — add route)
- `frontend/src/components/layout/Sidebar.tsx` (AMEND — add nav item)
- `frontend/src/lib/types.ts` (AMEND — add station/dispatch types)
- `frontend/src/hooks/EmergencyFeedContext.tsx` (AMEND — add dispatch WS events)

## Sub-Plan D: ACK + Bolna Integration (Wave 4)

**File location:** `sub-plans/D-ack.md`
**Autonomous:** true
**Depends on:** Sub-plan C
**Files modified:**
- `backend/app/services/message_service.py` (AMEND — add BolnaMessageService)
- `backend/app/api/v1/endpoints/dispatch.py` (AMEND — ACK webhook + escalation)
- `backend/app/services/dispatch_service.py` (AMEND — escalation timer logic)
- `backend/app/core/websocket.py` (AMEND — dispatch event types if needed)
- `bolna-agent/custom-functions/station-ack.json` (NEW)
- `bolna-agent/prompts/station-ack-prompt.md` (NEW)

---

## Verification (Phase Gate)

```bash
# 1. Backend imports
cd backend && python -c "
from app.models.station import Station
from app.models.dispatch_record import DispatchRecord
from app.schemas.station import StationOut
from app.schemas.dispatch import DispatchResponse
from app.services.station_service import rank_stations, get_stations_by_type
from app.services.routing_service import compute_route
from app.services.geospatial_service import is_inside_coverage, get_district_for_emergency
from app.services.sms_service import send_sms, build_location_sms
from app.services.duplicate_service import check_duplicate, merge_duplicate
from app.services.dispatch_service import run_dispatch_pipeline, execute_dispatch
from app.services.message_service import MessageService, SimulatedMessageService, BolnaMessageService
from app.api.v1.endpoints.dispatch import router as dispatch_router
from app.api.v1.endpoints.location import router as location_router
print('All Phase 6 backend imports OK')
"

# 2. Frontend TypeScript check
cd frontend && npx tsc -b --noEmit

# 3. Frontend build
cd frontend && npx vite build

# 4. Backend startup
cd backend && python -c "from app.main import app; print('Backend app loads OK')"

# 5. Station seed data
cd backend && python -c "
from app.core.database import SessionLocal
from app.models.station import Station
db = SessionLocal()
count = db.query(Station).count()
print(f'{count} stations seeded')
assert count == 17, f'Expected 17 stations, got {count}'
db.close()
"

# 6. District check test
cd backend && python -c "
from app.services.geospatial_service import is_inside_coverage
# Hubli center - should be inside
inside, name = is_inside_coverage(15.36, 75.12)
print(f'Hubble center inside={inside} district={name}')
# Far outside Hubli
outside, name_out = is_inside_coverage(12.97, 77.59)
print(f'Bangalore (outside) inside={outside}')
"
```

## Goal-Backward Verification

### must_haves

**truths:**
- [ ] Stations for Hubli/Dharwad are seeded in MySQL — 6 police, 5 fire, 6 medical stations with real names, addresses, lat/lng, and phone numbers (D-08, D-09, D-10, D-13)
- [ ] Emergency duplicates are detected and merged — same location + same emergency type + within 1-hour window appends new description and caller info to existing record (D-14, D-15, D-16)
- [ ] SMS sent automatically to caller on emergency creation with location capture link via Fast2SMS (D-19, D-20)
- [ ] Location capture page served at `/location/{emergency_id}` — standalone HTML using browser Geolocation API, posts coordinates back (D-17, D-18, D-21)
- [ ] District boundary check uses pre-existing `districts.geojson` + Shapely `contains()` — outside coverage sets requires_manual_review flag (D-24, D-25, D-26)
- [ ] Google Maps Routes API computes ETAs for origin→station pairs, with Haversine fallback (D-27, D-28)
- [ ] Top 5 stations ranked by ETA for each emergency, with distance, ETA, and route polyline (D-05)
- [ ] Route preview shown in dispatch panel before dispatcher confirms (D-04, D-29)
- [ ] Dispatch panel is a separate page in the dashboard, auto-triggered on emergency creation (D-02, D-06)
- [ ] Dispatcher confirming dispatch auto-updates emergency status to "dispatched" (D-03)
- [ ] `MessageService` interface with `SimulatedMessageService` for MVP — ACK simulated by dispatcher click (D-30, D-35)
- [ ] Escalation: 2-minute timeout on station ACK → next-ranked station; all 5 fail → `dispatch_failed` (D-32, D-33)
- [ ] Escalation sends fresh call with full incident details, no escalation context (D-34)

**actions:**
- [ ] All 35 decisions (D-01 through D-35) are implemented per their spec — no omissions
- [ ] Station ranking follows "assisted dispatch" pattern — system shows top 5, dispatcher confirms (D-01)
- [ ] Station type matched directly to emergency type (fire→fire, medical→medical, police→police) (D-10)
- [ ] All stations assumed always available — no availability tracking (D-11)
- [ ] No service radius limit — all matching-type stations ranked by distance/ETA (D-12)
- [ ] SMS location is primary fallback — Bolna agent location used if SMS not received (D-22, D-23)
- [ ] If dispatcher dismisses dispatch panel → auto-escalate after timeout (D-07)
- [ ] `dispatch_failed` flag set when all 5 stations fail to ACK (D-33)
- [ ] Routing service falls back to Haversine when Google Maps API key not configured (D-28)

---

## Threat Model

### Trust Boundaries

| Boundary | Description |
|----------|-------------|
| SMS link → location.html | Untrusted caller clicks link, browser geolocation sends coordinates |
| Fast2SMS API | External SMS provider, SMS content could be inspected by provider |
| Google Maps Routes API | Emergency location sent to Google for routing |
| Client → dispatch endpoints | Dispatcher confirms dispatch, station selection sent to backend |
| Bolna webhook → ACK endpoint | Station ACK webhook from Bolna, spoofable if no IP validation |

### STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation |
|-----------|----------|-----------|----------|-------------|------------|
| T-06-01 | Information Disclosure | Google Maps Routes API | medium | accept | Emergency lat/lng sent to Google for routing; no PII (names, phone) included in route requests |
| T-06-02 | Tampering | SMS location capture | low | mitigate | Validate `emergency_id` is valid integer, emergency exists, location data is valid lat/lng range |
| T-06-03 | Tampering | Dispatch escalation race condition | high | mitigate | Use atomic `UPDATE dispatch_record SET status='acknowledged' WHERE id=X AND status='pending_call'` — only one path succeeds |
| T-06-04 | Spoofing | Station ACK webhook | medium | mitigate | Validate webhook source IP (Bolna: `13.203.39.153`); log all incoming webhooks for audit |
| T-06-05 | Information Disclosure | API key in frontend bundle | high | mitigate | All Google Maps API calls proxied through backend — no API key in frontend code |
| T-06-06 | DoS | computeRoutes concurrent calls | low | accept | Rate-limited to ~5 calls per emergency (1 origin → 5 stations); 10K/month free tier |
| T-06-07 | Tampering | GeoJSON file integrity | low | mitigate | `districts.geojson` is read-only data file; validate geometry on load with Shapely |
| T-06-SC | Tampering | npm/pip installs | high | mitigate | shapely is well-known package (17yr, 20M+/week); install from PyPI only |
