/**
 * TimeHistory
 *
 * Shows a history of time clock entries.
 * Displays date, clock in/out times, total hours, and on-time status.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { History, CheckCircle, Clock, Calendar, Download } from 'lucide-react';
import { EACard, EACardHeader, EACardContent } from '../envision-atlus';
import { TimeClockService } from '../../services/timeClockService';
import type { TimeClockEntry } from '../../types/timeClock';

interface TimeHistoryProps {
  userId: string;
  tenantId: string;
}

export const TimeHistory: React.FC<TimeHistoryProps> = ({ userId, tenantId }) => {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimeClockEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await TimeClockService.getTimeEntries(userId, tenantId, {
        limit: 30,
      });

      if (result.success) {
        setEntries(result.data);
      } else {
        setError(result.error.message);
      }
    } catch (err) {
      setError('Failed to load time history');
    } finally {
      setLoading(false);
    }
  }, [userId, tenantId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
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

    const headers = ['Date', 'Clock In', 'Clock Out', 'Total Hours', 'On Time', 'Notes'];
    const rows = entries.map((entry) => [
      formatDate(entry.clock_in_time),
      formatTime(entry.clock_in_time),
      entry.clock_out_time ? formatTime(entry.clock_out_time) : 'Still clocked in',
      entry.total_hours?.toFixed(2) || '-',
      entry.was_on_time ? 'Yes' : 'No',
      entry.notes || '',
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <EACard>
        <EACardContent className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
        </EACardContent>
      </EACard>
    );
  }

  return (
    <EACard data-testid="time-history">
      <EACardHeader
        icon={<History className="h-5 w-5" />}
        action={
          entries.length > 0 && (
            <button
              onClick={exportToCSV}
              className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
              data-testid="export-csv"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          )
        }
      >
        Time History
      </EACardHeader>

      <EACardContent>
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 text-red-300 text-sm text-center mb-4">
            {error}
          </div>
        )}

        {entries.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No time entries yet</p>
            <p className="text-sm mt-1">Your time history will appear here</p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="entries-list">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="bg-slate-800/50 rounded-lg p-4 flex items-center justify-between"
                data-testid="time-entry"
              >
                <div className="flex items-center gap-4">
                  {/* Date */}
                  <div className="text-center min-w-[70px]">
                    <p className="text-sm text-slate-400">
                      {formatDate(entry.clock_in_time)}
                    </p>
                  </div>

                  {/* Times */}
                  <div className="flex items-center gap-2">
                    <div className="text-center">
                      <p className="text-xs text-slate-500">In</p>
                      <p className="text-white font-mono">
                        {formatTime(entry.clock_in_time)}
                      </p>
                    </div>
                    <span className="text-slate-600">→</span>
                    <div className="text-center">
                      <p className="text-xs text-slate-500">Out</p>
                      <p className="text-white font-mono">
                        {entry.clock_out_time ? (
                          formatTime(entry.clock_out_time)
                        ) : (
                          <span className="text-teal-400 text-sm">Active</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right side - Hours & Status */}
                <div className="flex items-center gap-4">
                  {/* Total Hours */}
                  {entry.total_hours !== null && entry.total_hours !== undefined && (
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Total</p>
                      <p className="text-white font-bold">
                        {TimeClockService.formatHours(entry.total_minutes || 0)}
                      </p>
                    </div>
                  )}

                  {/* On Time Badge */}
                  {entry.was_on_time !== null && (
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                        entry.was_on_time
                          ? 'bg-teal-500/20 text-teal-300'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {entry.was_on_time && <CheckCircle className="h-3 w-3" />}
                      {entry.was_on_time ? 'On time' : 'Late'}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </EACardContent>
    </EACard>
  );
};

export default TimeHistory;
