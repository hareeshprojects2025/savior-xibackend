import { Shield, Activity, AlertTriangle, CheckCircle, Clock } from "lucide-react"
import { useEmergencyFeedContext } from "@/hooks/EmergencyFeedContext"

export function Header() {
  const { emergencies, connected } = useEmergencyFeedContext()
  const total = emergencies.length
  const critical = emergencies.filter((e) => e.severity === "Critical").length
  const pending = emergencies.filter((e) => e.status === "pending").length
  const resolved = emergencies.filter((e) => e.status === "resolved").length

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4 shadow-sm">
      <div className="flex items-center gap-2.5 shrink-0 pr-4 border-r border-gray-200">
        <div className="size-8 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-sm">
          <Shield className="size-4 text-white" />
        </div>
        <span className="font-bold text-lg tracking-tighter text-gray-900">SAVIOR</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="relative flex size-2.5">
          {connected ? (
            <>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-30" />
              <span className="relative inline-flex size-2.5 rounded-full bg-green-500" />
            </>
          ) : (
            <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
          )}
        </span>
        <span className={`text-sm font-semibold ${connected ? "text-green-600" : "text-red-600"}`}>
          {connected ? "LIVE" : "OFFLINE"}
        </span>
      </div>

<div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50">
            <Activity className="size-3.5 text-blue-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</span>
            <span className="text-sm font-bold cockpit-number text-gray-900">{total}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50">
            <AlertTriangle className="size-3.5 text-red-500" />
            <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">Critical</span>
            <span className="text-sm font-bold cockpit-number text-red-600">{critical}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50">
            <Clock className="size-3.5 text-amber-500" />
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Pending</span>
            <span className="text-sm font-bold cockpit-number text-amber-600">{pending}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-50">
            <CheckCircle className="size-3.5 text-green-500" />
            <span className="text-xs font-semibold text-green-600 uppercase tracking-wider">Resolved</span>
            <span className="text-sm font-bold cockpit-number text-green-600">{resolved}</span>
          </div>
        </div>
    </header>
  )
}