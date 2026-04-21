// =====================================================
// MCP Patient Context Server — Type Definitions
// Canonical cross-system read path (Shared Spine S5)
// =====================================================

export interface MCPLogger {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

export interface DataSourceRecord {
  source: string;
  fetched_at: string;
  success: boolean;
  record_count: number;
  note: string | null;
}

export interface PatientDemographics {
  patient_id: string;
  first_name: string | null;
  last_name: string | null;
  dob: string | null;
  gender: string | null;
  phone: string | null;
  preferred_language: string | null;
  enrollment_type: string | null;
  tenant_id: string | null;
  mrn: string | null;
}

export interface PatientContact {
  contact_type: string; // emergency_contact | caregiver | care_team_member
  name: string | null;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean | null;
}

export interface TimelineEvent {
  event_type: string; // check_in | self_report | encounter | assessment
  occurred_at: string;
  summary: string | null;
  metadata: Record<string, unknown>;
}

export interface RiskSummary {
  readmission_risk: {
    score: number | null;
    level: string | null;
    last_updated: string | null;
  };
  fall_risk: {
    score: number | null;
    level: string | null;
    last_updated: string | null;
  };
  overall_severity: 'low' | 'moderate' | 'high' | 'critical' | 'unknown';
}

export interface PatientContextMeta {
  generated_at: string;
  request_id: string;
  data_sources: DataSourceRecord[];
  warnings: string[];
  fetch_duration_ms: number;
}

export interface PatientContext {
  demographics: PatientDemographics | null;
  contacts: PatientContact[] | null;
  timeline: TimelineEvent[] | null;
  risk: RiskSummary | null;
  context_meta: PatientContextMeta;
}
