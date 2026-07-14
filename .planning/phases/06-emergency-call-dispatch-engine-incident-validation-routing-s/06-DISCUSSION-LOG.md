# Phase 6: Dispatch Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 6-Dispatch Engine
**Areas discussed:** Auto vs assisted dispatch, Station data model, Duplicate detection, Dispatch ACK and escalation, Google Maps integration, Location confidence and boundaries

---

## Auto vs Assisted Dispatch

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-dispatch | System auto-selects best station, dispatches, awaits ACK | |
| Assisted (dispatcher confirms) | System ranks stations, dispatcher confirms | ✓ |

**User's choice:** Assisted (dispatcher confirms)
**Notes:** User wants dispatcher-in-the-loop for confirmation.

| Option | Description | Selected |
|--------|-------------|----------|
| New dispatch panel | Separate page/section in dashboard | ✓ |
| Within EmergencyDetail | Add station recs to existing component | |

**User's choice:** New dispatch panel in dashboard

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, auto-update | Confirm dispatch auto-sets status to 'dispatched' | ✓ |
| Keep manual status | Two separate actions | |

**User's choice:** Yes, auto-update

| Option | Description | Selected |
|--------|-------------|----------|
| Show route before confirm | Google Maps route preview in ranking | ✓ |
| Send after confirm | Route generated after dispatch | |

**User's choice:** Research Google Maps API cost, if free use it or search for alternatives
**Notes:** Research conducted — Google Maps Routes Essentials: 10K free/month, $5/1K after. OSRM: free self-hosted. User picked Google Maps for MVP.

| Option | Description | Selected |
|--------|-------------|----------|
| Escalate to next best | Auto-escalate after timeout | ✓ |
| Return to dispatch panel | Manual re-selection | |

**User's choice:** Escalate to next best

| Option | Description | Selected |
|--------|-------------|----------|
| Name + distance + ETA | Clean ranking display | |
| Full details + route map | Rich ranking with map preview | ✓ |

**User's choice:** Full details + route map

| Option | Description | Selected |
|--------|-------------|----------|
| Top 3 | Show 3 best stations | |
| Top 5 | Show 5 best stations | ✓ |

**User's choice:** Top 5

| Option | Description | Selected |
|--------|-------------|----------|
| On emergency creation | Auto-trigger dispatch panel | ✓ |
| On dispatcher action | Dispatcher clicks to trigger | |

**User's choice:** On emergency creation

---

## Station Data Model

| Option | Description | Selected |
|--------|-------------|----------|
| Database table | SQLAlchemy model in MySQL | ✓ |
| Config file | JSON/YAML config | |

**User's choice:** Database table

| Option | Description | Selected |
|--------|-------------|----------|
| Essential fields | Name, type, lat/lng, address | ✓ |
| Full fields | + phone, availability, radius, hours | |

**User's choice:** Essential fields

| Option | Description | Selected |
|--------|-------------|----------|
| 1-to-1 mapping table | Service-to-station-type mapping | |
| Match by emergency type | Direct field match | ✓ |

**User's choice:** Match by emergency type field

| Option | Description | Selected |
|--------|-------------|----------|
| Assume always available | No availability tracking | ✓ |
| Track availability | Boolean field | |

**User's choice:** Assume always available

| Option | Description | Selected |
|--------|-------------|----------|
| No radius limit | All matching stations ranked | ✓ |
| Radius limit | Max response distance per station | |

**User's choice:** No radius limit

| Option | Description | Selected |
|--------|-------------|----------|
| Define during planning | Researcher finds real data | ✓ |
| Use example stations | 5-6 generic stations | |

**User's choice:** We'll define stations during planning

---

## Duplicate Detection

| Option | Description | Selected |
|--------|-------------|----------|
| Same location + type + time window | Same incident, different callers | ✓ |
| Same caller phone + time window | Accidental re-submissions | |

**User's choice:** Same location + type + time window

| Option | Description | Selected |
|--------|-------------|----------|
| 30 minutes | Tight window | |
| 1 hour | Matches existing doc window | ✓ |

**User's choice:** 1 hour

| Option | Description | Selected |
|--------|-------------|----------|
| Merge: update existing record | Append info to existing record | ✓ |
| Flag for dispatcher review | Keep separate, flag both | |

**User's choice:** Merge: update existing record

| Option | Description | Selected |
|--------|-------------|----------|
| Append description only | Simple merge | |
| Merge description + caller info | Full merge | ✓ |

**User's choice:** Merge description + caller info

| Option | Description | Selected |
|--------|-------------|----------|
| Auto on every new emergency | Check on creation | ✓ |
| On dispatch attempt | Check when opening panel | |

**User's choice:** Auto on every new emergency

---

## Dispatch ACK and Escalation

| Option | Description | Selected |
|--------|-------------|----------|
| Manual by dispatcher | Dispatcher clicks ACK | |
| API endpoint for station | Station calls API | |

**User's choice:** Research free tools (Twilio WhatsApp etc.), only show professor simple ACK simulation

| Option | Description | Selected |
|--------|-------------|----------|
| Simulated ACK for MVP | Dispatcher clicks 'Mark Acknowledged' | |
| Start with real messaging | Integrate real messaging API | ✓ |
| Both: simulated + Bolna adapter | Interface with swap | |

**User's choice:** Build new Bolna agent for stations — Bolna calls the best station (friend), gets verbal ACK

| Option | Description | Selected |
|--------|-------------|----------|
| Simulated station call | Dispatch panel animation + auto-ACK | |
| Real outbound Bolna agent | Actual voice call to station | ✓ |

**User's choice:** Real outbound Bolna agent

| Option | Description | Selected |
|--------|-------------|----------|
| HTTP webhook to Bolna | Backend triggers Bolna | |
| Backend marks, Bolna polls | Backend creates dispatch record, Bolna polls | ✓ |

**User's choice:** Backend marks for dispatch, Bolna polls

| Option | Description | Selected |
|--------|-------------|----------|
| 5 minutes | Standard timeout | |
| 2 minutes | Fast escalation | ✓ |

**User's choice:** 2 minutes

| Option | Description | Selected |
|--------|-------------|----------|
| Flag for manual dispatch | Dispatcher handles manually | ✓ |
| Loop back to top | Re-rank and retry | |

**User's choice:** Flag for manual dispatch

| Option | Description | Selected |
|--------|-------------|----------|
| Fresh call with full details | No escalation context | ✓ |
| Include escalation context | Tell next station about previous failures | |

**User's choice:** Fresh call with full details

---

## Google Maps Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Google Maps (MVP) | Free tier covers 10K/month, easy integration, traffic data | ✓ |
| OSRM self-hosted | Free per-request, no traffic, Docker setup needed | |

**User's choice:** Google Maps (Recommended for MVP)

---

## Location Confidence and Boundaries

| Option | Description | Selected |
|--------|-------------|----------|
| Reverse geocode via Nominatim | Use existing service | |
| Predefined boundary data | GeoJSON + Shapely | ✓ |

**User's choice:** Predefined district boundary data

| Option | Description | Selected |
|--------|-------------|----------|
| JSON file + Shapely | GeoJSON in backend codebase | ✓ |
| Database + Shapely | GeoJSON in MySQL JSON column | |

**User's choice:** JSON file + Shapely

| Option | Description | Selected |
|--------|-------------|----------|
| Geocoding quality | Nominatim precision level | |
| Caller-provided data | Address quality from Bolna | |

**User's choice:** Auto-send SMS with location link (browser Geolocation API) — defer Twilio, use Nominatim for now

| Option | Description | Selected |
|--------|-------------|----------|
| Build location SMS now | Twilio/FreeSMS + capture page | |
| Defer — use Nominatim | Skip SMS, use geocoding | |

**User's choice:** Skip location confidence with Nominatim, SMS location is the right approach

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone public page | Minimal HTML page by backend | ✓ |
| Embedded in frontend | Vite React route | |

**User's choice:** Standalone public page

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-continue pipeline | Run validation after location received | ✓ |
| Wait for dispatcher | Manually trigger pipeline | |

**User's choice:** Auto-continue pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| 5 minutes | Link expiry | |
| Call duration | Valid while call active | |

**User's choice:** If no location received, the location from the first Bolna agent is valid (fallback)

| Option | Description | Selected |
|--------|-------------|----------|
| Fast2SMS | India-focused, free test credits, pay from ₹100 | ✓ |
| Twilio | Global standard, pricier for India | |
| SpringEdge | India-focused, free credits | |

**User's choice:** Fast2SMS

| Option | Description | Selected |
|--------|-------------|----------|
| Manual dispatcher review | Outside coverage area | ✓ |
| Assign to nearest district | Border area handling | |

**User's choice:** Manual dispatcher review

---

## the agent's Discretion

- Station ranking algorithm weightings (distance vs ETA)
- Dispatch panel UI layout and component structure
- GeoJSON district boundary file location and exact polygon data

## Deferred Ideas

- Location SMS via Twilio — Fast2SMS chosen for India focus
- OSRM self-hosted routing — migrate if Google costs grow
- Station availability tracking — defer to future phase
- Service radius per station — defer to future phase
