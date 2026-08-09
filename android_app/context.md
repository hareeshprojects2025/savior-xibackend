# SAVIOR Companion - Agent Context & Code Deviations

This file provides crucial context for any AI agents taking over the `SAVIOR Companion App` project. It documents specific deviations made from the original PRD/Prompt to resolve strict Android compatibility, compilation, and OS lifecycle restrictions.

## 1. Dependency Version Downgrades (`gradle/libs.versions.toml`)
- **Issue**: Android Studio auto-generated dependencies requiring API 37 and AGP 9.1.0, which were incompatible with the current `targetSdk 36` and `agp 8.13.2`.
- **Resolution**:
  - `coreKtx` downgraded from `1.19.0` to `1.13.1`
  - `lifecycleRuntimeKtx` downgraded from `2.11.0` to `2.8.6`
  - `activityCompose` downgraded from `1.13.0` to `1.9.2`

## 2. Telephony Interception Lifecycle (`EmergencyCallReceiver.java`)
- **Issue**: The original prompt requested registering a `TelephonyCallback` or `PhoneStateListener` inside the `BroadcastReceiver`. Because a `BroadcastReceiver` lives for only milliseconds, the process was being killed by Android before the async callback could ever detect the `OFFHOOK` state.
- **Resolution**: Ignored the async listener completely. We now directly evaluate the state from the broadcast intent extra synchronously:
  ```java
  String stateStr = intent.getStringExtra(TelephonyManager.EXTRA_STATE);
  if (TelephonyManager.EXTRA_STATE_OFFHOOK.equals(stateStr)) { ... }
  ```

## 3. Strict JSON Exception Handling (`EmergencyLocationService.java`)
- **Issue**: Standard Java `org.json` allows `JSONArray.put(double)` without an exception, but the Android runtime explicitly throws a `JSONException` if the double evaluates to `NaN` or `Infinity`.
- **Resolution**: Forced a `try-catch (JSONException e)` block around the payload packaging logic to allow compilation to succeed.

## 4. Cleartext Network Traffic (`AndroidManifest.xml`)
- **Issue**: Android 9+ blocks cleartext HTTP connections by default. We are pointing the app to a local, non-HTTPS development server (`http://192.168.x.x`).
- **Resolution**: Appended `android:usesCleartextTraffic="true"` directly to the `<application>` manifest tag.

## 5. Background Foreground Service Block (Android 12+ / API 31+)
- **Issue**: Triggering `startForegroundService()` from a background `BroadcastReceiver` throws `ForegroundServiceStartNotAllowedException` on modern Android OS versions.
- **Current Workaround**: This app relies on the user explicitly disabling Battery Optimizations ("Unrestricted" battery mode) via Android Settings to bypass this security layer during prototyping. If the architecture moves to production, alternative routing (like FCM or `SYSTEM_ALERT_WINDOW` exceptions) must be built.

## 6. Multi-State Call Trigger (`EmergencyCallReceiver.java`)
- **Issue**: Previously, the receiver only triggered on `OFFHOOK`. If the app user received an incoming call (e.g. from the AI agent), it might not trigger properly or fast enough.
- **Resolution**: Upgraded `EmergencyCallReceiver` to explicitly trigger on both `RINGING` (incoming) and `OFFHOOK` (outgoing) states to guarantee telemetry capture regardless of who initiates the call.

## 7. Local Storage (`UserPrefs.kt`)
- **Issue**: The app originally used hardcoded dummy data for telemetry payloads.
- **Resolution**: Implemented a dynamic `SharedPreferences` wrapper (`UserPrefs.kt`) that captures the user's real Name, Phone, Contacts, and Medical Conditions via the Jetpack Compose onboarding flow.

## 8. Dynamic Configuration (`SettingsScreen.kt`)
- **Issue**: Recompiling the app every time the test backend IP changed or the target phone number changed was inefficient.
- **Resolution**: `SERVER_URL` and `TARGET_SAVIOR_NUMBER` are no longer hardcoded constants. They are dynamically manageable via the new `SettingsScreen.kt` to allow seamless Wi-Fi and target number swapping during testing without recompilation.

## 9. Telemetry Payload Formatting (`EmergencyLocationService.java`)
- **Issue**: The backend dispatch requires a specific JSON payload format matching `EmergencyCreate` schema.
- **Resolution**: Modified the `EmergencyLocationService` payload construction to build a structured `JSONObject` (instead of a simple `JSONArray`) that perfectly maps to the new FastAPI backend `POST /api/v1/emergency` route, injecting the user's full name, phone number, and medical conditions directly into the payload.
