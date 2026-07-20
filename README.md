# SAVIOR

**S**ituational **A**nalysis & **V**irtual **I**ntelligent **O**perational **R**outer

Real-time emergency dispatch system. Bolna AI voice agents collect incident reports → FastAPI backend processes them → React dispatcher dashboard provides live monitoring, mapping, station ranking, and dispatch coordination.

## Architecture

```
Caller → Bolna Inbound Agent → Backend API → MySQL
                     ↓
            Live Transcript Chunks
                     ↓
              WebSocket Stream (WS)
                     ↓
            Dispatcher Dashboard (React)
                     ↓
         Dispatcher clicks "Dispatch"
                     ↓
     Bolna Outbound Agent → Station Phone
                     ↓
         Station ACK / No Answer → Webhook
```

## Structure

```
savior/
├── backend/           ← FastAPI + MySQL API
├── frontend/          ← Vite + React 19 + Tailwind 4 dashboard
├── bolna-agent/       ← Bolna AI config files (prompts + custom functions)
├── docs/              ← Project documentation
└── scripts/           ← Dev helpers
```

## Prerequisites

- Python 3.11+
- Node 20+
- MySQL 8.0 (service named `MySQL80`, running on localhost:3306)

## Setup

### 1. Create the database

```sql
CREATE DATABASE IF NOT EXISTS savior_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Run the backend once to auto-create all tables (SQLAlchemy creates them on startup).

### 2. Configure environment

```bash
cd backend
copy .env.example .env
```

Edit `.env` with your MySQL password and Bolna credentials:

```
DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/savior_db
BOLNA_API_Key=bn-...
BOLNA_DISPATCH_AGENT_ID=61d7ac00-...
BASE_URL=https://YOUR_NGROK.ngrok-free.dev
```

### 3. Install backend dependencies

```bash
thor\Scripts\pip install -r backend\requirements\dev.txt
```

### 4. Run the backend

```bash
cd backend
..\thor\Scripts\uvicorn app.main:app --reload
```

The API is at `http://localhost:8000/docs` (Swagger UI).

### 5. Install & run the frontend

```bash
cd frontend
npm install
npm run dev
```

The dashboard is at `http://localhost:5173`.

### 6. Expose with ngrok (for Bolna webhooks)

```bash
ngrok http 8000 --subdomain=YOUR_SUBDOMAIN
```

Set `BASE_URL` in `.env` to your ngrok URL.

## API Endpoints

### Emergency CRUD
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/emergency` | Create emergency report (from Bolna) |
| GET | `/api/emergencies` | List all emergencies |
| GET | `/api/emergencies/{id}` | Get single emergency |
| PATCH | `/api/emergencies/{id}/status` | Update status |
| DELETE | `/api/emergencies/{id}` | Delete emergency |

### Filters & Queries
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/emergencies/recent?limit=&offset=` | Paginated recent emergencies |
| GET | `/api/emergencies/type/{type}` | Filter by type |
| GET | `/api/emergencies/severity/{severity}` | Filter by severity |
| GET | `/api/emergencies/location/{location}` | Search by location (LIKE) |
| GET | `/api/emergencies/date/{date}` | Filter by date |
| GET | `/api/emergencies/mass-casualty?min_victims=` | Mass casualty incidents |
| GET | `/api/emergencies/caller/{phone}` | Filter by caller phone |

### Dispatch
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/emergencies/{id}/stations` | Ranked stations for an emergency |
| POST | `/api/emergencies/{id}/dispatch` | Dispatch to a station |
| GET | `/api/emergencies/{id}/dispatch/status` | Current dispatch status |
| POST | `/api/dispatch/ack` | Bolna webhook — station ACK/reject/no-answer |

### Stats & Geocoding
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/emergencies/stats?days=N` | Aggregate stats |
| POST | `/api/emergencies/geocode` | Backfill missing lat/lng |

### Transcript
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/transcript/chunk` | Live transcript chunk (streams via WebSocket) |
| POST | `/api/transcript/complete` | Final transcript + summary (Bolna webhook) |
| GET | `/api/transcript/{id}/chunks` | List transcript chunks |
| GET | `/api/transcript/live-sessions` | Active live sessions |

### WebSocket
| Endpoint | Description |
|----------|-------------|
| WS | `/ws` | Real-time event stream |

## Frontend Overview

| Page | Route | Description |
|------|-------|-------------|
| **Feed** | `/` | Real-time emergency cards, side-panel detail view |
| **Map** | `/map` | Leaflet map with severity markers |
| **Stats** | `/stats` | Analytics dashboard with 4 charts |
| **Dispatch** | `/dispatch?emergency_id=` | Station ranking, route preview, dispatch with ACK timer |
| **Transcriptions** | `/transcriptions` | Call transcript viewer |

### Dispatch Flow

1. Emergency appears in Feed → dispatcher opens Dispatch panel
2. Backend ranks nearby stations by ETA (OSRM routing)
3. Dispatcher selects a station → clicks "Dispatch"
4. Backend calls Bolna outbound agent → Bolna calls station phone
5. Station personnel verbally ACKs → Bolna sends webhook → status = "dispatched"
6. No response in 600s → dispatcher picks next station

## Quick Start

1. **Create the MySQL database** — run the SQL above
2. **Start the backend** — `uvicorn app.main:app --reload`
3. **Start ngrok** — `ngrok http 8000`
4. **Start the frontend** — `npm run dev`
5. **Visit** `http://localhost:5173`
