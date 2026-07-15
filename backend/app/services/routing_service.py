import logging
import math
import os
from typing import Any

import polyline

logger = logging.getLogger("savior.routing")

GRAPHML_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "hubli-dharwad.graphml")
)

_graph_cache = None


def _load_graph():
    """Load OSMnx graph from cache or download. Module-level singleton."""
    global _graph_cache
    if _graph_cache is not None:
        return _graph_cache

    if os.path.exists(GRAPHML_PATH):
        try:
            import osmnx as ox
            G = ox.load_graphml(GRAPHML_PATH)
            _graph_cache = G
            logger.info("Loaded OSMnx graph from cache (%d nodes, %d edges)", G.number_of_nodes(), G.number_of_edges())
            return G
        except Exception as e:
            logger.warning("Failed to load cached OSMnx graph: %s", e)

    # Download and cache
    try:
        import osmnx as ox
        logger.info("Downloading OSMnx graph for Hubli-Dharwad, India...")
        G = ox.graph_from_place("Hubli-Dharwad, India", network_type="drive")
        G = ox.add_edge_travel_times(G)
        os.makedirs(os.path.dirname(GRAPHML_PATH), exist_ok=True)
        ox.save_graphml(G, GRAPHML_PATH)
        _graph_cache = G
        logger.info("OSMnx graph downloaded and cached (%d nodes, %d edges)", G.number_of_nodes(), G.number_of_edges())
        return G
    except Exception as e:
        logger.error("Failed to download OSMnx graph: %s", e)
        return None


async def compute_route(
    origin_lat: float, origin_lng: float,
    dest_lat: float, dest_lng: float,
) -> dict[str, Any] | None:
    """Compute road-aware route using OSMnx + NetworkX A* (no API key needed).
    Falls back to Haversine on any failure."""
    G = _load_graph()
    if G is None:
        logger.warning("OSMnx graph not available — using Haversine fallback")
        return _haversine_fallback(origin_lat, origin_lng, dest_lat, dest_lng)

    try:
        import osmnx as ox
        import networkx as nx

        orig_node = ox.distance.nearest_nodes(G, origin_lng, origin_lat)
        dest_node = ox.distance.nearest_nodes(G, dest_lng, dest_lat)

        route = nx.shortest_path(G, orig_node, dest_node, weight="travel_time")

        total_dist = sum(G[u][v][0].get("length", 0) for u, v in zip(route[:-1], route[1:]))
        total_time = sum(G[u][v][0].get("travel_time", 0) for u, v in zip(route[:-1], route[1:]))

        coords = [(G.nodes[n]["y"], G.nodes[n]["x"]) for n in route]
        encoded = _encode_polyline(coords)

        return {
            "distance_meters": round(total_dist),
            "duration_seconds": round(total_time),
            "encoded_polyline": encoded,
        }
    except Exception as e:
        logger.warning("OSMnx routing failed: %s — using Haversine fallback", e)
        return _haversine_fallback(origin_lat, origin_lng, dest_lat, dest_lng)


def _haversine_fallback(
    lat1: float, lng1: float, lat2: float, lng2: float,
) -> dict[str, Any]:
    """Haversine great-circle distance with estimated drive time (40 km/h avg)."""
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = R * c
    estimated_speed = 11.11  # 40 km/h in m/s

    return {
        "distance_meters": round(distance),
        "duration_seconds": round(distance / estimated_speed),
        "encoded_polyline": "",
    }


def _encode_polyline(coords: list[tuple[float, float]]) -> str:
    """Encode coordinate array to Google-encoded polyline format."""
    # polyline expects (latitude, longitude) tuples
    return polyline.encode(coords)


def decode_polyline_to_coords(encoded: str) -> list[tuple[float, float]]:
    """Decode an encoded polyline to list of (lat, lng) tuples."""
    return polyline.decode(encoded)  # type: ignore[arg-type]
