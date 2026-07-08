## Current Scope
The current implementation focuses on collecting emergency information through the Bolna AI agent and storing it in the backend database.

---

## Limitations
- The system is currently tested using outbound calls.
- A regulated inbound phone number has not been integrated.
- The ngrok URL is temporary and must be updated whenever it changes.
- The backend must be running for the AI agent to communicate with it.
- The system stores emergency information only and does not dispatch emergency services.

---

## Future Improvements
- Configure an inbound phone number for production deployment.
- Replace the ngrok URL with a permanent public endpoint.
- Add a monitoring dashboard for emergency records.
