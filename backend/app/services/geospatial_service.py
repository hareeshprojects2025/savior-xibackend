import json
import logging
import os

from shapely.geometry import Point, shape

logger = logging.getLogger("savior.geospatial")

GEOJSON_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "districts.geojson")
)

_district_polygons: list[dict] | None = None


def _load_districts() -> list[dict]:
    """Load and cache district polygons from GeoJSON file at module level."""
    global _district_polygons
    if _district_polygons is not None:
        return _district_polygons

    if not os.path.exists(GEOJSON_PATH):
        logger.warning("GeoJSON file not found at %s", GEOJSON_PATH)
        _district_polygons = []
        return _district_polygons

    with open(GEOJSON_PATH, "r") as f:
        data = json.load(f)

    _district_polygons = []
    for feature in data.get("features", []):
        try:
            polygon = shape(feature["geometry"])
            name = feature.get("properties", {}).get("name", "Unknown")
            _district_polygons.append({"name": name, "polygon": polygon})
        except Exception as e:
            logger.warning("Failed to parse GeoJSON feature: %s", e)

    logger.info("Loaded %d district polygons", len(_district_polygons))
    return _district_polygons


def is_inside_coverage(lat: float, lng: float) -> tuple[bool, str]:
    """Check if a point is inside any known district boundary.
    Returns (is_inside, district_name).
    CRITICAL: GeoJSON uses (longitude, latitude) order — Point(lng, lat)."""
    point = Point(lng, lat)  # GeoJSON is (longitude, latitude) order!
    districts = _load_districts()
    for dist in districts:
        if dist["polygon"].contains(point):
            return True, dist["name"]
    return False, "outside_coverage"


def get_district_for_emergency(lat: float, lng: float) -> dict:
    """Returns district check info for an emergency location."""
    is_inside, district = is_inside_coverage(lat, lng)
    return {
        "in_coverage_area": is_inside,
        "district": district,
        "requires_manual_review": not is_inside,
    }
