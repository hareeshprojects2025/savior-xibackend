import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from "react"
import { useEmergencyFeed } from "./useEmergencyFeed"
import type { Emergency, ActiveSession, WsMessage } from "@/lib/types"

interface TranscriptLine {
  speaker: "AI" | "Caller"
  text: string
  timestamp: string
}

interface EmergencyFeedContextValue {
  emergencies: Emergency[]
  connected: boolean
  loading: boolean
  reconnecting: boolean
  error: string | null
  retry: () => void
  transcripts: Record<number, TranscriptLine[]>
  activeSessions: Record<string, ActiveSession>
  dispatchEmergencyId: number | null
  setDispatchEmergencyId: (id: number | null) => void
  dispatchState: string | null
  dispatchEvent: WsMessage | null
}

const EmergencyFeedContext = createContext<EmergencyFeedContextValue | null>(null)

export function EmergencyFeedProvider({ children }: { children: ReactNode }) {
  const [dispatchEmergencyId, setDispatchEmergencyId] = useState<number | null>(null)
  const [dispatchState] = useState<string | null>(null)
  const [dispatchEvent, setDispatchEvent] = useState<WsMessage | null>(null)

  const onDispatchEvent = useCallback((msg: WsMessage) => {
    setDispatchEvent(msg)
  }, [])
  const feedOptions = useMemo(() => ({ onDispatchEvent }), [onDispatchEvent])
  const { emergencies, connected, loading, reconnecting, error, retry, prefetch, transcripts, activeSessions } = useEmergencyFeed(feedOptions)

  // Track which emergency has an active dispatch panel
  // The DispatchPage derives its dispatch state from the emergencies list
  // (pipeline_status / dispatch_record_id) and from its own useDispatch hook.

  useEffect(() => {
    prefetch()
  }, [prefetch])

  return (
    <EmergencyFeedContext.Provider value={{
      emergencies, connected, loading, reconnecting, error, retry,
      transcripts, activeSessions,
      dispatchEmergencyId, setDispatchEmergencyId, dispatchState, dispatchEvent,
    }}>
      {children}
    </EmergencyFeedContext.Provider>
  )
}

export function useEmergencyFeedContext() {
  const ctx = useContext(EmergencyFeedContext)
  if (!ctx) throw new Error("useEmergencyFeedContext must be used within EmergencyFeedProvider")
  return ctx
}