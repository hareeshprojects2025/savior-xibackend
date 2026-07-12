# SAVIOR Frontend

Dispatcher dashboard built with **React 19 + TypeScript + Vite + Tailwind CSS 4**.

## Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | FeedPage | Real-time emergency feed — cards with severity badges, status transitions, WS live updates |
| `/map` | MapPage | Leaflet map with 36×48 teardrop severity markers, auto-pan on new arrivals, popups, no-coordinates overlay |
| `/stats` | StatsPage | Analytics dashboard — 4 stat cards + 4 charts (Status Pipeline, Severity Distribution, Hourly Volume, Type Distribution) with Today/Week/Month/Year/5Y filter |
| `/transcriptions` | TranscriptionsPage | Call transcript viewer — severity filter, JSON export, auto-scroll, adaptive full_transcript parsing |

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
│   ├── common/        ← LoadingSkeleton, ErrorState, EmptyState
│   ├── map/           ← EmergencyMap (Leaflet), MapFilter, MapLegend
│   ├── stats/         ← StatsGrid (4 charts + stat cards)
│   ├── transcript/    ← TranscriptList, TranscriptCard
│   └── ui/            ← shadcn/ui primitives (button, badge, dialog, etc.)
├── hooks/             ← useEmergencyFeed, useApi, EmergencyFeedContext
├── lib/               ← types, constants (STATUS_TRANSITIONS, SEVERITY_COLORS)
├── pages/             ← FeedPage, MapPage, StatsPage, TranscriptionsPage
├── App.tsx            ← Router setup
└── main.tsx           ← Entry point
```
