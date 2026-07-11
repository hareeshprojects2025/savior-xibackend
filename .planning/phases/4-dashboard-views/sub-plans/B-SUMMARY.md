# Sub-plan B Summary: Map Enhancements

**Status:** Complete ✅
**Commits:** 3

| Decision | Status | Notes |
|----------|--------|-------|
| D-01 (Marker→Feed) | ✅ | Marker click navigates to `/?selected=N`; "View Details" button in popup; selected marker gets blue outline |
| D-02 (Auto-pan) | ✅ | MapBoundsUpdater pans to new arrivals, fits bounds on initial load |
| D-04 (Radius) | ✅ | Toggle button activates radius mode; click draws blue L.circle; Haversine filter matches incidents |
| D-05 (Bold markers) | ✅ | 36x48 teardrop SVG with severity colors, white stroke, inner circles |
| D-06 (MiniMap) | ✅ | Real Leaflet MapContainer; read-only (no drag/zoom); fallback when no coordinates |

**Commits:**
- `624a088` — rewrite EmergencyMap with 36x48 teardrop markers, auto-pan, rich popups
- `e701e27` — wire marker click to onMarkerClick with View Details + selected highlight
- `fc5386b` — radius selection (D-04), real MiniMap (D-06), URL-param coupling (D-01)
- `084752b` — fix unused state, tsc passes

**Verification:**
- `npx tsc -b --noEmit` ✅
- `npx vite build` ✅
