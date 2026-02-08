/**
 * MFA Enrollment Service Types
 *
 * Type definitions for the MFA enrollment system.
 * Used by mfaEnrollmentService.ts and useMfaEnrollment.ts hook.
 */

export interface MfaEnrollmentStatus {
  mfa_required: boolean;
  mfa_enabled: boolean;
  enrollment_exists: boolean;
  enforcement_status: 'pending' | 'grace_period' | 'enforced' | 'exempt';
  grace_period_ends: string | null;
  days_remaining: number | null;
  role: string;
  mfa_method: 'totp' | 'sms' | 'email' | null;
  last_verified?: string | null;
  exemption_reason?: string | null;
}

export interface MfaComplianceRow {
  role: string;
  total_users: number;
  mfa_enabled_count: number;
  non_compliant_count: number;
  exempt_count: number;
  compliance_pct: number;
}

export interface MfaEnrollmentRow {
  id: string;
  user_id: string;
  role: string;
  mfa_enabled: boolean;
  mfa_method: string | null;
  enforcement_status: string;
  grace_period_ends: string | null;
  exemption_reason: string | null;
  last_verified: string | null;
  created_at: string;
  updated_at: string;
}
