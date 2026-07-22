# SAVIOR Bolna AI Agents

## Overview

Two Bolna AI agents power SAVIOR:

- **Inbound Agent** (`2eac8066-...`) — Answers victim calls, collects emergency info, creates incident reports
- **Outbound Dispatch Agent** (`61d7ac00-...`) — Makes outbound calls to stations, reads incident details, collects verbal acknowledgment

## Structure

```
bolna-agent/
├── prompts/
│   ├── system-prompt.md         ← Inbound agent — behavior, info collection, function instructions
│   ├── welcome-message.md       ← First greeting template
│   └── station-ack-prompt.md    ← Outbound dispatch agent — reads incident from user_data, collects verbal ACK
├── custom-functions/            ← JSON schemas for Bolna custom function webhooks
│   ├── post-emergency.json      ← POST /api/emergency — creates emergency record
│   ├── send-transcript-chunk.json ← POST /api/transcript_chunk — live transcript streaming
│   └── station-ack.json         ← POST /api/dispatch/ack — station acknowledgment webhook
├── docs/                        ← Workflow, setup, limitations
└── sample-payloads/             ← Example API payloads
```

## Inbound Agent (Victim Calls)

### Critical Rule — Call `post_api_emergency` Early

The system prompt enforces a **mandatory early call** rule:

1. **As soon as type + location are known** → call `post_api_emergency` immediately with whatever data is available (empty/unknown fields → empty strings). Do NOT wait for more information.
2. **On silence or disconnect** → call `post_api_emergency` immediately with whatever was collected.
3. **Call at most once** — reuse the same `call_id` across both functions.

This ensures the emergency is created in the system as early as possible. The backend auto-geocodes and starts the dispatch pipeline without waiting for the full transcript.

### Custom Functions

#### post-emergency
- **Trigger:** LLM calls ASAP after type + location known (or on disconnect)
- **Method:** POST to ngrok → `/api/emergency`
- **Fields:** emergency_type, location, description (required); caller_name, caller_phone, victim_name, severity, landmark, victims, summary, immediate_danger, call_id (optional)
- **call_id:** Unique per-call identifier — LLM generates a timestamp/UUID and reuses it across both functions for transcript matching

#### send-transcript-chunk
- **Trigger:** LLM calls immediately after first greeting (before `post_api_emergency`), then every ~10 seconds during conversation
- **Method:** POST to ngrok → `/api/transcript_chunk`
- **Fields:** transcript_text, speaker (required); emergency_type_detected, call_id (optional)
- **call_id:** Must match the value used in `post-emergency`

### System Prompt Highlights

- Agent intro: "SAVIOR AI Emergency Assistance"
- Collects: emergency type, caller name, location, landmark, victims, description, severity, immediate dangers
- Calls `send_transcript_chunk` immediately after greeting (before `post_api_emergency`)
- **Calls `post_api_emergency` as soon as type + location known** — not after full collection
- Calls `post_api_emergency` on silence/disconnect too
- Does NOT transfer calls

## Outbound Dispatch Agent (Station Calls)

### Custom Functions

#### station-ack
- **Trigger:** LLM calls after station personnel responds (acknowledge/reject/needs_clarification)
- **Method:** POST to ngrok → `/api/dispatch/ack`
- **Fields:** dispatch_record_id, call_id, ack_status, station_name, notes
- **user_data variables (passed from backend payload):** emergency_id, dispatch_record_id, incident_type, location, description, severity, victims, caller_name, summary

### System Prompt Highlights

- Agent intro: "SAVIOR Emergency Dispatch System"
- Reads incident details from `{{user_data.*}}` variables — never uses hardcoded example data
- Calls `station_ack_response` with ack_status
- Keeps calls under 60s
- Bilingual (English + Kannada)

## Dispatch Flow

```
1. Dispatcher clicks "Dispatch" → backend calls Bolna /call with user_data
2. Bolna outbound agent calls station phone
3. Agent reads: "Incident type: [type], Location: [location], ..."
4. Agent asks: "Do you acknowledge this dispatch?"
5a. "Yes" → agent calls station_ack_response with ack_status="acknowledged"
5b. "No" → agent calls station_ack_response with ack_status="rejected"
5c. Unclear → agent calls station_ack_response with ack_status="needs_clarification"
```

## Known Limitations

- **Language transfer:** Bolna platform-level language detection can override the system prompt. If the caller speaks mixed languages, configure the agent in the Bolna dashboard to use a single language (English) to prevent transfer.
- **call_id reliability:** The LLM generates call_id — backend matching by `bolna_call_id` works best when the LLM provides a consistent unique value across both functions.
- **Outbound trial restriction:** Bolna trial accounts can only call verified phone numbers. Add station numbers in Bolna dashboard → Settings → Verified Phone Numbers, or upgrade the account.
- **Agent prompt examples:** The outbound dispatch agent's system prompt must NOT contain hardcoded example incident data — the LLM will read examples instead of actual `user_data` variables.

## Setup

### Inbound Agent
1. Create agent on `platform.bolna.ai`
2. Configure voice (ElevenLabs Turbo v2.5) and language (English only)
3. Upload custom functions from `custom-functions/post-emergency.json` and `send-transcript-chunk.json` (update ngrok URL)
4. Copy system prompt from `prompts/system-prompt.md` into agent prompt field
5. Set webhook URL to `https://YOUR_NGROK.ngrok-free.dev/api/transcript/complete`

### Outbound Dispatch Agent
1. Create a second agent on `platform.bolna.ai`
2. Configure voice and language (English)
3. Upload custom function from `custom-functions/station-ack.json` (update ngrok URL)
4. Copy system prompt from `prompts/station-ack-prompt.md` into agent prompt field
   - **IMPORTANT:** Ensure the prompt has NO hardcoded example incident data (no "Fire at 45 MG Road" etc.)
5. Set webhook URL to `https://YOUR_NGROK.ngrok-free.dev/api/dispatch/ack`
6. Set `BOLNA_DISPATCH_AGENT_ID` in `.env` to this agent's UUID
