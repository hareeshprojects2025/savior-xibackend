# Phase 4 — UI Review: Dashboard Views

**Audited:** 2026-07-12
**Baseline:** UI-SPEC.md (design contract) + abstract 6-pillar standards
**Screenshots:** Captured (desktop 1440×900, tablet 768×1024, mobile 375×812; plus map, stats, transcriptions routes)
**Files Audited:** 25 source files (components, pages, styles, types)

---

## Score Summary

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Good contract copy adherence; minor truncation of live transcript empty state text |
| 2. Visuals | 3/4 | Strong layout fidelity; dark panel in EmergencyCard breaks visual consistency; missing animations |
| 3. Color | 3/4 | Token system implemented with minor hex deviations from spec; hardcoded chart/map colors |
| 4. Typography | 2/4 | Font family deviates from spec (Geist vs Inter); arbitrary values `text-[10px]` and `text-[11px]` used |
| 5. Spacing | 4/4 | Closely follows 4px spacing scale; only minor `space-y-2.5` deviation (10px instead of 8 or 12) |
| 6. Experience Design | 2/4 | State coverage gaps (no detail error state, no slide-in animations); no ARIA labels; silent catch in transcription fetch |
| **Overall** | **17/24** | **Solid implementation with notable spec deviations in typography and experience states** |

---

## Top 3 Priority Fixes

1. **ARIA labels and accessibility missing** — No `aria-label` on cards, buttons, or interactive elements. Feed list lacks `role="log"` and `aria-live="polite"`. Violates UI-SPEC §4.4. Add `aria-label` to all EmergencyCards, map markers, action buttons; add `role="log"` to EmergencyList container.

2. **EmergencyCard description missing line-clamp-2** — `EmergencyCard.tsx:112` renders full description without truncation, causing variable card heights. UI-SPEC §3.1 Edge Cases requires `line-clamp-2`. Add `line-clamp-2` to the description paragraph.

3. **Font family deviation (Geist vs Inter) + arbitrary font sizes** — `index.css` uses Geist/Geist Mono while UI-SPEC §1.2 specifies Inter/JetBrains Mono. `Sidebar.tsx:22` uses `text-[11px]` and `StatsGrid.tsx:230` uses `text-[10px]` — both arbitrary values outside the typography scale. Replace with scale values or update the design contract if Geist is intentional.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Strengths:**
- All UI-SPEC empty state copy matches: "No active emergencies" + "All clear." (EmergencyList.tsx:37-38) ✅
- "New reports will appear here in real-time" footnote present (EmergencyList.tsx:39) ✅
- Confirm dialog titles match spec: "Mark as ...?" pattern (EmergencyDetail.tsx:175) ✅
- Delete confirmation: "This action cannot be undone" (EmergencyDetail.tsx:187) ✅
- Map empty state: "No incidents to display" (EmergencyMap.tsx:126) ✅
- Stats empty: "No data yet" (StatsGrid.tsx:91) ✅
- LiveTranscript: "Waiting for transcript..." + "Listening..." states present ✅

**Weaknesses:**

| Finding | File:Line | Severity | Issue |
|---------|-----------|----------|-------|
| CW-01 | LiveTranscript.tsx:45 | **WARNING** | Empty state says "Waiting for transcript..." — UI-SPEC §3.2 specifies "Waiting for transcript from active call..." |
| CW-02 | TranscriptionPage.tsx:137 | **BLOCKER** | `.catch(() => {})` silently swallows full_transcript fetch errors — no user-facing error message |
| CW-03 | EmergencyCard.tsx:146 | **NOTE** | "Danger: Yes" is hardcoded text; if `immediate_danger` contains descriptive text, this prefix may be redundant |
| CW-04 | ConfirmDialog.tsx:45 | **NOTE** | Loading label "Processing..." is generic — consider matching action verb (e.g., "Dispatching...") |

**Copy Score Justification:** Copy is generally faithful to the design contract. The empty, error, and confirmation states follow the spec closely. Minor truncation in live transcript state and a silent catch in transcription fetch prevent a higher score.

---

### Pillar 2: Visuals (3/4)

**Strengths:**
- EmergencyCard layout matches UI-SPEC: severity accent bar (left border), INC badge, type, location, caller/victim info, action buttons ✅
- EmergencyDetail implements all 5 sections: StatusHeader, CallerInfo, IncidentDetails, LiveTranscript/Transcript, Timeline, MiniMap ✅
- StatusTimeline with color-coded dots and connecting vertical lines ✅
- Teardrop SVG markers on map with severity colors and white inner circles ✅
- FeedFilter severity chips with proper active/inactive states ✅
- StatsGrid layout with 4-column stat cards + 2×2 chart grid ✅

**Weaknesses:**

| Finding | File:Line | Severity | Issue |
|---------|-----------|----------|-------|
| VS-01 | EmergencyCard.tsx:95 | **WARNING** | Dark `bg-gray-900` section for Caller/Victim and Status creates harsh contrast against white card — breaks visual consistency |
| VS-02 | Header.tsx:36-57 | **NOTE** | Stats bar uses 4 different background colors (gray/red/amber/green) — visually busy for a fixed header at the top of every page |
| VS-03 | UI-SPEC §4.3 | **WARNING** | No `slideIn` animation for new card arrivals — spec requires 400ms ease-out slideIn + highlight flash |
| VS-04 | UI-SPEC §4.3 | **WARNING** | No slideRight animation on detail panel open — spec requires 300ms ease-out |
| VS-05 | index.css | **NOTE** | No `@keyframes slideIn` defined — all animations from UI-SPEC §4.3 table are missing from CSS |
| VS-06 | LiveTranscript.tsx:90-91 | **NOTE** | "Jump to bottom" button floats over content but has no backdrop/blur effect — could be hard to read on scrolling transcript |

**Visual Score Justification:** The visual structure is faithful to the spec and layout diagrams. However, the dark panel in the EmergencyCard creates an inconsistent visual style, and the complete absence of the specified animations (card slideIn, panel slideRight, filter chip scale) is noticeable.

---

### Pillar 3: Color (3/4)

**Strengths:**
- Design tokens defined in `index.css` using Tailwind v4 `@theme` syntax ✅
- Severity colors match spec: Critical `#DC2626`, High `#F59E0B`, Medium `#FBBF24` ✅
- Status colors: pending (amber), dispatched (blue), en_route (indigo), resolved (green) — consistent ✅
- Status badge colors use semantic bg/text/border classes ✅
- Accent bar on EmergencyCards uses severity colors ✅

**Weaknesses:**

| Finding | File:Line | Severity | Issue |
|---------|-----------|----------|-------|
| CL-01 | index.css:22 | **WARNING** | `--color-bg: #F0F2F5` deviates from spec `--bg: #F8FAFC` (different shade) |
| CL-02 | index.css:24 | **WARNING** | `--color-surface-hover: #F8FAFC` deviates from spec `--surface-hover: #F1F5F9` |
| CL-03 | index.css:14 | **WARNING** | `--color-success: #16A34A` deviates from spec `--success: #10B981` |
| CL-04 | index.css:7 | **WARNING** | `--color-danger-bg: #FEE2E2` deviates from spec `--danger-bg: #FEF2F2` |
| CL-05 | Multiple | **WARNING** | Hardcoded hex colors duplicate token values in EmergencyMap.tsx:14-17, StatsGrid.tsx:22-25, MiniMap.tsx:13 — should reference CSS variables |
| CL-06 | StatsGrid.tsx:28 | **NOTE** | TYPE_COLORS `["#0058be", ...]` includes `#0058be` which is not in the spec's color palette — undocumented color |

**Color Score Justification:** The token system is correctly set up in `index.css` and semantic classes are used throughout. However, multiple token values deviate from the UI-SPEC spec, and several components hardcode hex colors instead of referencing the tokens. The percentage of hardcoded colors relative to total color usage is moderate (~20% of color applications).

---

### Pillar 4: Typography (2/4)

**Strengths:**
- Font weight distribution: consistent use of font-medium (500), font-semibold (600), font-bold (700) ✅
- Section headers use consistent uppercase + tracking-widest pattern ✅
- Monospace (`cockpit-number` utility) used for timestamps, IDs, and numbers ✅
- Heading hierarchy roughly respected (larger font for page titles, smaller for sub-sections) ✅

**Weaknesses:**

| Finding | File:Line | Severity | Issue |
|---------|-----------|----------|-------|
| TY-01 | index.css:4-5 | **BLOCKER** | Font family is Geist/Geist Mono — UI-SPEC §1.2 specifies Inter/JetBrains Mono. This is a deliberate choice that should be reconciled with the spec or the spec updated |
| TY-02 | Sidebar.tsx:22 | **WARNING** | `text-[11px]` arbitrary value not in Tailwind scale or spec typography table; replace with `text-xs` (0.75rem) or add to spec |
| TY-03 | StatsGrid.tsx:230 | **WARNING** | `text-[10px]` arbitrary value below spec's smallest defined size (Badge: 0.6875rem ≈ 11px) |
| TY-04 | StatsGrid.tsx:46 | **NOTE** | `text-3xl` (1.875rem) used for stat numbers but not in UI-SPEC typography table — consider adding to spec as valid use case |
| TY-05 | EmergencyMap.tsx:78 | **NOTE** | `text-[10px]` arbitrary value for popup timestamp — should use `text-xs` or spec-approved size |
| TY-06 | AppLayout.tsx | **NOTE** | Body font-size is 16px (`index.css:40`) but spec says Body is 0.875rem (14px) — though 16px is better for readability this is a spec deviation |

**Typography Score Justification:** The font family deviation (Geist vs Inter) is a significant divergence from the design contract that needs reconciliation. The use of arbitrary font sizes (`[10px]`, `[11px]`) falls outside both the Tailwind scale and the spec's defined typography table. Three font sizes (xs, sm, base, lg, xl, 3xl) in active use is within the acceptable range, but the spec only defines 5 explicit sizes and these vary.

---

### Pillar 5: Spacing (4/4)

**Strengths:**
- Cards use p-4 (16px), p-5 (20px), p-6 (24px) — all on the 4px scale ✅
- Grid gaps: gap-2 (8px), gap-3 (12px), gap-4 (16px), gap-5 (20px) — all on scale ✅
- Margins: mt-2 (8px), mb-4 (16px), mt-0.5 (2px — acceptable sub-unit) ✅
- Layout padding: p-4, p-6 — consistent ✅
- Section spacing: space-y-5 (20px) in EmergencyDetail ✅
- Component spacing: space-y-2.5 (10px) in detail sections — minor deviation (10px not in 4px scale, not 8 or 12) ✅

**Weaknesses:**

| Finding | File:Line | Severity | Issue |
|---------|-----------|----------|-------|
| SP-01 | EmergencyDetail.tsx:87 | **NOTE** | `space-y-2.5` = 10px, which is not on the 4px spacing scale (spec §1.3: 4,8,12,16...); should be 8px (space-y-2) or 12px (space-y-3) |
| SP-02 | TranscriptionPage.tsx:191 | **NOTE** | `p-2` (8px) inside sidebar but outer container has `-mx-6 -mb-6` negative margins — functional but fragile |
| SP-03 | StatsPage.tsx:17 | **NOTE** | `max-w-[1600px]` is an arbitrary value — reasonable for dashboard max-width but not in spec |

**Spacing Score Justification:** The spacing implementation is very close to the spec. The 4px scale is respected across almost all components. The `space-y-2.5` (10px) deviation is minor and consistent across multiple components. No spacing values are egregiously wrong.

---

### Pillar 6: Experience Design (2/4)

**Strengths:**
- Loading states: FeedSkeleton for EmergencyList, Skeleton for StatsGrid, loading spinners for status actions ✅
- Empty states: All data views have empty states with Lucide icons + message ✅
- Error states: ErrorState with retry button on EmergencyList, EmergencyMap, StatsGrid ✅
- ConnectionBanner shows when WebSocket disconnects (FeedPage) ✅
- LiveTranscript auto-scroll + "Jump to bottom" button ✅
- ConfirmDialog loading states prevent double-clicks ✅
- Status transitions match possible status flow (pending→dispatched→en_route→resolved) ✅
- Null/hidden field handling: `victim_name`, `landmark`, `summary` conditionally rendered ✅
- MiniMap coordinates fallback (shows text-only when no coords) ✅

**Weaknesses:**

| Finding | File:Line | Severity | Issue |
|---------|-----------|----------|-------|
| EX-01 | UI-SPEC §4.4 | **BLOCKER** | No `aria-label` attributes found on any interactive element (cards, buttons, links) — violates WCAG accessibility requirement |
| EX-02 | UI-SPEC §4.4 | **BLOCKER** | No `role="log"` or `aria-live="polite"` on EmergencyList — screen readers won't announce new emergency arrivals |
| EX-03 | EmergencyCard.tsx:112 | **WARNING** | Description rendered without `line-clamp-2` — UI-SPEC §3.1 Edge Cases requires truncation to 2 lines; causes inconsistent card heights |
| EX-04 | UI-SPEC §3.2 | **WARNING** | No error state for EmergencyDetail (404/deleted) — spec shows "This emergency has been removed" with Close button |
| EX-05 | UI-SPEC §4.3 | **WARNING** | No card arrival animations (slideIn + highlight flash), no panel slideRight animation — all animations from spec missing |
| EX-06 | UI-SPEC §4.4 | **WARNING** | No `prefers-reduced-motion` media query handling — spec requires animations disabled for accessibility |
| EX-07 | TranscriptionPage.tsx:137 | **WARNING** | `.catch(() => {})` silently swallows errors from `full_transcript` API fetch — no toast or error state for user |
| EX-08 | MapPage.tsx:63 | **NOTE** | "Disconnected" badge shown instead of full ConnectionBanner pattern — different UX than FeedPage's retry button |
| EX-09 | UI-SPEC §4.2 | **NOTE** | `DetailSkeleton` component defined but not used — EmergencyDetail returns null instead of showing shimmer when no emergency selected |
| EX-10 | UI-SPEC §4.4 | **NOTE** | Touch target size for sidebar nav items may be under 44×44px on mobile — `w-11 py-2` could be too small |

**Experience Design Score Justification:** While the basic state machine (loading/empty/error) is implemented for most views, critical accessibility gaps (no ARIA labels, no live regions), missing error states in the detail panel, and the complete absence of all specified animations significantly degrade the user experience. The silent error handling in transcription fetch is a data loss vector.

---

## Full Findings Table

| ID | Pillar | Severity | File:Line | Issue | Recommendation |
|----|--------|----------|-----------|-------|----------------|
| CW-01 | Copywriting | WARNING | LiveTranscript.tsx:45 | "Waiting for transcript..." should be "Waiting for transcript from active call..." per spec | Update string to match UI-SPEC §3.2 |
| CW-02 | Copywriting | BLOCKER | TranscriptionPage.tsx:137 | Silent `.catch(() => {})` — no user-facing error on full_transcript fetch | Add toast or inline error state with retry |
| VS-01 | Visuals | WARNING | EmergencyCard.tsx:95 | Dark `bg-gray-900` section against white card creates harsh contrast | Use light bg (bg-gray-50) or match card surface color |
| VS-03 | Visuals | WARNING | UI-SPEC §4.3 | No slideIn animation on new card arrivals | Add CSS `@keyframes slideIn` and apply to new cards via animation class |
| VS-04 | Visuals | WARNING | UI-SPEC §4.3 | No slideRight animation on detail panel open | Add transition to detail panel container |
| CL-01 | Color | WARNING | index.css:22 | `--color-bg: #F0F2F5` ≠ spec `#F8FAFC` | Align token or update spec |
| CL-03 | Color | WARNING | index.css:14 | `--color-success: #16A34A` ≠ spec `#10B981` | Align token or update spec |
| CL-05 | Color | WARNING | EmergencyMap.tsx:14-17 | Hardcoded hex colors duplicate token values | Reference CSS variables or shared constants |
| CL-06 | Color | NOTE | StatsGrid.tsx:28 | Undocumented `#0058be` color in TYPE_COLORS | Add to spec palette or use existing tokens |
| TY-01 | Typography | BLOCKER | index.css:4-5 | Font family Geist ≠ spec Inter/JetBrains Mono | Reconcile: either switch to Inter or update spec to document Geist as intentional |
| TY-02 | Typography | WARNING | Sidebar.tsx:22 | `text-[11px]` arbitrary value | Replace with `text-xs` (0.75rem) |
| TY-03 | Typography | WARNING | StatsGrid.tsx:230 | `text-[10px]` below spec minimum badge size (11px) | Use `text-xs` or define 10px in spec |
| SP-01 | Spacing | NOTE | EmergencyDetail.tsx:87 | `space-y-2.5` (10px) not on 4px spacing scale | Use `space-y-2` (8px) or `space-y-3` (12px) |
| EX-01 | Experience | BLOCKER | Multiple | No `aria-label` on interactive elements | Add `aria-label` to all buttons, cards, and interactive elements |
| EX-02 | Experience | BLOCKER | EmergencyList.tsx | No `role="log"` or `aria-live="polite"` | Add `role="log" aria-live="polite"` to feed list container |
| EX-03 | Experience | WARNING | EmergencyCard.tsx:112 | Description missing `line-clamp-2` truncation | Add `line-clamp-2` class to description paragraph |
| EX-04 | Experience | WARNING | EmergencyDetail.tsx | No 404/deleted error state | Add "This emergency has been removed" state per UI-SPEC §3.2 |
| EX-06 | Experience | WARNING | index.css | No `prefers-reduced-motion` query | Add `@media (prefers-reduced-motion)` to disable animations |
| EX-07 | Experience | WARNING | TranscriptionPage.tsx:137 | Silent catch on full_transcript fetch | Replace with error state or toast notification |

---

## Registry Safety Audit

**Status:** shadcn initialized (`components.json` exists), but `"registries": {}` is empty — no third-party registries configured.

- All UI components use official `@base-ui/react` packages (shadcn v4 base)
- No third-party blocks were installed from external registries
- No registry safety flags to report

**Verdict:** ✅ Clean — no third-party registries to audit.

---

## Files Audited

| # | File | Lines | Role |
|---|------|-------|------|
| 1 | `frontend/src/index.css` | 54 | Design tokens, theme, base styles |
| 2 | `frontend/src/App.tsx` | 20 | Route configuration |
| 3 | `frontend/src/components/layout/AppLayout.tsx` | 18 | Layout shell |
| 4 | `frontend/src/components/layout/Header.tsx` | 60 | Header with stats bar |
| 5 | `frontend/src/components/layout/Sidebar.tsx` | 35 | Navigation sidebar |
| 6 | `frontend/src/pages/FeedPage.tsx` | 81 | Feed view (default route) |
| 7 | `frontend/src/pages/MapPage.tsx` | 103 | Map view |
| 8 | `frontend/src/pages/StatsPage.tsx` | 60 | Statistics view |
| 9 | `frontend/src/pages/TranscriptionPage.tsx` | 295 | Transcription view |
| 10 | `frontend/src/components/feed/EmergencyCard.tsx` | 164 | Emergency card |
| 11 | `frontend/src/components/feed/EmergencyList.tsx` | 56 | Scrollable list |
| 12 | `frontend/src/components/feed/FeedFilter.tsx` | 55 | Severity/sort filter |
| 13 | `frontend/src/components/detail/EmergencyDetail.tsx` | 195 | Detail panel |
| 14 | `frontend/src/components/detail/MiniMap.tsx` | 52 | Mini map |
| 15 | `frontend/src/components/detail/LiveTranscript.tsx` | 96 | Live transcript |
| 16 | `frontend/src/components/detail/StatusTimeline.tsx` | 52 | Status timeline |
| 17 | `frontend/src/components/detail/StatusActions.tsx` | 37 | Status action buttons |
| 18 | `frontend/src/components/detail/ConfirmDialog.tsx` | 51 | Confirmation dialog |
| 19 | `frontend/src/components/map/EmergencyMap.tsx` | 177 | Full map with markers |
| 20 | `frontend/src/components/map/MapFilter.tsx` | 46 | Map legend + filter |
| 21 | `frontend/src/components/stats/StatsGrid.tsx` | 275 | Statistics grid + charts |
| 22 | `frontend/src/components/common/EmptyState.tsx` | 23 | Empty state template |
| 23 | `frontend/src/components/common/ErrorState.tsx` | 43 | Error state template |
| 24 | `frontend/src/components/common/LoadingSkeleton.tsx` | 68 | Skeleton templates |
| 25 | `frontend/src/lib/types.ts` | 78 | TypeScript types |
| — | `.planning/UI-SPEC.md` | 781 | Design contract (baseline) |
