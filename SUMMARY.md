# SAVIOR — System Summary

## Overview

**SAVIOR** (Situational Analysis & Virtual Intelligent Operational Router) is a real-time emergency dispatch system connecting callers, AI agents, dispatchers, and emergency response stations through a single integrated platform.

```
Caller → Bolna AI Agent → FastAPI Backend → MySQL
                     ↓
            WebSocket Stream
                     ↓
        Dispatcher Dashboard (React)
                     ↓
            Station Dispatch + ACK
```

---

## Current System (Built)

### Architecture

The system follows a three-tier, event-driven architecture:

| Tier | Technology | Role |
|------|-----------|------|
| **Voice Agent** | Bolna AI (custom functions + prompts) | Answers emergency calls, collects incident data, streams live transcripts |
| **Backend API** | Python FastAPI, SQLAlchemy, MySQL | REST + WebSocket server, emergency CRUD, transcript ingestion, geocoding |
| **Dispatcher Dashboard** | React 19, TypeScript, Vite, Tailwind 4, Leaflet, Recharts | Real-time UI for monitoring, mapping, and managing emergencies |

### Completed Phases

#### Phase 1: Backend Enhancements ✅
Emergency model with status lifecycle (`pending` → `dispatched` → `en_route` → `resolved`), transcript chunk ingestion (`POST /api/transcript/chunk` + `/complete`), WebSocket broadcasting (`/ws` with `ConnectionManager`), DELETE capability, geocoding via Nominatim.

**Key files:** `backend/app/api/v1/endpoints/emergency.py`, `backend/app/api/v1/endpoints/transcript.py`, `backend/app/core/websocket.py`, `backend/app/services/emergency_service.py`, `backend/app/services/geocoding_service.py`

#### Phase 2: Bolna Agent Configuration ⏳ (66%)
Voice agent configured with system prompt (information collection, severity classification, emergency types), custom functions (`post-emergency.json` for report creation, `send-transcript-chunk.json` for live streaming), and sample payloads. Remaining tasks require Bolna dashboard UI access.

**Key files:** `bolna-agent/prompts/system-prompt.md`, `bolna-agent/custom-functions/post-emergency.json`, `bolna-agent/custom-functions/send-transcript-chunk.json`

#### Phase 3: Frontend Scaffold ✅
Vite + React 19 + Tailwind 4 + TypeScript project initialized. shadcn/ui primitives installed. Path aliases, custom theme tokens (severity/status colors), layout shell (Header, Sidebar, Main Content), and all core dependencies configured.

**Key files:** `frontend/package.json`, `frontend/vite.config.ts`

#### Phase 4: Dashboard Views ✅
Four fully functional pages:

| Page | Route | Description |
|------|-------|-------------|
| **Feed** | `/` | Real-time emergency cards with status/severity filters, side-panel detail view |
| **Map** | `/map` | Leaflet map with severity-colored SVG teardrop markers, auto-pan, radius search, popups |
| **Stats** | `/stats` | Analytics dashboard with 4 chart types (Today/Week/Month/Year/5Y) + stat cards |
| **Transcriptions** | `/transcriptions` | Live transcription cards (dark terminal), incident history, JSON export, auto-scroll |

All pages connected via WebSocket for real-time updates. 22 passing tests.

#### Phase 5: Polish ⏳ (0%)
Designed but not yet implemented. Planned improvements: loading skeletons, empty/error states, responsive layout (mobile modal, 60/40 tablet, sidebar desktop), WebSocket reconnect with exponential backoff, debounced clicks, long-text truncation, transition animations.

---

## Planned Phases (Final System)

### Phase 6: Dispatch Engine 🚧 (Planned)

The most significant pending phase. Adds automated emergency call processing — the system goes from passive incident logging to active dispatch coordination.

#### A — Backend Foundation (Wave 1)
- **Station model** — Police, fire, and medical stations with name, type, lat/lng, address, phone
- **17 stations seeded** for Hubli/Dharwad area (6 police, 5 fire, 6 medical)
- **DispatchRecord model** — Tracks full lifecycle: `pending_call` → `acknowledged/rejected/no_answer` → `escalated` → `dispatch_failed`
- **Emergency model amendments** — `location_captured`, `district_check`, `pipeline_status`, `dispatch_record_id` fields
- **Routing service** — OSMnx + NetworkX road-aware routing (no API key) with Haversine fallback
- **Geospatial service** — District boundary check via Shapely + GeoJSON (inside/outside coverage area)
- **SMS service** — Fast2SMS integration for location capture link
- **Duplicate detection** — Same location + type within 1-hour window → merge
- **MessageService interface** — Abstract base with `SimulatedMessageService` (MVP) + `BolnaMessageService` (production stub)

#### B — Dispatch Pipeline + API (Wave 2)
- **Dispatch orchestration service** — Central pipeline coordinating validation → ranking → dispatch → ACK
- **Validation pipeline** — District check, duplicate detection, location capture via SMS
- **Ranking pipeline** — ETA-based station ranking with concurrent route computation
- **Dispatch endpoints:**
  - `GET /emergencies/{id}/stations` — Top 5 ranked stations with route data
  - `POST /emergencies/{id}/dispatch` — Dispatcher confirms, creates DispatchRecord, broadcasts via WS
  - `POST /dispatch/ack` — Webhook for station ACK from Bolna outbound agent
- **Location capture page** — Standalone mobile-friendly HTML page (`/location/{id}`) using browser Geolocation API
- **Auto-pipeline trigger** — Emergency creation automatically sends SMS and starts validation

#### C — Frontend Dispatch Panel (Wave 3)
- **DispatchPage** — New route (`/dispatch`) with sidebar navigation
- **StationRanking** — 5 ranked station cards with distance, ETA, and route preview
- **StationCard** — Severity-colored cards with station type badge, phone, address
- **RoutePreview** — Leaflet MiniMap with polyline overlay from origin to station
- **EscalationTimer** — 2-minute countdown with color transitions (green → yellow → red)
- **Auto-trigger** — New emergencies automatically open the dispatch panel

#### D — ACK + Bolna Integration (Wave 4)
- **BolnaMessageService** — Real outbound calls via Bolna `POST /call` API (with simulated fallback)
- **Escalation timer** — Background asyncio task with 2-minute timeout, race condition guard (atomic UPDATE)
- **dispatch_failed** — All 5 stations exhausted → emergency flagged for manual dispatch
- **Bolna outbound agent config** — Custom function (`station-ack.json`) + system prompt for station ACK calls
- **WebSocket events** — `dispatch_update`, `dispatch_escalated`, `dispatch_failed` broadcast to dashboard

### Phase 7: Testing & Documentation ⏳ (Planned)
- Backend tests: pytest for all endpoints (status, transcript, CRUD)
- Frontend tests: Vitest + React Testing Library for all components
- Docker verification: end-to-end `docker-compose up`
- Linting: Oxlint + Ruff configured
- Type checking: TypeScript strict mode

### Milestone 2: Production Hardening (v2) — Future
- **P8:** Authentication — dispatcher login + session management
- **P9:** Alert rules — auto-notify on critical severity events
- **P10:** Deployment — Docker Compose with reverse proxy (Nginx/Traefik)
- **P11:** Historical data views, CSV/PDF export, reporting

---

## Data Model

### Emergency (`backend/app/models/emergency.py`)
| Field | Type | Notes |
|-------|------|-------|
| `id` | PK auto | |
| `caller_name`, `caller_phone`, `victim_name` | String | Caller/victim info |
| `emergency_type` | String | Fire, Medical, Police, Road Accident, Natural Disaster, Domestic Violence, Other |
| `severity` | String | Critical, High, Medium, Low |
| `location`, `landmark` | String | Incident location |
| `latitude`, `longitude` | Float | Geocoded or SMS-captured |
| `victims` | Integer | Number affected |
| `description`, `summary` | Text | Incident details |
| `status` | Enum | pending → dispatched → en_route → resolved |
| `pipeline_status` | String *(planned)* | pending → validating → ranked → dispatched → dispatch_failed → escalated |
| `district_check` | String *(planned)* | inside_coverage / outside_coverage / not_checked |
| `location_captured` | Boolean *(planned)* | Whether SMS location was received |
| `full_transcript` | Text | Complete call transcript |
| `bolna_call_id` | String | Matches transcript to Bolna call |
| `created_at` | DateTime | UTC |

### Station (`backend/app/models/station.py`) *(Planned)*
| Field | Type | Notes |
|-------|------|-------|
| `id` | PK | |
| `name` | String | Station name |
| `type` | String | police / fire / medical |
| `latitude`, `longitude` | Float | Geolocation |
| `address` | Text | Full address |
| `phone` | String | Contact number |

### DispatchRecord (`backend/app/models/dispatch_record.py`) *(Planned)*
| Field | Type | Notes |
|-------|------|-------|
| `id` | PK | |
| `emergency_id` | FK → emergencies | |
| `station_id` | FK → stations | |
| `status` | Enum | pending_call → acknowledged / rejected / no_answer → escalated / dispatch_failed |
| `dispatched_at` | DateTime | |
| `acknowledged_at` | DateTime | |

---

## API Endpoints

### Current
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/emergency` | Create emergency (from Bolna) |
| GET | `/api/emergencies` | List all |
| GET | `/api/emergencies/{id}` | Get single |
| PATCH | `/api/emergencies/{id}/status` | Update status |
| DELETE | `/api/emergencies/{id}` | Delete |
| GET | `/api/emergencies/recent?limit=&offset=` | Paginated |
| GET | `/api/emergencies/type/{type}` | Filter by type |
| GET | `/api/emergencies/severity/{severity}` | Filter by severity |
| GET | `/api/emergencies/location/{location}` | Search location |
| GET | `/api/emergencies/date/{date}` | Filter by date |
| GET | `/api/emergencies/stats?days=N` | Aggregate stats |
| GET | `/api/emergencies/mass-casualty?min_victims=` | Mass casualty |
| GET | `/api/emergencies/caller/{phone}` | By caller phone |
| POST | `/api/emergencies/geocode` | Backfill lat/lng |
| POST | `/api/transcript/chunk` | Receive transcript chunk |
| POST | `/api/transcript/complete` | Receive final transcript |
| GET | `/api/transcript/{id}/chunks` | List chunks |
| GET | `/api/transcript/live-sessions` | Active sessions |
| WS | `/ws` | Real-time event stream |

### Planned (Phase 6)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/emergencies/{id}/stations` | Ranked stations |
| POST | `/api/emergencies/{id}/dispatch` | Confirm dispatch |
| GET | `/api/emergencies/{id}/dispatch/status` | Dispatch status |
| POST | `/api/dispatch/ack` | Station ACK webhook |
| GET | `/api/location/{id}` | Location capture page |
| POST | `/api/location/{id}` | Receive SMS location |

---

## Real-Time Data Flow (Final System)

```
1. Caller dials → Bolna AI Agent answers (inbound agent)
2. Agent collects incident info → streams live transcript chunks via API
3. Agent calls POST /api/emergency → emergency created in MySQL
4. Backend broadcasts 'new_emergency' via WebSocket → Dashboard shows it instantly
5. SMS sent to caller with location capture link
6. Caller taps link → browser Geolocation → lat/lng sent to backend
7. Validation pipeline: district check → duplicate check
8. ETA-based station ranking (OSMnx road network, no API key)
9. Dispatcher sees ranked stations + route preview → confirms dispatch
10. Outbound Bolna agent calls station → delivers incident details
11. Station ACK (acknowledged/rejected/no_answer) → webhook back to backend
12. 2-minute escalation timer → auto-escalate to next station if no ACK
13. All 5 stations fail → emergency flagged for manual dispatch
14. Dashboard updates in real-time at every step via WebSocket
```

## Deployment

- **Backend:** Docker container (`python:3.13-slim`, Uvicorn on port 8000)
- **Database:** MySQL 8.0 container
- **Frontend:** Vite dev server (proxies `/api` and `/ws` to backend)
- **Production:** `docker-compose up` (backend + MySQL); frontend requires static file serving

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for details.

## Progress Summary

```
Phase 1: Backend Enhancements        100% ✅
Phase 2: Bolna Agent Configuration    66% ⏸️
Phase 3: Frontend Scaffold           100% ✅
Phase 4: Dashboard Views             100% ✅
Phase 5: Polish                        0% ⏳
Phase 6: Dispatch Engine               0% 🚧
  ├── A: Backend Foundation            0% ⏳
  ├── B: Dispatch Pipeline + API       0% ⏳
  ├── C: Frontend Dispatch Panel       0% ⏳
  └── D: ACK + Bolna Integration       0% ⏳
Phase 7: Testing & Documentation       0% ⏳

Milestone 2 (v2)                       Future
  ├── Authentication
  ├── Alert Rules
  ├── Deployment (reverse proxy)
  └── Reporting & Export
```
