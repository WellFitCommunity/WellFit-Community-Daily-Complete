// ============================================================================
// Admin Burnout Radar Dashboard
// ============================================================================
// Purpose: Give managers visibility into team wellness WITHOUT surveillance
// Design: Anonymous aggregates, trend alerts, suggested actions
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../../services/auditLogger';

interface AdminBurnoutRadarProps {
  organizationId?: string;
  departmentFilter?: string;
  roleFilter?: string;
}

interface TeamWellnessStats {
  totalStaff: number;
  checkedInToday: number;
  checkedInThisWeek: number;
  avgStress7Days: number;
  avgEnergy7Days: number;
  avgMood7Days: number;
  stressTrend: 'improving' | 'worsening' | 'stable';
  energyTrend: 'improving' | 'worsening' | 'stable';
  riskDistribution: {
    low: number;
    moderate: number;
    high: number;
    critical: number;
    unknown: number;
  };
  breakAdherence: number; // percentage
  peerCircleParticipation: number; // percentage
  missedBreaksThisWeek: number;
  alerts: WellnessAlert[];
}

interface WellnessAlert {
  type: 'stress_rising' | 'low_checkins' | 'break_adherence' | 'high_risk_count';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  suggestion: string;
}

export const AdminBurnoutRadar: React.FC<AdminBurnoutRadarProps> = ({
  organizationId,
  departmentFilter,
  roleFilter,
}) => {
  const [stats, setStats] = useState<TeamWellnessStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'7' | '30'>('7');
  const [showDetails, setShowDetails] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const now = new Date();
      const daysAgo = parseInt(timeframe);
      const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch check-ins for the period
      const checkinsQuery = supabase
        .from('provider_daily_checkins')
        .select('user_id, stress_level, energy_level, mood_rating, missed_break, checkin_date')
        .gte('checkin_date', startDate.toISOString().split('T')[0]);

      const { data: checkins, error: checkinsError } = await checkinsQuery;

      if (checkinsError) throw checkinsError;

      // Fetch burnout assessments
      const { data: assessments } = await supabase
        .from('provider_burnout_assessments')
        .select('user_id, risk_level')
        .gte('assessment_date', startDate.toISOString());

      // Fetch practitioners count
      const { data: practitioners } = await supabase
        .from('fhir_practitioners')
        .select('id, user_id')
        .eq('active', true);

      // Fetch peer circle participation
      const { data: circleMembers } = await supabase
        .from('provider_support_circle_members')
        .select('user_id')
        .eq('is_active', true);

      const totalStaff = practitioners?.length || 0;
      const uniqueCheckinUsers = new Set(checkins?.map(c => c.user_id) || []);
      const todayCheckins = checkins?.filter(c => c.checkin_date === today.toISOString().split('T')[0]) || [];

      // Calculate averages
      const stressValues = checkins?.map(c => c.stress_level).filter(v => v != null) || [];
      const energyValues = checkins?.map(c => c.energy_level).filter(v => v != null) || [];
      const moodValues = checkins?.map(c => c.mood_rating).filter(v => v != null) || [];

      const avgStress = stressValues.length > 0
        ? stressValues.reduce((a, b) => a + b, 0) / stressValues.length
        : 0;
      const avgEnergy = energyValues.length > 0
        ? energyValues.reduce((a, b) => a + b, 0) / energyValues.length
        : 0;
      const avgMood = moodValues.length > 0
        ? moodValues.reduce((a, b) => a + b, 0) / moodValues.length
        : 0;

      // Calculate risk distribution
      const riskCounts = { low: 0, moderate: 0, high: 0, critical: 0, unknown: 0 };
      const latestRisks = new Map<string, string>();
      assessments?.forEach(a => {
        if (!latestRisks.has(a.user_id) || a.risk_level) {
          latestRisks.set(a.user_id, a.risk_level || 'unknown');
        }
      });
      latestRisks.forEach(risk => {
        if (risk in riskCounts) {
          riskCounts[risk as keyof typeof riskCounts]++;
        }
      });
      // Staff without assessments
      riskCounts.unknown = totalStaff - latestRisks.size;

      // Calculate break adherence
      const missedBreaks = checkins?.filter(c => c.missed_break === true).length || 0;
      const totalBreakOpportunities = checkins?.length || 1;
      const breakAdherence = Math.round(((totalBreakOpportunities - missedBreaks) / totalBreakOpportunities) * 100);

      // Peer circle participation
      const uniqueCircleMembers = new Set(circleMembers?.map(m => m.user_id) || []);
      const peerCircleParticipation = totalStaff > 0
        ? Math.round((uniqueCircleMembers.size / totalStaff) * 100)
        : 0;

      // Calculate trends (compare first half to second half of period)
      const midpoint = new Date(now.getTime() - (daysAgo / 2) * 24 * 60 * 60 * 1000);
      const firstHalf = checkins?.filter(c => new Date(c.checkin_date) < midpoint) || [];
      const secondHalf = checkins?.filter(c => new Date(c.checkin_date) >= midpoint) || [];

      const firstHalfStress = firstHalf.map(c => c.stress_level).filter(v => v != null);
      const secondHalfStress = secondHalf.map(c => c.stress_level).filter(v => v != null);
      const firstAvgStress = firstHalfStress.length > 0 ? firstHalfStress.reduce((a, b) => a + b, 0) / firstHalfStress.length : avgStress;
      const secondAvgStress = secondHalfStress.length > 0 ? secondHalfStress.reduce((a, b) => a + b, 0) / secondHalfStress.length : avgStress;

      let stressTrend: 'improving' | 'worsening' | 'stable' = 'stable';
      if (secondAvgStress < firstAvgStress - 0.5) stressTrend = 'improving';
      else if (secondAvgStress > firstAvgStress + 0.5) stressTrend = 'worsening';

      const firstHalfEnergy = firstHalf.map(c => c.energy_level).filter(v => v != null);
      const secondHalfEnergy = secondHalf.map(c => c.energy_level).filter(v => v != null);
      const firstAvgEnergy = firstHalfEnergy.length > 0 ? firstHalfEnergy.reduce((a, b) => a + b, 0) / firstHalfEnergy.length : avgEnergy;
      const secondAvgEnergy = secondHalfEnergy.length > 0 ? secondHalfEnergy.reduce((a, b) => a + b, 0) / secondHalfEnergy.length : avgEnergy;

      let energyTrend: 'improving' | 'worsening' | 'stable' = 'stable';
      if (secondAvgEnergy > firstAvgEnergy + 0.5) energyTrend = 'improving';
      else if (secondAvgEnergy < firstAvgEnergy - 0.5) energyTrend = 'worsening';

      // Generate alerts
      const alerts: WellnessAlert[] = [];

      if (stressTrend === 'worsening') {
        alerts.push({
          type: 'stress_rising',
          severity: avgStress > 7 ? 'critical' : 'warning',
          message: `Team stress is trending up (${avgStress.toFixed(1)} avg)`,
          suggestion: 'Consider scheduling a team debrief or wellness activity',
        });
      }

      const checkinRate = totalStaff > 0 ? (uniqueCheckinUsers.size / totalStaff) * 100 : 0;
      if (checkinRate < 50) {
        alerts.push({
          type: 'low_checkins',
          severity: checkinRate < 25 ? 'warning' : 'info',
          message: `Only ${Math.round(checkinRate)}% of staff checked in this period`,
          suggestion: 'Send a friendly reminder about wellness check-ins',
        });
      }

      if (breakAdherence < 60) {
        alerts.push({
          type: 'break_adherence',
          severity: breakAdherence < 40 ? 'critical' : 'warning',
          message: `Break adherence is low (${breakAdherence}%)`,
          suggestion: 'Review workload distribution and break policies',
        });
      }

      if (riskCounts.high + riskCounts.critical > totalStaff * 0.2) {
        alerts.push({
          type: 'high_risk_count',
          severity: 'critical',
          message: `${riskCounts.high + riskCounts.critical} staff members at elevated burnout risk`,
          suggestion: 'Ensure EAP resources are visible and schedule 1:1 check-ins',
        });
      }

      setStats({
        totalStaff,
        checkedInToday: todayCheckins.length,
        checkedInThisWeek: uniqueCheckinUsers.size,
        avgStress7Days: avgStress,
        avgEnergy7Days: avgEnergy,
        avgMood7Days: avgMood,
        stressTrend,
        energyTrend,
        riskDistribution: riskCounts,
        breakAdherence,
        peerCircleParticipation,
        missedBreaksThisWeek: missedBreaks,
        alerts,
      });
    } catch (error) {
      auditLogger.error('ADMIN_BURNOUT_RADAR_LOAD_FAILED', error instanceof Error ? error : new Error('Load failed'));
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Get overall risk color
  const getOverallRiskStyle = () => {
    if (!stats) return { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Unknown' };

    const highRiskPercent = ((stats.riskDistribution.high + stats.riskDistribution.critical) / stats.totalStaff) * 100;

    if (highRiskPercent > 30 || stats.avgStress7Days > 7) {
      return { bg: 'bg-red-100 border-red-300', text: 'text-red-700', label: 'HIGH ALERT' };
    }
    if (highRiskPercent > 15 || stats.avgStress7Days > 6) {
      return { bg: 'bg-orange-100 border-orange-300', text: 'text-orange-700', label: 'MODERATE' };
    }
    if (stats.avgStress7Days > 5) {
      return { bg: 'bg-yellow-100 border-yellow-300', text: 'text-yellow-700', label: 'MONITOR' };
    }
    return { bg: 'bg-green-100 border-green-300', text: 'text-green-700', label: 'HEALTHY' };
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 animate-pulse">
        <div className="h-8 bg-gray-200 rounded-sm w-64 mb-6"></div>
        <div className="grid grid-cols-3 gap-4">
          <div className="h-24 bg-gray-200 rounded-xl"></div>
          <div className="h-24 bg-gray-200 rounded-xl"></div>
          <div className="h-24 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 text-center">
        <p className="text-gray-600">Unable to load team wellness data</p>
      </div>
    );
  }

  const riskStyle = getOverallRiskStyle();

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-linear-to-r from-indigo-600 to-purple-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <span>🎛️</span>
              Team Wellness Radar
            </h2>
            <p className="text-indigo-200 text-sm mt-1">
              Anonymous aggregate data • {stats.totalStaff} staff members
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as '7' | '30')}
              className="bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="7" className="text-gray-900">Last 7 days</option>
              <option value="30" className="text-gray-900">Last 30 days</option>
            </select>
            <div className={`px-4 py-2 rounded-lg border-2 font-bold ${riskStyle.bg} ${riskStyle.text}`}>
              {riskStyle.label}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {stats.alerts.length > 0 && (
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="space-y-2">
            {stats.alerts.map((alert, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg flex items-start gap-3 ${
                  alert.severity === 'critical' ? 'bg-red-100 border border-red-300' :
                  alert.severity === 'warning' ? 'bg-amber-100 border border-amber-300' :
                  'bg-blue-100 border border-blue-300'
                }`}
              >
                <span className="text-xl">
                  {alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️'}
                </span>
                <div className="flex-1">
                  <p className={`font-medium ${
                    alert.severity === 'critical' ? 'text-red-800' :
                    alert.severity === 'warning' ? 'text-amber-800' :
                    'text-blue-800'
                  }`}>
                    {alert.message}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    💡 {alert.suggestion}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="p-6">
        <div className="grid grid-cols-3 gap-6 mb-6">
          {/* Stress */}
          <div className="text-center p-4 bg-gray-50 rounded-xl">
            <div className="text-sm text-gray-600 mb-1">Avg Stress</div>
            <div className="text-3xl font-bold text-gray-900">{stats.avgStress7Days.toFixed(1)}</div>
            <div className={`text-sm font-medium mt-1 ${
              stats.stressTrend === 'improving' ? 'text-green-600' :
              stats.stressTrend === 'worsening' ? 'text-red-600' :
              'text-gray-500'
            }`}>
              {stats.stressTrend === 'improving' && '↓ Improving'}
              {stats.stressTrend === 'worsening' && '↑ Rising'}
              {stats.stressTrend === 'stable' && '→ Stable'}
            </div>
            {/* Visual bar */}
            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  stats.avgStress7Days > 7 ? 'bg-red-500' :
                  stats.avgStress7Days > 5 ? 'bg-yellow-500' :
                  'bg-green-500'
                }`}
                style={{ width: `${stats.avgStress7Days * 10}%` }}
              ></div>
            </div>
          </div>

          {/* Energy */}
          <div className="text-center p-4 bg-gray-50 rounded-xl">
            <div className="text-sm text-gray-600 mb-1">Avg Energy</div>
            <div className="text-3xl font-bold text-gray-900">{stats.avgEnergy7Days.toFixed(1)}</div>
            <div className={`text-sm font-medium mt-1 ${
              stats.energyTrend === 'improving' ? 'text-green-600' :
              stats.energyTrend === 'worsening' ? 'text-red-600' :
              'text-gray-500'
            }`}>
              {stats.energyTrend === 'improving' && '↑ Improving'}
              {stats.energyTrend === 'worsening' && '↓ Declining'}
              {stats.energyTrend === 'stable' && '→ Stable'}
            </div>
            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  stats.avgEnergy7Days < 4 ? 'bg-red-500' :
                  stats.avgEnergy7Days < 6 ? 'bg-yellow-500' :
                  'bg-green-500'
                }`}
                style={{ width: `${stats.avgEnergy7Days * 10}%` }}
              ></div>
            </div>
          </div>

          {/* Morale */}
          <div className="text-center p-4 bg-gray-50 rounded-xl">
            <div className="text-sm text-gray-600 mb-1">Avg Morale</div>
            <div className="text-3xl font-bold text-gray-900">{stats.avgMood7Days.toFixed(1)}</div>
            <div className="text-sm text-gray-500 mt-1">out of 10</div>
            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  stats.avgMood7Days < 4 ? 'bg-red-500' :
                  stats.avgMood7Days < 6 ? 'bg-yellow-500' :
                  'bg-green-500'
                }`}
                style={{ width: `${stats.avgMood7Days * 10}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
            <div className="text-2xl font-bold text-blue-700">{stats.checkedInToday}</div>
            <div className="text-xs text-blue-600">Checked in today</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
            <div className="text-2xl font-bold text-green-700">{stats.breakAdherence}%</div>
            <div className="text-xs text-green-600">Break adherence</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-200">
            <div className="text-2xl font-bold text-purple-700">{stats.peerCircleParticipation}%</div>
            <div className="text-xs text-purple-600">In peer circles</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 text-center border border-orange-200">
            <div className="text-2xl font-bold text-orange-700">{stats.missedBreaksThisWeek}</div>
            <div className="text-xs text-orange-600">Missed breaks</div>
          </div>
        </div>

        {/* Risk Distribution */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-900">Burnout Risk Distribution</h4>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-blue-600 hover:underline"
            >
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
          </div>

          <div className="flex gap-2 h-8">
            {stats.riskDistribution.low > 0 && (
              <div
                className="bg-green-500 rounded-sm flex items-center justify-center text-white text-xs font-medium"
                style={{ width: `${(stats.riskDistribution.low / stats.totalStaff) * 100}%` }}
                title={`Low: ${stats.riskDistribution.low}`}
              >
                {stats.riskDistribution.low}
              </div>
            )}
            {stats.riskDistribution.moderate > 0 && (
              <div
                className="bg-yellow-500 rounded-sm flex items-center justify-center text-white text-xs font-medium"
                style={{ width: `${(stats.riskDistribution.moderate / stats.totalStaff) * 100}%` }}
                title={`Moderate: ${stats.riskDistribution.moderate}`}
              >
                {stats.riskDistribution.moderate}
              </div>
            )}
            {stats.riskDistribution.high > 0 && (
              <div
                className="bg-orange-500 rounded-sm flex items-center justify-center text-white text-xs font-medium"
                style={{ width: `${(stats.riskDistribution.high / stats.totalStaff) * 100}%` }}
                title={`High: ${stats.riskDistribution.high}`}
              >
                {stats.riskDistribution.high}
              </div>
            )}
            {stats.riskDistribution.critical > 0 && (
              <div
                className="bg-red-500 rounded-sm flex items-center justify-center text-white text-xs font-medium animate-pulse"
                style={{ width: `${(stats.riskDistribution.critical / stats.totalStaff) * 100}%` }}
                title={`Critical: ${stats.riskDistribution.critical}`}
              >
                {stats.riskDistribution.critical}
              </div>
            )}
            {stats.riskDistribution.unknown > 0 && (
              <div
                className="bg-gray-400 rounded-sm flex items-center justify-center text-white text-xs font-medium"
                style={{ width: `${(stats.riskDistribution.unknown / stats.totalStaff) * 100}%` }}
                title={`No assessment: ${stats.riskDistribution.unknown}`}
              >
                {stats.riskDistribution.unknown}
              </div>
            )}
          </div>

          {showDetails && (
            <div className="mt-3 flex gap-4 text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-sm"></span> Low ({stats.riskDistribution.low})</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-500 rounded-sm"></span> Moderate ({stats.riskDistribution.moderate})</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-500 rounded-sm"></span> High ({stats.riskDistribution.high})</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-sm"></span> Critical ({stats.riskDistribution.critical})</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-400 rounded-sm"></span> No assessment ({stats.riskDistribution.unknown})</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => window.location.href = '/admin/team-huddle'}
            className="flex-1 bg-indigo-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-indigo-700 transition-all"
          >
            Schedule Team Huddle
          </button>
          <button
            onClick={() => window.location.href = '/admin/wellness-report'}
            className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-300 transition-all"
          >
            Export Report
          </button>
        </div>

        {/* Privacy Notice */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            🔒 All data is anonymized and aggregated. Individual wellness data is never shared.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminBurnoutRadar;
