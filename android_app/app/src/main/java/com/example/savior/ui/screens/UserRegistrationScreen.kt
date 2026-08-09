package com.example.savior.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.example.savior.data.UserPrefs
import com.example.savior.ui.components.SaviorTextField

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UserRegistrationScreen(userPrefs: UserPrefs, onNext: () -> Unit) {
    var fullName by remember { mutableStateOf(userPrefs.fullName) }
    var phone by remember { mutableStateOf(userPrefs.phone) }
    var email by remember { mutableStateOf(userPrefs.email) }
    var bloodGroup by remember { mutableStateOf(userPrefs.bloodGroup) }
    var conditions by remember { mutableStateOf(userPrefs.conditions) }
    var otherInfo by remember { mutableStateOf(userPrefs.otherInfo) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Face,
                            contentDescription = "Logo",
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = "Savior",
                            style = MaterialTheme.typography.headlineSmall,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.primary
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
                .verticalScroll(rememberScrollState())
        ) {
            Spacer(modifier = Modifier.height(24.dp))
            
            Text(
                text = "Step 1 of 2",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Create Account",
                style = MaterialTheme.typography.headlineLarge,
                color = MaterialTheme.colorScheme.onBackground
            )
            
            Spacer(modifier = Modifier.height(32.dp))
            
            // Basic Info Section
            Text(
                text = "Basic Information",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(16.dp))
            
            SaviorTextField(
                value = fullName,
                onValueChange = { fullName = it },
                label = "Full Name",
                placeholder = "Enter your full name",
                leadingIcon = { Icon(Icons.Default.Person, contentDescription = null, tint = MaterialTheme.colorScheme.outline) }
            )
            Spacer(modifier = Modifier.height(16.dp))
            
            SaviorTextField(
                value = phone,
                onValueChange = { phone = it },
                label = "Phone Number",
                placeholder = "+1 (555) 000-0000",
                leadingIcon = { Icon(Icons.Default.Call, contentDescription = null, tint = MaterialTheme.colorScheme.outline) }
            )
            Spacer(modifier = Modifier.height(16.dp))
            
            SaviorTextField(
                value = email,
                onValueChange = { email = it },
                label = "Email Address",
                placeholder = "name@example.com",
                leadingIcon = { Icon(Icons.Default.Email, contentDescription = null, tint = MaterialTheme.colorScheme.outline) }
            )
            
            Spacer(modifier = Modifier.height(32.dp))
            Divider(color = MaterialTheme.colorScheme.outlineVariant)
            Spacer(modifier = Modifier.height(16.dp))
            
            // Medical Info Section
            Text(
                text = "Medical Information",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(16.dp))
            
            SaviorTextField(
                value = bloodGroup,
                onValueChange = { bloodGroup = it },
                label = "Blood Group",
                placeholder = "e.g. O+",
                leadingIcon = { Icon(Icons.Default.Favorite, contentDescription = null, tint = MaterialTheme.colorScheme.outline) }
            )
            Spacer(modifier = Modifier.height(16.dp))
            
            SaviorTextField(
                value = conditions,
                onValueChange = { conditions = it },
                label = "Known Medical Conditions",
                placeholder = "e.g. Asthma, Diabetes, Hypertension...",
                singleLine = false,
                minLines = 3,
                leadingIcon = { Icon(Icons.Default.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.outline) }
            )
            Spacer(modifier = Modifier.height(16.dp))
            
            SaviorTextField(
                value = otherInfo,
                onValueChange = { otherInfo = it },
                label = "Other Medical Info",
                placeholder = "Allergies, current medications...",
                singleLine = false,
                minLines = 3,
                leadingIcon = { Icon(Icons.Default.Info, contentDescription = null, tint = MaterialTheme.colorScheme.outline) }
            )
            
            Spacer(modifier = Modifier.height(32.dp))
            
            Button(
                onClick = {
                    userPrefs.fullName = fullName
                    userPrefs.phone = phone
                    userPrefs.email = email
                    userPrefs.bloodGroup = bloodGroup
                    userPrefs.conditions = conditions
                    userPrefs.otherInfo = otherInfo
                    onNext()
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
                Text("Next: Emergency Contacts", style = MaterialTheme.typography.headlineSmall)
                Spacer(modifier = Modifier.width(16.dp))
                Icon(Icons.Default.ArrowForward, contentDescription = null)
            }
            
            Spacer(modifier = Modifier.height(48.dp))
        }
    }
}
