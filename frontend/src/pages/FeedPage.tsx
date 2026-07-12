import { useState, useCallback } from "react"
import { EmergencyList } from "@/components/feed/EmergencyList"
import { FeedFilter } from "@/components/feed/FeedFilter"
import { EmergencyDetail } from "@/components/detail/EmergencyDetail"
import { ConnectionBanner } from "@/components/common/ErrorState"
import { useEmergencyFeedContext } from "@/hooks/EmergencyFeedContext"
import { useApi } from "@/hooks/useApi"
import { X } from "lucide-react"
import type { EmergencyStatus } from "@/lib/types"

export function FeedPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest")

  const { emergencies, connected, loading, error: wsError, retry, transcripts } = useEmergencyFeedContext()
  const { updateStatus, deleteEmergency } = useApi()

  const handleStatusUpdate = useCallback(async (id: number, status: EmergencyStatus) => { await updateStatus(id, status) }, [updateStatus])
  const handleDelete = useCallback(async (id: number) => { await deleteEmergency(id) }, [deleteEmergency])

  const filteredEmergencies = emergencies
    .filter((e) => {
      if (selectedStatus && e.status !== selectedStatus) return false
      if (selectedSeverity && e.severity !== selectedSeverity) return false
      return true
    })
    .sort((a, b) => {
      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      return sortOrder === "newest" ? diff : -diff
    })

  const selectedEmergency = emergencies.find((e) => e.id === selectedId) || null
  const transcriptLines = selectedId ? transcripts[selectedId] : undefined

  return (
    <div className="flex gap-5 h-[calc(100vh-3.5rem-2.5rem)]">
      <div className={`${selectedId ? "w-1/2" : "w-full"} transition-all duration-300`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Active Emergencies</h1>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">Live feed from Bolna AI</p>
          </div>
        </div>

        <ConnectionBanner connected={connected} onRetry={retry} />

        <FeedFilter
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          selectedSeverity={selectedSeverity}
          onSeverityChange={setSelectedSeverity}
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
          activeCount={filteredEmergencies.length}
        />

        <div className="overflow-y-auto pr-2 h-[calc(100%-8rem)]">
          <EmergencyList
            emergencies={filteredEmergencies}
            loading={loading}
            error={wsError}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRetry={retry}
          />
        </div>
      </div>

      {selectedId && selectedEmergency && (
        <div className="w-1/2 overflow-y-auto border-l border-gray-200 pl-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Details</h2>
            <button onClick={() => setSelectedId(null)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <X className="size-4" />
            </button>
          </div>
          <EmergencyDetail
            emergency={selectedEmergency}
            onStatusChange={handleStatusUpdate}
            onDelete={handleDelete}
            transcriptLines={transcriptLines}
          />
        </div>
      )}
    </div>
  )
}