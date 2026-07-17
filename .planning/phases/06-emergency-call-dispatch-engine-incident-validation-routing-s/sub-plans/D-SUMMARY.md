---
phase: 06-dispatch-engine
plan: D
wave: 4
status: complete
completed: "2026-07-17"
commits:
  - message: "feat(06-D): add Bolna outbound station ACK custom function and system prompt"
    files:
      - bolna-agent/custom-functions/station-ack.json
      - bolna-agent/prompts/station-ack-prompt.md
verification:
  - ALL PHASE 6 BACKEND IMPORTS OK (30 routes)
  - SimulatedMessageService + BolnaMessageService fallback working
  - ACK webhook route `/dispatch/ack` registered
  - Station seed: 37 stations verified
  - District check: Hubli inside, Bangalore outside
---

# Sub-Plan D: ACK + Bolna Integration (Wave 4) — Summary

## What was built

### Task 1: Bolna Outbound Agent Configuration
- **`bolna-agent/custom-functions/station-ack.json`** — Custom function for the outbound station ACK agent. Registers `station_ack_response` function with `emergency_id`, `station_name`, `ack_status`, and `notes` parameters. Posts to `POST /api/dispatch/ack` webhook endpoint.
- **`bolna-agent/prompts/station-ack-prompt.md`** — System prompt for the outbound Bolna agent. Instructs the agent to deliver dispatch details clearly, ask for verbal acknowledgment, and call `station_ack_response` with the result. Bilingual (Kannada/English) ready for Hubli/Dharwad region.

### Task 2: Escalation Timer + dispatch_failed + WS Broadcast (Already Implemented in Prior Waves)
- `backend/app/services/message_service.py` — `BolnaMessageService` with env-based auth, `POST /call` to Bolna API, simulated fallback when API keys not set, `process_webhook` for ACK storage
- `backend/app/services/dispatch_service.py` — `_start_escalation_timer` (120s), `cancel_escalation`, `escalate_dispatch` with race condition guard (atomic UPDATE)
- `backend/app/api/v1/endpoints/dispatch.py` — `POST /dispatch/ack` webhook handling acknowledge/rejected/no_answer, cancel escalation on ACK, fresh call per D-34
- WebSocket broadcasts for all dispatch transitions: `dispatch_update`, `dispatch_escalated`, `dispatch_failed`

## Verification Results
- All Phase 6 backend imports: OK (30 routes)
- MessageService verification: Simulated + Bolna + webhook processing PASSED
- ACK webhook route `/dispatch/ack`: registered
- Station seed: 37 stations verified
- District check: Hubli inside, Bangalore outside — PASSED

## Decisions Honored
- D-30: Outbound Bolna agent config created (station-ack.json + prompt)
- D-31: Backend marks dispatch as `pending_call` (in execute_dispatch)
- D-32: 2-minute escalation timeout (in _start_escalation_timer)
- D-33: dispatch_failed when all 5 stations exhausted (in escalate_dispatch)
- D-34: Fresh call per escalation (no escalation context passed)
- D-35: MessageService interface with Simulated + Bolna implementations
- D-03: WebSocket broadcasts on all dispatch status transitions

## Remaining
- None — Sub-plan D completes Phase 6.

