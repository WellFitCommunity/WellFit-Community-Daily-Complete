// src/components/ExportCheckIns.tsx
import React, { useState, useCallback } from 'react';
import { useSupabaseClient } from '../../contexts/AuthContext';
// NOTE: file-saver is now lazy-loaded inside the export functions for bundle size
// import { saveAs } from 'file-saver';

type ProfileRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};

type CheckInRow = {
  user_id: string;
  created_at: string;
  label: string;
  is_emergency: boolean;
};

type ExportFormat = 'csv' | 'json';

interface ToastData {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

// Toast Component
const ToastNotification: React.FC<{ toast: ToastData; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  React.useEffect(() => {
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
      <ToastNotification key={toast.id} toast={toast} onDismiss={onDismiss} />
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

const ExportCheckIns: React.FC = () => {
  const supabase = useSupabaseClient();
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [includeEmergencyOnly, setIncludeEmergencyOnly] = useState(false);
  const [exportStats, setExportStats] = useState<{
    totalRecords: number;
    emergencyCount: number;
    dateRange: string;
  } | null>(null);

  const addToast = useCallback((type: ToastData['type'], message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const fetchAll = useCallback(async (): Promise<Array<CheckInRow & { full_name: string; phone: string }>> => {
    let query = supabase
      .from('check_ins')
      .select('user_id, created_at, label, is_emergency')
      .order('created_at', { ascending: false });

    // Apply date range filter if specified
    if (dateRange.startDate) {
      query = query.gte('created_at', `${dateRange.startDate}T00:00:00`);
    }
    if (dateRange.endDate) {
      query = query.lte('created_at', `${dateRange.endDate}T23:59:59`);
    }

    // Apply emergency filter if specified
    if (includeEmergencyOnly) {
      query = query.eq('is_emergency', true);
    }

    const { data: rawCheckIns, error: e1 } = await query;

    if (e1) {
      throw new Error(`Failed to fetch check-ins: ${e1.message}`);
    }

    const checkIns: CheckInRow[] = (rawCheckIns ?? []) as CheckInRow[];

    if (checkIns.length === 0) {
      return [];
    }

    // Get unique user IDs
    const userIds: string[] = Array.from(new Set(checkIns.map((ci: CheckInRow) => ci.user_id)));

    // Fetch user profiles
    let profileMap: Map<string, ProfileRow> = new Map();

    if (userIds.length > 0) {
      const { data: rawProfiles, error: e2 } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, phone')
        .in('user_id', userIds);

      if (e2) {

        addToast('warning', 'Some user profile data may be incomplete');
      }

      if (rawProfiles) {
        const profiles: ProfileRow[] = rawProfiles as ProfileRow[];
        profileMap = new Map<string, ProfileRow>(
          profiles.map((pr: ProfileRow) => [pr.user_id, pr])
        );
      }
    }

    // Combine check-ins with profile data
    return checkIns.map((ci: CheckInRow) => {
      const p = profileMap.get(ci.user_id);
      const full_name = ((p?.first_name ?? '') + ' ' + (p?.last_name ?? '')).trim() || 'Unknown User';
      const phone = p?.phone ?? 'Not Available';
      return { ...ci, full_name, phone };
    });
  }, [supabase, dateRange, includeEmergencyOnly, addToast]);

  const sanitizeForCSV = (value: string): string => {
    // Handle null/undefined values
    if (!value || value === 'null' || value === 'undefined') {
      return '""';
    }

    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    const sanitized = String(value).replace(/"/g, '""');
    if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n') || sanitized.includes('\r')) {
      return `"${sanitized}"`;
    }
    return sanitized;
  };

  const formatDateForDisplay = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      });
    } catch (error) {

      return dateString;
    }
  };

  // Lazy-load file-saver only when we actually export
  const lazySaveAs = async (blob: Blob, filename: string) => {
    const { saveAs } = await import('file-saver');
    saveAs(blob, filename);
  };

  const exportToCSV = async (data: Array<CheckInRow & { full_name: string; phone: string }>): Promise<void> => {
    const headers = [
      'Full Name',
      'Phone',
      'Date/Time',
      'Check-in Label',
      'Emergency Status',
      'User ID',
      'Raw Timestamp'
    ];

    const csvRows = data.map((row) => [
      sanitizeForCSV(row.full_name),
      sanitizeForCSV(row.phone),
      sanitizeForCSV(formatDateForDisplay(row.created_at)),
      sanitizeForCSV(row.label),
      sanitizeForCSV(row.is_emergency ? 'Emergency' : 'Regular'),
      sanitizeForCSV(row.user_id),
      sanitizeForCSV(row.created_at)
    ]);

    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    const bom = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `wellfit-checkins-${timestamp}.csv`;

    await lazySaveAs(blob, filename);
  };

  const exportToJSON = async (data: Array<CheckInRow & { full_name: string; phone: string }>): Promise<void> => {
    const exportData = {
      metadata: {
        exported_at: new Date().toISOString(),
        total_records: data.length,
        emergency_count: data.filter(r => r.is_emergency).length,
        date_range: {
          start: dateRange.startDate || 'All time',
          end: dateRange.endDate || 'All time'
        },
        filters_applied: {
          emergency_only: includeEmergencyOnly,
          date_filtered: !!(dateRange.startDate || dateRange.endDate)
        }
      },
      check_ins: data.map(row => ({
        full_name: row.full_name,
        phone: row.phone,
        formatted_date: formatDateForDisplay(row.created_at),
        raw_timestamp: row.created_at,
        label: row.label,
        is_emergency: row.is_emergency,
        emergency_status: row.is_emergency ? 'Emergency' : 'Regular',
        user_id: row.user_id
      }))
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `wellfit-checkins-${timestamp}.json`;

    await lazySaveAs(blob, filename);
  };

  const handleExport = async (): Promise<void> => {
    setLoading(true);
    setExportStats(null);

    try {
      addToast('info', 'Fetching check-in data...');

      const data = await fetchAll();

      if (data.length === 0) {
        addToast('warning', 'No check-in data available for the specified criteria');
        return;
      }

      // Calculate stats
      const emergencyCount = data.filter(r => r.is_emergency).length;
      const dates = data.map(r => new Date(r.created_at)).sort((a, b) => a.getTime() - b.getTime());
      const exportedRange =
        dates.length > 0
          ? `${dates[0].toLocaleDateString()} - ${dates[dates.length - 1].toLocaleDateString()}`
          : 'No dates';

      setExportStats({
        totalRecords: data.length,
        emergencyCount,
        dateRange: exportedRange
      });

      // Export based on selected format
      if (exportFormat === 'csv') {
        await exportToCSV(data);
        addToast('success', `Successfully exported ${data.length} check-ins to CSV`);
      } else if (exportFormat === 'json') {
        await exportToJSON(data);
        addToast('success', `Successfully exported ${data.length} check-ins to JSON`);
      }
    } catch (error) {

      const message = error instanceof Error ? error.message : 'Export failed with unknown error';
      addToast('error', `Export failed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = (): void => {
    setDateRange({ startDate: '', endDate: '' });
    setIncludeEmergencyOnly(false);
    setExportStats(null);
    addToast('info', 'Filters reset');
  };

  const isFiltered = !!(dateRange.startDate || dateRange.endDate || includeEmergencyOnly);

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="bg-white border rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Export Check-In Data</h2>
          {isFiltered && (
            <button
              onClick={resetFilters}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* Export Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Export Format
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="csv"
                  checked={exportFormat === 'csv'}
                  onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                  className="mr-2"
                />
                <span className="text-sm">CSV (Excel compatible)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="json"
                  checked={exportFormat === 'json'}
                  onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                  className="mr-2"
                />
                <span className="text-sm">JSON (with metadata)</span>
              </label>
            </div>
          </div>

          {/* Filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filters
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeEmergencyOnly}
                  onChange={(e) => setIncludeEmergencyOnly(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm">Emergency check-ins only</span>
              </label>
            </div>
          </div>
        </div>

        {/* Date Range */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date Range (Optional)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="startDate" className="block text-xs text-gray-500 mb-1">
                Start Date
              </label>
              <input
                id="startDate"
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                max={dateRange.endDate || undefined}
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-xs text-gray-500 mb-1">
                End Date
              </label>
              <input
                id="endDate"
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min={dateRange.startDate || undefined}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
        </div>

        {/* Export Stats */}
        {exportStats && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Last Export Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-blue-700 font-medium">Total Records:</span>
                <span className="ml-2 text-blue-900">{exportStats.totalRecords.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-blue-700 font-medium">Emergency:</span>
                <span className="ml-2 text-blue-900">{exportStats.emergencyCount.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-blue-700 font-medium">Date Range:</span>
                <span className="ml-2 text-blue-900">{exportStats.dateRange}</span>
              </div>
            </div>
          </div>
        )}

        {/* Export Button */}
        <div className="text-center">
          <button
            onClick={handleExport}
            disabled={loading}
            className="inline-flex items-center px-6 py-3 bg-wellfit-green text-white font-medium rounded-lg shadow hover:bg-wellfit-blue focus:ring-2 focus:ring-wellfit-green focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            aria-label={`Export check-in data as ${exportFormat.toUpperCase()}`}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">Exporting...</span>
              </>
            ) : (
              <>
                <span className="text-lg mr-2">📤</span>
                <span>Export as {exportFormat.toUpperCase()}</span>
              </>
            )}
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 mb-2">
            {exportFormat === 'csv'
              ? 'CSV files can be opened in Excel, Google Sheets, or any spreadsheet application.'
              : 'JSON files include metadata and are suitable for programmatic processing.'
            }
          </p>
          <p className="text-xs text-gray-400">
            💡 For large datasets (&gt;10,000 records), consider using server-side export for better performance.
          </p>
          {isFiltered && (
            <p className="text-xs text-blue-600 mt-2">
              ⚡ Active filters will be applied to the export
            </p>
          )}
        </div>
      </div>
    </>
  );
};

export default ExportCheckIns;
