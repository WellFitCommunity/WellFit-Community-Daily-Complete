/**
 * TenantSecurityDashboard — Tenant-scoped security monitoring with alert management
 *
 * Purpose: Real-time security metrics, alert acknowledge/resolve, session management, rule config
 * Used by: IntelligentAdminPanel (security category section)
 *
 * NOTE: This is DIFFERENT from Platform SOC2 dashboards in Master Panel
 * which show cross-tenant, platform-wide security metrics.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';
import { Shield, AlertTriangle, Users, Eye, Lock } from 'lucide-react';
import { auditLogger } from '../../services/auditLogger';
import { tenantSecurityService } from '../../services/tenantSecurityService';
import {
  SecurityAlertsPanel,
  ActiveSessionsPanel,
  SecurityRulesConfig,
} from './tenant-security';
import type {
  SecurityAlertRow,
  ActiveSessionRow,
  SecurityRule,
  SecurityMetric,
} from './tenant-security';

export const TenantSecurityDashboard: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<SecurityMetric[]>([]);

  // Sub-component state
  const [alerts, setAlerts] = useState<SecurityAlertRow[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [sessions, setSessions] = useState<ActiveSessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [rules, setRules] = useState<SecurityRule[]>([]);
  const [rulesSaving, setRulesSaving] = useState(false);

  // PHI access from audit_logs (kept for metrics)
  const [phiCount, setPhiCount] = useState(0);

  const loadTenantData = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.tenant_id) {
        await auditLogger.warn('NO_TENANT_ID_FOR_USER', { userId: user.id });
        setLoading(false);
        return;
      }

      setTenantId(profile.tenant_id);

      // Load all sections in parallel
      await Promise.all([
        loadAlerts(profile.tenant_id),
        loadSessions(profile.tenant_id),
        loadPHIMetric(profile.tenant_id),
        loadRules(),
      ]);
    } catch (error: unknown) {
      await auditLogger.error('TENANT_SECURITY_LOAD_FAILED',
        error instanceof Error ? error : new Error(String(error)),
        { userId: user?.id }
      );
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase client is stable
  }, [user?.id]);

  useEffect(() => {
    loadTenantData();
  }, [loadTenantData]);

  // Build metrics whenever data changes
  useEffect(() => {
    const activeSessions = sessions.filter(s => s.is_active).length;
    const criticalAlerts = alerts.filter(a => a.severity === 'critical' && ['pending', 'new'].includes(a.status)).length;

    setMetrics([
      {
        label: 'Active Sessions',
        value: activeSessions,
        icon: Users,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
      },
      {
        label: 'PHI Access (recent)',
        value: phiCount,
        icon: Eye,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
      },
      {
        label: 'Open Alerts',
        value: alerts.filter(a => ['pending', 'new', 'acknowledged'].includes(a.status)).length,
        icon: AlertTriangle,
        color: alerts.length > 0 ? 'text-amber-600' : 'text-green-600',
        bgColor: alerts.length > 0 ? 'bg-amber-50' : 'bg-green-50',
      },
      {
        label: 'Critical Alerts',
        value: criticalAlerts,
        icon: Shield,
        color: criticalAlerts > 0 ? 'text-red-600' : 'text-green-600',
        bgColor: criticalAlerts > 0 ? 'bg-red-50' : 'bg-green-50',
      },
    ]);
  }, [sessions, alerts, phiCount]);

  const loadAlerts = async (tid: string) => {
    setAlertsLoading(true);
    const result = await tenantSecurityService.getSecurityAlerts(tid, 'all');
    if (result.success) {
      setAlerts(result.data);
    }
    setAlertsLoading(false);
  };

  const loadSessions = async (tid: string) => {
    setSessionsLoading(true);
    const result = await tenantSecurityService.getActiveSessions(tid);
    if (result.success) {
      setSessions(result.data);
    }
    setSessionsLoading(false);
  };

  const loadPHIMetric = async (tid: string) => {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tid)
      .eq('action_category', 'PHI_ACCESS');

    if (!error) {
      setPhiCount(data?.length || 0);
    }
  };

  const loadRules = async () => {
    if (!user?.id) return;
    const result = await tenantSecurityService.getSecurityRules(user.id);
    if (result.success) {
      setRules(result.data);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    if (!user?.id) return;
    const result = await tenantSecurityService.acknowledgeAlert(alertId, user.id);
    if (result.success) {
      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, status: 'acknowledged' as const, acknowledged_at: new Date().toISOString() } : a
      ));
    }
  };

  const handleResolve = async (alertId: string) => {
    if (!user?.id) return;
    const result = await tenantSecurityService.resolveAlert(alertId, user.id);
    if (result.success) {
      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, status: 'resolved' as const, resolved_at: new Date().toISOString() } : a
      ));
    }
  };

  const handleForceLogout = async (userId: string) => {
    if (!user?.id) return;
    const result = await tenantSecurityService.forceLogout(userId, user.id);
    if (result.success && tenantId) {
      await loadSessions(tenantId);
    }
  };

  const handleSaveRule = async (rule: SecurityRule) => {
    if (!user?.id) return;
    setRulesSaving(true);
    const updatedRules = rules.some(r => r.id === rule.id)
      ? rules.map(r => r.id === rule.id ? rule : r)
      : [...rules, rule];
    const result = await tenantSecurityService.saveSecurityRules(user.id, updatedRules);
    if (result.success) {
      setRules(updatedRules);
    }
    setRulesSaving(false);
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!user?.id) return;
    setRulesSaving(true);
    const updatedRules = rules.filter(r => r.id !== ruleId);
    const result = await tenantSecurityService.saveSecurityRules(user.id, updatedRules);
    if (result.success) {
      setRules(updatedRules);
    }
    setRulesSaving(false);
  };

  const handleToggleRule = async (ruleId: string, active: boolean) => {
    if (!user?.id) return;
    const updatedRules = rules.map(r => r.id === ruleId ? { ...r, is_active: active } : r);
    const result = await tenantSecurityService.saveSecurityRules(user.id, updatedRules);
    if (result.success) {
      setRules(updatedRules);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-yellow-600" />
          <div>
            <h3 className="font-semibold text-yellow-900">No Tenant Access</h3>
            <p className="text-sm text-yellow-700">You are not associated with a tenant organization.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div key={index} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 rounded-lg ${metric.bgColor}`}>
                  <Icon className={`w-5 h-5 ${metric.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-0.5">
                {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
              </div>
              <div className="text-sm text-gray-600">{metric.label}</div>
            </div>
          );
        })}
      </div>

      {/* Alerts + Sessions side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SecurityAlertsPanel
          tenantId={tenantId}
          alerts={alerts}
          loading={alertsLoading}
          onAcknowledge={handleAcknowledge}
          onResolve={handleResolve}
          onRefresh={() => loadAlerts(tenantId)}
        />
        <ActiveSessionsPanel
          sessions={sessions}
          loading={sessionsLoading}
          onForceLogout={handleForceLogout}
          onRefresh={() => loadSessions(tenantId)}
        />
      </div>

      {/* Security Rules */}
      <SecurityRulesConfig
        rules={rules}
        saving={rulesSaving}
        onSaveRule={handleSaveRule}
        onDeleteRule={handleDeleteRule}
        onToggleRule={handleToggleRule}
      />

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Tenant-Scoped Security</p>
            <p>This dashboard shows security data for your facility only. All PHI access is logged and monitored for HIPAA compliance.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantSecurityDashboard;
