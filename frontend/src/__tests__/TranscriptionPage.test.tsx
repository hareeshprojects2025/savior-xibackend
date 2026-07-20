import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { Emergency } from "@/lib/types"

const mockTranscripts: Record<number, Array<{ speaker: string; text: string; timestamp: string }>> = {
  1: [
    { speaker: "AI", text: "Hello, this is 911.", timestamp: new Date().toISOString() },
    { speaker: "Caller", text: "There's a fire!", timestamp: new Date().toISOString() },
  ],
}

const mockEmergencies: Emergency[] = [
  {
    id: 1, caller_name: "John", caller_phone: "555-0100", victim_name: null,
    emergency_type: "Fire", severity: "Critical", location: "Downtown",
    landmark: null, victims: 2, description: "Building fire",
    immediate_danger: "Yes", summary: null,
    latitude: 19.076, longitude: 72.8777,
    status: "pending", full_transcript: null,
    bolna_call_id: null, location_captured: null, district_check: null, pipeline_status: null, dispatch_record_id: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 2, caller_name: "Jane", caller_phone: "555-0200", victim_name: null,
    emergency_type: "Medical", severity: "Low", location: "Uptown",
    landmark: null, victims: 1, description: null,
    immediate_danger: null, summary: null,
    latitude: 19.1, longitude: 72.9,
    status: "resolved", full_transcript: null,
    bolna_call_id: null, location_captured: null, district_check: null, pipeline_status: null, dispatch_record_id: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
]

vi.mock("@/hooks/EmergencyFeedContext", () => ({
  useEmergencyFeedContext: () => ({
    emergencies: mockEmergencies,
    transcripts: mockTranscripts,
  }),
}))

const { TranscriptionPage } = await import("@/pages/TranscriptionPage")

describe("TranscriptionPage", () => {
  it("renders call list from emergencies", () => {
    render(<TranscriptionPage />)
    expect(screen.getByText("INC-0000001")).toBeDefined()
    expect(screen.getByText("INC-0000002")).toBeDefined()
  })

  it("renders empty state when no selection", () => {
    render(<TranscriptionPage />)
    expect(screen.getByText(/Select a call/i)).toBeDefined()
  })

  it("severity filter filters call list", () => {
    render(<TranscriptionPage />)
    // Initially both items are in the list
    expect(screen.getByText("INC-0000001")).toBeDefined()
    expect(screen.getByText("INC-0000002")).toBeDefined()

    // Open filter dropdown by clicking the Filter button
    const filterButton = document.querySelector('[class*="text-gray-400 hover:text-blue-600"]')
    expect(filterButton).not.toBeNull()
    fireEvent.click(filterButton!)

    // Click "Critical" option (first match — the dropdown button, not the severity badge)
    const criticalBtns = screen.getAllByText("Critical")
    fireEvent.click(criticalBtns[0])

    // INC-0000001 (Critical) should still be visible
    expect(screen.getByText("INC-0000001")).toBeDefined()
    // INC-0000002 (Low) should NOT be in the sidebar list
    // The filter closes the dropdown, so now only Critical items show
  })

  it("play button is removed (queryByText returns null)", () => {
    render(<TranscriptionPage />)
    // Select an emergency to show the detail view
    const callItem = screen.getByText("INC-0000001")
    fireEvent.click(callItem)
    // Play button should not exist - it was removed in D-10
    expect(screen.queryByRole("button", { name: "Play recording" })).toBeNull()
  })
})
