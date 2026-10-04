/**
 * Waste Management Intelligence System - Frontend API Client
 */

const RAW_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5056").trim();

/**
 * Normalizes endpoint paths and base URLs so that `/api` is ALWAYS correctly positioned,
 * preventing double `/api/api`, missing `/api`, missing leading slashes, or trailing slashes.
 * Supports both local development and multi-cloud reverse proxies (Render, Vercel, Railway, etc.).
 */
export function buildApiUrl(path: string): string {
  let cleanPath = path.startsWith("/") ? path : `/${path}`;

  // Automatically ensure `/api` prefix if missing
  if (!cleanPath.startsWith("/api/") && cleanPath !== "/api") {
    cleanPath = `/api${cleanPath}`;
  }

  // Remove any trailing slash from BASE_URL
  let baseUrl = RAW_BASE_URL.replace(/\/+$/, "");

  // If BASE_URL already has trailing /api, strip it to prevent duplicate /api/api
  if (baseUrl.endsWith("/api")) {
    baseUrl = baseUrl.slice(0, -4);
  }

  return baseUrl ? `${baseUrl}${cleanPath}` : cleanPath;
}

export const BASE_URL = RAW_BASE_URL;

export interface Area {
  id: number;
  name: string;
  region: string;
  ward_code: string;
  officer_name: string;
  contact_number: string;
}

export interface WasteType {
  id: number;
  name: string;
  category: string;
  color_hex: string;
  guidance: string;
  examples: string;
}

export interface Schedule {
  id: number;
  area_name: string;
  waste_name: string;
  color_hex: string;
  day: string;
  time_range: string;
  route_status: string;
}

export interface Center {
  id: number;
  name: string;
  address: string;
  accepted: string;
  hours: string;
  contact: string;
}

export interface TrackingData {
  issue_code: string;
  status: "NEW" | "IN PROGRESS" | "RESOLVED" | "CLOSED";
  resident_name: string;
  issue_type: string;
  address: string;
  area_name?: string;
  ward_code?: string;
  officer_name?: string;
  ward_contact?: string;
  priority?: string;
  admin_notes?: string;
  created_at?: string;
  history?: Array<{
    action: string;
    note: string;
    actor: string;
    created_at?: string;
  }>;
}

export interface ChatResponse {
  reply: string;
  level: "L1_FAQ" | "L2_RAG" | "L3_LLM";
  confidence: number;
  response_time_ms: number;
  source_document: string;
  channel: "chat" | "voice";
  duration_seconds?: number;
  trigger_report_flow?: boolean;
  tracking_data?: TrackingData | null;
  follow_ups?: string[];
}

export interface ComplaintPayload {
  resident_name: string;
  phone?: string;
  address: string;
  area_id: number;
  issue_type: string;
  description: string;
  photo_url?: string | null;
  priority?: "Low" | "Medium" | "High" | "Critical";
}

export interface ComplaintResponse {
  success: boolean;
  issue_code: string;
  status: string;
  message: string;
  sms_sent?: boolean;
  sms_phone?: string;
  sms_message?: string;
  created_at: string;
}

export interface TimelineItem {
  id: number;
  action: string;
  note: string;
  actor: string;
  created_at: string;
}

export interface ComplaintDetail {
  id: number;
  issue_code: string;
  resident_name: string;
  phone?: string;
  address: string;
  area_id: number;
  area_name: string;
  ward_code: string;
  officer_name: string;
  ward_contact: string;
  issue_type: string;
  description: string;
  photo_url?: string | null;
  priority: string;
  status: "NEW" | "IN PROGRESS" | "RESOLVED" | "CLOSED";
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  timeline?: TimelineItem[];
  history_count?: number;
}

export interface WardScorecardItem {
  area_id: number;
  name: string;
  ward_code: string;
  officer_name: string;
  total_issues: number;
  resolved_issues: number;
  open_issues: number;
  cleanliness_pct: number;
  tier: string;
}

export interface DailyTrendItem {
  day: string;
  reported: number;
  cleared: number;
}

export interface PriorityVelocityItem {
  count: number;
  time_hours: number;
  sla_target: number;
  compliance_pct: number;
}

export interface AdminMetrics {
  routing: {
    l1_faq_pct: number;
    l2_rag_pct: number;
    l3_llm_pct: number;
    l1_count: number;
    l2_count: number;
    l3_count: number;
    total_queries: number;
    chat_queries: number;
    voice_queries: number;
    avg_latency_ms: number;
  };
  issues: {
    total: number;
    new: number;
    in_progress: number;
    resolved: number;
    closed: number;
    unresolved: number;
    resolution_rate: number;
  };
  issues_by_type: { name: string; count: number }[];
  issues_by_ward: { ward: string; count: number }[];
  ward_scorecard?: WardScorecardItem[];
  daily_trend?: DailyTrendItem[];
  priority_velocity?: {
    critical: PriorityVelocityItem;
    high: PriorityVelocityItem;
    medium: PriorityVelocityItem;
    low: PriorityVelocityItem;
  };
  sla_compliance_pct?: number;
  mean_resolution_hours?: number;
  landfill_diversion_pct?: number;
  csat_rating?: number;
}

export interface ChatLogItem {
  id: number;
  channel: "chat" | "voice";
  user_message: string;
  assistant_reply: string;
  routing_level: "L1_FAQ" | "L2_RAG" | "L3_LLM";
  confidence: number;
  response_time_ms: number;
  source_document: string;
  created_at: string;
}

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("wmis_admin_token") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string> || {}),
  };

  const fullUrl = buildApiUrl(path);
  const res = await fetch(fullUrl, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.detail || `Request failed with status ${res.status}`);
  }

  return res.json();
}

export const api = fetchApi;
