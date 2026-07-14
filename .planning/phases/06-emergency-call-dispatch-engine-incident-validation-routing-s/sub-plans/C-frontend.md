---
phase: 06-dispatch-engine
plan: C
type: execute
wave: 3
depends_on:
  - B
files_modified:
  - frontend/src/pages/DispatchPage.tsx
  - frontend/src/components/dispatch/StationCard.tsx
  - frontend/src/components/dispatch/StationRanking.tsx
  - frontend/src/components/dispatch/RoutePreview.tsx
  - frontend/src/components/dispatch/EscalationTimer.tsx
  - frontend/src/hooks/useDispatch.ts
  - frontend/src/App.tsx
  - frontend/src/components/layout/Sidebar.tsx
  - frontend/src/lib/types.ts
  - frontend/src/hooks/EmergencyFeedContext.tsx
autonomous: false
requirements:
  - D-02
  - D-04
  - D-05
  - D-06
  - D-07
  - D-29
user_setup: []
must_haves:
  truths:
    - DispatchPage is accessible from sidebar navigation (D-02)
    - Dispatch page shows ranked stations with distance, ETA, and route preview per station (D-04, D-05, D-29)
    - Dispatcher can select a station and confirm dispatch (D-01)
    - Route preview rendered as Leaflet polyline overlay on MiniMap (D-04, D-29)
    - Escalation timer shown when station is pending ACK (D-07, D-32)
    - Auto-trigger: emergency creation opens dispatch panel for new emergencies (D-06)
    - WebSocket dispatch_update events update the UI in real-time (D-03)
  artifacts:
    - frontend/src/pages/DispatchPage.tsx
    - frontend/src/components/dispatch/*.tsx
    - frontend/src/hooks/useDispatch.ts
  key_links:
    - useDispatch hook fetches stations via GET /emergencies/{id}/stations
    - DispatchPage renders StationRanking which contains StationCard + RoutePreview per station
    - EscalationTimer counts down 2 minutes, shows auto-escalate indicator
    - EmergencyFeedContext broadcasts dispatch events to trigger auto-open
---

# Sub-Plan C: Frontend Dispatch Panel (Wave 3)

<objective>
**Purpose:** Build the frontend dispatch panel — a new page in the dashboard where dispatchers see ranked stations, preview routes, and confirm dispatch. The panel auto-triggers when new emergencies arrive and includes escalation timers for pending dispatches.

**Output:** A fully interactive dispatch panel accessible from the sidebar, with station ranking, route preview via Leaflet, dispatch confirmation, and real-time ACK tracking.
</objective>

<context>
@.planning/phases/06-emergency-call-dispatch-engine-incident-validation-routing-s/06-CONTEXT.md
@.planning/phases/06-emergency-call-dispatch-engine-incident-validation-routing-s/06-RESEARCH.md
@frontend/src/App.tsx
@frontend/src/components/layout/Sidebar.tsx
@frontend/src/hooks/EmergencyFeedContext.tsx
@frontend/src/hooks/useApi.ts
@frontend/src/lib/types.ts
@frontend/src/pages/MapPage.tsx
@frontend/src/components/map/EmergencyMap.tsx
</context>

<tasks>

<task>
<name>Task 1: Types + Hook + Context Amendments</name>
<files>
  frontend/src/lib/types.ts (amend)
  frontend/src/hooks/useDispatch.ts (NEW)
  frontend/src/hooks/EmergencyFeedContext.tsx (amend)
</files>
<type>frontend</type>

<read_first>
- `@frontend/src/lib/types.ts` — Existing type patterns (interfaces, type aliases, const objects)
- `@frontend/src/hooks/useApi.ts` — Hook pattern (useState, useCallback, fetch with error handling)
- `@frontend/src/hooks/EmergencyFeedContext.tsx` — Context pattern (createContext, Provider, useContext guard)
- `@frontend/src/hooks/useEmergencyFeed.ts` — WebSocket types and event handling
</read_first>

<action>
Extend the frontend types, create the dispatch hook, and extend the feed context:

**Type amendments** (`frontend/src/lib/types.ts`):
- Add `Station` interface: `{ id: number, name: string, type: "police" | "fire" | "medical", latitude: number, longitude: number, address: string, phone: string | null }`
- Add `StationRanking` interface: `{ station: Station, distance_km: number, eta_minutes: number, encoded_polyline: string }`
- Add `DispatchStatus` type: `"pending_call" | "acknowledged" | "rejected" | "no_answer" | "escalated" | "dispatch_failed"`
- Add `DispatchRecord` interface: `{ id: number, emergency_id: number, station_id: number, status: DispatchStatus, dispatched_at: string | null, acknowledged_at: string | null, created_at: string }`
- Add `DispatchResponse` interface: `{ status: string, dispatch_id: number, message: string }`
- Extend `WsMessage` type union: add `"dispatch_update" | "dispatch_escalated" | "location_received"` to the `type` field
- Add `dispatch_status` and `dispatch_record_id` optional fields to WsMessage interface

**Dispatch hook** (`frontend/src/hooks/useDispatch.ts`):
- Follow the same pattern as `useApi.ts`
- `interface UseDispatchReturn { stations: StationRanking[], loading, error, dispatchState, fetchRankings, confirmDispatch, escalate }`
- `fetchRankings(emergencyId: number)` → `GET /api/emergencies/{emergencyId}/stations`, returns `StationRanking[]`
- `confirmDispatch(emergencyId: number, stationId: number)` → `POST /api/emergencies/{emergencyId}/dispatch?station_id={stationId}`, returns `DispatchResponse`
- `dispatchState`: `"idle" | "loading_rankings" | "ready" | "dispatching" | "dispatched" | "escalating" | "failed"`
- Error handling matches useApi.ts pattern (try/catch, err instanceof Error)
- Per D-01 (assisted dispatch — system ranks, dispatcher confirms), D-05 (top 5 stations)

**Context amendments** (`frontend/src/hooks/EmergencyFeedContext.tsx`):
- Add to `EmergencyFeedContextValue`:
  - `dispatchEmergencyId: number | null` — currently active dispatch emergency
  - `setDispatchEmergencyId: (id: number | null) => void`
  - `dispatchState: string | null` — latest dispatch status from WS
- In the provider: add `useState` for `dispatchEmergencyId` and `dispatchState`
- In the WebSocket message handler: handle `"dispatch_update"` and `"dispatch_escalated"` events:
  - Update `dispatchState` based on the WS event
  - If event is `dispatch_update` with `status:"dispatched"`, auto-navigate to dispatch page
  - Per D-06 (auto-trigger on emergency creation)
</action>

<verify>
<automated>cd frontend && npx tsc -b --noEmit --pretty 2>&1 | head -30</automated>
</verify>

<done>
- Station, StationRanking, DispatchRecord interfaces added to types.ts
- useDispatch hook with fetchRankings, confirmDispatch implemented
- EmergencyFeedContext extended with dispatch state and WS handlers
- TypeScript compiles without errors
</done>
</task>

<task>
<name>Task 2: Dispatch Components (StationCard, StationRanking, RoutePreview, EscalationTimer)</name>
<files>
  frontend/src/components/dispatch/StationCard.tsx (NEW)
  frontend/src/components/dispatch/StationRanking.tsx (NEW)
  frontend/src/components/dispatch/RoutePreview.tsx (NEW)
  frontend/src/components/dispatch/EscalationTimer.tsx (NEW)
</files>
<type>frontend</type>

<read_first>
- `@frontend/src/components/detail/MiniMap.tsx` — Existing Leaflet MiniMap pattern for route preview
- `@frontend/src/components/feed/EmergencyCard.tsx` — Card component pattern (severity badge, hover states, cn())
- `@frontend/src/components/ui/card.tsx` — shadcn Card patterns
- `06-RESEARCH.md` — Lines 215-242 (RoutePreview component code)
</read_first>

<action>
Create four dispatch components in a new `frontend/src/components/dispatch/` directory:

**StationCard** (`StationCard.tsx`):
- Props: `station: StationRanking, rank: number, isSelected: boolean, onSelect: () => void, disabled: boolean`
- Render card with: rank number badge, station name, station type badge (colored: blue for police, red for fire, green for medical), distance in km, ETA in minutes, address
- Highlight when `isSelected` (blue border, light blue bg)
- `cursor-pointer` + hover state (hover:bg-surface-hover)
- Disabled state: `opacity-50 cursor-not-allowed` when dispatch is in progress
- Use `cn()` utility for class merging
- Per D-05: show full details (name, distance, ETA)

**StationRanking** (`StationRanking.tsx`):
- Props: `stations: StationRanking[], loading: boolean, error: string | null, selectedStationId: number | null, onSelectStation: (id: number) => void, onConfirmDispatch: (id: number) => void, dispatchInProgress: boolean`
- Loading state: 5 skeleton cards (shimmer rectangles matching station card shape)
- Error state: ErrorState component with retry button
- Empty state: "No matching stations found" with explanation
- Normal state: list of StationCard components, one per ranked station
- "Dispatch to Selected" button at bottom, disabled until a station is selected or dispatch is in progress
- Confirm button triggers `onConfirmDispatch` which shows a ConfirmDialog before dispatching
- Follow pattern from `@frontend/src/components/common/ErrorState.tsx` for error/empty states

**RoutePreview** (`RoutePreview.tsx`):
- Props: `routeCoords: [number, number][], origin: [number, number], destination: [number, number], distanceKm: number, etaMinutes: number, stationName: string`
- Renders a Leaflet MiniMap (200px height) with:
  - Origin marker (green, label "O")
  - Destination marker (red, label "D")
  - Blue polyline connecting origin → destination (color: `#2563EB`, weight: 4, opacity: 0.7)
  - Distance/ETA overlay badge at bottom-left (`bg-white/90 rounded-lg px-3 py-1.5 text-xs font-medium`)
- Use `MapContainer` with `zoomControl={false}`, `scrollWheelZoom={false}` (read-only map)
- Use `TileLayer` from OpenStreetMap (existing pattern)
- Fallback: if `routeCoords` is empty array, show straight dashed line between origin/destination (Haversine fallback)
- Per D-04, D-29: route preview shown before dispatcher confirms

**EscalationTimer** (`EscalationTimer.tsx`):
- Props: `startedAt: string (ISO), timeoutSeconds: number (default 120), onTimeout: () => void, status: DispatchStatus`
- Visual countdown timer showing minutes:seconds remaining
- Progress bar that depletes over `timeoutSeconds`
- Color changes: green (>60s) → yellow (30-60s) → red (<30s)
- When timer reaches 0, call `onTimeout` callback
- States:
  - Active countdown: show timer + "Waiting for station ACK..."
  - Acknowledged: show green checkmark + "Station acknowledged" — timer stops
  - Escalated: show orange warning + "Escalating to next station..."
  - Failed: show red X + "All stations failed — manual dispatch required"
- Use `useEffect` with `setInterval` for countdown, cleanup on unmount
- Per D-07 (auto-escalate after timeout), D-32 (2-minute timeout)
</action>

<verify>
<automated>cd frontend && npx tsc -b --noEmit --pretty 2>&1 | head -30</automated>
</verify>

<done>
- StationCard renders ranked station with full details
- StationRanking list with loading/error/empty states
- RoutePreview renders Leaflet map with route polyline
- EscalationTimer counts down with visual states
- All components TypeScript-compile clean
</done>
</task>

<task>
<name>Task 3: DispatchPage + Route + Sidebar + WS Integration</name>
<files>
  frontend/src/pages/DispatchPage.tsx (NEW)
  frontend/src/App.tsx (amend)
  frontend/src/components/layout/Sidebar.tsx (amend)
</files>
<type>frontend</type>

<read_first>
- `@frontend/src/pages/MapPage.tsx` — Existing page pattern (use context, useState, render components)
- `@frontend/src/App.tsx` — Route structure
- `@frontend/src/components/layout/Sidebar.tsx` — Nav items, active state pattern
- `@frontend/src/components/detail/ConfirmDialog.tsx` — Dialog pattern for dispatch confirmation
</read_first>

<action>
Create the dispatch page, add route, and update sidebar:

**DispatchPage** (`frontend/src/pages/DispatchPage.tsx`):
- Use `useEmergencyFeedContext()` to get emergencies list and dispatch state
- Use `useDispatch()` hook for API calls
- Use `useSearchParams` to get `?emergency_id=N` from URL (allows deep-linking)
- States:
  - **Loading (initial):** Shimmer skeleton matching page layout
  - **No emergency selected:** Show "Select an emergency to dispatch" with a list of pending emergencies (severity-colored cards, clickable)
  - **Emergency selected, loading rankings:** StationRanking loading state + "Finding nearest stations..."
  - **Rankings ready:** StationRanking with StationCard list + RoutePreview for selected station
  - **Dispatching:** Disabled UI + "Confirming dispatch..." spinner
  - **Dispatched:** Success animation + EscalationTimer showing ACK waiting state
  - **Acknowledged:** Green success banner + "Station acknowledged the dispatch"
  - **Failed:** Red error state + "All stations failed — manual dispatch required"
  - **Outside coverage:** Warning banner + "This emergency is outside our coverage area. Manual review required."
  
- Layout:
  - Left panel (60%): Emergency info summary (severity, type, location, description) + StationRanking
  - Right panel (40%): Live route preview + EscalationTimer (when dispatching)
  - Or stacked on mobile

- Auto-trigger: Check `useSearchParams` for `?emergency_id=N` and `?auto=true`. When auto=true, immediately fetch rankings. Per D-06.
- Use ConfirmDialog before confirming dispatch (follow existing pattern from `@frontend/src/components/detail/ConfirmDialog.tsx`)
- After dispatch confirms: show EscalationTimer + RoutePreview for dispatched station
- Per D-02 (new dispatch panel in dashboard, separate page)

**Route amendment** (`frontend/src/App.tsx`):
- Import `DispatchPage`
- Add route: `<Route path="dispatch" element={<DispatchPage />} />`

**Sidebar amendment** (`frontend/src/components/layout/Sidebar.tsx`):
- Import `RadioTower` icon from `lucide-react`
- Add nav item: `{ to: "/dispatch", icon: RadioTower, label: "Dispatch" }`
- Place between "Stats" and "Transcriptions" in navItems array
- Matches existing pattern (NavLink, icon + label, active state styling)

Per D-02 (dispatch panel as separate page/section, not within EmergencyDetail).
</action>

<verify>
<automated>
cd frontend && npx tsc -b --noEmit --pretty 2>&1 | head -30
</automated>
</verify>

<done>
- DispatchPage renders with loading/empty/ranked/dispatched/failed states
- Route `/dispatch` registered in App.tsx
- Sidebar shows Dispatch nav item with RadioTower icon
- TypeScript compiles clean
- Full flow: select emergency → see rankings → confirm → see ACK timer
</done>
</task>

</tasks>

<verification>
```bash
cd frontend && npx tsc -b --noEmit
cd frontend && npx vitest run
cd frontend && npx vite build
```
</verification>
