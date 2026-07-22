import logging
from typing import Any

import httpx

PHOTON_URL = "https://photon.komoot.io/api/"
USER_AGENT = "SAVIOR/1.0 (emergency dispatch demo)"

logger = logging.getLogger("savior.geocoding")


async def geocode_location(location: str, landmark: str | None = None) -> dict[str, Any] | None:
    if not location or not location.strip():
        return None

    queries = [location]
    if landmark and landmark.strip():
        queries.append(f"{location}, {landmark}")

    for q in queries:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    PHOTON_URL,
                    params={
                        "q": q,
                        "limit": 1,
                        "lang": "en",
                        "countrycode": "IN",
                        "lat": 15.3647,
                        "lon": 75.1239,
                    },
                    headers={"User-Agent": USER_AGENT},
                    timeout=10,
                )
                resp.raise_for_status()
                data = resp.json()
                features = data.get("features", [])
                if features:
                    props = features[0].get("properties", {})
                    coords = features[0]["geometry"]["coordinates"]
                    lng, lat = float(coords[0]), float(coords[1])
                    logger.info("Geocoded '%s' → (%s, %s) name='%s'", q, lat, lng, props.get("name", ""))

                    return {
                        "lat": lat,
                        "lng": lng,
                        "place_name": props.get("name"),
                        "osm_type": props.get("osm_type"),
                        "osm_key": props.get("osm_key"),
                        "city": props.get("city") or props.get("locality"),
                        "state": props.get("state"),
                        "street": props.get("street"),
                        "postcode": props.get("postcode"),
                        "country": props.get("country"),
                    }
                logger.warning("No results for '%s'", q)
        except Exception as e:
            logger.warning("Geocoding failed for '%s': %s", q, e)

    return None
