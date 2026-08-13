# SAVIOR — Setup Guide

Step-by-step bring-up of a full local SAVIOR environment: MySQL → backend → frontend → Bolna agents → Twilio. Orientation & architecture are in [ONBOARDING.md](./ONBOARDING.md).

---

## 0. Prerequisites

| Tool | Version |
|---|---|
| Python | 3.11+ (3.14 also works for tests) |
| Node.js | 20+ |
| MySQL | 8.0 (Windows service named `MySQL80`, on `localhost:3306`) |
| git | any recent |

External accounts (needed only for live calls/SMS; the system runs without them for local testing):

- **Bolna** AI account (inbound + outbound agent)
- **Twilio** (SMS for location-capture links)
- **ngrok** (expose the local backend to Bolna)

---

## 1. Create the database

```sql
CREATE DATABASE IF NOT EXISTS savior_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

All tables are auto-created on first backend startup (`Base.metadata.create_all` in `backend/app/main.py`), plus startup ALTERs to add any newer columns. No manual schema SQL needed.

---

## 2. Configure the backend environment

```bash
cd backend
copy .env.example .env
```

Edit `.env`:

```ini
DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/savior_db

# Bolna AI agents
BOLNA_API_TOKEN=bn-your_bolna_api_token_here
BOLNA_AGENT_ID=your_inbound_agent_id_here
BOLNA_DISPATCH_AGENT_ID=your_dispatch_agent_id_here

# Shared secret for the dispatch ACK webhook (see §5.3)
BOLNA_WEBHOOK_SECRET=your_shared_webhook_secret_here

# Max seconds to wait for the transcript-complete webhook before force-dispatch (fail-open)
INBOUND_CALL_MAX_WAIT_SECONDS=180

# Twilio SMS (location capture links)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Public base URL for SMS location links (use your ngrok URL when testing Bolna)
BASE_URL=http://localhost:8000
```

> `.env` is gitignored — secrets never enter the repo. Only `.env.example` (placeholders) is committed.

---

## 3. Install backend dependencies & seed stations

Use the project venv (`thor`, at repo root). From the repo root:

```bash
thor\Scripts\pip install -r backend\requirements\dev.txt
```

Seed the stations once (40 stations across Hubli/Dharwad — police, fire, medical, rescue). The dispatch pipeline needs them:

```bash
cd backend
..\thor\Scripts\python -m app.seed_stations
```

---

## 4. Run the backend

```bash
cd backend
..\thor\Scripts\uvicorn app.main:app --reload
```

- API / Swagger: http://localhost:8000/docs
- The escalation sweeps start automatically (logged `Escalation sweep started`).
- **When debugging live webhooks, start a *fresh* process** — `--reload` doesn't always swap reloaded modules for webhook handlers. Fully stop, then start again.

Run the backend test suite to confirm the environment:

```bash
cd backend
python -m pytest tests -q
```

---

## 5. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard: http://localhost:5173

Frontend typecheck (note pre-existing errors in `StatsGrid.tsx` / `DispatchPage.tsx` are expected):

```bash
cd frontend
npx tsc -b --noEmit
```

---

## 6. Configure the Bolna agents (live calls)

### 6.1 Expose the backend with ngrok

```bash
ngrok http 8000
```

Use the generated HTTPS URL (e.g. `https://xxxx.ngrok-free.dev`) everywhere below. If the URL changes, update the custom-function URLs again.

### 6.2 Inbound agent (victim calls)

- System prompt: contents of `bolna-agent/prompts/system-prompt.md`. Keep the rules verbatim — especially *call `post_api_emergency` early*, then update once more reusing the **same** `call_id`, and the transcript-dedup note.
- `post_api_emergency` custom function (`bolna-agent/custom-functions/post-emergency.json`):
  - URL → `https://<ngrok-url>/api/emergency`
  - Keep `call_id` param → it becomes `bolna_call_id` in the record.

### 6.3 Outbound dispatch agent (station calls)

- System prompt: `bolna-agent/prompts/station-ack-prompt.md`. Keep every `{{user_data.*}}` placeholder **verbatim** — they are filled at call time from the backend's `user_data` payload.
- `station_ack_response` custom function (`bolna-agent/custom-functions/station-ack.json`):
  - URL → `https://<ngrok-url>/api/dispatch/ack`
  - Keep `dispatch_record_id` and `call_id` in the parameter schema — the backend matches ACK webhooks by them.
  - Header `Authorization: Bearer <BOLNA_WEBHOOK_SECRET>` — **must equal** `backend/.env` `BOLNA_WEBHOOK_SECRET` (see §6.4).

### 6.4 The ACK webhook secret

`BOLNA_WEBHOOK_SECRET` authenticates `POST /api/dispatch/ack` so **only** the dispatch agent can change dispatch state.

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Set the **same** value in both places:

1. `backend/.env` → `BOLNA_WEBHOOK_SECRET=<value>`
2. Bolna dashboard → outbound agent → `station_ack_response` → Header `Authorization: Bearer <value>`
   (the header must be exactly `Bearer ` + the value, **including the `Bearer ` prefix** — a bare token is rejected with HTTP 401)

If you see repeated `401 Unauthorized` on `/api/dispatch/ack`, it's almost always this header (missing `Bearer `, placeholder `YOUR_BOLNA_WEBHOOK_SECRET`, or a mismatched value).

---

## 7. Test the full flow

### 7.1 Simulate an emergency via the API (no phones needed)

```bash
curl -X POST http://localhost:8000/api/emergency \
   -H "Content-Type: application/json" \
   -d '{"caller_name":"Harish","caller_phone":"+919876543210","emergency_type":"Fire","severity":"Medium","location":"House No. 45, MG Road, Dharwad","victims":3,"description":"Fire with smoke.","immediate_danger":"Smoke"}'
```

Watch it appear in the dashboard Feed/Map in real time.

### 7.2 Test the inbound agent end-to-end

1. Backend running + ngrok up + inbound agent custom-function URL set.
2. Place a call to the inbound agent.
3. Confirm logs: `Bolna webhook: ... status=initiated/ringing/in-progress`, live transcript chunks, then `Matched by ... → emergency id=...` on hang-up.
4. The final `transcript/complete` webhook for a re-fired call logs `Matched by identical stored transcript` + `duplicate terminal webhook, acknowledging` — that's correct dedup, not an error.

### 7.3 Test the outbound agent end-to-end (IMPORTANT)

**Never test the outbound agent from the Bolna dashboard alone.** A dashboard-run call carries no `user_data`, so the agent has nothing to read and the backend logs `Dispatch record not found` — expected, not a bug.

Always drive it from the backend:

1. Create an emergency (so a dispatch record exists).
2. The backend calls Bolna with `user_data` → log `Bolna outbound call placed: ... station=...`.
3. The agent reads the incident and calls the station for a verbal ACK.
4. The ACK arrives → log `ACK webhook raw body: ...` then `Dispatch X acknowledged by station Y`.

If the ACK is never recorded, check the backend log for `Orphan ACK webhook` (webhook arrived but no dispatch record matched) or `401` (webhook secret mismatch).

---

## 8. Data files the backend needs

| File | Purpose |
|---|---|
| `backend/data/districts.geojson` | Coverage boundaries for the district check |
| `backend/data/hubli-dharwad.graphml` | OSMnx road graph for ETA ranking. If missing, routing downloads it automatically on first use (see §8.1). |

### 8.1 Create `hubli-dharwad.graphml` (the road graph)

The routing pipeline uses an OSMnx road network for Hubli-Dharwad to compute drive-time ETA and rank stations. Two ways to get it:

**Option A — let the backend build it automatically (recommended).**

`backend/app/services/routing_service.py` checks for the file at `backend/data/hubli-dharwad.graphml`. If it's absent, it downloads OSM data for *Dharwad district, Karnataka, India*, adds edge speeds + travel times, and saves the graph to that path on first use:

```python
G = ox.graph_from_place("Dharwad district, Karnataka, India", network_type="drive")
G = ox.add_edge_speeds(G)
G = ox.add_edge_travel_times(G)
ox.save_graphml(G, GRAPHML_PATH)   # backend/data/hubli-dharwad.graphml
```

So you can simply trigger it once after installing dependencies (needs internet + `osmnx` installed):

```powershell
cd backend
thor\Scripts\python -c "from app.services.routing_service import _load_graph; print(_load_graph())"
```

This logs `OSMnx graph downloaded and cached (... nodes, ... edges)` and writes the `.graphml` (~45 MB). You'll also see `Loaded OSMnx graph from cache` on subsequent startups.

**Option B — build it manually (no internet at runtime / precise control).**

```powershell
thor\Scripts\pip install osmnx networkx
thor\Scripts\python -c "import osmnx as ox; G = ox.graph_from_place('Dharwad district, Karnataka, India', network_type='drive'); G = ox.add_edge_speeds(G); G = ox.add_edge_travel_times(G); ox.save_graphml(G, 'backend/data/hubli-dharwad.graphml')"
```

**Notes**
- The default query downloads the **entire Dharwad district**, which is large and slow. For a faster/lighter graph you can restrict to a radius around a point instead (e.g. Dharwad city center). Note a single radius won't span both Hubli and Dharwad — use a larger `dist` or `graph_from_bbox` if you need both:
  ```python
  G = ox.graph_from_point((15.4589, 75.0078), dist=15000, network_type="drive")
  ```
- The file is **large (~45 MB) and untracked in git** — don't commit it; keep it local (or gitignore it).
- If the graph fails to load or download, `compute_route` falls back to a Haversine straight-line distance, so ranking still works with less accurate ETA.

---

## 9. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `401` on `/api/dispatch/ack` | ACK header missing `Bearer ` prefix, still placeholder, or value ≠ `.env`. See §6.4. |
| Duplicate emergencies from one call | Should be fixed by transcript-dedup; if it recurs, the two terminal webhooks didn't share an identical transcript string. |
| Emergency stuck `outside_coverage` / `pending_manual_review` | A far-away text geocode was rejected (>200 km gate); caller must submit real GPS via the location link. |
| `Bolna /call HTTP 404: Wallet balance is low` | Bolna wallet out of credit — recharge on the Bolna dashboard (operational, not code). |
| `Matched by no-transcript fallback` in logs | Normal: strategy 4 catches a call that created a mid-call record but wasn't matched by `call_id`/phone. |
| Frontend typecheck errors in `StatsGrid.tsx` / `DispatchPage.tsx` | Known pre-existing issues — don't fix casually. |

---

## 10. Next steps

- Read [ONBOARDING.md](./ONBOARDING.md) for architecture and the dispatch pipeline.
- Read [AGENTS.md](./AGENTS.md) for project memory and hard-won decisions.
- See [README.md](./README.md) for the full API reference and usage examples.
