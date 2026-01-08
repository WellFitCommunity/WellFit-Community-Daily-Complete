/**
 * ConsentAuditLog - Patient Data Access Audit Trail
 *
 * Displays a log of who has accessed the patient's health data,
 * when, and what data was accessed.
 *
 * Compliance: HIPAA Audit Requirements, 21st Century Cures Act
 */

import React, { useState, useEffect } from 'react';
import { History, Eye, Download, Smartphone, User, Filter, ChevronDown, ChevronUp } from 'lucide-react';

interface ConsentAuditLogProps {
  userId: string;
  onCountUpdate?: (count: number) => void;
}

interface AuditEntry {
  id: string;
  event_type: string;
  app_name?: string;
  resource_type?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

// Raw database entry shape before transformation
// Note: Supabase can return joined relations as object or array depending on relationship type
interface RawAuditEntry {
  id: string;
  event_type: string;
  app?: { client_name?: string } | Array<{ client_name?: string }>;
  resource_type?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

type FilterType = 'all' | 'app_access' | 'data_export' | 'consent_changes';

const ConsentAuditLog: React.FC<ConsentAuditLogProps> = ({ userId, onCountUpdate }) => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    loadAuditLog();
  }, [userId, filter, limit]);

  const loadAuditLog = async () => {
    setLoading(true);
    try {
      const { supabase } = await import('../../../lib/supabaseClient');

      // Build query based on filter
      let query = supabase
        .from('smart_audit_log')
        .select(`
          id,
          event_type,
          resource_type,
          details,
          ip_address,
          created_at,
          app:smart_registered_apps(client_name)
        `)
        .eq('patient_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      // Apply filters
      if (filter === 'app_access') {
        query = query.in('event_type', ['resource_accessed', 'token_issued']);
      } else if (filter === 'data_export') {
        query = query.eq('event_type', 'resource_accessed');
      } else if (filter === 'consent_changes') {
        query = query.in('event_type', ['authorization_granted', 'authorization_revoked']);
      }

      const { data, error } = await query;

      if (!error && data) {
        const mappedEntries = data.map((entry: RawAuditEntry) => ({
          id: entry.id,
          event_type: entry.event_type,
          app_name: Array.isArray(entry.app) ? entry.app[0]?.client_name : entry.app?.client_name,
          resource_type: entry.resource_type,
          details: entry.details,
          ip_address: entry.ip_address,
          created_at: entry.created_at,
        }));

        setEntries(mappedEntries);
        onCountUpdate?.(mappedEntries.length);
      }
    } catch (err: unknown) {
      // Silent fail - will show empty state
    }
    setLoading(false);
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'resource_accessed':
        return <Eye className="w-4 h-4 text-blue-600" />;
      case 'token_issued':
      case 'token_refreshed':
        return <Smartphone className="w-4 h-4 text-green-600" />;
      case 'authorization_granted':
        return <User className="w-4 h-4 text-green-600" />;
      case 'authorization_revoked':
        return <User className="w-4 h-4 text-red-600" />;
      default:
        return <History className="w-4 h-4 text-gray-600" />;
    }
  };

  const getEventDescription = (entry: AuditEntry): string => {
    switch (entry.event_type) {
      case 'resource_accessed':
        return `${entry.app_name || 'App'} accessed ${entry.resource_type || 'your data'}`;
      case 'token_issued':
        return `${entry.app_name || 'App'} was granted access`;
      case 'token_refreshed':
        return `${entry.app_name || 'App'} renewed access`;
      case 'authorization_granted':
        return `You authorized ${entry.app_name || 'an app'}`;
      case 'authorization_revoked':
        return `You revoked access for ${entry.app_name || 'an app'}`;
      case 'authorization_denied':
        return `Access denied for ${entry.app_name || 'an app'}`;
      default:
        return entry.event_type.replace(/_/g, ' ');
    }
  };

  const getEventColor = (eventType: string): string => {
    switch (eventType) {
      case 'resource_accessed':
        return 'border-l-blue-500';
      case 'authorization_granted':
      case 'token_issued':
        return 'border-l-green-500';
      case 'authorization_revoked':
      case 'authorization_denied':
        return 'border-l-red-500';
      default:
        return 'border-l-gray-300';
    }
  };

  const filters: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'All Activity' },
    { id: 'app_access', label: 'App Access' },
    { id: 'data_export', label: 'Data Views' },
    { id: 'consent_changes', label: 'Consent Changes' },
  ];

  if (loading && entries.length === 0) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-16 bg-gray-200 rounded-lg"></div>
        <div className="h-16 bg-gray-200 rounded-lg"></div>
        <div className="h-16 bg-gray-200 rounded-lg"></div>
        <div className="h-16 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <History className="w-5 h-5 mr-2 text-gray-500" />
          Access History
        </h3>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 text-sm ${
                  filter === f.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12">
          <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Access History</h3>
          <p className="text-gray-600">
            {filter === 'all'
              ? 'No one has accessed your health data yet.'
              : `No ${filter.replace('_', ' ')} events found.`}
          </p>
        </div>
      ) : (
        <>
          {/* Audit entries */}
          <div className="space-y-2">
            {entries.map((entry) => {
              const { date, time } = formatDateTime(entry.created_at);
              const isExpanded = expandedEntry === entry.id;

              return (
                <div
                  key={entry.id}
                  className={`border-l-4 ${getEventColor(entry.event_type)} bg-white rounded-r-lg shadow-sm`}
                >
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start">
                        <div className="mr-3 mt-0.5">
                          {getEventIcon(entry.event_type)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {getEventDescription(entry)}
                          </p>
                          {entry.resource_type && (
                            <p className="text-sm text-gray-600 mt-0.5">
                              Resource: {entry.resource_type}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <span className="mr-2">{date} at {time}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {entry.app_name && (
                          <div>
                            <span className="text-gray-500">App:</span>
                            <span className="ml-2 text-gray-900">{entry.app_name}</span>
                          </div>
                        )}
                        {entry.ip_address && (
                          <div>
                            <span className="text-gray-500">IP Address:</span>
                            <span className="ml-2 text-gray-900 font-mono text-xs">
                              {entry.ip_address}
                            </span>
                          </div>
                        )}
                        {entry.details && Object.keys(entry.details).length > 0 && (
                          <div className="col-span-2">
                            <span className="text-gray-500">Details:</span>
                            <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-auto">
                              {JSON.stringify(entry.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Load more */}
          {entries.length >= limit && (
            <div className="text-center pt-4">
              <button
                onClick={() => setLimit((prev) => prev + 20)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Load more entries
              </button>
            </div>
          )}
        </>
      )}

      {/* Export option */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <button
          onClick={() => {
            // Export audit log as JSON
            const dataStr = JSON.stringify(entries, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `access-history-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
          className="flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <Download className="w-4 h-4 mr-2" />
          Export access history
        </button>
      </div>
    </div>
  );
};

export default ConsentAuditLog;
