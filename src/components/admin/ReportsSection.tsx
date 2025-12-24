// src/components/ReportsSection.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSupabaseClient } from '../../contexts/AuthContext';
// NOTE: file-saver is lazy-loaded in helpers below to reduce bundle size
// import { saveAs } from 'file-saver';

interface EngagementStats {
  totalCheckIns: number;
  emergencyCheckIns: number;
  mealsPrepared: number;
  techTipsViewed: number;
  activeUsers: number;
  checkInsThisWeek: number;
  checkInsThisMonth: number;
  lastUpdated: Date;
}

interface ToastData {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

// Toast Component
const Toast: React.FC<{ toast: ToastData; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const bgColors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  return (
    <div className={`${bgColors[toast.type]} text-white px-4 py-3 rounded-lg shadow-lg flex justify-between items-center min-w-[20rem] max-w-md`}>
      <div className="flex items-center space-x-2">
        <span className="font-bold">{icons[toast.type]}</span>
        <span className="text-sm">{toast.message}</span>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="ml-4 text-white hover:text-gray-200 font-bold text-lg"
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
};

// Toast Container
const ToastContainer: React.FC<{ toasts: ToastData[]; onDismiss: (id: string) => void }> = ({ toasts, onDismiss }) => (
  <div className="fixed top-4 right-4 z-50 space-y-2" aria-live="polite">
    {toasts.map(toast => (
      <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
    ))}
  </div>
);

// Loading Spinner
const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-6 w-6'
  };

  return (
    <svg className={`animate-spin ${sizeClasses[size]} text-current`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
};

const lazySaveAs = async (blob: Blob, filename: string) => {
  const { saveAs } = await import('file-saver');
  saveAs(blob, filename);
};

// Stat Card Component
const StatCard: React.FC<{
  icon: string;
  title: string;
  value: number | string;
  subtitle?: string;
  trend?: { value: number; isPositive: boolean };
  isPlaceholder?: boolean;
  onClick?: () => void;
}> = ({ icon, title, value, subtitle, trend, isPlaceholder, onClick }) => {
  return (
    <div
      className={`bg-white border rounded-lg p-4 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-blue-300' : ''
      } ${isPlaceholder ? 'opacity-60' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        {trend && (
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              trend.isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-1">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="text-sm text-gray-500">{title}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
      {isPlaceholder && <div className="text-xs text-amber-600 mt-2">⚠️ Requires setup</div>}
    </div>
  );
};

const ReportsSection: React.FC = () => {
  const supabase = useSupabaseClient();

  const [stats, setStats] = useState<EngagementStats>({
    totalCheckIns: 0,
    emergencyCheckIns: 0,
    mealsPrepared: 0,
    techTipsViewed: 0,
    activeUsers: 0,
    checkInsThisWeek: 0,
    checkInsThisMonth: 0,
    lastUpdated: new Date(),
  });

  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [exporting, setExporting] = useState<null | 'summary' | 'self' | 'detailed'>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);

  const addToast = useCallback((type: ToastData['type'], message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const fetchReportStats = useCallback(async (showToast = false) => {
    setLoading(true);

    try {
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Parallel queries for better performance
      const [
        totalCheckInsQuery,
        emergencyCheckInsQuery,
        weeklyCheckInsQuery,
        monthlyCheckInsQuery,
        usersQuery,
        mealViewsQuery,
        techTipViewsQuery
      ] = await Promise.allSettled([
        supabase.from('check_ins').select('*', { count: 'exact', head: true }),
        supabase.from('check_ins').select('*', { count: 'exact', head: true }).eq('is_emergency', true),
        supabase.from('check_ins').select('*', { count: 'exact', head: true }).gte('created_at', oneWeekAgo.toISOString()),
        supabase.from('check_ins').select('*', { count: 'exact', head: true }).gte('created_at', oneMonthAgo.toISOString()),
        supabase.from('profiles').select('user_id', { count: 'exact', head: true }),
        supabase.from('feature_engagement').select('*', { count: 'exact', head: true }).eq('feature_type', 'meal_view'),
        supabase.from('feature_engagement').select('*', { count: 'exact', head: true }).eq('feature_type', 'tech_tip_view')
      ]);

      // Extract results with error handling
      const totalCheckIns = totalCheckInsQuery.status === 'fulfilled' ? totalCheckInsQuery.value.count ?? 0 : 0;
      const emergencyCheckIns = emergencyCheckInsQuery.status === 'fulfilled' ? emergencyCheckInsQuery.value.count ?? 0 : 0;
      const checkInsThisWeek = weeklyCheckInsQuery.status === 'fulfilled' ? weeklyCheckInsQuery.value.count ?? 0 : 0;
      const checkInsThisMonth = monthlyCheckInsQuery.status === 'fulfilled' ? monthlyCheckInsQuery.value.count ?? 0 : 0;
      const mealsPrepared = mealViewsQuery.status === 'fulfilled' ? mealViewsQuery.value.count ?? 0 : 0;
      const techTipsViewed = techTipViewsQuery.status === 'fulfilled' ? techTipViewsQuery.value.count ?? 0 : 0;

      let activeUsers = 0;
      if (usersQuery.status === 'fulfilled') {
        activeUsers = usersQuery.value.count ?? 0;
      } else {
        // Fallback to profiles table
        const profilesFallback = await supabase.from('profiles').select('user_id', { count: 'exact', head: true });
        activeUsers = profilesFallback.count ?? 0;
      }

      const newStats: EngagementStats = {
        totalCheckIns,
        emergencyCheckIns,
        mealsPrepared,
        techTipsViewed,
        activeUsers,
        checkInsThisWeek,
        checkInsThisMonth,
        lastUpdated: new Date(),
      };

      setStats(newStats);

      if (showToast) {
        addToast('success', 'Reports refreshed successfully');
      }

      const failedQueries = [
        totalCheckInsQuery,
        emergencyCheckInsQuery,
        weeklyCheckInsQuery,
        monthlyCheckInsQuery,
        usersQuery,
        mealViewsQuery,
        techTipViewsQuery
      ].filter(q => q.status === 'rejected');

      if (failedQueries.length > 0) {

        addToast('warning', 'Some statistics may be incomplete');
      }
    } catch (error) {

      const message = error instanceof Error ? error.message : 'Failed to load report statistics';
      addToast('error', message);
    } finally {
      setLoading(false);
    }
  }, [supabase, addToast]);

  // Auto-refresh functionality
  const startAutoRefresh = useCallback(() => {
    if (refreshInterval != null) return; // guard against multiple intervals
    const id = window.setInterval(() => {
      fetchReportStats(false);
    }, 60000); // 1 minute
    setRefreshInterval(id);
    setAutoRefresh(true);
    addToast('info', 'Auto-refresh enabled (1 minute intervals)');
  }, [fetchReportStats, addToast, refreshInterval]);

  const stopAutoRefresh = useCallback(() => {
    if (refreshInterval != null) {
      window.clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
    setAutoRefresh(false);
    addToast('info', 'Auto-refresh disabled');
  }, [refreshInterval, addToast]);

  useEffect(() => {
    fetchReportStats();
    return () => {
      if (refreshInterval != null) window.clearInterval(refreshInterval);
    };
  }, [fetchReportStats, refreshInterval]);

  // CSV export with proper escaping
  const exportEngagementSummaryCsv = async () => {
    setExporting('summary');
    try {
      addToast('info', 'Preparing engagement summary...');

      // Helper function to escape CSV values
      const escapeCsvValue = (value: any): string => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };

      // Helper function to convert array of objects to CSV
      const arrayToCsv = (data: any[], headers: string[]): string => {
        const headerRow = headers.map(escapeCsvValue).join(',');
        const dataRows = data.map(row =>
          headers.map(header => escapeCsvValue(row[header])).join(',')
        );
        return [headerRow, ...dataRows].join('\n');
      };

      const rows = [
        { metric: 'Total Check-Ins', value: stats.totalCheckIns, period: 'All Time', notes: 'Total user check-ins recorded in the system' },
        { metric: 'Emergency Check-Ins', value: stats.emergencyCheckIns, period: 'All Time', notes: `${((stats.emergencyCheckIns / Math.max(stats.totalCheckIns, 1)) * 100).toFixed(1)}% of total check-ins` },
        { metric: 'Check-Ins This Week', value: stats.checkInsThisWeek, period: 'Last 7 Days', notes: 'Recent user activity indicator' },
        { metric: 'Check-Ins This Month', value: stats.checkInsThisMonth, period: 'Last 30 Days', notes: 'Monthly engagement metric' },
        { metric: 'Registered Users', value: stats.activeUsers, period: 'All Time', notes: 'Total users registered in the platform' },
        { metric: 'Meals Viewed', value: stats.mealsPrepared, period: 'All Time', notes: 'Recipe page visits by users' },
        { metric: 'Tech Tips Viewed', value: stats.techTipsViewed, period: 'All Time', notes: 'Daily tech tip views' },
      ];

      const csvContent = [
        '# WellFit Engagement Summary',
        `# Generated: ${new Date().toISOString()}`,
        `# Created by: WellFit Admin Dashboard`,
        '',
        arrayToCsv(rows, ['metric', 'value', 'period', 'notes']),
        '',
        `# Report Generated,${new Date().toLocaleString()},,WellFit Admin Dashboard`
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });

      const filename = `engagement_summary_${new Date().toISOString().slice(0, 10)}.csv`;
      await lazySaveAs(blob, filename);
      addToast('success', `Engagement summary exported to ${filename}`);
    } catch (error) {

      const message = error instanceof Error ? error.message : 'Export failed';
      addToast('error', `Failed to export CSV: ${message}`);
    } finally {
      setExporting(null);
    }
  };

  const exportSelfReportsCsv = async () => {
    setExporting('self');
    try {
      addToast('info', 'Fetching self-report data...');

      const { data, error: fetchError } = await supabase
        .from('self_reports')
        .select('id, user_id, created_at, mood, symptoms, activity_description, submitted_by, entry_type')
        .order('created_at', { ascending: false })
        .limit(10000);

      if (fetchError) throw fetchError;

      const rows = data ?? [];
      if (rows.length === 0) {
        addToast('warning', 'No self-report data found to export');
        return;
      }

      // Helper function to escape CSV values
      const escapeCsvValue = (value: any): string => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };

      // Helper function to convert array of objects to CSV
      const arrayToCsv = (data: any[], headers: string[]): string => {
        const headerRow = headers.map(escapeCsvValue).join(',');
        const dataRows = data.map(row =>
          headers.map(header => escapeCsvValue(row[header])).join(',')
        );
        return [headerRow, ...dataRows].join('\n');
      };

      const processedRows = rows.map(row => ({
        ...row,
        created_at: new Date(row.created_at).toISOString(),
        symptoms: row.symptoms ?? '',
        activity_description: row.activity_description ?? '',
      }));

      const csvContent = [
        '# WellFit Self Reports Export',
        `# Generated: ${new Date().toISOString()}`,
        `# Created by: WellFit Admin Dashboard`,
        `# Total Records: ${rows.length}`,
        '',
        arrayToCsv(processedRows, [
          'id', 'user_id', 'created_at', 'mood', 'symptoms',
          'activity_description', 'submitted_by', 'entry_type'
        ]),
        '',
        `# Summary,,,,,,,,`,
        `# Total Records,${rows.length},Export Date,${new Date().toLocaleDateString()},,,,`
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });

      const filename = `self_reports_${new Date().toISOString().slice(0, 10)}.csv`;
      await lazySaveAs(blob, filename);
      addToast('success', `${rows.length} self-reports exported to ${filename}`);
    } catch (error) {

      const message = error instanceof Error ? error.message : 'Export failed';
      addToast('error', `Failed to export self-reports: ${message}`);
    } finally {
      setExporting(null);
    }
  };

  // Detailed analytics export as CSV
  const exportDetailedAnalytics = async () => {
    setExporting('detailed');
    try {
      addToast('info', 'Generating detailed analytics...');

      const [checkInsData, profilesData] = await Promise.allSettled([
        supabase.from('check_ins').select('created_at, label, is_emergency, user_id').order('created_at', { ascending: false }).limit(5000),
        supabase.from('profiles').select('user_id, first_name, last_name, phone, created_at').limit(5000)
      ]);

      // Helper function to escape CSV values
      const escapeCsvValue = (value: any): string => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };

      // Helper function to convert array of objects to CSV
      const arrayToCsv = (data: any[], headers: string[]): string => {
        const headerRow = headers.map(escapeCsvValue).join(',');
        const dataRows = data.map(row =>
          headers.map(header => escapeCsvValue(row[header])).join(',')
        );
        return [headerRow, ...dataRows].join('\n');
      };

      const summaryData = [
        { metric: 'Total Check-ins', value: stats.totalCheckIns, percentage: '100%' },
        { metric: 'Emergency Check-ins', value: stats.emergencyCheckIns, percentage: `${((stats.emergencyCheckIns / Math.max(stats.totalCheckIns, 1)) * 100).toFixed(1)}%` },
        { metric: 'Regular Check-ins', value: stats.totalCheckIns - stats.emergencyCheckIns, percentage: `${(((stats.totalCheckIns - stats.emergencyCheckIns) / Math.max(stats.totalCheckIns, 1)) * 100).toFixed(1)}%` },
        { metric: 'Active Users', value: stats.activeUsers, percentage: '100%' },
        { metric: 'Check-ins This Week', value: stats.checkInsThisWeek, percentage: `${((stats.checkInsThisWeek / Math.max(stats.totalCheckIns, 1)) * 100).toFixed(1)}%` },
        { metric: 'Check-ins This Month', value: stats.checkInsThisMonth, percentage: `${((stats.checkInsThisMonth / Math.max(stats.totalCheckIns, 1)) * 100).toFixed(1)}%` },
      ];

      const csvContent = [
        '# WellFit Detailed Analytics Export',
        `# Generated: ${new Date().toISOString()}`,
        `# Created by: WellFit Admin Dashboard`,
        '',
        '# Analytics Summary',
        arrayToCsv(summaryData, ['metric', 'value', 'percentage'])
      ];

      // Add check-ins data if available
      if (checkInsData.status === 'fulfilled' && checkInsData.value.data) {
        const checkInsRows = checkInsData.value.data.map(row => ({
          created_at: new Date(row.created_at).toISOString(),
          user_id: row.user_id,
          label: row.label,
          is_emergency: row.is_emergency ? 'Yes' : 'No'
        }));

        csvContent.push(
          '',
          '# Recent Check-ins',
          arrayToCsv(checkInsRows, ['created_at', 'user_id', 'label', 'is_emergency'])
        );
      }

      // Add profiles data if available
      if (profilesData.status === 'fulfilled' && profilesData.value.data) {
        const profileRows = profilesData.value.data.map(row => ({
          ...row,
          created_at: new Date(row.created_at).toISOString()
        }));

        csvContent.push(
          '',
          '# User Profiles',
          arrayToCsv(profileRows, ['user_id', 'first_name', 'last_name', 'phone', 'created_at'])
        );
      }

      const finalCsv = csvContent.join('\n');
      const blob = new Blob([finalCsv], { type: 'text/csv;charset=utf-8' });

      const filename = `detailed_analytics_${new Date().toISOString().slice(0, 10)}.csv`;
      await lazySaveAs(blob, filename);
      addToast('success', `Detailed analytics exported to ${filename}`);
    } catch (error) {

      const message = error instanceof Error ? error.message : 'Export failed';
      addToast('error', `Failed to export detailed analytics: ${message}`);
    } finally {
      setExporting(null);
    }
  };

  // Calculate trends (mock data for now)
  const trends = useMemo(() => ({
    checkIns: { value: 12, isPositive: true },
    users: { value: 5, isPositive: true },
    emergency: { value: 8, isPositive: false },
  }), []);

  if (loading && stats.totalCheckIns === 0) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4 text-center">
          <LoadingSpinner size="lg" />
          <p className="text-gray-500">Loading engagement reports...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div>
            <h3 className="text-2xl font-bold text-wellfit-blue">Engagement Reports</h3>
            <p className="text-sm text-gray-500 mt-1">
              Last updated: {stats.lastUpdated.toLocaleString()}
              {autoRefresh && <span className="ml-2 text-green-600 font-medium">• Auto-refreshing</span>}
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => fetchReportStats(true)}
              disabled={loading}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-1 text-sm"
            >
              {loading ? <LoadingSpinner size="sm" /> : <span>🔄</span>}
              <span>Refresh</span>
            </button>

            <button
              onClick={autoRefresh ? stopAutoRefresh : startAutoRefresh}
              className={`px-3 py-2 rounded-lg transition-colors text-sm ${
                autoRefresh ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {autoRefresh ? '⏸️ Stop Auto' : '▶️ Auto Refresh'}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon="✅" title="Total Check-Ins" value={stats.totalCheckIns} trend={trends.checkIns} subtitle="All time" />
          <StatCard
            icon="🚨"
            title="Emergency Check-Ins"
            value={stats.emergencyCheckIns}
            trend={trends.emergency}
            subtitle={`${((stats.emergencyCheckIns / Math.max(stats.totalCheckIns, 1)) * 100).toFixed(1)}% of total`}
          />
          <StatCard icon="📅" title="This Week" value={stats.checkInsThisWeek} subtitle="Last 7 days" />
          <StatCard icon="📊" title="This Month" value={stats.checkInsThisMonth} subtitle="Last 30 days" />
          <StatCard icon="👥" title="Registered Users" value={stats.activeUsers} trend={trends.users} subtitle="Platform total" />
          <StatCard icon="🍽️" title="Meals Viewed" value={stats.mealsPrepared} subtitle="Recipe page visits" />
          <StatCard icon="💡" title="Tech Tips Viewed" value={stats.techTipsViewed} subtitle="Daily tech tip views" />
          <StatCard
            icon="📈"
            title="Engagement Rate"
            value={stats.activeUsers > 0 ? `${((stats.checkInsThisWeek / stats.activeUsers) * 100).toFixed(1)}%` : '0%'}
            subtitle="Weekly check-ins per user"
          />
        </div>

        {/* Export Section */}
        <div className="border-t pt-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Export Reports</h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-3 mb-3">
                <span className="text-2xl">📊</span>
                <div>
                  <h5 className="font-medium text-gray-900">Engagement Summary</h5>
                  <p className="text-sm text-gray-500">Key metrics and KPIs</p>
                </div>
              </div>
              <button
                onClick={exportEngagementSummaryCsv}
                disabled={!!exporting}
                className="w-full px-4 py-2 bg-[#003865] text-white font-medium rounded-lg hover:bg-[#002347] focus:ring-2 focus:ring-[#003865] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {exporting === 'summary' ? (
                  <div className="flex items-center justify-center space-x-2">
                    <LoadingSpinner size="sm" />
                    <span>Exporting...</span>
                  </div>
                ) : (
                  'Export Summary (.csv)'
                )}
              </button>
            </div>

            <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-3 mb-3">
                <span className="text-2xl">📋</span>
                <div>
                  <h5 className="font-medium text-gray-900">Self Reports</h5>
                  <p className="text-sm text-gray-500">User-submitted health data</p>
                </div>
              </div>
              <button
                onClick={exportSelfReportsCsv}
                disabled={!!exporting}
                className="w-full px-4 py-2 bg-[#8cc63f] text-white font-medium rounded-lg hover:bg-[#7db335] focus:ring-2 focus:ring-[#8cc63f] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {exporting === 'self' ? (
                  <div className="flex items-center justify-center space-x-2">
                    <LoadingSpinner size="sm" />
                    <span>Exporting...</span>
                  </div>
                ) : (
                  'Export Reports (.csv)'
                )}
              </button>
            </div>

            <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-3 mb-3">
                <span className="text-2xl">📈</span>
                <div>
                  <h5 className="font-medium text-gray-900">Detailed Analytics</h5>
                  <p className="text-sm text-gray-500">Comprehensive data analysis</p>
                </div>
              </div>
              <button
                onClick={exportDetailedAnalytics}
                disabled={!!exporting}
                className="w-full px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 focus:ring-2 focus:ring-purple-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {exporting === 'detailed' ? (
                  <div className="flex items-center justify-center space-x-2">
                    <LoadingSpinner size="sm" />
                    <span>Exporting...</span>
                  </div>
                ) : (
                  'Export Analytics (.csv)'
                )}
              </button>
            </div>
          </div>

          {/* Export Info */}
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start space-x-2">
              <span className="text-blue-600 mt-0.5">ℹ️</span>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Export Information:</p>
                <ul className="space-y-1 text-xs">
                  <li>• <strong>Summary:</strong> High-level metrics and KPIs with trend analysis</li>
                  <li>• <strong>Self Reports:</strong> Individual user health submissions and mood tracking</li>
                  <li>• <strong>Analytics:</strong> Multi-sheet detailed data with charts and breakdowns</li>
                  <li>• All exports are in CSV format for universal compatibility</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Insights */}
        {stats.totalCheckIns > 0 && (
          <div className="border-t pt-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Quick Insights</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-linear-to-r from-blue-50 to-blue-100 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-blue-600">📊</span>
                  <span className="font-medium text-blue-900">Activity Level</span>
                </div>
                <p className="text-sm text-blue-800">
                  {stats.checkInsThisWeek > stats.activeUsers * 0.3
                    ? '🟢 High engagement this week'
                    : stats.checkInsThisWeek > stats.activeUsers * 0.1
                    ? '🟡 Moderate engagement this week'
                    : '🔴 Low engagement this week'}
                </p>
              </div>

              <div className="bg-linear-to-r from-green-50 to-green-100 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-green-600">✅</span>
                  <span className="font-medium text-green-900">Check-in Rate</span>
                </div>
                <p className="text-sm text-green-800">
                  {stats.activeUsers > 0
                    ? `${(stats.checkInsThisWeek / stats.activeUsers).toFixed(1)} check-ins per user this week`
                    : 'No active users yet'}
                </p>
              </div>

              <div className="bg-linear-to-r from-red-50 to-red-100 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-red-600">🚨</span>
                  <span className="font-medium text-red-900">Emergency Rate</span>
                </div>
                <p className="text-sm text-red-800">
                  {stats.emergencyCheckIns === 0
                    ? '🟢 No emergency check-ins recorded'
                    : `${((stats.emergencyCheckIns / stats.totalCheckIns) * 100).toFixed(1)}% emergency rate`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t pt-4">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0 text-sm text-gray-500">
            <div>
              Data refreshed every {autoRefresh ? '1 minute' : 'manually'} • Last update: {stats.lastUpdated.toLocaleTimeString()}
            </div>
            <div className="flex items-center space-x-4">
              {stats.totalCheckIns > 0 && (
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>Data available</span>
                </span>
              )}
              {autoRefresh && (
                <span className="flex items-center space-x-1 text-green-600">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span>Live updates</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ReportsSection;
