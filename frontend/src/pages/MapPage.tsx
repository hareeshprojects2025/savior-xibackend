import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { EmergencyMap } from "@/components/map/EmergencyMap"
import { MapFilter, MapLegend } from "@/components/map/MapFilter"
import { useEmergencyFeedContext } from "@/hooks/EmergencyFeedContext"
import type { EmergencyStatus, Severity } from "@/lib/types"


export function MapPage() {
  const [selectedStatuses, setSelectedStatuses] = useState<EmergencyStatus[]>(["pending", "dispatched", "en_route"])
  const [selectedSeverities, setSelectedSeverities] = useState<Severity[]>(["Critical", "High", "Medium", "Low"])
  const { emergencies, connected, loading, error, retry } = useEmergencyFeedContext()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const selectedIdParam = searchParams.get("selected")
  const selectedId = selectedIdParam ? (isNaN(Number(selectedIdParam)) ? null : Number(selectedIdParam)) : null

  const displayedEmergencies = emergencies.filter((e) => {
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(e.status)) return false
    if (selectedSeverities.length > 0 && !selectedSeverities.includes(e.severity)) return false
    return true
  })

  const handleStatusToggle = (status: EmergencyStatus) => {
    setSelectedStatuses((prev) => prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status])
  }

  const handleSeverityToggle = (severity: Severity) => {
    setSelectedSeverities((prev) => prev.includes(severity) ? prev.filter((s) => s !== severity) : [...prev, severity])
  }

  if (loading && emergencies.length === 0) {
    return (
      <div className="h-[calc(100vh-3.5rem-2.5rem)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Map View</h1>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">Geographic incident overview</p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm h-[calc(100%-3rem)] animate-pulse flex items-center justify-center">
          <div className="text-center">
            <div className="size-8 rounded-full bg-gray-200 mx-auto mb-2" />
            <div className="h-3 w-32 bg-gray-200 rounded mx-auto" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-3.5rem-2.5rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Map View</h1>
          <p className="text-xs text-gray-400 mt-0.5 font-medium">Geographic incident overview</p>
        </div>
        <div className="flex items-center gap-2">
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
            onMarkerClick={(id) => navigate("/?selected=" + id)}
            selectedId={selectedId}
          />
        </div>
        <div className="w-56 shrink-0 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <MapLegend />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <MapFilter
              selectedStatuses={selectedStatuses}
              onStatusToggle={handleStatusToggle}
              selectedSeverities={selectedSeverities}
              onSeverityToggle={handleSeverityToggle}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
