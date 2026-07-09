# SAVIOR

**S**ituational **A**nalysis & **V**irtual **I**ntelligent **O**perational **R**outer

Real-time emergency dispatch system. Bolna AI voice agent collects incident reports → FastAPI backend stores them → React dispatcher dashboard provides live monitoring and incident management.

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
├── bolna-agent/       ← Bolna AI config files
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

The API is at `http://localhost:8000/docs` for Swagger docs.

### 5. Install & run the frontend

```bash
cd frontend
npm install
npm run dev
```

The dashboard is at `http://localhost:5173`.

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

## Frontend Overview

Built with **React 19 + TypeScript + Vite + Tailwind CSS 4**.

| Page | Route | Description |
|------|-------|-------------|
| **Feed** | `/` | Real-time emergency cards with timeline |
| **Detail** | (slide-in) | Full incident detail, status actions, confirm dialogs |
| **Map** | `/map` | Map view with emergency pins (planned) |
| **Stats** | `/stats` | Analytics dashboard — stat cards + 4 charts |
| **Transcriptions** | `/transcriptions` | Call transcript viewer |

### Design system

- **Typeface:** Geist + Geist Mono (replaces Inter)
- **Icon set:** Lucide React
- **Charts:** Recharts
- **Components:** Base UI + shadcn/ui primitives
- **Utilities:** class-variance-authority, clsx, tailwind-merge