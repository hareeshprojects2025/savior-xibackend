import { useState, useEffect, useRef } from "react"
import { Download, User, MapPin, Terminal, Clock } from "lucide-react"
import { useEmergencyFeedContext } from "@/hooks/EmergencyFeedContext"
import { FeedSkeleton } from "@/components/common/LoadingSkeleton"
import { formatTimeAgo } from "@/lib/utils"

interface Line {
  speaker: string
  text: string
  timestamp: string
}

function CallCard({ id, caller_name, emergency_type, severity, location, victims, summary, status, created_at, onClick }: {
  id: number; caller_name: string; emergency_type: string; severity: string | null | undefined
  location: string; victims: number | null | undefined; summary: string | null | undefined
  status: string; created_at: string; onClick: () => void
}) {
  const resolved = status === "resolved"
  const keywords: string[] = []
  if (emergency_type) keywords.push(emergency_type)
  if (severity) keywords.push(severity)
  if (location) {
    const parts = location.split(",").map((s) => s.trim())
    keywords.push(parts[0])
    if (parts.length > 1) keywords.push(parts[parts.length - 1])
  }
  if (victims) keywords.push(`${victims} victim${victims > 1 ? "s" : ""}`)

  return (
    <div
      onClick={onClick}
      className="rounded-xl p-4 cursor-pointer transition-all bg-white border border-gray-200 hover:border-blue-300 hover:shadow-sm"
    >
      <div className="flex justify-between items-start mb-2">
        <span className="font-mono text-sm font-semibold text-gray-500">
          INC-{String(id).padStart(7, "0")}
        </span>
        <div className="flex items-center gap-2">
          {severity && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
              severity === "Critical"
                ? "bg-red-50 text-red-600 border-red-200"
                : severity === "High"
                ? "bg-orange-50 text-orange-600 border-orange-200"
                : severity === "Medium"
                ? "bg-yellow-50 text-yellow-600 border-yellow-200"
                : "bg-gray-50 text-gray-500 border-gray-200"
            }`}>
              {severity}
            </span>
          )}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            resolved ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600"
          }`}>
            {resolved ? "Resolved" : "Active"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-1.5">
        <User className="size-4 text-gray-400 shrink-0" />
        <span className="text-base font-semibold text-gray-900">{caller_name || "Unknown"}</span>
      </div>

      {summary && (
        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{summary}</p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-2">
        {keywords.map((kw) => (
          <span key={kw} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
            {kw}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1"><MapPin className="size-3" /> {location}</span>
        <span className="flex items-center gap-1"><Clock className="size-3" /> {formatTimeAgo(created_at)}</span>
      </div>
    </div>
  )
}

function LiveTranscriptCard({ session_id, transcript_text, emergency_type }: {
  session_id: string; transcript_text: string; emergency_type: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [transcript_text])

  const lines: Line[] = transcript_text.split("\n").filter((l) => l.trim()).map((line) => {
    const s = /^(AI:|Agent:)/i.test(line) ? "AI" : /^(Caller:|User:)/i.test(line) ? "Caller" : "Caller"
    const text = line.replace(/^(AI:|Agent:|Caller:|User:)\s*/i, "")
    return { speaker: s, text, timestamp: new Date().toISOString() }
  })

  return (
    <div className="rounded-xl border border-[#3f465c] bg-[#2a313d] overflow-hidden flex flex-col shadow-lg">
      <div className="bg-[#1a2130] px-4 py-2 flex items-center justify-between border-b border-[#3f465c]">
        <div className="flex items-center gap-2">
          <Terminal className="size-4 text-[#adc6ff]" />
          <span className="font-mono text-[11px] text-[#adc6ff] uppercase tracking-widest">Live Transcription Stream</span>
          {emergency_type && (
            <span className="text-[10px] font-semibold bg-[#adc6ff]/20 text-[#adc6ff] px-2 py-0.5 rounded-full border border-[#adc6ff]/30">
              {emergency_type}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="font-mono text-[10px] text-green-500 uppercase tracking-wider">REC</span>
          <span className="text-[10px] text-[#727785] font-mono ml-2">{session_id}</span>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed space-y-2"
        style={{ minHeight: "160px", maxHeight: "320px", scrollbarWidth: "thin", scrollbarColor: "#4B5563 transparent" }}
      >
        {lines.length === 0 && (
          <p className="text-[#727785] text-center py-4">Waiting for transcription...</p>
        )}
        {lines.map((line, i) => (
          <div key={i} className="flex gap-3 items-start">
            <span className="text-[#727785] w-10 shrink-0 pt-0.5 text-xs">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <span className={`font-bold mr-2 tracking-wide text-xs ${line.speaker === "AI" ? "text-[#adc6ff]" : "text-[#FBBF24]"}`}>
                [{line.speaker.toUpperCase()}]
              </span>
              <span className={line.speaker === "AI" ? "text-[#dce2f3]" : "text-white"}>
                {line.text}
              </span>
            </div>
          </div>
        ))}
        <div className="flex gap-3 items-start">
          <span className="text-[#727785] w-10 shrink-0 pt-0.5 text-xs">--</span>
          <div className="w-2 h-4 bg-[#adc6ff] animate-pulse" />
        </div>
      </div>
    </div>
  )
}

function TranscriptDetail({ emergency }: { emergency: NonNullable<ReturnType<typeof useEmergencyFeedContext>["emergencies"][number]> }) {
  const [lines, setLines] = useState<Line[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchedTranscript, setFetchedTranscript] = useState<string | null>(null)

  useEffect(() => {
    if (!emergency.full_transcript) {
      setLoading(true)
      fetch(`/api/emergencies/${emergency.id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const tx = data?.full_transcript
          setFetchedTranscript(tx || null)
          if (tx) {
            const parsed: Line[] = tx.split("\n").filter((l: string) => l.trim()).map((line: string) => {
              const speaker = /^(AI:|Agent:)/i.test(line) ? "AI" : "Caller"
              return { speaker, text: line.replace(/^(AI:|Agent:|Caller:)\s*/i, ""), timestamp: emergency.created_at }
            })
            setLines(parsed)
          } else {
            setLines([])
          }
        })
        .catch(() => { setLines([]); setFetchedTranscript(null) })
        .finally(() => setLoading(false))
    } else {
      const parsed: Line[] = emergency.full_transcript.split("\n").filter((l: string) => l.trim()).map((line: string) => {
        const speaker = /^(AI:|Agent:)/i.test(line) ? "AI" : "Caller"
        return { speaker, text: line.replace(/^(AI:|Agent:|Caller:)\s*/i, ""), timestamp: emergency.created_at }
      })
      setLines(parsed)
      setFetchedTranscript(emergency.full_transcript)
    }
  }, [emergency.id, emergency.full_transcript, emergency.created_at])

  const handleExport = () => {
    if (lines.length === 0) return
    const blob = new Blob([JSON.stringify(lines, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transcript-INC-${String(emergency.id).padStart(7, "0")}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const hasData = fetchedTranscript !== null

  return (
    <div className="rounded-xl border border-[#3f465c] bg-[#2a313d] overflow-hidden flex flex-col shadow-lg">
      <div className="bg-[#1a2130] px-4 py-2 flex items-center justify-between border-b border-[#3f465c]">
        <div className="flex items-center gap-2">
          <Terminal className="size-4 text-[#adc6ff]" />
          <span className="font-mono text-[11px] text-[#adc6ff] uppercase tracking-widest">
            Transcript — INC-{String(emergency.id).padStart(7, "0")}
          </span>
        </div>
        {hasData && (
          <button onClick={handleExport} className="text-[10px] font-semibold text-[#adc6ff] hover:text-white flex items-center gap-1 transition-colors">
            <Download className="size-3" /> Export
          </button>
        )}
      </div>
      <div
        className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed space-y-2"
        style={{ minHeight: "120px", maxHeight: "280px", scrollbarWidth: "thin", scrollbarColor: "#4B5563 transparent" }}
      >
        {loading && <p className="text-[#727785] text-center py-4">Loading...</p>}
        {!loading && !hasData && (
          <p className="text-[#727785] text-center py-4">No transcript available</p>
        )}
        {hasData && lines.length === 0 && !loading && (
          <p className="text-[#727785] text-center py-4">Transcript loaded but contains no lines</p>
        )}
        {lines.map((line, i) => (
          <div key={i} className="flex gap-3 items-start">
            <span className="text-[#727785] w-10 shrink-0 pt-0.5 text-xs">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <span className={`font-bold mr-2 tracking-wide text-xs ${
                line.speaker === "AI" ? "text-[#adc6ff]" : "text-[#FBBF24]"
              }`}>
                [{line.speaker.toUpperCase()}]
              </span>
              <span className={line.speaker === "AI" ? "text-[#dce2f3]" : "text-white"}>
                {line.text}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TranscriptionPage() {
  const { emergencies, loading, reconnecting, activeSessions } = useEmergencyFeedContext()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string | null>(null)

  const selected = emergencies.find((e) => e.id === selectedId) || null

  const sorted = [...emergencies].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  const filtered = sorted.filter((e) => {
    if (statusFilter && e.status !== statusFilter) return false
    if (severityFilter && e.severity !== severityFilter) return false
    return true
  })

  const statusOptions = ["All", "pending", "dispatched", "en_route", "resolved"] as const
  const severityOptions = ["Critical", "High", "Medium", "Low"] as const

  const activeCount = Object.keys(activeSessions).length

  function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`px-3 py-1.5 text-sm font-bold rounded-full transition-all duration-150 shadow-sm ${
          active
            ? "bg-gray-900 text-white hover:bg-gray-800 shadow-md scale-105"
            : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
        }`}
      >
        {children}
      </button>
    )
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem-1.5rem)] gap-4 -mx-6 -mb-6 p-4">
      <div className="w-1/2 flex flex-col gap-4 min-w-0">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900 tracking-tight">Incident History</h2>
                <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{filtered.length}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mb-1.5">
              {statusOptions.map((s) => (
                <FilterPill
                  key={s}
                  active={s === "All" ? statusFilter === null : statusFilter === s}
                  onClick={() => setStatusFilter(s === "All" ? null : s)}
                >
                  {s === "en_route" ? "En Route" : s.charAt(0).toUpperCase() + s.slice(1)}
                </FilterPill>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              {severityOptions.map((s) => (
                <FilterPill
                  key={s}
                  active={severityFilter === s}
                  onClick={() => setSeverityFilter(severityFilter === s ? null : s)}
                >
                  {s}
                </FilterPill>
              ))}
            </div>
          </div>
          <div className="overflow-y-auto p-3 space-y-2" style={{ maxHeight: "calc(100vh - 10rem)" }}>
            {loading && filtered.length === 0 && <FeedSkeleton />}
            {!loading && filtered.length === 0 && (
              <p className="text-base text-gray-400 text-center py-8">No incidents yet</p>
            )}
            {!loading && filtered.map((e) => (
              <CallCard
                key={e.id}
                id={e.id}
                caller_name={e.caller_name}
                emergency_type={e.emergency_type}
                severity={e.severity}
                location={e.location}
                victims={e.victims}
                summary={e.summary}
                status={e.status}
                created_at={e.created_at}
                onClick={() => setSelectedId(e.id === selectedId ? null : e.id)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="w-1/2 flex flex-col gap-4 min-w-0">
        {reconnecting && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs font-medium text-amber-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Reconnecting to server...
          </div>
        )}

        {activeCount > 0 && !selected && (
          <div className="flex-1 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <h2 className="text-base font-bold text-gray-900 tracking-tight">Live Transcriptions</h2>
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{activeCount} active</span>
            </div>
            <div className="space-y-3">
              {Object.values(activeSessions).map((session) => (
                <LiveTranscriptCard
                  key={session.session_id}
                  session_id={session.session_id}
                  transcript_text={session.transcript_text}
                  emergency_type={session.emergency_type}
                />
              ))}
            </div>
          </div>
        )}

        {selected && (
          <div className="flex-1 overflow-y-auto">
            <TranscriptDetail emergency={selected} />
          </div>
        )}

        {activeCount === 0 && !selected && (
          <div className="flex-1 min-h-0">
            <div className="h-full border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center">
              <div className="text-center px-6">
                <Terminal className="size-8 mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-medium text-gray-400">
                  {emergencies.length > 0 ? "Call ended — transcript being processed" : "No active calls"}
                </p>
                <p className="text-xs text-gray-300 mt-1">Live transcription will appear here during a call</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
