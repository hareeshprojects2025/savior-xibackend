import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { Emergency } from "@/lib/types"

// Mock react-leaflet
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
  Popup: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="popup">{children}</div>
  ),
  useMap: () => ({ fitBounds: vi.fn(), panTo: vi.fn(), setView: vi.fn() }),
}))

vi.mock("leaflet", () => ({
  divIcon: () => ({}) as any,
}))

const { EmergencyMap } = await import("@/components/map/EmergencyMap")

const mockEmergencies: Emergency[] = [
  {
    id: 1, caller_name: "John", caller_phone: null, victim_name: null,
    emergency_type: "Fire", severity: "Critical", location: "Downtown",
    landmark: null, victims: 2, description: null,
    immediate_danger: "Yes", summary: null,
    latitude: 19.076, longitude: 72.8777,
    status: "pending", full_transcript: null, created_at: new Date().toISOString(),
  },
]

describe("EmergencyMap", () => {
  it("renders with emergency props", () => {
    render(<EmergencyMap emergencies={mockEmergencies} />)
    expect(screen.getByTestId("map-container")).toBeDefined()
  })

  it("renders empty state when no emergencies", () => {
    render(<EmergencyMap emergencies={[]} />)
    expect(screen.getByText(/No incidents to display/i)).toBeDefined()
  })

  it("renders error state with retry", () => {
    const onRetry = vi.fn()
    render(<EmergencyMap emergencies={[]} error="Failed to load" onRetry={onRetry} />)
    // Error state shows both title "Failed to load map" and error text
    expect(screen.getByText(/Failed to load map/i)).toBeDefined()
    const retryBtn = screen.getByRole("button", { name: /retry/i })
    expect(retryBtn).toBeDefined()
  })
})
