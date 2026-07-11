import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Emergency } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function getEmergenciesWithinRadius(
  emergencies: Emergency[], center: [number, number], radiusKm: number
): Emergency[] {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const [lat, lng] = center
  return emergencies.filter(e => {
    if (e.latitude == null || e.longitude == null) return false
    const dLat = toRad(e.latitude - lat)
    const dLng = toRad(e.longitude - lng)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(e.latitude)) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= radiusKm
  })
}
