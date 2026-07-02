# SAVIOR Backend

Emergency reporting API built with **FastAPI** + **MySQL**. Receives emergency call data from Bolna AI and stores it for dispatch coordination.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Tech Stack](#2-tech-stack)
3. [Prerequisites](#3-prerequisites)
4. [Setup Guide](#4-setup-guide)
   - 4.1 Clone the Repository
   - 4.2 Create & Activate Virtual Environment
   - 4.3 Install Dependencies
   - 4.4 Configure Environment Variables
   - 4.5 Set Up the MySQL Database
   - 4.6 Run the Server
   - 4.7 Expose with ngrok
5. [API Reference](#5-api-reference)
6. [Database Schema](#6-database-schema)
7. [Useful Queries](#7-useful-queries)
8. [Project Structure](#8-project-structure)
9. [License](#9-license)

---

## 1. Introduction

SAVIOR Backend is a REST API that accepts emergency incident reports (fire, medical, accident, etc.) from the Bolna AI voice assistant and stores them in a MySQL database for emergency responders.

## 2. Tech Stack

| Component  | Technology                    |
|------------|-------------------------------|
| Framework  | FastAPI                       |
| ORM        | SQLAlchemy                    |
| Database   | MySQL 8+                      |
| Validation | Pydantic                      |
| Server     | Uvicorn                       |
| Tunneling  | ngrok                         |

## 3. Prerequisites

- Python **3.13+**
- MySQL **8.0+**
- `pip` (Python package manager)
- ngrok account (free — https://ngrok.com)

## 4. Setup Guide

### 4.1 Clone the Repository

```bash
git clone https://github.com/<your-username>/savior-backend.git
cd savior-backend
```

### 4.2 Create & Activate Virtual Environment

```bash
python -m venv venv
```

- **Windows (PowerShell):** `venv\Scripts\Activate.ps1`
- **Windows (CMD):** `venv\Scripts\activate.bat`
- **macOS / Linux:** `source venv/bin/activate`

### 4.3 Install Dependencies

```bash
pip install -r requirements.txt
```

### 4.4 Configure Environment Variables

Copy the example env file and update your MySQL credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/savior_db
```

| Part       | Description              | Example         |
|------------|--------------------------|-----------------|
| `root`     | MySQL username           | `root`          |
| `password` | MySQL password           | `yourpassword`  |
| `3306`     | MySQL port (default)     | `3306`          |
| `savior_db`| Database name            | `savior_db`     |

### 4.5 Set Up the MySQL Database

Open your MySQL client (MySQL Workbench, CLI, etc.) and run:

```sql
CREATE DATABASE savior_db;
USE savior_db;
```

Tables are created **automatically** on first server startup (via `Base.metadata.create_all` in `main.py`).

### 4.6 Run the Server

```bash
uvicorn app.main:app --reload
```

The API will be available at **http://127.0.0.1:8000**.

- Interactive docs: http://127.0.0.1:8000/docs
- Alternative docs: http://127.0.0.1:8000/redoc

### 4.7 Expose with ngrok (for Bolna AI integration)

ngrok creates a public HTTPS URL that tunnels to your local server.

1. **Download & install** ngrok from https://ngrok.com/download
2. **Authenticate** (free account required):
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```
3. **Start the tunnel** (in a new terminal, while the server is running):
   ```bash
   ngrok http 8000
   ```
4. Copy the forwarding URL (e.g. `https://abc123.ngrok-free.app`) and use it as the webhook endpoint in Bolna AI:
   ```
   https://abc123.ngrok-free.app/api/emergency
   ```

---

## 5. API Reference

### `POST /api/emergency`

Submit an emergency report.

**Request Body:**

```json
{
  "caller_name": "Alice",
  "caller_phone": "+919876543210",
  "victim_name": "Bob",
  "emergency_type": "Fire",
  "severity": "High",
  "location": "123 Main Street, Mumbai",
  "landmark": "Near City Hospital",
  "victims": 3,
  "description": "Smoke coming from third floor",
  "immediate_danger": "Yes",
  "summary": "Fire at 123 Main Street. 3 victims."
}
```

**Success Response (200):**

```json
{
  "status": "success",
  "message": "Emergency recorded successfully."
}
```

---

## 6. Database Schema

**Table:** `emergencies`

| Column            | Type         | Notes                |
|-------------------|--------------|----------------------|
| `id`              | INT          | Primary Key, Auto    |
| `caller_name`     | VARCHAR(255) | NOT NULL             |
| `caller_phone`    | VARCHAR(20)  | NOT NULL             |
| `victim_name`     | VARCHAR(255) | NULLABLE             |
| `emergency_type`  | VARCHAR(100) | NOT NULL             |
| `severity`        | VARCHAR(50)  | NULLABLE             |
| `location`        | VARCHAR(500) | NOT NULL             |
| `landmark`        | VARCHAR(500) | NULLABLE             |
| `victims`         | INT          | NULLABLE             |
| `description`     | TEXT         | NULLABLE             |
| `immediate_danger`| VARCHAR(10)  | NULLABLE ("Yes"/"No")|
| `summary`         | TEXT         | NULLABLE             |
| `created_at`      | DATETIME     | Default: UTC now     |

---

## 7. Useful Queries

**View all emergencies (newest first):**

```sql
USE savior_db;

SELECT
    id AS 'ID',
    caller_name AS 'Caller',
    caller_phone AS 'Phone',
    emergency_type AS 'Emergency',
    severity AS 'Severity',
    location AS 'Location',
    victims AS 'Victims',
    created_at AS 'Reported At'
FROM emergencies
ORDER BY created_at DESC;
```

**Count by emergency type:**

```sql
SELECT emergency_type, COUNT(*) AS total
FROM emergencies
GROUP BY emergency_type
ORDER BY total DESC;
```

---

## 8. Project Structure

```

savior-backend/
├── 1_setup/
│   ├── .env.example           # Environment variable template
│   ├── requirements.txt       # Python dependencies
│   └── README.md
└── app/
    ├── init.py
    ├── config.py               # Loads DATABASE_URL from .env
    ├── database.py             # SQLAlchemy engine, session, Base
    ├── models.py               # Emergency SQLAlchemy model
    ├── schemas.py              # Pydantic request/response models
    ├── crud.py                 # Database write operations
    ├── main.py                 # FastAPI app, CORS, router mount
    └── routes/
        ├── init.py
        └── emergency.py        # POST /api/emergency endpoint
```

---

