import { ArrowUpDown } from "lucide-react"

type SortOrder = "newest" | "oldest"

interface FeedFilterProps {
  selectedSeverity: string | null
  onSeverityChange: (severity: string | null) => void
  sortOrder: SortOrder
  onSortChange: (order: SortOrder) => void
  activeCount: number
}

const severityChips = [
  { label: "All", value: null, color: "bg-gray-900 text-white hover:bg-gray-800" },
  { label: "Critical", value: "Critical", color: "bg-red-500 text-white hover:bg-red-600" },
  { label: "High", value: "High", color: "bg-orange-500 text-white hover:bg-orange-600" },
  { label: "Medium", value: "Medium", color: "bg-yellow-400 text-yellow-900 hover:bg-yellow-500" },
  { label: "Low", value: "Low", color: "bg-gray-300 text-gray-700 hover:bg-gray-400" },
]

export function FeedFilter({ selectedSeverity, onSeverityChange, sortOrder, onSortChange, activeCount }: FeedFilterProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-1.5">
        {severityChips.map((chip) => {
          const active = selectedSeverity === chip.value
          return (
            <button
              key={chip.label}
              type="button"
              onClick={() => onSeverityChange(chip.value)}
              className={`px-3 py-1.5 text-sm font-bold rounded-full transition-all duration-150 shadow-sm ${
                active ? chip.color + " shadow-md scale-105" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {chip.label}
            </button>
          )
        })}
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
  )
}