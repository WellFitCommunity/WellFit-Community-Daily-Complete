/**
 * EscalationOverrideDashboard — Admin view of AI escalation overrides
 *
 * P5-4: Displays override patterns, appeal outcomes, and AI blind spots.
 * Helps admins identify which AI skills get overridden most and whether
 * overrides reveal systematic model weaknesses.
 *
 * Tracker: docs/trackers/claude-in-claude-triage-tracker.md (P5-4)
 * Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ShieldAlert,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Brain,
} from 'lucide-react';
import { EABadge } from '../envision-atlus/EABadge';
import { EAAlert } from '../envision-atlus/EAAlert';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../../services/auditLogger';
import { useUser } from '../../contexts/AuthContext';

// ============================================================================
// Types
// ============================================================================

interface OverrideRecord {
  id: string;
  skill_key: string;
  action_type: 'override' | 'appeal';
  original_level: string;
  override_level: string;
  clinician_reason: string;
  is_justified: boolean | null;
  risk_assessment: string | null;
  appeal_supported: boolean | null;
  systematic_issue: boolean | null;
  ai_blind_spots: string[];
  requires_supervisor_review: boolean;
  supervisor_decision: string | null;
  created_at: string;
}

interface OverrideStats {
  total_overrides: number;
  total_appeals: number;
  justified_overrides: number;
  supported_appeals: number;
  high_risk_overrides: number;
  systematic_issues: number;
  top_overridden_skills: Array<{ skill_key: string; count: number }>;
}

interface EscalationOverrideDashboardProps {
  tenantId?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function riskBadgeVariant(risk: string | null): 'critical' | 'high' | 'elevated' | 'normal' {
  switch (risk) {
    case 'high': return 'critical';
    case 'moderate': return 'high';
    case 'low': return 'normal';
    default: return 'elevated';
  }
}

function formatSkillKey(key: string): string {
  return key
    .replace(/^ai-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({ label, value, icon: Icon, color }: {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
}) {
  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-800">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function OverrideRow({ record, isExpanded, onToggle }: {
  record: OverrideRecord;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isAppeal = record.action_type === 'appeal';
  const isJustified = isAppeal ? record.appeal_supported : record.is_justified;

  return (
    <div className="border border-slate-200 rounded-lg mb-2 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <EABadge variant={isAppeal ? 'info' : 'elevated'} size="sm">
                {record.action_type}
              </EABadge>
              <span className="text-sm font-medium text-slate-700">
                {formatSkillKey(record.skill_key)}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {record.original_level} → {record.override_level}
              {' · '}
              {new Date(record.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isJustified === true && <CheckCircle className="h-4 w-4 text-green-500" />}
          {isJustified === false && <XCircle className="h-4 w-4 text-red-500" />}
          {record.risk_assessment && (
            <EABadge variant={riskBadgeVariant(record.risk_assessment)} size="sm">
              {record.risk_assessment} risk
            </EABadge>
          )}
          {record.systematic_issue && (
            <EABadge variant="critical" size="sm">systematic</EABadge>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50">
          <div className="mt-3 space-y-2">
            <div>
              <span className="text-xs font-medium text-slate-500">Clinician Reason:</span>
              <p className="text-sm text-slate-700">{record.clinician_reason}</p>
            </div>
            {record.ai_blind_spots.length > 0 && (
              <div>
                <span className="text-xs font-medium text-slate-500">AI Blind Spots:</span>
                <ul className="mt-1 space-y-1">
                  {record.ai_blind_spots.map((spot, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                      <Brain className="h-3 w-3 mt-1 shrink-0" />
                      {spot}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {record.supervisor_decision && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Supervisor:</span>
                <EABadge
                  variant={record.supervisor_decision === 'approved' ? 'normal' : 'critical'}
                  size="sm"
                >
                  {record.supervisor_decision}
                </EABadge>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TopOverriddenSkills({ skills }: { skills: Array<{ skill_key: string; count: number }> }) {
  if (skills.length === 0) return null;
  const maxCount = Math.max(...skills.map(s => s.count));

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white">
      <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-slate-500" />
        Most Overridden AI Skills
      </h4>
      <div className="space-y-2">
        {skills.map(skill => (
          <div key={skill.skill_key} className="flex items-center gap-3">
            <span className="text-xs text-slate-600 w-32 truncate">
              {formatSkillKey(skill.skill_key)}
            </span>
            <div className="flex-1 bg-slate-100 rounded-full h-2">
              <div
                className="bg-amber-500 rounded-full h-2 transition-all"
                style={{ width: `${(skill.count / maxCount) * 100}%` }}
              />
            </div>
            <span className="text-xs font-mono text-slate-500 w-8 text-right">{skill.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export const EscalationOverrideDashboard: React.FC<EscalationOverrideDashboardProps> = ({
  tenantId: tenantIdProp,
}) => {
  const user = useUser();
  const [resolvedTenantId, setResolvedTenantId] = useState<string | null>(tenantIdProp || null);
  const [records, setRecords] = useState<OverrideRecord[]>([]);
  const [stats, setStats] = useState<OverrideStats | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve tenant ID from user profile if not provided via props
  useEffect(() => {
    if (tenantIdProp) {
      setResolvedTenantId(tenantIdProp);
      return;
    }
    if (!user?.id) return;

    const resolveTenant = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      if (profile?.tenant_id) {
        setResolvedTenantId(profile.tenant_id as string);
      }
    };
    void resolveTenant();
  }, [user?.id, tenantIdProp]);

  const fetchOverrides = useCallback(async () => {
    if (!resolvedTenantId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: dbError } = await supabase
        .from('ai_escalation_overrides')
        .select('id, skill_key, action_type, original_level, override_level, clinician_reason, is_justified, risk_assessment, appeal_supported, systematic_issue, ai_blind_spots, requires_supervisor_review, supervisor_decision, created_at')
        .eq('tenant_id', resolvedTenantId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (dbError) {
        setError(`Failed to load overrides: ${dbError.message}`);
        return;
      }

      const overrides = (data ?? []) as OverrideRecord[];
      setRecords(overrides);

      // Compute stats
      const overridesOnly = overrides.filter(r => r.action_type === 'override');
      const appealsOnly = overrides.filter(r => r.action_type === 'appeal');

      const skillCounts = new Map<string, number>();
      for (const r of overrides) {
        skillCounts.set(r.skill_key, (skillCounts.get(r.skill_key) ?? 0) + 1);
      }

      setStats({
        total_overrides: overridesOnly.length,
        total_appeals: appealsOnly.length,
        justified_overrides: overridesOnly.filter(r => r.is_justified === true).length,
        supported_appeals: appealsOnly.filter(r => r.appeal_supported === true).length,
        high_risk_overrides: overridesOnly.filter(r => r.risk_assessment === 'high').length,
        systematic_issues: overrides.filter(r => r.systematic_issue === true).length,
        top_overridden_skills: Array.from(skillCounts.entries())
          .map(([skill_key, count]) => ({ skill_key, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
      });
    } catch (err: unknown) {
      await auditLogger.error(
        'OVERRIDE_DASHBOARD_LOAD_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { tenantId: resolvedTenantId }
      );
      setError('Failed to load override data');
    } finally {
      setIsLoading(false);
    }
  }, [resolvedTenantId]);

  useEffect(() => {
    void fetchOverrides();
  }, [fetchOverrides]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-1/3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-slate-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <EAAlert variant="critical" title="Load Error">
        {error}
      </EAAlert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-amber-500" />
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              AI Escalation Override Audit
            </h2>
            <p className="text-sm text-slate-500">
              Clinician overrides and appeals of AI escalation decisions
            </p>
          </div>
        </div>
        <EABadge variant="info">
          {records.length} records
        </EABadge>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Overrides" value={stats.total_overrides} icon={ShieldAlert} color="bg-amber-500" />
          <StatCard label="Appeals" value={stats.total_appeals} icon={TrendingUp} color="bg-blue-500" />
          <StatCard label="Justified" value={stats.justified_overrides} icon={CheckCircle} color="bg-green-500" />
          <StatCard label="Supported Appeals" value={stats.supported_appeals} icon={CheckCircle} color="bg-[var(--ea-primary)]" />
          <StatCard label="High Risk" value={stats.high_risk_overrides} icon={AlertCircle} color="bg-red-500" />
          <StatCard label="Systematic Issues" value={stats.systematic_issues} icon={Brain} color="bg-purple-500" />
        </div>
      )}

      {/* Top Overridden Skills */}
      {stats && stats.top_overridden_skills.length > 0 && (
        <TopOverriddenSkills skills={stats.top_overridden_skills} />
      )}

      {/* Override Records List */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Recent Overrides & Appeals
        </h3>
        {records.length === 0 ? (
          <div className="text-center py-8 border border-slate-200 rounded-lg bg-white">
            <ShieldAlert className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No overrides or appeals recorded yet</p>
          </div>
        ) : (
          <div>
            {records.map(record => (
              <OverrideRow
                key={record.id}
                record={record}
                isExpanded={expandedId === record.id}
                onToggle={() => setExpandedId(prev => prev === record.id ? null : record.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EscalationOverrideDashboard;
