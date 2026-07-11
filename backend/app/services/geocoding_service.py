import asyncio
import httpx

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "SAVIOR/1.0 (emergency dispatch demo)"

async def geocode_location(location: str) -> tuple[float, float] | None:
    if not location or not location.strip():
        return None
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                NOMINATIM_URL,
                params={"q": location, "format": "json", "limit": 1},
                headers={"User-Agent": USER_AGENT},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            if data and len(data) > 0:
                lat = float(data[0]["lat"])
                lng = float(data[0]["lon"])
                return (lat, lng)
    except Exception:
        pass
    return None
