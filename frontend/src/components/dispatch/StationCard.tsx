import { MapPin, Phone, Navigation } from "lucide-react"
import { cn } from "@/lib/utils"
import type { StationRanking } from "@/lib/types"

interface StationCardProps {
  ranking: StationRanking
  rank: number
  isSelected: boolean
  onSelect: () => void
  disabled: boolean
}

const typeConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  police: { label: "Police", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  fire: { label: "Fire", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  medical: { label: "Medical", bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
}

export function StationCard({ ranking, rank, isSelected, onSelect, disabled }: StationCardProps) {
  const station = ranking.station
  const typeInfo = typeConfig[station.type] || typeConfig.police

  return (
    <div
      onClick={disabled ? undefined : onSelect}
      className={cn(
        "relative rounded-xl border p-4 transition-all duration-150",
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "cursor-pointer hover:border-blue-300 hover:shadow-sm",
        isSelected
          ? "border-blue-400 ring-1 ring-blue-300 bg-blue-50/30"
          : "border-gray-200 bg-white",
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500 cockpit-number">
            {rank}
          </span>
          <h3 className="text-sm font-bold text-gray-900">{station.name}</h3>
        </div>
        <span className={cn("px-2 py-0.5 text-xs font-bold rounded border", typeInfo.bg, typeInfo.text, typeInfo.border)}>
          {typeInfo.label}
        </span>
      </div>

      <div className="space-y-1.5 pl-9">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{station.address}</span>
        </div>
        {station.phone && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Phone className="size-3.5 shrink-0" />
            <span>{station.phone}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Navigation className="size-3.5 shrink-0" />
          <span>
            <strong className="cockpit-number">{ranking.distance_km.toFixed(1)}</strong> km · ~<strong className="cockpit-number">{ranking.eta_minutes.toFixed(0)}</strong> min ETA
          </span>
        </div>
      </div>
    </div>
  )
}
