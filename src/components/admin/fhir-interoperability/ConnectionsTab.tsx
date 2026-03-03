/**
 * ConnectionsTab — Connection list with test/manage/delete actions
 */

import React from 'react';
import { Check, X } from 'lucide-react';
import type { FHIRConnection } from '../../../services/fhirInteroperabilityIntegrator';

interface ConnectionsTabProps {
  connections: FHIRConnection[];
  loading: boolean;
  onTest: (id: string) => void;
  onDelete: (id: string) => void;
  onSelect: (conn: FHIRConnection) => void;
}

export const ConnectionsTab: React.FC<ConnectionsTabProps> = ({
  connections,
  loading,
  onTest,
  onDelete,
  onSelect,
}) => {
  if (loading) return <div className="text-center py-12">Loading...</div>;

  return (
    <div className="bg-white rounded-lg shadow-xs border border-gray-200">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">EHR System</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sync Frequency</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Sync</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {connections.map(conn => (
              <tr key={conn.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{conn.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{conn.ehrSystem}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    conn.status === 'active' ? 'bg-green-100 text-green-800' :
                    conn.status === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {conn.status === 'active' && <Check className="w-3 h-3" />}
                    {conn.status === 'error' && <X className="w-3 h-3" />}
                    {conn.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{conn.syncFrequency}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {conn.lastSync ? new Date(conn.lastSync).toLocaleString() : 'Never'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <button onClick={() => onTest(conn.id)} className="text-blue-600 hover:text-blue-900">Test</button>
                  <button onClick={() => onSelect(conn)} className="text-green-600 hover:text-green-900">Manage</button>
                  <button onClick={() => onDelete(conn.id)} className="text-red-600 hover:text-red-900">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
