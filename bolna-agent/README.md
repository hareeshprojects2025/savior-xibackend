# SAVIOR Bolna AI Agent

## Overview
Bolna AI agent configuration for the SAVIOR (Situational Analysis & Virtual Intelligent Operational Router) project.

The AI agent handles:
- Receiving voice calls
- Conversing with the caller
- Collecting emergency information
- Calling the backend via Custom Functions
- Sending structured emergency data and live transcripts to the backend

## Structure
```
bolna-agent/
├── prompts/              ← System prompt + welcome message
├── custom-functions/     ← Custom function JSON schemas
├── docs/                 ← Workflow, setup, limitations
└── sample-payloads/      ← Example API payloads
```

## Current Status
- Emergency conversation flow implemented
- Custom Functions configured (post-emergency + live transcript)
- FastAPI backend integration working
- Emergency information successfully stored in MySQL
