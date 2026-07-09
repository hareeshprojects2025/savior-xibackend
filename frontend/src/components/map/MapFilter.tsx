import { cn } from "@/lib/utils"
import { STATUS_LABELS } from "@/lib/types"
import type { EmergencyStatus } from "@/lib/types"

interface MapFilterProps {
  selectedStatuses: EmergencyStatus[]
  onStatusToggle: (status: EmergencyStatus) => void
}

const ALL_STATUSES: EmergencyStatus[] = ["pending", "dispatched", "en_route", "resolved"]

const STATUS_COLORS: Record<EmergencyStatus, string> = {
  pending: "bg-amber-400", dispatched: "bg-blue-500", en_route: "bg-indigo-500", resolved: "bg-green-500",
}

export function MapLegend() {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Severity</p>
      {[["Critical", "bg-red-500"], ["High", "bg-orange-400"], ["Medium", "bg-yellow-400"], ["Low", "bg-gray-400"]].map(([sev, color]) => (
        <div key={sev} className="flex items-center gap-2 text-xs font-medium text-gray-600">
          <span className={cn("size-2.5 rounded-full", color)} /> {sev}
        </div>
      ))}
    </div>
  )
}

export function MapFilter({ selectedStatuses, onStatusToggle }: MapFilterProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status</p>
      {ALL_STATUSES.map((status) => {
        const active = selectedStatuses.includes(status)
        return (
          <label key={status} className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer py-0.5">
            <input type="checkbox" checked={active} onChange={() => onStatusToggle(status)}
              className="rounded border-gray-300 text-blue-500 focus:ring-blue-400" />
            <span className={cn("size-2.5 rounded-full", STATUS_COLORS[status])} />
            {STATUS_LABELS[status]}
          </label>
        )
      })}
    </div>
  )
}