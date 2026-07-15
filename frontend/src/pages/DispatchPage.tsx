import { useEffect, useState, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import { Loader2, RadioTower, MapPin, AlertTriangle, Users, ArrowLeft } from "lucide-react"
import { useEmergencyFeedContext } from "@/hooks/EmergencyFeedContext"
import { useDispatch } from "@/hooks/useDispatch"
import { StationRanking } from "@/components/dispatch/StationRanking"
import { RoutePreview } from "@/components/dispatch/RoutePreview"
import { EscalationTimer } from "@/components/dispatch/EscalationTimer"
import { ErrorState } from "@/components/common/ErrorState"
import { cn } from "@/lib/utils"
import type { Emergency } from "@/lib/types"
import "leaflet/dist/leaflet.css"

const severityConfig: Record<string, { badge: string; bg: string; text: string }> = {
  Critical: { badge: "bg-red-500", bg: "bg-red-50", text: "text-red-700" },
  High: { badge: "bg-orange-400", bg: "bg-orange-50", text: "text-orange-700" },
  Medium: { badge: "bg-yellow-400", bg: "bg-yellow-50", text: "text-yellow-700" },
  Low: { badge: "bg-blue-400", bg: "bg-blue-50", text: "text-blue-700" },
}

function EmergencyInfoCard({ emergency }: { emergency: Emergency }) {
  const sev = emergency.severity ? severityConfig[emergency.severity] || severityConfig.Low : null
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm mb-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-gray-400 cockpit-number bg-gray-100 px-2 py-0.5 rounded">
              INC-{String(emergency.id).padStart(7, "0")}
            </span>
            {sev && (
              <span className={cn("px-2 py-0.5 text-xs font-bold rounded", sev.bg, sev.text)}>
                {emergency.severity}
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-gray-900">{emergency.emergency_type}</h2>
        </div>
        <span className={cn(
          "px-2.5 py-1 text-xs font-bold rounded-full",
          emergency.status === "pending" ? "bg-amber-50 text-amber-700" :
          emergency.status === "dispatched" ? "bg-blue-50 text-blue-700" :
          "bg-gray-50 text-gray-600"
        )}>
          {emergency.status.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 bg-gray-50 p-4 rounded-xl">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Caller</p>
          <p className="text-sm font-medium text-gray-900">{emergency.caller_name}</p>
          {emergency.caller_phone && (
            <p className="text-xs text-gray-500 mt-0.5">{emergency.caller_phone}</p>
          )}
        </div>
        {emergency.victim_name && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Victim</p>
            <p className="text-sm font-medium text-gray-900">{emergency.victim_name}</p>
          </div>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <MapPin className="size-4 text-gray-400 mt-0.5 shrink-0" />
          <span className="text-gray-700">{emergency.location}</span>
        </div>
        {emergency.description && (
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-4 text-gray-400 mt-0.5 shrink-0" />
            <span className="text-gray-600">{emergency.description}</span>
          </div>
        )}
        <div className="flex items-center gap-4">
          {emergency.victims != null && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Users className="size-3.5" /> {emergency.victims} victim{emergency.victims !== 1 ? "s" : ""}
            </span>
          )}
          {emergency.immediate_danger && (
            <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
              <AlertTriangle className="size-3.5" /> Danger Present
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function EmergencySelector({ emergencies, onSelect }: { emergencies: Emergency[]; onSelect: (id: number) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 font-medium">Select an emergency to begin dispatch</p>
      {emergencies.filter((e) => e.status === "pending").map((e) => (
        <div
          key={e.id}
          onClick={() => onSelect(e.id)}
          className="rounded-xl border border-gray-200 bg-white p-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-400 cockpit-number bg-gray-100 px-2 py-0.5 rounded">
              INC-{String(e.id).padStart(7, "0")}
            </span>
            {e.severity && severityConfig[e.severity] && (
              <span className={cn("px-2 py-0.5 text-xs font-bold rounded", severityConfig[e.severity].bg, severityConfig[e.severity].text)}>
                {e.severity}
              </span>
            )}
          </div>
          <h3 className="text-sm font-bold text-gray-900 mb-1">{e.emergency_type}</h3>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{e.location}</span>
          </div>
        </div>
      ))}
      {emergencies.filter((e) => e.status === "pending").length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">No pending emergencies</p>
      )}
    </div>
  )
}

export function DispatchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { emergencies } = useEmergencyFeedContext()
  const { stations, error, dispatchState, fetchRankings, confirmDispatch } = useDispatch()

  const emergencyIdParam = searchParams.get("emergency_id")
  const autoParam = searchParams.get("auto")
  const emergencyId = emergencyIdParam ? (isNaN(Number(emergencyIdParam)) ? null : Number(emergencyIdParam)) : null
  const autoTrigger = autoParam === "true"

  const [selectedStationId, setSelectedStationId] = useState<number | null>(null)
  const [dispatchRecord, setDispatchRecord] = useState<{ id: number; status: string } | null>(null)
  const [dispatchStartedAt, setDispatchStartedAt] = useState<string | null>(null)
  const [currentStatus, setCurrentStatus] = useState<"pending_call" | "acknowledged" | "escalated" | "dispatch_failed">("pending_call")

  const selectedEmergency = emergencyId != null
    ? emergencies.find((e) => e.id === emergencyId) ?? null
    : null

  // Auto-trigger or manual select
  const selectEmergency = (id: number) => {
    setSearchParams({ emergency_id: String(id) })
    setSelectedStationId(null)
    setDispatchRecord(null)
    setDispatchStartedAt(null)
    setCurrentStatus("pending_call")
  }

  // When emergencyId changes (from param or WS), fetch rankings
  useEffect(() => {
    if (emergencyId != null) {
      fetchRankings(emergencyId)
    }
  }, [emergencyId, fetchRankings])

  // Auto-trigger: if auto=true and we have a new emergency
  useEffect(() => {
    if (autoTrigger && emergencyId && emergencies.length > 0) {
      // Already triggered by the fetchRankings effect above
    }
  }, [autoTrigger, emergencyId, emergencies])

  // Handle dispatch confirmation
  const handleConfirmDispatch = async (stationId: number) => {
    if (emergencyId == null) return
    const result = await confirmDispatch(emergencyId, stationId)
    if (result) {
      setDispatchRecord({ id: result.dispatch_id, status: result.status })
      setDispatchStartedAt(new Date().toISOString())
      setCurrentStatus("pending_call")
    }
  }

  // Decode route coords from selected station
  const selectedRanking = selectedStationId != null
    ? stations.find((s) => s.station.id === selectedStationId) ?? null
    : null

  const routePreviewProps = useMemo(() => {
    if (!selectedRanking || !selectedEmergency?.latitude || !selectedEmergency?.longitude) return null
    const origin: [number, number] = [selectedEmergency.latitude, selectedEmergency.longitude]
    const dest: [number, number] = [selectedRanking.station.latitude, selectedRanking.station.longitude]

    // Decode polyline from server response
    let routeCoords: [number, number][] = []
    try {
      if (selectedRanking.encoded_polyline) {
        const polyData = selectedRanking.encoded_polyline
        // Server returns array of coords or encoded string
        if (typeof polyData === "string") {
          // Try parsing as JSON array first
          const parsed = JSON.parse(polyData)
          if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0])) {
            routeCoords = parsed as [number, number][]
          }
        }
      }
    } catch {
      // Fallback to straight line
    }

    return {
      routeCoords,
      origin,
      destination: dest,
      distanceKm: selectedRanking.distance_km,
      etaMinutes: selectedRanking.eta_minutes,
      stationName: selectedRanking.station.name,
    }
  }, [selectedRanking, selectedEmergency])

  // Find the dispatched station ranking for route preview after dispatch
  const dispatchedStationRanking = dispatchRecord
    ? stations.find((s) => s.station.id === selectedStationId) ?? null
    : null

  // Render
  return (
    <div className="h-[calc(100vh-3.5rem-2.5rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Dispatch Panel</h1>
          <p className="text-xs text-gray-400 mt-0.5 font-medium">
            {emergencyId ? `Emergency INC-${String(emergencyId).padStart(7, "0")}` : "Station dispatch coordination"}
          </p>
        </div>
        {emergencyId && (
          <button
            onClick={() => setSearchParams({})}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Back to selection
          </button>
        )}
      </div>

      <div className="flex gap-4 h-[calc(100%-3.5rem)]">
        {/* Left panel */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {!emergencyId ? (
            /* No emergency selected — show list */
            <EmergencySelector
              emergencies={emergencies}
              onSelect={selectEmergency}
            />
          ) : !selectedEmergency ? (
            /* Emergency not found in feed */
            <ErrorState
              title="Emergency not found"
              description="The selected emergency could not be loaded."
            />
          ) : (
            <>
              {/* Emergency info card */}
              <EmergencyInfoCard emergency={selectedEmergency} />

              {/* Pipeline status banners */}
              {selectedEmergency.pipeline_status === "pending_manual_review" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-amber-800 mb-1">
                    <AlertTriangle className="size-4" /> Outside Coverage Area
                  </div>
                  <p className="text-xs text-amber-700">This emergency is outside our district boundary. Manual review required before dispatch.</p>
                </div>
              )}
              {selectedEmergency.pipeline_status === "duplicate_found" && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-orange-800 mb-1">
                    <AlertTriangle className="size-4" /> Duplicate Emergency
                  </div>
                  <p className="text-xs text-orange-700">This incident matches a recent emergency at the same location. Review before proceeding.</p>
                </div>
              )}

              {/* Station ranking */}
              {dispatchState === "idle" || dispatchState === "loading_rankings" ? (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" /> Finding nearest stations...
                  </h3>
                  <StationRanking
                    stations={[]}
                    loading={true}
                    error={null}
                    selectedStationId={null}
                    onSelectStation={() => {}}
                    onConfirmDispatch={() => {}}
                    dispatchInProgress={false}
                  />
                </div>
              ) : dispatchState === "ready" || dispatchState === "dispatching" || dispatchState === "dispatched" ? (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-3">
                    Ranked Stations ({stations.length})
                  </h3>
                  <StationRanking
                    stations={stations}
                    loading={false}
                    error={null}
                    selectedStationId={selectedStationId}
                    onSelectStation={setSelectedStationId}
                    onConfirmDispatch={handleConfirmDispatch}
                    dispatchInProgress={dispatchState === "dispatching"}
                  />
                </div>
              ) : dispatchState === "failed" ? (
                <ErrorState
                  title="Dispatch Error"
                  description={error || "Failed to process dispatch. Please try again."}
                  onRetry={() => emergencyId && fetchRankings(emergencyId)}
                />
              ) : null}
            </>
          )}
        </div>

        {/* Right panel — Route preview + Escalation timer */}
        <div className="w-[400px] shrink-0 space-y-4">
          {/* Route preview */}
          {routePreviewProps && (
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">Route Preview</h3>
              <RoutePreview {...routePreviewProps} />
            </div>
          )}

          {/* After dispatch: show route to dispatched station */}
          {dispatchState === "dispatched" && dispatchedStationRanking && selectedEmergency?.latitude && selectedEmergency?.longitude && (
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">Dispatched Route</h3>
              <RoutePreview
                routeCoords={[]}
                origin={[selectedEmergency.latitude, selectedEmergency.longitude]}
                destination={[dispatchedStationRanking.station.latitude, dispatchedStationRanking.station.longitude]}
                distanceKm={dispatchedStationRanking.distance_km}
                etaMinutes={dispatchedStationRanking.eta_minutes}
                stationName={dispatchedStationRanking.station.name}
              />
            </div>
          )}

          {/* Escalation timer */}
          {dispatchStartedAt && (
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">Dispatch Status</h3>
              <EscalationTimer
                startedAt={dispatchStartedAt}
                timeoutSeconds={120}
                onTimeout={() => {
                  // Auto-scroll or play sound on timeout
                  setCurrentStatus("escalated")
                }}
                status={currentStatus}
              />
            </div>
          )}

          {/* Dispatch tips */}
          {!emergencyId && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center gap-2 mb-1">
                <RadioTower className="size-4 text-blue-600" />
                <h3 className="text-sm font-bold text-blue-800">Dispatch Tips</h3>
              </div>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Select a pending emergency from the left panel</li>
                <li>• Review ranked stations with ETA and route preview</li>
                <li>• Click a station card to see its route on the map</li>
                <li>• Confirm dispatch to initiate the station call</li>
                <li>• Monitor ACK status and escalation timer</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
