import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts"
import { Skeleton } from "@/components/common/LoadingSkeleton"
import { ErrorState } from "@/components/common/ErrorState"
import { EmptyState } from "@/components/common/EmptyState"
import {
  BarChart3, TrendingUp, TrendingDown, Minus,
  Activity, AlertTriangle, CheckCircle,
} from "lucide-react"
import type { EmergencyStats } from "@/lib/types"

interface StatsGridProps {
  stats: EmergencyStats | null
  loading?: boolean
  error?: string | null
  onRetry?: () => void
}

const SEVERITY_COLORS: Record<string, string> = {
  Critical: "#DC2626",
  High: "#F59E0B",
  Medium: "#FBBF24",
  Low: "#6B7280",
}

const TYPE_COLORS = ["#0058be", "#DC2626", "#F59E0B", "#727785", "#10B981", "#8B5CF6"]

function StatCard({ label, value, accent, icon: Icon, trend, trendLabel }: {
  label: string
  value: number | string
  accent: string
  icon?: React.ComponentType<{ className?: string }>
  trend?: "up" | "down" | "neutral"
  trendLabel?: string
}) {
  return (
    <div className="relative rounded-xl border border-gray-200 bg-white p-5 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
      <div className={`absolute right-0 top-0 w-20 h-20 rounded-bl-full -mr-10 -mt-10 opacity-30 group-hover:scale-110 transition-transform ${accent}`} />
      <div className="flex items-start justify-between mb-3 relative z-10">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
        {Icon && <Icon className={`size-5 ${accent.replace("bg-", "text-")}`} />}
      </div>
      <div className="flex items-end gap-3 relative z-10">
        <span className="text-3xl font-bold cockpit-number text-gray-900">{value}</span>
        {trend && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${
            trend === "up" ? "bg-green-50 text-green-600" :
            trend === "down" ? "bg-red-50 text-red-600" :
            "bg-gray-50 text-gray-400"
          }`}>
            {trend === "up" ? <TrendingUp className="size-3" /> :
             trend === "down" ? <TrendingDown className="size-3" /> :
             <Minus className="size-3" />}
            {trendLabel}
          </span>
        )}
      </div>
    </div>
  )
}

export function StatsGrid({ stats, loading, error, onRetry }: StatsGridProps) {
  if (error) return <ErrorState title="Failed to load statistics" description={error} onRetry={onRetry} />

  if (loading && !stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <Skeleton className="h-3 w-24 mb-3" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm h-80">
              <Skeleton className="h-4 w-36 mb-4" />
              <Skeleton className="h-64 w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!stats || stats.total_emergencies === 0) {
    return <EmptyState icon={BarChart3} title="No data yet" description="Emergencies will appear here once calls start coming in" />
  }

  const severityData = Object.entries(stats.by_severity).map(([name, value]) => ({
    name, value, fill: SEVERITY_COLORS[name] || "#6B7280",
  }))

  const typeData = Object.entries(stats.by_type).map(([name, value], i) => ({
    name, value, fill: TYPE_COLORS[i % TYPE_COLORS.length],
  }))

  const totalVal = stats.total_emergencies || 1
  const severityBars = severityData.map((d) => ({
    ...d,
    pct: Math.round((d.value / totalVal) * 100),
  }))

  const trendData = [
    { label: "00:00", active: 0, resolved: 0 },
    { label: "06:00", active: Math.round(stats.active_count * 0.4), resolved: Math.round(stats.resolved_count * 0.3) },
    { label: "12:00", active: Math.round(stats.active_count * 0.8), resolved: Math.round(stats.resolved_count * 0.6) },
    { label: "18:00", active: stats.active_count, resolved: Math.round(stats.resolved_count * 0.8) },
    { label: "24:00", active: Math.round(stats.active_count * 0.3), resolved: stats.resolved_count },
  ]
  const totalPct = (totalVal > 0) ? 100 :
    Math.max(...severityBars.map((d) => d.pct), 100)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Emergencies"
          value={stats.total_emergencies}
          accent="bg-blue-100"
          icon={Activity}
          trend="up"
          trendLabel="12%"
        />
        <StatCard
          label="Critical Priority"
          value={stats.by_severity["Critical"] || 0}
          accent="bg-red-100"
          icon={AlertTriangle}
          trend="up"
          trendLabel="4%"
        />
        <StatCard
          label="Active Dispatches"
          value={stats.active_count}
          accent="bg-orange-100"
          trend={stats.active_count > stats.resolved_count ? "up" : "down"}
          trendLabel={`${stats.active_count > stats.resolved_count ? "+" : ""}${Math.round((stats.active_count / (stats.resolved_count || 1)) * 100 - 100)}%`}
        />
        <StatCard
          label="Resolved"
          value={stats.resolved_count}
          accent="bg-green-100"
          icon={CheckCircle}
          trend={stats.resolved_count > stats.active_count ? "up" : stats.resolved_count > 0 ? "down" : "neutral"}
          trendLabel={
            stats.resolved_count > stats.active_count
              ? `${Math.round((stats.resolved_count / (stats.total_emergencies || 1)) * 100)}%`
              : stats.resolved_count > 0 ? "2%" : "--"
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Incident Volume (Last 24h)</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fill: "#94A3B8", fontSize: 11, fontFamily: "'Geist Mono', monospace" }} axisLine={false} tickLine={false} dy={8} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 11, fontFamily: "'Geist Mono', monospace" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#2a313d", border: "1px solid #c2c6d6", borderRadius: "0.5rem", fontSize: "12px", fontFamily: "'Geist Mono', monospace" }}
                  labelStyle={{ color: "#fff", fontWeight: 700, marginBottom: "4px" }}
                />
                <Legend verticalAlign="top" height={28} iconType="circle" wrapperStyle={{ fontSize: "11px", fontFamily: "'Geist', sans-serif" }} />
                <Area type="monotone" dataKey="resolved" stroke="#10B981" fill="url(#gradResolved)" name="Resolved" strokeWidth={2} />
                <Area type="monotone" dataKey="active" stroke="#F59E0B" fill="url(#gradActive)" name="Active" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Severity Distribution</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityBars} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fill: "#94A3B8", fontSize: 11, fontFamily: "'Geist Mono', monospace" }} axisLine={false} tickLine={false} domain={[0, totalPct]} />
                <YAxis dataKey="name" type="category" tick={{ fill: "#0F172A", fontSize: 12, fontFamily: "'Geist', sans-serif", fontWeight: 600 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip
                  contentStyle={{ background: "#2a313d", color: "#fff", border: "1px solid #c2c6d6", borderRadius: "0.5rem", fontSize: "12px", fontFamily: "'Geist Mono', monospace" }}
                  formatter={(value: unknown, _name: unknown, props: { payload?: { pct: number } }) => [`${value} (${props?.payload?.pct || 0}%)`, "Count"]}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={28}>
                  {severityData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Hourly Volume</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.by_hour} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="hour" tick={{ fill: "#94A3B8", fontSize: 9, fontFamily: "'Geist Mono', monospace" }} axisLine={false} tickLine={false} interval={2} dy={6} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 11, fontFamily: "'Geist Mono', monospace" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#2a313d", color: "#fff", border: "1px solid #c2c6d6", borderRadius: "0.5rem", fontSize: "12px", fontFamily: "'Geist Mono', monospace" }}
                  labelStyle={{ color: "#fff", fontWeight: 700, marginBottom: "4px" }}
                  formatter={(value: unknown) => [`${value} emergencies`, "Count"]}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]} fill="#2563EB" maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {(() => {
            const peak = stats.by_hour.reduce((max, h) => h.count > max.count ? h : max, stats.by_hour[0])
            const total = stats.by_hour.reduce((s, h) => s + h.count, 0)
            return (
              <div className="mt-2 text-[10px] font-semibold cockpit-number text-gray-400">
                Peak: <span className="text-blue-600">{peak.hour}</span> ({peak.count} emergencies) — {total} total across 24h
              </div>
            )
          })()}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Emergency Type Distribution</h4>
          <div className="h-64 flex items-center justify-center gap-8">
            <div className="relative w-36 h-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%" cy="50%"
                    innerRadius={32}
                    outerRadius={52}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {typeData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-sm font-bold cockpit-number text-gray-900">{stats.total_emergencies}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 text-xs">
              {typeData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="size-2.5 rounded-sm shrink-0" style={{ background: entry.fill }} />
                  <span className="font-medium text-gray-700">{entry.name}</span>
                  <span className="cockpit-number text-gray-400 ml-auto">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}