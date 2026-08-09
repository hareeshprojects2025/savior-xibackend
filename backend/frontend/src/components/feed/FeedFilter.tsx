import { ArrowUpDown } from "lucide-react"

type SortOrder = "newest" | "oldest"

interface FeedFilterProps {
  selectedStatus: string | null
  onStatusChange: (status: string | null) => void
  selectedSeverity: string | null
  onSeverityChange: (severity: string | null) => void
  sortOrder: SortOrder
  onSortChange: (order: SortOrder) => void
  activeCount: number
}

const statusOptions = ["All", "pending", "dispatched", "en_route", "resolved"] as const
const severityOptions = ["Critical", "High", "Medium", "Low"] as const

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

export function FeedFilter({ selectedStatus, onStatusChange, selectedSeverity, onSeverityChange, sortOrder, onSortChange, activeCount }: FeedFilterProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          {statusOptions.map((s) => (
            <FilterPill
              key={s}
              active={s === "All" ? selectedStatus === null : selectedStatus === s}
              onClick={() => onStatusChange(s === "All" ? null : s)}
            >
              {s === "en_route" ? "En Route" : s.charAt(0).toUpperCase() + s.slice(1)}
            </FilterPill>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-400"><span className="cockpit-number">{activeCount}</span> active</span>
          <button
            type="button"
            onClick={() => onSortChange(sortOrder === "newest" ? "oldest" : "newest")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm transition-colors"
          >
            <ArrowUpDown className="size-4" />
            {sortOrder === "newest" ? "Newest" : "Oldest"}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {severityOptions.map((s) => (
          <FilterPill
            key={s}
            active={selectedSeverity === s}
            onClick={() => onSeverityChange(selectedSeverity === s ? null : s)}
          >
            {s}
          </FilterPill>
        ))}
      </div>
    </div>
  )
}