/**
 * ActiveSessionsPanel — Monitor and terminate active user sessions
 */

import React, { useState } from 'react';
import { Users, Activity, Clock, XCircle, Wifi, HardDrive } from 'lucide-react';
import type { ActiveSession } from './TenantITDashboard.types';

export const ActiveSessionsPanel: React.FC = () => {
  const [sessions] = useState<ActiveSession[]>([
    {
      id: '1',
      user_id: '1',
      user_email: 'dr.smith@clinic.org',
      ip_address: '192.168.1.100',
      device_info: 'Chrome on Windows',
      location: 'New York, NY',
      started_at: '2025-01-25T14:30:00Z',
      last_activity: '2025-01-25T15:45:00Z'
    },
    {
      id: '2',
      user_id: '3',
      user_email: 'admin@clinic.org',
      ip_address: '192.168.1.105',
      device_info: 'Safari on macOS',
      location: 'Boston, MA',
      started_at: '2025-01-25T09:15:00Z',
      last_activity: '2025-01-25T15:40:00Z'
    }
  ]);

  const handleTerminateSession = (sessionId: string) => {
    alert(`Session ${sessionId} terminated`);
  };

  const handleTerminateAllSessions = () => {
    if (window.confirm('Are you sure you want to terminate ALL active sessions? Users will need to log in again.')) {
      alert('All sessions terminated');
    }
  };

  return (
    <div className="space-y-6">
      {/* Session Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-[#C8E63D] p-3 rounded-lg border-2 border-black">
            <Activity className="w-6 h-6 text-black" />
          </div>
          <div>
            <p className="text-2xl font-bold text-black">{sessions.length} Active Sessions</p>
            <p className="text-sm text-gray-600">Currently logged in users</p>
          </div>
        </div>
        <button
          onClick={handleTerminateAllSessions}
          className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded-lg border-2 border-red-300 transition-all flex items-center gap-2"
        >
          <XCircle className="w-5 h-5" />
          Terminate All Sessions
        </button>
      </div>

      {/* Sessions List */}
      <div className="space-y-4">
        {sessions.map(session => (
          <div key={session.id} className="bg-white p-4 rounded-lg border-2 border-black hover:border-[#1BA39C] transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#E8F8F7] rounded-full flex items-center justify-center border-2 border-[#1BA39C]">
                  <Users className="w-6 h-6 text-[#1BA39C]" />
                </div>
                <div>
                  <p className="font-bold text-black">{session.user_email}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Wifi className="w-4 h-4" />
                      {session.ip_address}
                    </span>
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-4 h-4" />
                      {session.device_info}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Last active: {new Date(session.last_activity).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleTerminateSession(session.id)}
                className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded-lg border border-red-300 transition-all"
              >
                Terminate
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
