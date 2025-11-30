/**
 * CaregiverAccessHistory - Shows seniors who has viewed their data
 *
 * Displays the caregiver access log for the current user,
 * allowing seniors to see who has accessed their health information.
 */

import React, { useState, useEffect } from 'react';
import { useSupabaseClient } from '../contexts/AuthContext';
import { auditLogger } from '../services/auditLogger';

interface AccessLogEntry {
  id: number;
  caregiver_name: string;
  caregiver_phone: string;
  access_time: string;
  session_ended_at: string | null;
  pages_viewed: string[];
  client_ip: string | null;
}

interface CaregiverAccessHistoryProps {
  userId: string;
}

const CaregiverAccessHistory: React.FC<CaregiverAccessHistoryProps> = ({ userId }) => {
  const supabase = useSupabaseClient();
  const [accessLog, setAccessLog] = useState<AccessLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const loadAccessHistory = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        // Use the RPC function to get access history
        const { data, error } = await supabase.rpc('get_my_access_history', {
          p_limit: 20
        });

        if (error) {
          auditLogger.error('LOAD_ACCESS_HISTORY_ERROR', error);
          setLoading(false);
          return;
        }

        setAccessLog(data || []);
      } catch (err) {
        auditLogger.error('LOAD_ACCESS_HISTORY_EXCEPTION', err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    };

    loadAccessHistory();
  }, [userId, supabase]);

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    } else if (days === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    } else if (days < 7) {
      return `${days} days ago`;
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatDuration = (start: string, end: string | null): string => {
    if (!end) return 'Still active';

    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 1) return 'Less than 1 minute';
    if (diffMins === 1) return '1 minute';
    if (diffMins < 60) return `${diffMins} minutes`;

    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  };

  const maskPhone = (phone: string): string => {
    if (!phone) return 'N/A';
    // Show only last 4 digits
    return `***-***-${phone.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="animate-pulse flex items-center">
          <div className="h-4 w-4 bg-gray-300 rounded-full mr-2"></div>
          <div className="h-4 w-32 bg-gray-300 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center">
          <span className="text-2xl mr-3">👁️</span>
          <div>
            <div className="font-semibold text-[#003865]">Who Viewed My Data</div>
            <p className="text-gray-600 text-sm">
              {accessLog.length === 0
                ? 'No one has accessed your data recently'
                : `${accessLog.length} recent access${accessLog.length === 1 ? '' : 'es'}`}
            </p>
          </div>
        </div>
        <span className="text-xl text-gray-400">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3">
          {accessLog.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              <div className="text-3xl mb-2">🔒</div>
              <p>No caregivers have accessed your data yet.</p>
              <p className="text-sm mt-1">
                When someone uses your PIN to view your health information, it will appear here.
              </p>
            </div>
          ) : (
            <>
              {accessLog.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-white rounded-lg p-3 border border-gray-200"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{entry.caregiver_name}</p>
                      <p className="text-sm text-gray-500">{maskPhone(entry.caregiver_phone)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">{formatDate(entry.access_time)}</p>
                      <p className="text-xs text-gray-400">
                        Duration: {formatDuration(entry.access_time, entry.session_ended_at)}
                      </p>
                    </div>
                  </div>
                  {entry.pages_viewed && entry.pages_viewed.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-500">
                        Viewed: {entry.pages_viewed.map(p => p.replace('_', ' ')).join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              ))}

              <div className="text-center pt-2">
                <p className="text-xs text-gray-400">
                  Showing the last {accessLog.length} access{accessLog.length === 1 ? '' : 'es'}
                </p>
              </div>
            </>
          )}

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Security Tip:</strong> If you see any access you don't recognize,
              change your caregiver PIN immediately in the settings above.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaregiverAccessHistory;
