# SAVIOR Bolna AI Agent

## Overview

Bolna AI agent configuration for the SAVIOR (Situational Analysis & Virtual Intelligent Operational Router) project. The AI agent handles receiving voice calls, conversing with callers, collecting emergency information, and calling the backend via Custom Functions.

## Structure

```
bolna-agent/
├── prompts/
│   ├── system-prompt.md         ← Agent behavior, info to collect, function instructions
│   └── welcome-message.md       ← First greeting template
├── custom-functions/            ← JSON schemas for Bolna custom function webhooks
│   ├── post-emergency.json      ← POST /api/emergency — creates emergency record
│   └── send-transcript-chunk.json ← POST /api/transcript_chunk — live transcript streaming
├── docs/                        ← Workflow, setup, limitations
└── sample-payloads/             ← Example API payloads
```

## Custom Functions

### post-emergency
- **Trigger:** LLM calls after collecting emergency info
- **Method:** POST to ngrok → `/api/emergency`
- **Fields:** emergency_type, location, description (required); caller_name, caller_phone, victim_name, severity, landmark, victims, summary, immediate_danger, call_id (optional)
- **call_id:** Unique per-call identifier — LLM generates a timestamp/UUID and reuses it across both functions for transcript matching

### send-transcript-chunk
- **Trigger:** LLM calls immediately after first greeting, then every ~10 seconds during conversation
- **Method:** POST to ngrok → `/api/transcript_chunk`
- **Fields:** transcript_text, speaker (required); emergency_type_detected, call_id (optional)
- **call_id:** Must match the value used in `post-emergency`

## System Prompt Highlights

- Agent intro: "SAVIOR AI Emergency Assistance"
- Collects: emergency type, caller name (ask immediately after first response), location, landmark, victims, description, severity, immediate dangers
- Calls `send_transcript_chunk` immediately after greeting (before `post_api_emergency`)
- Calls `post_api_emergency` once enough info collected
- Varies wording between calls
- Does NOT transfer to another assistant or switch languages
- Passes empty strings for unavailable optional fields rather than delaying

## Known Limitations

- **Language transfer:** Bolna platform-level language detection can override the system prompt. If the caller speaks mixed languages, configure the agent in the Bolna dashboard to use a single language (English) to prevent transfer.
- **call_id reliability:** The LLM generates call_id — backend matching by `bolna_call_id` works best when the LLM provides a consistent unique value across both functions.

## Setup

1. Create agent on `platform.bolna.ai`
2. Configure voice (ElevenLabs Turbo v2.5) and language (English only)
3. Upload custom functions from `custom-functions/*.json` (update ngrok URL if changed)
4. Copy system prompt from `prompts/system-prompt.md` into agent prompt field
5. Set up webhook to `https://YOUR_NGROK.ngrok-free.dev/api/transcript/complete`
