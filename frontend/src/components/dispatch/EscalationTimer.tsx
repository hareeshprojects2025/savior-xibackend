import { useEffect, useState, useRef } from "react"
import { cn } from "@/lib/utils"
import type { DispatchStatus } from "@/lib/types"

interface EscalationTimerProps {
  startedAt: string
  timeoutSeconds?: number
  onTimeout?: () => void
  status: DispatchStatus
}

export function EscalationTimer({
  startedAt,
  timeoutSeconds = 120,
  onTimeout,
  status,
}: EscalationTimerProps) {
  const calculateRemaining = () => {
    const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
    return Math.max(0, timeoutSeconds - elapsed)
  }

  const [remaining, setRemaining] = useState(calculateRemaining)
  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (status === "pending_call") {
      setRemaining(calculateRemaining())
      timerRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            onTimeoutRef.current?.()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [startedAt, timeoutSeconds, status])

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const progress = timeoutSeconds > 0 ? remaining / timeoutSeconds : 0

  // Color thresholds
  const colorClass =
    remaining > 60 ? "bg-green-500" :
    remaining > 30 ? "bg-yellow-500" :
    "bg-red-500"

  // Status-specific rendering
  if (status === "acknowledged") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="size-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-green-800">Station Acknowledged</p>
            <p className="text-xs text-green-600 mt-0.5">The station has accepted the dispatch</p>
          </div>
        </div>
      </div>
    )
  }

  if (status === "escalated") {
    return (
      <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-orange-100 flex items-center justify-center">
            <svg className="size-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-orange-800">Escalating to Next Station</p>
            <p className="text-xs text-orange-600 mt-0.5">Previous station did not respond in time</p>
          </div>
        </div>
      </div>
    )
  }

  if (status === "dispatch_failed") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="size-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-red-800">Dispatch Failed</p>
            <p className="text-xs text-red-600 mt-0.5">All stations exhausted — manual dispatch required</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-gray-900">Waiting for Station ACK</p>
          <p className="text-xs text-gray-500 mt-0.5">Auto-escalating if no response</p>
        </div>
        <div className={cn(
          "text-2xl font-bold cockpit-number tracking-tight",
          remaining > 60 ? "text-gray-900" :
          remaining > 30 ? "text-yellow-600" :
          "text-red-600"
        )}>
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-1000 ease-linear", colorClass)}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  )
}
