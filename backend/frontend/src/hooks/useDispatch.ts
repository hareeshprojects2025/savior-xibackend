import { useState, useCallback } from "react"
import type { StationRanking, DispatchResponse } from "@/lib/types"

export type DispatchState = "idle" | "loading_rankings" | "ready" | "dispatching" | "dispatched" | "escalating" | "failed"

interface UseDispatchReturn {
  stations: StationRanking[]
  loading: boolean
  error: string | null
  dispatchState: DispatchState
  fetchRankings: (emergencyId: number) => Promise<void>
  confirmDispatch: (emergencyId: number, stationId: number) => Promise<DispatchResponse | null>
}

export function useDispatch(): UseDispatchReturn {
  const [stations, setStations] = useState<StationRanking[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dispatchState, setDispatchState] = useState<DispatchState>("idle")

  const fetchRankings = useCallback(async (emergencyId: number) => {
    setLoading(true)
    setError(null)
    setDispatchState("loading_rankings")
    try {
      const res = await fetch(`/api/emergencies/${emergencyId}/stations`)
      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.detail || `Failed to fetch rankings (${res.status})`)
      }
      const data: StationRanking[] = await res.json()
      setStations(data)
      setDispatchState(data.length > 0 ? "ready" : "failed")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch rankings"
      setError(msg)
      setDispatchState("failed")
    } finally {
      setLoading(false)
    }
  }, [])

  const confirmDispatch = useCallback(async (emergencyId: number, stationId: number): Promise<DispatchResponse | null> => {
    setError(null)
    setDispatchState("dispatching")
    try {
      const res = await fetch(`/api/emergencies/${emergencyId}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emergency_id: emergencyId, station_id: stationId }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.detail || `Dispatch failed (${res.status})`)
      }
      const data: DispatchResponse = await res.json()
      setDispatchState("dispatched")
      return data
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Dispatch failed"
      setError(msg)
      setDispatchState("failed")
      return null
    }
  }, [])

  return { stations, loading, error, dispatchState, fetchRankings, confirmDispatch }
}
