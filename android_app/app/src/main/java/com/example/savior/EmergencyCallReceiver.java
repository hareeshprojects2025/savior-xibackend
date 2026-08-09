package com.example.savior;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.telephony.PhoneStateListener;
import android.telephony.TelephonyCallback;
import android.telephony.TelephonyManager;
import android.util.Log;

public class EmergencyCallReceiver extends BroadcastReceiver {
    private static final String TAG = "EmergencyCallReceiver";
    private boolean isListening = false;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent.getAction() != null && intent.getAction().equals(TelephonyManager.ACTION_PHONE_STATE_CHANGED)) {
            String stateStr = intent.getStringExtra(TelephonyManager.EXTRA_STATE);

            if (TelephonyManager.EXTRA_STATE_OFFHOOK.equals(stateStr) || TelephonyManager.EXTRA_STATE_RINGING.equals(stateStr)) {
                if (!isListening) {
                    isListening = true;
                    handleCallState(context, TelephonyManager.CALL_STATE_OFFHOOK, null);
                }
            } else {
                isListening = false;
            }
        }
    }

    private void handleCallState(Context context, int state, String phoneNumber) {
        if (state == TelephonyManager.CALL_STATE_OFFHOOK) {
            Log.d(TAG, "Call State OFFHOOK detected. Triggering emergency telemetry...");
            
            // In a real scenario, we check if phoneNumber equals targetSaviorNumber.
            // SharedPreferences prefs = context.getSharedPreferences("savior_prefs", Context.MODE_PRIVATE);
            // String targetSaviorNumber = prefs.getString("targetSaviorNumber", "8792666030");
            // Due to permission restrictions (READ_CALL_LOG), the number might be null.
            // For the sake of this prototype PRD, we trigger the service.
            Intent serviceIntent = new Intent(context, EmergencyLocationService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        }
    }
}
