/**
 * AppointmentAnalyticsDashboard - Telehealth appointment analytics dashboard
 *
 * Purpose: Display comprehensive appointment metrics and trends
 * Used by: Admin panels, provider dashboards
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Calendar,
  Clock,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Ban,
} from 'lucide-react';
import {
  AppointmentAnalyticsService,
  type AnalyticsSummary,
  type TrendDataPoint,
  type ProviderStats,
  type NoShowPatterns,
  type ReschedulingAnalytics,
  type TimeRange,
  type Granularity,
} from '../../services/appointmentAnalyticsService';
import { auditLogger } from '../../services/auditLogger';

interface AppointmentAnalyticsDashboardProps {
  tenantId?: string;
  providerId?: string;
  showProviderStats?: boolean;
}

type ActiveTab = 'overview' | 'trends' | 'providers' | 'noshow' | 'rescheduling';

export const AppointmentAnalyticsDashboard: React.FC<AppointmentAnalyticsDashboardProps> = ({
  tenantId,
  providerId,
  showProviderStats = true,
}) => {
  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  // Data state
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [trends, setTrends] = useState<TrendDataPoint[]>([]);
  const [providerStats, setProviderStats] = useState<ProviderStats[]>([]);
  const [noShowPatterns, setNoShowPatterns] = useState<NoShowPatterns | null>(null);
  const [reschedulingData, setReschedulingData] = useState<ReschedulingAnalytics | null>(null);

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['summary', 'trends'])
  );

  // Load data
  const loadData = useCallback(async () => {
    setError(null);
    try {
      // Load summary
      const summaryResult = await AppointmentAnalyticsService.getAnalyticsSummary(
        timeRange,
        tenantId,
        providerId
      );
      if (summaryResult.success && summaryResult.data) {
        setSummary(summaryResult.data);
      }

      // Load trends
      const trendsResult = await AppointmentAnalyticsService.getAppointmentTrends(
        timeRange,
        granularity,
        tenantId,
        providerId
      );
      if (trendsResult.success && trendsResult.data) {
        setTrends(trendsResult.data);
      }

      // Load provider stats (if enabled and no specific provider)
      if (showProviderStats && !providerId) {
        const providerResult = await AppointmentAnalyticsService.getProviderStats(
          timeRange,
          tenantId
        );
        if (providerResult.success && providerResult.data) {
          setProviderStats(providerResult.data);
        }
      }

      // Load no-show patterns
      const noShowResult = await AppointmentAnalyticsService.getNoShowPatterns(
        timeRange,
        tenantId
      );
      if (noShowResult.success && noShowResult.data) {
        setNoShowPatterns(noShowResult.data);
      }

      // Load rescheduling analytics
      const reschedulingResult = await AppointmentAnalyticsService.getReschedulingAnalytics(
        timeRange,
        tenantId
      );
      if (reschedulingResult.success && reschedulingResult.data) {
        setReschedulingData(reschedulingResult.data);
      }
    } catch (err: unknown) {
      await auditLogger.error(
        'ANALYTICS_DASHBOARD_LOAD_FAILED',
        err instanceof Error ? err : new Error(String(err))
      );
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeRange, granularity, tenantId, providerId, showProviderStats]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers
  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  // Helper functions
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  const formatNumber = (value: number) => value.toLocaleString();

  const getRateColor = (rate: number, type: 'completion' | 'noshow') => {
    if (type === 'completion') {
      if (rate >= 90) return 'text-green-600';
      if (rate >= 75) return 'text-yellow-600';
      return 'text-red-600';
    } else {
      if (rate <= 5) return 'text-green-600';
      if (rate <= 15) return 'text-yellow-600';
      return 'text-red-600';
    }
  };

  const getNoShowRiskBadge = (rate: number) => {
    if (rate <= 5) {
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
          Low Risk
        </span>
      );
    }
    if (rate <= 15) {
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
          Medium Risk
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">
        High Risk
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-600">Loading analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Appointment Analytics
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Time Range Selector */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(['7d', '30d', '90d', '1y'] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    timeRange === range
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {range === '1y' ? '1 Year' : range}
                </button>
              ))}
            </div>
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600
                       hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-4 border-b border-gray-200">
          <nav className="flex space-x-4">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'trends', label: 'Trends', icon: TrendingUp },
              ...(showProviderStats && !providerId
                ? [{ id: 'providers', label: 'Providers', icon: Users }]
                : []),
              { id: 'noshow', label: 'No-Show Analysis', icon: AlertTriangle },
              { id: 'rescheduling', label: 'Rescheduling', icon: Calendar },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 flex items-center gap-2">
          <XCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && summary && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Calendar className="w-4 h-4" />
                Total Appointments
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatNumber(summary.totalAppointments)}
              </div>
              <div className="text-sm text-gray-500">
                {summary.avgAppointmentsPerDay.toFixed(1)}/day avg
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <CheckCircle className="w-4 h-4" />
                Completion Rate
              </div>
              <div className={`text-2xl font-bold ${getRateColor(summary.completionRate, 'completion')}`}>
                {formatPercent(summary.completionRate)}
              </div>
              <div className="text-sm text-gray-500">
                {formatNumber(summary.completed)} completed
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Ban className="w-4 h-4" />
                No-Show Rate
              </div>
              <div className={`text-2xl font-bold ${getRateColor(summary.noShowRate, 'noshow')}`}>
                {formatPercent(summary.noShowRate)}
              </div>
              <div className="text-sm text-gray-500">
                {formatNumber(summary.noShows)} no-shows
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Clock className="w-4 h-4" />
                Hours Completed
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {summary.totalHoursCompleted.toFixed(1)}
              </div>
              <div className="text-sm text-gray-500">
                {summary.avgDurationMinutes} min avg duration
              </div>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="bg-white rounded-lg shadow-md">
            <button
              onClick={() => toggleSection('status')}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
            >
              <h3 className="font-semibold text-gray-900">Status Breakdown</h3>
              {expandedSections.has('status') ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            {expandedSections.has('status') && (
              <div className="p-4 pt-0 border-t border-gray-100">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {[
                    { label: 'Completed', value: summary.completed, color: 'bg-green-500' },
                    { label: 'No-Shows', value: summary.noShows, color: 'bg-red-500' },
                    { label: 'Cancelled', value: summary.cancelled, color: 'bg-gray-500' },
                    { label: 'Scheduled', value: summary.scheduled, color: 'bg-blue-500' },
                    { label: 'Confirmed', value: summary.confirmed, color: 'bg-indigo-500' },
                    { label: 'In Progress', value: summary.inProgress, color: 'bg-yellow-500' },
                  ].map((item) => (
                    <div key={item.label} className="text-center">
                      <div className={`w-full h-2 rounded-full ${item.color} mb-2`} />
                      <div className="text-lg font-semibold text-gray-900">
                        {formatNumber(item.value)}
                      </div>
                      <div className="text-xs text-gray-500">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trends Tab */}
      {activeTab === 'trends' && (
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Appointment Trends</h3>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(['day', 'week', 'month'] as Granularity[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setGranularity(g)}
                  className={`px-3 py-1 text-sm font-medium transition-colors ${
                    granularity === g
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Period
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Total
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Completed
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    No-Shows
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Cancelled
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Completion %
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    No-Show %
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {trends.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No data available for this period
                    </td>
                  </tr>
                ) : (
                  trends.map((row) => (
                    <tr key={row.periodStart} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {row.periodLabel}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {row.totalAppointments}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-green-600">
                        {row.completed}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-red-600">
                        {row.noShows}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">
                        {row.cancelled}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${getRateColor(row.completionRate, 'completion')}`}>
                        {formatPercent(row.completionRate)}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${getRateColor(row.noShowRate, 'noshow')}`}>
                        {formatPercent(row.noShowRate)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Providers Tab */}
      {activeTab === 'providers' && showProviderStats && !providerId && (
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Provider Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Provider
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Appointments
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Completed
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    No-Shows
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Completion %
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Hours
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {providerStats.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No provider data available
                    </td>
                  </tr>
                ) : (
                  providerStats.map((provider) => (
                    <tr key={provider.providerId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {provider.providerName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {provider.providerEmail}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {provider.totalAppointments}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-green-600">
                        {provider.completed}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-red-600">
                        {provider.noShows}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-medium ${getRateColor(provider.completionRate, 'completion')}`}>
                          {formatPercent(provider.completionRate)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {provider.totalHours.toFixed(1)}h
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No-Show Analysis Tab */}
      {activeTab === 'noshow' && noShowPatterns && (
        <div className="space-y-6">
          {/* By Day of Week */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">No-Shows by Day of Week</h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-7 gap-2">
                {noShowPatterns.byDayOfWeek.map((day) => (
                  <div
                    key={day.dayOfWeek}
                    className="text-center p-3 rounded-lg bg-gray-50"
                  >
                    <div className="text-sm font-medium text-gray-900">
                      {day.dayName.substring(0, 3)}
                    </div>
                    <div className={`text-lg font-bold ${getRateColor(day.noShowRate, 'noshow')}`}>
                      {formatPercent(day.noShowRate)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {day.noShows}/{day.totalAppointments}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* By Hour */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">No-Shows by Time of Day</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Time
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Total
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      No-Shows
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Rate
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Risk
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {noShowPatterns.byHour
                    .filter((h) => h.totalAppointments > 0)
                    .map((hour) => (
                      <tr key={hour.hour} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {hour.hourLabel}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">
                          {hour.totalAppointments}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-red-600">
                          {hour.noShows}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-medium ${getRateColor(hour.noShowRate, 'noshow')}`}>
                          {formatPercent(hour.noShowRate)}
                        </td>
                        <td className="px-4 py-3">
                          {getNoShowRiskBadge(hour.noShowRate)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* High Risk Patients */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                High-Risk Patients
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Patient
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Total Appts
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      No-Shows
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Rate
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {noShowPatterns.highRiskPatients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                        No high-risk patients identified
                      </td>
                    </tr>
                  ) : (
                    noShowPatterns.highRiskPatients.map((patient) => (
                      <tr key={patient.patientId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {patient.patientName}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">
                          {patient.totalAppointments}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">
                          {patient.noShowCount}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-medium ${getRateColor(patient.noShowRate, 'noshow')}`}>
                          {formatPercent(patient.noShowRate)}
                        </td>
                        <td className="px-4 py-3">
                          {patient.isRestricted ? (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">
                              Restricted
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                              At Risk
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Rescheduling Tab */}
      {activeTab === 'rescheduling' && reschedulingData && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Calendar className="w-4 h-4" />
                Total Reschedules
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatNumber(reschedulingData.totalReschedules)}
              </div>
            </div>

            {/* By Role */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="text-sm text-gray-500 mb-2">By Role</div>
              <div className="space-y-2">
                {reschedulingData.byRole.map((role) => (
                  <div key={role.role} className="flex items-center justify-between">
                    <span className="text-sm capitalize text-gray-700">{role.role}</span>
                    <span className="text-sm font-medium text-gray-900">
                      {role.count} ({formatPercent(role.percentage)})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Outcomes */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="text-sm text-gray-500 mb-2">Outcomes</div>
              <div className="space-y-2">
                {reschedulingData.outcomes.map((outcome) => (
                  <div key={outcome.status} className="flex items-center justify-between">
                    <span className="text-sm capitalize text-gray-700">{outcome.status}</span>
                    <span className={`text-sm font-medium ${
                      outcome.status === 'completed'
                        ? 'text-green-600'
                        : outcome.status === 'no-show'
                        ? 'text-red-600'
                        : 'text-gray-900'
                    }`}>
                      {formatPercent(outcome.percentage)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Reasons */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Top Rescheduling Reasons</h3>
            </div>
            <div className="p-4">
              {reschedulingData.topReasons.length === 0 ? (
                <div className="text-center text-gray-500 py-4">
                  No rescheduling reasons recorded
                </div>
              ) : (
                <div className="space-y-3">
                  {reschedulingData.topReasons.map((reason, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-sm font-medium flex items-center justify-center">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-900 truncate">
                          {reason.reason}
                        </div>
                      </div>
                      <span className="text-sm font-medium text-gray-600">
                        {reason.count} times
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-gray-500">
        Data range: {summary?.startDate ? new Date(summary.startDate).toLocaleDateString() : ''} -{' '}
        {summary?.endDate ? new Date(summary.endDate).toLocaleDateString() : ''} ({summary?.daysInRange || 0} days)
      </div>
    </div>
  );
};

export default AppointmentAnalyticsDashboard;
