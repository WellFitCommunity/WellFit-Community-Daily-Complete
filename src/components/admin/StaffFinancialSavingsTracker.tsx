/**
 * Staff Financial Savings Tracker
 *
 * Dashboard for tracking and analyzing financial savings per staff member/position.
 * Allows admins and budget personnel to:
 * - View savings by individual staff member
 * - View savings by position type (nurses, care coordinators, etc.)
 * - Filter by date range and category
 * - Export data for budgetary analysis
 *
 * Design: Envision Atlus Clinical Design System
 * HIPAA Compliant: No PHI displayed
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EAAlert,
  EATabs,
} from '../envision-atlus';
import {
  RefreshCw,
  DollarSign,
  Users,
  TrendingUp,
  Download,
  Filter,
  Award,
  Briefcase,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface StaffSavingsRecord {
  staff_user_id: string | null;
  staff_name: string;
  position_type: string;
  department: string | null;
  total_savings_events: number;
  total_amount_saved: number;
  verified_amount: number;
  savings_by_category: Record<string, number>;
}

export interface PositionSavingsRecord {
  position_type: string;
  staff_count: number;
  total_events: number;
  total_saved: number;
  avg_per_staff: number;
  verified_total: number;
}

interface DateRange {
  start: string;
  end: string;
}

const POSITION_TYPE_LABELS: Record<string, string> = {
  nurse: 'Nurse (RN)',
  nurse_practitioner: 'Nurse Practitioner (NP)',
  physician: 'Physician (MD/DO)',
  physician_assistant: 'Physician Assistant (PA)',
  medical_assistant: 'Medical Assistant (MA)',
  care_coordinator: 'Care Coordinator',
  social_worker: 'Social Worker',
  community_health_worker: 'Community Health Worker (CHW)',
  admin: 'Administrator',
  billing_specialist: 'Billing Specialist',
  other: 'Other',
};

const SAVINGS_CATEGORY_LABELS: Record<string, string> = {
  prevented_readmission: 'Prevented Readmission',
  early_intervention: 'Early Intervention',
  care_coordination: 'Care Coordination',
  medication_optimization: 'Medication Optimization',
  preventive_care: 'Preventive Care',
  documentation_efficiency: 'Documentation Efficiency',
  telehealth_efficiency: 'Telehealth Efficiency',
  reduced_er_visits: 'Reduced ER Visits',
  discharge_planning: 'Discharge Planning',
  sdoh_intervention: 'SDOH Intervention',
  other: 'Other',
};

// ============================================================================
// Main Component
// ============================================================================

export const StaffFinancialSavingsTracker: React.FC = () => {
  const supabase = useSupabaseClient();
  const { user } = useAuth();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'staff' | 'position'>('position');
  const [staffSavings, setStaffSavings] = useState<StaffSavingsRecord[]>([]);
  const [positionSavings, setPositionSavings] = useState<PositionSavingsRecord[]>([]);
  const [expandedStaff, setExpandedStaff] = useState<Set<string>>(new Set());

  // Filters
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [selectedPosition, setSelectedPosition] = useState<string>('');
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Get tenant ID on mount
  useEffect(() => {
    const fetchTenantId = async () => {
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      if (profile?.tenant_id) {
        setTenantId(profile.tenant_id);
      }
    };

    fetchTenantId();
  }, [user, supabase]);

  // Load data when filters change
  useEffect(() => {
    if (tenantId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, dateRange, selectedPosition]);

  const loadData = async () => {
    if (!tenantId) return;

    setLoading(true);
    setError(null);

    try {
      // Load staff savings
      const { data: staffData, error: staffError } = await supabase.rpc('get_staff_savings', {
        p_tenant_id: tenantId,
        p_start_date: dateRange.start,
        p_end_date: dateRange.end,
        p_position_type: selectedPosition || null,
      });

      if (staffError) throw staffError;
      setStaffSavings(staffData || []);

      // Load position savings
      const { data: positionData, error: positionError } = await supabase.rpc(
        'get_position_savings_totals',
        {
          p_tenant_id: tenantId,
          p_start_date: dateRange.start,
          p_end_date: dateRange.end,
        }
      );

      if (positionError) throw positionError;
      setPositionSavings(positionData || []);
    } catch (err) {
      setError('Failed to load savings data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const totals = useMemo(() => {
    const totalSaved = staffSavings.reduce((sum, s) => sum + (s.total_amount_saved ?? 0), 0);
    const verifiedSaved = staffSavings.reduce((sum, s) => sum + (s.verified_amount ?? 0), 0);
    const totalEvents = staffSavings.reduce((sum, s) => sum + (s.total_savings_events ?? 0), 0);
    const staffCount = staffSavings.length;

    return {
      totalSaved,
      verifiedSaved,
      totalEvents,
      staffCount,
      avgPerStaff: staffCount > 0 ? totalSaved / staffCount : 0,
    };
  }, [staffSavings]);

  // Toggle staff expansion
  const toggleStaffExpansion = (staffId: string) => {
    const newExpanded = new Set(expandedStaff);
    if (newExpanded.has(staffId)) {
      newExpanded.delete(staffId);
    } else {
      newExpanded.add(staffId);
    }
    setExpandedStaff(newExpanded);
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      'Staff Name',
      'Position',
      'Department',
      'Total Events',
      'Total Saved',
      'Verified Amount',
    ];

    const rows = staffSavings.map((s) => [
      s.staff_name,
      POSITION_TYPE_LABELS[s.position_type] || s.position_type,
      s.department || 'N/A',
      s.total_savings_events.toString(),
      `$${(s.total_amount_saved ?? 0).toFixed(2)}`,
      `$${(s.verified_amount ?? 0).toFixed(2)}`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `staff-savings-${dateRange.start}-to-${dateRange.end}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Loading state
  if (loading && staffSavings.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-24 bg-slate-800 rounded-xl"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-slate-800 rounded-lg"></div>
            ))}
          </div>
          <div className="h-96 bg-slate-800 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/20 rounded-lg">
            <DollarSign className="h-8 w-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Staff Financial Savings</h1>
            <p className="text-sm text-slate-400">
              Track cost savings by staff member and position
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <EAButton
            variant="secondary"
            onClick={exportToCSV}
            icon={<Download className="h-4 w-4" />}
          >
            Export CSV
          </EAButton>
          <EAButton
            variant="primary"
            onClick={loadData}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </EAButton>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <EAAlert variant="critical">
          <span>{error}</span>
        </EAAlert>
      )}

      {/* Filters */}
      <EACard>
        <EACardHeader icon={<Filter className="h-5 w-5 text-[#00857a]" />}>
          <span className="text-lg font-semibold text-white">Filters</span>
        </EACardHeader>
        <EACardContent>
          <div className="flex flex-wrap gap-4">
            {/* Date Range */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">From:</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#00857a] focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">To:</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#00857a] focus:border-transparent"
              />
            </div>

            {/* Position Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">Position:</label>
              <select
                value={selectedPosition}
                onChange={(e) => setSelectedPosition(e.target.value)}
                className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#00857a] focus:border-transparent"
              >
                <option value="">All Positions</option>
                {Object.entries(POSITION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </EACardContent>
      </EACard>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Saved */}
        <EACard>
          <EACardHeader icon={<DollarSign className="h-5 w-5 text-emerald-400" />}>
            <span className="text-sm font-medium text-slate-400">Total Saved</span>
          </EACardHeader>
          <EACardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-emerald-400">
                ${(totals.totalSaved ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <span className="text-3xl">💰</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Verified: ${(totals.verifiedSaved ?? 0).toLocaleString()}
            </p>
          </EACardContent>
        </EACard>

        {/* Staff Contributing */}
        <EACard>
          <EACardHeader icon={<Users className="h-5 w-5 text-blue-400" />}>
            <span className="text-sm font-medium text-slate-400">Staff Contributing</span>
          </EACardHeader>
          <EACardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-blue-400">{totals.staffCount}</div>
              <span className="text-3xl">👥</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Active contributors</p>
          </EACardContent>
        </EACard>

        {/* Total Events */}
        <EACard>
          <EACardHeader icon={<TrendingUp className="h-5 w-5 text-purple-400" />}>
            <span className="text-sm font-medium text-slate-400">Savings Events</span>
          </EACardHeader>
          <EACardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-purple-400">{totals.totalEvents}</div>
              <span className="text-3xl">📊</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Documented interventions</p>
          </EACardContent>
        </EACard>

        {/* Average Per Staff */}
        <EACard>
          <EACardHeader icon={<Award className="h-5 w-5 text-amber-400" />}>
            <span className="text-sm font-medium text-slate-400">Avg Per Staff</span>
          </EACardHeader>
          <EACardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-amber-400">
                ${(totals.avgPerStaff ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <span className="text-3xl">⭐</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Per contributing member</p>
          </EACardContent>
        </EACard>
      </div>

      {/* Tabs */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700">
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('position')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'position'
                ? 'text-[#00857a] border-b-2 border-[#00857a] bg-slate-800'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Briefcase className="inline-block h-4 w-4 mr-2" />
            By Position
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'staff'
                ? 'text-[#00857a] border-b-2 border-[#00857a] bg-slate-800'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="inline-block h-4 w-4 mr-2" />
            By Individual Staff
          </button>
        </div>

        <div className="p-6">
          {/* Position View */}
          {activeTab === 'position' && (
            <div className="space-y-4">
              {positionSavings.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No savings data available for the selected filters
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Position
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Staff Count
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Total Events
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Total Saved
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Avg Per Staff
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Verified
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {positionSavings.map((pos) => (
                        <tr key={pos.position_type} className="hover:bg-slate-800/50">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-[#00857a]/20 rounded-lg">
                                <Briefcase className="h-4 w-4 text-[#00857a]" />
                              </div>
                              <span className="font-medium text-white">
                                {POSITION_TYPE_LABELS[pos.position_type] || pos.position_type}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right text-slate-300">
                            {pos.staff_count}
                          </td>
                          <td className="px-4 py-4 text-right text-slate-300">
                            {pos.total_events}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <span className="font-bold text-emerald-400">
                              ${(pos.total_saved ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right text-slate-300">
                            ${(pos.avg_per_staff ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <span className="flex items-center justify-end gap-1 text-[#33bfb7]">
                              <CheckCircle className="h-4 w-4" />
                              ${(pos.verified_total ?? 0).toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Staff View */}
          {activeTab === 'staff' && (
            <div className="space-y-4">
              {staffSavings.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No savings data available for the selected filters
                </div>
              ) : (
                <div className="space-y-3">
                  {staffSavings.map((staff) => (
                    <div
                      key={staff.staff_user_id || staff.staff_name}
                      className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden"
                    >
                      {/* Staff Row */}
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-700/50"
                        onClick={() => toggleStaffExpansion(staff.staff_user_id || staff.staff_name)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-blue-500/20 rounded-full">
                            <Users className="h-5 w-5 text-blue-400" />
                          </div>
                          <div>
                            <div className="font-medium text-white">{staff.staff_name}</div>
                            <div className="text-sm text-slate-400">
                              {POSITION_TYPE_LABELS[staff.position_type] || staff.position_type}
                              {staff.department && ` • ${staff.department}`}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <div className="text-sm text-slate-400">Events</div>
                            <div className="font-semibold text-white">
                              {staff.total_savings_events}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-slate-400">Total Saved</div>
                            <div className="font-bold text-emerald-400">
                              ${(staff.total_amount_saved ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-slate-400">Verified</div>
                            <div className="flex items-center gap-1 text-[#33bfb7]">
                              <CheckCircle className="h-4 w-4" />
                              ${(staff.verified_amount ?? 0).toLocaleString()}
                            </div>
                          </div>
                          <div className="p-2">
                            {expandedStaff.has(staff.staff_user_id || staff.staff_name) ? (
                              <ChevronUp className="h-5 w-5 text-slate-400" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {expandedStaff.has(staff.staff_user_id || staff.staff_name) && (
                        <div className="px-4 pb-4 pt-2 border-t border-slate-700">
                          <h4 className="text-sm font-medium text-slate-400 mb-3">
                            Savings by Category
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {Object.entries(staff.savings_by_category || {}).map(
                              ([category, amount]) => (
                                <div
                                  key={category}
                                  className="bg-slate-700/50 rounded-lg p-3"
                                >
                                  <div className="text-xs text-slate-400 mb-1">
                                    {SAVINGS_CATEGORY_LABELS[category] || category}
                                  </div>
                                  <div className="font-semibold text-white">
                                    ${(amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffFinancialSavingsTracker;
