import { describe, it, expect } from "vitest"
import { cn, formatTimeAgo, getEmergenciesWithinRadius } from "@/lib/utils"
import type { Emergency } from "@/lib/types"

describe("formatTimeAgo", () => {
  it("returns 'Just now' for less than 1 minute", () => {
    const recent = new Date(Date.now() - 30 * 1000).toISOString()
    expect(formatTimeAgo(recent)).toBe("Just now")
  })

  it("returns 'X min ago' for less than 60 minutes", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(formatTimeAgo(fiveMinAgo)).toBe("5 min ago")
  })

  it("returns 'Xh ago' for less than 24 hours", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    expect(formatTimeAgo(threeHoursAgo)).toBe("3h ago")
  })

  it("returns 'Xd ago' for 24+ hours", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatTimeAgo(twoDaysAgo)).toBe("2d ago")
  })
})

describe("getEmergenciesWithinRadius", () => {
  const center: [number, number] = [19.076, 72.8777] // Mumbai

  const mockEmergencies: Emergency[] = [
    {
      id: 1, caller_name: "A", caller_phone: null, victim_name: null,
      emergency_type: "Fire", severity: "Critical", location: "Nearby",
      landmark: null, victims: null, description: null,
      immediate_danger: null, summary: null,
      latitude: 19.08, longitude: 72.88, // ~0.5 km from center
      status: "pending", full_transcript: null, created_at: new Date().toISOString(),
    },
    {
      id: 2, caller_name: "B", caller_phone: null, victim_name: null,
      emergency_type: "Medical", severity: "High", location: "Far",
      landmark: null, victims: null, description: null,
      immediate_danger: null, summary: null,
      latitude: 19.5, longitude: 73.0, // ~50 km from center
      status: "pending", full_transcript: null, created_at: new Date().toISOString(),
    },
    {
      id: 3, caller_name: "C", caller_phone: null, victim_name: null,
      emergency_type: "Accident", severity: null, location: "No coords",
      landmark: null, victims: null, description: null,
      immediate_danger: null, summary: null,
      latitude: null, longitude: null,
      status: "pending", full_transcript: null, created_at: new Date().toISOString(),
    },
  ]

  it("returns emergencies within the given radius", () => {
    const result = getEmergenciesWithinRadius(mockEmergencies, center, 5)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(1)
  })

  it("filters out emergencies with null coordinates", () => {
    const result = getEmergenciesWithinRadius(mockEmergencies, center, 100)
    expect(result).toHaveLength(2)
    expect(result.find((e) => e.id === 3)).toBeUndefined()
  })

  it("returns empty array for empty input", () => {
    const result = getEmergenciesWithinRadius([], center, 5)
    expect(result).toEqual([])
  })
})

describe("cn", () => {
  it("merges class names correctly", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2")
  })

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible")
  })
})
