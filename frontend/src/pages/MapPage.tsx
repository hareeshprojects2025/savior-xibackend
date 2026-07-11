import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { EmergencyMap } from "@/components/map/EmergencyMap"
import { MapFilter, MapLegend } from "@/components/map/MapFilter"
import { useEmergencyFeedContext } from "@/hooks/EmergencyFeedContext"
import type { EmergencyStatus } from "@/lib/types"
import { Crosshair, MapPin } from "lucide-react"

export function MapPage() {
  const [selectedStatuses, setSelectedStatuses] = useState<EmergencyStatus[]>(["pending", "dispatched", "en_route"])
  const { emergencies, connected, error, retry } = useEmergencyFeedContext()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const selectedIdParam = searchParams.get("selected")
  const selectedId = selectedIdParam ? (isNaN(Number(selectedIdParam)) ? null : Number(selectedIdParam)) : null

  const [radiusMode, setRadiusMode] = useState(false)
  const radiusKm = 5
  const [radiusCenter, setRadiusCenter] = useState<[number, number] | null>(null)

  const filteredEmergencies = emergencies.filter((e) => selectedStatuses.includes(e.status))

  const displayedEmergencies = radiusMode && radiusCenter
    ? filteredEmergencies.filter(e => {
        if (e.latitude == null || e.longitude == null) return false
        const R = 6371
        const toRad = (d: number) => (d * Math.PI) / 180
        const [lat, lng] = radiusCenter
        const dLat = toRad(e.latitude - lat)
        const dLng = toRad(e.longitude - lng)
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(e.latitude)) * Math.sin(dLng / 2) ** 2
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= radiusKm
      })
    : filteredEmergencies

  const handleStatusToggle = (status: EmergencyStatus) => {
    setSelectedStatuses((prev) => prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status])
  }

  const handleMarkerClick = (id: number) => {
    navigate("/?selected=" + id)
  }

  const handleRadiusSelect = (center: [number, number]) => {
    setRadiusCenter(center)
  }

  return (
    <div className="h-[calc(100vh-3.5rem-2.5rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Map View</h1>
          <p className="text-xs text-gray-400 mt-0.5 font-medium">Geographic incident overview</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setRadiusMode(!radiusMode); if (radiusMode) setRadiusCenter(null) }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${radiusMode ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
          >
            <Crosshair className="size-3.5" />
            {radiusMode ? "Exit Radius" : "Radius Select (5 km)"}
          </button>
          {!connected && (
            <span className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-full border border-red-200">
              Disconnected
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100%-3rem)]">
        <div className="flex-1 rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm relative">
          <EmergencyMap
            emergencies={displayedEmergencies}
            error={error}
            onRetry={retry}
            onMarkerClick={handleMarkerClick}
            selectedId={selectedId}
            radiusMode={radiusMode}
            radiusKm={radiusKm}
            onRadiusSelect={handleRadiusSelect}
          />
          {radiusMode && radiusCenter && (
            <div className="absolute top-3 left-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200 px-3 py-2 shadow-sm">
              <p className="text-xs font-medium text-gray-700">
                <MapPin className="inline size-3 mr-1" />
                {displayedEmergencies.length} incident{displayedEmergencies.length !== 1 ? "s" : ""} in {radiusKm} km radius
              </p>
            </div>
          )}
        </div>
        <div className="w-56 shrink-0 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <MapLegend />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <MapFilter selectedStatuses={selectedStatuses} onStatusToggle={handleStatusToggle} />
          </div>
        </div>
      </div>
    </div>
  )
}