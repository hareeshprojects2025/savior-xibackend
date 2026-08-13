# SAVIOR

**S**ituational **A**nalysis & **V**irtual **I**ntelligent **O**perational **R**outer

Real-time emergency dispatch system. Dual Bolna AI agents: an inbound agent collects incident reports from callers → the FastAPI backend stores them, auto-geocodes (Photon), runs a validation pipeline (district check, duplicate detection), sends a Twilio SMS with a location-capture link, and auto-dispatches to ranked stations → the React dispatcher dashboard provides live monitoring, mapping, station ranking, and dispatch coordination via an outbound Bolna agent that calls stations for verbal acknowledgment.

## Architecture

```
Caller → Bolna Inbound Agent → Backend API → MySQL
                     ↓                    ↓
             Live Transcript Chunks  Twilio SMS (location link)
                     ↓                    ↓
              WebSocket Stream (WS)  Browser Geolocation
                     ↓
             Dispatcher Dashboard (React)
                     ↓
       Validation → Ranking → Auto-dispatch pipeline
         (or Dispatcher clicks "Dispatch")
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

The backend auto-creates all tables on first startup (`Base.metadata.create_all` in `app/main.py`), so the SQL below is only needed for manual setups.

#### 1.1 Tables (current schema)

```sql
CREATE TABLE emergencies (
  id                 INT           NOT NULL AUTO_INCREMENT,
  caller_name        VARCHAR(255)  NOT NULL,
  caller_phone       VARCHAR(20)   DEFAULT NULL,
  victim_name        VARCHAR(255)  DEFAULT NULL,
  emergency_type     VARCHAR(100)  NOT NULL,
  severity           VARCHAR(50)   DEFAULT NULL,
  location           VARCHAR(500)  NOT NULL,
  landmark           VARCHAR(500)  DEFAULT NULL,
  victims            INT           DEFAULT NULL,
  description        TEXT          DEFAULT NULL,
  immediate_danger   VARCHAR(255)  DEFAULT NULL,
  summary            TEXT          DEFAULT NULL,
  status             VARCHAR(20)   NOT NULL DEFAULT 'pending',
  latitude           FLOAT         DEFAULT NULL,
  longitude          FLOAT         DEFAULT NULL,
  full_transcript    TEXT          DEFAULT NULL,
  bolna_call_id      VARCHAR(255)  DEFAULT NULL,
  created_at         DATETIME      DEFAULT NULL,
  location_captured  TINYINT(1)    DEFAULT 0,
  district_check     VARCHAR(50)   DEFAULT NULL,
  pipeline_status    VARCHAR(50)   DEFAULT NULL,
  dispatch_record_id INT           DEFAULT NULL,
  geocoded_place_name VARCHAR(500) DEFAULT NULL,
  geocoded_osm_type  VARCHAR(10)   DEFAULT NULL,
  geocoded_osm_key   VARCHAR(50)   DEFAULT NULL,
  geocoded_city      VARCHAR(100)  DEFAULT NULL,
  geocoded_state     VARCHAR(100)  DEFAULT NULL,
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

CREATE TABLE stations (
  id         INT           NOT NULL AUTO_INCREMENT,
  name       VARCHAR(255)  NOT NULL,
  type       VARCHAR(20)   NOT NULL,
  latitude   FLOAT         DEFAULT NULL,
  longitude  FLOAT         DEFAULT NULL,
  address    TEXT          DEFAULT NULL,
  phone      VARCHAR(20)   DEFAULT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE dispatch_records (
  id              INT           NOT NULL AUTO_INCREMENT,
  emergency_id    INT           NOT NULL,
  station_id      INT           NOT NULL,
  status          VARCHAR(30)   NOT NULL DEFAULT 'pending_call',
  dispatched_at   DATETIME      DEFAULT NULL,
  acknowledged_at DATETIME      DEFAULT NULL,
  call_id         VARCHAR(255)  DEFAULT NULL,
  created_at      DATETIME      DEFAULT NULL,
  PRIMARY KEY (id),
  INDEX ix_dispatch_records_emergency_id (emergency_id)
);
```

#### 1.2 Seed stations

The dispatch pipeline needs station data. Seed it once (40 stations: 21 police, 5 fire, 11 medical, 3 rescue — Hubli/Dharwad region):

```bash
cd backend
..\thor\Scripts\python -m app.seed_stations
```

### 2. Configure environment

```bash
cd backend
copy .env.example .env
```

Edit `.env` with your credentials:

```
DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/savior_db

# Bolna AI agents
BOLNA_API_TOKEN=bn-your_bolna_api_token_here
BOLNA_AGENT_ID=your_inbound_agent_id_here
BOLNA_DISPATCH_AGENT_ID=your_dispatch_agent_id_here

# Twilio SMS (location capture links)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Public base URL used in SMS location links (use your ngrok URL when testing Bolna)
BASE_URL=http://localhost:8000
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
| POST | `/api/emergency` | Create emergency report (from Bolna) — auto-geocodes, triggers auto-pipeline |
| GET | `/api/emergencies` | List all emergencies |
| GET | `/api/emergencies/{id}` | Get single emergency |
| PATCH | `/api/emergencies/{id}/status` | Update status (pending → dispatched → en_route → resolved) |
| DELETE | `/api/emergencies/{id}` | Delete emergency |

### Filters & Queries
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/emergencies/recent?limit=&offset=&in_coverage=` | Paginated recent emergencies (optional `in_coverage` filters out manual-review items) |
| GET | `/api/emergencies/type/{type}` | Filter by type |
| GET | `/api/emergencies/severity/{severity}` | Filter by severity |
| GET | `/api/emergencies/location/{location}` | Search by location (LIKE) |
| GET | `/api/emergencies/date/{date}` | Filter by date |
| GET | `/api/emergencies/mass-casualty?min_victims=` | Mass casualty incidents |
| GET | `/api/emergencies/caller/{phone}` | Filter by caller phone |

### Dispatch
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/emergencies/{id}/stations` | Ranked stations for an emergency (OSMnx road-network routing + Haversine fallback) |
| POST | `/api/emergencies/{id}/dispatch` | Dispatch to a station — creates DispatchRecord, calls Bolna outbound agent, starts 600s escalation timer |
| GET | `/api/emergencies/{id}/dispatch/status` | Current dispatch record status |
| POST | `/api/dispatch/ack` | Bolna webhook — station ACK/reject/no-answer → updates pipeline |

### Location Capture
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/location/{emergency_id}` | Serve location capture HTML page (browser Geolocation API) |
| POST | `/api/location/{emergency_id}` | Receive captured coordinates — triggers auto-pipeline |

### Stats
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/emergencies/stats?days=N&today=true` | Aggregate stats (by_severity, by_status, by_type, by_hour in IST) — optional `today` filters to current IST calendar day |
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
| WS | `/ws` | Real-time event stream — `new_emergency`, `status_update`, `location_received`, `dispatch_update`, `dispatch_escalated`, `dispatch_failed`, `transcript_chunk`, `transcript_complete`, `transcript_resolved`, `live_transcript`, `emergency_deleted`. Supports `{"type":"ping"}` keepalive. |

## Frontend Overview

Built with **React 19 + TypeScript + Vite + Tailwind CSS 4**.

| Page | Route | Description |
|------|-------|-------------|
| **Feed** | `/` | Real-time emergency cards with status/severity filters, side-panel detail view |
| **Map** | `/map` | Leaflet map with severity markers, auto-pan, popups, no-coords overlay |
| **Stats** | `/stats` | Analytics dashboard — stat cards + 4 charts (Today/Week/Month/Year/5Y) |
| **Transcriptions** | `/transcriptions` | Call transcript viewer — live transcription cards (dark terminal style), incident history with severity/status filters, auto-scroll, JSON export, fetch-on-select transcript loading |
| **Dispatch** | `/dispatch?emergency_id=` | Station ranking by ETA, route preview on Leaflet map, dispatch with 600s ACK escalation timer, re-dispatch on no-answer |

### Design system

- **Typeface:** Geist + Geist Mono
- **Icon set:** Lucide React
- **Charts:** Recharts (bar, pie, donut)
- **Map:** Leaflet + react-leaflet
- **Components:** shadcn/ui primitives + custom components
- **Utilities:** class-variance-authority, clsx, tailwind-merge

## Quick Start

1. **Create the MySQL database** — Run the SQL in [Setup section](#1-create-the-database) to create `savior_db`. Tables are auto-created on first backend startup.

2. **Start the backend** — Copy `.env.example` to `.env` in the `backend/` directory, set your MySQL password (plus Bolna/Twilio keys if you want live calls and SMS), then run:
   ```bash
   cd backend
   ..\thor\Scripts\pip install -r requirements\dev.txt
   ..\thor\Scripts\python -m app.seed_stations
   ..\thor\Scripts\uvicorn app.main:app --reload
   ```
   The API is available at `http://localhost:8000/docs`.

3. **Start the frontend** — In a separate terminal:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   The dashboard is available at `http://localhost:5173`.

You now have a running SAVIOR system. Visit the dashboard, open the WebSocket feed, and submit test emergencies to see real-time updates across the Feed, Map, and Stats pages.

## Usage Examples

### 1. Submit an emergency via the API

Use `curl` to simulate a Bolna agent reporting a fire incident:

```bash
curl -X POST http://localhost:8000/api/emergency \
   -H "Content-Type: application/json" \
   -d '{
     "caller_name": "Harish",
     "caller_phone": "+919876543210",
     "emergency_type": "Fire",
     "severity": "Medium",
     "location": "House No. 45, MG Road, Bengaluru",
     "latitude": 12.9719,
     "longitude": 77.5937,
     "victims": 3,
     "description": "Fire with smoke and three people trapped inside.",
     "immediate_danger": "Smoke"
   }'
```

Expected response:
```json
{
  "status": "success",
  "message": "Emergency recorded successfully."
}
```

The new emergency immediately appears in the dashboard Feed and on the Map (via WebSocket broadcast).

### 2. Query emergencies with filters

List the most recent 5 emergencies:

```bash
curl "http://localhost:8000/api/emergencies/recent?limit=5&offset=0"
```

Filter by emergency type:

```bash
curl "http://localhost:8000/api/emergencies/type/Fire"
```

Get aggregate statistics for the last 7 days:

```bash
curl "http://localhost:8000/api/emergencies/stats?days=7"
```

### 4. Test the dispatch flow

Rank stations for an emergency, then dispatch to a station:

```bash
# Get ranked stations for emergency 1
curl "http://localhost:8000/api/emergencies/1/stations"

# Dispatch to station 99 (SDM College)
curl -X POST "http://localhost:8000/api/emergencies/1/dispatch" \
  -H "Content-Type: application/json" \
  -d '{"emergency_id": 1, "station_id": 99}'
```

### 5. Connect to the real-time WebSocket feed

Use a WebSocket client (or `websocat`) to listen for live events:

```bash
websocat ws://localhost:8000/ws
```

Once connected, the server pushes events such as `new_emergency`, `status_update`, `transcript_chunk`, and `emergency_deleted`. Send a keepalive ping to maintain the connection:

```json
{"type": "ping"}
```
