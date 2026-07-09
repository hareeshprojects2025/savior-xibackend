import { MapPin, ExternalLink } from "lucide-react"

interface MiniMapProps {
  location: string
  lat?: number
  lng?: number
}

export function MiniMap({ location, lat, lng }: MiniMapProps) {
  const mapsUrl = lat && lng
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : `https://www.google.com/maps/search/${encodeURIComponent(location)}`

  return (
    <div>
      <div className="h-40 rounded-lg bg-muted-bg border border-border flex items-center justify-center mb-2">
        <div className="flex flex-col items-center text-text-muted">
          <MapPin className="size-6 mb-1" />
          <span className="text-xs">Map placeholder</span>
        </div>
      </div>
      <p className="text-xs text-text-secondary mb-1">{location}</p>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-info hover:underline"
      >
        <ExternalLink className="size-3" />
        Open in Maps
      </a>
    </div>
  )
}
