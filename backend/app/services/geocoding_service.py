import asyncio
import logging

import httpx

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "SAVIOR/1.0 (emergency dispatch demo)"

logger = logging.getLogger("savior.geocoding")

async def geocode_location(location: str, landmark: str | None = None) -> tuple[float, float] | None:
    if not location or not location.strip():
        return None

    queries = [location]
    if landmark and landmark.strip():
        queries.append(f"{location}, {landmark}")

    for q in queries:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    NOMINATIM_URL,
                    params={"q": q, "format": "json", "limit": 1},
                    headers={"User-Agent": USER_AGENT},
                    timeout=10,
                )
                resp.raise_for_status()
                data = resp.json()
                if data and len(data) > 0:
                    lat = float(data[0]["lat"])
                    lng = float(data[0]["lon"])
                    logger.info("Geocoded '%s' → (%s, %s)", q, lat, lng)
                    return (lat, lng)
                logger.warning("No results for '%s'", q)
        except Exception as e:
            logger.warning("Geocoding failed for '%s': %s", q, e)

    return None
