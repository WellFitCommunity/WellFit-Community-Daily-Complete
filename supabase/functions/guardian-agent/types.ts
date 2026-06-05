// Shared type definitions for guardian-agent (extracted from index.ts to keep
// each module under the 600-line limit — CLAUDE.md #12).

export interface GuardianEyesSnapshot {
  timestamp: string;
  type: 'error' | 'security' | 'performance' | 'audit';
  component: string;
  action: string;
  metadata: Record<string, unknown>;
  severity: 'critical' | 'high' | 'medium' | 'low';
  tenant_id?: string;
}

export interface SecurityAlert {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  // Must be a value in the security_alerts.alert_type CHECK enum.
  alertType: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  guardian_eyes_recording?: GuardianEyesSnapshot[];
}

export interface FailedLoginRecord {
  id: string;
  ip_address?: string;
  created_at: string;
}

export interface SystemErrorRecord {
  id: string;
  error_type?: string;
  created_at: string;
}

// phi_access_logs row. `records_accessed` is the ACCOUNTABILITY metric — how many
// patient records a single access event touched (added 20260605…; defaults to 1).
// Time column is `timestamp` (the live column; there is no `accessed_at`).
export interface PhiAccessRecord {
  id: string;
  user_id: string | null;
  records_accessed: number;
  timestamp: string;
}

export interface SlowQueryRecord {
  query_id: string;
  duration_ms: number;
}

// GA-1: behavioral anomalies surfaced into Guardian's field of view.
export interface AnomalyRecord {
  id: string;
  risk_level: string;
  event_type?: string;
  aggregate_anomaly_score: number;
}

export interface GuardianRecording {
  id: string;
  type: 'error' | 'security' | 'performance' | 'audit';
  component: string;
  action: string;
  severity: string;
  recorded_at: string;
}

export interface StoredAlert {
  id: string;
  category: string;
  title: string;
  severity: string;
  metadata?: Record<string, unknown>;
}
