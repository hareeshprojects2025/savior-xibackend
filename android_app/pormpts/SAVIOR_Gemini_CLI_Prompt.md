# Gemini CLI Engineering Prompt
## Target Profile: Native Android System Development
**Minimum SDK Baseline:** API 24 (Android 7.0 Nougat)  
**Maximum Target SDK:** API 34+ (Modern Era)  
**Development Ecosystem:** Android Studio with AndroidX / Jetpack Framework  

---

## Instructions for Gemini CLI Implementation

Copy and paste the entire structured text block below directly into your Gemini CLI interaction panel inside Android Studio. This prompt provides precise architectural boundaries, backward-compatibility logic gates, and hooks into the previously established Product Requirement Document (PRD).

```text
Act as an expert, principal Android software engineer specializing in low-level background services, telephony event streaming, and backward-compatible system frameworks. 

I am developing the SAVIOR Companion Mobile Application. The app must target an environmental support baseline spanning from Android 7.0 (API Level 24) up to the current modern releases (API Level 34+). 

Please read, analyze, and implement the technical execution requirements outlined below, referencing our established system PRD rules:

### 1. Configuration & Dependency Layer (build.gradle & Manifest)
- Generate the app-level `build.gradle` configuration snippet specifying:
  * `minSdk 24` (Android 7.0 Nougat)
  * `targetSdk 34` (or latest)
  * Active compilation utilizing the AndroidX / Jetpack ecosystem dependencies (`androidx.core:core:1.12.0` or higher, and Google Play Services location dependencies).
- Generate a comprehensive `AndroidManifest.xml` that declares the following permissions:
  * `android.permission.READ_PHONE_STATE`
  * `android.permission.ACCESS_FINE_LOCATION`
  * `android.permission.ACCESS_COARSE_LOCATION`
  * `android.permission.ACCESS_BACKGROUND_LOCATION`
  * `android.permission.INTERNET`
  * `android.permission.FOREGROUND_SERVICE`
  * `android.permission.FOREGROUND_SERVICE_LOCATION` (Mandatory for API 34+ compliance).
- Declare a `<service>` tag for `EmergencyLocationService` explicitly flagging the `android:foregroundServiceType="location"` configuration.

### 2. Telephony Interception Layer (Backward-Compatible Architecture)
Generate a native Java class named `EmergencyCallReceiver` (extending `BroadcastReceiver` or utilizing a persistent worker) or an integrated listener system that tracks call transitions. 
Because the app must span from Android 7.0 to modern API 34, implement a runtime SDK version guard:
- For devices running Android 11 (API 30) or lower: Fallback cleanly to the legacy `PhoneStateListener` monitoring `LISTEN_CALL_STATE` to capture the `CALL_STATE_OFFHOOK` event.
- For devices running Android 12 (API 31) up to API 34+: Utilize the modern `TelephonyManager.registerTelephonyCallback()` API leveraging an isolated `TelephonyCallback` subclass implementing the `TelephonyCallback.CallStateListener` interface.
- Extract the outgoing phone number string during the initial state shift. Evaluate if the number matches our target SAVIOR emergency index. If true, instantly invoke the telemetry execution sequence.

### 3. Foreground Telemetry Engine (EmergencyLocationService.java)
Generate the complete `EmergencyLocationService` Java implementation extending `android.app.Service`.
- **Initialization:** Inside `onStartCommand`, immediately build and launch a persistent status bar notification utilizing `NotificationCompat.Builder` with a dedicated `NotificationChannel` (enforcing channel registration blocks required for API 26+ compatibility). 
- **System Promotion:** Execute `startForeground()` instantly to protect the service thread from OS Doze optimizations. For API 34 compliance, ensure the service launch specifies `ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION`.
- **Spatial Polling:** Instantiate the Google Play Services `FusedLocationProviderClient`. Request high-accuracy GPS coordinates (`Priority.PRIORITY_HIGH_ACCURACY` / `LocationRequest.PRIORITY_HIGH_ACCURACY` depending on SDK compatibility checks).
- **Network Dispatch:** Once latitude and longitude coordinates are fetched, immediately execute an off-thread, asynchronous network post payload containing the structured JSON array `[Device_ID, Latitude, Longitude, Timestamp]` targeted at the FastAPI ingestion backend server architecture. Ensure the execution gracefully terminates the foreground service via `stopSelf()` once transmission succeeds.

Provide clean, robust, and compilation-ready Java files following strict AndroidX conventions. Ensure the code is optimized for zero-leak processing and lightning-fast triggering (under 800ms limit).
```
