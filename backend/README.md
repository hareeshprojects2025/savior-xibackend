# SAVIOR Backend

Emergency reporting API built with **FastAPI** + **MySQL**. Receives emergency call data from Bolna AI and stores it for dispatch coordination.

## Tech Stack
| Component | Technology |
|-----------|------------|
| Framework | FastAPI |
| ORM | SQLAlchemy |
| Database | MySQL 8+ |
| Validation | Pydantic |
| Server | Uvicorn |

## Quick Start
```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements/dev.txt
```

Copy `.env.example` to `.env` and update MySQL credentials:
```bash
cp .env.example .env
```

Run the server:
```bash
uvicorn app.main:app --reload
```

## API
Swagger docs: http://127.0.0.1:8000/docs

### POST /api/emergency
Submit an emergency report (called by Bolna Custom Function).

### GET Endpoints
| Endpoint | Description |
|----------|-------------|
| `/api/emergencies` | List all emergencies |
| `/api/emergencies/{id}` | Get single emergency |
| `/api/emergencies/recent` | Paginated recent |
| `/api/emergencies/stats` | Summary statistics |
| `/api/emergencies/type/{type}` | Filter by type |
| `/api/emergencies/severity/{sev}` | Filter by severity |
| `/api/emergencies/location/{loc}` | Search by location |
| `/api/emergencies/date/{date}` | Filter by date |
| `/api/emergencies/caller/{phone}` | Filter by caller |
| `/api/emergencies/mass-casualty` | Mass casualty incidents |
| `/api/emergencies/{id}/status` | Update status |

### WebSocket
| Endpoint | Description |
|----------|-------------|
| `/ws/emergencies` | Real-time emergency feed |
| `/ws/transcript/{call_sid}` | Live transcript streaming |

## Project Structure
```
backend/
├── app/
│   ├── api/v1/endpoints/     ← Route handlers
│   ├── core/                 ← Config, database, WebSocket
│   ├── models/               ← SQLAlchemy models
│   ├── schemas/              ← Pydantic schemas
│   ├── services/             ← Business logic
│   └── main.py               ← FastAPI app
├── tests/
├── requirements/
├── Dockerfile
└── pyproject.toml
```
