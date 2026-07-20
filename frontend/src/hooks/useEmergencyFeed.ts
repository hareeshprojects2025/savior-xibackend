import { useCallback, useEffect, useRef, useState } from "react"
import type { Emergency, WsMessage, ActiveSession } from "@/lib/types"

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
  const [loading, setLoading] = useState(true)
  const [reconnecting, setReconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transcripts, setTranscripts] = useState<Record<number, TranscriptLine[]>>({})
  const [activeSessions, setActiveSessions] = useState<Record<string, ActiveSession>>({})
  const wsRef = useRef<WebSocket | null>(null)
  const retriesRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRetryingRef = useRef(false)
  const scheduledRef = useRef(false)

  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const connect = useCallback(() => {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:"
    const wsUrl = `${protocol}//${location.host}/ws`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      setReconnecting(false)
      setError(null)
      retriesRef.current = 0
      scheduledRef.current = false
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }))
      }, 30000)

      fetch("/api/transcript/live-sessions").then((r) => r.ok && r.json()).then((data) => {
        if (data?.sessions?.length) {
          setActiveSessions((prev) => {
            const next = { ...prev }
            for (const s of data.sessions) {
              next[s.session_id] = {
                session_id: s.session_id,
                transcript_text: s.transcript_text,
                speaker: s.speaker,
                emergency_type: s.emergency_type,
                updated_at: s.updated_at,
              }
            }
            return next
          })
        }
      }).catch(() => {})
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
              setEmergencies((prev) => {
                const idx = prev.findIndex((e) => e.id === msg.data!.id)
                if (idx >= 0) {
                  const updated = [...prev]
                  updated[idx] = msg.data!
                  return updated
                }
                return [msg.data!, ...prev]
              })
              options?.onNewEmergency?.(msg.data)
            }
            break

          case "location_received":
            if (msg.emergency_id && msg.latitude != null && msg.longitude != null) {
              setEmergencies((prev) =>
                prev.map((e) =>
                  e.id === msg.emergency_id
                    ? { ...e, latitude: msg.latitude, longitude: msg.longitude, location_captured: true }
                    : e
                )
              )
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

          case "dispatch_update":
            if (msg.emergency_id) {
              setEmergencies((prev) =>
                prev.map((e) =>
                  e.id === msg.emergency_id
                    ? {
                        ...e,
                        status: msg.dispatch_status === "acknowledged" ? "dispatched" : e.status,
                        pipeline_status: msg.dispatch_status || e.pipeline_status,
                      }
                    : e
                )
              )
            }
            break

          case "dispatch_escalated":
            if (msg.emergency_id) {
              setEmergencies((prev) =>
                prev.map((e) =>
                  e.id === msg.emergency_id
                    ? { ...e, pipeline_status: "escalated" }
                    : e
                )
              )
            }
            break

          case "dispatch_failed":
            if (msg.emergency_id) {
              setEmergencies((prev) =>
                prev.map((e) =>
                  e.id === msg.emergency_id
                    ? { ...e, pipeline_status: "dispatch_failed" }
                    : e
                )
              )
            }
            break

          case "transcript_complete":
            break

          case "live_transcript":
            if (msg.session_id && msg.transcript_text) {
              const sid = msg.session_id
              const text = msg.transcript_text
              setActiveSessions((prev) => ({
                ...prev,
                [sid]: {
                  session_id: sid,
                  transcript_text: text,
                  speaker: msg.speaker || "caller",
                  emergency_type: msg.emergency_type_detected || "",
                  updated_at: Date.now(),
                },
              }))
            }
            break

          case "transcript_resolved":
            setActiveSessions((prev) => {
              const next = { ...prev }
              for (const [sid, sess] of Object.entries(next)) {
                if (msg.full_transcript && msg.full_transcript.startsWith(sess.transcript_text)) {
                  delete next[sid]
                }
              }
              return next
            })
            if (msg.emergency_id && msg.full_transcript) {
              const lines: TranscriptLine[] = msg.full_transcript.split("\n").filter(Boolean).map((line: string) => ({
                speaker: (/^(AI:|Agent:)/i.test(line) ? "AI" as const : "Caller" as const),
                text: line.replace(/^(AI:|Agent:|Caller:)\s*/i, ""),
                timestamp: new Date().toISOString(),
              }))
              setTranscripts((prev) => ({
                ...prev,
                [msg.emergency_id!]: lines,
              }))
              setEmergencies((prev) =>
                prev.map((e) =>
                  e.id === msg.emergency_id
                    ? { ...e, summary: msg.summary || e.summary, full_transcript: msg.full_transcript || e.full_transcript }
                    : e
                )
              )
            }
            break
        }
      } catch (err) {
        console.warn("Failed to parse WebSocket message:", err, (event as MessageEvent).data)
      }
    }
  }, [options])

  const scheduleReconnect = useCallback(() => {
    const delays = [500, 1000, 1000, 2000, 2000, 4000]
    const delay = delays[Math.min(retriesRef.current, delays.length - 1)]
    retriesRef.current++
    scheduledRef.current = true
    setReconnecting(true)

    timerRef.current = setTimeout(() => {
      connect()
    }, delay)
  }, [connect])

  useEffect(() => {
    connect()

    const onVisibility = () => {
      if (document.visibilityState === "visible" && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
        retriesRef.current = 0
        setReconnecting(true)
        isRetryingRef.current = true
        wsRef.current?.close()
        connect()
      }
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
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
    setLoading(true)
    try {
      const res = await fetch("/api/emergencies/recent?limit=50&in_coverage=true")
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
    } finally {
      setLoading(false)
    }
  }, [])

  return { emergencies, connected, loading, reconnecting, error, retry, prefetch, transcripts, setTranscripts, activeSessions }
}