import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet"
import { divIcon } from "leaflet"
import "leaflet/dist/leaflet.css"

interface RoutePreviewProps {
  routeCoords: [number, number][]
  origin: [number, number]
  destination: [number, number]
  distanceKm: number
  etaMinutes: number
  stationName: string
}

const originIcon = divIcon({
  html: `<svg width="20" height="28" viewBox="0 0 20 28" fill="none"><circle cx="10" cy="10" r="8" fill="#16A34A" stroke="white" stroke-width="2"/><text x="10" y="12" text-anchor="middle" fill="white" font-size="9" font-weight="bold">O</text></svg>`,
  className: "route-marker",
  iconSize: [20, 28],
  iconAnchor: [10, 28],
})

const destinationIcon = divIcon({
  html: `<svg width="20" height="28" viewBox="0 0 20 28" fill="none"><circle cx="10" cy="10" r="8" fill="#DC2626" stroke="white" stroke-width="2"/><text x="10" y="12" text-anchor="middle" fill="white" font-size="9" font-weight="bold">D</text></svg>`,
  className: "route-marker",
  iconSize: [20, 28],
  iconAnchor: [10, 28],
})

export function RoutePreview({ routeCoords, origin, destination, distanceKm, etaMinutes, stationName }: RoutePreviewProps) {
  let positions: [number, number][] = routeCoords

  // Fallback: if no routeCoords, try decoding the encoded_polyline or use straight dashed line
  if (positions.length === 0) {
    positions = [origin, destination]
  }

  return (
    <div className="h-48 rounded-xl border border-gray-200 overflow-hidden relative">
      <MapContainer
        center={origin}
        zoom={13}
        className="h-full w-full"
        zoomControl={false}
        scrollWheelZoom={false}
        dragging={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={origin} icon={originIcon} />
        <Marker position={destination} icon={destinationIcon} />
        <Polyline
          positions={positions}
          pathOptions={{
            color: "#2563EB",
            weight: 4,
            opacity: 0.7,
            dashArray: routeCoords.length === 0 ? "8, 8" : undefined,
          }}
        />
      </MapContainer>

      {/* Distance/ETA overlay */}
      <div className="absolute bottom-2 left-2 bg-white/90 rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm z-[1000] backdrop-blur-sm">
        <span className="text-gray-900 font-semibold cockpit-number">{distanceKm.toFixed(1)}</span> km · ~<span className="text-gray-900 font-semibold cockpit-number">{etaMinutes.toFixed(0)}</span> min
      </div>

      {/* Station name overlay */}
      <div className="absolute top-2 left-2 bg-white/90 rounded-lg px-3 py-1 text-xs font-medium shadow-sm z-[1000] backdrop-blur-sm max-w-[60%] truncate">
        <span className="text-gray-600">{stationName}</span>
      </div>
    </div>
  )
}
