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
│   └── station-ack-prompt.md    ← Outbound dispatch agent — reads incident, collects verbal ACK
├── custom-functions/            ← JSON schemas for Bolna custom function webhooks
│   ├── post-emergency.json      ← POST /api/emergency — creates emergency record
│   ├── send-transcript-chunk.json ← POST /api/transcript_chunk — live transcript streaming
│   └── station-ack.json         ← POST /api/dispatch/ack — station acknowledgment webhook
├── docs/                        ← Workflow, setup, limitations
└── sample-payloads/             ← Example API payloads
```

## Inbound Agent (Victim Calls)

### Custom Functions

#### post-emergency
- **Trigger:** LLM calls after collecting emergency info
- **Method:** POST to ngrok → `/api/emergency`
- **Fields:** emergency_type, location, description (required); caller_name, caller_phone, victim_name, severity, landmark, victims, summary, immediate_danger, call_id (optional)

#### send-transcript-chunk
- **Trigger:** LLM calls immediately after greeting, then every ~10s during conversation
- **Method:** POST to ngrok → `/api/transcript_chunk`
- **Fields:** transcript_text, speaker (required); emergency_type_detected, call_id (optional)

### System Prompt Highlights

- Agent intro: "SAVIOR AI Emergency Assistance"
- Collects: emergency type, caller name, location, landmark, victims, description, severity, immediate dangers
- Calls `send_transcript_chunk` immediately after greeting
- Calls `post_api_emergency` once enough info collected
- Does NOT transfer calls

## Outbound Dispatch Agent (Station Calls)

### Custom Functions

#### station-ack
- **Trigger:** LLM calls after station personnel responds (acknowledge/reject/needs_clarification)
- **Method:** POST to ngrok → `/api/dispatch/ack`
- **Fields:** dispatch_record_id, call_id, ack_status, station_name, notes
- **user_data variables (passed from backend payload):**
  - `{{user_data.emergency_id}}` — Incident ID
  - `{{user_data.incident_type}}` — Fire, Medical, Police, etc.
  - `{{user_data.location}}` — Incident location
  - `{{user_data.description}}` — Incident description
  - `{{user_data.severity}}` — Critical / High / Medium / Low
  - `{{user_data.victims}}` — Number of victims
  - `{{user_data.caller_name}}` — Caller name
  - `{{user_data.summary}}` — AI-generated summary

### System Prompt Highlights

- Agent intro: "SAVIOR Emergency Dispatch System"
- Reads incident details from `{{user_data.*}}` variables
- Asks for verbal acknowledgment
- Calls `station_ack_response` with ack_status
- Keeps calls under 60s
- Bilingual (English + Kannada)

## Dispatch Flow

```
1. Dispatcher clicks "Dispatch" → backend calls Bolna /call with user_data
2. Bolna outbound agent calls station phone
3. Agent reads: "This is SAVIOR Dispatch. Incident type: [user_data.incident_type]..."
4. Agent asks: "Do you acknowledge this dispatch?"
5a. "Yes" → agent calls station_ack_response with ack_status="acknowledged"
5b. "No" → agent calls station_ack_response with ack_status="rejected"
5c. Unclear → agent calls station_ack_response with ack_status="needs_clarification"
```

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
5. Set webhook URL to `https://YOUR_NGROK.ngrok-free.dev/api/dispatch/ack`
6. Set `BOLNA_DISPATCH_AGENT_ID` in `.env` to this agent's UUID
