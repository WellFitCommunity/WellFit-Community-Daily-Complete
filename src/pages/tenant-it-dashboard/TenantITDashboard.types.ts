/**
 * Type definitions for Tenant IT Dashboard
 */

export type ITTabKey = 'overview' | 'users' | 'sessions' | 'api-keys' | 'audit' | 'health' | 'compliance';

export interface TenantUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: 'active' | 'locked' | 'pending';
  last_login: string;
  created_at: string;
  failed_attempts: number;
  mfa_enabled: boolean;
}

export interface ActiveSession {
  id: string;
  user_id: string;
  user_email: string;
  ip_address: string;
  device_info: string;
  location: string;
  started_at: string;
  last_activity: string;
}

export interface APIKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  created_at: string;
  last_used: string;
  expires_at: string | null;
  status: 'active' | 'revoked' | 'expired';
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user_email: string;
  action: string;
  resource: string;
  ip_address: string;
  status: 'success' | 'failure';
  details: string;
}

export interface SystemHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  latency_ms: number;
  last_check: string;
}

export interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
  badgeColor?: string;
}
