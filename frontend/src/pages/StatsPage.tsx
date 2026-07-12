import { useEffect, useState } from "react"
import { Download } from "lucide-react"
import { StatsGrid } from "@/components/stats/StatsGrid"
import { useApi } from "@/hooks/useApi"
import type { EmergencyStats } from "@/lib/types"

export function StatsPage() {
  const [stats, setStats] = useState<EmergencyStats | null>(null)
  const [period, setPeriod] = useState<"Today" | "Week" | "Month" | "Year" | "5 Year">("Today")
  const { fetchStats, loading, error } = useApi()

  const periodDays: Record<string, number | undefined> = { Today: 1, Week: 7, Month: 30, Year: 365, "5 Year": 1825 }

  useEffect(() => {
    fetchStats(periodDays[period]).then(setStats)
  }, [fetchStats, period])

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-40" />
              <span className="relative inline-flex size-2 rounded-full bg-green-500" />
            </span>
            <span className="text-xs font-semibold text-green-600 uppercase tracking-wider">Live Feed Active</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Operational Statistics</h1>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-0.5">
            {(["Today", "Week", "Month", "Year", "5 Year"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  period === p
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-1.5">
            <Download className="size-3.5" />
            Export
          </button>
        </div>
      </div>

      <StatsGrid
        stats={stats}
        loading={loading}
        error={error}
        onRetry={() => fetchStats(periodDays[period]).then(setStats)}
      />
    </div>
  )
}