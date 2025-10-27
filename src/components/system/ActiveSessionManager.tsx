/**
 * Active Session Manager Component
 *
 * Monitor and manage active user sessions with the ability to revoke/terminate sessions.
 * Critical for security incident response and user account management.
 */

import React, { useState, useEffect } from 'react';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { Alert, AlertDescription } from '../ui/alert';
import { Power, RefreshCw, Monitor, Smartphone, Tablet, Clock } from 'lucide-react';

interface Session {
  id: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  device_type: string;
  browser: string;
  os: string;
  ip_address?: string;
  session_start: string;
  last_activity?: string;
  location?: string;
}

const ActiveSessionManager: React.FC = () => {
  const supabase = useSupabaseClient();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadSessions(true);
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const loadSessions = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setMessage(null);

      // Load active sessions from last 24 hours
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('user_sessions')
        .select('*, profiles(email, full_name)')
        .gte('session_start', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .is('session_end', null)
        .order('session_start', { ascending: false });

      if (sessionsError) throw sessionsError;

      const formattedSessions: Session[] = (sessionsData || []).map((session: any) => ({
        id: session.id,
        user_id: session.user_id,
        user_email: session.profiles?.email,
        user_name: session.profiles?.full_name,
        device_type: session.device_type || 'unknown',
        browser: session.browser || 'unknown',
        os: session.os || 'unknown',
        ip_address: session.ip_address,
        session_start: session.session_start,
        last_activity: session.last_activity,
        location: session.location
      }));

      setSessions(formattedSessions);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error loading sessions:', error);
      if (!silent) {
        setMessage({ type: 'error', text: 'Failed to load active sessions' });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const revokeSession = async (sessionId: string, userEmail: string) => {
    if (!window.confirm(`Are you sure you want to terminate the session for ${userEmail}? This will immediately log them out.`)) {
      return;
    }

    try {
      setActionLoading(sessionId);
      setMessage(null);

      // Update session to mark it as ended
      const { error } = await supabase
        .from('user_sessions')
        .update({ session_end: new Date().toISOString() })
        .eq('id', sessionId);

      if (error) throw error;

      setMessage({
        type: 'success',
        text: `Successfully terminated session for ${userEmail}`
      });

      await loadSessions(true);
    } catch (error: any) {
      console.error('Error revoking session:', error);
      setMessage({
        type: 'error',
        text: error.message || 'Failed to revoke session'
      });
    } finally {
      setActionLoading(null);
    }
  };

  const revokeAllUserSessions = async (userId: string, userEmail: string) => {
    if (!window.confirm(`Are you sure you want to terminate ALL sessions for ${userEmail}? This will log them out of all devices.`)) {
      return;
    }

    try {
      setActionLoading(userId);
      setMessage(null);

      // End all active sessions for this user
      const { error } = await supabase
        .from('user_sessions')
        .update({ session_end: new Date().toISOString() })
        .eq('user_id', userId)
        .is('session_end', null);

      if (error) throw error;

      setMessage({
        type: 'success',
        text: `Successfully terminated all sessions for ${userEmail}`
      });

      await loadSessions(true);
    } catch (error: any) {
      console.error('Error revoking all sessions:', error);
      setMessage({
        type: 'error',
        text: error.message || 'Failed to revoke sessions'
      });
    } finally {
      setActionLoading(null);
    }
  };

  const formatDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h`;
    if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m`;
    return `${diffMins}m`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleTimeString();
  };

  const getDeviceIcon = (deviceType: string) => {
    const type = deviceType.toLowerCase();
    if (type.includes('mobile') || type.includes('phone')) return <Smartphone className="w-5 h-5" />;
    if (type.includes('tablet')) return <Tablet className="w-5 h-5" />;
    return <Monitor className="w-5 h-5" />;
  };

  const groupSessionsByUser = () => {
    const grouped: { [userId: string]: { user: { id: string; email: string; name?: string }; sessions: Session[] } } = {};

    sessions.forEach(session => {
      if (!grouped[session.user_id]) {
        grouped[session.user_id] = {
          user: {
            id: session.user_id,
            email: session.user_email || 'Unknown',
            name: session.user_name
          },
          sessions: []
        };
      }
      grouped[session.user_id].sessions.push(session);
    });

    return Object.values(grouped);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1BA39C] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading active sessions...</p>
        </div>
      </div>
    );
  }

  const userGroups = groupSessionsByUser();

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-black">Active Sessions Monitor</h3>
          <p className="text-sm text-gray-600">
            Last updated: {lastRefresh.toLocaleTimeString()} • {sessions.length} active sessions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300"
            />
            Auto-refresh (30s)
          </label>
          <button
            onClick={() => loadSessions()}
            className="px-4 py-2 bg-[#1BA39C] hover:bg-[#158A84] text-white font-bold rounded-lg transition-all shadow-md hover:shadow-lg border-2 border-black flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Now
          </button>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <Alert className={message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
          <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border-2 border-black shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-[#1BA39C]">{sessions.length}</div>
              <div className="text-xs text-gray-600 font-semibold">Active Sessions</div>
            </div>
            <Clock className="w-8 h-8 text-[#1BA39C]" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border-2 border-black shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-blue-600">{userGroups.length}</div>
              <div className="text-xs text-gray-600 font-semibold">Active Users</div>
            </div>
            <Monitor className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border-2 border-black shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {sessions.filter(s => s.device_type?.toLowerCase().includes('mobile')).length}
              </div>
              <div className="text-xs text-gray-600 font-semibold">Mobile Sessions</div>
            </div>
            <Smartphone className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border-2 border-black shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {sessions.filter(s => !s.device_type?.toLowerCase().includes('mobile')).length}
              </div>
              <div className="text-xs text-gray-600 font-semibold">Desktop Sessions</div>
            </div>
            <Monitor className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Sessions by User */}
      {userGroups.length === 0 ? (
        <div className="bg-white rounded-lg p-12 border-2 border-black text-center">
          <p className="text-gray-500 text-lg">No active sessions found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {userGroups.map(({ user, sessions: userSessions }) => (
            <div key={user.id} className="bg-white rounded-lg border-2 border-black shadow-lg overflow-hidden">
              <div className="bg-[#E8F8F7] px-6 py-4 border-b-2 border-black flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-black">{user.name || user.email}</h4>
                  <p className="text-sm text-gray-600">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-[#1BA39C] text-white text-xs font-bold rounded-full border border-black">
                    {userSessions.length} {userSessions.length === 1 ? 'session' : 'sessions'}
                  </span>
                  <button
                    onClick={() => revokeAllUserSessions(user.id, user.email)}
                    disabled={actionLoading === user.id}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-all border-2 border-black disabled:opacity-50 flex items-center gap-2"
                  >
                    <Power className="w-4 h-4" />
                    {actionLoading === user.id ? 'Revoking...' : 'Revoke All'}
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="space-y-3">
                  {userSessions.map(session => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-[#1BA39C] transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-gray-600">
                          {getDeviceIcon(session.device_type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 capitalize">{session.device_type}</span>
                            <span className="text-gray-400">•</span>
                            <span className="text-sm text-gray-600">{session.browser}</span>
                            <span className="text-gray-400">•</span>
                            <span className="text-sm text-gray-600">{session.os}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span>Started: {formatTimestamp(session.session_start)}</span>
                            <span className="text-gray-400">•</span>
                            <span>Duration: {formatDuration(session.session_start)}</span>
                            {session.ip_address && (
                              <>
                                <span className="text-gray-400">•</span>
                                <span>IP: {session.ip_address}</span>
                              </>
                            )}
                            {session.last_activity && (
                              <>
                                <span className="text-gray-400">•</span>
                                <span>Last seen: {formatTimestamp(session.last_activity)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => revokeSession(session.id, user.email)}
                        disabled={actionLoading === session.id}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold rounded border border-red-300 transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        <Power className="w-3 h-3" />
                        {actionLoading === session.id ? 'Revoking...' : 'Revoke'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActiveSessionManager;
