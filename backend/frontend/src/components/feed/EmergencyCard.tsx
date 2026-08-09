import { MapPin, Users, AlertTriangle, Map, Download, ArrowRight, Clock } from "lucide-react"
import type { Emergency } from "@/lib/types"
import { STATUS_LABELS } from "@/lib/types"
import { formatTimeAgo } from "@/lib/utils"
import { useNavigate } from "react-router-dom"

interface EmergencyCardProps {
  emergency: Emergency
  selected?: boolean
  onSelect?: (id: number) => void
}

const severityConfig: Record<string, { accent: string; bg: string; text: string; border: string }> = {
  Critical: { accent: "bg-red-500", bg: "bg-red-50", text: "text-red-600", border: "border-red-200" },
  High: { accent: "bg-orange-400", bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200" },
  Medium: { accent: "bg-yellow-400", bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  Low: { accent: "bg-blue-400", bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
}

const statusColors: Record<string, string> = {
  pending: "text-red-600",
  dispatched: "text-blue-600",
  en_route: "text-indigo-600",
  resolved: "text-green-600",
}

const timelineColors: Record<string, string> = {
  pending: "bg-amber-400",
  dispatched: "bg-blue-500",
  en_route: "bg-indigo-500",
  resolved: "bg-green-500",
}

const STATUS_ORDER = ["pending", "dispatched", "en_route", "resolved"] as const

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
}

export function EmergencyCard({ emergency, selected, onSelect }: EmergencyCardProps) {
  const navigate = useNavigate()
  const sev = emergency.severity ? severityConfig[emergency.severity] || severityConfig.Low : null
  const timeAgo = formatTimeAgo(emergency.created_at)
  const currentIdx = STATUS_ORDER.indexOf(emergency.status as typeof STATUS_ORDER[number])

  const handlePinToMap = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigate(`/map?selected=${emergency.id}`)
  }

  const handleExportLog = (e: React.MouseEvent) => {
    e.stopPropagation()
    const blob = new Blob([JSON.stringify(emergency, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `INC-${String(emergency.id).padStart(7, "0")}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div
      onClick={() => onSelect?.(emergency.id)}
      className={`relative bg-white border rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all duration-200 cursor-pointer overflow-hidden ${
        selected ? "border-blue-400 ring-1 ring-blue-300" : "border-gray-200 hover:border-blue-300"
      }`}
    >
      {sev && <div className={`absolute top-0 left-0 w-1 h-full ${sev.accent}`} />}

      <div className="flex justify-between items-start mb-4 pl-1">
        <div className="flex items-center gap-3">
          <span className="text-xs cockpit-number font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
            INC-{String(emergency.id).padStart(7, "0")}
          </span>
          {emergency.severity && sev && (
            <span className={`px-2 py-0.5 text-xs font-bold rounded border ${sev.bg} ${sev.text} ${sev.border}`}>
              {emergency.severity}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-sm text-gray-400 cockpit-number font-medium shrink-0">
          <Clock className="size-4" />
          {timeAgo}
        </div>
      </div>

      <div className="mb-4 pl-1">
        <h3 className="text-lg font-bold text-gray-900 mb-1 tracking-tight">{emergency.emergency_type}</h3>
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <MapPin className="size-4 shrink-0" />
          <span className="truncate">{emergency.location}</span>
        </div>
      </div>

<div className="grid grid-cols-2 gap-4 mb-4 bg-gray-900 p-3 rounded-lg pl-1">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Caller / Victim</p>
          <p className="text-sm text-gray-200">
            {emergency.caller_name}{emergency.victim_name ? ` / ${emergency.victim_name}` : ""}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Status</p>
          <p className={`text-sm font-bold cockpit-number ${statusColors[emergency.status] || "text-gray-200"}`}>
            {STATUS_LABELS[emergency.status].toUpperCase()}
          </p>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4 space-y-4">
        {emergency.description && (
          <p className="text-base text-gray-600 leading-relaxed">{emergency.description}</p>
        )}

        <div className="flex flex-col gap-1.5">
          {STATUS_ORDER.slice(0, currentIdx + 1).map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${i === currentIdx ? timelineColors[s] : "bg-gray-300"}`} />
              <span className="text-sm text-gray-500 cockpit-number">
                {formatTime(emergency.created_at)} - {STATUS_LABELS[s as keyof typeof STATUS_LABELS]}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handlePinToMap}
            className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 rounded-md text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <Map className="size-3.5" /> Pin to Map
          </button>
          <button
            onClick={handleExportLog}
            className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 rounded-md text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <Download className="size-3.5" /> Export Log
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-3">
          {emergency.immediate_danger && (
            <span className="flex items-center gap-1 text-sm font-semibold text-red-600 bg-red-50 px-2 py-1 rounded">
              <AlertTriangle className="size-4" /> Danger: Yes
            </span>
          )}
          {emergency.victims != null && (
            <span className="flex items-center gap-1 text-sm font-semibold text-orange-600 bg-orange-50 px-2 py-1 rounded">
              <Users className="size-4" /> <span className="cockpit-number">{emergency.victims}</span> victim{emergency.victims !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div
          onClick={(e) => { e.stopPropagation(); onSelect?.(emergency.id) }}
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          View Details <ArrowRight className="size-4" />
        </div>
      </div>
    </div>
  )
}