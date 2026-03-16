/**
 * ResultEscalationDashboard - Auto-route abnormal lab values to specialists
 *
 * Purpose: Displays active escalations with severity/status filters, metric cards,
 * resolve workflow, and rules configuration tab with CRUD and toggle controls.
 *
 * Used by: sectionDefinitions.tsx (patient-care category)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';
import {
  AlertTriangle,
  Shield,
  RefreshCw,
  Filter,
  Settings,
  CheckCircle,
  Activity,
} from 'lucide-react';
import {
  EACard,
  EACardContent,
  EACardHeader,
  EAButton,
  EAAlert,
  EABadge,
} from '../envision-atlus';
import {
  resultEscalationService,
} from '../../services/resultEscalationService';
import type {
  EscalationLogEntry,
  EscalationRule,
  EscalationMetrics,
  EscalationSeverity,
} from '../../services/resultEscalationService';
import { auditLogger } from '../../services/auditLogger';
import { MetricCard, ResolveModal, AddRuleModal } from './result-escalation/EscalationSubComponents';

// =============================================================================
// TYPES
// =============================================================================

type ActiveTab = 'escalations' | 'rules';
type SeverityFilter = 'all' | EscalationSeverity;
type StatusFilter = 'all' | 'pending' | 'routed' | 'acknowledged';

// =============================================================================
// HELPERS
// =============================================================================

function severityToBadgeVariant(severity: string): 'critical' | 'high' | 'elevated' | 'info' {
  switch (severity) {
    case 'critical': return 'critical';
    case 'high': return 'high';
    case 'moderate': return 'elevated';
    default: return 'info';
  }
}

function formatAge(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainHours = hours % 24;
    return `${days}d ${remainHours}h`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const ResultEscalationDashboard: React.FC = () => {
  useDashboardTheme();
  const [metrics, setMetrics] = useState<EscalationMetrics | null>(null);
  const [escalations, setEscalations] = useState<EscalationLogEntry[]>([]);
  const [rules, setRules] = useState<EscalationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('escalations');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [resolveTarget, setResolveTarget] = useState<EscalationLogEntry | null>(null);
  const [showAddRule, setShowAddRule] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [metricsRes, escalationsRes, rulesRes] = await Promise.all([
      resultEscalationService.getEscalationMetrics(),
      resultEscalationService.getActiveEscalations(),
      resultEscalationService.getRules(),
    ]);

    if (!escalationsRes.success) {
      setError(escalationsRes.error.message);
      setEscalations([]);
    } else {
      setEscalations(escalationsRes.data);
    }

    if (metricsRes.success) setMetrics(metricsRes.data);
    if (rulesRes.success) setRules(rulesRes.data);

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Client-side filters
  const filteredEscalations = escalations.filter(e => {
    if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && e.escalation_status !== statusFilter) return false;
    return true;
  });

  const handleResolve = async (escalationId: string, notes: string) => {
    try {
      const { data: userData } = await (await import('../../lib/supabaseClient')).supabase.auth.getUser();
      const userId = userData?.user?.id ?? 'unknown';

      const result = await resultEscalationService.resolveEscalation(escalationId, userId, notes);
      if (!result.success) {
        setError(result.error.message);
      } else {
        setResolveTarget(null);
        await fetchData();
      }
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('ESCALATION_RESOLVE_UI_FAILED', e);
      setError('Failed to resolve escalation');
    }
  };

  const handleToggleRule = async (ruleId: string, currentActive: boolean) => {
    setTogglingId(ruleId);
    const result = await resultEscalationService.toggleRule(ruleId, !currentActive);
    if (!result.success) {
      setError(result.error.message);
    } else {
      await fetchData();
    }
    setTogglingId(null);
  };

  // --- Loading state ---
  if (loading) {
    return (
      <EACard>
        <EACardContent className="flex items-center justify-center p-12">
          <RefreshCw className="w-5 h-5 animate-spin text-[var(--ea-primary,#00857a)] mr-3" />
          <span className="text-gray-600">Loading escalation data...</span>
        </EACardContent>
      </EACard>
    );
  }

  return (
    <div className="space-y-4" aria-label="Result Escalation Dashboard">
      {/* Critical Alert Banner */}
      {(metrics?.critical_count ?? 0) > 0 && (
        <EAAlert variant="critical">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {metrics?.critical_count} critical escalation{(metrics?.critical_count ?? 0) !== 1 ? 's' : ''} requiring immediate specialist review.
            </span>
          </div>
        </EAAlert>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Total Active" value={metrics?.total_active ?? 0} color="blue" />
        <MetricCard label="Critical" value={metrics?.critical_count ?? 0} color="red" />
        <MetricCard label="High" value={metrics?.high_count ?? 0} color="orange" />
        <MetricCard label="Routed" value={metrics?.routed_count ?? 0} color="purple" />
        <MetricCard label="Resolved Today" value={metrics?.resolved_today ?? 0} color="green" />
        <MetricCard label="Rules Active" value={metrics?.rules_active ?? 0} color="blue" />
      </div>

      {/* Error */}
      {error && (
        <EAAlert variant="critical" dismissible onDismiss={() => setError(null)}>
          {error}
        </EAAlert>
      )}

      {/* Tab Navigation */}
      <EACard>
        <EACardHeader
          icon={<Activity className="w-5 h-5" />}
          action={
            <EAButton variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </EAButton>
          }
        >
          Result Escalation Engine
        </EACardHeader>

        <EACardContent className="p-0">
          {/* Tab Buttons */}
          <div className="flex border-b">
            <button
              type="button"
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'escalations'
                  ? 'border-[var(--ea-primary,#00857a)] text-[var(--ea-primary,#00857a)]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('escalations')}
            >
              <Shield className="w-4 h-4 inline mr-1" />
              Active Escalations
            </button>
            <button
              type="button"
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'rules'
                  ? 'border-[var(--ea-primary,#00857a)] text-[var(--ea-primary,#00857a)]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('rules')}
            >
              <Settings className="w-4 h-4 inline mr-1" />
              Rules Configuration
            </button>
          </div>

          {/* Active Escalations Tab */}
          {activeTab === 'escalations' && (
            <>
              {/* Filter Bar */}
              <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-gray-50">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={severityFilter}
                  onChange={e => setSeverityFilter(e.target.value as SeverityFilter)}
                  className="text-sm rounded-md border-gray-300 shadow-sm focus-visible:ring-[var(--ea-primary,#00857a)] focus-visible:border-[var(--ea-primary,#00857a)]"
                  aria-label="Filter by severity"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="moderate">Moderate</option>
                  <option value="low">Low</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                  className="text-sm rounded-md border-gray-300 shadow-sm focus-visible:ring-[var(--ea-primary,#00857a)] focus-visible:border-[var(--ea-primary,#00857a)]"
                  aria-label="Filter by status"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="routed">Routed</option>
                  <option value="acknowledged">Acknowledged</option>
                </select>
              </div>

              {/* Table Header */}
              <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-b text-xs font-medium text-gray-500 uppercase tracking-wider bg-white">
                <span className="w-28">Test</span>
                <span className="w-20">Value</span>
                <span className="w-20">Severity</span>
                <span className="w-28">Specialty</span>
                <span className="w-24">Status</span>
                <span className="w-20">Age</span>
                <span className="flex-1 text-right">Actions</span>
              </div>

              {/* Rows */}
              {filteredEscalations.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-300" />
                  <p className="text-sm font-medium">No active escalations</p>
                  <p className="text-xs mt-1">
                    {escalations.length === 0
                      ? 'All lab results are within normal parameters.'
                      : 'No escalations match the current filters.'}
                  </p>
                </div>
              ) : (
                filteredEscalations.map(esc => (
                  <div
                    key={esc.id}
                    className="flex flex-wrap sm:flex-nowrap items-center gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
                  >
                    <span className="w-28 text-sm font-medium text-gray-900 truncate" title={esc.test_name}>
                      {esc.test_name}
                    </span>
                    <span className="w-20 text-sm text-gray-700 font-mono">
                      {esc.test_value}{esc.test_unit ? ` ${esc.test_unit}` : ''}
                    </span>
                    <span className="w-20">
                      <EABadge variant={severityToBadgeVariant(esc.severity)} size="sm" pulse={esc.severity === 'critical'}>
                        {esc.severity}
                      </EABadge>
                    </span>
                    <span className="w-28 text-sm text-gray-600 capitalize">
                      {esc.route_to_specialty}
                    </span>
                    <span className="w-24">
                      <EABadge variant={esc.escalation_status === 'routed' ? 'info' : 'neutral'} size="sm">
                        {esc.escalation_status}
                      </EABadge>
                    </span>
                    <span className="w-20 text-xs text-gray-500">
                      {formatAge(esc.created_at)}
                    </span>
                    <span className="flex-1 flex gap-2 justify-end">
                      <EAButton variant="primary" size="sm" onClick={() => setResolveTarget(esc)}>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Resolve
                      </EAButton>
                    </span>
                  </div>
                ))
              )}
            </>
          )}

          {/* Rules Configuration Tab */}
          {activeTab === 'rules' && (
            <RulesTab
              rules={rules}
              togglingId={togglingId}
              onToggleRule={handleToggleRule}
              onAddRule={() => setShowAddRule(true)}
            />
          )}
        </EACardContent>
      </EACard>

      {/* Resolve Modal */}
      {resolveTarget && (
        <ResolveModal
          escalation={resolveTarget}
          onClose={() => setResolveTarget(null)}
          onResolve={handleResolve}
        />
      )}

      {/* Add Rule Modal */}
      {showAddRule && (
        <AddRuleModal
          onClose={() => setShowAddRule(false)}
          onSave={async () => {
            setShowAddRule(false);
            await fetchData();
          }}
        />
      )}
    </div>
  );
};

// =============================================================================
// RULES TAB (extracted for readability)
// =============================================================================

function RulesTab({ rules, togglingId, onToggleRule, onAddRule }: {
  rules: EscalationRule[];
  togglingId: string | null;
  onToggleRule: (ruleId: string, currentActive: boolean) => Promise<void>;
  onAddRule: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <span className="text-sm text-gray-600">{rules.length} rule{rules.length !== 1 ? 's' : ''} configured</span>
        <EAButton variant="primary" size="sm" onClick={onAddRule}>
          <span className="mr-1">+</span>
          Add Rule
        </EAButton>
      </div>

      {/* Rules Table Header */}
      <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-b text-xs font-medium text-gray-500 uppercase tracking-wider bg-white">
        <span className="w-32">Test</span>
        <span className="w-24">Condition</span>
        <span className="w-24">Threshold</span>
        <span className="w-20">Severity</span>
        <span className="w-28">Specialty</span>
        <span className="w-16">SLA</span>
        <span className="w-16">Active</span>
        <span className="flex-1 text-right">Guidance</span>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Settings className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium">No escalation rules configured</p>
          <p className="text-xs mt-1">Add rules to auto-route abnormal results to specialists.</p>
        </div>
      ) : (
        rules.map(rule => (
          <div
            key={rule.id}
            className="flex flex-wrap sm:flex-nowrap items-center gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
          >
            <span className="w-32 text-sm font-medium text-gray-900 truncate" title={rule.display_name}>
              {rule.display_name}
            </span>
            <span className="w-24 text-sm text-gray-600 capitalize">
              {rule.condition.replace('_', ' ')}
            </span>
            <span className="w-24 text-sm text-gray-700 font-mono">
              {rule.condition === 'above' && rule.threshold_high !== null ? `> ${rule.threshold_high}` : ''}
              {rule.condition === 'below' && rule.threshold_low !== null ? `< ${rule.threshold_low}` : ''}
              {rule.condition === 'outside_range' ? `${rule.threshold_low ?? '?'}-${rule.threshold_high ?? '?'}` : ''}
            </span>
            <span className="w-20">
              <EABadge variant={severityToBadgeVariant(rule.severity)} size="sm">
                {rule.severity}
              </EABadge>
            </span>
            <span className="w-28 text-sm text-gray-600 capitalize">
              {rule.route_to_specialty}
            </span>
            <span className="w-16 text-sm text-gray-600">
              {rule.target_minutes}m
            </span>
            <span className="w-16">
              <button
                type="button"
                onClick={() => onToggleRule(rule.id, rule.is_active)}
                disabled={togglingId === rule.id}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  rule.is_active ? 'bg-[var(--ea-primary,#00857a)]' : 'bg-gray-300'
                }`}
                aria-label={`Toggle ${rule.display_name} ${rule.is_active ? 'off' : 'on'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    rule.is_active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </span>
            <span className="flex-1 flex gap-2 justify-end">
              {rule.clinical_guidance && (
                <span className="text-xs text-gray-400 truncate max-w-[150px]" title={rule.clinical_guidance}>
                  {rule.clinical_guidance}
                </span>
              )}
            </span>
          </div>
        ))
      )}
    </>
  );
}

export default ResultEscalationDashboard;
