# Savior - Android Integration (Milestone 2 Extension)

This repository is an extension of the `milestone2` branch, featuring the fully integrated Android Location Service. It combines both the Python backend and the Android app into a single monorepo for easier deployment and testing.

## Repository Structure

- `backend/` - Contains the FastAPI backend, Bolna webhooks, and the SMS web frontend.
- `android_app/` - Contains the native Android application built with Kotlin/Jetpack Compose.

## 🚀 Launch Instructions

### 1. Starting ngrok
Because the Android app needs a public URL to reach your local machine, you must run ngrok first.
```bash
ngrok http 8000
```
*Note the HTTPS Forwarding URL (e.g., `https://abcdef123.ngrok-free.app`).*

### 2. Launching the Backend
Navigate to the `backend` directory and start the FastAPI server on port 8000.
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Launching the Frontend
The SMS dispatch page and interactive map are served directly by the backend! Just open your browser to:
```text
http://localhost:8000
```
*(Or navigate to `/` on your ngrok URL).*

### 4. Running the Android App
The Android app requires the ngrok URL to be configured so it knows where to send the location telemetry.

1. Open `android_app/` in Android Studio.
2. Build and run the app on your physical device or emulator.
3. Open the **Settings** tab in the app.
4. Set the **Server URL** to your ngrok address, ensuring it ends with `/api/location/phone/`.
   - *Example:* `https://abcdef123.ngrok-free.app/api/location/phone/`
5. Ensure your phone number matches the number you use when placing the emergency call.

### 5. Triggering an Emergency
1. Run `python scripts/make_call.py` (ensure your Bolna webhook is pointed to your ngrok `/api/emergency` endpoint).
2. The Android app will instantly ping the `/api/location/phone/...` endpoint and safely buffer the location.
3. Once the call ends, Bolna creates the emergency, and the coordinates are automatically attached!
