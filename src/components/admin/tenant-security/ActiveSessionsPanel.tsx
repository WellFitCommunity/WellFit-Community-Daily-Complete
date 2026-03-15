/**
 * ActiveSessionsPanel — Shows active user sessions with force-logout capability
 *
 * Purpose: Session management for tenant administrators
 * Used by: TenantSecurityDashboard
 */

import React, { useState } from 'react';
import { Users, RefreshCw, LogOut, Clock } from 'lucide-react';
import { EABadge } from '../../envision-atlus';
import type { ActiveSessionsPanelProps } from './types';

const formatLastActive = (ts: string | null): string => {
  if (!ts) return 'Never';
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return ts;
  }
};

export const ActiveSessionsPanel: React.FC<ActiveSessionsPanelProps> = ({
  sessions,
  loading,
  onForceLogout,
  onRefresh,
}) => {
  const [confirmLogoutId, setConfirmLogoutId] = useState<string | null>(null);

  const activeSessions = sessions.filter(s => s.is_active);
  const inactiveSessions = sessions.filter(s => !s.is_active);

  const handleForceLogout = (userId: string) => {
    onForceLogout(userId);
    setConfirmLogoutId(null);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[var(--ea-primary)]" />
          <h3 className="text-base font-semibold text-gray-900">Active Sessions</h3>
          <EABadge variant="normal" size="sm">{activeSessions.length} active</EABadge>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1 text-gray-400 hover:text-gray-600"
          title="Refresh sessions"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center p-6 text-gray-500">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading sessions...
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No session data available</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-3 py-2 font-medium text-gray-600">User</th>
                <th className="px-3 py-2 font-medium text-gray-600">Status</th>
                <th className="px-3 py-2 font-medium text-gray-600">Last Active</th>
                <th className="px-3 py-2 font-medium text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* Active sessions first */}
              {activeSessions.map(session => (
                <tr key={session.user_id} className="bg-green-50/30">
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">
                      {session.first_name} {session.last_name}
                    </div>
                    <div className="text-xs text-gray-500">{session.email || 'No email'}</div>
                  </td>
                  <td className="px-3 py-2">
                    <EABadge variant="normal" size="sm">Active</EABadge>
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs">
                    {formatLastActive(session.last_sign_in_at)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {confirmLogoutId === session.user_id ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleForceLogout(session.user_id)}
                          className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmLogoutId(null)}
                          className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmLogoutId(session.user_id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Force logout"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {/* Inactive sessions */}
              {inactiveSessions.slice(0, 10).map(session => (
                <tr key={session.user_id}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-700">
                      {session.first_name} {session.last_name}
                    </div>
                    <div className="text-xs text-gray-400">{session.email || 'No email'}</div>
                  </td>
                  <td className="px-3 py-2">
                    <EABadge variant="neutral" size="sm">Inactive</EABadge>
                  </td>
                  <td className="px-3 py-2 text-gray-400 text-xs">
                    {formatLastActive(session.last_sign_in_at)}
                  </td>
                  <td className="px-3 py-2" />
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {inactiveSessions.length > 10 && (
        <div className="px-3 py-2 text-xs text-gray-400 border-t border-gray-100">
          Showing 10 of {inactiveSessions.length} inactive sessions
        </div>
      )}
    </div>
  );
};
