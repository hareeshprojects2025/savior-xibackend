# Phase 6: Dispatch Engine - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Automated emergency call processing pipeline — incident validation (district check, duplicate detection, location capture), station ranking and routing, dispatch execution with ACK tracking via Bolna agent.

</domain>

<decisions>
## Implementation Decisions

### Dispatch Mode
- **D-01:** Assisted dispatch — system ranks stations and shows recommendations, dispatcher confirms before dispatch.
- **D-02:** New dispatch panel in dashboard (separate page/section, not within existing EmergencyDetail).
- **D-03:** Dispatching auto-updates emergency status to "dispatched".
- **D-04:** Route preview shown before dispatcher confirms (Google Maps route + ETA).
- **D-05:** Top 5 stations shown in ranking, with full details (name, distance, ETA, route map preview).
- **D-06:** Dispatch panel auto-triggers on emergency creation.
- **D-07:** If dispatcher dismisses/ignores recommendation → auto-escalate to next station after timeout.

### Station Model
- **D-08:** Stations stored in MySQL database (SQLAlchemy model, existing pattern).
- **D-09:** Station fields: name, type (police/fire/medical), lat/lng coordinates, address.
- **D-10:** Emergency type matches station type directly (no mapping table — fire emergencies map to fire stations).
- **D-11:** Assume all stations always available (no availability tracking for v1).
- **D-12:** No service radius limit — all matching-type stations are ranked by distance/ETA.
- **D-13:** Seed station data to be defined during planning (Hubli/Dharwad area).

### Duplicate Detection
- **D-14:** Duplicate criteria: same location + same emergency type + within 1-hour time window.
- **D-15:** Merge on duplicate: update existing record, append new description + caller info.
- **D-16:** Runs automatically on every new emergency creation.

### Location Capture & Confidence
- **D-17:** Primary location capture via SMS link with browser Geolocation API.
- **D-18:** Standalone public HTML page served by backend for location capture (no React bundle).
- **D-19:** SMS sent via Fast2SMS (India-focused, free test credits, pay from ₹100).
- **D-20:** SMS sent automatically on emergency creation to caller's phone.
- **D-21:** Auto-continue pipeline (district check → duplicate detection → ranking) after location received.
- **D-22:** Fallback: use location extracted by Bolna agent if SMS location not received.
- **D-23:** Nominatim-based confidence scoring skipped — SMS location is primary mechanism.

### District Boundary Check
- **D-24:** Predefined district boundary data stored as GeoJSON file (`backend/data/districts.geojson`).
- **D-25:** Shapely library for point-in-polygon spatial checks.
- **D-26:** Outside coverage area → manual dispatcher review.

### Routing (Google Maps)
- **D-27:** Google Maps Routes API (Essentials tier) for route generation and ETAs.
- **D-28:** Free tier covers MVP (10K requests/month). Can migrate to OSRM if volume grows.
- **D-29:** Route preview shown in dispatch panel before dispatcher confirms.

### Dispatch ACK (via Bolna)
- **D-30:** New outbound Bolna agent for calling stations and collecting verbal ACK.
- **D-31:** Backend marks dispatch as `pending_call`, Bolna agent polls and places outbound call.
- **D-32:** 2-minute timeout for station ACK — escalate to next-ranked station if no response.
- **D-33:** If all 5 stations fail to ACK → flag emergency as "dispatch_failed" for manual dispatcher handling.
- **D-34:** Escalation sends fresh call with full incident details (no escalation context included).
- **D-35:** Architecture: `MessageService` interface — simulated ACK (dispatcher click) for MVP, real Bolna integration ready.

### the agent's Discretion
- Station ranking algorithm exact weightings (distance vs ETA).
- Dispatch panel UI layout and component structure.
- GeoJSON district boundary file location and exact polygon data.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pipeline Design
- `emergency_call_flow.md` — Original dispatch pipeline design (validation, routing, dispatch, ACK flow)

### Requirements & Roadmap
- `.planning/ROADMAP.md` — Phase structure, dependencies, milestones
- `.planning/PROJECT.md` — Project overview, constraints, key decisions
- `.planning/REQUIREMENTS.md` — User stories (US-03: status lifecycle), functional requirements, constraints

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` — System architecture, existing backend/frontend layers, data flows
- `.planning/codebase/STACK.md` — Technology stack (FastAPI, SQLAlchemy, MySQL, React, Leaflet)
- `.planning/codebase/INTEGRATIONS.md` — External integrations (Bolna webhooks, Nominatim geocoding)

### State
- `.planning/STATE.md` — Current project state, pending items, known limitations

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/core/websocket.py` — ConnectionManager broadcast pattern (reuse for dispatch events)
- `backend/app/services/geocoding_service.py` — Nominatim HTTP client (reference for Fast2SMS integration pattern)
- `backend/app/services/emergency_service.py` — Emergency CRUD pattern (follow for dispatch service)
- `backend/app/models/emergency.py` — Emergency model (needs location fields, dispatch status fields)
- `backend/app/schemas/emergency.py` — Pydantic schemas (follow pattern for new dispatch schemas)
- `backend/app/api/v1/endpoints/emergency.py` — Endpoint pattern (follow for dispatch endpoints)

### Established Patterns
- FastAPI 3-layer architecture: endpoints → services → models
- WebSocket broadcast for real-time updates (new_emergency, status_update)
- SQLAlchemy ORM with MySQL, auto-create tables
- Service classes with CRUD methods and DB session dependency

### Integration Points
- `backend/app/models/emergency.py` — Add location_confidence, dispatch_status fields
- `backend/app/services/emergency_service.py` — Hook duplicate detection + dispatch pipeline
- `backend/app/api/v1/endpoints/transcript.py` — Reference for Bolna webhook pattern (station ACK webhook)
- `frontend/src/pages/` — Add new DispatchPage
- `frontend/src/hooks/EmergencyFeedContext.tsx` — Add dispatch-related state
- `frontend/src/components/` — New dispatch/ directory for dispatch panel components

</code_context>

<specifics>
## Specific Ideas

- Dual Bolna agent architecture: inbound for victims (existing), outbound for stations (new)
- Demo can show: Bolna agent calling station → station verbally ACKs → dashboard updates in real-time
- Fast2SMS integration for location capture SMS to caller's phone
- Standalone HTML page: caller clicks link → grants geolocation → coordinates POSTed to backend → pipeline auto-continues

</specifics>

<deferred>
## Deferred Ideas

- Location SMS via Twilio/other providers — Fast2SMS chosen for India focus, but architecture should support swapping
- OSRM self-hosted routing — document as migration path if Google Maps API costs grow
- Station availability tracking — deferred from v1, add when needed
- Service radius per station — defer until real operational requirements emerge

</deferred>

---

*Phase: 6-Dispatch Engine*
*Context gathered: 2026-07-14*
