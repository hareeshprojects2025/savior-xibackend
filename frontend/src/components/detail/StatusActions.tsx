import { Button } from "@/components/ui/button"
import { STATUS_TRANSITIONS, STATUS_LABELS } from "@/lib/types"
import type { EmergencyStatus } from "@/lib/types"

interface StatusActionsProps {
  currentStatus: EmergencyStatus
  onStatusChange: (status: EmergencyStatus) => void
  loading?: boolean
}

export function StatusActions({ currentStatus, onStatusChange, loading }: StatusActionsProps) {
  const transitions = STATUS_TRANSITIONS[currentStatus]
  if (!transitions || transitions.length === 0) return null

  return (
    <div className="flex gap-2">
      {transitions.map((nextStatus) => {
        const colorMap: Record<string, string> = {
          dispatched: "bg-blue-500 hover:bg-blue-600 text-white shadow-sm",
          en_route: "bg-indigo-500 hover:bg-indigo-600 text-white shadow-sm",
          resolved: "bg-green-500 hover:bg-green-600 text-white shadow-sm",
        }
        return (
          <Button
            key={nextStatus}
            size="sm"
            className={colorMap[nextStatus] || "bg-gray-500 text-white"}
            disabled={loading}
            onClick={() => onStatusChange(nextStatus)}
          >
            {loading ? "..." : STATUS_LABELS[nextStatus]}
          </Button>
        )
      })}
    </div>
  )
}