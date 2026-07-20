import { cn } from "@/lib/utils"
import { STATUS_LABELS } from "@/lib/types"
import type { EmergencyStatus, Severity } from "@/lib/types"

interface MapFilterProps {
  selectedStatuses: EmergencyStatus[]
  onStatusToggle: (status: EmergencyStatus) => void
  selectedSeverities: Severity[]
  onSeverityToggle: (severity: Severity) => void
}

const ALL_STATUSES: EmergencyStatus[] = ["pending", "dispatched", "en_route", "resolved"]

const ALL_SEVERITIES = ["Critical", "High", "Medium", "Low"] as const

const STATUS_COLORS: Record<EmergencyStatus, string> = {
  pending: "bg-amber-400", dispatched: "bg-blue-500", en_route: "bg-indigo-500", resolved: "bg-green-500",
}

const SEVERITY_DOT_COLORS: Record<string, string> = {
  Critical: "bg-red-500", High: "bg-orange-500", Medium: "bg-teal-500", Low: "bg-violet-500",
}

function StatusSymbol({ status }: { status: string }) {
  const icons: Record<string, string> = {
    pending: `<path d="M7 4v6M4 7h6" stroke="white" stroke-width="1.5" stroke-linecap="round"/>`,
    dispatched: `<path d="M7 3l-4 6h8z" fill="white"/>`,
    en_route: `<path d="M5 11l3-9 3 9-3-4z" fill="white"/>`,
    resolved: `<path d="M4 7l2.5 2.5L10 5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  }
  const inner = icons[status] || icons.pending
  const color = status === "pending" ? "#F59E0B" : status === "dispatched" ? "#3B82F6" : status === "en_route" ? "#6366F1" : "#22C55E"
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
      <circle cx="7" cy="7" r="6" fill={color} />
      <g dangerouslySetInnerHTML={{ __html: inner }} />
    </svg>
  )
}

export function MapLegend() {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Color — Severity</p>
      {ALL_SEVERITIES.map((sev) => (
        <div key={sev} className="flex items-center gap-2 text-xs font-medium text-gray-600">
          <span className={cn("size-2.5 rounded-full", SEVERITY_DOT_COLORS[sev])} /> {sev}
        </div>
      ))}
      <div className="border-t border-gray-100 pt-2 mt-2">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Symbol — Status</p>
        {ALL_STATUSES.map((st) => (
          <div key={st} className="flex items-center gap-2 text-xs font-medium text-gray-600">
            <StatusSymbol status={st} />
            {STATUS_LABELS[st]}
          </div>
        ))}
      </div>
    </div>
  )
}

export function MapFilter({ selectedStatuses, onStatusToggle, selectedSeverities, onSeverityToggle }: MapFilterProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Status</p>
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
      <div className="border-t border-gray-100 pt-2">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Severity</p>
        {ALL_SEVERITIES.map((severity) => {
          const active = selectedSeverities.includes(severity)
          return (
            <label key={severity} className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer py-0.5">
              <input type="checkbox" checked={active} onChange={() => onSeverityToggle(severity)}
                className="rounded border-gray-300 text-blue-500 focus:ring-blue-400" />
              <span className={cn("size-2.5 rounded-full", SEVERITY_DOT_COLORS[severity])} />
              {severity}
            </label>
          )
        })}
      </div>
    </div>
  )
}
