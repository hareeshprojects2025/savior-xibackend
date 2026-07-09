export type EmergencyStatus = "pending" | "dispatched" | "en_route" | "resolved"

export type Severity = "Critical" | "High" | "Medium" | "Low" | string | null

export interface Emergency {
  id: number
  caller_name: string
  caller_phone: string | null
  victim_name: string | null
  emergency_type: string
  severity: Severity
  location: string
  landmark: string | null
  victims: number | null
  description: string | null
  immediate_danger: string | null
  summary: string | null
  status: EmergencyStatus
  full_transcript: string | null
  created_at: string
}

export interface EmergencySummary {
  id: number
  caller_name: string
  caller_phone: string | null
  emergency_type: string
  severity: Severity
  location: string
  victims: number | null
  status: EmergencyStatus
  created_at: string
}

export interface EmergencyStats {
  total_emergencies: number
  active_count: number
  resolved_count: number
  by_severity: Record<string, number>
  by_status: Record<string, number>
  by_type: Record<string, number>
  by_hour: { hour: string; count: number }[]
}

export interface WsMessage {
  type: "new_emergency" | "status_update" | "transcript_chunk" | "transcript_complete"
  emergency_id?: number
  status?: EmergencyStatus
  chunk_text?: string
  speaker?: string
  is_final?: boolean
  data?: Emergency
}

export const STATUS_TRANSITIONS: Record<EmergencyStatus, EmergencyStatus[]> = {
  pending: ["dispatched"],
  dispatched: ["en_route"],
  en_route: ["resolved"],
  resolved: [],
}

export const STATUS_LABELS: Record<EmergencyStatus, string> = {
  pending: "Pending",
  dispatched: "Dispatched",
  en_route: "En Route",
  resolved: "Resolved",
}

export const SEVERITY_COLORS: Record<string, string> = {
  Critical: "danger",
  High: "warning",
  Medium: "amber",
  Low: "muted",
}
