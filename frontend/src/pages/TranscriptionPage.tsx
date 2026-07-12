import { useState, useEffect, useRef } from "react"
import { Download, ArrowRight, User, MapPin, Phone, Terminal, Clock, Users } from "lucide-react"
import { useEmergencyFeedContext } from "@/hooks/EmergencyFeedContext"
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
        <span className="text-base font-semibold text-gray-900">{caller_name}</span>
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

function LiveTranscriptCard({ session_id, transcript_text, emergency_type, speaker }: {
  session_id: string; transcript_text: string; emergency_type: string; speaker: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevLenRef = useRef(0)

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
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col shadow-sm">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="font-mono text-xs font-bold text-green-600 uppercase tracking-wider">Live</span>
          {emergency_type && (
            <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {emergency_type}
            </span>
          )}
          <span className="text-xs text-gray-400 font-mono">{session_id}</span>
        </div>
        <span className="text-xs text-gray-400">{lines.length} lines</span>
      </div>
      <div
        ref={scrollRef}
        className="bg-gray-900 p-4 overflow-y-auto font-mono text-sm leading-relaxed space-y-2"
        style={{ minHeight: "160px", maxHeight: "320px", scrollbarWidth: "thin", scrollbarColor: "#4B5563 transparent" }}
      >
        {lines.length === 0 && (
          <p className="text-gray-500 text-center py-4">Waiting for transcription...</p>
        )}
        {lines.map((line, i) => (
          <div key={i} className="flex gap-3 items-start">
            <span className="text-gray-500 w-10 shrink-0 pt-0.5 text-xs">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <span className={`font-bold mr-2 tracking-wide text-xs ${
                line.speaker === "AI" ? "text-blue-300" : "text-yellow-400"
              }`}>
                [{line.speaker.toUpperCase()}]
              </span>
              <span className={line.speaker === "AI" ? "text-gray-300" : "text-white"}>
                {line.text}
              </span>
            </div>
          </div>
        ))}
        <div className="flex gap-3 items-start">
          <span className="text-gray-500 w-10 shrink-0 pt-0.5 text-xs">--</span>
          <div className="w-2 h-4 bg-blue-300 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

function TranscriptDetail({ emergency }: { emergency: NonNullable<ReturnType<typeof useEmergencyFeedContext>["emergencies"][number]> }) {
  const [lines, setLines] = useState<Line[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (emergency.status === "resolved") {
      setLoading(true)
      fetch(`/api/emergencies/${emergency.id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.full_transcript) {
            const parsed: Line[] = data.full_transcript.split("\n").filter((l: string) => l.trim()).map((line: string) => {
              const speaker = /^(AI:|Agent:)/i.test(line) ? "AI" : "Caller"
              return { speaker, text: line.replace(/^(AI:|Agent:|Caller:)\s*/i, ""), timestamp: emergency.created_at }
            })
            setLines(parsed)
          } else {
            setLines([])
          }
        })
        .catch(() => setLines([]))
        .finally(() => setLoading(false))
    }
  }, [emergency.id, emergency.status, emergency.created_at])

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

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col shadow-sm">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="size-4 text-gray-500" />
          <span className="font-mono text-xs font-semibold text-gray-600 uppercase tracking-wider">
            Transcript — INC-{String(emergency.id).padStart(7, "0")}
          </span>
        </div>
        <button onClick={handleExport} className="text-xs font-semibold text-gray-500 hover:text-blue-600 flex items-center gap-1">
          <Download className="size-3" /> Export
        </button>
      </div>
      <div
        className="bg-gray-900 p-4 overflow-y-auto font-mono text-sm leading-relaxed space-y-2"
        style={{ minHeight: "120px", maxHeight: "280px", scrollbarWidth: "thin", scrollbarColor: "#4B5563 transparent" }}
      >
        {loading && <p className="text-gray-500 text-center py-4">Loading...</p>}
        {!loading && lines.length === 0 && (
          <p className="text-gray-500 text-center py-4">No transcript available</p>
        )}
        {lines.map((line, i) => (
          <div key={i} className="flex gap-3 items-start">
            <span className="text-gray-500 w-10 shrink-0 pt-0.5 text-xs">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <span className={`font-bold mr-2 tracking-wide text-xs ${
                line.speaker === "AI" ? "text-blue-300" : "text-yellow-400"
              }`}>
                [{line.speaker.toUpperCase()}]
              </span>
              <span className={line.speaker === "AI" ? "text-gray-300" : "text-white"}>
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
  const { emergencies, activeSessions } = useEmergencyFeedContext()
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
            {filtered.length === 0 && (
              <p className="text-base text-gray-400 text-center py-8">No incidents yet</p>
            )}
            {filtered.map((e) => (
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
        {activeCount > 0 && (
          <div>
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
                  speaker={session.speaker}
                />
              ))}
            </div>
          </div>
        )}

        {selected && selected.status === "resolved" && (
          <div>
            {activeCount === 0 && (
              <h2 className="text-base font-bold text-gray-900 tracking-tight mb-3">Transcript</h2>
            )}
            {activeCount > 0 && (
              <h2 className="text-base font-bold text-gray-900 tracking-tight mb-3">Recent Transcript</h2>
            )}
            <TranscriptDetail emergency={selected} />
          </div>
        )}

        {activeCount === 0 && !(selected && selected.status === "resolved") && (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Terminal className="size-8 mx-auto mb-3 opacity-50" />
              <p className="text-base font-medium">No active calls</p>
              <p className="text-sm mt-1">Live transcriptions appear here during calls</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
