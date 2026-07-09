import { MapPin } from "lucide-react"
import { ErrorState } from "@/components/common/ErrorState"
import { EmptyState } from "@/components/common/EmptyState"
import type { Emergency } from "@/lib/types"

interface EmergencyMapProps {
  emergencies: Emergency[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
}

export function EmergencyMap({ emergencies, loading, error, onRetry }: EmergencyMapProps) {
  if (error) return <div className="h-full flex items-center justify-center"><ErrorState title="Failed to load map" description={error} onRetry={onRetry} /></div>
  if (loading && emergencies.length === 0) return <div className="h-full flex items-center justify-center"><p className="text-sm text-gray-400 font-medium">Loading map...</p></div>
  if (emergencies.length === 0) return <div className="h-full flex items-center justify-center"><EmptyState icon={MapPin} title="No incidents to display" description="Map centered on Mumbai" /></div>

  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="flex flex-col items-center text-blue-400">
        <MapPin className="size-10 mb-2" />
        <p className="text-sm font-bold text-blue-500">{emergencies.length} incident{emergencies.length !== 1 ? "s" : ""}</p>
        <p className="text-xs font-medium text-blue-300 mt-1">Leaflet map coming in Phase 5</p>
      </div>
    </div>
  )
}