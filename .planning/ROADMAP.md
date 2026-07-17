# SAVIOR — Roadmap

## Milestone 1: Core Infrastructure (MVP)

Goal: End-to-end working system — Bolna creates emergencies, dispatcher sees them live.

### Phase 1 — Backend Enhancements ✅

**Status:** Complete (commit 20d8d52)

Add emergency status lifecycle, transcript ingestion, WebSocket broadcasting, and DELETE capability.

| Task | File(s) |
|------|---------|
| Emergency model: add status enum + full_transcript | `models/emergency.py` |
| Emergency schemas: EmergencyStatus, EmergencyUpdate | `schemas/emergency.py` |
| Emergency service: update_emergency(), delete_emergency() | `services/emergency_service.py` |
| PATCH /api/emergencies/{id}/status | `api/v1/endpoints/emergency.py` |
| DELETE /api/emergencies/{id} | `api/v1/endpoints/emergency.py` |
| TranscriptChunk model | `models/transcript.py` |
| Transcript schemas | `schemas/transcript.py` |
| Transcript service (store_chunk, complete_transcript) | `services/transcript_service.py` |
| POST /api/transcript/chunk + /api/transcript/complete | `api/v1/endpoints/transcript.py` |
| WebSocket /ws with ConnectionManager.broadcast() | `core/websocket.py`, `main.py` |

**Dependencies:** MySQL DB with savior_db, .env configured, thor venv with deps installed.

**Notes:**

- ✅ Webhook `/api/transcript/complete` accepts all Bolna status payloads (200 OK, retries stopped)
- ✅ Chunk endpoint accepts both `/transcript/chunk` and `/transcript_chunk` (underscore alias)
- ⚠️ Chunk/transcript matching by `bolna_call_id` deferred — see KL-01/KL-02 in REQUIREMENTS.md

---

### Phase 2 — Bolna Agent Configuration

**Goal:** Connect Bolna AI voice agent to the backend.

| Task | Detail |
|------|--------|
| Upload send-transcript-chunk custom function | Config exists at `bolna-agent/custom-functions/send-transcript-chunk.json` |
| Test POST /api/emergency from Bolna | `post-emergency.json` already uploaded per collaborator |
| Set Analytics webhook URL | Points to POST /api/transcript/complete |
| Verify system prompt | Includes transcript instructions at `bolna-agent/prompts/system-prompt.md` |

**Dependencies:** Phase 1 (backup running), Bolna dashboard access.

---

### Phase 3 — Frontend Scaffold

**Goal:** Initialize the Vite + React project with all tooling configured.

| Task | Detail |
|------|--------|
| `npm create vite frontend -- --template react-ts` | Initialize project |
| Install Tailwind CSS + configure | `npm install -D tailwindcss @tailwindcss/vite` |
| Install shadcn/ui | `npx shadcn@latest init` |
| Install core deps | `react-router-dom`, `lucide-react`, `leaflet`, `react-leaflet`, `recharts` |
| Configure path aliases | `@/` -> `src/` |
| Set up custom theme | Colors, fonts, severity/status tokens per STITCH.md |
| Create basic layout shell | Header, Sidebar, Main Content placeholder |

**Dependencies:** Node.js 18+, npm.

---

### Phase 4 — Dashboard Views ✅

**Goal:** Polish and refine the map experience and transcription viewer.

**Plans:** 1 plan (6 waves, 11 tasks)

**Dependencies:** Phase 3.

**Sub-plans:**

- [x] A — Critical bug fixes (CR-01, CR-02, CR-04, WR-05) ✅
- [x] B — Map enhancements + MiniMap ✅
- [x] C — Transcription + polish (D-07 through D-11, WR fixes, vitest) ✅

**Plans:**

- [x] 04-01-PLAN.md — Wave 1 (bug fixes) complete ✅
- [x] B-SUMMARY.md — Map enhancements complete ✅
- [x] C-SUMMARY.md — Transcription + polish complete ✅

---

### Phase 5 — Polish

**Goal:** Production-ready fit and finish.

| Task | Detail |
|------|--------|
| Loading states | Skeletons for all data-dependent views |
| Empty states | Illustration + message for feed and map |
| Error states | Error banner + retry button |
| Responsive layout | Mobile (feed full-width, detail as modal), tablet (60/40), desktop (sidebar) |
| WebSocket reconnect | Automatic with exponential backoff |
| Debounce rapid clicks | Prevent double-status updates |
| Long text truncation | CSS ellipsis on cards |
| Transition animations | Smooth card entry, panel slide, status change flash |

**Dependencies:** Phase 4.

---

### Phase 7 — Testing & Documentation

**Goal:** Verified quality and deployment-ready docs.

| Task | Detail |
|------|--------|
| Backend tests | pytest for all endpoints (status, transcript, CRUD) |
| Frontend tests | Vitest + React Testing Library for components |
| README finalization | Full setup, architecture, deployment guide |
| Docker verification | docker-compose up works end-to-end |
| Linting | ESLint + Ruff configured and passing |
| Type checking | TypeScript strict mode + mypy for Python |

**Dependencies:** Phase 6 (Dispatch Engine).

---

## Milestone 2: Production Hardening (v2)

| Phase | Idea |
|-------|------|
| P7 | Authentication (dispatcher login + session) |
| P8 | Alert rules (auto-notify on critical severity) |
| P9 | Deployment (Docker Compose with reverse proxy) |
| P10 | Historical data views, export, reporting |

---

## Visual Timeline

```
Milestone 1 (MVP)
├── Phase 1: Backend — ✅ Done
├── Phase 2: Bolna — ⏳ Pending
├── Phase 3: Scaffold — ⏳ Pending
├── Phase 4: Dashboard — ✅ Done
├── Phase 5: Polish — ⏳ Pending
├── Phase 6: Dispatch Engine — ⏳ Pending
└── Phase 7: Testing & Documentation — ⏳ Pending
Milestone 2 (v2)
└── Phases 8–10 — Future
```

### Phase 6 — Dispatch Engine 🚧

**Goal:** Automated emergency call processing — incident validation, district check, duplicate detection, location capture via SMS, station ranking and routing, dispatch execution with ACK tracking via Bolna agent.

**Depends on:** Phase 5 (Polish)

**Plans:** 4 sub-plans

| Plan | Wave | Focus | Depends On |
|------|------|-------|------------|
| A | 1 | Backend Foundation (models, services, seed data) | — |
| B | 2 | Dispatch Pipeline + API Endpoints | A |
| C | 3 | Frontend Dispatch Panel + UI | B |
| D | 4 | ACK + Bolna Integration + Escalation | C |

Plans:
- [x] A — Backend Foundation (Station model, DispatchRecord, core services)
- [x] B — Dispatch Pipeline + API (orchestration, endpoints, location capture)
- [x] C — Frontend Dispatch Panel (DispatchPage, components, hooks)
- [x] D — ACK + Bolna Integration (MessageService, escalation, timers, Bolna agent config)

---

*Last updated: 2026-07-17*
