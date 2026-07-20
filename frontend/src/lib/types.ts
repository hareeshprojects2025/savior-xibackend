export type EmergencyStatus = "pending" | "dispatched" | "en_route" | "resolved"

export type Severity = "Critical" | "High" | "Medium" | "Low" | null

export interface Station {
  id: number
  name: string
  type: "police" | "fire" | "medical"
  latitude: number
  longitude: number
  address: string
  phone: string | null
}

export interface StationRanking {
  station: Station
  distance_km: number
  eta_minutes: number
  encoded_polyline: string
}

export type DispatchStatus = "pending_call" | "acknowledged" | "rejected" | "no_answer" | "escalated" | "dispatch_failed"

export interface DispatchRecord {
  id: number
  emergency_id: number
  station_id: number
  status: DispatchStatus
  dispatched_at: string | null
  acknowledged_at: string | null
  created_at: string
}

export interface DispatchResponse {
  status: string
  dispatch_id: number
  message: string
}

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
  latitude: number | null
  longitude: number | null
  status: EmergencyStatus
  full_transcript: string | null
  bolna_call_id: string | null
  location_captured: boolean | null
  district_check: string | null
  pipeline_status: string | null
  dispatch_record_id: number | null
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
  latitude: number | null
  longitude: number | null
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
  type: "new_emergency" | "status_update" | "transcript_chunk" | "transcript_complete" | "transcript_resolved" | "emergency_deleted" | "live_transcript" | "dispatch_update" | "dispatch_escalated" | "location_received" | "dispatch_failed"
  emergency_id?: number
  status?: EmergencyStatus
  chunk_text?: string
  speaker?: string
  is_final?: boolean
  data?: Emergency
  session_id?: string
  transcript_text?: string
  emergency_type_detected?: string
  full_transcript?: string
  summary?: string
  dispatch_status?: string
  dispatch_record_id?: number
  station_id?: number
  station_name?: string
  rankings_available?: number
  previous_station_id?: number
  next_station_id?: number
  latitude?: number
  longitude?: number
}

export interface ActiveSession {
  session_id: string
  transcript_text: string
  speaker: string
  emergency_type: string
  updated_at: number
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
