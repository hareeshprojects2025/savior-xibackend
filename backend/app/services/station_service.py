import asyncio
import logging
from typing import Any

from sqlalchemy.orm import Session

from app.models.station import Station
from app.services.routing_service import compute_route

logger = logging.getLogger("savior.station")


STATION_SEED_DATA = [
    # Police stations (21 — all Hubli-Dharwad city police from dharwad.nic.in)
    {"name": "Hubli Town Police Station", "type": "police", "latitude": 15.3452, "longitude": 75.1431, "address": "Broadway, Near Durgad Bail, Hubli 580028", "phone": "0836-2233540"},
    {"name": "Bendigeri Police Station", "type": "police", "latitude": 15.3405, "longitude": 75.1410, "address": "Settlement Hubli, Near Nehru College, Ghantikeri Oni, Hubli 580020", "phone": "0836-2233526"},
    {"name": "Ghantikeri Police Station", "type": "police", "latitude": 15.3458, "longitude": 75.1485, "address": "Javali Sal, Hubli 580024", "phone": "0836-2233527"},
    {"name": "Kasabapet Police Station", "type": "police", "latitude": 15.3382, "longitude": 75.1532, "address": "Near Sadarsofa Bridge, Kasaba Main Road, Old Hubli 580024", "phone": "0836-2233536"},
    {"name": "Old Hubli Police Station", "type": "police", "latitude": 15.3340, "longitude": 75.1580, "address": "Near Indipump Circle, Karwar Road, Old Hubli 580024", "phone": "0836-2233541"},
    {"name": "Vidyanagar Police Station", "type": "police", "latitude": 15.3610, "longitude": 75.1260, "address": "Opp PC Jabin College, Vidyanagar, Hubli 580031", "phone": "0836-2233516"},
    {"name": "Gokul Road Police Station", "type": "police", "latitude": 15.3493, "longitude": 75.1164, "address": "Near New Bus Stand, Gokul Road, Hubli 580030", "phone": "0836-2233525"},
    {"name": "Hubli Sub-urban Police Station", "type": "police", "latitude": 15.3507, "longitude": 75.1393, "address": "Near Brindavan Circle, Lamington Road, Hubli 580020", "phone": "0836-2233517"},
    {"name": "Kamaripet Police Station", "type": "police", "latitude": 15.3530, "longitude": 75.1350, "address": "Near Irkal Petrol Pump, PB Road, Hubli 580020", "phone": "0836-2233519"},
    {"name": "Keshwapur Police Station", "type": "police", "latitude": 15.3570, "longitude": 75.1170, "address": "Near Ramesh Bhavan, Keshwapur, Hubli 580023", "phone": "0836-2233518"},
    {"name": "Women Police Station Hubli", "type": "police", "latitude": 15.3505, "longitude": 75.1390, "address": "Near Brindavan Circle, Lamington Road, Hubli 580020", "phone": "0836-2233514"},
    {"name": "Dharwad Town Police Station", "type": "police", "latitude": 15.4580, "longitude": 75.0070, "address": "Near Old Bus-stand, Subhash Road, Dharwad 580001", "phone": "0836-2233512"},
    {"name": "Vidyagiri Police Station", "type": "police", "latitude": 15.4650, "longitude": 75.0020, "address": "Kalagatagi Road, Saraswatapur, Dharwad 580001", "phone": "0836-2233513"},
    {"name": "Dharwad Sub-urban Police Station", "type": "police", "latitude": 15.4500, "longitude": 75.0150, "address": "Belagavi Road, Near DIMS Hospital, Dharwad 580001", "phone": "0836-2233511"},
    {"name": "Dharwad Traffic Police Station", "type": "police", "latitude": 15.4550, "longitude": 75.0120, "address": "Vivekanand Circle, Near Tahasildar Office, Dharwad 580001", "phone": "0836-2233542"},
    {"name": "North Traffic Police Station Hubli", "type": "police", "latitude": 15.3560, "longitude": 75.1320, "address": "Near New Cotton Market, Hubli 580029", "phone": "0836-2233515"},
    {"name": "South Traffic Police Station Hubli", "type": "police", "latitude": 15.3450, "longitude": 75.1400, "address": "Near New English Medium School, PB Road, Hubli 580020", "phone": "0836-2233538"},
    {"name": "APMC Navanagar Police Station", "type": "police", "latitude": 15.3660, "longitude": 75.1060, "address": "Near Navanagar Market, Hubli 580025", "phone": "0836-2233492"},
    {"name": "Ashok Nagar Police Station", "type": "police", "latitude": 15.3580, "longitude": 75.1050, "address": "Adharshanagar Main Road, Vishweshwar Nagar, Hubli 580032", "phone": "0836-2233490"},
    {"name": "East Traffic Police Station Hubli", "type": "police", "latitude": 15.3580, "longitude": 75.1200, "address": "Kusgal Road, Opp Post Office, Keshwapur, Hubli 580023", "phone": "0836-2233543"},
    {"name": "Cyber Crime Police Station Hubli-Dharwad", "type": "police", "latitude": 15.3440, "longitude": 75.1460, "address": "Opp Nehru College, Ghantikeri, Hubli 580020", "phone": "0836-2233567"},
    # Fire stations (5 — all known HD-area fire stations)
    {"name": "Fire Station Amargol", "type": "fire", "latitude": 15.3780, "longitude": 75.0920, "address": "Amargol, Hubli, Karnataka 580025", "phone": "0836-2322555"},
    {"name": "Fire Station Old Hubli", "type": "fire", "latitude": 15.3370, "longitude": 75.1550, "address": "Old Hubli Area, Hubli, Karnataka 580024", "phone": ""},
    {"name": "Dharwad Fire Station (CFO Hubli Zone)", "type": "fire", "latitude": 15.4520, "longitude": 75.0180, "address": "Dharwad, Karnataka 580008", "phone": "0836-2794555"},
    {"name": "Hubli Fire Station (HDMC)", "type": "fire", "latitude": 15.3540, "longitude": 75.1340, "address": "Under HDMC, Hubli, Karnataka", "phone": "0836-2352045"},
    {"name": "Fire Station Navanagar", "type": "fire", "latitude": 15.3650, "longitude": 75.1080, "address": "Navanagar, Hubli, Karnataka 580025", "phone": ""},
    # Hospitals / Medical (11 — emergency/trauma capable)
    {"name": "KIMS (Karnataka Institute of Medical Sciences)", "type": "medical", "latitude": 15.3617, "longitude": 75.1323, "address": "PB Road, Vidyanagar, Hubli 580022", "phone": "0836-2374624"},
    {"name": "SDM College of Medical Sciences & Hospital", "type": "medical", "latitude": 15.4400, "longitude": 75.0350, "address": "Manjushree Nagar, Sattur, Dharwad 580009", "phone": "0836-2477777"},
    {"name": "Sushruta Hospital", "type": "medical", "latitude": 15.3640, "longitude": 75.1250, "address": "PB Road, Vidyanagar, Hubli 580021", "phone": "0836-2378600"},
    {"name": "Balaji Institute of Neuro Sciences & Trauma", "type": "medical", "latitude": 15.3620, "longitude": 75.1280, "address": "Vidyanagar, Hubli, Karnataka", "phone": ""},
    {"name": "Railway Hospital (South Western Railway)", "type": "medical", "latitude": 15.3538, "longitude": 75.1500, "address": "Gadag Road, Keshwapur, Hubli 580023", "phone": ""},
    {"name": "Our Lady of Lourdes Charitable Hospital", "type": "medical", "latitude": 15.3480, "longitude": 75.1420, "address": "Hubli, Karnataka", "phone": ""},
    {"name": "Civil Hospital Dharwad", "type": "medical", "latitude": 15.4580, "longitude": 75.0050, "address": "Killa, Opposite Karnataka High School, Dharwad 580004", "phone": "0836-2448111"},
    {"name": "ESI Hospital Dharwad", "type": "medical", "latitude": 15.4620, "longitude": 75.0080, "address": "Near Hubli Toll Naka, Saraswathpura, Dharwad 580002", "phone": "0836-2440316"},
    {"name": "Hubli Super Speciality Hospital", "type": "medical", "latitude": 15.3590, "longitude": 75.1220, "address": "Lingarajnagar, Hubli, Karnataka", "phone": "09989966980"},
    {"name": "Ashoka Hospital", "type": "medical", "latitude": 15.3620, "longitude": 75.1300, "address": "Behind Amrut Theatre, Vidyanagar, Hubli", "phone": ""},
    {"name": "HCG Suchirayu Hospital", "type": "medical", "latitude": 15.3500, "longitude": 75.1180, "address": "Gokul Road, Opposite KSRTC Bus Depot, Kallur Layout, Hubli", "phone": ""},
    # Rescue teams (3 — for floods, building collapse, accidents)
    {"name": "NDRF Team Hubli", "type": "rescue", "latitude": 15.3700, "longitude": 75.1000, "address": "Amargol, Hubli, Karnataka", "phone": "0836-2226789"},
    {"name": "SDRF Dharwad Unit", "type": "rescue", "latitude": 15.4600, "longitude": 75.0500, "address": "Near Dharwad Bus Stand, Dharwad, Karnataka", "phone": ""},
    {"name": "Fire & Rescue Amargol", "type": "rescue", "latitude": 15.3800, "longitude": 75.0950, "address": "Amargol Industrial Area, Hubli, Karnataka", "phone": "0836-2322550"},
]


EMERGENCY_TYPE_MAP = {
    "accident": ["medical", "rescue"],
    "flood": ["fire", "rescue"],
    "building collapse": ["fire", "rescue"],
    "wildlife": ["police"],
}

def get_stations_by_type(db: Session, emergency_type: str) -> list[Station]:
    normalized_type = emergency_type.lower()
    station_types = EMERGENCY_TYPE_MAP.get(normalized_type, [normalized_type])
    return db.query(Station).filter(Station.type.in_(station_types)).all()


async def rank_stations(
    db: Session,
    emergency_lat: float,
    emergency_lng: float,
    emergency_type: str,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """Get matching-type stations, compute routes concurrently, sort by ETA, return top N."""
    stations = get_stations_by_type(db, emergency_type)
    if not stations:
        logger.warning("No stations found for emergency type '%s'", emergency_type)
        return []

    # Compute routes concurrently for all stations
    async def _compute(station: Station) -> dict[str, Any] | None:
        route = await compute_route(
            emergency_lat, emergency_lng,
            station.latitude, station.longitude,
        )
        if route is None:
            return None
        return {
            "station": station,
            "distance_km": round(route["distance_meters"] / 1000, 2),
            "eta_minutes": round(route["duration_seconds"] / 60, 1),
            "encoded_polyline": route["encoded_polyline"],
        }

    tasks = [_compute(s) for s in stations]
    results = await asyncio.gather(*tasks)

    # Filter None (failed routes) and sort by ETA
    valid_results = [r for r in results if r is not None]
    valid_results.sort(key=lambda r: r["eta_minutes"])
    return valid_results[:limit]


def seed_stations(db: Session, force: bool = False) -> int:
    """Check if stations table is empty. If empty, insert seed data. Return count.
    If force=True, clear existing stations and re-seed."""
    existing = db.query(Station).count()
    if existing > 0 and not force:
        logger.info("Stations table already has %d records — skipping seed", existing)
        return existing

    if force and existing > 0:
        logger.info("Force re-seed: clearing %d existing stations", existing)
        db.query(Station).delete()
        db.commit()

    for data in STATION_SEED_DATA:
        station = Station(**data)
        db.add(station)
    db.commit()

    count = db.query(Station).count()
    logger.info("Seeded %d stations into database", count)
    return count
