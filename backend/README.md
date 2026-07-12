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
| POST | `/api/emergency` | Create emergency (Bolna webhook) — auto-geocodes if lat/lng missing |
| GET | `/api/emergencies` | List all emergencies |
| GET | `/api/emergencies/{id}` | Get single emergency |
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
| GET | `/api/emergencies/stats?days=N` | Aggregate stats — by_severity, by_status, by_type, by_hour. Optional `days` param filters recent N days. |
| POST | `/api/emergencies/geocode` | Backfill missing lat/lng via Nominatim |

### Transcript
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/transcript/chunk` | Receive live transcript chunk |
| POST | `/api/transcript/complete` | Final transcript webhook (Bolna) — updates full_transcript + summary |
| GET | `/api/transcript/{id}/chunks` | List transcript chunks for an emergency |

### WebSocket
| Endpoint | Description |
|----------|-------------|
| WS `/ws` | Real-time events — broadcasts `new_emergency`, `status_update`, `transcript_chunk`, `transcript_complete`, `emergency_deleted`. Handles client `{"type":"ping"}` → responds `{"type":"pong"}`. |

## Project Structure

```
backend/
├── app/
│   ├── api/v1/endpoints/     ← Route handlers
│   ├── core/                 ← Config, database session, WebSocket manager
│   ├── models/               ← SQLAlchemy models (Emergency, TranscriptChunk)
│   ├── schemas/              ← Pydantic schemas (create, update, stats, transcript)
│   ├── services/             ← Business logic, geocoding
│   └── main.py               ← FastAPI app, WebSocket endpoint, CORS
├── tests/
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
| `caller_phone` | String | |
| `victim_name` | String | Nullable |
| `emergency_type` | String | Fire, Medical, Accident, etc. |
| `severity` | String | Critical / High / Medium / Low |
| `location` | Text | Free-text address |
| `landmark` | String | Nullable |
| `victims` | Integer | Number of people affected |
| `description` | Text | |
| `immediate_danger` | String | Yes / No |
| `summary` | Text | AI-generated summary |
| `latitude` / `longitude` | Float | Nullable, geocoded from location |
| `status` | Enum | pending → dispatched → en_route → resolved |
| `full_transcript` | Text | Complete transcript text |
| `created_at` | DateTime | Auto-set |

### TranscriptChunk

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer | PK |
| `emergency_id` | Integer | FK → emergencies.id (CASCADE) |
| `chunk_text` | Text | |
| `is_final` | Boolean | |
| `created_at` | DateTime | Auto-set |
