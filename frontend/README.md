# SAVIOR Frontend

Dispatcher dashboard built with **React 19 + TypeScript + Vite + Tailwind CSS 4**.

## Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | FeedPage | Real-time emergency feed — cards with severity/status badges, two-row filter bar, side-panel detail view |
| `/map` | MapPage | Leaflet map with severity markers, auto-pan, popups, map legend + status filter |
| `/stats` | StatsPage | Analytics — 4 stat cards + 4 charts (Status Pipeline, Severity Distribution, Hourly Volume, Type Distribution) with time filter |
| `/dispatch?emergency_id=` | DispatchPage | Station ranking, route preview on Leaflet map, dispatch with 600s ACK timer, re-dispatch on no-answer |
| `/transcriptions` | TranscriptionsPage | Call transcript viewer — dark terminal style, live transcription cards, incident history, JSON export |

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
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build |
| `npm run lint` | Run Oxlint |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm test` | Run Vitest |

## Project Structure

```
frontend/src/
├── components/
│   ├── common/          ← LoadingSkeleton, ErrorState, EmptyState, ConnectionBanner
│   ├── feed/            ← EmergencyList, EmergencyCard, FeedFilter
│   ├── detail/          ← EmergencyDetail, MiniMap
│   ├── dispatch/        ← StationCard, RoutePreview, EscalationTimer
│   ├── map/             ← EmergencyMap (Leaflet), MapFilter, MapLegend
│   ├── stats/           ← StatsGrid (4 charts + stat cards), ChartCard
│   └── ui/              ← shadcn/ui primitives
├── hooks/
│   ├── useEmergencyFeed.ts      ← WebSocket + live state + catch-up
│   ├── EmergencyFeedContext.tsx ← React context provider
│   ├── useDispatch.ts           ← Dispatch state machine (rankings, confirm dispatch)
│   └── useApi.ts                ← REST API helpers
├── lib/
│   ├── types.ts         ← Emergency, StationRanking, DispatchResponse, WsMessage, etc.
│   └── utils.ts         ← cn(), formatTimeAgo()
├── pages/
│   ├── FeedPage.tsx
│   ├── MapPage.tsx
│   ├── StatsPage.tsx
│   ├── DispatchPage.tsx          ← Station ranking + route + dispatch + re-dispatch
│   └── TranscriptionPage.tsx
├── App.tsx
└── main.tsx
```

## Dispatch Flow (UI)

```
1. Emergency arrives → Feed shows pending badge
2. Dispatcher clicks → opens Dispatch panel with ?emergency_id=
3. Station rankings load → cards sorted by ETA
4. Select station → route preview on map
5. Click "Dispatch" → POST to backend → "Awaiting Station ACK"
6a. ACK received → "✓ Dispatch Complete"
6b. Timeout 600s → "Station did not respond" → select next station → re-dispatch
```

## State & Data Flow

```
Bolna → Backend API → MySQL
                  ↓
           WebSocket (/ws)
                  ↓
      useEmergencyFeed hook
        ├─ emergencies[]
        ├─ activeSessions{}
        ├─ connected
        ├─ reconnecting
        └─ loading
                  ↓
      EmergencyFeedContext
                  ↓
      All pages consume context
```

## WebSocket Events

| Event | Trigger |
|-------|---------|
| `new_emergency` | Emergency created |
| `dispatch_update` | Dispatch initiated / ACK received / awaiting redispatch |
| `status_update` | Status changed |
| `transcript_chunk` | Live transcript line |
| `live_transcript` | Real-time session transcript |
| `transcript_complete` | Call ended |
| `transcript_resolved` | Final transcript available |
| `emergency_deleted` | Emergency removed |

## Reconnection

- **Backoff:** 500ms → 1s → 1s → 2s → 2s → 4s (max)
- **Catch-up:** Fetches `GET /api/transcript/live-sessions` on reconnect
- **Visibility:** `visibilitychange` listener forces reconnect on tab focus
- **Indicator:** "Reconnecting to server..." banner
