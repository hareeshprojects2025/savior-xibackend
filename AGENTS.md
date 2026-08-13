# SAVIOR Project Memory

Stack: FastAPI backend (`backend/`, MySQL, `Base.metadata.create_all` + startup ALTERs in `app/main.py`), React+TS frontend (`frontend/`), two Bolna AI agents (inbound victim calls, outbound station dispatch) configured via files in `bolna-agent/`.

Commands: backend tests `cd backend && python -m pytest tests -q`; frontend typecheck `cd frontend && npx tsc -b --noEmit` (pre-existing errors live in `StatsGrid.tsx` and `DispatchPage.tsx` — do not "fix" them casually).

## Persistent notes

### Bolna dispatch agent — how emergency details reach it
The outbound agent does NOT fetch data (no GET). Backend POSTs to `https://api.bolna.ai/call` with
`agent_id`, station phone, and the incident embedded in `user_data` (`message_service.py`). Bolna
template-injects those into the system prompt via single-brace `{field}` placeholders whose names
match the `user_data` keys exactly (`bolna-agent/prompts/station-ack-prompt.md`). Keep the prompt
free of hardcoded example data.

### Bolna ACK webhook secret (`BOLNA_WEBHOOK_SECRET`)
- **Purpose:** authenticates POST /api/dispatch/ack so only Bolna's dispatch agent can change
  dispatch state (emergency → dispatched, or rejected/escalated). Without it, anyone with the
  public ngrok URL could forge fake `acknowledged` or `rejected` webhooks.
- **Generate (not issued by anyone):**
  `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- **Set the same value in 2 places:**
  1. `backend/.env` → `BOLNA_WEBHOOK_SECRET=<value>` (backend 401s webhooks without it)
  2. Bolna dashboard → outbound dispatch agent → `station_ack_response` custom function →
     Header `Authorization: Bearer <value>` (placeholder in
     `bolna-agent/custom-functions/station-ack.json`)
- **Safety:** bearer shared secret over HTTPS; keep out of git; separate secret per environment;
  authenticates sender only (no payload integrity) — upgrade to HMAC payload signing if the
  endpoint ever goes fully public.

### Dispatch pipeline design decisions (keep when extending)
- **Inbound-call gate:** emergencies created with `bolna_call_id` (live victim call) defer
  auto-dispatch to `awaiting_call_complete` with `call_wait_deadline` (default 180s,
  `INBOUND_CALL_MAX_WAIT_SECONDS`). The `transcript-complete` webhook releases the gate and
  auto-dispatches; the sweep loop force-releases on lost webhooks (fail-open). Manual dispatch
  during a live call is hard-blocked (HTTP 423) and UI-locked.
- **Call placement:** 3× retry with backoff, then `DispatchCallError` → `call_error` + SMS
  fallback to the station (never a silent simulated ACK). Call lifecycle
  (ringing/connected/…) is polled from Bolna executions and broadcast as `dispatch_update`
  with `call_status`.
- **Escalation:** 600s window (unchanged), `ack_deadline` persisted on DispatchRecord; in-process
  timer + 60s sweep recover timers lost on restart. `station_name` is always derived server-side,
  never trusted from the LLM webhook.
- **Transcript-complete idempotency:** the inbound agent's `call_id` (stored as `bolna_call_id`)
  is an LLM-generated UUID, NOT the real Bolna call ID — so `bolna_call_id` matching against the
  webhook's `body.id` never works. Bolna can also re-fire two terminal webhooks (`call-disconnected`
  then `completed`) for one call. `receive_complete` therefore has a Strategy 4A fallback that reuses
  an emergency that already stored the identical transcript, plus an early idempotency guard (ack
  without re-storing chunks / re-running dispatch). Keep this safety net when editing `transcript.py`.
- **Geocoding vs real GPS:** text geocoding biases to the Dharwad anchor `(15.3647, 75.1239)` and
  rejects any result > 200 km away (`MAX_ANCHOR_DISTANCE_KM` in `geocoding_service.py`) as
  unreliable — far-away text geocodes must NOT set coords (which would short-circuit the real-GPS
  SMS and wrongly flag `outside_coverage`). Real browser GPS via `/api/location/{id}` is
  authoritative: it overwrites coords and re-runs coverage in `receive_location`.
