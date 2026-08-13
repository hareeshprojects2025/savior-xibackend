import { useEffect, useState, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import { Loader2, RadioTower, MapPin, AlertTriangle, Users, ArrowLeft, PhoneCall, Lock } from "lucide-react"
import polyline from "@mapbox/polyline"
import { useEmergencyFeedContext } from "@/hooks/EmergencyFeedContext"
import { useDispatch } from "@/hooks/useDispatch"
import { StationCard } from "@/components/dispatch/StationCard"
import { RoutePreview } from "@/components/dispatch/RoutePreview"
import { EscalationTimer } from "@/components/dispatch/EscalationTimer"
import { ErrorState } from "@/components/common/ErrorState"
import { Button } from "@/components/ui/button"
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
      {emergencies.filter((e) => e.status === "pending" && e.pipeline_status !== "pending_manual_review").map((e) => (
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
          {e.pipeline_status === "awaiting_call_complete" && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 rounded-md px-2 py-1">
              <PhoneCall className="size-3" /> Caller still on line — dispatch locked until call ends
            </p>
          )}
        </div>
      ))}
      {emergencies.filter((e) => e.status === "pending" && e.pipeline_status !== "pending_manual_review").length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">No pending emergencies within Dharwad coverage area</p>
      )}
    </div>
  )
}

export function DispatchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { emergencies, dispatchEvent } = useEmergencyFeedContext()
  const { stations, error, dispatchState, fetchRankings, confirmDispatch } = useDispatch()

  const emergencyIdParam = searchParams.get("emergency_id")
  const autoParam = searchParams.get("auto")
  const emergencyId = emergencyIdParam ? (isNaN(Number(emergencyIdParam)) ? null : Number(emergencyIdParam)) : null
  const autoTrigger = autoParam === "true"

  const [selectedStationId, setSelectedStationId] = useState<number | null>(null)
  const [dispatchStartedAt, setDispatchStartedAt] = useState<string | null>(null)
  const [dispatchRecordId, setDispatchRecordId] = useState<number | null>(null)
  const [triedStationIds, setTriedStationIds] = useState<number[]>([])
  const [currentStatus, setCurrentStatus] = useState<"pending_call" | "acknowledged" | "escalated" | "dispatch_failed" | "awaiting_redispatch">("pending_call")
  const [callStatus, setCallStatus] = useState<string | null>(null)

  const selectedEmergency = emergencyId != null
    ? emergencies.find((e) => e.id === emergencyId) ?? null
    : null

  const isCallLocked = selectedEmergency?.pipeline_status === "awaiting_call_complete"

  // Auto-trigger or manual select
  const selectEmergency = (id: number) => {
    setSearchParams({ emergency_id: String(id) })
    setSelectedStationId(null)
    setDispatchRecordId(null)
    setDispatchStartedAt(null)
    setTriedStationIds([])
    setCurrentStatus("pending_call")
    setCallStatus(null)
  }

  // When emergencyId changes (from param or WS), fetch rankings
  useEffect(() => {
    if (emergencyId != null) {
      fetchRankings(emergencyId)
    }
  }, [emergencyId, fetchRankings])

  // Auto-select first station when rankings load
  useEffect(() => {
    if (stations.length > 0 && selectedStationId == null) {
      setSelectedStationId(stations[0].station.id)
    }
  }, [stations, selectedStationId])

  // Auto-trigger: if auto=true and we have a new emergency
  useEffect(() => {
    if (autoTrigger && emergencyId && emergencies.length > 0) {
      // Already triggered by the fetchRankings effect above
    }
  }, [autoTrigger, emergencyId, emergencies])

  // Handle dispatch confirmation — creates DispatchRecord, waits for ACK
  const handleConfirmDispatch = async (stationId: number) => {
    if (emergencyId == null) return
    if (isCallLocked) return
    const result = await confirmDispatch(emergencyId, stationId)
    if (result) {
      setTriedStationIds((prev) => [...prev, stationId])
      setDispatchRecordId(result.dispatch_id)
      setDispatchStartedAt(new Date().toISOString())
      setCurrentStatus("pending_call")
    }
  }


  // Sync local ACK status from WebSocket dispatch_update events
  useEffect(() => {
    if (!selectedEmergency) return
    const ps = selectedEmergency.pipeline_status
    if (ps === "acknowledged" || ps === "escalated" || ps === "dispatch_failed" || ps === "awaiting_redispatch") {
      setCurrentStatus(ps as typeof currentStatus)
    }
  }, [selectedEmergency?.pipeline_status])

  // Track live call status (ringing/connected/...) for the selected emergency
  useEffect(() => {
    if (dispatchEvent?.emergency_id === emergencyId) {
      setCallStatus(dispatchEvent.call_status ?? null)
    }
  }, [dispatchEvent, emergencyId])

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
    if (selectedRanking.encoded_polyline) {
      try {
        const decoded = polyline.decode(selectedRanking.encoded_polyline) as [number, number][]
        if (decoded.length > 0) {
          routeCoords = decoded
        }
      } catch {
        // Fallback to straight line
      }
    }

    return {
      routeCoords,
      origin,
      destination: dest,
      distanceKm: selectedRanking.distance_km,
      etaMinutes: selectedRanking.eta_minutes,
      stationName: selectedRanking.station.name,
      emergency: {
        callerName: selectedEmergency.caller_name,
        type: selectedEmergency.emergency_type,
        severity: selectedEmergency.severity,
        location: selectedEmergency.location,
        victims: selectedEmergency.victims,
        description: selectedEmergency.description,
        status: selectedEmergency.status,
      },
      station: {
        name: selectedRanking.station.name,
        address: selectedRanking.station.address,
        phone: selectedRanking.station.phone,
        type: selectedRanking.station.type,
      },
    }
  }, [selectedRanking, selectedEmergency])

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

      <div className="flex gap-4 h-[calc(100%-3.5rem)] relative">
        {/* Left panel — Cards (30%) */}
        <div className="w-[30%] flex flex-col min-h-0 pb-16">
          {!emergencyId ? (
            <div className="overflow-y-auto space-y-4 pr-1 flex-1 min-h-0">
              <EmergencySelector
                emergencies={emergencies}
                onSelect={selectEmergency}
              />
            </div>
          ) : !selectedEmergency ? (
            <ErrorState
              title="Emergency not found"
              description="The selected emergency could not be loaded."
            />
          ) : (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Scrollable content */}
              <div className="overflow-y-auto space-y-4 pr-1 flex-1 min-h-0">
                <EmergencyInfoCard emergency={selectedEmergency} />

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

                {/* Station ranking list */}
                {/* Case 1: Loading */}
                {dispatchState === "idle" || dispatchState === "loading_rankings" ? (
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" /> Finding nearest stations...
                    </h3>
                    <div className="space-y-3 animate-pulse">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="rounded-xl border border-gray-200 bg-white p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="size-7 rounded-full bg-gray-200" />
                            <div className="h-4 w-36 bg-gray-200 rounded" />
                            <div className="ml-auto h-5 w-16 bg-gray-200 rounded" />
                          </div>
                          <div className="space-y-2 pl-9">
                            <div className="h-3 w-48 bg-gray-200 rounded" />
                            <div className="h-3 w-32 bg-gray-200 rounded" />
                            <div className="h-3 w-40 bg-gray-200 rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) /* Case 2: Ready (first dispatch or re-dispatch after timeout) */ : (
                  dispatchState === "ready" || (dispatchState === "dispatched" && currentStatus === "awaiting_redispatch")
                ) ? (
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-3">
                      Ranked Stations ({stations.length})
                    </h3>
                    {isCallLocked && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mb-3">
                        <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                          <Lock className="size-3.5" /> Dispatch locked — caller is still on the line
                        </p>
                        <p className="text-xs text-amber-600 mt-0.5">
                          The station call will be placed automatically the moment the caller's call ends.
                        </p>
                      </div>
                    )}
                    {currentStatus === "awaiting_redispatch" && (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3 mb-3">
                        <p className="text-sm font-bold text-red-800">Station did not respond</p>
                        <p className="text-xs text-red-600 mt-0.5">Select another station to dispatch</p>
                      </div>
                    )}
                    <div className="space-y-3">
                      {stations.map((ranking, idx) => {
                        const stationTried = triedStationIds.includes(ranking.station.id)
                        const unavailable = stationTried || isCallLocked
                        return (
                          <div
                            key={ranking.station.id}
                            onClick={() => !unavailable && setSelectedStationId(ranking.station.id)}
                          >
                            <StationCard
                              ranking={ranking}
                              rank={idx + 1}
                              isSelected={ranking.station.id === selectedStationId}
                              onSelect={() => !unavailable && setSelectedStationId(ranking.station.id)}
                              disabled={unavailable}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) /* Case 3: Dispatching / dispatched (grayed out) */ : (
                  dispatchState === "dispatching" || dispatchState === "dispatched"
                ) ? (
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-3">
                      Ranked Stations ({stations.length})
                    </h3>
                    <div className="space-y-3 opacity-60">
                      {stations.map((ranking, idx) => (
                        <StationCard
                          key={ranking.station.id}
                          ranking={ranking}
                          rank={idx + 1}
                          isSelected={ranking.station.id === selectedStationId}
                          onSelect={() => {}}
                          disabled={true}
                        />
                      ))}
                    </div>
                  </div>
                ) /* Case 4: Failed */ : dispatchState === "failed" ? (
                  <ErrorState
                    title="Dispatch Error"
                    description={error || "Failed to process dispatch. Please try again."}
                    onRetry={() => emergencyId && fetchRankings(emergencyId)}
                  />
                ) : null}
              </div>

            </div>
          )}
        </div>

        {/* Dispatch button — floating at bottom of left column */}
        {emergencyId && selectedEmergency && dispatchState === "ready" && !isCallLocked && (
          <div className="absolute bottom-0 left-0 w-[30%] p-3">
            <Button
              onClick={() => handleConfirmDispatch(selectedStationId!)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg"
            >
              Dispatch to Selected Station
            </Button>
          </div>
        )}
        {emergencyId && selectedEmergency && dispatchState === "ready" && isCallLocked && (
          <div className="absolute bottom-0 left-0 w-[30%] p-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center shadow-sm">
              <p className="text-sm font-bold text-amber-800 flex items-center justify-center gap-1.5">
                <Lock className="size-3.5" /> Dispatch Locked
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                <PhoneCall className="size-3 inline mr-1" />
                Caller still on the line — auto-dispatch fires when the call ends
              </p>
            </div>
          </div>
        )}
        {emergencyId && selectedEmergency && dispatchState === "dispatching" && (
          <div className="absolute bottom-0 left-0 w-[30%] p-3">
            <Button disabled className="w-full bg-blue-600 text-white font-bold shadow-lg opacity-75">
              <Loader2 className="size-4 mr-2 animate-spin" />
              Dispatching...
            </Button>
          </div>
        )}
        {emergencyId && selectedEmergency && dispatchState === "dispatched" && currentStatus === "pending_call" && (
          <div className="absolute bottom-0 left-0 w-[30%] p-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center shadow-sm">
              <p className="text-sm font-bold text-amber-800">Awaiting Station ACK</p>
              <p className="text-xs text-amber-600 mt-0.5">
                {callStatus === "ringing" ? "Ringing station…" :
                 callStatus === "connected" || callStatus === "in-progress" || callStatus === "in_progress" ? "Station connected — waiting for verbal acknowledgment" :
                 callStatus === "stopped" ? "Call stopped after no answer" :
                 callStatus === "call_error" ? "Call placement failed — check station" :
                 "Waiting for station to acknowledge dispatch..."}
              </p>
            </div>
          </div>
        )}
        {emergencyId && selectedEmergency && dispatchState === "dispatched" && currentStatus === "acknowledged" && (
          <div className="absolute bottom-0 left-0 w-[30%] p-3">
            <div className="rounded-xl border border-green-300 bg-green-100 p-3 text-center shadow-sm">
              <p className="text-sm font-bold text-green-800">✓ Dispatch Complete</p>
              <p className="text-xs text-green-600 mt-0.5">Station acknowledged the dispatch</p>
            </div>
          </div>
        )}
        {emergencyId && selectedEmergency && dispatchState === "dispatched" && currentStatus === "awaiting_redispatch" && (
          <div className="absolute bottom-0 left-0 w-[30%] p-3 space-y-2">
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center shadow-sm">
              <p className="text-sm font-bold text-red-800">Station did not respond</p>
              <p className="text-xs text-red-600 mt-0.5">Select another station below</p>
            </div>
            <Button
              onClick={() => selectedStationId && handleConfirmDispatch(selectedStationId)}
              disabled={!selectedStationId}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg"
            >
              Dispatch to Next Station
            </Button>
          </div>
        )}
        {emergencyId && selectedEmergency && dispatchState === "dispatched" && (currentStatus === "escalated" || currentStatus === "dispatch_failed") && (
          <div className="absolute bottom-0 left-0 w-[30%] p-3">
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center shadow-sm">
              <p className="text-sm font-bold text-red-800">
                {currentStatus === "escalated" ? "Escalated to Next Station" : "Dispatch Failed"}
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                {currentStatus === "escalated" ? "Station did not respond — next station will be called" : "All stations exhausted — manual dispatch required"}
              </p>
            </div>
          </div>
        )}

        {/* Right panel — Map (70%) */}
        <div className="flex-1 flex flex-col h-full gap-4">
          {/* Route preview — shown before dispatch */}
          {routePreviewProps && !(dispatchState === "dispatched" && currentStatus === "acknowledged") && (
            <div className="flex-1 min-h-0 flex flex-col">
              <h3 className="text-sm font-bold text-gray-900 mb-2 shrink-0">Route Preview</h3>
              <div className="flex-1 min-h-0">
                <RoutePreview {...routePreviewProps} />
              </div>
            </div>
          )}

          {/* After dispatch: show ACK status */}
          {dispatchStartedAt && (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="shrink-0 w-full max-w-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-2">Dispatch Status</h3>
                <EscalationTimer
                  startedAt={dispatchStartedAt}
                  timeoutSeconds={600}
                  onTimeout={() => {
                    setCurrentStatus("awaiting_redispatch")
                  }}
                  status={currentStatus}
                  callStatus={callStatus}
                />
              </div>
            </div>
          )}

          {/* Dispatch tips */}
          {!emergencyId && (
            <div className="shrink-0 rounded-xl border border-blue-100 bg-blue-50 p-4">
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
