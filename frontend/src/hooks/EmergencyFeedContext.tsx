import { createContext, useContext, useEffect, type ReactNode } from "react"
import { useEmergencyFeed } from "./useEmergencyFeed"
import type { Emergency } from "@/lib/types"

interface TranscriptLine {
  speaker: "AI" | "Caller"
  text: string
  timestamp: string
}

interface EmergencyFeedContextValue {
  emergencies: Emergency[]
  connected: boolean
  error: string | null
  retry: () => void
  transcripts: Record<number, TranscriptLine[]>
}

const EmergencyFeedContext = createContext<EmergencyFeedContextValue | null>(null)

export function EmergencyFeedProvider({ children }: { children: ReactNode }) {
  const { emergencies, connected, error, retry, prefetch, transcripts } = useEmergencyFeed()

  useEffect(() => {
    prefetch()
  }, [prefetch])

  return (
    <EmergencyFeedContext.Provider value={{ emergencies, connected, error, retry, transcripts }}>
      {children}
    </EmergencyFeedContext.Provider>
  )
}

export function useEmergencyFeedContext() {
  const ctx = useContext(EmergencyFeedContext)
  if (!ctx) throw new Error("useEmergencyFeedContext must be used within EmergencyFeedProvider")
  return ctx
}