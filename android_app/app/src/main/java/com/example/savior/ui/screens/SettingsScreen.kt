package com.example.savior.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.savior.data.UserPrefs
import com.example.savior.ui.components.SaviorTextField
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(userPrefs: UserPrefs, onBack: () -> Unit) {
    var serverUrl by remember { mutableStateOf(userPrefs.serverUrl) }
    var targetSaviorNumber by remember { mutableStateOf(userPrefs.targetSaviorNumber) }
    val snackbarHostState = remember { SnackbarHostState() }
    val coroutineScope = rememberCoroutineScope()

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("Settings", color = MaterialTheme.colorScheme.primary) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = MaterialTheme.colorScheme.primary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(paddingValues)
                .padding(horizontal = 20.dp)
        ) {
            Spacer(modifier = Modifier.height(24.dp))
            
            Text(
                text = "Developer Settings",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(16.dp))
            
            SaviorTextField(
                value = serverUrl,
                onValueChange = { serverUrl = it },
                label = "Telemetry Server URL",
                placeholder = "http://192.168.x.x:8000/api/telemetry",
                leadingIcon = { Icon(Icons.Default.Settings, contentDescription = null, tint = MaterialTheme.colorScheme.outline) }
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            SaviorTextField(
                value = targetSaviorNumber,
                onValueChange = { targetSaviorNumber = it },
                label = "Target Savior Number",
                placeholder = "8792666030",
                leadingIcon = { Icon(Icons.Default.Call, contentDescription = null, tint = MaterialTheme.colorScheme.outline) }
            )
            
            Spacer(modifier = Modifier.height(32.dp))
            
            Button(
                onClick = {
                    userPrefs.serverUrl = serverUrl
                    userPrefs.targetSaviorNumber = targetSaviorNumber
                    coroutineScope.launch {
                        snackbarHostState.showSnackbar("Settings saved!")
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(28.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary
                )
            ) {
                Text("Save Settings", style = MaterialTheme.typography.titleMedium)
            }
        }
    }
}
