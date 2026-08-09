package com.example.savior;

import android.content.SharedPreferences;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.android.gms.tasks.CancellationTokenSource;

import org.json.JSONArray;
import org.json.JSONException;

import java.io.IOException;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class EmergencyLocationService extends Service {
    private static final String TAG = "EmergencyLocService";
    private static final String CHANNEL_ID = "SaviorEmergencyChannel";
    private static final int NOTIFICATION_ID = 1;

    private FusedLocationProviderClient fusedLocationClient;
    private OkHttpClient httpClient;

    @Override
    public void onCreate() {
        super.onCreate();
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        httpClient = new OkHttpClient();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createNotificationChannel();
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("SAVIOR Active")
                .setContentText("SAVIOR is actively transmitting emergency location coordinates...")
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setOngoing(true)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        fetchLocationAndTransmit();

        return START_NOT_STICKY;
    }

    private void fetchLocationAndTransmit() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            Log.e(TAG, "Location permission not granted.");
            stopSelf();
            return;
        }

        CancellationTokenSource cancellationTokenSource = new CancellationTokenSource();
        fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cancellationTokenSource.getToken())
                .addOnSuccessListener(location -> {
                    if (location != null) {
                        String deviceId = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
                        long timestamp = System.currentTimeMillis();
                        
                        try {
                            SharedPreferences prefs = getSharedPreferences("savior_prefs", MODE_PRIVATE);
                            String phone = prefs.getString("phone", deviceId);

                            org.json.JSONObject payload = new org.json.JSONObject();
                            payload.put("latitude", location.getLatitude());
                            payload.put("longitude", location.getLongitude());

                            // Base URL from settings: http://192.168.0.108:8000/api/location/phone/
                            String serverUrl = prefs.getString("serverUrl", "http://192.168.0.108:8000/api/location/phone/") + phone;
                            sendTelemetryData(payload.toString(), serverUrl);
                        } catch (JSONException e) {
                            Log.e(TAG, "Error building JSON payload", e);
                            stopSelf();
                        }
                    } else {
                        Log.e(TAG, "Failed to get location.");
                        stopSelf();
                    }
                })
                .addOnFailureListener(e -> {
                    Log.e(TAG, "Location fetch failed", e);
                    stopSelf();
                });
    }

    private void sendTelemetryData(String jsonPayload, String serverUrl) {
        RequestBody body = RequestBody.create(jsonPayload, MediaType.get("application/json; charset=utf-8"));
        Request request = new Request.Builder()
                .url(serverUrl)
                .post(body)
                .build();

        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                Log.e(TAG, "Failed to send telemetry data", e);
                stopSelf();
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                if (response.isSuccessful()) {
                    Log.i(TAG, "Telemetry data transmitted successfully.");
                } else {
                    Log.e(TAG, "Server error: " + response.code());
                }
                response.close();
                stopSelf();
            }
        });
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Emergency Telemetry Service",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Shows persistent notification when SAVIOR is active");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
