# SAVIOR Dashboard — Stitch Design Spec (Pro Max)

> Emergency dispatch dashboard. Dispatchers monitor incoming emergencies in real-time via WebSocket, view them on a Leaflet map, and manage their lifecycle (pending → dispatched → en_route → resolved).

**Stack:** React + TypeScript, Vite, Tailwind CSS, shadcn/ui, Leaflet + OpenStreetMap, Recharts, Lucide React

---

## Brand & Visual Style

### Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--danger` | `#DC2626` | Critical severity, error states, destructive actions |
| `--danger-bg` | `#FEF2F2` | Critical badge bg |
| `--warning` | `#F59E0B` | High severity |
| `--warning-bg` | `#FFFBEB` | High badge bg |
| `--amber` | `#FBBF24` | Medium severity |
| `--amber-bg` | `#FEF3C7` | Medium badge bg |
| `--success` | `#10B981` | Resolved status |
| `--success-bg` | `#F0FDF4` | Resolved badge bg |
| `--info` | `#3B82F6` | Dispatched/en-route status |
| `--info-bg` | `#EFF6FF` | Dispatched/en-route badge bg |
| `--muted` | `#6B7280` | Secondary text, pending status |
| `--muted-bg` | `#F3F4F6` | Pending badge bg |
| `--bg` | `#F8FAFC` | Page background |
| `--surface` | `#FFFFFF` | Cards, panels, modals |
| `--surface-hover` | `#F1F5F9` | Card hover |
| `--border` | `#E2E8F0` | Dividers, borders |
| `--border-light` | `#F1F5F9` | Subtle dividers |
| `--text` | `#0F172A` | Primary text |
| `--text-secondary` | `#475569` | Secondary text |
| `--text-muted` | `#94A3B8` | Placeholder, disabled |
| `--overlay` | `rgba(0,0,0,0.5)` | Modal/drawer backdrop |

Variant validated: "Emergency SOS & Safety" from UI/UX Pro Max color database.

### Typography

- **UI:** Inter (sans-serif) — headings 600, body 400
- **Mono:** JetBrains Mono — IDs, timestamps, code
- **Scale:** 0.75rem / 0.875rem / 1rem / 1.125rem / 1.5rem

### Shadows & Radius

| Level | Shadow | Use |
|-------|--------|-----|
| card | `0 1px 3px 0 rgb(0 0 0 / 0.1)` | Emergency cards |
| elevated | `0 4px 12px 0 rgb(0 0 0 / 0.1)` | Detail panel, modals |
| toast | `0 20px 60px 0 rgb(0 0 0 / 0.3)` | Toasts |

Radius: `sm=4px` `md=6px` `lg=8px` `xl=12px` `full=9999px` (pills)

### Icons

Lucide React only (no emoji icons). Key: `AlertTriangle` `Ambulance` `MapPin` `CheckCircle2` `Clock` `ShieldCheck` `List` `Map` `BarChart3` `Trash2` `Phone` `X` `ArrowRight` `RefreshCw`

---

## Layout

```
Desktop (>1024px):
┌──────────────────────────────────────────────────────────┐
│  Header (56px, fixed z-50)                              │
│  [SAVIOR]  [● 12 active]  [Stats bar: 4 cards]          │
├──────────┬───────────────────────────────────────────────┤
│          │                                               │
│  Sidebar │  Main Content (ml-56, p-6)                    │
│  (56px)  │                                               │
│  z-40    │  ┌────────────────────────────────────────┐   │
│  ○ Feed  │  │  Feed / Map / Stats                    │   │
│  ○ Map   │  │                                        │   │
│  ○ Stats │  └────────────────────────────────────────┘   │
└──────────┴───────────────────────────────────────────────┘

Tablet (768-1024px): Sidebar condenses to 48px. Detail panel 50% width.
Mobile (<768px):    Bottom tab bar. Feed full-width. Detail = full modal with swipe-down dismiss.
```

---

## Pages / Views

### 1. Feed View (default)

```
┌─ Header ──────────────────────────────────────────────────┐
│ Active Emergencies  [●] 12 live  [Filter ▼] [Sort ▼]      │
├───────────────────────────────────────────────────────────┤
│ [Critical] [High] [Medium] [Low] [All] ◄ severity chips   │
│                                                           │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ [Critical] Fire                   2 min ago [Pending]│  │
│ │ Caller: Alice                           👤 Bob       │  │
│ │ 📍 123 Main Street, Mumbai                          │  │
│ │ 👥 3 victims    ⚠ Immediate danger: Yes             │  │
│ │ ───────────────────────────────────────────────────  │  │
│ │ [View Details →]  [Delete]                           │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                           │
│ ════════════════════════════════════════════════════════  │
│                                                           │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│ │  (next card shimmer animation on WS arrival)          │  │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                                                           │
│ [Load More →]  ◄ pagination                               │
└───────────────────────────────────────────────────────────┘
```

**States:**
- **Loading:** 3 shimmer skeleton cards (animate-pulse, 1.5s cycle)
- **Empty:** Centered `ShieldCheck` icon + "No active emergencies. All clear." + footnote
- **Error (WS):** Amber banner "Connection lost. Reconnecting..." + spin + manual retry
- **Error (HTTP):** ❌ icon + "Failed to load" + [Retry] button
- **Animation:** New cards slide in `-20px → 0` over 400ms ease-out with blue highlight flash fading 2s
- **Edge:** Long text `line-clamp-2`, null fields hidden, arrival queue 200ms stagger

### 2. Emergency Detail Panel

Slide-over from right, 40% width (min 380px, max 520px), z-30.

```
┌──────────────────────────────────────────┐
│ [← Close]                    [🗑 Delete]  │
│ ┌─────────────────────────────────────┐  │
│ │ [Dispatched]         Fire           │  │
│ │                     2 min ago       │  │
│ └─────────────────────────────────────┘  │
│ [Dispatch]  [En Route]  [Resolve]        │
│ (only show valid next transition)        │
├──────────────────────────────────────────┤
│ Caller Information                       │
│ ┌────────────────────────────────────┐   │
│ │ Name     Alice                     │   │
│ │ Phone    +91 98765 43210   [📞]   │   │ ← tel: link
│ │ Victim   Bob                       │   │ ← hidden if null
│ └────────────────────────────────────┘   │
│                                          │
│ Incident Details                         │
│ ┌────────────────────────────────────┐   │
│ │ Type     Fire                      │   │
│ │ Severity Critical    [red pill]    │   │
│ │ Location 123 Main St, Mumbai       │   │
│ │ Landmark Near City Hospital        │   │ ← hidden if null
│ │ Victims  3                         │   │
│ │ Danger   Yes — Smoke               │   │ ← hidden if null
│ └────────────────────────────────────┘   │
│ Description: full text, no truncate      │
├──────────────────────────────────────────┤
│ Live Transcript                     ●Live│
│ ┌────────────────────────────────────┐   │
│ │ AI: What emergency?               │   │
│ │ Caller: Earthquake at Hubli       │   │
│ │ AI: Any injuries?                 │   │
│ │ Caller: Ghost is injured          │   │
│ │ [Auto-scroll ▼]                   │   │
│ └────────────────────────────────────┘   │
├──────────────────────────────────────────┤
│ Timeline                                 │
│ ┌────────────────────────────────────┐   │
│ │ ● Resolved     10:45 AM           │   │
│ │ ● En Route     10:32 AM           │   │
│ │ ● Dispatched   10:30 AM           │   │
│ │ ○ Pending      10:28 AM           │   │
│ └────────────────────────────────────┘   │
├──────────────────────────────────────────┤
│ Location Map (~200px, single pin)        │
│ [Open in Maps →]                         │
└──────────────────────────────────────────┘
```

**States:**
- **Loading:** 3-4 shimmer blocks
- **Error:** ❌ + message + [Retry]
- **404:** "This emergency has been removed." + [Close]
- **Phone:** `<a href="tel:...">` with phone icon

### 3. Map View (full-screen)

Full-page Leaflet + OpenStreetMap with marker clustering (`leaflet.markercluster`).

- **Markers:** 24px colored circles (red/orange/yellow/gray) with white center dot + pulse animation for unresolved
- **Popup:** `[Critical] Fire — Status: Pending — 3 victims — [View Details →]`
- **Cluster:** Colored by highest severity, shows count
- **Controls:** Legend overlay, "Recenter" button, filter by severity/status
- **Empty:** Overlay "No incidents matching current filters"
- **Error:** ❌ + [Retry]

### 4. Stats View

Recharts cards: Total count, by-severity bar chart, by-type pie chart, avg response time.

- **Loading:** Shimmer stat rectangles
- **Empty:** "No data yet"

---

## Component Tree

```
App
├── Header — Logo, LiveIndicator, StatsBar mini-cards
├── Sidebar (desktop) / BottomTab (mobile)
│   └── NavItem — Feed(●List) / Map(●Map) / Stats(●BarChart3)
├── FeedView
│   ├── FeedFilter — severity chips + sort toggle
│   ├── EmergencyList
│   │   └── EmergencyCard[] — severity badge, status badge, caller, location, victims
│   ├── EmptyState / LoadingSkeleton / ErrorState
├── MapView
│   ├── EmergencyMap — Leaflet, clusters, popups
│   ├── MapLegend / MapFilter / EmptyState / ErrorState
├── StatsView
│   ├── StatCard[] / SeverityChart / TypeChart / EmptyState
├── EmergencyDetail (slide-over / full modal)
│   ├── StatusHeader — badge + contextual actions
│   ├── CallerInfo / IncidentDetails / LiveTranscript / StatusTimeline / MiniMap
│   ├── LoadingSkeleton / ErrorState
├── ConfirmDialog — status change: "Mark as dispatched?"
├── Toast — error/success notifications
└── useEmergencyFeed hook — WebSocket reconnect + message dispatch
```

---

## Data Flow

```
WebSocket /ws ──► useEmergencyFeed hook ──► EmergencyList / Detail / Map
                    │                          │
              {type, emergency_id,        click card
               status, chunk_text,            │
               data}                          ▼
                                         EmergencyDetail
                                              │
                                         StatusActions
                                              │
                                         PATCH /api/emergencies/:id/status
                                              │
                                         WS broadcasts update ──► feed auto-updates
```

### WS Messages

| Type | Payload | Action |
|------|---------|--------|
| `new_emergency` | `{data: EmergencyOut}` | Prepend to feed, animate in, update count |
| `status_update` | `{emergency_id, status}` | Update card badge, refresh detail if open |
| `transcript_chunk` | `{emergency_id, chunk_text, is_final}` | Append to LiveTranscript |
| `transcript_complete` | `{emergency_id}` | Mark transcript done |

### Reconnect

Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s (cap). On reconnect: `GET /api/emergencies/recent`. Banner: "Reconnected" (auto-dismiss 3s).

---

## API Integration

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/emergencies` | Fetch all |
| GET | `/api/emergencies/recent?limit=N&offset=N` | Paginated feed |
| GET | `/api/emergencies/:id` | Single detail |
| PATCH | `/api/emergencies/:id/status` | Update status |
| DELETE | `/api/emergencies/:id` | Delete |
| POST | `/api/transcript/chunk` | Live transcript chunk |
| POST | `/api/transcript/complete` | Final transcript webhook |
| GET | `/api/transcript/:id/chunks` | List chunks |
| WS | `/ws` | Real-time events |

---

## Component States Matrix

| Component | Loading | Empty | Error | Normal | Edge Cases |
|-----------|---------|-------|-------|--------|------------|
| EmergencyList | 3× shimmer | ShieldCheck + msg | ❌+Retry | Scrollable cards | WS arrival queue, scroll position |
| EmergencyCard | — | — | — | Severity+status+details | line-clamp-2, null fields hidden |
| EmergencyDetail | Shimmer blocks | — | ❌+Retry | 5 sections | 404 stale, WS live update |
| EmergencyMap | Leaflet default | Overlay msg | ❌+Retry | Markers+clusters | Cluster >100, empty filters |
| LiveTranscript | "Waiting..." | "Waiting..." | "Conn lost" | Speaker lines | Auto-scroll toggle |
| StatusTimeline | Single dot | Single dot | — | Color dots+lines | Single vs full timeline |
| StatsGrid | Shimmer rects | "No data" | ❌+Retry | Charts | Zero values, large numbers |
| FeedFilter | Disabled | Disabled | Enabled | Active chips | All off = show all |
| MiniMap | Spinner | Gray placeholder | "Unavailable" | Single marker | Coords missing = text only |
| ConfirmDialog | Loading btn | — | Error toast | Confirmation | Double-click guard |

---

## Animations

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| New card arrival | slideIn(-20px→0) + blue flash | 400ms | ease-out |
| Detail open | slideRight(→0) | 300ms | ease-out |
| Detail close | slideRight(←0) | 250ms | ease-in |
| Mobile modal | slideUp(↓→0) | 300ms | ease-out |
| Status badge | pulse + color transition | 300ms | ease-out |
| Skeleton shimmer | opacity 0.4↔1 | 1.5s | linear |
| Toast | slideDown + fade | 300ms | ease-out |
| Marker pulse | scale(1→1.15→1) | 2s | infinite |

All disabled when `prefers-reduced-motion: reduce`.

---

## Accessibility

- Keyboard: Tab through feed, Enter/Space open detail, Esc close
- Focus trap in detail panel when open
- `role="log"` `aria-live="polite"` on feed for WS updates
- `role="status"` on status change announcements
- Color + text label for severity/status (never color alone)
- WCAG AA contrast (4.5:1 text, 3:1 large)
- Touch targets ≥ 44×44px
- `focus-visible:ring-2` on all interactive elements
- Semantic HTML (`<nav>`, `<main>`, `<section>`, `<button>`)

---

## Build Sequence

| Step | What | Depends On |
|------|------|------------|
| 1 | Vite + React + TS + Tailwind + shadcn init (`npx shadcn@latest add dashboard-01`) | — |
| 2 | Layout shell: Header, Sidebar, routing (Feed/Map/Stats) | 1 |
| 3 | EmergencyCard + EmergencyList + severity/status badges | 2 |
| 4 | FeedFilter (severity chips + sort) | 3 |
| 5 | useEmergencyFeed hook (WebSocket) → live list updates | 3 |
| 6 | LoadingSkeleton + EmptyState | 3 |
| 7 | EmergencyDetail panel (all 5 sections) | 3 |
| 8 | StatusActions + ConfirmDialog + PATCH | 7 |
| 9 | StatusTimeline component | 7 |
| 10 | LiveTranscript (WS transcript_chunk events) | 7 |
| 11 | MiniMap (Leaflet, single pin, read-only) | 7 |
| 12 | EmergencyMap (full-screen, clusters, popups) | 3 |
| 13 | MapFilter + MapLegend | 12 |
| 14 | StatsGrid (cards + recharts) | 3 |
| 15 | Error states (all views) | 3,7,12,14 |
| 16 | Responsive (mobile bottom tabs, full modal) | 2-15 |
| 17 | Animations + transitions | 3,7 |
| 18 | Accessibility audit | 1-17 |
| 19 | Toast notifications | 2 |

---

## Pre-Delivery QA Checklist

- [ ] No emoji icons — all Lucide React SVG
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover transitions 150-300ms ease-out
- [ ] Text contrast ≥ 4.5:1 (WCAG AA)
- [ ] `focus-visible:ring-2` on all interactive
- [ ] `prefers-reduced-motion` disables all animations
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] `aria-label` on all interactive elements
- [ ] Touch targets ≥ 44×44px
- [ ] Disabled = `opacity-50 cursor-not-allowed`
- [ ] Skeleton loading on every async fetch
- [ ] Empty states with message (no blank screens)
- [ ] Error states with message + Retry
- [ ] Long text `line-clamp-2` on cards
- [ ] Null fields hidden (no "N/A")
- [ ] Status transitions: optimistic + revert on fail
- [ ] Debounced status actions (prevent double-click)
- [ ] Scroll position preserved on WS card arrival

---

## Dark Mode (future)

| Token | Light | Dark |
|-------|-------|------|
| Background | `#F8FAFC` | `#0F172A` |
| Surface | `#FFFFFF` | `#1E293B` |
| Border | `#E2E8F0` | `#334155` |
| Text | `#0F172A` | `#F8FAFC` |
| Danger | `#DC2626` | `#EF4444` |

Tailwind `dark:` variant + `prefers-color-scheme` + localStorage toggle.

---

## Design Principles

1. **Clarity over creativity** — high-stakes dispatch, every pixel serves a purpose
2. **Progressive disclosure** — summary on card, full detail in panel, never overwhelm
3. **Status at a glance** — color + text + position, dispatchers know state without reading
4. **Forgiving interactions** — confirm before destructive, optimistic update, revert on fail
5. **Offline resilience** — never blank screen, degrade gracefully, auto-recover
6. **Performance** — memoized components, stable references, no unnecessary re-renders
7. **Accessibility** — keyboard-navigable, screen-reader friendly, reduced-motion variant

---

*Design spec for SAVIOR Frontend v1 — Pro Max level (UI/UX Pro Max validated)*
