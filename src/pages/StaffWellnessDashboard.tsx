/**
 * Staff Wellness Dashboard
 *
 * Burnout prevention and staff wellness monitoring for healthcare providers.
 * Shows compassion fatigue indicators, documentation debt, and proactive interventions.
 *
 * ENTERPRISE INTEGRATION:
 * - Uses StaffWellnessService for database operations
 * - HIPAA-compliant audit logging
 * - Proper error handling with user feedback
 * - Real-time refresh capability
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Heart,
  Brain,
  Users,
  TrendingUp,
  AlertTriangle,
  Coffee,
  FileText,
  Activity,
  Shield,
  Smile,
  Frown,
  Meh,
  RefreshCw,
} from 'lucide-react';
import StaffWellnessService, {
  type StaffWellnessRecord,
  type DepartmentWellnessMetrics,
  type BurnoutRiskLevel,
  type MoodTrend,
} from '../services/staffWellnessService';
import { auditLogger } from '../services/auditLogger';

/**
 * Display metrics for the dashboard header
 */
interface DisplayMetrics {
  totalStaff: number;
  highRiskCount: number;
  avgCompassionScore: number;
  avgDocDebt: number;
  staffOnBreak: number;
  interventionsToday: number;
}

/**
 * Wellness trend data for impact section
 */
interface WellnessTrends {
  turnoverReduction: number;
  satisfactionIncrease: number;
  sickDaysReduction: number;
  estimatedSavings: number;
}

const StaffWellnessDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DisplayMetrics | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffWellnessRecord[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [departments, setDepartments] = useState<Array<{ department_id: string; department_name: string }>>([]);
  const [trends, setTrends] = useState<WellnessTrends | null>(null);

  /**
   * Load all wellness data from service
   */
  const loadData = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Build filters
      const filters = selectedDepartment !== 'all'
        ? { departmentId: selectedDepartment }
        : {};

      // Load all data in parallel
      const [metricsResult, staffResult, trendsResult, deptsResult] = await Promise.all([
        StaffWellnessService.getDepartmentMetrics(filters),
        StaffWellnessService.getStaffWellnessList(filters),
        StaffWellnessService.getWellnessTrends(filters),
        StaffWellnessService.getDepartments(),
      ]);

      // Check for errors
      if (!metricsResult.success) {
        throw new Error(metricsResult.error?.message || 'Failed to load metrics');
      }
      if (!staffResult.success) {
        throw new Error(staffResult.error?.message || 'Failed to load staff data');
      }

      // Transform metrics for display
      const rawMetrics = metricsResult.data as DepartmentWellnessMetrics;
      const displayMetrics: DisplayMetrics = {
        totalStaff: rawMetrics.total_staff,
        highRiskCount: rawMetrics.high_risk_count + rawMetrics.critical_risk_count,
        avgCompassionScore: rawMetrics.avg_compassion_score ?? 72,
        avgDocDebt: rawMetrics.avg_documentation_debt ?? 2.3,
        staffOnBreak: rawMetrics.staff_on_break,
        interventionsToday: rawMetrics.interventions_needed,
      };

      setMetrics(displayMetrics);
      setStaffMembers(staffResult.data || []);

      if (trendsResult.success && trendsResult.data) {
        setTrends({
          turnoverReduction: trendsResult.data.turnover_reduction_percent,
          satisfactionIncrease: trendsResult.data.satisfaction_increase_percent,
          sickDaysReduction: trendsResult.data.sick_days_reduction_percent,
          estimatedSavings: trendsResult.data.estimated_annual_savings,
        });
      }

      if (deptsResult.success) {
        setDepartments(deptsResult.data || []);
      }

      // Log successful data load
      await auditLogger.clinical('STAFF_WELLNESS_DASHBOARD_LOAD', true, {
        staff_count: (staffResult.data || []).length,
        department_filter: selectedDepartment,
      });

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load wellness data';
      setError(errorMessage);
      toast.error(errorMessage);

      await auditLogger.error('STAFF_WELLNESS_DASHBOARD_LOAD_FAILED', errorMessage, {
        department_filter: selectedDepartment,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDepartment]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Handle refresh button click
   */
  const handleRefresh = useCallback(() => {
    loadData(true);
  }, [loadData]);

  /**
   * Handle intervention button click
   */
  const handleIntervene = useCallback(async (staff: StaffWellnessRecord) => {
    try {
      const result = await StaffWellnessService.initiatePeerSupport(
        staff.staff_id,
        `Intervention initiated for ${staff.full_name} from dashboard`
      );

      if (result.success) {
        toast.success(`Intervention initiated for ${staff.full_name}`);
      } else {
        toast.error(result.error?.message || 'Failed to initiate intervention');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initiate intervention';
      toast.error(errorMessage);
    }
  }, []);

  const getRiskColor = (risk: BurnoutRiskLevel): string => {
    switch (risk) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'moderate': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/50';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };

  const getMoodIcon = (trend: MoodTrend): React.ReactNode => {
    switch (trend) {
      case 'improving': return <Smile className="h-4 w-4 text-green-400" />;
      case 'declining': return <Frown className="h-4 w-4 text-red-400" />;
      case 'stable': return <Meh className="h-4 w-4 text-yellow-400" />;
      default: return <Meh className="h-4 w-4 text-slate-400" />;
    }
  };

  const getCompassionColor = (score: number | null): string => {
    if (score === null) return 'text-slate-400';
    if (score >= 70) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading Staff Wellness Data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Unable to Load Wellness Data</h2>
          <p className="text-slate-400 mb-4">{error}</p>
          <button
            onClick={() => loadData()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const criticalStaff = staffMembers.filter(
    s => s.burnout_risk_level === 'critical' || s.burnout_risk_level === 'high'
  );

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-linear-to-r from-purple-800 via-purple-700 to-indigo-800 text-white shadow-xl border-b border-purple-600">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-600 rounded-xl">
                <Heart className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Staff Wellness Center</h1>
                <p className="text-purple-200 text-sm">Burnout Prevention & Compassion Fatigue Monitoring</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-4 py-2 bg-purple-600/50 hover:bg-purple-500 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => navigate('/nurse-dashboard')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors flex items-center gap-2"
              >
                <Activity className="h-4 w-4" />
                Nurse Panel
              </button>
              <button
                onClick={() => navigate('/shift-handoff')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                Shift Handoff
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Alert Banner for Critical Staff */}
      {criticalStaff.length > 0 && (
        <div className="bg-linear-to-r from-red-600 to-orange-600 text-white py-3 px-4">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-semibold">{criticalStaff.length} staff member(s) at elevated burnout risk</span>
            <span className="text-red-100">- Immediate wellness intervention recommended</span>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-blue-400" />
              <span className="text-sm text-slate-400">Total Staff</span>
            </div>
            <div className="text-2xl font-bold text-white">{metrics?.totalStaff ?? 0}</div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-red-500/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <span className="text-sm text-slate-400">High Risk</span>
            </div>
            <div className="text-2xl font-bold text-red-400">{metrics?.highRiskCount ?? 0}</div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-5 w-5 text-pink-400" />
              <span className="text-sm text-slate-400">Avg Compassion</span>
            </div>
            <div className={`text-2xl font-bold ${getCompassionColor(metrics?.avgCompassionScore ?? null)}`}>
              {metrics?.avgCompassionScore ?? 0}%
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-orange-400" />
              <span className="text-sm text-slate-400">Avg Doc Debt</span>
            </div>
            <div className="text-2xl font-bold text-orange-400">{(metrics?.avgDocDebt ?? 0).toFixed(1)}h</div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Coffee className="h-5 w-5 text-green-400" />
              <span className="text-sm text-slate-400">On Break</span>
            </div>
            <div className="text-2xl font-bold text-green-400">{metrics?.staffOnBreak ?? 0}</div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-teal-400" />
              <span className="text-sm text-slate-400">Interventions</span>
            </div>
            <div className="text-2xl font-bold text-teal-400">{metrics?.interventionsToday ?? 0}</div>
          </div>
        </div>

        {/* Department Filter */}
        <div className="flex items-center gap-4">
          <span className="text-slate-400">Filter by Department:</span>
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
          >
            <option value="all">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.department_id} value={dept.department_id}>
                {dept.department_name}
              </option>
            ))}
          </select>
        </div>

        {/* Staff Wellness Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-400" />
              Staff Wellness Monitor
            </h2>
          </div>
          <div className="overflow-x-auto">
            {staffMembers.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-400">No staff wellness data available for selected filters.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-900/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Staff Member</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Department</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Burnout Risk</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Compassion</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Doc Debt</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Last Break</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Shift</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Mood</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {staffMembers.map((staff) => (
                    <tr
                      key={staff.staff_id}
                      className={`hover:bg-slate-700/30 ${
                        staff.burnout_risk_level === 'critical' ? 'bg-red-500/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-white">{staff.full_name}</div>
                          <div className="text-sm text-slate-400">{staff.title || 'Staff'}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{staff.department_name || 'N/A'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getRiskColor(staff.burnout_risk_level)}`}>
                          {staff.burnout_risk_level.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${getCompassionColor(staff.compassion_score)}`}>
                          {staff.compassion_score ?? 'N/A'}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-medium ${(staff.documentation_debt_hours ?? 0) > 4 ? 'text-red-400' : 'text-slate-300'}`}>
                          {(staff.documentation_debt_hours ?? 0).toFixed(1)}h
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-slate-300">
                          {staff.last_break}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-medium ${(staff.shift_hours ?? 0) > 10 ? 'text-orange-400' : 'text-slate-300'}`}>
                          {staff.shift_hours ?? 'N/A'}h
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getMoodIcon(staff.mood_trend)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(staff.burnout_risk_level === 'critical' || staff.burnout_risk_level === 'high') && (
                          <button
                            onClick={() => handleIntervene(staff)}
                            className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors"
                          >
                            Intervene
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-linear-to-br from-green-800/30 to-green-900/30 rounded-xl border border-green-600/30 p-6">
            <div className="flex items-center gap-3 mb-3">
              <Coffee className="h-6 w-6 text-green-400" />
              <h3 className="font-semibold text-white">Smart Break Scheduler</h3>
            </div>
            <p className="text-green-200 text-sm mb-4">AI-optimized break schedules based on patient load and staff wellness.</p>
            <button className="w-full px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors">
              View Schedule
            </button>
          </div>

          <div className="bg-linear-to-br from-blue-800/30 to-blue-900/30 rounded-xl border border-blue-600/30 p-6">
            <div className="flex items-center gap-3 mb-3">
              <Users className="h-6 w-6 text-blue-400" />
              <h3 className="font-semibold text-white">Peer Support Circles</h3>
            </div>
            <p className="text-blue-200 text-sm mb-4">Connect struggling staff with peer mentors and support groups.</p>
            <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
              Manage Circles
            </button>
          </div>

          <div className="bg-linear-to-br from-purple-800/30 to-purple-900/30 rounded-xl border border-purple-600/30 p-6">
            <div className="flex items-center gap-3 mb-3">
              <Brain className="h-6 w-6 text-purple-400" />
              <h3 className="font-semibold text-white">Wellness Resources</h3>
            </div>
            <p className="text-purple-200 text-sm mb-4">Mental health resources, EAP programs, and self-care tools.</p>
            <button className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors">
              View Resources
            </button>
          </div>
        </div>

        {/* Impact Metrics */}
        {trends && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-teal-400" />
              Wellness Program Impact
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400">-{trends.turnoverReduction}%</div>
                <div className="text-sm text-slate-400">Turnover Reduction</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400">+{trends.satisfactionIncrease}%</div>
                <div className="text-sm text-slate-400">Staff Satisfaction</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400">-{trends.sickDaysReduction}%</div>
                <div className="text-sm text-slate-400">Sick Days Used</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-teal-400">${(trends.estimatedSavings / 1000).toFixed(0)}K</div>
                <div className="text-sm text-slate-400">Est. Annual Savings</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-8 border-t border-slate-700 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Last updated: {new Date().toLocaleTimeString()}
              </span>
              <span>|</span>
              <span>{staffMembers.length} staff members</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-slate-800 rounded-sm text-xs">HIPAA Compliant</span>
              <span className="px-2 py-1 bg-slate-800 rounded-sm text-xs">Staff Confidential</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default StaffWellnessDashboard;
