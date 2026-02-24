/**
 * Tenant Security Service
 *
 * Queries security_alerts, audit_logs, and profiles for the security dashboard.
 * Provides acknowledge/resolve actions for security alerts.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';
import type {
  SecurityAlertRow,
  ActiveSessionRow,
  SecurityRule,
  TenantSuspensionStatus,
} from '../components/admin/tenant-security/types';

// ============================================================================
// Alert DB row shape
// ============================================================================

interface AlertDbRow {
  id: string;
  severity: string;
  category: string | null;
  alert_type: string | null;
  title: string;
  message: string | null;
  status: string;
  source_ip: string | null;
  affected_user_id: string | null;
  affected_resource: string | null;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

interface SessionDbRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  last_sign_in_at: string | null;
}

// ============================================================================
// Service
// ============================================================================

export const tenantSecurityService = {
  /**
   * Get security alerts for the current tenant
   */
  async getSecurityAlerts(
    tenantId: string,
    statusFilter: 'active' | 'resolved' | 'all' = 'active'
  ): Promise<ServiceResult<SecurityAlertRow[]>> {
    try {
      let query = supabase
        .from('security_alerts')
        .select('id, severity, category, alert_type, title, message, status, source_ip, affected_user_id, affected_resource, created_at, acknowledged_at, resolved_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (statusFilter === 'active') {
        query = query.in('status', ['pending', 'new', 'acknowledged', 'investigating', 'escalated']);
      } else if (statusFilter === 'resolved') {
        query = query.in('status', ['resolved', 'ignored', 'false_positive']);
      }

      const { data, error } = await query;

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          return success([]);
        }
        return failure('DATABASE_ERROR', 'Failed to load security alerts');
      }

      const rows = (data || []) as AlertDbRow[];
      return success(rows.map(row => ({
        ...row,
        severity: row.severity as SecurityAlertRow['severity'],
        status: row.status as SecurityAlertRow['status'],
      })));
    } catch (err: unknown) {
      await auditLogger.error('SECURITY_ALERTS_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err))
      ).catch(() => {});
      return failure('UNKNOWN_ERROR', 'Failed to load security alerts');
    }
  },

  /**
   * Acknowledge a security alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<ServiceResult<boolean>> {
    try {
      const { error } = await supabase
        .from('security_alerts')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) {
        return failure('DATABASE_ERROR', 'Failed to acknowledge alert');
      }

      await auditLogger.info('SECURITY_ALERT_ACKNOWLEDGED', { alertId, userId }).catch(() => {});
      return success(true);
    } catch (err: unknown) {
      await auditLogger.error('SECURITY_ALERT_ACK_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { alertId }
      ).catch(() => {});
      return failure('UNKNOWN_ERROR', 'Failed to acknowledge alert');
    }
  },

  /**
   * Resolve a security alert
   */
  async resolveAlert(alertId: string, userId: string): Promise<ServiceResult<boolean>> {
    try {
      const { error } = await supabase
        .from('security_alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) {
        return failure('DATABASE_ERROR', 'Failed to resolve alert');
      }

      await auditLogger.info('SECURITY_ALERT_RESOLVED', { alertId, userId }).catch(() => {});
      return success(true);
    } catch (err: unknown) {
      await auditLogger.error('SECURITY_ALERT_RESOLVE_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { alertId }
      ).catch(() => {});
      return failure('UNKNOWN_ERROR', 'Failed to resolve alert');
    }
  },

  /**
   * Get active sessions for users in the tenant
   */
  async getActiveSessions(tenantId: string): Promise<ServiceResult<ActiveSessionRow[]>> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, last_sign_in_at')
        .eq('tenant_id', tenantId)
        .order('last_sign_in_at', { ascending: false, nullsFirst: false })
        .limit(100);

      if (error) {
        return failure('DATABASE_ERROR', 'Failed to load active sessions');
      }

      const rows = (data || []) as SessionDbRow[];
      const now = Date.now();
      const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 min default

      return success(rows.map(row => {
        const lastSignIn = row.last_sign_in_at ? new Date(row.last_sign_in_at).getTime() : 0;
        const isActive = lastSignIn > 0 && (now - lastSignIn) < SESSION_TIMEOUT_MS;

        return {
          user_id: row.user_id,
          first_name: row.first_name || 'Unknown',
          last_name: row.last_name || '',
          email: row.email,
          role_slug: null,
          last_sign_in_at: row.last_sign_in_at,
          is_active: isActive,
        };
      }));
    } catch (err: unknown) {
      await auditLogger.error('ACTIVE_SESSIONS_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err))
      ).catch(() => {});
      return failure('UNKNOWN_ERROR', 'Failed to load active sessions');
    }
  },

  /**
   * Force logout a user by signing them out server-side via edge function
   */
  async forceLogout(userId: string, adminUserId: string): Promise<ServiceResult<boolean>> {
    try {
      const { data, error } = await supabase.functions.invoke('admin_end_session', {
        body: { target_user_id: userId },
      });

      if (error) {
        return failure('OPERATION_FAILED', error.message || 'Failed to force logout user');
      }

      if (!data?.success) {
        return failure('OPERATION_FAILED', data?.error || 'Force logout failed');
      }

      await auditLogger.info('USER_FORCE_LOGOUT', {
        targetUserId: userId,
        performedBy: adminUserId,
      }).catch(() => {});

      return success(true);
    } catch (err: unknown) {
      await auditLogger.error('USER_FORCE_LOGOUT_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { userId }
      ).catch(() => {});
      return failure('UNKNOWN_ERROR', 'Failed to force logout user');
    }
  },

  /**
   * Get security rules from admin_settings
   */
  async getSecurityRules(adminUserId: string): Promise<ServiceResult<SecurityRule[]>> {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('security_rules')
        .eq('user_id', adminUserId)
        .single();

      if (error) {
        // No settings yet — return defaults
        if (error.code === 'PGRST116') {
          return success(DEFAULT_SECURITY_RULES);
        }
        return failure('DATABASE_ERROR', 'Failed to load security rules');
      }

      const rules = data?.security_rules;
      if (!rules || !Array.isArray(rules)) {
        return success(DEFAULT_SECURITY_RULES);
      }

      return success(rules as SecurityRule[]);
    } catch (err: unknown) {
      await auditLogger.error('SECURITY_RULES_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err))
      ).catch(() => {});
      return failure('UNKNOWN_ERROR', 'Failed to load security rules');
    }
  },

  /**
   * Save security rules to admin_settings
   */
  async saveSecurityRules(adminUserId: string, rules: SecurityRule[]): Promise<ServiceResult<boolean>> {
    try {
      const { error } = await supabase
        .from('admin_settings')
        .upsert({
          user_id: adminUserId,
          security_rules: rules,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) {
        return failure('DATABASE_ERROR', 'Failed to save security rules');
      }

      await auditLogger.info('SECURITY_RULES_UPDATED', {
        adminUserId,
        ruleCount: rules.length,
      }).catch(() => {});

      return success(true);
    } catch (err: unknown) {
      await auditLogger.error('SECURITY_RULES_SAVE_FAILED',
        err instanceof Error ? err : new Error(String(err))
      ).catch(() => {});
      return failure('UNKNOWN_ERROR', 'Failed to save security rules');
    }
  },

  /**
   * Get tenant suspension status from tenant_system_status
   */
  async getTenantSuspensionStatus(tenantId: string): Promise<ServiceResult<TenantSuspensionStatus>> {
    try {
      const { data, error } = await supabase
        .from('tenant_system_status')
        .select('is_suspended, is_active, suspension_reason, suspended_at, suspended_by')
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        // No row = not suspended (table may not have an entry for this tenant)
        if (error.code === 'PGRST116') {
          return success({
            is_suspended: false,
            is_active: true,
            suspension_reason: null,
            suspended_at: null,
            suspended_by: null,
            suspended_by_name: null,
          });
        }
        return failure('DATABASE_ERROR', 'Failed to check suspension status');
      }

      interface SuspensionDbRow {
        is_suspended: boolean;
        is_active: boolean;
        suspension_reason: string | null;
        suspended_at: string | null;
        suspended_by: string | null;
      }

      const row = data as SuspensionDbRow;

      // Resolve suspended_by to a name if suspended
      let suspendedByName: string | null = null;
      if (row.is_suspended && row.suspended_by) {
        const { data: adminData } = await supabase
          .from('super_admin_users')
          .select('full_name')
          .eq('id', row.suspended_by)
          .single();
        if (adminData) {
          suspendedByName = (adminData as { full_name: string | null }).full_name;
        }
      }

      return success({
        is_suspended: row.is_suspended,
        is_active: row.is_active,
        suspension_reason: row.suspension_reason,
        suspended_at: row.suspended_at,
        suspended_by: row.suspended_by,
        suspended_by_name: suspendedByName,
      });
    } catch (err: unknown) {
      await auditLogger.error('SUSPENSION_STATUS_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { tenantId }
      ).catch(() => {});
      return failure('UNKNOWN_ERROR', 'Failed to check suspension status');
    }
  },
};

// ============================================================================
// Default rules
// ============================================================================

const DEFAULT_SECURITY_RULES: SecurityRule[] = [
  {
    id: 'rule-phi-burst',
    name: 'PHI Access Burst',
    description: 'Alert when PHI is accessed more than 10 times in 15 minutes',
    metric: 'phi_access',
    operator: '>',
    threshold: 10,
    time_window_minutes: 15,
    severity: 'high',
    notify_roles: ['admin', 'super_admin'],
    is_active: true,
  },
  {
    id: 'rule-critical-alerts',
    name: 'Critical Alert Threshold',
    description: 'Alert when 3 or more critical security alerts are unresolved',
    metric: 'critical_alerts',
    operator: '>=',
    threshold: 3,
    time_window_minutes: 60,
    severity: 'critical',
    notify_roles: ['super_admin', 'it_admin'],
    is_active: true,
  },
];
