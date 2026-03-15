/**
 * MFA Compliance Dashboard
 *
 * Admin panel section showing per-role MFA compliance statistics,
 * non-compliant user lists, and exemption management.
 *
 * Used by: sectionDefinitions.tsx (security category)
 * Auth: admin/super_admin/it_admin only
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Users,
  Clock,
  UserX,
  RefreshCw,
} from 'lucide-react';
import { getMfaComplianceReport, grantExemption } from '../../services/mfaEnrollmentService';
import type { MfaComplianceRow } from '../../services/mfaEnrollmentService.types';
import { auditLogger } from '../../services/auditLogger';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';

interface NonCompliantUser {
  user_id: string;
  email: string;
  role: string;
  enforcement_status: string;
  grace_period_ends: string | null;
  days_remaining: number;
}

const MfaComplianceDashboard: React.FC = () => {
  const { theme } = useDashboardTheme();
  const supabase = useSupabaseClient();
  const [complianceData, setComplianceData] = useState<MfaComplianceRow[]>([]);
  const [nonCompliantUsers, setNonCompliantUsers] = useState<NonCompliantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exemptionUserId, setExemptionUserId] = useState<string | null>(null);
  const [exemptionReason, setExemptionReason] = useState('');
  const [exemptionLoading, setExemptionLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Load compliance report
      const result = await getMfaComplianceReport();
      if (result.success) {
        setComplianceData(result.data);
      } else {
        setError(result.error.message);
      }

      // Load non-compliant users
      const { data: users, error: usersError } = await supabase
        .from('mfa_enrollment')
        .select(`
          user_id,
          role,
          enforcement_status,
          grace_period_ends
        `)
        .eq('mfa_enabled', false)
        .neq('enforcement_status', 'exempt')
        .order('grace_period_ends', { ascending: true })
        .limit(50);

      if (usersError) {
        await auditLogger.error('MFA_NONCOMPLIANT_FETCH_FAILED', usersError);
      } else {
        // Enrich with emails from profiles
        const userIds = (users || []).map((u: { user_id: string }) => u.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', userIds);

        const profileMap = new Map<string, string>();
        for (const p of profiles || []) {
          const prof = p as { user_id: string; first_name?: string; last_name?: string };
          profileMap.set(prof.user_id, `${prof.first_name || ''} ${prof.last_name || ''}`.trim() || 'Unknown');
        }

        const enriched: NonCompliantUser[] = (users || []).map((u: {
          user_id: string;
          role: string;
          enforcement_status: string;
          grace_period_ends: string | null;
        }) => {
          const graceDays = u.grace_period_ends
            ? Math.max(0, Math.ceil((new Date(u.grace_period_ends).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : 0;
          return {
            user_id: u.user_id,
            email: profileMap.get(u.user_id) || 'Unknown',
            role: u.role,
            enforcement_status: u.enforcement_status,
            grace_period_ends: u.grace_period_ends,
            days_remaining: graceDays,
          };
        });

        setNonCompliantUsers(enriched);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGrantExemption = useCallback(async () => {
    if (!exemptionUserId || !exemptionReason.trim()) return;
    setExemptionLoading(true);

    const result = await grantExemption(exemptionUserId, exemptionReason.trim());

    if (result.success) {
      setExemptionUserId(null);
      setExemptionReason('');
      await loadData();
    } else {
      setError(result.error.message);
    }

    setExemptionLoading(false);
  }, [exemptionUserId, exemptionReason, loadData]);

  // Summary stats
  const totalUsers = complianceData.reduce((sum, r) => sum + r.total_users, 0);
  const totalCompliant = complianceData.reduce(
    (sum, r) => sum + r.mfa_enabled_count + r.exempt_count, 0
  );
  const overallPct = totalUsers > 0 ? Math.round((totalCompliant / totalUsers) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Users className="w-6 h-6" />}
          label="Total Staff"
          value={totalUsers}
          color="blue"
        />
        <SummaryCard
          icon={<CheckCircle className="w-6 h-6" />}
          label="MFA Enabled"
          value={totalCompliant}
          color="green"
        />
        <SummaryCard
          icon={<AlertTriangle className="w-6 h-6" />}
          label="Non-Compliant"
          value={totalUsers - totalCompliant}
          color="red"
        />
        <SummaryCard
          icon={<Shield className="w-6 h-6" />}
          label="Compliance"
          value={`${overallPct}%`}
          color={overallPct >= 90 ? 'green' : overallPct >= 70 ? 'yellow' : 'red'}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Per-Role Compliance Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">
            Compliance by Role
          </h3>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="text-sm text-[var(--ea-primary,#00857a)] hover:opacity-80 flex items-center gap-1 min-h-[44px]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading compliance data...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Role</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Total</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Enabled</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Non-Compliant</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Exempt</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Compliance %</th>
                </tr>
              </thead>
              <tbody>
                {complianceData.map((row) => (
                  <tr key={row.role} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 capitalize">
                      {row.role.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.total_users}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">{row.mfa_enabled_count}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">{row.non_compliant_count}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{row.exempt_count}</td>
                    <td className="px-4 py-3 text-right">
                      <ComplianceBadge pct={row.compliance_pct} />
                    </td>
                  </tr>
                ))}
                {complianceData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No compliance data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Non-Compliant Users */}
      {nonCompliantUsers.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-red-50 border-b border-red-200">
            <h3 className="text-base font-semibold text-red-800 flex items-center gap-2">
              <UserX className="w-5 h-5" />
              Non-Compliant Users ({nonCompliantUsers.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {nonCompliantUsers.map((u) => (
              <div key={u.user_id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{u.email}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {u.role.replace(/_/g, ' ')} &middot;{' '}
                    {u.enforcement_status === 'grace_period' ? (
                      <span className="text-yellow-600">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {u.days_remaining} days left
                      </span>
                    ) : (
                      <span className="text-red-600">Enforced</span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setExemptionUserId(u.user_id)}
                  className="text-sm text-[var(--ea-primary,#00857a)] hover:opacity-80 min-h-[44px] px-3"
                >
                  Grant Exemption
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exemption Modal */}
      {exemptionUserId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Grant MFA Exemption</h3>
            <p className="text-sm text-gray-600">
              This user will be exempt from MFA requirements. Provide a reason for audit purposes.
            </p>
            <div>
              <label htmlFor="exemption-reason" className="block text-sm font-medium text-gray-700 mb-1">
                Reason
              </label>
              <textarea
                id="exemption-reason"
                value={exemptionReason}
                onChange={(e) => setExemptionReason(e.target.value)}
                placeholder="e.g., Shared workstation, hardware limitation..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ea-primary,#00857a)]"
                rows={3}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setExemptionUserId(null);
                  setExemptionReason('');
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGrantExemption}
                disabled={!exemptionReason.trim() || exemptionLoading}
                className={`px-4 py-2 ${theme.buttonPrimary} text-sm font-medium rounded-lg disabled:opacity-50 min-h-[44px]`}
              >
                {exemptionLoading ? 'Granting...' : 'Grant Exemption'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Helper Components ───

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: 'blue' | 'green' | 'red' | 'yellow';
}

const colorMap = {
  blue: 'bg-[var(--ea-primary,#00857a)]/10 text-[var(--ea-primary,#00857a)] border-[var(--ea-primary,#00857a)]/30',
  green: 'bg-green-50 text-green-600 border-green-200',
  red: 'bg-red-50 text-red-600 border-red-200',
  yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
};

const SummaryCard: React.FC<SummaryCardProps> = ({ icon, label, value, color }) => (
  <div className={`${colorMap[color]} border rounded-lg p-4`}>
    <div className="flex items-center gap-3">
      {icon}
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm opacity-80">{label}</p>
      </div>
    </div>
  </div>
);

const ComplianceBadge: React.FC<{ pct: number }> = ({ pct }) => {
  let color = 'bg-green-100 text-green-800';
  if (pct < 70) color = 'bg-red-100 text-red-800';
  else if (pct < 90) color = 'bg-yellow-100 text-yellow-800';

  return (
    <span className={`${color} px-2 py-1 rounded-full text-xs font-medium`}>
      {pct}%
    </span>
  );
};

export default MfaComplianceDashboard;
