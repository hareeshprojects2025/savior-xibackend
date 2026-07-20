# SAVIOR Backend

Emergency reporting and dispatch API built with **FastAPI + MySQL**. Two Bolna AI agents feed into it — an inbound agent for victim calls and an outbound agent for station dispatch. Real-time updates via WebSocket.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | FastAPI |
| ORM | SQLAlchemy |
| Database | MySQL 8+ |
| Validation | Pydantic |
| Server | Uvicorn |
| Geocoding | Nominatim (OpenStreetMap) |
| Routing | OSRM (HERE Maps fallback) |

## Quick Start

```bash
cd backend
copy .env.example .env
```

Edit `.env` with your MySQL password:
```
DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/savior_db
```

Install dependencies:
```bash
..\thor\Scripts\pip install -r requirements\dev.txt
```

Run the server:
```bash
..\thor\Scripts\uvicorn app.main:app --reload
```

Swagger docs at `http://127.0.0.1:8000/docs`.

## API Endpoints

### Emergency CRUD
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/emergency` | Create emergency (Bolna custom function webhook) — async, auto-geocodes |
| GET | `/api/emergencies` | List all emergencies |
| GET | `/api/emergencies/{id}` | Get single emergency (includes `full_transcript`) |
| PATCH | `/api/emergencies/{id}/status` | Update status + broadcast via WebSocket |
| DELETE | `/api/emergencies/{id}` | Delete + broadcast via WebSocket |

### Filters & Queries
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/emergencies/recent?limit=&offset=` | Paginated recent emergencies |
| GET | `/api/emergencies/type/{type}` | Filter by emergency type |
| GET | `/api/emergencies/severity/{severity}` | Filter by severity |
| GET | `/api/emergencies/location/{location}` | Search by location text |
| GET | `/api/emergencies/date/{date}` | Filter by date |
| GET | `/api/emergencies/mass-casualty?min_victims=` | Incidents with N+ victims |
| GET | `/api/emergencies/caller/{phone}` | Filter by caller phone |

### Dispatch
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/emergencies/{id}/stations` | Ranked stations (OSRM routing + distance/ETA) |
| POST | `/api/emergencies/{id}/dispatch` | Execute dispatch — creates DispatchRecord, calls Bolna outbound agent, starts 600s escalation timer |
| GET | `/api/emergencies/{id}/dispatch/status` | Current dispatch record |
| POST | `/api/dispatch/ack` | Bolna webhook — station ACK/reject/no-answer → updates pipeline |

### Stats
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/emergencies/stats?days=N` | Aggregate stats — by_severity, by_status, by_type, by_hour (IST +5:30) |
| POST | `/api/emergencies/geocode` | Backfill missing lat/lng via Nominatim |

### Transcript
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/transcript/chunk` | Receive live transcript chunk — broadcasts `live_transcript` via WS, buffers if `call_id` present |
| POST | `/api/transcript/complete` | Final transcript webhook (Bolna) — 4-level matching strategy: (1) bolna_call_id, (2) exact phone, (3) 10-digit suffix, (4) no-transcript emergency fallback |
| GET | `/api/transcript/{id}/chunks` | List transcript chunks for an emergency |
| GET | `/api/transcript/live-sessions` | Get active live transcription sessions (used by frontend for catch-up on WS reconnect) |

### WebSocket
| Endpoint | Description |
|----------|-------------|
| WS `/ws` | Real-time events — `new_emergency`, `status_update`, `dispatch_update`, `transcript_chunk`, `transcript_complete`, `transcript_resolved`, `live_transcript`, `emergency_deleted`. Handles client `{"type":"ping"}` → responds `{"type":"pong"}`. |

## Project Structure

```
backend/
├── app/
│   ├── api/v1/endpoints/     ← Route handlers
│   │   ├── emergency.py      ← CRUD + filters + stats
│   │   ├── dispatch.py       ← Station rankings, dispatch, ACK webhook
│   │   └── transcript.py     ← Chunks + complete webhook
│   ├── core/                 ← Config, database session, WebSocket manager
│   ├── models/               ← Emergency, TranscriptChunk, Station, DispatchRecord
│   ├── schemas/              ← Pydantic schemas (inc. AckWebhookBody)
│   ├── services/             ← Business logic
│   │   ├── dispatch_service.py    ← Ranking pipeline, execute dispatch, escalation timer
│   │   ├── message_service.py     ← Bolna outbound call client (BolnaMessageService)
│   │   ├── emergency_service.py   ← Emergency CRUD helpers
│   │   ├── station_service.py     ← Station data + ranking
│   │   ├── routing_service.py     ← OSRM + HERE Maps routing
│   │   ├── geocoding_service.py   ← Nominatim geocoding
│   │   ├── duplicate_service.py   ← Duplicate detection
│   │   ├── sms_service.py         ← Fast2SMS integration
│   │   └── geospatial_service.py  ← District boundary checks
│   └── main.py               ← FastAPI app, CORS, mount
├── tests/
│   ├── test_e2e.py           ← End-to-end tests
│   ├── test_live_e2e.py      ← Live E2E with ngrok
│   ├── make_call.py          ← Bolna inbound call test
│   └── make_dispatch_call.py ← Bolna outbound dispatch call test
├── requirements/             ← dev.txt, prod.txt
├── Dockerfile
└── pyproject.toml
```

## Models

### Emergency

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer | PK |
| `caller_name` | String | |
| `caller_phone` | String | Nullable |
| `victim_name` | String | Nullable |
| `emergency_type` | String | Fire, Medical, Accident, etc. |
| `severity` | String | Critical / High / Medium / Low |
| `location` | Text | Free-text address |
| `landmark` | String | Nullable |
| `victims` | Integer | Number of people affected |
| `description` | Text | |
| `immediate_danger` | String | |
| `summary` | Text | AI-generated summary |
| `latitude` / `longitude` | Float | Nullable, geocoded from location + landmark |
| `status` | Enum | pending → dispatched → en_route → resolved |
| `full_transcript` | Text | Complete transcript text |
| `bolna_call_id` | String | Nullable, indexed — Bolna call ID for matching |
| `created_at` | DateTime | Auto-set |

### TranscriptChunk

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer | PK |
| `emergency_id` | Integer | FK → emergencies.id (CASCADE) |
| `chunk_text` | Text | |
| `is_final` | Boolean | |
| `created_at` | DateTime | Auto-set |

### Station

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer | PK |
| `name` | String | |
| `type` | String | police / fire / medical / rescue |
| `latitude` / `longitude` | Float | |
| `address` | Text | |
| `phone` | String | Nullable, normalized with + prefix at call time |

### DispatchRecord

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer | PK |
| `emergency_id` | Integer | Indexed |
| `station_id` | Integer | |
| `status` | Enum | pending_call → acknowledged / escalated / dispatch_failed |
| `dispatched_at` | DateTime | |
| `acknowledged_at` | DateTime | Nullable |
| `created_at` | DateTime | |

## Dispatch Pipeline

```
User clicks "Dispatch" → POST /api/emergencies/{id}/dispatch
  → dispatch_service.execute_dispatch()
    → Creates DispatchRecord (status=pending_call)
    → BolnaMessageService.send_dispatch() → POST /call with user_data
    → Starts 600s escalation timer
    → Broadcasts dispatch_update via WS

Station answers → Bolna outbound agent reads incident details
  → Station ACKs → Bolna POSTs /api/dispatch/ack
    → Updates DispatchRecord (status=acknowledged)
    → Sets emergency.status = "dispatched"
    → Cancels timer

No response / rejection → POST /api/dispatch/ack (rejected/no_answer)
  → Sets pipeline_status = "awaiting_redispatch"
  → UI shows remaining stations → dispatcher picks next
```

## Database Schema


## Dev Tools

```bash
# Run tests
..\thor\Scripts\python -m pytest tests/test_e2e.py -v

# Make a test call (inbound agent)
..\thor\Scripts\python tests\make_call.py --phone +919876543210 --track

# Test outbound dispatch call
..\thor\Scripts\python tests\make_dispatch_call.py --emergency-id 101 --station-phone +918792666030 --track

# Clean test DB
del test_savior_e2e.db
```
