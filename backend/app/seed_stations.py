"""Standalone script to seed station data into the database.

Usage:
    python -m app.seed_stations
"""

import logging

from app.core.database import SessionLocal
from app.services.station_service import seed_stations

logging.basicConfig(level=logging.INFO)

if __name__ == "__main__":
    db = SessionLocal()
    try:
        n = seed_stations(db)
        print(f"Seeded {n} stations")
    finally:
        db.close()
