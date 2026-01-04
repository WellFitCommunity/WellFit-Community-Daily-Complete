/**
 * Super Admin Service
 *
 * Service layer for Envision VirtualEdge Group LLC master control panel
 * System-wide administration operations
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import type {
  SuperAdminUser,
  SuperAdminRole,
  SuperAdminPermission,
  SystemFeatureFlag,
  FeatureCategory,
  SystemHealthCheck,
  HealthCheckType,
  HealthStatus,
  SuperAdminAuditLog,
  AuditTargetType,
  AuditSeverity,
  AuditLogValue,
  SystemMetric,
  MetricType,
  SystemOverview,
  TenantWithStatus,
  LicensedProduct,
  JsonValue,
  EmergencyDisableFeaturePayload,
  SuspendTenantPayload,
  ActivateTenantPayload,
  UpdateTenantCodePayload,
  UpdateFeatureFlagPayload,
  CreateSuperAdminPayload
} from '../types/superAdmin';

// Database row interfaces for type-safe transforms
// These are at the database boundary where casts are appropriate per CLAUDE.md
interface SuperAdminUserRow {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: SuperAdminRole;
  permissions: SuperAdminPermission[];
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
}

interface FeatureFlagRow {
  id: string;
  feature_key: string;
  feature_name: string;
  description?: string;
  is_enabled: boolean;
  force_disabled: boolean;
  enabled_for_new_tenants: boolean;
  requires_license?: boolean;
  category?: FeatureCategory;
  metadata?: Record<string, JsonValue>;
  created_at: string;
  updated_at?: string;
  updated_by?: string;
}

interface HealthCheckRow {
  id: string;
  check_type: HealthCheckType;
  check_name: string;
  component_name?: string;
  status: HealthStatus;
  response_time_ms?: number;
  error_message?: string;
  message?: string;
  metrics?: Record<string, JsonValue>;
  metadata?: Record<string, JsonValue>;
  checked_at: string;
}

interface AuditLogRow {
  id: string;
  super_admin_id: string;
  super_admin_email: string;
  action: string;
  target_type?: AuditTargetType;
  target_id?: string;
  target_name?: string;
  old_value?: AuditLogValue;
  new_value?: AuditLogValue;
  reason?: string;
  ip_address?: string;
  user_agent?: string;
  severity: AuditSeverity;
  created_at: string;
}

interface MetricRow {
  id: string;
  metric_type: MetricType;
  metric_value: string | number;
  metadata?: Record<string, JsonValue>;
  recorded_at: string;
}

interface TenantRow {
  tenant_id?: string;
  id?: string;
  tenant_name?: string;
  name?: string;
  subdomain?: string;
  tenant_code?: string;
  licensed_products?: LicensedProduct[];
  is_active?: boolean;
  is_suspended?: boolean;
  suspension_reason?: string;
  user_count?: string | number;
  patient_count?: string | number;
  max_users?: number;
  max_patients?: number;
  last_activity?: string;
  license_tier?: string;
  license_end_date?: string;
  created_at?: string;
}

interface SystemOverviewResult {
  total_tenants?: number;
  active_tenants?: number;
  suspended_tenants?: number;
  total_users?: number;
  total_patients?: number;
  features_force_disabled?: number;
  critical_health_issues?: number;
  critical_audit_events_24h?: number;
}

interface FeatureFlagUpdateFields {
  updated_at: string;
  updated_by: string;
  is_enabled?: boolean;
  force_disabled?: boolean;
  enabled_for_new_tenants?: boolean;
  [key: string]: string | boolean | undefined; // Index signature for AuditLogValue compatibility
}

export const SuperAdminService = {
  // ============================================================================
  // AUTHENTICATION & AUTHORIZATION
  // ============================================================================

  /**
   * Check if current user is a super admin
   */
  async isSuperAdmin(): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('is_super_admin');

      if (error) throw error;

      return data === true;
    } catch {
      return false;
    }
  },

  /**
   * Get current super admin user info
   */
  async getCurrentSuperAdmin(): Promise<SuperAdminUser | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('super_admin_users')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No record found
        throw error;
      }

      return this.transformSuperAdminUser(data);
    } catch {
      return null;
    }
  },

  /**
   * Create new super admin user
   */
  async createSuperAdmin(payload: CreateSuperAdminPayload): Promise<SuperAdminUser> {
    try {
      const currentAdmin = await this.getCurrentSuperAdmin();
      if (!currentAdmin) throw new Error('Unauthorized');

      const { data, error } = await supabase
        .from('super_admin_users')
        .insert({
          user_id: payload.userId,
          email: payload.email,
          full_name: payload.fullName,
          role: payload.role,
          permissions: payload.permissions,
          is_active: true,
          created_by: currentAdmin.id
        })
        .select()
        .single();

      if (error) throw error;

      // Log audit event
      await this.logAuditEvent({
        superAdminId: currentAdmin.id,
        superAdminEmail: currentAdmin.email,
        action: 'user.grant_super_admin',
        targetType: 'user',
        targetId: payload.userId,
        targetName: payload.email,
        newValue: { role: payload.role, permissions: payload.permissions },
        severity: 'critical'
      });

      return this.transformSuperAdminUser(data);
    } catch {
      throw new Error('Failed to create super admin user');
    }
  },

  // ============================================================================
  // SYSTEM OVERVIEW
  // ============================================================================

  /**
   * Get system overview statistics
   */
  async getSystemOverview(): Promise<SystemOverview> {
    try {
      const { data, error } = await supabase.rpc('get_system_overview');

      if (error) {
        auditLogger.error('SUPER_ADMIN_RPC_ERROR', new Error(error.message), { rpc: 'get_system_overview', error });
        throw error;
      }

      // RPC returns JSON - handle both string and object responses
      let result: SystemOverviewResult | null = data as SystemOverviewResult | null;
      if (typeof data === 'string') {
        try {
          result = JSON.parse(data) as SystemOverviewResult;
        } catch {
          auditLogger.error('SUPER_ADMIN_JSON_PARSE_ERROR', new Error('Failed to parse JSON'), { rpc: 'get_system_overview' });
          throw new Error('Invalid JSON response from get_system_overview');
        }
      }

      // Validate we got data
      if (!result || typeof result !== 'object') {
        auditLogger.warn('SUPER_ADMIN_INVALID_RESPONSE', { rpc: 'get_system_overview', responseType: typeof result });
        // Return defaults instead of failing completely
        return {
          totalTenants: 0,
          activeTenants: 0,
          suspendedTenants: 0,
          totalUsers: 0,
          totalPatients: 0,
          featuresForceDisabled: 0,
          criticalHealthIssues: 0,
          criticalAuditEvents24h: 0
        };
      }

      return {
        totalTenants: result.total_tenants || 0,
        activeTenants: result.active_tenants || 0,
        suspendedTenants: result.suspended_tenants || 0,
        totalUsers: result.total_users || 0,
        totalPatients: result.total_patients || 0,
        featuresForceDisabled: result.features_force_disabled || 0,
        criticalHealthIssues: result.critical_health_issues || 0,
        criticalAuditEvents24h: result.critical_audit_events_24h || 0
      };
    } catch (err: unknown) {
      auditLogger.error('SUPER_ADMIN_OVERVIEW_FAILED', err instanceof Error ? err : new Error('Unknown error'), { category: 'ADMINISTRATIVE' });
      throw new Error(`Failed to load system overview: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  },

  // ============================================================================
  // TENANT MANAGEMENT
  // ============================================================================

  /**
   * Get all tenants with status info
   */
  async getAllTenants(): Promise<TenantWithStatus[]> {
    try {
      const { data, error } = await supabase.rpc('get_all_tenants_with_status');

      if (error) {
        auditLogger.error('SUPER_ADMIN_RPC_ERROR', new Error(error.message), { rpc: 'get_all_tenants_with_status', error });
        throw error;
      }

      // RPC returns JSON - handle both string and array responses
      let tenantsArray: TenantRow[] = [];
      if (typeof data === 'string') {
        try {
          tenantsArray = JSON.parse(data) as TenantRow[];
        } catch {
          auditLogger.error('SUPER_ADMIN_JSON_PARSE_ERROR', new Error('Failed to parse JSON'), { rpc: 'get_all_tenants_with_status' });
          return [];
        }
      } else if (Array.isArray(data)) {
        tenantsArray = data as TenantRow[];
      } else if (data && typeof data === 'object') {
        // Might be a single object or wrapped response
        tenantsArray = Array.isArray(data) ? data as TenantRow[] : [data as TenantRow];
      }

      // Validate we have an array
      if (!Array.isArray(tenantsArray)) {
        auditLogger.warn('SUPER_ADMIN_INVALID_RESPONSE', { rpc: 'get_all_tenants_with_status', responseType: typeof tenantsArray });
        return [];
      }

      return tenantsArray
        .filter((row: TenantRow) => row.tenant_id || row.id) // Filter out rows without valid IDs
        .map((row: TenantRow): TenantWithStatus => ({
          tenantId: row.tenant_id || row.id || '',
          tenantName: row.tenant_name || row.name || 'Unknown Tenant',
          subdomain: row.subdomain || '',
          tenantCode: row.tenant_code,
          licensedProducts: row.licensed_products || ['wellfit', 'atlus'] as LicensedProduct[],
          isActive: row.is_active ?? true,
          isSuspended: row.is_suspended ?? false,
          status: row.is_suspended ? 'suspended' : 'active',
          suspensionReason: row.suspension_reason,
          userCount: typeof row.user_count === 'string' ? parseInt(row.user_count, 10) || 0 : (row.user_count || 0),
          patientCount: typeof row.patient_count === 'string' ? parseInt(row.patient_count, 10) || 0 : (row.patient_count || 0),
          maxUsers: row.max_users,
          maxPatients: row.max_patients,
          lastActivity: row.last_activity,
          lastActivityAt: row.last_activity,
          licenseTier: row.license_tier,
          licenseEndDate: row.license_end_date,
          createdAt: row.created_at || new Date().toISOString()
        }));
    } catch (err: unknown) {
      auditLogger.error('SUPER_ADMIN_TENANTS_FAILED', err instanceof Error ? err : new Error('Unknown error'), { category: 'ADMINISTRATIVE' });
      throw new Error(`Failed to load tenants: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  },

  /**
   * Suspend a tenant
   */
  async suspendTenant(payload: SuspendTenantPayload): Promise<void> {
    try {
      const { error } = await supabase.rpc('suspend_tenant', {
        p_tenant_id: payload.tenantId,
        p_reason: payload.reason,
        p_super_admin_id: payload.superAdminId
      });

      if (error) throw error;
    } catch {
      throw new Error('Failed to suspend tenant');
    }
  },

  /**
   * Activate a tenant
   */
  async activateTenant(payload: ActivateTenantPayload): Promise<void> {
    try {
      const currentAdmin = await this.getCurrentSuperAdmin();
      if (!currentAdmin) throw new Error('Unauthorized');

      // Reactivate tenant
      const { error } = await supabase
        .from('tenant_system_status')
        .update({
          is_active: true,
          is_suspended: false,
          suspension_reason: null,
          updated_at: new Date().toISOString(),
          updated_by: currentAdmin.id
        })
        .eq('tenant_id', payload.tenantId);

      if (error) throw error;

      // Log audit event
      await this.logAuditEvent({
        superAdminId: currentAdmin.id,
        superAdminEmail: currentAdmin.email,
        action: 'tenant.activate',
        targetType: 'tenant',
        targetId: payload.tenantId,
        newValue: { is_active: true, is_suspended: false },
        severity: 'warning'
      });
    } catch {
      throw new Error('Failed to activate tenant');
    }
  },

  /**
   * Update tenant code (identifier like "MH-6702")
   */
  async updateTenantCode(payload: UpdateTenantCodePayload): Promise<void> {
    try {
      const currentAdmin = await this.getCurrentSuperAdmin();
      if (!currentAdmin) throw new Error('Unauthorized');

      // Auto-uppercase the tenant code
      const tenantCode = payload.tenantCode.toUpperCase();

      // Validate format: PREFIX-NUMBER
      const codePattern = /^[A-Z]{1,4}-[0-9]{4,6}$/;
      if (!codePattern.test(tenantCode)) {
        throw new Error('Invalid tenant code format. Use PREFIX-NUMBER (e.g., "MH-6702")');
      }

      // Update tenant code
      const { error } = await supabase
        .from('tenants')
        .update({
          tenant_code: tenantCode
        })
        .eq('id', payload.tenantId);

      if (error) {
        // Check for unique constraint violation
        if (error.code === '23505') {
          throw new Error('This tenant code is already in use');
        }
        throw error;
      }

      // Log audit event
      await this.logAuditEvent({
        superAdminId: currentAdmin.id,
        superAdminEmail: currentAdmin.email,
        action: 'tenant.update',
        targetType: 'tenant',
        targetId: payload.tenantId,
        newValue: { tenant_code: payload.tenantCode },
        severity: 'info'
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        throw err;
      }
      throw new Error('Failed to update tenant code');
    }
  },

  // ============================================================================
  // FEATURE FLAG MANAGEMENT
  // ============================================================================

  /**
   * Get all system feature flags
   */
  async getAllFeatureFlags(): Promise<SystemFeatureFlag[]> {
    try {
      const { data, error } = await supabase
        .from('system_feature_flags')
        .select('*')
        .order('category', { ascending: true })
        .order('feature_name', { ascending: true });

      if (error) throw error;

      return (data || []).map(this.transformFeatureFlag);
    } catch {
      throw new Error('Failed to load feature flags');
    }
  },

  /**
   * Update feature flag
   */
  async updateFeatureFlag(payload: UpdateFeatureFlagPayload): Promise<void> {
    try {
      const currentAdmin = await this.getCurrentSuperAdmin();
      if (!currentAdmin) throw new Error('Unauthorized');

      const updates: FeatureFlagUpdateFields = {
        updated_at: new Date().toISOString(),
        updated_by: payload.superAdminId
      };

      if (payload.isEnabled !== undefined) updates.is_enabled = payload.isEnabled;
      if (payload.forceDisabled !== undefined) updates.force_disabled = payload.forceDisabled;
      if (payload.enabledForNewTenants !== undefined) updates.enabled_for_new_tenants = payload.enabledForNewTenants;

      const { error } = await supabase
        .from('system_feature_flags')
        .update(updates)
        .eq('feature_key', payload.featureKey);

      if (error) throw error;

      // Log audit event
      await this.logAuditEvent({
        superAdminId: currentAdmin.id,
        superAdminEmail: currentAdmin.email,
        action: payload.forceDisabled ? 'feature.disable' : 'feature.enable',
        targetType: 'feature',
        targetId: payload.featureKey,
        newValue: updates,
        severity: payload.forceDisabled ? 'critical' : 'info'
      });
    } catch {
      throw new Error('Failed to update feature flag');
    }
  },

  /**
   * Emergency disable feature (kill switch)
   */
  async emergencyDisableFeature(payload: EmergencyDisableFeaturePayload): Promise<void> {
    try {
      const { error } = await supabase.rpc('emergency_disable_feature', {
        p_feature_key: payload.featureKey,
        p_reason: payload.reason,
        p_super_admin_id: payload.superAdminId
      });

      if (error) throw error;
    } catch {
      throw new Error('Failed to emergency disable feature');
    }
  },

  // ============================================================================
  // SYSTEM HEALTH
  // ============================================================================

  /**
   * Get recent health checks
   */
  async getRecentHealthChecks(minutes: number = 5): Promise<SystemHealthCheck[]> {
    try {
      const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('system_health_checks')
        .select('*')
        .gte('checked_at', cutoff)
        .order('checked_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(this.transformHealthCheck);
    } catch {
      return [];
    }
  },

  /**
   * Record health check
   */
  async recordHealthCheck(check: Omit<SystemHealthCheck, 'id' | 'checkedAt'>): Promise<void> {
    try {
      const { error } = await supabase
        .from('system_health_checks')
        .insert({
          check_type: check.checkType,
          check_name: check.checkName,
          status: check.status,
          response_time_ms: check.responseTimeMs,
          error_message: check.errorMessage,
          metadata: check.metadata
        });

      if (error) throw error;
    } catch {
      // Fail silently on client
    }
  },

  // ============================================================================
  // AUDIT LOGS
  // ============================================================================

  /**
   * Get recent audit logs
   */
  async getRecentAuditLogs(limit: number = 100): Promise<SuperAdminAuditLog[]> {
    try {
      const { data, error } = await supabase
        .from('super_admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(this.transformAuditLog);
    } catch {
      return [];
    }
  },

  /**
   * Get critical audit events (last 24h)
   */
  async getCriticalAuditEvents(): Promise<SuperAdminAuditLog[]> {
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('super_admin_audit_log')
        .select('*')
        .eq('severity', 'critical')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(this.transformAuditLog);
    } catch {
      return [];
    }
  },

  /**
   * Log audit event
   */
  async logAuditEvent(log: Omit<SuperAdminAuditLog, 'id' | 'createdAt'>): Promise<void> {
    try {
      const { error } = await supabase
        .from('super_admin_audit_log')
        .insert({
          super_admin_id: log.superAdminId,
          super_admin_email: log.superAdminEmail,
          action: log.action,
          target_type: log.targetType,
          target_id: log.targetId,
          target_name: log.targetName,
          old_value: log.oldValue,
          new_value: log.newValue,
          reason: log.reason,
          ip_address: log.ipAddress,
          user_agent: log.userAgent,
          severity: log.severity
        });

      if (error) throw error;
    } catch {
      // Fail silently on client
    }
  },

  // ============================================================================
  // SYSTEM METRICS
  // ============================================================================

  /**
   * Get system metrics
   */
  async getSystemMetrics(metricType?: string, hours: number = 24): Promise<SystemMetric[]> {
    try {
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      let query = supabase
        .from('system_metrics')
        .select('*')
        .gte('recorded_at', cutoff)
        .order('recorded_at', { ascending: false });

      if (metricType) {
        query = query.eq('metric_type', metricType);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map(this.transformMetric);
    } catch {
      return [];
    }
  },

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  transformSuperAdminUser(data: SuperAdminUserRow): SuperAdminUser {
    return {
      id: data.id,
      userId: data.user_id,
      email: data.email,
      fullName: data.full_name,
      role: data.role,
      permissions: data.permissions || [],
      isActive: data.is_active,
      lastLoginAt: data.last_login_at,
      createdAt: data.created_at,
      createdBy: data.created_by,
      updatedAt: data.updated_at,
      updatedBy: data.updated_by
    };
  },

  transformFeatureFlag(data: FeatureFlagRow): SystemFeatureFlag {
    return {
      id: data.id,
      featureKey: data.feature_key,
      featureName: data.feature_name,
      description: data.description,
      isEnabled: data.is_enabled,
      forceDisabled: data.force_disabled,
      enabledForNewTenants: data.enabled_for_new_tenants,
      requiresLicense: data.requires_license ?? false,
      category: data.category,
      metadata: data.metadata,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      updatedBy: data.updated_by
    };
  },

  transformHealthCheck(data: HealthCheckRow): SystemHealthCheck {
    return {
      id: data.id,
      checkType: data.check_type,
      checkName: data.check_name,
      componentName: data.component_name || data.check_name,
      status: data.status,
      responseTimeMs: data.response_time_ms,
      errorMessage: data.error_message,
      message: data.message,
      metrics: data.metrics,
      metadata: data.metadata,
      checkedAt: data.checked_at
    };
  },

  transformAuditLog(data: AuditLogRow): SuperAdminAuditLog {
    return {
      id: data.id,
      superAdminId: data.super_admin_id,
      superAdminEmail: data.super_admin_email,
      action: data.action,
      targetType: data.target_type,
      targetId: data.target_id,
      targetName: data.target_name,
      oldValue: data.old_value,
      newValue: data.new_value,
      reason: data.reason,
      ipAddress: data.ip_address,
      userAgent: data.user_agent,
      severity: data.severity,
      createdAt: data.created_at
    };
  },

  transformMetric(data: MetricRow): SystemMetric {
    return {
      id: data.id,
      metricType: data.metric_type,
      metricValue: typeof data.metric_value === 'string' ? parseFloat(data.metric_value) || 0 : data.metric_value || 0,
      metadata: data.metadata,
      recordedAt: data.recorded_at
    };
  }
};

export default SuperAdminService;
