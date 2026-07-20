# SAVIOR Backend

Emergency reporting and dispatch API built with **FastAPI + MySQL**. Two Bolna AI agents feed into it — an inbound agent for victim calls and an outbound agent for station dispatch.

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
| POST | `/api/emergency` | Create emergency (Bolna inbound webhook) |
| GET | `/api/emergencies` | List all |
| GET | `/api/emergencies/{id}` | Get single |
| PATCH | `/api/emergencies/{id}/status` | Update status + WS broadcast |
| DELETE | `/api/emergencies/{id}` | Delete + WS broadcast |

### Filters & Queries
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/emergencies/recent?limit=&offset=` | Paginated recent |
| GET | `/api/emergencies/type/{type}` | By type |
| GET | `/api/emergencies/severity/{severity}` | By severity |
| GET | `/api/emergencies/location/{location}` | By location text |
| GET | `/api/emergencies/date/{date}` | By date |
| GET | `/api/emergencies/mass-casualty?min_victims=` | N+ victims |
| GET | `/api/emergencies/caller/{phone}` | By caller phone |

### Dispatch
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/emergencies/{id}/stations` | Ranked stations (OSRM routing + distance) |
| POST | `/api/emergencies/{id}/dispatch` | Execute dispatch — creates DispatchRecord, calls Bolna outbound agent |
| GET | `/api/emergencies/{id}/dispatch/status` | Current dispatch record |
| POST | `/api/dispatch/ack` | Bolna webhook — station ACK/reject/no-answer → updates pipeline |

### Stats
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/emergencies/stats?days=N` | Aggregate stats |
| POST | `/api/emergencies/geocode` | Backfill missing lat/lng |

### Transcript
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/transcript/chunk` | Live chunk → WS broadcast |
| POST | `/api/transcript/complete` | Final transcript webhook |
| GET | `/api/transcript/{id}/chunks` | List chunks |
| GET | `/api/transcript/live-sessions` | Active sessions |

### WebSocket
| Endpoint | Description |
|----------|-------------|
| WS `/ws` | Real-time events — `new_emergency`, `dispatch_update`, `transcript_chunk`, `live_transcript`, `transcript_complete`, etc. |

## Project Structure

```
backend/
├── app/
│   ├── api/v1/endpoints/     ← Route handlers
│   │   ├── emergency.py      ← CRUD + filters + stats
│   │   ├── dispatch.py       ← Station rankings, dispatch, ACK webhook
│   │   └── transcript.py     ← Chunks + complete webhook
│   ├── core/                 ← Config, database, WebSocket manager
│   ├── models/               ← Emergency, TranscriptChunk, Station, DispatchRecord
│   ├── schemas/              ← Pydantic schemas
│   ├── services/             ← Business logic
│   │   ├── dispatch_service.py    ← Ranking pipeline, execute dispatch, escalation timer
│   │   ├── message_service.py     ← Bolna outbound call client (BolnaMessageService)
│   │   ├── emergency_service.py   ← Emergency CRUD helpers
│   │   ├── station_service.py     ← Station data + ranking
│   │   ├── routing_service.py     ← OSRM + HERE routing
│   │   ├── geocoding_service.py   ← Nominatim geocoding
│   │   ├── duplicate_service.py   ← Duplicate detection
│   │   ├── sms_service.py         ← Fast2SMS integration
│   │   └── geospatial_service.py  ← District boundary checks
│   └── main.py               ← FastAPI app, CORS, mount
├── tests/
│   ├── test_e2e.py           ← E2E tests
│   ├── test_live_e2e.py      ← Live E2E with ngrok
│   ├── make_call.py          ← Bolna inbound call test
│   └── make_dispatch_call.py ← Bolna outbound dispatch call test
├── requirements/
├── .env.example
└── Dockerfile
```

## Dispatch Pipeline

```
User clicks "Dispatch" → POST /api/emergencies/{id}/dispatch
  → dispatch_service.execute_dispatch()
    → Creates DispatchRecord (status=pending_call)
    → BolnaMessageService.send_dispatch() → POST to Bolna /call
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

## Models

### Emergency

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer | PK |
| `caller_name` | String | |
| `caller_phone` | String | Nullable |
| `emergency_type` | String | Fire, Medical, Police, Rescue |
| `severity` | String | Critical / High / Medium / Low |
| `location` | Text | Free-text address |
| `landmark` | String | Nullable |
| `victims` | Integer | |
| `description` | Text | |
| `summary` | Text | AI-generated |
| `latitude` / `longitude` | Float | Geocoded |
| `status` | String | pending → dispatched |
| `pipeline_status` | String | pending_ack / awaiting_redispatch / dispatched |
| `full_transcript` | Text | |
| `bolna_call_id` | String | Indexed |
| `created_at` | DateTime | |

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

## Dev Tools

```bash
# Run tests
..\thor\Scripts\python -m pytest tests/test_e2e.py -v

# Test Bolna inbound call
..\thor\Scripts\python tests\make_call.py --phone +919876543210

# Test Bolna outbound dispatch call
..\thor\Scripts\python tests\make_dispatch_call.py --emergency-id 101 --station-phone +918792666030 --track
```
