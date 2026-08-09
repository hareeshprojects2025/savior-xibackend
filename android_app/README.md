# SAVIOR Companion Mobile Application

## Overview
The **SAVIOR Companion Mobile Application** acts as an automated, background telemetry gateway. During an emergency, this utility operates silently at the OS layer. When a user dials the designated emergency target number via the native Android phone dialer, the app intercepts the call, extracts high-accuracy GPS coordinates, and broadcasts a structured JSON tracking package straight to a central server pipeline.

## Features
- **Live Outbound Interception Engine**: Uses `TelephonyManager` extras to instantly capture `CALL_STATE_OFFHOOK`.
- **Foreground Escalation**: Spins up a Foreground Service with a high-priority notification to bypass Android's Doze restrictions.
- **Spatial Delivery**: Extracts precision GPS utilizing Google Play Services `FusedLocationProviderClient`.
- **Asynchronous Dispatch**: Delivers the telemetry data `[Device_ID, Latitude, Longitude, Timestamp]` to the central FastAPI dashboard via OkHttp.

## Installation & Setup

1. **Android Studio Configuration**
   - Open the project in Android Studio.
   - Run a **Gradle Sync** to download the necessary OkHttp and Google Play Services Location dependencies.
   - Build the APK and install it on an Android device (API 24 - 34+).

2. **Required Permissions (Manual Setup for Prototypes)**
   Because this is an internal prototype, the public app store loops are bypassed. Once the app is installed, go to **Settings > Apps > savior > Permissions** and manually grant:
   - **Location**: Set to *Allow all the time*.
   - **Phone**: Allow.

3. **Bypassing Background Restrictions (Android 12+)**
   To prevent the OS from throwing a `ForegroundServiceStartNotAllowedException` when the app triggers from the background:
   - Go to **Settings > Apps > savior > Battery**.
   - Set the battery usage to **Unrestricted** (or "Don't Optimize").

4. **Network Configuration**
   - In `app/src/main/java/com/example/savior/EmergencyLocationService.java`, ensure `SERVER_URL` points to your active backend IP address (e.g., `http://192.168.0.108:8000/api/telemetry`).
   - The `AndroidManifest.xml` is configured with `usesCleartextTraffic="true"` to allow local IP HTTP connections.

## Backend Integration
This app is designed to communicate with the **SAVIOR FastAPI Backend**. When an emergency call triggers the background service, the server will instantly receive the device ID, location, timestamp, and automatically generate a Google Maps tracking URL.
