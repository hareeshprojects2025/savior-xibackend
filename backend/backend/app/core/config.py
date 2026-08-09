import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:password@localhost:3306/savior_db")

# Twilio
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")

# Bolna
BOLNA_API_TOKEN = os.getenv("BOLNA_API_TOKEN") or os.getenv("BOLNA_API_Key", "")
BOLNA_AGENT_ID = os.getenv("BOLNA_AGENT_ID", "")
BOLNA_DISPATCH_AGENT_ID = os.getenv("BOLNA_DISPATCH_AGENT_ID", "")

# Base URL for SMS location links
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
