import { useState } from "react"
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet"
import { divIcon } from "leaflet"
import "leaflet/dist/leaflet.css"

interface RoutePreviewProps {
  routeCoords: [number, number][]
  origin: [number, number]
  destination: [number, number]
  distanceKm: number
  etaMinutes: number
  stationName: string
  emergency: {
    callerName: string | null
    type: string
    severity: string | null
    location: string
    victims: number | null
    description: string | null
    status: string
  }
  station: {
    name: string
    address: string
    phone: string
    type: string
  }
}

type MapLayer = "osm" | "light" | "dark" | "satellite"

const LAYER_CONFIG: Record<MapLayer, { url: string; label: string; icon: string }> = {
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    label: "Map",
    icon: "🗺",
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    label: "Light",
    icon: "☀",
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    label: "Dark",
    icon: "☾",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    label: "Satellite",
    icon: "🛰",
  },
}

const victimIcon = divIcon({
  html: `<svg width="36" height="44" viewBox="0 0 36 44" fill="none">
    <circle cx="18" cy="18" r="16" fill="#059669" stroke="white" stroke-width="3"/>
    <circle cx="18" cy="18" r="20" fill="none" stroke="#059669" stroke-width="2" opacity="0.3">
      <animate attributeName="r" values="18;22;18" dur="1.5s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.3;0;0.3" dur="1.5s" repeatCount="indefinite"/>
    </circle>
    <path d="M14 18l3 3 5-6" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`,
  className: "route-marker",
  iconSize: [36, 44],
  iconAnchor: [18, 44],
})

const stationIcon = divIcon({
  html: `<svg width="24" height="32" viewBox="0 0 24 32" fill="none">
    <circle cx="12" cy="12" r="10" fill="#2563EB" stroke="white" stroke-width="2.5"/>
    <path d="M8 12l3 3 5-6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`,
  className: "route-marker",
  iconSize: [24, 32],
  iconAnchor: [12, 32],
})

export function RoutePreview({ routeCoords, origin, destination, distanceKm, etaMinutes, stationName, emergency, station }: RoutePreviewProps) {
  const [activeLayer, setActiveLayer] = useState<MapLayer>("osm")
  let positions: [number, number][] = routeCoords

  if (positions.length === 0) {
    positions = [origin, destination]
  }

  const polylineColor = activeLayer === "satellite" ? "#60A5FA" : activeLayer === "dark" ? "#60A5FA" : "#2563EB"

  return (
    <div className="h-full rounded-xl border border-gray-200 overflow-hidden relative">
      <MapContainer
        center={origin}
        zoom={13}
        className="h-full w-full"
        scrollWheelZoom={true}
        dragging={true}
      >
        <TileLayer url={LAYER_CONFIG[activeLayer].url} />
        <Marker position={origin} icon={victimIcon}>
          <Popup>
            <div className="min-w-[180px]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Victim Location</span>
                {emergency.severity && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    emergency.severity === "Critical" ? "bg-red-100 text-red-700" :
                    emergency.severity === "High" ? "bg-orange-100 text-orange-700" :
                    emergency.severity === "Medium" ? "bg-yellow-100 text-yellow-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {emergency.severity}
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-gray-900 mb-0.5">{emergency.callerName || "Unknown"}</p>
              <p className="text-xs text-gray-500 mb-1">{emergency.type}</p>
              <p className="text-xs text-gray-600 mb-1">{emergency.location}</p>
              {emergency.description && (
                <p className="text-xs text-gray-500 italic mb-1">"{emergency.description}"</p>
              )}
              {emergency.victims != null && (
                <p className="text-xs text-gray-500">{emergency.victims} victim{emergency.victims !== 1 ? "s" : ""}</p>
              )}
              <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">{emergency.status}</p>
            </div>
          </Popup>
        </Marker>
        <Marker position={destination} icon={stationIcon}>
          <Popup>
            <div className="min-w-[180px]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1">{station.type} Station</div>
              <p className="text-sm font-bold text-gray-900 mb-0.5">{station.name}</p>
              <p className="text-xs text-gray-600 mb-1">{station.address}</p>
              {station.phone && (
                <p className="text-xs text-gray-500 font-mono">{station.phone}</p>
              )}
              <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                Distance: {distanceKm.toFixed(1)} km &middot; ETA: ~{etaMinutes.toFixed(0)} min
              </div>
            </div>
          </Popup>
        </Marker>
        <Polyline
          positions={positions}
          pathOptions={{
            color: polylineColor,
            weight: 4,
            opacity: 0.7,
            dashArray: routeCoords.length === 0 ? "8, 8" : undefined,
          }}
        />
      </MapContainer>

      {/* Distance/ETA overlay */}
      <div className="absolute bottom-10 left-2 bg-white/90 rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm z-[1000] backdrop-blur-sm">
        <span className="text-gray-900 font-semibold cockpit-number">{distanceKm.toFixed(1)}</span> km · ~<span className="text-gray-900 font-semibold cockpit-number">{etaMinutes.toFixed(0)}</span> min
      </div>

      {/* Station name overlay */}
      <div className="absolute top-2 left-2 bg-white/90 rounded-lg px-3 py-1 text-xs font-medium shadow-sm z-[1000] backdrop-blur-sm max-w-[60%] truncate">
        <span className="text-gray-600">{stationName}</span>
      </div>

      {/* Layer switcher */}
      <div className="absolute bottom-2 left-2 flex gap-1 z-[1000]">
        {(Object.entries(LAYER_CONFIG) as [MapLayer, typeof LAYER_CONFIG[MapLayer]][]).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setActiveLayer(key)}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg shadow-sm backdrop-blur-sm border transition-all ${
              activeLayer === key
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white/90 text-gray-600 border-gray-200 hover:bg-gray-100"
            }`}
          >
            {config.label}
          </button>
        ))}
      </div>
    </div>
  )
}
