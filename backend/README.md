# SAVIOR Backend

Emergency reporting API built with **FastAPI + MySQL**. Receives emergency call data from Bolna AI, stores it, and streams real-time updates to the dispatcher dashboard via WebSocket.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | FastAPI |
| ORM | SQLAlchemy |
| Database | MySQL 8+ |
| Validation | Pydantic |
| Server | Uvicorn |
| Geocoding | Nominatim (OpenStreetMap) |

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
| WS `/ws` | Real-time events — broadcasts `new_emergency`, `status_update`, `transcript_chunk`, `transcript_complete`, `transcript_resolved`, `live_transcript`, `emergency_deleted`. Handles client `{"type":"ping"}` → responds `{"type":"pong"}`. |

## Project Structure

```
backend/
├── app/
│   ├── api/v1/endpoints/     ← Route handlers (emergency, transcript)
│   ├── core/                 ← Config, database session, WebSocket manager
│   ├── models/               ← SQLAlchemy models (Emergency, TranscriptChunk)
│   ├── schemas/              ← Pydantic schemas (create, update, stats, transcript)
│   ├── services/             ← Business logic, geocoding
│   └── main.py               ← FastAPI app, WebSocket endpoint, CORS
├── tests/
│   ├── test_e2e.py           ← End-to-end tests (14 tests)
│   └── make_call.py          ← Bolna outbound call script
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

## Database Schema


## Dev Tools

```bash
# Run tests
..\thor\Scripts\python -m pytest tests/test_e2e.py -v

# Make a test call
..\thor\Scripts\python tests\make_call.py --phone +919876543210 --track

# Clean test DB
del test_savior_e2e.db
```
