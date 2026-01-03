/**
 * Super Admin Types
 *
 * TypeScript interfaces for Envision VirtualEdge Group LLC
 * master control panel
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

// ============================================================================
// JSON VALUE TYPE (for serializable data)
// ============================================================================

/**
 * Represents any JSON-serializable value for metadata, config, and audit fields.
 * Used instead of `any` for fields that store arbitrary but serializable data.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

// ============================================================================
// SUPER ADMIN USERS
// ============================================================================

export type SuperAdminRole = 'super_admin' | 'system_operator' | 'auditor';

export type SuperAdminPermission =
  | 'tenants.manage'
  | 'tenants.suspend'
  | 'features.toggle'
  | 'features.kill_switch'
  | 'users.manage'
  | 'users.delete'
  | 'audit.view'
  | 'system.health'
  | 'system.metrics'
  | 'system.configuration';

export interface SuperAdminUser {
  id: string;
  userId: string;
  email: string;
  fullName?: string;
  displayName?: string;
  role: SuperAdminRole;
  permissions: SuperAdminPermission[];
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

// ============================================================================
// SYSTEM CONTROLS
// ============================================================================

export type FeatureCategory =
  | 'core'
  | 'healthcare'
  | 'law_enforcement'
  | 'billing'
  | 'analytics'
  | 'integration';

export interface SystemFeatureFlag {
  id: string;
  featureKey: string;
  featureName: string;
  description?: string;
  isEnabled: boolean;
  forceDisabled: boolean; // Emergency kill switch
  enabledForNewTenants: boolean;
  requiresLicense: boolean;
  category?: FeatureCategory;
  metadata?: Record<string, JsonValue>;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface TenantSystemStatus {
  id: string;
  tenantId: string;
  isActive: boolean;
  isSuspended: boolean;
  suspensionReason?: string;
  suspendedAt?: string;
  suspendedBy?: string;
  maxUsers?: number;
  maxPatients?: number;
  storageQuotaGb?: number;
  apiRateLimit?: number;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
}

export type HealthCheckType = 'database' | 'api' | 'storage' | 'cache' | 'integration';
export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unhealthy';

export interface SystemHealthCheck {
  id: string;
  checkType: HealthCheckType;
  checkName: string;
  componentName: string;
  status: HealthStatus;
  responseTimeMs?: number;
  errorMessage?: string;
  message?: string;
  metrics?: Record<string, JsonValue>;
  metadata?: Record<string, JsonValue>;
  checkedAt: string;
}

// ============================================================================
// AUDIT & LOGGING
// ============================================================================

export type AuditActionType =
  | 'tenant.create'
  | 'tenant.update'
  | 'tenant.suspend'
  | 'tenant.activate'
  | 'feature.enable'
  | 'feature.disable'
  | 'feature.emergency_disable'
  | 'user.create'
  | 'user.delete'
  | 'user.grant_super_admin'
  | 'user.revoke_super_admin'
  | 'system.configuration_change'
  | 'system.backup'
  | 'system.restore';

export type AuditTargetType = 'tenant' | 'feature' | 'user' | 'system';
export type AuditSeverity = 'info' | 'warning' | 'critical';

/**
 * Audit value type - accepts any JSON-serializable structure for audit logging.
 * This is intentionally permissive to accommodate complex nested config objects.
 */
export type AuditLogValue = Record<string, unknown>;

export interface SuperAdminAuditLog {
  id: string;
  superAdminId: string;
  superAdminEmail: string;
  action: string;
  description?: string;
  targetType?: AuditTargetType;
  targetId?: string;
  targetName?: string;
  oldValue?: AuditLogValue;
  newValue?: AuditLogValue;
  details?: AuditLogValue;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  severity: AuditSeverity;
  createdAt: string;
}

// ============================================================================
// METRICS & MONITORING
// ============================================================================

export type MetricType =
  | 'tenant_count'
  | 'user_count'
  | 'patient_count'
  | 'api_requests'
  | 'storage_used_gb'
  | 'database_size_gb'
  | 'active_sessions'
  | 'error_rate';

export interface SystemMetric {
  id: string;
  metricType: MetricType;
  metricValue: number;
  metadata?: Record<string, JsonValue>;
  recordedAt: string;
}

export interface SystemOverview {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalUsers: number;
  totalPatients: number;
  featuresForceDisabled: number;
  criticalHealthIssues: number;
  criticalAuditEvents24h: number;
}

// ============================================================================
// TENANT MANAGEMENT
// ============================================================================

export type LicensedProduct = 'wellfit' | 'atlus';
export type ProductFilter = 'all' | 'wellfit' | 'atlus' | 'both';

export interface TenantWithStatus {
  tenantId: string;
  tenantName: string;
  subdomain: string;
  tenantCode?: string; // Unique tenant identifier (e.g., "MH-6702")
  licensedProducts?: LicensedProduct[]; // Products licensed for this tenant
  isActive: boolean;
  isSuspended: boolean;
  status?: 'active' | 'suspended';
  suspensionReason?: string;
  userCount: number;
  patientCount: number;
  maxUsers?: number;
  maxPatients?: number;
  lastActivity?: string;
  lastActivityAt?: string;
  licenseTier?: string;
  licenseEndDate?: string;
  modules?: Record<string, JsonValue>;
  createdAt: string;
  totalSavings?: number; // Total cost savings for this tenant
}

// ============================================================================
// SUPER ADMIN ACTIONS
// ============================================================================

export interface EmergencyDisableFeaturePayload {
  featureKey: string;
  reason: string;
  superAdminId: string;
}

export interface SuspendTenantPayload {
  tenantId: string;
  reason: string;
  superAdminId: string;
}

export interface ActivateTenantPayload {
  tenantId: string;
  superAdminId: string;
}

export interface UpdateTenantCodePayload {
  tenantId: string;
  tenantCode: string; // Format: "PREFIX-NUMBER" (e.g., "MH-6702")
  superAdminId: string;
}

export interface UpdateFeatureFlagPayload {
  featureKey: string;
  isEnabled?: boolean;
  forceDisabled?: boolean;
  enabledForNewTenants?: boolean;
  superAdminId: string;
}

export interface CreateSuperAdminPayload {
  userId: string;
  email: string;
  fullName?: string;
  role: SuperAdminRole;
  permissions: SuperAdminPermission[];
}

// ============================================================================
// DASHBOARD DATA
// ============================================================================

export interface SystemHealthSummary {
  overall: HealthStatus;
  database: HealthStatus;
  api: HealthStatus;
  storage: HealthStatus;
  cache: HealthStatus;
  integrations: HealthStatus;
  lastChecked: string;
}

export interface TenantHealthMetrics {
  tenantId: string;
  tenantName: string;
  userCount: number;
  patientCount: number;
  storageUsedGb: number;
  apiRequestsToday: number;
  errorRatePercent: number;
  lastActivity: string;
}

export interface FeatureFlagSummary {
  totalFeatures: number;
  enabledFeatures: number;
  forceDisabledFeatures: number;
  categoryBreakdown: Record<FeatureCategory, number>;
}

export interface AuditActivitySummary {
  last24Hours: number;
  last7Days: number;
  criticalEvents24h: number;
  topActions: Array<{
    action: AuditActionType;
    count: number;
  }>;
}

// ============================================================================
// KILL SWITCH PRESETS
// ============================================================================

export interface KillSwitchPreset {
  id: string;
  name: string;
  description: string;
  features: string[]; // Feature keys to disable
  severity: AuditSeverity;
  requiresConfirmation: boolean;
}

export const EMERGENCY_KILL_SWITCH_PRESETS: KillSwitchPreset[] = [
  {
    id: 'kill_all_integrations',
    name: 'Kill All Integrations',
    description: 'Disable all EHR integrations (Epic, Cerner, etc.)',
    features: ['healthcare.ehr_integration'],
    severity: 'critical',
    requiresConfirmation: true
  },
  {
    id: 'kill_passive_sdoh',
    name: 'Kill Passive SDOH Detection',
    description: 'Disable passive SDOH detection if causing issues',
    features: ['healthcare.sdoh_passive'],
    severity: 'warning',
    requiresConfirmation: true
  },
  {
    id: 'kill_billing',
    name: 'Kill Billing Features',
    description: 'Disable all billing/claims features',
    features: ['billing.insurance_claims', 'billing.z_codes'],
    severity: 'critical',
    requiresConfirmation: true
  },
  {
    id: 'kill_law_enforcement',
    name: 'Kill Law Enforcement Features',
    description: 'Disable welfare check system',
    features: ['law_enforcement.welfare_checks', 'law_enforcement.emergency_response'],
    severity: 'warning',
    requiresConfirmation: true
  }
];
