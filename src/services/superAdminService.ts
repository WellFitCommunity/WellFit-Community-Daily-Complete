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
  SystemFeatureFlag,
  TenantSystemStatus,
  SystemHealthCheck,
  SuperAdminAuditLog,
  SystemMetric,
  SystemOverview,
  TenantWithStatus,
  EmergencyDisableFeaturePayload,
  SuspendTenantPayload,
  ActivateTenantPayload,
  UpdateTenantCodePayload,
  UpdateFeatureFlagPayload,
  CreateSuperAdminPayload
} from '../types/superAdmin';

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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
      let result: any = data;
      if (typeof data === 'string') {
        try {
          result = JSON.parse(data);
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
    } catch (error) {
      auditLogger.error('SUPER_ADMIN_OVERVIEW_FAILED', error instanceof Error ? error : new Error('Unknown error'), { category: 'ADMINISTRATIVE' });
      throw new Error(`Failed to load system overview: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      let tenantsArray: any[] = [];
      if (typeof data === 'string') {
        try {
          tenantsArray = JSON.parse(data);
        } catch {
          auditLogger.error('SUPER_ADMIN_JSON_PARSE_ERROR', new Error('Failed to parse JSON'), { rpc: 'get_all_tenants_with_status' });
          return [];
        }
      } else if (Array.isArray(data)) {
        tenantsArray = data;
      } else if (data && typeof data === 'object') {
        // Might be a single object or wrapped response
        tenantsArray = Array.isArray(data) ? data : [data];
      }

      // Validate we have an array
      if (!Array.isArray(tenantsArray)) {
        auditLogger.warn('SUPER_ADMIN_INVALID_RESPONSE', { rpc: 'get_all_tenants_with_status', responseType: typeof tenantsArray });
        return [];
      }

      return tenantsArray.map((row: any) => ({
        tenantId: row.tenant_id || row.id,
        tenantName: row.tenant_name || row.name,
        subdomain: row.subdomain,
        tenantCode: row.tenant_code,
        licensedProducts: row.licensed_products || ['wellfit', 'atlus'],
        isActive: row.is_active ?? true,
        isSuspended: row.is_suspended ?? false,
        status: row.is_suspended ? 'suspended' : 'active',
        suspensionReason: row.suspension_reason,
        userCount: parseInt(row.user_count) || 0,
        patientCount: parseInt(row.patient_count) || 0,
        maxUsers: row.max_users,
        maxPatients: row.max_patients,
        lastActivity: row.last_activity,
        lastActivityAt: row.last_activity,
        licenseTier: row.license_tier,
        licenseEndDate: row.license_end_date,
        createdAt: row.created_at
      }));
    } catch (error) {
      auditLogger.error('SUPER_ADMIN_TENANTS_FAILED', error instanceof Error ? error : new Error('Unknown error'), { category: 'ADMINISTRATIVE' });
      throw new Error(`Failed to load tenants: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      if (error instanceof Error) {
        throw error;
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
    } catch (error) {
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

      const updates: any = {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      return [];
    }
  },

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  transformSuperAdminUser(data: any): SuperAdminUser {
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

  transformFeatureFlag(data: any): SystemFeatureFlag {
    return {
      id: data.id,
      featureKey: data.feature_key,
      featureName: data.feature_name,
      description: data.description,
      isEnabled: data.is_enabled,
      forceDisabled: data.force_disabled,
      enabledForNewTenants: data.enabled_for_new_tenants,
      requiresLicense: data.requires_license,
      category: data.category,
      metadata: data.metadata,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      updatedBy: data.updated_by
    };
  },

  transformHealthCheck(data: any): SystemHealthCheck {
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

  transformAuditLog(data: any): SuperAdminAuditLog {
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

  transformMetric(data: any): SystemMetric {
    return {
      id: data.id,
      metricType: data.metric_type,
      metricValue: parseFloat(data.metric_value) || 0,
      metadata: data.metadata,
      recordedAt: data.recorded_at
    };
  }
};

export default SuperAdminService;
