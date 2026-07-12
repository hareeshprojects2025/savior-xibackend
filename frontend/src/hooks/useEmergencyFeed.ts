import { useCallback, useEffect, useRef, useState } from "react"
import type { Emergency, WsMessage } from "@/lib/types"

export interface TranscriptLine {
  speaker: "AI" | "Caller"
  text: string
  timestamp: string
}

interface UseEmergencyFeedOptions {
  onNewEmergency?: (emergency: Emergency) => void
  onStatusUpdate?: (id: number, status: string) => void
}

export function useEmergencyFeed(options?: UseEmergencyFeedOptions) {
  const [emergencies, setEmergencies] = useState<Emergency[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transcripts, setTranscripts] = useState<Record<number, TranscriptLine[]>>({})
  const wsRef = useRef<WebSocket | null>(null)
  const retriesRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRetryingRef = useRef(false)

  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const connect = useCallback(() => {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:"
    const wsUrl = `${protocol}//${location.host}/ws`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      setError(null)
      retriesRef.current = 0
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }))
      }, 30000)
    }

    ws.onclose = () => {
      setConnected(false)
      if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null }
      if (!isRetryingRef.current) { scheduleReconnect() }
      isRetryingRef.current = false
    }

    ws.onerror = () => {
      setError("Connection lost. Reconnecting...")
    }

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data)

        switch (msg.type) {
          case "new_emergency":
            if (msg.data) {
              setEmergencies((prev) => [msg.data!, ...prev])
              options?.onNewEmergency?.(msg.data)
            }
            break

          case "status_update":
            if (msg.emergency_id && msg.status) {
              setEmergencies((prev) =>
                prev.map((e) =>
                  e.id === msg.emergency_id ? { ...e, status: msg.status as Emergency["status"] } : e
                )
              )
              options?.onStatusUpdate?.(msg.emergency_id, msg.status)
            }
            break

          case "transcript_chunk":
            if (msg.emergency_id && msg.chunk_text) {
              const speaker = msg.speaker === "user" || msg.speaker === "caller" ? "Caller" : "AI"
              const line: TranscriptLine = {
                speaker,
                text: msg.chunk_text,
                timestamp: new Date().toISOString(),
              }
              setTranscripts((prev) => ({
                ...prev,
                [msg.emergency_id!]: [...(prev[msg.emergency_id!] || []), line],
              }))
            }
            break

          case "emergency_deleted":
            if (msg.emergency_id) {
              setEmergencies((prev) => prev.filter((e) => e.id !== msg.emergency_id))
              setTranscripts((prev) => {
                const { [msg.emergency_id!]: _, ...rest } = prev
                return rest
              })
            }
            break

          case "transcript_complete":
            break
        }
      } catch (err) {
        console.warn("Failed to parse WebSocket message:", err, (event as MessageEvent).data)
      }
    }
  }, [options])

  const scheduleReconnect = useCallback(() => {
    const delays = [1000, 2000, 4000, 8000, 16000, 30000]
    const delay = delays[Math.min(retriesRef.current, delays.length - 1)]
    retriesRef.current++

    timerRef.current = setTimeout(() => {
      connect()
    }, delay)
  }, [connect])

  useEffect(() => {
    connect()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (pingRef.current) clearInterval(pingRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  const retry = useCallback(() => {
    retriesRef.current = 0
    isRetryingRef.current = true
    wsRef.current?.close()
    connect()
  }, [connect])

  const prefetch = useCallback(async () => {
    try {
      const res = await fetch("/api/emergencies/recent?limit=50")
      if (res.ok) {
        const data: Emergency[] = await res.json()
        setEmergencies((prev) => {
          const dataIds = new Set(data.map((d) => d.id))
          const wsOnly = prev.filter((e) => !dataIds.has(e.id))
          return [...data, ...wsOnly]
        })
      }
    } catch {
      setError("Failed to load emergencies")
    }
  }, [])

  return { emergencies, connected, error, retry, prefetch, transcripts, setTranscripts }
}