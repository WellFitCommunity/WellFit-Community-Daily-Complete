/**
 * AuditLogPanel — View and export tenant-scoped audit logs
 */

import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import type { AuditLogEntry } from './TenantITDashboard.types';

export const AuditLogPanel: React.FC = () => {
  const [filter, setFilter] = useState('all');
  const [auditLogs] = useState<AuditLogEntry[]>([
    {
      id: '1',
      timestamp: '2025-01-25T15:45:00Z',
      user_email: 'admin@clinic.org',
      action: 'USER_LOGIN',
      resource: 'auth/session',
      ip_address: '192.168.1.105',
      status: 'success',
      details: 'Successful login via SSO'
    },
    {
      id: '2',
      timestamp: '2025-01-25T15:30:00Z',
      user_email: 'nurse.jones@clinic.org',
      action: 'USER_LOGIN',
      resource: 'auth/session',
      ip_address: '192.168.1.110',
      status: 'failure',
      details: 'Failed login - Invalid password (attempt 5/5)'
    },
    {
      id: '3',
      timestamp: '2025-01-25T14:30:00Z',
      user_email: 'dr.smith@clinic.org',
      action: 'PATIENT_VIEW',
      resource: 'patients/12345',
      ip_address: '192.168.1.100',
      status: 'success',
      details: 'Viewed patient record'
    },
    {
      id: '4',
      timestamp: '2025-01-25T14:15:00Z',
      user_email: 'dr.smith@clinic.org',
      action: 'API_KEY_CREATE',
      resource: 'api-keys',
      ip_address: '192.168.1.100',
      status: 'success',
      details: 'Created new API key: EHR Integration'
    }
  ]);

  const filteredLogs = filter === 'all' ? auditLogs : auditLogs.filter(log => log.status === filter);

  const handleExportLogs = () => {
    alert('Exporting audit logs to CSV...');
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-bold transition-all border-2 ${filter === 'all' ? 'bg-[#2D3339] text-white border-black' : 'bg-white text-black border-black/20 hover:border-[#1BA39C]'}`}
          >
            All Events
          </button>
          <button
            onClick={() => setFilter('success')}
            className={`px-4 py-2 rounded-lg font-bold transition-all border-2 ${filter === 'success' ? 'bg-green-600 text-white border-green-800' : 'bg-white text-black border-black/20 hover:border-green-500'}`}
          >
            Success
          </button>
          <button
            onClick={() => setFilter('failure')}
            className={`px-4 py-2 rounded-lg font-bold transition-all border-2 ${filter === 'failure' ? 'bg-red-600 text-white border-red-800' : 'bg-white text-black border-black/20 hover:border-red-500'}`}
          >
            Failures
          </button>
        </div>
        <button
          onClick={handleExportLogs}
          className="px-4 py-2 bg-[#1BA39C] hover:bg-[#158A84] text-white font-bold rounded-lg border-2 border-black transition-all flex items-center gap-2"
        >
          <Download className="w-5 h-5" />
          Export CSV
        </button>
      </div>

      {/* Audit Log Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#2D3339] text-white">
              <th className="px-4 py-3 text-left font-bold">Timestamp</th>
              <th className="px-4 py-3 text-left font-bold">User</th>
              <th className="px-4 py-3 text-left font-bold">Action</th>
              <th className="px-4 py-3 text-left font-bold">Resource</th>
              <th className="px-4 py-3 text-left font-bold">IP Address</th>
              <th className="px-4 py-3 text-left font-bold">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log, idx) => (
              <tr key={log.id} className={`border-b-2 border-black/10 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FFFE]'} hover:bg-[#E8F8F7] transition-all`}>
                <td className="px-4 py-3 text-sm">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-medium">{log.user_email}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 font-bold rounded-sm text-sm">
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-gray-600">{log.resource}</td>
                <td className="px-4 py-3 text-sm font-mono">{log.ip_address}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={log.status} size="sm" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
