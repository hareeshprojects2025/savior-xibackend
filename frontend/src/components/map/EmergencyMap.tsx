import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from "react-leaflet"
import { divIcon, type LatLngExpression } from "leaflet"
import "leaflet/dist/leaflet.css"
import { MapPin } from "lucide-react"
import { ErrorState } from "@/components/common/ErrorState"
import { EmptyState } from "@/components/common/EmptyState"
import type { Emergency } from "@/lib/types"

const MUMBAI_CENTER: LatLngExpression = [19.0760, 72.8777]
const DEFAULT_ZOOM = 11

const SEVERITY_MARKER_COLORS: Record<string, string> = {
  Critical: "#DC2626",
  High: "#F59E0B",
  Medium: "#FBBF24",
  Low: "#9CA3AF",
}

const DEFAULT_COLOR = "#6B7280"

function createSeverityIcon(severity: string | null, selected?: boolean) {
  const color = severity ? SEVERITY_MARKER_COLORS[severity] || DEFAULT_COLOR : DEFAULT_COLOR
  const strokeColor = selected ? "#2563EB" : "white"
  const strokeWidth = selected ? 3 : 2
  const svg = `<svg width="36" height="48" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30s18-16.5 18-30C36 8.06 27.94 0 18 0z" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/><circle cx="18" cy="18" r="8" fill="white" opacity="0.9"/><circle cx="18" cy="18" r="4" fill="${color}" opacity="0.7"/></svg>`
  return divIcon({
    html: svg,
    className: `emergency-marker${selected ? " selected-marker" : ""}`,
    iconSize: [36, 48],
    iconAnchor: [18, 48],
    popupAnchor: [0, -48],
  })
}

function getEmergencyCoords(e: Emergency): LatLngExpression | null {
  if (e.latitude != null && e.longitude != null) return [e.latitude, e.longitude]
  return null
}

function MapBoundsUpdater({ emergencies }: { emergencies: Emergency[] }) {
  const map = useMap()
  const prevCountRef = useRef(emergencies.length)

  useEffect(() => {
    const isNewArrival = emergencies.length > prevCountRef.current
    prevCountRef.current = emergencies.length

    const coords = emergencies.map(getEmergencyCoords).filter(Boolean) as [number, number][]

    if (isNewArrival && coords.length > 0) {
      map.panTo(coords[coords.length - 1], { duration: 0.5 })
    } else if (!isNewArrival && coords.length > 0) {
      map.fitBounds(coords, { padding: [40, 40], maxZoom: 14 })
    } else if (coords.length === 0) {
      map.setView(MUMBAI_CENTER, DEFAULT_ZOOM)
    }
  }, [emergencies, map])

  return null
}

function EmergencyPopup({ emergency, onViewDetails }: { emergency: Emergency; onViewDetails?: () => void }) {
  const time = new Date(emergency.created_at).toLocaleString()
  return (
    <div className="text-sm leading-relaxed min-w-[200px]">
      <p className="font-bold text-gray-900 mb-1">{emergency.emergency_type}</p>
      <p className="text-gray-600 mb-1">{emergency.location}</p>
      <div className="flex items-center gap-2 mb-1">
        <span className={`inline-block size-2 rounded-full ${emergency.severity === "Critical" ? "bg-red-500" : emergency.severity === "High" ? "bg-orange-400" : emergency.severity === "Medium" ? "bg-yellow-400" : "bg-gray-400"}`} />
        <span className="font-medium text-gray-700">{emergency.severity}</span>
        <span className="text-gray-300">|</span>
        <span className="font-medium text-gray-700 capitalize">{emergency.status.replace("_", " ")}</span>
      </div>
      {emergency.caller_name && <p className="text-gray-500 text-xs">Caller: {emergency.caller_name}</p>}
      {emergency.victims != null && <p className="text-gray-500 text-xs">Victims: {emergency.victims}</p>}
      {emergency.description && <p className="text-gray-500 text-xs mt-1 line-clamp-2">{emergency.description}</p>}
      <p className="text-gray-400 text-[10px] mt-1.5">{time}</p>
      {onViewDetails && (
        <button onClick={onViewDetails} className="mt-2 w-full px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700">View Details</button>
      )}
    </div>
  )
}

function RadiusSelector({ onRadiusSelect, radiusKm }: { onRadiusSelect: (center: [number, number]) => void; radiusKm: number }) {
  const [clicked, setClicked] = useState<[number, number] | null>(null)
  useMapEvents({
    click(e) {
      const center: [number, number] = [e.latlng.lat, e.latlng.lng]
      setClicked(center)
      onRadiusSelect(center)
    },
  })
  return clicked ? <Circle center={clicked} radius={radiusKm * 1000} pathOptions={{ color: "#3B82F6", fillOpacity: 0.1, weight: 2 }} /> : null
}

interface EmergencyMapProps {
  emergencies: Emergency[]
  error?: string | null
  onRetry?: () => void
  onMarkerClick?: (id: number) => void
  selectedId?: number | null
  radiusMode?: boolean
  radiusKm?: number
  onRadiusSelect?: (center: [number, number]) => void
}

export function EmergencyMap({ emergencies, error, onRetry, onMarkerClick, selectedId, radiusMode, radiusKm = 5, onRadiusSelect }: EmergencyMapProps) {
  const markers = useMemo(() => {
    return emergencies
      .map((e) => ({ emergency: e, coords: getEmergencyCoords(e) }))
      .filter((m): m is { emergency: Emergency; coords: [number, number] } => m.coords !== null)
  }, [emergencies])

  const noCoords = emergencies.filter((e) => e.latitude == null || e.longitude == null)

  if (error) {
    return <div className="h-full flex items-center justify-center"><ErrorState title="Failed to load map" description={error} onRetry={onRetry} /></div>
  }
  if (emergencies.length === 0) {
    return <div className="h-full flex items-center justify-center"><EmptyState icon={MapPin} title="No incidents to display" description="Map centered on Mumbai" /></div>
  }

  const handleMarkerClick = useCallback((id: number) => {
    onMarkerClick?.(id)
  }, [onMarkerClick])

  return (
    <div className="h-full relative">
      <MapContainer
        center={MUMBAI_CENTER}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full z-0"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {markers.map(({ emergency, coords }) => (
          <Marker
            key={emergency.id}
            position={coords}
            icon={createSeverityIcon(emergency.severity, emergency.id === selectedId)}
            eventHandlers={{ click: () => handleMarkerClick(emergency.id) }}
          >
            <Popup>
              <EmergencyPopup emergency={emergency} onViewDetails={() => handleMarkerClick(emergency.id)} />
            </Popup>
          </Marker>
        ))}

        <MapBoundsUpdater emergencies={emergencies} />
        {radiusMode && onRadiusSelect && <RadiusSelector onRadiusSelect={onRadiusSelect} radiusKm={radiusKm} />}
      </MapContainer>

      {noCoords.length > 0 && (
        <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200 px-3 py-2 shadow-sm">
          <p className="text-xs font-medium text-gray-500">
            {noCoords.length} incident{noCoords.length !== 1 ? "s" : ""} without coordinates
          </p>
        </div>
      )}
    </div>
  )
}
