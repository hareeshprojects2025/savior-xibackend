import asyncio
import logging
from typing import Any

from sqlalchemy.orm import Session

from app.models.station import Station
from app.services.routing_service import compute_route

logger = logging.getLogger("savior.station")


STATION_SEED_DATA = [
    # Police stations (6)
    {"name": "Hubli Town Police Station", "type": "police", "latitude": 15.3452, "longitude": 75.1431, "address": "Durgad Bail, Broadway, Hubli, Karnataka 580028", "phone": "0836-2233540"},
    {"name": "Vidyanagar Police Station", "type": "police", "latitude": 15.3765, "longitude": 75.1220, "address": "Vidyanagar, Hubli, Karnataka 580031", "phone": "0836-2233516"},
    {"name": "Keshwapur Police Station", "type": "police", "latitude": 15.3612, "longitude": 75.1028, "address": "Kusgal Road, Keshwapur, Hubli, Karnataka 580023", "phone": "0836-2233518"},
    {"name": "Gokul Road Police Station", "type": "police", "latitude": 15.3566, "longitude": 75.1611, "address": "Near New Bus Stand, Gokul Road, Hubli, Karnataka 580030", "phone": "0836-2233525"},
    {"name": "Dharwad Town Police Station", "type": "police", "latitude": 15.4589, "longitude": 75.0078, "address": "Near Old Bus Stand, Dharwad, Karnataka 580001", "phone": "0836-2233512"},
    {"name": "Dharwad Suburban Police Station", "type": "police", "latitude": 15.4317, "longitude": 74.9856, "address": "Belagavi Road, Near DIMS Hospital, Dharwad 580001", "phone": "0836-2233511"},
    # Fire stations (5)
    {"name": "Fire Station Amargol", "type": "fire", "latitude": 15.3989, "longitude": 75.0867, "address": "Amargol, Hubli, Karnataka 580025", "phone": "101 / 0836-2323068"},
    {"name": "Fire Station Old Hubli", "type": "fire", "latitude": 15.3486, "longitude": 75.1331, "address": "Kasabapet Main Road, Old Hubli, Karnataka 580024", "phone": "101"},
    {"name": "Fire Station Dharwad", "type": "fire", "latitude": 15.4689, "longitude": 75.0194, "address": "Dharwad, Karnataka 580008", "phone": "101"},
    {"name": "Fire Station Navalur", "type": "fire", "latitude": 15.3812, "longitude": 75.1083, "address": "Navalur, Hubli, Karnataka 580025", "phone": "101"},
    {"name": "Fire Station Kalaghatagi", "type": "fire", "latitude": 15.3083, "longitude": 74.9750, "address": "Kalaghatagi, Dharwad District, Karnataka", "phone": "101"},
    # Hospitals / Medical (6)
    {"name": "KIMS District Hospital Hubli", "type": "medical", "latitude": 15.3618, "longitude": 75.1307, "address": "PB Road, Vidyanagar, Hubli, Karnataka 580021", "phone": "0836-2370057"},
    {"name": "SDM College of Medical Sciences & Hospital", "type": "medical", "latitude": 15.4184, "longitude": 75.0484, "address": "Manjushree Nagar, Sattur, Dharwad, Karnataka 580009", "phone": "0836-2477777"},
    {"name": "KLE Hospital & Medical Research Centre", "type": "medical", "latitude": 15.3942, "longitude": 75.0897, "address": "Gabbur Cross, Hubli, Karnataka 580028", "phone": "0836-2001502"},
    {"name": "District Hospital Dharwad", "type": "medical", "latitude": 15.4653, "longitude": 75.0086, "address": "Fort, Dharwad, Karnataka 580001", "phone": "0836-2747747"},
    {"name": "Shivakrupa Hospital & ICU", "type": "medical", "latitude": 15.3388, "longitude": 75.1213, "address": "Hubli, Karnataka 580020", "phone": "0836-2351011"},
    {"name": "Central Hospital South Western Railway", "type": "medical", "latitude": 15.3549, "longitude": 75.1409, "address": "Railway Colony, Hubli, Karnataka 580020", "phone": "0836-2364751"},
]


def get_stations_by_type(db: Session, emergency_type: str) -> list[Station]:
    """Query stations where type matches the emergency type (lowercase normalization)."""
    normalized_type = emergency_type.lower()
    return db.query(Station).filter(Station.type == normalized_type).all()


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


def seed_stations(db: Session) -> int:
    """Check if stations table is empty. If empty, insert seed data. Return count."""
    existing = db.query(Station).count()
    if existing > 0:
        logger.info("Stations table already has %d records — skipping seed", existing)
        return existing

    for data in STATION_SEED_DATA:
        station = Station(**data)
        db.add(station)
    db.commit()

    count = db.query(Station).count()
    logger.info("Seeded %d stations into database", count)
    return count
