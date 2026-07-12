import { useState, useEffect } from "react"
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import { divIcon } from "leaflet"
import { MapPin, Loader2 } from "lucide-react"
import "leaflet/dist/leaflet.css"

interface MiniMapProps {
  location: string
  lat?: number | null
  lng?: number | null
}

const fallbackIcon = divIcon({
  html: `<svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20C24 5.37 18.63 0 12 0z" fill="#DC2626" stroke="white" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="white" opacity="0.9"/><circle cx="12" cy="12" r="2.5" fill="#DC2626"/></svg>`,
  className: "mini-marker",
  iconSize: [24, 32],
  iconAnchor: [12, 32],
})

export function MiniMap({ location, lat, lng }: MiniMapProps) {
  const [coords, setCoords] = useState<[number, number] | null>(
    lat != null && lng != null ? [lat, lng] : null
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (lat != null && lng != null) {
      setCoords([lat, lng])
      return
    }
    if (!location || !location.trim()) return
    setLoading(true)
    const params = new URLSearchParams({ q: location, format: "json", limit: "1" })
    fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": "SAVIOR/1.0" },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.length > 0) {
          setCoords([parseFloat(data[0].lat), parseFloat(data[0].lon)])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [location, lat, lng])

  if (!coords) {
    return (
      <div className="h-40 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
        <div className="flex flex-col items-center text-gray-400">
          {loading ? (
            <Loader2 className="size-6 mb-1 animate-spin" />
          ) : (
            <MapPin className="size-6 mb-1" />
          )}
          <span className="text-sm font-medium">
            {loading ? "Looking up location..." : "No location data"}
          </span>
          <span className="text-xs text-gray-300 mt-0.5">{location}</span>
        </div>
      </div>
    )
  }

  const mapKey = `${coords[0].toFixed(4)}-${coords[1].toFixed(4)}`

  return (
    <div key={mapKey} className="h-40 rounded-xl border border-gray-200 overflow-hidden">
      <MapContainer
        center={coords}
        zoom={14}
        className="h-full w-full"
        zoomControl={true}
        dragging={true}
        scrollWheelZoom={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={coords} icon={fallbackIcon}>
          <Popup>{location}</Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}