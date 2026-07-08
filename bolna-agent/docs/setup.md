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
