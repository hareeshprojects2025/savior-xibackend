import type { Emergency, EmergencyStatus } from "@/lib/types"
import { STATUS_LABELS } from "@/lib/types"

interface StatusTimelineProps {
  emergency: Emergency
}

const STATUS_ORDER: EmergencyStatus[] = ["pending", "dispatched", "en_route", "resolved"]

const dotColors: Record<EmergencyStatus, string> = {
  pending: "bg-amber-400 border-amber-300",
  dispatched: "bg-blue-500 border-blue-300",
  en_route: "bg-indigo-500 border-indigo-300",
  resolved: "bg-green-500 border-green-300",
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
}

export function StatusTimeline({ emergency }: StatusTimelineProps) {
  const currentIdx = STATUS_ORDER.indexOf(emergency.status)

  return (
    <div className="space-y-0">
      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Timeline</h4>
      {STATUS_ORDER.map((status, idx) => {
        const reached = idx <= currentIdx
        const isLast = idx === STATUS_ORDER.length - 1

        return (
          <div key={status} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`size-3 rounded-full border-2 mt-0.5 transition-all duration-300 ${
                reached ? dotColors[status] : "bg-white border-gray-300"
              }`} />
              {!isLast && <div className={`w-0.5 h-6 ${idx < currentIdx ? "bg-blue-200" : "bg-gray-200"}`} />}
            </div>
            <div className={`pb-4 ${isLast ? "pb-0" : ""}`}>
              <p className={`text-sm font-bold ${reached ? "text-gray-900" : "text-gray-400"}`}>
                {STATUS_LABELS[status]}
              </p>
              {reached && status === "pending" && (
                <p className="text-sm text-gray-400 mt-0.5">{formatTime(emergency.created_at)} — Report created</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}