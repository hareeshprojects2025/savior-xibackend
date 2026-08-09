import { useState } from "react"
import { Loader2, MapPin } from "lucide-react"
import { StationCard } from "./StationCard"
import { ErrorState } from "@/components/common/ErrorState"
import { ConfirmDialog } from "@/components/detail/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { StationRanking as StationRankingType } from "@/lib/types"

interface StationRankingProps {
  stations: StationRankingType[]
  loading: boolean
  error: string | null
  selectedStationId: number | null
  onSelectStation: (id: number) => void
  onConfirmDispatch: (id: number) => void
  dispatchInProgress: boolean
}

export function StationRanking({
  stations, loading, error,
  selectedStationId, onSelectStation,
  onConfirmDispatch, dispatchInProgress,
}: StationRankingProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmStationId, setConfirmStationId] = useState<number | null>(null)

  // Loading state: 5 skeleton cards
  if (loading && stations.length === 0) {
    return (
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
    )
  }

  // Error state
  if (error && stations.length === 0) {
    return (
      <ErrorState
        title="Failed to load stations"
        description={error}
      />
    )
  }

  // Empty state
  if (!loading && stations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="size-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
          <MapPin className="size-6 text-amber-500" />
        </div>
        <h3 className="text-base font-bold text-gray-900">No matching stations found</h3>
        <p className="text-sm text-gray-500 mt-1 text-center max-w-xs">
          No stations matching this emergency type were found. The incident may need manual dispatch coordination.
        </p>
      </div>
    )
  }

  const selectedStation = selectedStationId != null
    ? stations.find((s) => s.station.id === selectedStationId) ?? null
    : null

  const handleConfirmClick = () => {
    if (selectedStationId == null) return
    setConfirmStationId(selectedStationId)
    setConfirmOpen(true)
  }

  const handleConfirm = () => {
    if (confirmStationId != null) {
      onConfirmDispatch(confirmStationId)
      setConfirmOpen(false)
    }
  }

  return (
    <div>
      <div className="space-y-3">
        {stations.map((ranking, idx) => (
          <StationCard
            key={ranking.station.id}
            ranking={ranking}
            rank={idx + 1}
            isSelected={ranking.station.id === selectedStationId}
            onSelect={() => onSelectStation(ranking.station.id)}
            disabled={dispatchInProgress}
          />
        ))}
      </div>

      {/* Dispatch button */}
      <div className="mt-4">
        <Button
          onClick={handleConfirmClick}
          disabled={selectedStationId == null || dispatchInProgress}
          className={cn(
            "w-full text-white shadow-sm",
            dispatchInProgress ? "opacity-50" : "",
          )}
        >
          {dispatchInProgress ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Dispatching...
            </>
          ) : (
            "Dispatch to Selected Station"
          )}
        </Button>
      </div>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm Dispatch"
        description={
          selectedStation
            ? `Dispatch to ${selectedStation.station.name}? Distance: ${selectedStation.distance_km.toFixed(1)} km, ETA: ~${selectedStation.eta_minutes.toFixed(0)} min. An outbound call will be placed to the station.`
            : "Confirm dispatch"
        }
        confirmLabel="Confirm Dispatch"
        confirmVariant="default"
        onConfirm={handleConfirm}
      />
    </div>
  )
}
