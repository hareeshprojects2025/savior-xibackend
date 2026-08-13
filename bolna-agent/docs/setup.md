## Prerequisites
- Bolna AI account
- FastAPI backend
- MySQL database
- ngrok (for exposing the local backend)

---

## Backend
The FastAPI backend must be running before testing the AI agent.

Example:
```bash
uvicorn app.main:app --reload
```

---

## Public Endpoint
Expose the local backend using ngrok.

Example:
```bash
ngrok http 8000
```

Use the generated HTTPS URL as the endpoint in the Bolna Custom Function.

---

## Custom Function
Configure the Custom Function to send a POST request to:
```
https://<ngrok-url>/api/emergency
```
Replace `<ngrok-url>` with the current ngrok HTTPS URL.

---

## Testing
1. Start the FastAPI backend.
2. Start ngrok.
3. Update the Custom Function URL if the ngrok URL changes.
4. Call the Bolna AI agent.
5. Verify that the backend receives the request.
6. Verify that the emergency record is stored in MySQL.

---

## Dashboard Configuration Checklist (both agents)

When pasting prompts into the Bolna dashboard, **every `{{user_data.*}}` placeholder must stay verbatim** — do not replace, trim, or pre-fill them. They are filled at call time from the backend's `user_data` payload.

Inbound agent (`post_api_emergency`):
- [ ] System prompt contains the raw placeholders / update rule (call early, then update once with the same `call_id`).
- [ ] `post_api_emergency` custom function URL points to `https://<ngrok-url>/api/emergency`.

Outbound dispatch agent (`station_ack_response`):
- [ ] System prompt contains raw `{{user_data.*}}` placeholders (station_name, incident_type, location, description, severity, victims, emergency_id, dispatch_record_id).
- [ ] `station_ack_response` custom function URL points to `https://<ngrok-url>/api/dispatch/ack`.
- [ ] Custom function header `Authorization: Bearer <value>` equals the backend's `BOLNA_WEBHOOK_SECRET` (`backend/.env`).
- [ ] `dispatch_record_id` and `call_id` are declared in the function's parameter schema (do not remove — the backend matches ACK webhooks by them).

---

## Testing the Outbound Agent — IMPORTANT

**Never test the outbound dispatch agent from the Bolna dashboard alone.** A dashboard-run call carries no `user_data`, so the agent has no incident details to read — it will produce an empty "urgent dispatch notification" and the backend will log `Dispatch record not found`. That is expected behavior, not a bug.

Always test the outbound flow through the backend:
1. Place a real inbound call (or create an emergency) so a dispatch record is created.
2. The backend calls Bolna with `user_data` and logs `Bolna outbound call placed: ... station=...`.
3. The agent must recite emergency ID, incident type, location, severity, victims, and caller name from user_data.
4. The station's verbal ACK arrives as a `station_ack_response` webhook; the backend logs `Dispatch X acknowledged by station Y`.

If the ACK is never recorded, check the backend log for `Orphan ACK webhook` — that means the webhook arrived but no dispatch record matched (dispatch pipeline failed earlier or identifiers did not match).

**Repeated `401` on `/api/dispatch/ack`:** almost always the `Authorization` header. The backend requires exactly `Bearer <value>` (including the `Bearer ` prefix) and a value equal to `backend/.env` `BOLNA_WEBHOOK_SECRET`. On a fresh backend, a failing request logs `ACK auth mismatch | header_present=... | starts_with_bearer=...` to reveal what Bolna actually sent.
