import { useState, useCallback } from "react"
import type { EmergencyStatus, EmergencyStats } from "@/lib/types"

export function useApi() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateStatus = useCallback(async (id: number, status: EmergencyStatus): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/emergencies/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error("Failed to update status")
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update status"
      setError(msg)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteEmergency = useCallback(async (id: number): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/emergencies/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete"
      setError(msg)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchStats = useCallback(async (): Promise<EmergencyStats | null> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/emergencies/stats")
      if (!res.ok) throw new Error("Failed to fetch stats")
      return await res.json()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch stats"
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { updateStatus, deleteEmergency, fetchStats, loading, error }
}
