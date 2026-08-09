"""Verification script for Task 2 (Station + Routing + Geospatial services)."""
import asyncio
import sys

# Import services
from app.services.station_service import rank_stations, seed_stations, get_stations_by_type
from app.services.routing_service import compute_route, _haversine_fallback, _load_graph, _encode_polyline, decode_polyline_to_coords
from app.services.geospatial_service import is_inside_coverage, get_district_for_emergency


async def main():
    print("Station + Routing + Geospatial services import OK")

    # Test haversine fallback
    result_fb = _haversine_fallback(15.36, 75.12, 15.3618, 75.1307)
    assert result_fb["distance_meters"] > 0
    print(f"Haversine fallback: {result_fb['distance_meters']}m, {result_fb['duration_seconds']}s")

    # Test polyline encode/decode
    encoded = _encode_polyline([(15.36, 75.12), (15.37, 75.13)])
    assert len(encoded) > 0
    decoded = decode_polyline_to_coords(encoded)
    assert len(decoded) == 2
    print(f"Polyline encode/decode: {encoded} -> {decoded}")

    # Test district check (Hubli center)
    inside, name = is_inside_coverage(15.36, 75.12)
    print(f"Hubli center: inside={inside}, district={name}")

    # Test district check (Bangalore - outside)
    outside, name_out = is_inside_coverage(12.97, 77.59)
    print(f"Bangalore: inside={outside}")
    assert not outside

    from app.core.config import BASE_URL
    print(f"Config: BASE_URL={BASE_URL}")

    print("\nTask 2 verification PASSED")


if __name__ == "__main__":
    asyncio.run(main())
