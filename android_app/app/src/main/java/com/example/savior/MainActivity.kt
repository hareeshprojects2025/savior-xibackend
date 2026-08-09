
package com.example.savior

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.material3.IconButton
import androidx.compose.material3.Icon
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.ui.unit.dp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.savior.data.UserPrefs
import com.example.savior.ui.screens.EmergencySetupScreen
import com.example.savior.ui.screens.UserRegistrationScreen
import com.example.savior.ui.screens.SettingsScreen
import com.example.savior.ui.theme.SaviorTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val userPrefs = UserPrefs(this)
        
        setContent {
            SaviorTheme {
                val navController = rememberNavController()
                
                val startDest = when {
                    !userPrefs.isRegistrationComplete() -> "registration"
                    !userPrefs.isSetupComplete() -> "setup"
                    else -> "dashboard"
                }

                NavHost(navController = navController, startDestination = startDest) {
                    composable("registration") {
                        UserRegistrationScreen(
                            userPrefs = userPrefs,
                            onNext = {
                                navController.navigate("setup") {
                                    popUpTo("registration") { inclusive = true }
                                }
                            }
                        )
                    }
                    composable("setup") {
                        EmergencySetupScreen(
                            userPrefs = userPrefs,
                            onComplete = {
                                navController.navigate("dashboard") {
                                    popUpTo("setup") { inclusive = true }
                                }
                            }
                        )
                    }
                    composable("dashboard") {
                        Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                            Box(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
                                IconButton(
                                    onClick = { navController.navigate("settings") },
                                    modifier = Modifier.align(Alignment.TopEnd).padding(16.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Settings,
                                        contentDescription = "Settings",
                                        tint = MaterialTheme.colorScheme.primary
                                    )
                                }
                                Column(
                                    modifier = Modifier.fillMaxSize(),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center
                                ) {
                                    Text(
                                        text = "Savior Active",
                                        style = MaterialTheme.typography.headlineLarge,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                    Spacer(modifier = Modifier.height(16.dp))
                                    Text(
                                        text = "Background telemetry is running.",
                                        style = MaterialTheme.typography.bodyLarge,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    }
                    composable("settings") {
                        SettingsScreen(
                            userPrefs = userPrefs,
                            onBack = { navController.popBackStack() }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun Greeting(name: String, modifier: Modifier = Modifier) {
    Text(
        text = "Hello $name!",
        modifier = modifier
    )
}

@Preview(showBackground = true)
@Composable
fun GreetingPreview() {
    SaviorTheme {
        Greeting("Android")
    }
}