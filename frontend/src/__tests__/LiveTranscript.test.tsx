import { describe, it, expect, vi, beforeAll } from "vitest"
import { render, screen } from "@testing-library/react"
import { LiveTranscript } from "@/components/detail/LiveTranscript"

beforeAll(() => {
  // scrollIntoView is not implemented in jsdom
  Element.prototype.scrollIntoView = vi.fn()
})

const mockLines = [
  { speaker: "AI" as const, text: "Hello, this is 911.", timestamp: new Date().toISOString() },
  { speaker: "Caller" as const, text: "There's a fire!", timestamp: new Date().toISOString() },
]

describe("LiveTranscript", () => {
  it("renders waiting state when not active", () => {
    render(<LiveTranscript lines={[]} active={false} />)
    expect(screen.getByText(/Waiting for transcript/i)).toBeDefined()
  })

  it("renders listening state when active but no lines", () => {
    render(<LiveTranscript lines={[]} active={true} />)
    expect(screen.getByText(/Listening/i)).toBeDefined()
  })

  it("renders transcript lines when active with lines", () => {
    render(<LiveTranscript lines={mockLines} active={true} />)
    expect(screen.getByText(/Hello, this is 911/)).toBeDefined()
    expect(screen.getByText(/There's a fire!/)).toBeDefined()
    expect(screen.getByText(/LIVE/)).toBeDefined()
  })

  it("auto-scroll is enabled by default (shows LIVE header)", () => {
    render(<LiveTranscript lines={mockLines} active={true} />)
    // The component is in its active-with-lines state — LIVE badge visible
    expect(screen.getByText("LIVE")).toBeDefined()
  })
})
