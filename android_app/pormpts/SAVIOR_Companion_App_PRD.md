# Product Requirement Document (PRD)
## Project: SAVIOR Companion Mobile Application
**Document Version:** 1.0 (Technical Blueprint)  
**Author:** Abdul Jawad Bankapur  
**Target Platform:** Native Android (Java / SDK 34)  
**System Status:** Draft Specification  

---

## 1. Executive Summary & Objective
The **SAVIOR Companion Mobile Application** acts as an automated, background telemetry gateway for the primary SAVIOR (*Situational Analysis & Virtual Intelligent Operational Router*) framework. 

During an emergency, users shouldn't have to struggle to explain where they are under intense stress. This utility operates silently at the operating system layer. When a user calls the designated SAVIOR triage phone target index via the native Android phone dialer, the app instantly captures the event, extracts precision high-accuracy GPS variables, and broadcasts a structured JSON tracking package straight to the central server pipeline.

---

## 2. Core Functional Requirements & System Pipelines

### 2.1 Live Outbound Interception Engine (The Call Monitor)
Rather than writing an aggressive utility that constantly scrapes or queries the historical database tables, the application binds a live listener using native platform callbacks.
* **Stream Monitoring:** Instantiates an event pipeline using `TelephonyCallback` bound to the host `TelephonyManager`.
* **State Identification:** Listens specifically for the device state updating to `CALL_STATE_OFFHOOK` (the exact instant an outgoing dialing stream bridges into the hardware network).
* **Target Isolation:** Evaluates the dialed string:
```text
IF outgoing_number EQUALS target_savior_emergency_number THEN
    LAUNCH High_Priority_Background_Telemetry_Engine()
ELSE
    MAINTAIN System_Idle_Privacy_State()
ENDIF
```

### 2.2 Foreground Escalation Framework
Android automatically applies restrictive task management (Doze Mode optimizations) to background operations to extend battery longevity. To prevent thread death, the application alters execution status on demand:
* **Service Promotion:** Instantly shifts execution out of background stacks by spinning up a `Foreground Service`.
* **System Transparency:** Automatically pushes a non-dismissible, high-visibility status bar notification informing the device handler that tracking is operating securely (*"SAVIOR is actively transmitting emergency location coordinates..."*).

### 2.3 Spatial Ingestion Delivery
* **Hardware Interfacing:** Coordinates with Google Play Services `FusedLocationProviderClient`, setting configurations strictly to `PRIORITY_HIGH_ACCURACY`.
* **Payload Marshalling:** Packs active coordinates cleanly into a defined transmission packet: `[Device_ID, Latitude, Longitude, Timestamp]`.
* **API Delivery:** Fires an asynchronous network thread pointing to the remote ingestion endpoint via a robust Retrofit/OkHttp request engine.

---

## 3. Hardware Permission & Declaration Blueprint
Operating system-level hardware hooks requires explicitly specifying functional profiles inside the project configuration files.

| Permission / Role Type | Target System Resource Hook | Functional Requirement Matrix |
| :--- | :--- | :--- |
| **Phone State Interception** | `android.permission.READ_PHONE_STATE` | Authorizes the app engine to process live call state modifications (`OFFHOOK`) and capture targets. |
| **Precision Navigation** | `android.permission.ACCESS_FINE_LOCATION` | Opens raw satellite GPS coordinate sensor arrays for sub-meter mapping precision. |
| **Persistent Tracking** | `android.permission.ACCESS_BACKGROUND_LOCATION` | Enables sensor updates to stream cleanly when the screen goes dark or the interface disappears. |
| **Network Gateway** | `android.permission.INTERNET` | Establishes the socket bridge required to transfer outbound HTTP payloads to the remote server. |
| **Lifecycle Escalation** | `android.permission.FOREGROUND_SERVICE` | Flags the host thread as an high-priority utility immune to runtime background freeze mandates. |

> ⚠️ **Development Directive for Gemini CLI:** Since this platform deployment operates strictly as an engineered prototype for internal evaluation, public store restriction loops are entirely bypassed. Declare these configurations in the project manifest file, and ensure that inside your testing handsets, the background location access parameter is explicitly toggled by hand to **"Allow all the time"**.

---

## 4. Performance & Non-Functional Specifications
* **Transmission Latency Limit:** The duration measured between the raw `CALL_STATE_OFFHOOK` event trigger and the definitive backend API JSON reception execution must stay below **800 milliseconds**.
* **Power Footprint:** While waiting passively for a trigger event, the listening classes must consume zero active computational blocks. Thread wake-locks are completely banned until target telephone string evaluations criteria align.
* **Fault Redundancy:** If cellular data infrastructure is missing during an emergency call event, the system must drop back to packaging the coordinates inside a backup layout framework sent automatically as an encrypted SMS chunk straight to the central data parsing bridge.

---

## 5. System Validation Target
The companion application architecture is verified as operational when a mock emergency number call executed on a background-locked handset generates an instant matching `200 OK` or `201 Created` confirmation flag on your central FastAPI server dashboard logging window.
