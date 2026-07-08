# SAVIOR

**S**ituational **A**nalysis & **V**irtual **I**ntelligent **O**perational **R**outer

Real-time emergency dispatch system. Bolna AI voice agent collects incident reports → FastAPI backend stores them → Dispatcher dashboard provides live monitoring and incident management.

## Architecture
```
Caller → Bolna AI Agent → Backend API → MySQL
                     ↓
            Live Transcript Chunks
                     ↓
              WebSocket Stream
                     ↓
            Dispatcher Dashboard
```

## Structure
```
savior/
├── backend/           ← FastAPI + MySQL API
├── frontend/          ← Vite + React dashboard
├── bolna-agent/       ← Bolna AI config files
├── docs/              ← Project documentation
├── scripts/           ← Dev helpers
└── .planning/         ← GSD project management
```

## Prerequisites

- Python 3.11+ (use `thor/` venv)
- MySQL 8.0 (service named `MySQL80`, running on localhost:3306)

## Setup

### 1. Create the database

```sql
CREATE DATABASE IF NOT EXISTS savior_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

### 2. Create tables

The app creates tables on startup, but if the DB already exists, run this SQL:

```sql
USE savior_db;
ALTER TABLE emergencies
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending' AFTER summary,
  ADD COLUMN full_transcript TEXT NULL AFTER status;

CREATE TABLE IF NOT EXISTS transcript_chunks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  emergency_id INT NOT NULL,
  chunk_text TEXT NOT NULL,
  is_final TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (emergency_id) REFERENCES emergencies(id) ON DELETE CASCADE,
  INDEX idx_emergency (emergency_id)
);
```

### 3. Configure environment

```bash
cd backend
copy .env.example .env
```

Edit `.env` with your MySQL password:

```
DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/savior_db
```

### 4. Install dependencies

```bash
thor\Scripts\pip install -r backend\requirements\dev.txt
```

### 5. Run the backend

```bash
cd backend
..\thor\Scripts\uvicorn app.main:app --reload
```

The API is now at `http://localhost:8000`. Open `http://localhost:8000/docs` for the interactive Swagger docs.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/emergency` | Create emergency report |
| GET | `/api/emergencies` | List all emergencies |
| GET | `/api/emergencies/recent` | Paginated recent emergencies |
| GET | `/api/emergencies/{id}` | Get single emergency |
| PATCH | `/api/emergencies/{id}/status` | Update status |
| DELETE | `/api/emergencies/{id}` | Delete emergency |
| GET | `/api/emergencies/stats` | Emergency statistics |
| GET | `/api/emergencies/type/{type}` | Filter by type |
| GET | `/api/emergencies/severity/{severity}` | Filter by severity |
| GET | `/api/emergencies/location/{location}` | Filter by location |
| GET | `/api/emergencies/date/{date}` | Filter by date |
| GET | `/api/emergencies/mass-casualty` | Mass casualty incidents |
| GET | `/api/emergencies/caller/{phone}` | Filter by caller phone |
| POST | `/api/transcript/chunk` | Receive live transcript chunk |
| POST | `/api/transcript/complete` | Receive final transcript |
| GET | `/api/transcript/{id}/chunks` | List transcript chunks |
| WS | `/ws` | Real-time event stream |

## Frontend (coming soon)

```bash
cd frontend
npm install
npm run dev
```
