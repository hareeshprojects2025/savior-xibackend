import { useRef, useEffect, useState } from "react"
import { MessageSquare, ArrowDown } from "lucide-react"

interface TranscriptLine {
  speaker: "AI" | "Caller"
  text: string
  timestamp: string
}

interface LiveTranscriptProps {
  lines: TranscriptLine[]
  active?: boolean
}

export function LiveTranscript({ lines, active }: LiveTranscriptProps) {
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [lines, autoScroll])

  if (!active) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
        <MessageSquare className="size-6 mb-2" />
        <p className="text-base font-medium">Waiting for transcript...</p>
      </div>
    )
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
        <span className="relative flex size-3 mb-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-30" />
          <span className="relative inline-flex size-3 rounded-full bg-blue-500" />
        </span>
        <p className="text-base font-medium">Listening...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-40" />
            <span className="relative inline-flex size-2 rounded-full bg-green-500" />
          </span>
          <span className="text-sm font-bold text-green-600">LIVE</span>
          <span className="text-sm font-medium text-gray-400">Transcript</span>
        </div>
        <button type="button" onClick={() => setAutoScroll(!autoScroll)}
          className={`flex items-center gap-1 text-sm font-semibold transition-colors ${autoScroll ? "text-blue-500" : "text-gray-400"}`}>
          <ArrowDown className="size-4" /> Auto-scroll
        </button>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto rounded-xl bg-gray-50 p-4 border border-gray-200">
        {lines.map((line, i) => (
          <div key={i} className={`text-base leading-relaxed ${line.speaker === "AI" ? "text-blue-600" : "text-gray-700"}`}>
            <span className="font-bold">{line.speaker}: </span>{line.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}