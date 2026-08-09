package com.example.savior.data

import android.content.Context
import android.content.SharedPreferences

class UserPrefs(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("savior_prefs", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = prefs.getString("serverUrl", "https://threatenedly-unpredicative-louis.ngrok-free.dev/api/location/phone/") ?: "https://threatenedly-unpredicative-louis.ngrok-free.dev/api/location/phone/"
        set(value) = prefs.edit().putString("serverUrl", value).apply()

    var targetSaviorNumber: String
        get() = prefs.getString("targetSaviorNumber", "8792666030") ?: "8792666030"
        set(value) = prefs.edit().putString("targetSaviorNumber", value).apply()

    var fullName: String
        get() = prefs.getString("fullName", "") ?: ""
        set(value) = prefs.edit().putString("fullName", value).apply()

    var phone: String
        get() = prefs.getString("phone", "") ?: ""
        set(value) = prefs.edit().putString("phone", value).apply()

    var email: String
        get() = prefs.getString("email", "") ?: ""
        set(value) = prefs.edit().putString("email", value).apply()

    var bloodGroup: String
        get() = prefs.getString("bloodGroup", "") ?: ""
        set(value) = prefs.edit().putString("bloodGroup", value).apply()

    var conditions: String
        get() = prefs.getString("conditions", "") ?: ""
        set(value) = prefs.edit().putString("conditions", value).apply()

    var otherInfo: String
        get() = prefs.getString("otherInfo", "") ?: ""
        set(value) = prefs.edit().putString("otherInfo", value).apply()

    var relativePhone: String
        get() = prefs.getString("relativePhone", "") ?: ""
        set(value) = prefs.edit().putString("relativePhone", value).apply()

    var doctorPhone: String
        get() = prefs.getString("doctorPhone", "") ?: ""
        set(value) = prefs.edit().putString("doctorPhone", value).apply()

    var emergencyInstructions: String
        get() = prefs.getString("emergencyInstructions", "") ?: ""
        set(value) = prefs.edit().putString("emergencyInstructions", value).apply()

    fun isRegistrationComplete(): Boolean {
        return fullName.isNotEmpty() && phone.isNotEmpty()
    }

    fun isSetupComplete(): Boolean {
        return relativePhone.isNotEmpty()
    }
}
