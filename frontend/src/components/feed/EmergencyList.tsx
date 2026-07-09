import { EmergencyCard } from "./EmergencyCard"
import { EmptyState } from "@/components/common/EmptyState"
import { FeedSkeleton } from "@/components/common/LoadingSkeleton"
import { ErrorState } from "@/components/common/ErrorState"
import { ShieldCheck } from "lucide-react"
import type { Emergency } from "@/lib/types"

interface EmergencyListProps {
  emergencies: Emergency[]
  loading?: boolean
  error?: string | null
  selectedId?: number | null
  onSelect?: (id: number) => void
  onRetry?: () => void
}

export function EmergencyList({
  emergencies,
  loading,
  error,
  selectedId,
  onSelect,
  onRetry,
}: EmergencyListProps) {
  if (error && emergencies.length === 0) {
    return <ErrorState title="Failed to load emergencies" description={error} onRetry={onRetry} />
  }

  if (loading && emergencies.length === 0) {
    return <FeedSkeleton />
  }

  if (emergencies.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="No active emergencies"
        description="All clear."
        footnote="New reports will appear here in real-time"
      />
    )
  }

  return (
    <div className="space-y-2.5">
      {emergencies.map((emergency) => (
        <EmergencyCard
          key={emergency.id}
          emergency={emergency}
          selected={selectedId === emergency.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
