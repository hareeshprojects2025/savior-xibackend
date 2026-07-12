# SAVIOR Frontend

Dispatcher dashboard built with **React 19 + TypeScript + Vite + Tailwind CSS 4**.

## Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | FeedPage | Real-time emergency feed — cards with severity/status badges, two-row filter bar (status + severity), side-panel detail view with status actions, connection banner |
| `/map` | MapPage | Leaflet map with 36×48 teardrop severity markers, auto-pan on new arrivals, popups, no-coordinates overlay, map legend + status filter sidebar |
| `/stats` | StatsPage | Analytics dashboard — 4 stat cards (total, active, resolved, by severity) + 4 charts (Status Pipeline, Severity Distribution, Hourly Volume, Type Distribution) with Today/Week/Month/Year/5Y time filter |
| `/transcriptions` | TranscriptionsPage | Call transcript viewer — live transcription cards (dark terminal style with REC indicator), incident history list with severity/status filters, fetch-on-select transcript loading, JSON export |

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | React 19 |
| Language | TypeScript |
| Build | Vite 8 |
| Styling | Tailwind CSS 4 |
| Charts | Recharts |
| Map | Leaflet + react-leaflet |
| Icons | Lucide React |
| Components | shadcn/ui (Radix UI primitives) |
| Testing | Vitest |
| Routing | react-router-dom |

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

Opens at `http://localhost:5173`. Vite proxies `/api/*` and `/ws` to `http://localhost:8000`.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Production build |
| `npm run lint` | Run Oxlint |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm test` | Run Vitest |

## Project Structure

```
frontend/src/
├── components/
│   ├── common/          ← LoadingSkeleton (FeedSkeleton, CardSkeleton, DetailSkeleton), ErrorState, EmptyState, ConnectionBanner
│   ├── feed/            ← EmergencyList, EmergencyCard, FeedFilter
│   ├── detail/          ← EmergencyDetail, MiniMap
│   ├── map/             ← EmergencyMap (Leaflet), MapFilter, MapLegend
│   ├── stats/           ← StatsGrid (4 charts + stat cards), ChartCard
│   └── ui/              ← shadcn/ui primitives (button, badge, dialog, etc.)
├── hooks/
│   ├── useEmergencyFeed.ts      ← WebSocket connection + live state + live-sessions catch-up on reconnect
│   ├── EmergencyFeedContext.tsx ← React context provider
│   └── useApi.ts                ← REST API helpers (updateStatus, deleteEmergency)
├── lib/
│   ├── types.ts         ← Emergency, EmergencySummary, EmergencyStats, WsMessage, ActiveSession
│   └── utils.ts         ← cn(), formatTimeAgo()
├── pages/
│   ├── FeedPage.tsx             ← Emergency list + detail panel
│   ├── MapPage.tsx              ← Map + legend + filter
│   ├── StatsPage.tsx            ← Stats grid
│   └── TranscriptionPage.tsx    ← Live transcript + incident history + transcript detail
├── App.tsx              ← Router setup (/, /map, /stats, /transcriptions)
└── main.tsx             ← Entry point
```

## State & Data Flow

```
Bolna → Backend API → MySQL
                  ↓
           WebSocket (/ws)
                  ↓
      useEmergencyFeed hook
        ├─ emergencies[]     ← live updates
        ├─ activeSessions{}  ← live transcript sessions
        ├─ connected         ← WS status
        ├─ reconnecting      ← retry loop indicator
        └─ loading           ← initial prefetch
                  ↓
      EmergencyFeedContext
                  ↓
      FeedPage | MapPage | StatsPage | TranscriptionPage
```

### WebSocket Events

| Event | Trigger |
|-------|---------|
| `new_emergency` | Emergency created/updated |
| `status_update` | Status changed via PATCH |
| `transcript_chunk` | Live transcript line during call |
| `live_transcript` | Real-time session transcript broadcast |
| `transcript_complete` | Call ended (no transcript body) |
| `transcript_resolved` | Final transcript + summary available |
| `emergency_deleted` | Emergency removed |

### Reconnection

- **Backoff:** 500ms → 1s → 1s → 2s → 2s → 4s (max)
- **Catch-up:** On reconnect, fetches `GET /api/transcript/live-sessions` to recover missed live sessions
- **Visibility:** `visibilitychange` listener forces immediate reconnect when tab becomes visible
- **Indicator:** "Reconnecting to server..." banner shown on TranscriptionPage during retry
