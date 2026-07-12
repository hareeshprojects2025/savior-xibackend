# SAVIOR

**S**ituational **A**nalysis & **V**irtual **I**ntelligent **O**perational **R**outer

Real-time emergency dispatch system. Bolna AI voice agent collects incident reports → FastAPI backend stores them → React dispatcher dashboard provides live monitoring, mapping, and incident management.

## Architecture

```
Caller → Bolna AI Agent → Backend API → MySQL
                     ↓
            Live Transcript Chunks
                     ↓
              WebSocket Stream (WS)
                     ↓
            Dispatcher Dashboard (React)
```

## Structure

```
savior/
├── backend/           ← FastAPI + MySQL API
├── frontend/          ← Vite + React 19 + Tailwind 4 dashboard
├── bolna-agent/       ← Bolna AI config files (prompts + custom functions)
├── docs/              ← Project documentation
├── scripts/           ← Dev helpers
└── .planning/         ← GSD project management
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
#### 1.1 Create emergency table and transcript_chunks table
```sql
CREATE TABLE emergencies (
  id            INT           NOT NULL AUTO_INCREMENT,
  caller_name   VARCHAR(255)  NOT NULL,
  caller_phone  VARCHAR(20)   DEFAULT NULL,
  victim_name   VARCHAR(255)  DEFAULT NULL,
  emergency_type VARCHAR(100) NOT NULL,
  severity      VARCHAR(50)   DEFAULT NULL,
  location      VARCHAR(500)  NOT NULL,
  landmark      VARCHAR(500)  DEFAULT NULL,
  victims       INT           DEFAULT NULL,
  description   TEXT          DEFAULT NULL,
  immediate_danger VARCHAR(255) DEFAULT NULL,
  summary       TEXT          DEFAULT NULL,
  latitude      FLOAT         DEFAULT NULL,
  longitude     FLOAT         DEFAULT NULL,
  status        VARCHAR(20)   NOT NULL DEFAULT 'pending',
  full_transcript TEXT        DEFAULT NULL,
  bolna_call_id VARCHAR(255)  DEFAULT NULL,
  created_at    DATETIME      DEFAULT NULL,
  PRIMARY KEY (id),
  INDEX ix_emergencies_bolna_call_id (bolna_call_id)
);


CREATE TABLE transcript_chunks (
  id            INT           NOT NULL AUTO_INCREMENT,
  emergency_id  INT           NOT NULL,
  chunk_text    TEXT          NOT NULL,
  is_final      TINYINT(1)    DEFAULT 0,
  created_at    DATETIME      DEFAULT NULL,
  PRIMARY KEY (id),
  INDEX ix_transcript_chunks_emergency_id (emergency_id),
  CONSTRAINT fk_transcript_chunks_emergency
    FOREIGN KEY (emergency_id) REFERENCES emergencies(id) ON DELETE CASCADE
);
```

### 2. Configure environment

```bash
cd backend
copy .env.example .env
```

Edit `.env` with your MySQL password:

```
DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/savior_db
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

## API Endpoints

### Emergency CRUD
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/emergency` | Create emergency report (from Bolna) |
| GET | `/api/emergencies` | List all emergencies |
| GET | `/api/emergencies/{id}` | Get single emergency |
| PATCH | `/api/emergencies/{id}/status` | Update status (pending → dispatched → en_route → resolved) |
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

### Stats & Geocoding
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/emergencies/stats?days=N` | Aggregate stats (by_severity, by_status, by_type, by_hour) |
| POST | `/api/emergencies/geocode` | Backfill missing lat/lng for all records |

### Transcript
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/transcript/chunk` | Receive live transcript chunk (streams via WebSocket) |
| POST | `/api/transcript/complete` | Receive final transcript + summary (Bolna webhook) |
| GET | `/api/transcript/{id}/chunks` | List transcript chunks for an emergency |
| GET | `/api/transcript/live-sessions` | Get active live transcription sessions (catch-up on reconnect) |

### WebSocket
| Endpoint | Description |
|----------|-------------|
| WS | `/ws` | Real-time event stream — `new_emergency`, `status_update`, `transcript_chunk`, `transcript_complete`, `transcript_resolved`, `live_transcript`, `emergency_deleted`. Supports `{"type":"ping"}` keepalive. |

## Frontend Overview

Built with **React 19 + TypeScript + Vite + Tailwind CSS 4**.

| Page | Route | Description |
|------|-------|-------------|
| **Feed** | `/` | Real-time emergency cards with status/severity filters, side-panel detail view |
| **Map** | `/map` | Leaflet map with severity markers, auto-pan, popups, no-coords overlay |
| **Stats** | `/stats` | Analytics dashboard — stat cards + 4 charts (Today/Week/Month/Year/5Y) |
| **Transcriptions** | `/transcriptions` | Call transcript viewer — live transcription cards (dark terminal style), incident history with severity/status filters, auto-scroll, JSON export, fetch-on-select transcript loading |

### Design system

- **Typeface:** Geist + Geist Mono
- **Icon set:** Lucide React
- **Charts:** Recharts (bar, pie, donut)
- **Map:** Leaflet + react-leaflet
- **Components:** shadcn/ui primitives + custom components
- **Utilities:** class-variance-authority, clsx, tailwind-merge
