import { useState } from "react"
import { Trash2, Phone, MapPin, Users, AlertTriangle, User, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { StatusActions } from "./StatusActions"
import { StatusTimeline } from "./StatusTimeline"
import { LiveTranscript } from "./LiveTranscript"
import { ConfirmDialog } from "./ConfirmDialog"
import type { Emergency, EmergencyStatus } from "@/lib/types"
import type { TranscriptLine } from "@/hooks/useEmergencyFeed"
import { STATUS_LABELS } from "@/lib/types"

interface EmergencyDetailProps {
  emergency: Emergency | null
  onStatusChange?: (id: number, status: EmergencyStatus) => Promise<void>
  onDelete?: (id: number) => Promise<void>
  transcriptLines?: TranscriptLine[]
}

const statusBadgeColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  dispatched: "bg-blue-100 text-blue-800 border-blue-200",
  en_route: "bg-indigo-100 text-indigo-800 border-indigo-200",
  resolved: "bg-green-100 text-green-800 border-green-200",
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function Row({ label, value, icon: Icon, children, className }: {
  label: string; value?: string | null; icon?: React.ComponentType<{ className?: string }>
  children?: React.ReactNode; className?: string
}) {
  return (
    <div className="flex items-start gap-3">
      {Icon && <Icon className="size-4 text-gray-400 shrink-0 mt-0.5" />}
      <div className="min-w-0">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
        <div className="mt-0.5">
          {children || <span className={`text-base text-gray-900 ${className || ""}`}>{value}</span>}
        </div>
      </div>
    </div>
  )
}

export function EmergencyDetail({ emergency, onStatusChange, onDelete, transcriptLines }: EmergencyDetailProps) {
  const [statusLoading, setStatusLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<EmergencyStatus | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  if (!emergency) return null

  const handleStatusChange = async (status: EmergencyStatus) => {
    if (!onStatusChange) return
    setStatusLoading(true)
    try { await onStatusChange(emergency.id, status) } finally { setStatusLoading(false) }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setDeleteLoading(true)
    try { await onDelete(emergency.id) } finally { setDeleteLoading(false); setShowDeleteConfirm(false) }
  }

  const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(emergency.location)}`

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <Badge variant="outline" className={`text-sm px-2 py-0.5 mb-2 border ${statusBadgeColor[emergency.status]}`}>
            {STATUS_LABELS[emergency.status]}
          </Badge>
          <h3 className="text-xl font-bold text-gray-900 tracking-tighter">{emergency.emergency_type}</h3>
          <p className="text-sm font-medium text-gray-400 mt-0.5 cockpit-number">{getTimeAgo(emergency.created_at)}</p>
        </div>
      </div>

      <StatusActions currentStatus={emergency.status} onStatusChange={(s) => setPendingStatus(s)} loading={statusLoading} />

      <Separator className="bg-gray-200" />

      <div className="space-y-3">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Caller Info</h4>
        <div className="space-y-2.5 bg-gray-50 rounded-xl p-4">
          <div className="flex items-center gap-2.5">
            <User className="size-4 text-blue-500 shrink-0" />
            <span className="text-base font-semibold text-gray-900">{emergency.caller_name}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Phone className="size-4 text-blue-500 shrink-0" />
            <a href={`tel:${emergency.caller_phone}`} className="text-base font-medium text-blue-600 hover:underline">{emergency.caller_phone}</a>
          </div>
          {emergency.victim_name && (
            <div className="flex items-center gap-2.5">
              <Users className="size-4 text-blue-500 shrink-0" />
              <span className="text-base text-gray-700">{emergency.victim_name}</span>
            </div>
          )}
        </div>
      </div>

      <Separator className="bg-gray-200" />

      <div className="space-y-3">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Incident Details</h4>
        <div className="space-y-2.5 bg-gray-50 rounded-xl p-4">
          <Row label="Type" value={emergency.emergency_type} />
          {emergency.severity && (
            <Row label="Severity">
              <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${
                emergency.severity === "Critical" ? "bg-red-100 text-red-700" :
                emergency.severity === "High" ? "bg-orange-100 text-orange-700" :
                emergency.severity === "Medium" ? "bg-yellow-100 text-yellow-700" :
                "bg-gray-100 text-gray-600"
              }`}>{emergency.severity}</span>
            </Row>
          )}
          <Row label="Location" value={emergency.location} icon={MapPin} />
          {emergency.landmark && <Row label="Landmark" value={emergency.landmark} />}
          {emergency.victims != null && <Row label="Victims" value={`${emergency.victims}`} icon={Users} className="cockpit-number" />}
          {emergency.immediate_danger && (
            <Row label="Danger" value={`⚠ ${emergency.immediate_danger}`} icon={AlertTriangle} className="text-red-600 font-semibold" />
          )}
          {emergency.summary && <Row label="Summary" value={emergency.summary} />}
        </div>
      </div>

      {emergency.description && (
        <>
          <Separator className="bg-gray-200" />
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Description</h4>
            <p className="text-base text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-4">{emergency.description}</p>
          </div>
        </>
      )}

      <Separator className="bg-gray-200" />
      {emergency.full_transcript ? (
        <div>
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Transcript</h4>
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 max-h-64 overflow-y-auto">
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{emergency.full_transcript}</p>
          </div>
        </div>
      ) : (
        <LiveTranscript lines={transcriptLines || []} active={!!(transcriptLines && transcriptLines.length > 0)} />
      )}

      <Separator className="bg-gray-200" />
      <StatusTimeline emergency={emergency} />

      <Separator className="bg-gray-200" />
      <div>
        <div className="h-40 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center mb-2">
          <div className="flex flex-col items-center text-blue-400">
            <MapPin className="size-6 mb-1" />
            <span className="text-sm font-medium">Map loading</span>
          </div>
        </div>
        <p className="text-sm text-gray-600 font-medium mb-1">{emergency.location}</p>
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline">
          <ExternalLink className="size-3.5" /> Open in Maps
        </a>
      </div>

      <div className="pt-2">
        <Button variant="destructive" size="sm" className="w-full bg-red-500 hover:bg-red-600 text-white shadow-sm" onClick={() => setShowDeleteConfirm(true)} disabled={deleteLoading}>
          <Trash2 className="size-4 mr-1.5" />
          {deleteLoading ? "Deleting..." : "Delete Emergency"}
        </Button>
      </div>

      <ConfirmDialog
        open={!!pendingStatus}
        onOpenChange={(o) => { if (!o) setPendingStatus(null) }}
        title={`Mark as ${pendingStatus ? STATUS_LABELS[pendingStatus] : ""}?`}
        description={`Change status of INC-${String(emergency.id).padStart(7, "0")} to ${pendingStatus ? STATUS_LABELS[pendingStatus] : ""}?`}
        confirmLabel={pendingStatus ? STATUS_LABELS[pendingStatus] : ""}
        confirmVariant={pendingStatus === "resolved" ? "success" : "default"}
        onConfirm={() => { if (pendingStatus) handleStatusChange(pendingStatus) }}
        loading={statusLoading}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete this emergency?"
        description="This action cannot be undone. All transcript data will be permanently removed."
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  )
}