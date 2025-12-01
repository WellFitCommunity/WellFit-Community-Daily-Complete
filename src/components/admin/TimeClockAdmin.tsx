/**
 * TimeClockAdmin
 *
 * Admin view of time clock entries for managers and admins.
 * Shows team/tenant entries with filtering and export capabilities.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Download, Users, Calendar, Filter, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';
import {
  EAPageLayout,
  EACard,
  EACardHeader,
  EACardContent,
  EABadge,
  EAButton,
  EAMetricCard,
} from '../envision-atlus';
import { TimeClockService } from '../../services/timeClockService';
import { auditLogger } from '../../services/auditLogger';
import type { TimeClockEntry } from '../../types/timeClock';

type AdminEntry = TimeClockEntry & { first_name: string; last_name: string };

export const TimeClockAdmin: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState<AdminEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month'>('week');
  const [viewMode, setViewMode] = useState<'all' | 'team'>('all');

  // Stats
  const [stats, setStats] = useState({
    totalEntries: 0,
    currentlyClockedIn: 0,
    totalHoursThisWeek: 0,
    onTimePercentage: 0,
  });

  const getDateRange = useCallback(() => {
    const now = new Date();
    const startDate = new Date();

    switch (dateFilter) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
    }

    return { startDate, endDate: now };
  }, [dateFilter]);

  const loadData = useCallback(async () => {
    if (!user?.id || !tenantId) return;

    try {
      setRefreshing(true);
      setError(null);

      const { startDate, endDate } = getDateRange();

      let result;
      if (viewMode === 'team') {
        result = await TimeClockService.getTeamEntries(user.id, tenantId, {
          startDate,
          endDate,
        });
      } else {
        result = await TimeClockService.getAllTenantEntries(tenantId, {
          startDate,
          endDate,
          limit: 100,
        });
      }

      if (result.success) {
        setEntries(result.data);

        // Calculate stats
        const clockedIn = result.data.filter((e) => e.status === 'clocked_in').length;
        const completedEntries = result.data.filter((e) => e.status === 'clocked_out');
        const totalMinutes = completedEntries.reduce((sum, e) => sum + (e.total_minutes || 0), 0);
        const onTimeEntries = completedEntries.filter((e) => e.was_on_time).length;

        setStats({
          totalEntries: result.data.length,
          currentlyClockedIn: clockedIn,
          totalHoursThisWeek: Math.round(totalMinutes / 60),
          onTimePercentage: completedEntries.length > 0
            ? Math.round((onTimeEntries / completedEntries.length) * 100)
            : 0,
        });
      } else {
        setError(result.error.message);
      }
    } catch (err) {
      setError('Failed to load time clock data');
      await auditLogger.error('TIME_CLOCK_ADMIN_LOAD_FAILED', err as Error, {
        category: 'ADMINISTRATIVE',
      });
    } finally {
      setRefreshing(false);
    }
  }, [user?.id, tenantId, getDateRange, viewMode]);

  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user?.id) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('user_id', user.id)
          .single();

        if (profile?.tenant_id) {
          setTenantId(profile.tenant_id);
        }
      } catch (error) {
        await auditLogger.error('TIME_CLOCK_ADMIN_PROFILE_LOAD_FAILED', error as Error, {
          category: 'ADMINISTRATIVE',
        });
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [user, supabase]);

  useEffect(() => {
    if (tenantId) {
      loadData();
    }
  }, [tenantId, loadData, dateFilter, viewMode]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const exportToCSV = () => {
    if (entries.length === 0) return;

    const headers = ['Employee', 'Date', 'Clock In', 'Clock Out', 'Total Hours', 'On Time'];
    const rows = entries.map((entry) => [
      `${entry.first_name} ${entry.last_name}`,
      formatDate(entry.clock_in_time),
      formatTime(entry.clock_in_time),
      entry.clock_out_time ? formatTime(entry.clock_out_time) : 'Still clocked in',
      entry.total_hours?.toFixed(2) || '-',
      entry.was_on_time ? 'Yes' : 'No',
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-clock-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <EAPageLayout title="Time Clock Management">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
        </div>
      </EAPageLayout>
    );
  }

  return (
    <EAPageLayout
      title="Time Clock Management"
      subtitle="View and export employee time entries"
      badge={<EABadge variant="info">Admin</EABadge>}
      actions={
        <div className="flex items-center gap-2">
          <EAButton
            variant="secondary"
            onClick={loadData}
            disabled={refreshing}
            icon={<RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </EAButton>
          <EAButton
            variant="primary"
            onClick={exportToCSV}
            disabled={entries.length === 0}
            icon={<Download className="h-4 w-4" />}
          >
            Export CSV
          </EAButton>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <EAMetricCard
            label="Total Entries"
            value={stats.totalEntries.toString()}
            icon={<Calendar className="h-5 w-5" />}
          />
          <EAMetricCard
            label="Currently Clocked In"
            value={stats.currentlyClockedIn.toString()}
            icon={<Clock className="h-5 w-5" />}
            riskLevel={stats.currentlyClockedIn > 0 ? 'low' : undefined}
          />
          <EAMetricCard
            label="Hours This Period"
            value={`${stats.totalHoursThisWeek}h`}
            icon={<Users className="h-5 w-5" />}
          />
          <EAMetricCard
            label="On-Time Rate"
            value={`${stats.onTimePercentage}%`}
            icon={<CheckCircle className="h-5 w-5" />}
            riskLevel={stats.onTimePercentage >= 80 ? 'low' : stats.onTimePercentage >= 60 ? 'elevated' : 'high'}
          />
        </div>

        {/* Filters */}
        <EACard>
          <EACardContent className="py-3">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-400">Filters:</span>
              </div>

              {/* Date Filter */}
              <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
                {(['today', 'week', 'month'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setDateFilter(filter)}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      dateFilter === filter
                        ? 'bg-teal-500 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>

              {/* View Mode */}
              <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('all')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    viewMode === 'all'
                      ? 'bg-teal-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Staff
                </button>
                <button
                  onClick={() => setViewMode('team')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    viewMode === 'team'
                      ? 'bg-teal-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  My Team
                </button>
              </div>
            </div>
          </EACardContent>
        </EACard>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* Entries Table */}
        <EACard>
          <EACardHeader icon={<Clock className="h-5 w-5" />}>
            Time Entries
            <span className="ml-2 text-sm text-slate-400">
              ({entries.length} records)
            </span>
          </EACardHeader>

          <EACardContent>
            {entries.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No time entries for this period</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-slate-400 border-b border-slate-700">
                      <th className="pb-3 font-medium">Employee</th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Clock In</th>
                      <th className="pb-3 font-medium">Clock Out</th>
                      <th className="pb-3 font-medium">Total</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {entries.map((entry) => (
                      <tr key={entry.id} className="text-sm">
                        <td className="py-3 text-white">
                          {entry.first_name} {entry.last_name}
                        </td>
                        <td className="py-3 text-slate-300">
                          {formatDate(entry.clock_in_time)}
                        </td>
                        <td className="py-3 text-slate-300 font-mono">
                          {formatTime(entry.clock_in_time)}
                        </td>
                        <td className="py-3 text-slate-300 font-mono">
                          {entry.clock_out_time ? (
                            formatTime(entry.clock_out_time)
                          ) : (
                            <span className="text-teal-400">Active</span>
                          )}
                        </td>
                        <td className="py-3 text-white font-medium">
                          {entry.total_hours
                            ? TimeClockService.formatHours(entry.total_minutes || 0)
                            : '-'
                          }
                        </td>
                        <td className="py-3">
                          {entry.was_on_time !== null && (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                                entry.was_on_time
                                  ? 'bg-teal-500/20 text-teal-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {entry.was_on_time ? (
                                <>
                                  <CheckCircle className="h-3 w-3" />
                                  On time
                                </>
                              ) : (
                                'Late'
                              )}
                            </span>
                          )}
                          {entry.status === 'clocked_in' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300">
                              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                              Working
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </EACardContent>
        </EACard>
      </div>
    </EAPageLayout>
  );
};

export default TimeClockAdmin;
