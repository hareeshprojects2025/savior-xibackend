---
phase: 06-dispatch-engine
plan: D
type: execute
wave: 4
depends_on:
  - C
files_modified:
  - backend/app/services/message_service.py
  - backend/app/services/dispatch_service.py
  - backend/app/api/v1/endpoints/dispatch.py
  - backend/app/core/websocket.py
  - backend/app/core/config.py
  - backend/.env.example
  - backend/app/main.py
  - bolna-agent/custom-functions/station-ack.json
  - bolna-agent/prompts/station-ack-prompt.md
autonomous: true
requirements:
  - D-30
  - D-31
  - D-32
  - D-33
  - D-34
  - D-35
user_setup: []
must_haves:
  truths:
    - BolnaMessageService can trigger outbound calls via Bolna POST /call API (D-30)
    - Backend marks dispatch as pending_call, ready for Bolna to poll (D-31)
    - 2-minute timeout on station ACK triggers escalation to next station (D-32)
    - All 5 stations fail → emergency flagged as dispatch_failed (D-33)
    - Escalation sends fresh call with full incident details (no escalation context) (D-34)
    - SimulatedMessageService provides working MVP without Bolna (D-35)
    - WebSocket dispatch events broadcast all status changes (D-03 broadcast pattern)
  artifacts:
    - backend/app/services/message_service.py (enhanced)
    - backend/app/services/dispatch_service.py (escalation enhanced)
    - backend/app/api/v1/endpoints/dispatch.py (ACK webhook enhanced)
    - bolna-agent/custom-functions/station-ack.json
    - bolna-agent/prompts/station-ack-prompt.md
  key_links:
    - MessageService.send_dispatch called from dispatch_service.execute_dispatch
    - ACK webhook endpoint called by Bolna after outbound call
    - 2-minute timer runs server-side in dispatch_service.escalate_dispatch
    - WebSocket broadcasts all dispatch status transitions
---

# Sub-Plan D: ACK + Bolna Integration (Wave 4)

<objective>
**Purpose:** Complete the dispatch ACK tracking system by enhancing the MessageService with real Bolna integration (while keeping simulation for MVP), implementing the escalation timer and dispatch_failed logic, and creating the Bolna outbound agent configuration files.

**Output:** Working dispatch ACK system with simulated ACK for demo, real Bolna integration ready, and comprehensive escalation logic.
</objective>

<context>
@.planning/phases/06-emergency-call-dispatch-engine-incident-validation-routing-s/06-CONTEXT.md
@.planning/phases/06-emergency-call-dispatch-engine-incident-validation-routing-s/06-RESEARCH.md
@backend/app/services/message_service.py
@backend/app/services/dispatch_service.py
@backend/app/api/v1/endpoints/dispatch.py
@backend/app/core/websocket.py
@bolna-agent/custom-functions/
@bolna-agent/prompts/
</context>

<tasks>

<task>
<name>Task 1: Enhance MessageService with Real Bolna Integration</name>
<files>
  backend/app/services/message_service.py (amend)
  backend/app/core/config.py (amend — add webhook base URL)
  backend/.env.example (amend)
  bolna-agent/custom-functions/station-ack.json (NEW)
  bolna-agent/prompts/station-ack-prompt.md (NEW)
</files>
<type>backend</type>

<read_first>
- `@backend/app/services/message_service.py` — Existing interface + SimulatedMessageService
- `@backend/app/services/geocoding_service.py` — httpx.AsyncClient pattern for Bolna API calls
- `@backend/app/core/config.py` — Env var pattern
- `@bolna-agent/custom-functions/` — Existing Bolna config structure (e.g., send-transcript-chunk.json for the inbound agent)
- `@bolna-agent/prompts/` — Existing prompt patterns
- `06-RESEARCH.md` — Lines 332-440 (Bolna dual-agent architecture, outbound calls, ACK flow, MessageService code)
</read_first>

<action>
Enhance the MessageService and create Bolna agent configuration:

**MessageService amendments** (`backend/app/services/message_service.py`):
- Enhance `BolnaMessageService.__init__` to read from env (with fallbacks):
  - `api_token` from `BOLNA_API_TOKEN` env var
  - `agent_id` from `BOLNA_AGENT_ID` env var
  - `webhook_base` from `BASE_URL` env var + `/api/dispatch/ack`
- Implement `BolnaMessageService.send_dispatch(station_phone, incident)`:
  - POST to `https://api.bolna.ai/call` with headers: `Authorization: Bearer {token}`, `Content-Type: application/json`
  - Body: `{"agent_id": self.agent_id, "recipient_phone_number": station_phone, "bypass_call_guardrails": true, "user_data": {"emergency_id": incident["emergency_id"], "incident_type": incident["emergency_type"], "location": incident.get("location", ""), "description": incident.get("description", "")}}`
  - If `api_token` or `agent_id` not set → log warning, fall back to simulated behavior (returns simulated call_id)
  - Follow RESEARCH.md lines 354-370 for the POST /call payload structure
  - Log all outbound call attempts for audit
- Enhance `BolnaMessageService.get_ack_status(call_id)`:
  - If call_id starts with "sim_" → return "acknowledged" (simulated fallback)
  - If real call_id → return stored ack_status from webhook (look up in an in-memory dict)
  - Use `_ack_results: dict[str, str]` class-level cache (keyed by call_id, set by webhook handler)
- Add `process_webhook(call_id, ack_status)` method:
  - Store ack_status in `_ack_results[call_id]`
  - Return True if stored successfully
- Maintain backward compatibility: `SimulatedMessageService` stays unchanged
- Per D-30 (new outbound Bolna agent), D-35 (MessageService interface ready)

**Config amendments** (`backend/app/core/config.py`):
- Ensure `BOLNA_WEBHOOK_BASE` is read from `BASE_URL` env var

**`.env.example` amendments:**
- Ensure BOLNA_AGENT_ID and BOLNA_API_TOKEN are documented with example values

**Bolna outbound agent — custom function** (`bolna-agent/custom-functions/station-ack.json`):
- Create a custom function configuration for the outbound station ACK agent
- Follow the structure of existing `bolna-agent/custom-functions/` files
- Function name: `station_ack_response`
- Description: "Record station personnel's acknowledgment of a dispatch notification"
- Parameters:
  - `emergency_id` (string) — Emergency ID
  - `station_name` (string) — Name of the station being called
  - `ack_status` (string) — "acknowledged", "rejected", or "needs_clarification"
  - `notes` (string, optional) — Any additional notes from the station
- Server endpoint: `POST /api/dispatch/ack` (webhook that Bolna calls after the station responds)
- Per D-30, D-31: new outbound Bolna agent for station calling

**Bolna outbound agent — system prompt** (`bolna-agent/prompts/station-ack-prompt.md`):
- Create a system prompt for the outbound station agent
- Contrast with inbound agent: this agent DELIVERS info and collects ACK, not collects info
- Key instructions:
  - Introduce yourself as "SAVIOR Emergency Dispatch System"
  - State the incident type, location, and description clearly
  - Ask for verbal acknowledgment: "Do you acknowledge this dispatch?"
  - If yes → call `station_ack_response` with "acknowledged"
  - If no → call `station_ack_response` with "rejected" and ask for reason
  - Do NOT collect detailed incident info — just deliver and confirm
  - Be clear, concise, professional — this is an emergency dispatch
  - Korean/English bilingual if needed (for Hubli/Dharwad region)
  - Per D-30 (dual-agent architecture: inbound for victims, outbound for stations)
</action>

<verify>
<automated>
cd backend && python -c "
from app.services.message_service import BolnaMessageService, SimulatedMessageService
from app.core.config import BOLNA_API_TOKEN, BOLNA_AGENT_ID

# Test SimulatedMessageService (always works)
sim = SimulatedMessageService()
import asyncio
cid = asyncio.run(sim.send_dispatch('1234567890', {'emergency_id': 42, 'emergency_type': 'Fire'}))
assert cid and cid.startswith('sim_call_42')
print(f'Simulated: call_id={cid}')

# Test BolnaMessageService with env fallback (will use simulated fallback if no API key)
bolna = BolnaMessageService()
cid2 = asyncio.run(bolna.send_dispatch('1234567890', {'emergency_id': 42, 'emergency_type': 'Fire', 'location': 'Hubli', 'description': 'Test'}))
print(f'Bolna service: call_id={cid2}')

# Test webhook processing
bolna.process_webhook('test_call_1', 'acknowledged')
ack = asyncio.run(bolna.get_ack_status('test_call_1'))
assert ack == 'acknowledged'
print(f'Bolna webhook ACK: {ack}')
"
</automated>
</verify>

<done>
- BolnaMessageService sends POST /call via httpx
- Fallback to simulated behavior when API key not set
- process_webhook stores ACK results for polling
- station-ack.json custom function created
- station-ack-prompt.md system prompt created
- Config reads all required env vars
</done>
</task>

<task>
<name>Task 2: Escalation Timer + dispatch_failed Logic + WS Broadcast</name>
<files>
  backend/app/services/dispatch_service.py (amend)
  backend/app/api/v1/endpoints/dispatch.py (amend)
  backend/app/core/websocket.py (amend)
  backend/app/main.py (amend)
</files>
<type>backend</type>

<read_first>
- `@backend/app/services/dispatch_service.py` — escalate_dispatch function, execute_dispatch
- `@backend/app/api/v1/endpoints/dispatch.py` — ACK webhook endpoint, dispatch endpoints
- `@backend/app/core/websocket.py` — ConnectionManager broadcast pattern
- `06-RESEARCH.md` — Lines 376-394 (ACK flow webhook vs polling), lines 952-963 (race condition Pitfall 5)
</read_first>

<action>
Enhance the dispatch system with escalation timer, race condition protection, and comprehensive WebSocket broadcasting:

**Dispatch service amendments** (`backend/app/services/dispatch_service.py`):

1. **Escalation timer** — Add `start_escalation_timer(dispatch_record_id: int, db_factory)`:
   - Use `asyncio.create_task` to run a background timer
   - Sleep 120 seconds (2 minutes per D-32)
   - After sleep: get a fresh DB session via `db_factory`, call `escalate_dispatch(db, dispatch_record_id)`
   - **Race condition guard:** In `escalate_dispatch()`, use atomic update:
     ```sql
     UPDATE dispatch_record SET status='escalated' WHERE id=X AND status='pending_call'
     ```
     If no rows affected → another process already handled it (webhook arrived). Return early.
     Per RESEARCH.md Pitfall 5 and D-32.
   - Log: "Escalation timer fired for dispatch {id}, emergency {emergency_id}"

2. **dispatch_failed handling** — In `escalate_dispatch()`:
   - After exhausting all 5 stations (check by counting dispatch_records for this emergency):
     - Set emergency `status = "pending"` (reset for manual dispatch)
     - Set emergency `pipeline_status = "dispatch_failed"`
     - Broadcast `{"type": "dispatch_failed", "emergency_id": id}`
     - Log: "All 5 stations failed for emergency {id} — dispatch_failed"
     - Per D-33 (all 5 fail → dispatch_failed)

3. **Escalation start** — In `execute_dispatch()`:
   - After creating dispatch record with `status="pending_call"`:
     - Call `start_escalation_timer(dispatch_record.id, get_db)` to begin the 2-minute countdown
     - Store the timer task reference for potential cancellation

4. **ACK received — cancel timer** — Add `cancel_escalation(dispatch_record_id: int)`:
   - If a timer task exists for this dispatch_record_id, cancel it (prevent double-dispatch)
   - Per Pitfall 5 mitigation

5. **Fresh call per escalation** — In `escalate_dispatch()`:
   - When creating new DispatchRecord for next station:
     - Call `send_dispatch()` with fresh incident details (D-34: no escalation context)
     - The `incident` dict passed to `send_dispatch()` contains only the original emergency data, no mention of previous failed stations

**WebSocket broadcast enhancements** — In `dispatch_service.py`:
- After each dispatch transition, broadcast appropriate events:
  - Dispatch created: `{"type": "dispatch_update", "emergency_id": id, "dispatch_status": "pending_call", "station_id": station_id}`
  - Acknowledged: `{"type": "dispatch_update", "emergency_id": id, "dispatch_status": "acknowledged", "station_id": station_id}`
  - Escalated: `{"type": "dispatch_escalated", "emergency_id": id, "previous_station_id": old_id, "next_station_id": new_id}`
  - Failed: `{"type": "dispatch_failed", "emergency_id": id}`
- Per D-03 (auto-update emergency status to "dispatched")

**Webhook endpoint enhancement** (`backend/app/api/v1/endpoints/dispatch.py`):
- In the `POST /dispatch/ack` webhook handler:
  - After successfully updating DispatchRecord to "acknowledged":
    - Call `cancel_escalation(dispatch_record_id)` to stop the timer
    - Update emergency status to "dispatched" (D-03)
    - Broadcast `dispatch_update` via WebSocket (D-03)
    - Store ACK result in BolnaMessageService._ack_results for get_ack_status polling
  - If webhook reports "rejected" or "no_answer":
    - Call `escalate_dispatch(db, dispatch_record_id)` to move to next station
    - Broadcast escalation event
  - Per D-32 (2-minute timeout for ACK), D-34 (fresh call each time)

**WebSocket connection manager** (`backend/app/core/websocket.py`):
- No structural changes needed — `manager.broadcast()` already handles arbitrary dict messages
- Ensure `dispatch_update`, `dispatch_escalated`, `dispatch_failed` event types are documented in comments
</action>

<verify>
<automated>
cd backend && python -c "
# Test imports after all amendments
from app.services.dispatch_service import (
    execute_dispatch,
    escalate_dispatch,
    start_escalation_timer,
    cancel_escalation
)
from app.api.v1.endpoints.dispatch import router as dispatch_router

# Verify ACK webhook route registered
routes = [r.path for r in dispatch_router.routes]
has_ack = any('ack' in r for r in routes)
print(f'Webhook routes: {[r for r in routes if \"ack\" in r]}')

print('Dispatch ACK + escalation imports OK')
"
</automated>
</verify>

<done>
- Escalation timer runs as background asyncio task with 2-minute delay
- Race condition guard prevents double-dispatch (atomic UPDATE)
- dispatch_failed set when all 5 stations exhausted
- Fresh call per escalation (no escalation context)
- WebSocket broadcasts all dispatch transitions
- ACK webhook cancels timer on acknowledgment
- All imports clean
</done>
</task>

</tasks>

<verification>
```bash
# Backend full import check
cd backend && python -c "
from app.models.station import Station
from app.models.dispatch_record import DispatchRecord
from app.schemas.dispatch import DispatchRequest, DispatchResponse, DispatchRecordOut, DispatchStatus
from app.services.station_service import rank_stations, get_stations_by_type, seed_stations
from app.services.routing_service import compute_route
from app.services.geospatial_service import is_inside_coverage
from app.services.sms_service import send_sms
from app.services.duplicate_service import check_duplicate, merge_duplicate
from app.services.dispatch_service import run_validation_pipeline, run_ranking_pipeline, execute_dispatch, escalate_dispatch, cancel_escalation
from app.services.message_service import MessageService, SimulatedMessageService, BolnaMessageService
from app.api.v1.endpoints.dispatch import router as dispatch_router
from app.api.v1.endpoints.location import router as location_router
from app.main import app
print('ALL PHASE 6 BACKEND IMPORTS OK')
print(f'Route count: {len(app.routes)}')
"

# TypeScript compilation
cd frontend && npx tsc -b --noEmit

# Frontend build
cd frontend && npx vite build

# Station seed verification
cd backend && python -c "
from app.core.database import SessionLocal
from app.services.station_service import seed_stations
db = SessionLocal()
n = seed_stations(db)
print(f'Seeded/verified {n} stations')
db.close()
"

# District boundary test
cd backend && python -c "
from app.services.geospatial_service import is_inside_coverage
# Hubli Town PS (inside)
assert is_inside_coverage(15.3452, 75.1431)[0]
# Bangalore (outside)
assert not is_inside_coverage(12.97, 77.59)[0]
print('District check: inside Hubli OK, outside Bangalore OK')
"
```
</verification>
