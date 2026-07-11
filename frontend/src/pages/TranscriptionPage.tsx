import { useState } from "react"
import { Download, ArrowRight, Filter, User, MapPin, Phone, Terminal } from "lucide-react"
import { useEmergencyFeedContext } from "@/hooks/EmergencyFeedContext"
import { formatTimeAgo } from "@/lib/utils"

interface Line {
  speaker: string
  text: string
  timestamp: string
}

function CallListItem({ id, caller_name, emergency_type, severity, status, created_at, selected, onClick }: {
  id: number
  caller_name: string
  emergency_type: string
  severity: string | null | undefined
  status: string
  created_at: string
  selected: boolean
  onClick: () => void
}) {
  const resolved = status === "resolved"
  return (
    <div
      onClick={onClick}
      className={`rounded-lg p-3 cursor-pointer transition-all ${
        selected
          ? "bg-white border-2 border-blue-500 shadow-sm"
          : "bg-white border border-gray-200 hover:border-blue-300 hover:bg-gray-50"
      } ${resolved ? "opacity-70" : ""}`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className={`font-mono text-sm font-semibold ${selected ? "text-blue-600" : "text-gray-500"}`}>
          INC-{String(id).padStart(7, "0")}
        </span>
        {severity ? (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
            severity === "Critical"
              ? "bg-red-50 text-red-600 border-red-200"
              : "bg-orange-50 text-orange-600 border-orange-200"
          }`}>
            {severity === "Critical" && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
            {severity}
          </span>
        ) : (
          <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {resolved ? "Resolved" : "Pending"}
          </span>
        )}
      </div>
      <p className="text-base font-semibold text-gray-900 mb-1">{emergency_type}</p>
      <div className="flex justify-between items-center text-sm text-gray-400">
        <span className="flex items-center gap-1"><User className="size-4" /> {caller_name}</span>
        <span className="font-mono">{formatTimeAgo(created_at)}</span>
      </div>
    </div>
  )
}

function TranscriptLine({ line }: { line: Line }) {
  return (
    <div className="flex gap-4 items-start group">
      <span className="text-gray-500 w-12 shrink-0 pt-0.5">
        {new Date(line.timestamp).toLocaleTimeString("en-US", { minute: "2-digit", second: "2-digit" })}
      </span>
      <div>
        <span className={`font-bold mr-2 tracking-wide ${
          line.speaker === "AI" ? "text-blue-300" : "text-yellow-400"
        }`}>
          [{line.speaker.toUpperCase()}]
        </span>
        <span className={line.speaker === "AI" ? "text-gray-300" : "text-white"}>
          {line.text}
        </span>
      </div>
    </div>
  )
}

function exportTranscript(lines: Line[], emergencyId: number) {
  if (lines.length === 0) return
  const blob = new Blob([JSON.stringify(lines, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `transcript-INC-${String(emergencyId).padStart(7, "0")}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function TranscriptionPage() {
  const { emergencies, transcripts } = useEmergencyFeedContext()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string | null>(null)
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

  const selected = emergencies.find((e) => e.id === selectedId) || null
  const selectedLines = selectedId ? (transcripts[selectedId] || []) : []

  const sorted = [...emergencies].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  const filtered = severityFilter
    ? sorted.filter((e) => e.severity === severityFilter)
    : sorted

  const severityOptions = ["Critical", "High", "Medium", "Low"] as const

  return (
    <div className="flex h-[calc(100vh-3.5rem-1.5rem)] gap-0 -mx-6 -mb-6">
      <aside className="w-72 border-r border-gray-200 bg-gray-50 flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-gray-200 bg-white relative">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900 tracking-tight">Transcriptions</h2>
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className={`text-gray-400 hover:text-blue-600 transition-colors ${severityFilter ? "text-blue-600" : ""}`}
            >
              <Filter className="size-4" />
            </button>
          </div>
          {showFilterDropdown && (
            <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 shadow-lg rounded-b-lg p-1">
              {severityOptions.map((s) => (
                <button
                  key={s}
                  onClick={() => { setSeverityFilter(severityFilter === s ? null : s); setShowFilterDropdown(false) }}
                  className={`block w-full text-left px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                    severityFilter === s
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {s}
                </button>
              ))}
              {severityFilter && (
                <button
                  onClick={() => { setSeverityFilter(null); setShowFilterDropdown(false) }}
                  className="block w-full text-left px-3 py-1.5 text-sm font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md"
                >
                  Clear filter
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {filtered.length === 0 && (
            <p className="text-base text-gray-400 text-center py-8">No emergencies yet</p>
          )}
          {filtered.map((e) => (
            <CallListItem
              key={e.id}
              id={e.id}
              caller_name={e.caller_name}
              emergency_type={e.emergency_type}
              severity={e.severity}
              status={e.status}
              created_at={e.created_at}
              selected={selectedId === e.id}
              onClick={() => setSelectedId(e.id)}
            />
          ))}
        </div>
      </aside>

      <section className="flex-1 flex flex-col p-6 gap-4 overflow-hidden">
        {selected ? (
          <>
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <h1 className="text-lg font-bold text-gray-900">{selected.caller_phone || "Unknown"}</h1>
                  <div className="flex items-center gap-3 text-sm text-gray-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Phone className="size-4" />
                      <span className="font-mono font-semibold text-gray-700">{selected.emergency_type}</span>
                    </span>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <span className="flex items-center gap-1">
                      <User className="size-4" /> {selected.caller_name}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <span className="flex items-center gap-1">
                      <MapPin className="size-4" /> {selected.location}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="cockpit-number text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg border border-gray-200">{selectedLines.length} lines</span>
                  <button onClick={() => exportTranscript(selectedLines, selected.id)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5">
                    <Download className="size-4" /> Export
                  </button>
                  <button className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1.5">
                    View Detail <ArrowRight className="size-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 bg-gray-900 rounded-xl border border-gray-700 overflow-hidden flex flex-col shadow-lg">
              <div className="bg-gray-950 px-4 py-2 flex items-center justify-between border-b border-gray-700">
                <div className="flex items-center gap-2">
                  <Terminal className="size-4 text-blue-300" />
                  <span className="font-mono text-xs text-blue-300 uppercase tracking-widest">
                    {selected.status === "resolved" ? "Transcript" : "Live Transcription Stream"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {selected.status !== "resolved" && (
                    <>
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-mono text-xs text-green-500 font-bold">REC</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-3 font-mono text-sm leading-relaxed bg-gray-900"
                style={{ scrollbarWidth: "thin", scrollbarColor: "#4B5563 transparent" }}
              >
                {selectedLines.length === 0 && (
                  <p className="text-gray-500 text-center py-8">Waiting for transcription...</p>
                )}
                {selectedLines.map((line, i) => (
                  <TranscriptLine key={`${line.timestamp}-${i}`} line={line} />
                ))}
                {selectedLines.length > 0 && selected.status !== "resolved" && (
                  <div className="flex gap-4 items-start mt-4">
                    <span className="text-gray-500 w-12 shrink-0 pt-0.5">--:--</span>
                    <div className="w-2 h-4 bg-blue-300 animate-pulse" />
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Terminal className="size-8 mx-auto mb-3 opacity-50" />
              <p className="text-base font-medium">Select a call to view its transcription</p>
              <p className="text-sm mt-1">Live transcripts appear as calls are processed</p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}