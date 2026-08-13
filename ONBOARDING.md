# SAVIOR — Onboarding Guide

> Orientation for anyone new to the codebase. For step-by-step environment setup, see [SETUP.md](./SETUP.md).

## 1. What SAVIOR is

**SAVIOR** (*Situational Analysis & Virtual Intelligent Operational Router*) is a real-time emergency dispatch system. It takes a phone call from someone in an emergency, understands the incident with an AI agent, and gets the right station dispatched — all the way through a verbal acknowledgement.

The end-to-end flow:

```
Caller ──▶ Bolna Inbound Agent ──▶ FastAPI Backend ──▶ MySQL
              │                        │                    │
              │  live transcript       │  Twilio SMS (location link)
              ▼                        ▼                    │
        WebSocket stream          Browser Geolocation      │
              │                        │                    │
              ▼                        ▼                    │
         Dispatcher Dashboard (React) ◀─────────────────────┘
              │
              ▼
   Validation → Ranking → Auto-dispatch
   (district check, duplicate detection, OSMnx routing)
              │
              ▼
   Bolna Outbound Agent → Station Phone
              │
              ▼
   Station ACK / No-Answer ──▶ /api/dispatch/ack webhook
```

## 2. Repo layout

```
savior/
├── backend/          FastAPI + SQLAlchemy (MySQL) API  — the core system
│   ├── app/
│   │   ├── api/v1/endpoints/   HTTP routes (emergency, transcript, dispatch, location)
│   │   ├── services/           business logic (dispatch, geocoding, routing, sms, bolna, transcript, duplicate)
│   │   ├── models/             SQLAlchemy models (Emergency, TranscriptChunk, Station, DispatchRecord)
│   │   ├── schemas/            Pydantic request/response models
│   │   ├── core/               config, database, websocket
│   │   └── main.py             FastAPI app + startup table/column migrations + background sweeps
│   ├── data/                   districts.geojson (coverage), hubli-dharwad.graphml (road graph)
│   ├── tests/                  pytest suites
│   └── .env.example            env template (copy to .env)
├── frontend/         Vite + React 19 + TS + Tailwind 4 dispatcher dashboard
│   └── src/
│       ├── pages/              Feed, Map, Stats, Transcriptions, Dispatch
│       ├── hooks/              WebSocket feed, emergency context
│       └── lib/                types, API client
├── bolna-agent/      Bolna AI agent config (prompts + custom function JSON)
└── *.md              Docs: SETUP.md (this), ONBOARDING.md, AGENTS.md (project memory)
```

## 3. The two Bolna agents

| Agent | Direction | Job |
|---|---|---|
| **Inbound** (victim call) | Caller → backend | Listens to the caller, classifies the emergency, calls `post_api_emergency` early to create a record, streams live transcript chunks, and stores the final transcript on hang-up. |
| **Outbound** (station dispatch) | Backend → station | Backend places a call; the agent reads the incident from `user_data`, contacts the station, and reports the station's verbal response via `station_ack_response` → `POST /api/dispatch/ack`. |

Key files: `bolna-agent/prompts/system-prompt.md`, `bolna-agent/prompts/station-ack-prompt.md`, `bolna-agent/custom-functions/*.json`.

## 4. The dispatch pipeline (core mental model)

Every emergency goes through this lifecycle (`backend/app/services/dispatch_service.py`):

1. **Create** — `/api/emergency` (from the inbound agent) or auto-create from a transcript webhook.
2. **Geocode** — Photon geocodes the text location (`geocoding_service.py`), biased to the Dharwad anchor `(15.3647, 75.1239)`.
   - Results **> 200 km** from the anchor are rejected as unreliable → the record waits for **real GPS** (the browser location link) instead.
3. **Location SMS** — a Twilio SMS is sent to the caller with a link to `/api/location/{id}` for real browser GPS.
   - **Real GPS is authoritative**: it overwrites the text-geocode and re-runs coverage.
4. **Validate** — district coverage check (Shapely + `districts.geojson`) and duplicate check (same location+type within 1 h).
   - Out-of-coverage → `pending_manual_review`. Duplicate → `duplicate_found` (merged).
5. **Rank** — stations of matching type ranked by road-network ETA (OSMnx) with Haversine fallback.
6. **Dispatch** — outbound Bolna call to the top station. Call placed → `pending_call`, a **600 s escalation timer** starts.
   - Inbound-call gate: while the victim is still on the line, dispatch defers to `awaiting_call_complete` (fail-open after `INBOUND_CALL_MAX_WAIT_SECONDS`, default 180 s).
7. **Acknowledge** — station verbal ACK comes back via `/api/dispatch/ack` (auth: `Authorization: Bearer <BOLNA_WEBHOOK_SECRET>`).
   - `acknowledged` → `dispatched`. `rejected` / no-answer / timeout → **escalate** to the next ranked station.

State is tracked in `emergencies.pipeline_status`: `validating`, `validated`, `ranked`, `awaiting_call_complete`, `awaiting_location`, `pending_manual_review`, `duplicate_found`, `pending_ack`, `escalated`, `dispatch_failed`, `dispatched`.

## 5. Three important design behaviors (know these before changing anything)

1. **Transcript-complete idempotency** (`transcript.py`). The inbound agent's `call_id` (stored as `bolna_call_id`) is an LLM-generated UUID, **not** the real Bolna call ID, so `bolna_call_id` never matches the webhook's `body.id`. Bolna can also fire two terminal webhooks (`call-disconnected`, then `completed`) for one call. The backend therefore dedups by **identical transcript content** and has an early idempotency guard — never create a second emergency for a re-fired webhook.

2. **Geocoding vs real GPS** (`geocoding_service.py`). Text geocoding is only a hint. Never let a far-away text result set coords (it would skip the real-GPS SMS and wrongly flag `outside_coverage`). Real browser GPS always wins.

3. **ACK webhook auth** (`dispatch.py`, `BOLNA_WEBHOOK_SECRET`). Only the outbound agent's `station_ack_response` can change dispatch state, and only if it sends `Authorization: Bearer <secret>` matching `backend/.env`. This stops strangers with the public ngrok URL from forging ACKs.

## 6. Real-time event model

The frontend subscribes to `WebSocket /ws`. Backend broadcasts events: `new_emergency`, `status_update`, `location_received`, `dispatch_update`, `dispatch_escalated`, `dispatch_failed`, `transcript_chunk`, `transcript_complete`, `transcript_resolved`, `live_transcript`, `emergency_deleted`. Send `{"type":"ping"}` as keepalive.

## 7. Frontend pages

| Page | Route | Purpose |
|---|---|---|
| Feed | `/` | Live emergency cards with filters + detail panel |
| Map | `/map` | Leaflet map with severity markers |
| Stats | `/stats` | Analytics (Today/Week/Month/Year/5Y) |
| Transcriptions | `/transcriptions` | Live + historical call transcripts |
| Dispatch | `/dispatch?emergency_id=` | Station ranking, route preview, dispatch + escalation timer |

## 8. Running the project

Both commands in one breath (full detail in [SETUP.md](./SETUP.md)):

```bash
# Backend (from repo root, using the project venv 'thor')
thor\Scripts\pip install -r backend\requirements\dev.txt
thor\Scripts\python -m app.seed_stations
thor\Scripts\uvicorn app.main:app --reload   # workdir: backend

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Backend API: http://localhost:8000/docs · Dashboard: http://localhost:5173

## 9. Testing & quality

- **Backend tests:** `cd backend && python -m pytest tests -q`
  - Known issue: `tests/test_live_e2e.py` errors at setup — it defines a helper named `test(...)` that pytest misreads. It's a live/ngrok test; the error is expected and unrelated to normal runs.
- **Frontend typecheck:** `cd frontend && npx tsc -b --noEmit`
  - Pre-existing errors live in `StatsGrid.tsx` and `DispatchPage.tsx` — don't "fix" them casually.

## 10. Where to look first (suggested order)

1. `SETUP.md` — get a running system.
2. `README.md` — full API reference + usage examples.
3. `AGENTS.md` — project memory / hard-won decisions.
4. `backend/app/services/dispatch_service.py` — the dispatch pipeline.
5. `backend/app/api/v1/endpoints/transcript.py` — the inbound-call → record lifecycle.
6. `backend/app/services/message_service.py` — Bolna/Twilio outbound integration.
