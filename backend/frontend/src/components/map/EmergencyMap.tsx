import { useEffect, useMemo, useRef } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import { divIcon, type LatLngExpression } from "leaflet"
import "leaflet/dist/leaflet.css"
import { MapPin, Navigation } from "lucide-react"
import { ErrorState } from "@/components/common/ErrorState"
import { EmptyState } from "@/components/common/EmptyState"
import type { Emergency } from "@/lib/types"

const MUMBAI_CENTER: LatLngExpression = [19.0760, 72.8777]
const DEFAULT_ZOOM = 11

const SEVERITY_MARKER_COLORS: Record<string, string> = {
  Critical: "#EF4444",
  High: "#F97316",
  Medium: "#14B8A6",
  Low: "#8B5CF6",
}

const DEFAULT_COLOR = "#6B7280"

const STATUS_INNER_ICONS: Record<string, string> = {
  pending: `<path d="M18 13v10M13 18h10" stroke="white" stroke-width="2.5" stroke-linecap="round"/>`,
  dispatched: `<path d="M18 12l-6 6h12z" stroke="white" stroke-width="2" stroke-linejoin="round" fill="none"/>`,
  en_route: `<path d="M14 22l4-16 4 16-4-6z" stroke="white" stroke-width="2" stroke-linejoin="round" fill="none"/>`,
  resolved: `<path d="M13 18l4 4 6-8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
}

function createEmergencyIcon(severity: string | null, status: string, selected?: boolean) {
  const color = severity ? SEVERITY_MARKER_COLORS[severity] || DEFAULT_COLOR : DEFAULT_COLOR
  const strokeColor = selected ? "#2563EB" : "white"
  const strokeWidth = selected ? 3 : 2
  const inner = (STATUS_INNER_ICONS[status] || STATUS_INNER_ICONS.pending).replace(/stroke="white"/g, `stroke="${color}"`)
  const svg = `<svg width="36" height="48" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30s18-16.5 18-30C36 8.06 27.94 0 18 0z" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/><circle cx="18" cy="18" r="9" fill="white" opacity="0.95"/>${inner}</svg>`
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
        <span className={`inline-block size-2 rounded-full ${emergency.severity === "Critical" ? "bg-red-500" : emergency.severity === "High" ? "bg-orange-500" : emergency.severity === "Medium" ? "bg-teal-500" : "bg-violet-500"}`} />
        <span className="font-medium text-gray-700">{emergency.severity}</span>
        <span className="text-gray-300">|</span>
        <span className="font-medium text-gray-700 capitalize">{emergency.status.replace("_", " ")}</span>
      </div>
      {emergency.caller_name && <p className="text-gray-500 text-xs">Caller: {emergency.caller_name}</p>}
      {emergency.victims != null && <p className="text-gray-500 text-xs">Victims: {emergency.victims}</p>}
      {emergency.description && <p className="text-gray-500 text-xs mt-1 line-clamp-2">{emergency.description}</p>}
      <p className="text-gray-400 text-xs mt-1.5">{time}</p>
      {onViewDetails && (
        <button onClick={onViewDetails} className="mt-2 w-full px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700">View Details</button>
      )}
    </div>
  )
}

interface EmergencyMapProps {
  emergencies: Emergency[]
  error?: string | null
  onRetry?: () => void
  onMarkerClick?: (id: number) => void
  selectedId?: number | null
}

export function EmergencyMap({ emergencies, error, onRetry, onMarkerClick, selectedId }: EmergencyMapProps) {
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
            icon={createEmergencyIcon(emergency.severity, emergency.status, emergency.id === selectedId)}
          >
            <Popup>
              <EmergencyPopup emergency={emergency} onViewDetails={() => onMarkerClick?.(emergency.id)} />
            </Popup>
          </Marker>
        ))}

        <MapBoundsUpdater emergencies={emergencies} />
      </MapContainer>

      {noCoords.length > 0 && (
        <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200 px-3 py-2 shadow-sm">
          <p className="text-xs font-medium text-gray-500">
            {noCoords.length} incident{noCoords.length !== 1 ? "s" : ""} without coordinates
          </p>
        </div>
      )}
      {markers.length === 0 && noCoords.length > 0 && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center pointer-events-none">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 px-6 py-4 shadow-md text-center">
            <Navigation className="size-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-500">No location data</p>
            <p className="text-xs text-gray-400 mt-1">Emergencies lack coordinates for map display</p>
          </div>
        </div>
      )}
    </div>
  )
}
