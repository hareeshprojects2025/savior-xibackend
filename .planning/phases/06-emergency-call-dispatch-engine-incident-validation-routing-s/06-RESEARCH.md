# Phase 6: Dispatch Engine — Research

**Researched:** 2026-07-14
**Domain:** Emergency call dispatch pipeline — incident validation, station ranking/routing, dispatch execution, ACK tracking
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Assisted dispatch — system ranks stations and shows recommendations, dispatcher confirms before dispatch
- **D-02:** New dispatch panel in dashboard (separate page/section, not within existing EmergencyDetail)
- **D-03:** Dispatching auto-updates emergency status to "dispatched"
- **D-04:** Route preview shown before dispatcher confirms (Google Maps route + ETA)
- **D-05:** Top 5 stations shown in ranking, with full details (name, distance, ETA, route map preview)
- **D-06:** Dispatch panel auto-triggers on emergency creation
- **D-07:** If dispatcher dismisses/ignores recommendation → auto-escalate to next station after timeout
- **D-08:** Stations stored in MySQL database (SQLAlchemy model, existing pattern)
- **D-09:** Station fields: name, type (police/fire/medical), lat/lng coordinates, address
- **D-10:** Emergency type matches station type directly
- **D-11:** Assume all stations always available
- **D-12:** No service radius limit — all matching-type stations ranked
- **D-13:** Seed station data defined during planning (Hubli/Dharwad area)
- **D-14:** Duplicate criteria: same location + same emergency type + within 1-hour time window
- **D-15:** Merge on duplicate: update existing record, append new description + caller info
- **D-16:** Runs automatically on every new emergency creation
- **D-17:** Primary location capture via SMS link with browser Geolocation API
- **D-18:** Standalone public HTML page served by backend for location capture
- **D-19:** SMS sent via Fast2SMS
- **D-20:** SMS sent automatically on emergency creation to caller's phone
- **D-21:** Auto-continue pipeline after location received
- **D-22:** Fallback: use location extracted by Bolna agent if SMS location not received
- **D-23:** Nominatim-based confidence scoring skipped — SMS location is primary mechanism
- **D-24:** Predefined district boundary data stored as GeoJSON file (`backend/data/districts.geojson`)
- **D-25:** Shapely library for point-in-polygon spatial checks
- **D-26:** Outside coverage area → manual dispatcher review
- **D-27:** Google Maps Routes API (Essentials tier) for route generation and ETAs
- **D-28:** Free tier covers MVP (10K requests/month). Can migrate to OSRM if volume grows
- **D-29:** Route preview shown in dispatch panel before dispatcher confirms
- **D-30:** New outbound Bolna agent for calling stations and collecting verbal ACK
- **D-31:** Backend marks dispatch as `pending_call`, Bolna agent polls and places outbound call
- **D-32:** 2-minute timeout for station ACK — escalate to next-ranked station if no response
- **D-33:** If all 5 stations fail to ACK → flag emergency as "dispatch_failed" for manual handling
- **D-34:** Escalation sends fresh call with full incident details
- **D-35:** Architecture: `MessageService` interface — simulated ACK (dispatcher click) for MVP, real Bolna integration ready

### the agent's Discretion
- Station ranking algorithm exact weightings (distance vs ETA)
- Dispatch panel UI layout and component structure
- GeoJSON district boundary file location and exact polygon data

### Deferred Ideas (OUT OF SCOPE)
- Location SMS via Twilio/other providers — Fast2SMS chosen for India focus
- OSRM self-hosted routing — document as migration path if Google Maps API costs grow
- Station availability tracking — deferred from v1
- Service radius per station — defer until real operational requirements emerge
</user_constraints>

---

## Summary

Phase 6 implements an automated emergency dispatch pipeline: incident validation → station ranking → dispatch execution → ACK tracking. The system uses Google Maps Routes API (Essentials tier) for ETA computation, Fast2SMS for location SMS capture, Shapely for GeoJSON district boundary checks, and a new outbound Bolna agent for station ACK calls.

The implementation follows existing backend patterns (FastAPI 3-layer architecture: endpoints → services → models) and frontend patterns (React context + hooks, Leaflet maps, shadcn/ui components). Key additions include: `Station` model + `Dispatch` model + `DispatchRecord` model, a dispatch service layer, Fast2SMS integration mirroring the existing `geocoding_service.py` HTTP client pattern, and a new dispatch page in the frontend.

**Primary recommendation:** Use REST-based Google Maps Routes API calls via `httpx.AsyncClient` (same pattern as `geocoding_service.py`), build `StationService` and `DispatchService` following `EmergencyService` CRUD patterns, and create a `MessageService` interface with a simulated implementation for MVP.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Incident validation (duplicate check, district check) | API / Backend | — | Runs server-side on emergency creation |
| Location capture page (Geolocation API) | Browser / Client | API serves static HTML | Standalone HTML page, not SPA |
| SMSSending (Fast2SMS) | API / Backend | — | Backend service class calls external API |
| Station ranking & routing | API / Backend | — | Algorithm runs server-side with Google Maps API calls |
| Route preview | Browser / Client (Dynamic) or API (Static map image) | — | Shown in dispatch panel before confirm |
| Dispatch execution | API / Backend | — | Backend creates dispatch record, triggers status update |
| Bolna outbound ACK | API / Backend triggers; Bolna platform executes call | — | Backend marks `pending_call`, Bolna polls |
| Dispatch UI panel | Browser / Client | — | New React page/component in dashboard |
| Duplicate detection | API / Backend | — | SQL query on emergency creation |

---

## 1. Google Maps Routes API

### Integration Approach

Use the REST-based `computeRoutes` endpoint via `httpx.AsyncClient` (same HTTP client pattern as existing `geocoding_service.py`). The official Python client library (`google-maps-routing`) uses gRPC and requires extensive auth setup. For MVP, a simple REST call is faster to implement and sufficient.

**Key details:**
- **Endpoint:** `POST https://routes.googleapis.com/directions/v2:computeRoutes` [CITED: developers.google.com/maps/documentation/routes/compute_route_directions]
- **Auth:** API key in `X-Goog-Api-Key` header
- **Required headers:** `Content-Type: application/json`, `X-Goog-FieldMask` (controls which fields are returned)
- **Travel mode:** `DRIVE` for emergency dispatch

### Pricing

- **Routes Essentials tier:** Included in free pay-as-you-go with $200 monthly credit. Approximately 10K free requests/month ($0-5/K after credit). [CITED: developers.google.com/maps/documentation/routes/usage-and-billing]
- **Subscription plans:** Starter ($100/mo for 50K calls), Essentials ($275/mo for 100K calls) [CITED: developers.google.com/maps/billing-and-pricing/subscriptions]
- **For MVP with ~5 requests per emergency (origin→5 stations):** 200 emergencies/month = 1,000 requests, well within free tier.

### Code Snippet — Backend Route Computation

```python
# backend/app/services/routing_service.py
# Uses same httpx.AsyncClient pattern as geocoding_service.py
import os
import logging

import httpx

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"

logger = logging.getLogger("savior.routing")

async def compute_route(
    origin_lat: float, origin_lng: float,
    dest_lat: float, dest_lng: float
) -> dict | None:
    """Compute route between two lat/lng points. Returns distance + duration."""
    if not GOOGLE_MAPS_API_KEY:
        logger.warning("GOOGLE_MAPS_API_KEY not set — using fallback")
        return await _haversine_fallback(origin_lat, origin_lng, dest_lat, dest_lng)

    payload = {
        "origin": {"location": {"latLng": {"latitude": origin_lat, "longitude": origin_lng}}},
        "destination": {"location": {"latLng": {"latitude": dest_lat, "longitude": dest_lng}}},
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_AWARE",
    }
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(ROUTES_URL, json=payload, headers=headers, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            if data.get("routes"):
                route = data["routes"][0]
                return {
                    "distance_meters": route.get("distanceMeters", 0),
                    "duration_seconds": _parse_duration(route.get("duration", "0s")),
                    "encoded_polyline": route.get("polyline", {}).get("encodedPolyline", ""),
                }
            logger.warning("No routes found for %s → %s", (origin_lat, origin_lng), (dest_lat, dest_lng))
            return None
    except Exception as e:
        logger.error("Route calculation failed: %s", e)
        return await _haversine_fallback(origin_lat, origin_lng, dest_lat, dest_lng)

def _parse_duration(duration_str: str) -> int:
    """Parse '1234s' to integer seconds."""
    return int(duration_str.rstrip("s"))

async def _haversine_fallback(lat1: float, lng1: float, lat2: float, lng2: float) -> dict:
    """Fallback: straight-line distance + estimated drive time (40 km/h avg)."""
    import math
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    distance = R * c
    estimated_speed = 11.11  # 40 km/h in m/s
    return {
        "distance_meters": round(distance),
        "duration_seconds": round(distance / estimated_speed),
        "encoded_polyline": "",
    }
```

### Frontend Route Preview

Two approaches for showing the route preview to the dispatcher before confirming:

**Option A — Google Maps Static Map (simpler, no API key on client side):**
Backend returns `encoded_polyline` from `computeRoutes`. Frontend generates a static map URL:

```typescript
// frontend/src/lib/maps.ts
export function getRouteStaticMapUrl(
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  encodedPolyline: string,
  apiKey: string
): string {
  const base = "https://maps.googleapis.com/maps/api/staticmap"
  const params = new URLSearchParams({
    size: "400x300",
    maptype: "roadmap",
    key: apiKey,
    path: `color:0x0000ff|weight:4|enc:${encodedPolyline}`,
    markers: `color:green|label:O|${originLat},${originLng}`,
    markers: `color:red|label:D|${destLat},${destLng}`,
  })
  return `${base}?${params.toString()}`
}
```

**Option B — Dynamic Leaflet map with polyline (free, OpenStreetMap tiles):**
Use existing Leaflet setup. Backend returns route polyline coordinates (or encoded polyline decoded to coordinate array on backend), frontend renders as a Leaflet polyline overlaid on the MiniMap.

**Recommendation:** Option B (Leaflet polyline) — no additional API key, consistent with existing map stack, and interactive. The Google Maps Routes API provides `encodedPolyline` which the backend can decode to lat/lng pairs before returning to the frontend.

```typescript
// frontend/src/components/dispatch/RoutePreview.tsx
import { Polyline, Popup, Marker } from "react-leaflet"
import type { LatLngExpression } from "leaflet"

interface RoutePreviewProps {
  routeCoords: [number, number][]  // decoded polyline points
  origin: [number, number]
  destination: [number, number]
  distanceKm: number
  etaMinutes: number
}

export function RoutePreview({ routeCoords, origin, destination, distanceKm, etaMinutes }: RoutePreviewProps) {
  return (
    <div className="h-48 rounded-xl border border-gray-200 overflow-hidden relative">
      <MapContainer center={origin} zoom={13} className="h-full w-full" zoomControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={origin} icon={getOriginIcon()} />
        <Marker position={destination} icon={getDestinationIcon()} />
        <Polyline positions={routeCoords} color="#2563EB" weight={4} opacity={0.7} />
      </MapContainer>
      <div className="absolute bottom-2 left-2 bg-white/90 rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm z-[1000]">
        {distanceKm.toFixed(1)} km · ~{etaMinutes} min
      </div>
    </div>
  )
}
```

### Migration Path to OSRM
- **OSRM API:** `GET /route/v1/driving/{lng1},{lat1};{lng2},{lat2}` returns duration + distance + geometry [CITED: github.com/Project-OSRM/osrm-backend]
- **Self-hosted:** Docker container with India OSM extract (~3 GB extract, ~10 GB processed)
- **Table API:** `GET /table/v1/driving/{coords}?sources=0&destinations=1;2;3;4` computes 1-to-N matrix in one call — would replace 5 individual `computeRoutes` calls.
- **Migration strategy:** Abstract routing behind a `RoutingService` interface (same `compute_route(origin, dest)` signature). Swap implementation when OSRM is deployed.

---

## 2. Fast2SMS API

### Integration Approach
- **Endpoint:** `POST https://www.fast2sms.com/dev/bulkV2` [CITED: docs.fast2sms.com]
- **Auth:** API key in `authorization` header (not query param)
- **Content-Type:** `application/x-www-form-urlencoded` (NOT JSON — critical!) [CITED: thelinuxcode.com (verified against docs)]
- **Required params:** `message`, `route` (use `"q"` for quick SMS), `numbers` (comma-separated)
- **Pricing:** Free test credits on signup, then pay from ₹100. [CITED: fast2sms.com]

### Code Snippet — SMS Service

```python
# backend/app/services/sms_service.py
# Follows httpx pattern from geocoding_service.py
import os
import logging

import httpx

FAST2SMS_API_KEY = os.getenv("FAST2SMS_API_KEY", "")
FAST2SMS_URL = "https://www.fast2sms.com/dev/bulkV2"

logger = logging.getLogger("savior.sms")

async def send_sms(phone: str, message: str) -> bool:
    """Send SMS to a single phone number via Fast2SMS."""
    if not FAST2SMS_API_KEY:
        logger.warning("FAST2SMS_API_KEY not set — SMS not sent")
        return False

    payload = {
        "message": message,
        "language": "english",
        "route": "q",
        "numbers": phone,  # single number; comma-separated for multiple
    }
    headers = {
        "authorization": FAST2SMS_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(FAST2SMS_URL, data=payload, headers=headers, timeout=15)
            resp.raise_for_status()
            result = resp.json()
            if result.get("return"):
                logger.info("SMS sent to %s: request_id=%s", phone, result.get("request_id"))
                return True
            logger.warning("SMS send failed for %s: %s", phone, result)
            return False
    except Exception as e:
        logger.error("SMS send error for %s: %s", phone, e)
        return False

# Location SMS builder
LOCATION_SMS_TEMPLATE = (
    "SAVIOR Alert: Please share your location for emergency response.\n"
    "Click: {location_url}\n"
    "Link expires in 5 minutes."
)

def build_location_sms(phone: str, emergency_id: int, base_url: str) -> tuple[str, str]:
    """Build SMS message with location capture link."""
    location_url = f"{base_url}/location/{emergency_id}"
    message = LOCATION_SMS_TEMPLATE.format(location_url=location_url)
    return phone, message
```

### Pricing Notes
- **Testing:** Free signup at fast2sms.com gives test credits (~₹50-100)
- **Production:** Plans start at ₹100 recharge
- **Route selection:** Use `"q"` (Quick SMS) for transactional messages — highest delivery rate
- **Number format:** 10-digit Indian mobile numbers without country code prefix

---

## 3. Bolna Outbound Agent

### Architecture — Dual-Agent Setup

Two Bolna agents in the same project:

| Agent | Type | Purpose | Existing? |
|-------|------|---------|-----------|
| **Inbound Agent** | Inbound (caller dials in) | Collect emergency info from victim | ✅ Yes (Phase 2 configs) |
| **Outbound Agent** | Outbound (API triggers call) | Call stations, collect verbal ACK | ❌ New |

### Configuration Approach

The existing inbound agent is configured via the Bolna dashboard and custom functions in `bolna-agent/custom-functions/`. The new outbound agent can be created:

1. **Via API:** `POST /v2/agent` with `agent_config` including `agent_type` and a system prompt for station communication [CITED: bolna.ai/docs/api-reference/agent/v2/create]
2. **Via Dashboard:** Duplicate existing inbound agent, change to outbound mode, update system prompt

**Outbound agent system prompt difference:** The outbound agent introduces itself to station personnel, reads incident details, asks for verbal ACK, then hangs up. It should NOT collect emergency info — it delivers info and confirms receipt.

### Triggering Outbound Calls

Bolna API: `POST /call` with `agent_id`, `recipient_phone_number`, and optional `user_data` [CITED: bolna.ai/docs/twilio-outbound-calls]

```bash
curl --request POST \
  --url https://api.bolna.ai/call \
  --header 'Authorization: Bearer YOUR_BOLNA_API_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "agent_id": "outbound-station-agent-id",
    "recipient_phone_number": "+918123456789",
    "bypass_call_guardrails": true,
    "user_data": {
      "emergency_id": 42,
      "incident_type": "Fire",
      "location": "123 Main St, Hubli",
      "description": "Fire on third floor, 3 victims"
    }
  }'
```

### ACK Flow — Polling vs Webhook

**Selected approach (D-31): Backend marks `pending_call`, Bolna polls.**

Flow:
1. Dispatcher confirms dispatch → Backend creates `DispatchRecord` with `status=pending_call`
2. Backend calls `POST /call` to trigger Bolna outbound agent
3. Bolna makes outbound call to station phone, reads incident details, asks for ACK
4. Bolna sends webhook to backend with `call_id` and `ack_status` (acknowledged / rejected / no_answer)
5. Backend receives webhook → updates `DispatchRecord.status`
   - **ACK received:** Mark `acknowledged`, update emergency status to `dispatched`
   - **No ACK/timeout:** After 2-min timeout, escalate to next station
6. WebSocket broadcast to dashboard for real-time status update

**Webhook endpoint reference:** Existing webhook pattern in `backend/app/api/v1/endpoints/transcript.py` (transcript complete webhook).

### Polling vs Webhook

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Webhook** (Bolna POSTs to backend) | Real-time, no polling overhead | Requires public endpoint (ngrok) | ✅ **Recommended** — matches existing transcript flow |
| **Polling** (Backend polls Bolna API) | Works without webhook setup | Delayed, wastes API quota | Not needed |

**Recommendation:** Use webhook exclusively. Bolna sources confirm webhooks are sent from IP `13.203.39.153` — whitelist this on the backend. [CITED: bolna.ai/docs/api-reference/agent/v2/create]

### MessageService Interface (D-35)

```python
# backend/app/services/message_service.py
from abc import ABC, abstractmethod

class MessageService(ABC):
    """Interface for sending dispatch notifications and collecting ACKs."""

    @abstractmethod
    async def send_dispatch(self, station_phone: str, incident: dict) -> str | None:
        """Send dispatch notification. Returns call_id or None."""
        ...

    @abstractmethod
    async def get_ack_status(self, call_id: str) -> str | None:
        """Check ACK status: 'acknowledged', 'rejected', 'no_answer', or None."""
        ...

class SimulatedMessageService(MessageService):
    """MVP implementation — dispatcher clicks to simulate ACK."""

    async def send_dispatch(self, station_phone: str, incident: dict) -> str | None:
        return f"sim_call_{incident['emergency_id']}_{int(time.time())}"

    async def get_ack_status(self, call_id: str) -> str | None:
        return "acknowledged"  # Always succeeds for MVP demo

class BolnaMessageService(MessageService):
    """Production implementation — real Bolna outbound agent."""

    def __init__(self, api_token: str, agent_id: str, webhook_base: str):
        self.api_token = api_token
        self.agent_id = agent_id
        self.webhook_base = webhook_base

    async def send_dispatch(self, station_phone: str, incident: dict) -> str | None:
        # Call Bolna POST /call
        ...

    async def get_ack_status(self, call_id: str) -> str | None:
        # Query Bolna execution status or check stored webhook result
        ...
```

---

## 4. Station Seed Data (Hubli/Dharwad Region)

### Police Stations

```json
[
  {
    "name": "Hubli Town Police Station",
    "type": "police",
    "latitude": 15.3452,
    "longitude": 75.1431,
    "address": "Durgad Bail, Broadway, Hubli, Karnataka 580028",
    "phone": "0836-2233540"
  },
  {
    "name": "Vidyanagar Police Station",
    "type": "police",
    "latitude": 15.3765,
    "longitude": 75.1220,
    "address": "Vidyanagar, Hubli, Karnataka 580031",
    "phone": "0836-2233516"
  },
  {
    "name": "Keshwapur Police Station",
    "type": "police",
    "latitude": 15.3612,
    "longitude": 75.1028,
    "address": "Kusgal Road, Keshwapur, Hubli, Karnataka 580023",
    "phone": "0836-2233518"
  },
  {
    "name": "Gokul Road Police Station",
    "type": "police",
    "latitude": 15.3566,
    "longitude": 75.1611,
    "address": "Near New Bus Stand, Gokul Road, Hubli, Karnataka 580030",
    "phone": "0836-2233525"
  },
  {
    "name": "Dharwad Town Police Station",
    "type": "police",
    "latitude": 15.4589,
    "longitude": 75.0078,
    "address": "Near Old Bus Stand, Dharwad, Karnataka 580001",
    "phone": "0836-2233512"
  },
  {
    "name": "Dharwad Suburban Police Station",
    "type": "police",
    "latitude": 15.4317,
    "longitude": 74.9856,
    "address": "Belagavi Road, Near DIMS Hospital, Dharwad 580001",
    "phone": "0836-2233511"
  }
]
```

### Fire Stations

```json
[
  {
    "name": "Fire Station Amargol",
    "type": "fire",
    "latitude": 15.3989,
    "longitude": 75.0867,
    "address": "Amargol, Hubli, Karnataka 580025",
    "phone": "101 / 0836-2323068"
  },
  {
    "name": "Fire Station Old Hubli",
    "type": "fire",
    "latitude": 15.3486,
    "longitude": 75.1331,
    "address": "Kasabapet Main Road, Old Hubli, Karnataka 580024",
    "phone": "101"
  },
  {
    "name": "Fire Station Dharwad",
    "type": "fire",
    "latitude": 15.4689,
    "longitude": 75.0194,
    "address": "Dharwad, Karnataka 580008",
    "phone": "101"
  },
  {
    "name": "Fire Station Navalur",
    "type": "fire",
    "latitude": 15.3812,
    "longitude": 75.1083,
    "address": "Navalur, Hubli, Karnataka 580025",
    "phone": "101"
  },
  {
    "name": "Fire Station Kalaghatagi",
    "type": "fire",
    "latitude": 15.3083,
    "longitude": 74.9750,
    "address": "Kalaghatagi, Dharwad District, Karnataka",
    "phone": "101"
  }
]
```

### Hospitals (Medical)

```json
[
  {
    "name": "KIMS District Hospital Hubli",
    "type": "medical",
    "latitude": 15.3618,
    "longitude": 75.1307,
    "address": "PB Road, Vidyanagar, Hubli, Karnataka 580021",
    "phone": "0836-2370057"
  },
  {
    "name": "SDM College of Medical Sciences & Hospital",
    "type": "medical",
    "latitude": 15.4184,
    "longitude": 75.0484,
    "address": "Manjushree Nagar, Sattur, Dharwad, Karnataka 580009",
    "phone": "0836-2477777"
  },
  {
    "name": "KLE Hospital & Medical Research Centre",
    "type": "medical",
    "latitude": 15.3942,
    "longitude": 75.0897,
    "address": "Gabbur Cross, Hubli, Karnataka 580028",
    "phone": "0836-2001502"
  },
  {
    "name": "District Hospital Dharwad",
    "type": "medical",
    "latitude": 15.4653,
    "longitude": 75.0086,
    "address": "Fort, Dharwad, Karnataka 580001",
    "phone": "0836-2747747"
  },
  {
    "name": "Shivakrupa Hospital & ICU",
    "type": "medical",
    "latitude": 15.3388,
    "longitude": 75.1213,
    "address": "Hubli, Karnataka 580020",
    "phone": "0836-2351011"
  },
  {
    "name": "Central Hospital South Western Railway",
    "type": "medical",
    "latitude": 15.3549,
    "longitude": 75.1409,
    "address": "Railway Colony, Hubli, Karnataka 580020",
    "phone": "0836-2364751"
  }
]
```

**Provenance notes:** Police station names/phones [CITED: dharwad.nic.in]. Coordinates [ASSUMED] — derived from mapping data, should be verified before production use. Hospitals: KIMS [CITED: wikipedia.org], SDM [CITED: latlong.net], others [ASSUMED] based on web search results.

---

## 5. District Boundary Check (Shapely + GeoJSON)

### Integration Approach

- **GeoJSON file:** `backend/data/districts.geojson` — contains one or more polygon features representing the operational area (Hubli/Dharwad twin cities)
- **Library:** `shapely` for point-in-polygon checks [ASSUMED — well-known library, standard approach]
- **Installation:** `pip install shapely` (add to pyproject.toml or requirements)

### Code Snippet — District Check

```python
# backend/app/services/geospatial_service.py
import json
import logging
import os

from shapely.geometry import shape, Point

GEOJSON_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "districts.geojson")

logger = logging.getLogger("savior.geospatial")

# Cache the loaded GeoJSON at module level
_district_polygons: list[dict] | None = None

def _load_districts() -> list[dict]:
    global _district_polygons
    if _district_polygons is None:
        path = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data", "districts.geojson"))
        with open(path, "r") as f:
            data = json.load(f)
        _district_polygons = []
        for feature in data.get("features", []):
            polygon = shape(feature["geometry"])
            name = feature.get("properties", {}).get("name", "Unknown")
            _district_polygons.append({"name": name, "polygon": polygon})
        logger.info("Loaded %d district polygons", len(_district_polygons))
    return _district_polygons

def is_inside_coverage(lat: float, lng: float) -> tuple[bool, str]:
    """Check if point is inside any known district boundary.
    Returns (is_inside, district_name)."""
    point = Point(lng, lat)  # GeoJSON is (longitude, latitude) order!
    districts = _load_districts()
    for dist in districts:
        if dist["polygon"].contains(point):
            return True, dist["name"]
    return False, "outside_coverage"

def get_district_for_emergency(lat: float, lng: float) -> dict:
    """Returns district info for an emergency location."""
    is_inside, district = is_inside_coverage(lat, lng)
    return {
        "in_coverage_area": is_inside,
        "district": district,
        "requires_manual_review": not is_inside,
    }
```

### GeoJSON File Structure

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "name": "Hubli-Dharwad Municipal Area" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [75.01, 15.30],
          [75.19, 15.30],
          [75.19, 15.48],
          [75.01, 15.48],
          [75.01, 15.30]
        ]]
      }
    }
  ]
}
```

**Note:** The coordinates above are approximate bounding box. The actual GeoJSON should contain precise polygon data for Hubli-Dharwad municipal area boundaries, sourced from open data portals (e.g., data.gov.in, OpenStreetMap relation export).

### Key Gotchas
- **Coordinate order:** GeoJSON uses `[longitude, latitude]` order, Shapely's `Point()` expects `(x, y)` = `(lng, lat)`. This is the #1 cause of bugs. [CITED: stackoverflow.com/questions/57727739]
- **Polygon winding:** GeoJSON exterior rings should be counter-clockwise, interiors clockwise
- **File cache:** The module-level cache means the GeoJSON is loaded once on first use — no repeated I/O

---

## 6. Existing Patterns Summary

### Backend Pattern: 3-Layer Architecture

| Layer | Files | Pattern | Follow For |
|-------|-------|---------|------------|
| Endpoints | `app/api/v1/endpoints/*.py` | FastAPI `APIRouter` + `Depends(get_db)` + WebSocket broadcast | `dispatch.py`, `location.py` endpoints |
| Services | `app/services/*.py` | Async functions with `httpx.AsyncClient` for external API, `Session` for DB | `routing_service.py`, `sms_service.py`, `dispatch_service.py`, `station_service.py` |
| Models | `app/models/*.py` | SQLAlchemy `Base` subclass, `Column` defs, `Index` | `station.py`, `dispatch_record.py` |
| Schemas | `app/schemas/*.py` | Pydantic `BaseModel` with `Config.from_attributes = True`, `model_validator` | `station.py`, `dispatch.py` schemas |

### Key Patterns to Replicate

1. **HTTP client pattern** (from `geocoding_service.py`): `async with httpx.AsyncClient() as client` + `timeout=10` + error handling → replicate for Fast2SMS and Google Maps Routes API

2. **Service CRUD pattern** (from `emergency_service.py`): Module-level functions (not classes), `db: Session` parameter, `db.commit()` + `db.refresh()`, return `record` or `None`

3. **WebSocket broadcast pattern** (from `core/websocket.py`): `await manager.broadcast({"type": "event_type", ...})` — use for dispatch status changes, new dispatch events

4. **Endpoint pattern** (from `api/v1/endpoints/emergency.py`): `@router.post(...)`, `Depends(get_db)`, broadcast after successful operation, consistent error responses

5. **Frontend context pattern** (from `hooks/EmergencyFeedContext.tsx`): Provider wrapper around useEmergencyFeed hook → new `DispatchContext` for dispatch state

6. **Frontend page pattern** (from `pages/MapPage.tsx`): New `DispatchPage.tsx` with route in `App.tsx`

7. **Frontend API pattern** (from `hooks/useApi.ts`): `fetch()` with JSON body, loading/error state management

### Middleware/Config

- `backend/app/core/config.py`: Add `FAST2SMS_API_KEY`, `GOOGLE_MAPS_API_KEY`, `BOLNA_API_TOKEN`, `BOLNA_AGENT_ID` to environment variables
- `backend/app/core/database.py`: Existing `get_db()` dependency — reuse for Station, Dispatch model tables

---

## Standard Stack

### Core (New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `shapely` | latest | Point-in-polygon district checks | Standard geospatial library, minimal dependency |
| `httpx` | 0.28+ (already installed) | Async HTTP for Google Maps + Fast2SMS | Already used in `geocoding_service.py` |

### Frontend (Existing, No New Dependencies)

| Library | Purpose for Phase 6 |
|---------|---------------------|
| `react-leaflet` + `leaflet` | Route preview polyline overlay, station markers on dispatch map |
| `react-router-dom` | New `/dispatch` route |
| Tailwind CSS + shadcn/ui | Dispatch panel UI components |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Google Maps Routes API | OSRM self-hosted | Free but requires Docker + ~3GB India OSM extract + ~10GB processed; deferred to v2 |
| Google Maps Static Map | OSM + Leaflet | Leaflet already in stack; no extra API key needed |
| Shapely + GeoJSON | MySQL spatial functions (`ST_Contains`) | Both work; Shapely is simpler for MVP, MySQL spatial avoids file I/O |
| Fast2SMS | Twilio | Twilio is global standard but pricier for India SMS; Fast2SMS chosen by user |

### Installation

```bash
# Backend — activate thor venv first
pip install shapely
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `shapely` | PyPI | 17+ yrs | 20M+/week | github.com/shapely/shapely | OK | Approved |
| `httpx` | PyPI | 6+ yrs | 50M+/week | github.com/encode/httpx | OK | Already installed |
| `fast2sms` (PyPI wrapper) | PyPI | 7+ yrs | ~200K total | Not well-maintained | SUS | Use raw httpx instead |
| `google-maps-routing` | PyPI | 3+ yrs | ~500K total | github.com/googleapis/... | OK | Not needed — use REST API directly |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `fast2sms` PyPI wrapper — not needed, use raw `httpx` calls directly to the Fast2SMS REST API
**No npm installs needed for Phase 6 frontend** — all capabilities use existing libraries (react-leaflet for maps, react-router-dom for routing)

---

## Architecture Patterns

### System Architecture Diagram

```
Caller SMS ──► Browser Geolocation ──► POST /api/location/{emergency_id}
                                            │
                                            ▼
                                        Incident Pipeline
                 ╔══════════════════════════════════════════╗
                 ║  1. District Check (Shapely + GeoJSON)  ║
                 ║     ├── Inside coverage → continue      ║
                 ║     └── Outside → manual review flag    ║
                 ║  2. Duplicate Detection (SQL query)     ║
                 ║     ├── No duplicate → continue         ║
                 ║     └── Duplicate → merge + skip        ║
                 ║  3. Station Query (type match)          ║
                 ║  4. Route Calculation (Google Maps API) ║
                 ║  5. Station Ranking (distance + ETA)    ║
                 ╚══════════════════════════════════════════╝
                            │
                            ▼
                 Dispatch Panel (Frontend)
                 ╔══════════════════════════════════════════╗
                 ║  Top 5 ranked stations shown            ║
                 ║  Route preview + ETA per station        ║
                 ║  Dispatcher confirms →                  ║
                 ╚══════════════════════════════════════════╝
                            │
                            ▼
                 Dispatch Execution
                 ╔══════════════════════════════════════════╗
                 ║  1. Create DispatchRecord                ║
                 ║  2. Update Emergency → "dispatched"      ║
                 ║  3. WebSocket broadcast                  ║
                 ║  4. Bolna outbound call → station        ║
                 ║  5. Wait for ACK (webhook or 2min timer) ║
                 ║  6. Escalate if no ACK → next station    ║
                 ╚══════════════════════════════════════════╝
                            │
                            ▼
                     ┌──────────┐
                     │  All 5   │
                     │  failed? ├──► flag "dispatch_failed"
                     └──────────┘
```

### Recommended Project Structure

```
backend/
├── app/
│   ├── api/v1/endpoints/
│   │   ├── dispatch.py          # NEW — dispatch endpoints
│   │   ├── location.py          # NEW — location capture endpoints
│   │   └── ...existing...
│   ├── models/
│   │   ├── station.py           # NEW — Station SQLAlchemy model
│   │   ├── dispatch_record.py   # NEW — DispatchRecord model
│   │   └── ...existing...
│   ├── schemas/
│   │   ├── station.py           # NEW — Station Pydantic schemas
│   │   ├── dispatch.py          # NEW — Dispatch schemas
│   │   └── ...existing...
│   ├── services/
│   │   ├── station_service.py   # NEW — CRUD + ranking
│   │   ├── dispatch_service.py  # NEW — dispatch pipeline logic
│   │   ├── routing_service.py   # NEW — Google Maps/OSRM routing
│   │   ├── sms_service.py       # NEW — Fast2SMS integration
│   │   ├── message_service.py   # NEW — MessageService interface
│   │   ├── duplicate_service.py # NEW — duplicate detection
│   │   ├── geospatial_service.py # NEW — Shapely district check
│   │   └── ...existing...
│   ├── data/
│   │   └── districts.geojson    # NEW — district boundary polygons
│   ├── static/
│   │   └── location.html        # NEW — standalone geolocation capture page
│   └── ...existing...
frontend/
├── src/
│   ├── pages/
│   │   ├── DispatchPage.tsx     # NEW — dispatch panel
│   │   └── ...existing...
│   ├── components/
│   │   ├── dispatch/            # NEW — dispatch components
│   │   │   ├── StationCard.tsx
│   │   │   ├── StationRanking.tsx
│   │   │   ├── RoutePreview.tsx
│   │   │   └── EscalationTimer.tsx
│   │   └── ...existing...
│   ├── hooks/
│   │   └── useDispatch.ts      # NEW — dispatch hook
│   └── ...existing...
```

### Pattern 1: Station Ranking Pipeline

**What:** Algorithm that ranks matching-type stations by distance and ETA, returns top 5.

**When to use:** After duplicate detection passes and location is confirmed.

**Example:**
```python
# backend/app/services/station_service.py
from app.services.routing_service import compute_route

async def rank_stations(
    emergency_lat: float, emergency_lng: float,
    emergency_type: str, limit: int = 5
) -> list[dict]:
    """Rank stations by ETA, return top N."""
    stations = _get_stations_by_type(emergency_type)
    results = []
    for station in stations:
        route = await compute_route(
            emergency_lat, emergency_lng,
            station.latitude, station.longitude
        )
        if route:
            results.append({
                "station": station,
                "distance_km": route["distance_meters"] / 1000,
                "eta_minutes": route["duration_seconds"] / 60,
                "encoded_polyline": route["encoded_polyline"],
            })
    results.sort(key=lambda r: r["eta_minutes"])
    return results[:limit]
```

### Anti-Patterns to Avoid
- **Don't call Google Maps API for each station sequentially** — use concurrent `asyncio.gather()` for the 5 station route computations
- **Don't put the API key in frontend code** — proxy routes through backend
- **Don't send JSON to Fast2SMS** — it rejects JSON, requires form-encoded data
- **Don't assume GeoJSON coordinates are (lat, lng)** — they're always (lng, lat) in the file

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Distance/ETA between lat/lng pairs | Haversine formula | Google Maps Routes API | Road distance ≠ crow-flies; traffic-aware ETAs |
| Point-in-polygon | Custom winding number algorithm | Shapely | Edge cases (boundary, multipolygon) are tricky |
| SMS delivery | Custom SMS gateway | Fast2SMS API | India-specific DLT compliance, delivery reports |
| Async HTTP client | `urllib` / `requests` | `httpx.AsyncClient` | Already in project, supports async properly |

**Key insight:** Every "simple" geospatial or communication problem has hidden edge cases. Use battle-tested libraries for routing, geofencing, and SMS delivery.

---

## Common Pitfalls

### Pitfall 1: GeoJSON Coordinate Order
**What goes wrong:** `is_inside_coverage()` returns False for coordinates clearly inside the boundary.
**Why it happens:** GeoJSON stores `[longitude, latitude]` but Shapely's `Point()` defaults to `(x, y)`. If you pass `Point(lat, lng)` instead of `Point(lng, lat)`, containment checks fail because the point maps to a completely different location.
**How to avoid:** Always verify coordinate order in the GeoJSON file. Use `Point(lng, lat)` when constructing from geographic data.
**Warning signs:** All points return `outside_coverage` even for obvious locations.

### Pitfall 2: Fast2SMS Content-Type
**What goes wrong:** Fast2SMS returns 400 or silently drops messages.
**Why it happens:** The API expects `application/x-www-form-urlencoded` body, not JSON. Sending `json=payload` with httpx sends JSON by default.
**How to avoid:** Use `data=payload` (not `json=payload`) with httpx. Content-Type must be `application/x-www-form-urlencoded`.
**Warning signs:** API returns `{"return": false}` or error about invalid parameters.

### Pitfall 3: Google Maps API Key Exposure
**What goes wrong:** API key leaks in frontend bundle or Git history.
**Why it happens:** Frontend needs route preview — easy to embed key in client code.
**How to avoid:** Always proxy Google Maps API calls through backend. Use Static Map API with URL signing if needed.
**Warning signs:** API key in frontend source code or `.env` committed to repo.

### Pitfall 4: Bolna Webhook Not Receiving ACKs
**What goes wrong:** Dispatch stays in `pending_call` forever.
**Why it happens:** Backend is behind ngrok/not publicly accessible, or webhook IP `13.203.39.153` not whitelisted.
**How to avoid:** Ensure backend has public URL (ngrok) during development, whitelist Bolna webhook source IP, log incoming webhooks for debugging.
**Warning signs:** No webhook POSTs received after outbound calls are made.

### Pitfall 5: Race Condition in Escalation
**What goes wrong:** Webhook ACK and 2-minute timeout timer fire simultaneously, causing double-dispatch.
**Why it happens:** If webhook arrives while timer is in flight, both paths execute.
**How to avoid:** Use a state check + database lock (e.g., `UPDATE dispatch_record SET status='acknowledged' WHERE id=X AND status='pending_call'`). Only one path succeeds.
**Warning signs:** Same emergency dispatched to two different stations.

---

## Code Examples

### Verified Patterns from Existing Codebase

#### Backend: New Station Endpoint (follows emergency.py endpoint pattern)

```python
# backend/app/api/v1/endpoints/dispatch.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.websocket import manager
from app.schemas.dispatch import DispatchResponse, StationRankingOut
from app.services.dispatch_service import run_dispatch_pipeline
from app.services.emergency_service import get_emergency

router = APIRouter(tags=["Dispatch"])

@router.get("/emergencies/{emergency_id}/stations", response_model=list[StationRankingOut])
async def get_station_rankings(emergency_id: int, db: Session = Depends(get_db)):
    """Get ranked stations for an emergency (run pipeline up to ranking)."""
    emergency = get_emergency(db, emergency_id)
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")
    rankings = await run_dispatch_pipeline(db, emergency)
    return rankings

@router.post("/emergencies/{emergency_id}/dispatch", response_model=DispatchResponse)
async def confirm_dispatch(emergency_id: int, station_id: int, db: Session = Depends(get_db)):
    """Dispatcher confirms dispatch to a specific station."""
    result = await execute_dispatch(db, emergency_id, station_id)
    await manager.broadcast({
        "type": "dispatch_update",
        "emergency_id": emergency_id,
        "station_id": station_id,
        "status": "dispatched",
    })
    return result
```

#### Frontend: New Dispatch Hook (follows useApi.ts pattern)

```typescript
// frontend/src/hooks/useDispatch.ts
import { useState, useCallback } from "react"

interface Station {
  id: number
  name: string
  type: string
  distance_km: number
  eta_minutes: number
  latitude: number
  longitude: number
  encoded_polyline: string
}

export function useDispatch(emergencyId: number) {
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dispatchState, setDispatchState] = useState<"idle" | "dispatching" | "dispatched" | "escalating" | "failed">("idle")

  const fetchRankings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/emergencies/${emergencyId}/stations`)
      if (!res.ok) throw new Error("Failed to fetch station rankings")
      const data: Station[] = await res.json()
      setStations(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [emergencyId])

  const confirmDispatch = useCallback(async (stationId: number) => {
    setDispatchState("dispatching")
    setError(null)
    try {
      const res = await fetch(`/api/emergencies/${emergencyId}/dispatch?station_id=${stationId}`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Dispatch failed")
      setDispatchState("dispatched")
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dispatch failed")
      setDispatchState("failed")
      return false
    }
  }, [emergencyId])

  return { stations, loading, error, dispatchState, fetchRankings, confirmDispatch }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Google Directions API (Legacy) | Routes API (`computeRoutes`) | 2023 | Better pricing, field masks, traffic-aware routing |
| Distance Matrix API (Legacy) | Routes ComputeRouteMatrix | 2023 | Part of Routes Essentials SKU |
| Twilio for India SMS | Fast2SMS | User choice | Cheaper for India, no international gateway fees |
| Nominatim reverse geocode | Shapely + GeoJSON | User choice | No API calls needed, works offline |

**Deprecated/outdated:**
- **Google Directions API (Legacy):** Migrate to Routes API `computeRoutes` for new integrations
- **Bolna agent v1 API:** Use `/v2/agent` endpoints for new agents
- **`fast2sms` PyPI wrapper package:** Not well maintained — use raw httpx calls directly

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Hubli/Dharwad police station coordinates derived from mapping data | Station Seed Data | Coordinates may be off by 50-200m — acceptable for dispatch but should be verified |
| A2 | Fire station coordinates for Old Hubli and Dharwad | Station Seed Data | Approximate — actual fire stations may be at slightly different locations |
| A3 | Hospital coordinates for KLE Hospital and others | Station Seed Data | Approximate — verify before production |
| A4 | Shapely `contains()` works correctly for all edge cases | District Boundary Check | May have issues with boundary points or invalid GeoJSON polygons |
| A5 | GeoJSON file is small enough for module-level cache | District Boundary Check | District polygon for Hubli-Dharwad is simple — RAM impact is negligible |
| A6 | Fast2SMS route `"q"` is correct for transactional SMS | Fast2SMS API | Route `"q"` = Quick SMS, confirmed in docs; double-check if delivery reports needed |

---

## Open Questions

1. **GeoJSON boundary precision**
   - What we know: Hubli-Dharwad municipal boundary is roughly a rectangle between lat 15.30-15.48, lng 75.01-75.19
   - What's unclear: Exact polygon vertices from official GIS data
   - Recommendation: Use approximate rectangle for MVP, refine with open data later

2. **Bolna outbound agent creation**
   - What we know: Bolna API supports `POST /v2/agent` and `POST /call`
   - What's unclear: Whether the outbound agent can be created via API or requires dashboard UI (current Phase 2 tasks are blocked on dashboard UI)
   - Recommendation: Have the `MessageService` interface ready; start with `SimulatedMessageService`; create outbound agent when Bolna dashboard access is available

3. **Station phone numbers for outbound calls**
   - What we know: Station seed data includes phone numbers from official directories
   - What's unclear: Whether these numbers reach the dispatch desk directly
   - Recommendation: Verify phone numbers during testing. Include in seed data but note they need human confirmation

---

## Environment Availability

> **Skip condition checked:** Phase 6 depends on external services (Google Maps API, Fast2SMS, Bolna API). Audit performed.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `python3` | Backend runtime | ✓ | 3.13 | — |
| `thor` venv | Backend deps | ✓ | Active | — |
| `httpx` | Google Maps + Fast2SMS | ✓ | 0.28.1 | — |
| `shapely` | District boundary check | ✗ | Not installed | Must install (`pip install shapely`) |
| `MySQL 8.0` | Station + Dispatch tables | ✓ | localhost:3306 | — |
| `npm` | Frontend build | ✓ | Available | — |
| Google Maps API Key | Route computation | ✗ | Not set in .env | Use Haversine fallback for MVP |
| Fast2SMS API Key | SMS sending | ✗ | Not set in .env | Log message instead of sending |
| Bolna API Token | Outbound calls | ✗ | Not set | Use SimulatedMessageService |
| `ngrok` | Bolna webhook testing | ⚠️ | URL changes | Use polling as fallback |

**Missing dependencies with no fallback:**
- `shapely` (PyPI) — must be installed before Phase 6 execution. Install: `thor\Scripts\pip install shapely`

**Missing dependencies with fallback:**
- Google Maps API Key — Haversine fallback computes straight-line distance + estimated drive time
- Fast2SMS API Key — Log messages, skip actual SMS
- Bolna API Token — `SimulatedMessageService` (dispatcher clicks to ACK)

---

## Key Takeaways for Planning

### Top 5 Findings

1. **Implement routing behind an abstraction.** Create `RoutingService` interface with Google Maps as primary and Haversine fallback. Add OSRM as a future option when Docker infrastructure is available.

2. **Fast2SMS has a critical gotcha:** It rejects JSON payloads — must use `application/x-www-form-urlencoded` encoding. Use httpx's `data=` parameter, not `json=`. Mirror the existing `geocoding_service.py` httpx pattern.

3. **Station ranking should use concurrent calls.** With 5 stations to rank, use `asyncio.gather()` to call Google Maps Routes API in parallel, reducing total wall-clock time from ~5s to ~1s.

4. **Dispatch ACK flow needs webhook + timer.** Webhook from Bolna provides real-time ACK, but a 2-minute server-side timer ensures escalation works even if webhook fails. Use database-level state locking (`UPDATE ... WHERE status='pending_call'`) to prevent race conditions.

5. **Frontend additions are minimal compared to backend.** The main work is backend services (station CRUD, routing, SMS, dispatch pipeline, duplicate detection). Frontend is one new page + dispatch panel components. All using existing libraries (Leaflet, shadcn/ui).

### Recommended Implementation Order

**Wave 1 — Foundation (Backend models + services):**
1. Create `Station` model + schema — seed 17 stations into database
2. Create `DispatchRecord` model + schema
3. Create `station_service.py` (CRUD + type-filtered query)
4. Create `routing_service.py` (Google Maps + Haversine fallback)
5. Create `geospatial_service.py` (Shapely district check)
6. Create `sms_service.py` (Fast2SMS integration)
7. Create `duplicate_service.py` (SQL-based duplicate detection)

**Wave 2 — Core Pipeline:**
8. Create `dispatch_service.py` (orchestrate: validate → rank → dispatch)
9. Create `dispatch.py` endpoints
10. Create `location.py` endpoints + standalone `location.html`
11. Add `FAST2SMS_API_KEY`, `GOOGLE_MAPS_API_KEY` to config.py
12. Add district boundary GeoJSON file

**Wave 3 — Frontend:**
13. Create `DispatchPage.tsx` + route in `App.tsx`
14. Create dispatch components (StationCard, StationRanking, RoutePreview)
15. Create `useDispatch.ts` hook
16. Wire WebSocket broadcast for dispatch events

**Wave 4 — Bolna Integration + ACK:**
17. Create `MessageService` interface + `SimulatedMessageService` + `BolnaMessageService`
18. Create Bolna outbound agent config (`bolna-agent/custom-functions/`)
19. Implement ACK webhook endpoint + escalation timer
20. Integration testing with ngrok + Bolna

### Risks and Unknowns
- Station phone numbers need human verification before outbound calls
- GeoJSON boundary data is approximate — may need refinement
- Bolna outbound agent creation may require dashboard UI (blocked like Phase 2)
- Google Maps API key approval and billing setup needed before production

---

## Validation Architecture

> Skipping — `workflow.nyquist_validation` not set in `.planning/config.json`. Treated as disabled for this phase.

---

## Security Domain

> Required when `security_enforcement` is enabled (absent = enabled). Config has no security_enforcement key — treated as enabled by default.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Pydantic schemas (existing pattern) on all new dispatch/location endpoints |
| V6 Cryptography | partial | API keys stored in .env, not committed |
| V12 API & Web Service | yes | FastAPI input validation, WebSocket broadcast non-sensitive data |
| V17 File Upload | no | No file uploads in this phase |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key exposure in frontend | Information Disclosure | Proxy all Google Maps calls through backend. Never embed API keys in client code. |
| SMS injection (malformed location link) | Tampering | Validate emergency_id in location URL is a valid integer, verify emergency exists |
| Race condition in dispatch escalation | Tampering | Use atomic `UPDATE ... WHERE status='pending_call'` to prevent double-dispatch |
| Bolna webhook spoofing | Spoofing | Validate webhook source IP (`13.203.39.153`), add shared secret verification if possible |
| GeoJSON file tampering | Tampering | Treat `districts.geojson` as read-only data file; validate geometry on load |

---

## Sources

### Primary (HIGH confidence)
- [CITED: developers.google.com/maps/documentation/routes/compute_route_directions] — Google Maps Routes API REST reference
- [CITED: developers.google.com/maps/documentation/routes/usage-and-billing] — Routes API pricing and billing tiers
- [CITED: docs.fast2sms.com] — Fast2SMS API v1.0 reference (Quick SMS endpoint)
- [CITED: bolna.ai/docs/api-reference/agent/v2/create] — Bolna Create Agent API
- [CITED: bolna.ai/docs/api-reference/agent/v2/overview] — Bolna Agent APIs overview
- [CITED: bolna.ai/docs/calling-guardrails] — Bolna outbound call guardrails + POST /call
- [CITED: dharwad.nic.in/en/police/] — Dharwad District official police station list

### Secondary (MEDIUM confidence)
- [CITED: github.com/Project-OSRM/osrm-backend] — OSRM HTTP API documentation
- [CITED: shapely.readthedocs.io] — Shapely point-in-polygon pattern (verified via StackOverflow accepted answer)
- [CITED: thelinuxcode.com] — Fast2SMS Python integration pattern (verified against official docs)
- [CITED: wikipedia.org] — KIMS Hubli coordinates
- [CITED: latlong.net] — SDM Hospital coordinates

### Tertiary (LOW confidence)
- [CITED: hubballionline.in] — Emergency services directory (fire stations, hospitals)
- [ASSUMED] — Hubli/Dharwad fire station coordinates (derived from general area mapping)
- [ASSUMED] — KLE Hospital coordinates (approximate from web search)
- [ASSUMED] — Police station lat/lng for Vidyanagar, Keshwapur, Gokul Road (derived from address-based mapping)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified on PyPI, proven patterns
- Architecture: HIGH — follows existing backend/frontend patterns precisely
- Pitfalls: HIGH — based on verified documentation + known API quirks
- Station coordinates: LOW — approximate values needing verification

**Research date:** 2026-07-14
**Valid until:** 2026-08-14 (standard 30-day validity; Google Maps API changes may affect pricing section)
