## Current MVP Workflow

### Step 1
The caller starts a conversation with the Bolna AI agent.

### Step 2
The AI asks questions to collect emergency information.

### Step 3
The AI gathers the required details, such as:
- Caller information
- Emergency type
- Location
- Description
- Number of victims
- Immediate danger

### Step 4
After collecting the information, the AI calls the configured Custom Function.

### Step 5
The Custom Function sends the emergency information to the FastAPI backend.

### Step 6
The FastAPI backend validates the request and stores the emergency information in the MySQL database.

### Workflow Diagram
```
Caller
   │
   ▼
Bolna AI Agent
   │
   ▼
Collect Emergency Information
   │
   ▼
Custom Function
   │
   ▼
FastAPI Backend
   │
   ▼
MySQL Database
```
