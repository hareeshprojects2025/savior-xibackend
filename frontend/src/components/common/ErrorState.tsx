import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
}

export function ErrorState({ title = "Failed to load emergencies", description = "The server is not responding. Check your connection and try again.", onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="size-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
        <AlertTriangle className="size-6 text-red-500" />
      </div>
      <h3 className="text-base font-bold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4 border-gray-200 text-gray-600" onClick={onRetry}>
          <RefreshCw className="size-3.5 mr-1.5" /> Retry
        </Button>
      )}
    </div>
  )
}

export function ConnectionBanner({ connected, onRetry }: { connected: boolean; onRetry?: () => void }) {
  if (connected) return null
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border-b border-red-200 text-sm">
      <span className="relative flex size-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-40" />
        <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
      </span>
      <span className="text-sm font-bold text-red-700">Connection lost. Reconnecting...</span>
      {onRetry && (
        <button onClick={onRetry} className="ml-auto text-sm font-bold text-red-700 underline underline-offset-2 hover:no-underline">
          Retry
        </button>
      )}
    </div>
  )
}