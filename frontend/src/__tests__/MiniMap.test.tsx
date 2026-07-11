import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

// Mock react-leaflet
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mini-map">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: () => <div data-testid="marker" />,
  Popup: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="popup">{children}</div>
  ),
  useMap: () => ({ setView: vi.fn() }),
}))

vi.mock("leaflet", () => ({
  divIcon: () => ({}) as any,
}))

const { MiniMap } = await import("@/components/detail/MiniMap")

describe("MiniMap", () => {
  it("renders with valid lat/lng", () => {
    render(<MiniMap location="Mumbai" lat={19.076} lng={72.8777} />)
    expect(screen.getByTestId("mini-map")).toBeDefined()
  })

  it("renders fallback when coordinates null", () => {
    render(<MiniMap location="Unknown" />)
    expect(screen.getByText(/No location data/i)).toBeDefined()
  })
})
