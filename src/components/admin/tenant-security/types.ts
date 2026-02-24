/**
 * Types for TenantSecurityDashboard sub-components
 */

/** Security alert from the security_alerts table */
export interface SecurityAlertRow {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string | null;
  alert_type: string | null;
  title: string;
  message: string | null;
  status: 'pending' | 'new' | 'acknowledged' | 'investigating' | 'resolved' | 'ignored' | 'false_positive' | 'escalated';
  source_ip: string | null;
  affected_user_id: string | null;
  affected_resource: string | null;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

/** Active user session derived from profiles + auth metadata */
export interface ActiveSessionRow {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  role_slug: string | null;
  last_sign_in_at: string | null;
  is_active: boolean;
}

/** Security rule configuration (stored in admin_settings.security_rules JSONB) */
export interface SecurityRule {
  id: string;
  name: string;
  description: string;
  metric: 'phi_access' | 'failed_logins' | 'critical_alerts' | 'active_sessions';
  operator: '>=' | '>' | '<=' | '<' | '=';
  threshold: number;
  time_window_minutes: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  notify_roles: string[];
  is_active: boolean;
}

/** Metric used in the dashboard header */
export interface SecurityMetric {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

export interface SecurityAlertsPanelProps {
  tenantId: string;
  alerts: SecurityAlertRow[];
  loading: boolean;
  onAcknowledge: (alertId: string) => void;
  onResolve: (alertId: string) => void;
  onRefresh: () => void;
}

export interface ActiveSessionsPanelProps {
  sessions: ActiveSessionRow[];
  loading: boolean;
  onForceLogout: (userId: string) => void;
  onRefresh: () => void;
}

export interface SecurityRulesConfigProps {
  rules: SecurityRule[];
  saving: boolean;
  onSaveRule: (rule: SecurityRule) => void;
  onDeleteRule: (ruleId: string) => void;
  onToggleRule: (ruleId: string, active: boolean) => void;
}

/** Tenant suspension status from tenant_system_status table */
export interface TenantSuspensionStatus {
  is_suspended: boolean;
  is_active: boolean;
  suspension_reason: string | null;
  suspended_at: string | null;
  suspended_by: string | null;
  suspended_by_name: string | null;
}

export interface TenantSuspensionBannerProps {
  tenantId: string;
}
