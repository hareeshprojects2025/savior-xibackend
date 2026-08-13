import logging
from math import asin, cos, radians, sin, sqrt
from typing import Any

import httpx

PHOTON_URL = "https://photon.komoot.io/api/"
USER_AGENT = "SAVIOR/1.0 (emergency dispatch demo)"

# Operating-region anchor used to bias photon queries AND sanity-check results.
# A text-geocode that lands implausibly far from here (e.g. a different state)
# is unreliable — we reject it and wait for the caller's real GPS instead of
# flagging far-away coords as outside_coverage.
ANCHOR_LAT = 15.3647
ANCHOR_LON = 75.1239
MAX_ANCHOR_DISTANCE_KM = 200.0

logger = logging.getLogger("savior.geocoding")


def _haversine_km(lat: float, lng: float) -> float:
    """Great-circle distance from the operating-region anchor to (lat, lng)."""
    r = 6371.0
    dlat = radians(lat - ANCHOR_LAT)
    dlon = radians(lng - ANCHOR_LON)
    a = sin(dlat / 2) ** 2 + cos(radians(ANCHOR_LAT)) * cos(radians(lat)) * sin(dlon / 2) ** 2
    return r * 2 * asin(sqrt(a))


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
                        "lat": ANCHOR_LAT,
                        "lon": ANCHOR_LON,
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
                    dist = _haversine_km(lat, lng)
                    if dist > MAX_ANCHOR_DISTANCE_KM:
                        logger.warning(
                            "Geocode for '%s' (%.4f, %.4f) is %.0f km from the operating region — "
                            "treating as unreliable, waiting for real GPS",
                            q, lat, lng, dist,
                        )
                        continue

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
