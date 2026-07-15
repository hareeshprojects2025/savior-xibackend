import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:password@localhost:3306/savior_db")

# Fast2SMS
FAST2SMS_API_KEY = os.getenv("FAST2SMS_API_KEY", "")

# Bolna
BOLNA_API_TOKEN = os.getenv("BOLNA_API_TOKEN", "")
BOLNA_AGENT_ID = os.getenv("BOLNA_AGENT_ID", "")

# Routing
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

# Base URL for SMS location links
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
