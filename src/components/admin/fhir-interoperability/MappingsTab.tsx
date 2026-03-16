/**
 * MappingsTab — Patient mapping table for a selected connection
 */

import React from 'react';
import type { FHIRConnection } from '../../../services/fhirInteroperabilityIntegrator';
import type { PatientMapping } from '../../../hooks/useFHIRIntegration';

interface MappingsTabProps {
  connection: FHIRConnection;
  mappings: PatientMapping[];
  loading: boolean;
}

export const MappingsTab: React.FC<MappingsTabProps> = ({ connection, mappings, loading }) => {
  if (loading) return <div className="text-center py-12">Loading...</div>;

  return (
    <div className="bg-white rounded-lg shadow-xs border border-gray-200" aria-label="Patient Mappings">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold">Patient Mappings for {connection.name}</h2>
        <p className="text-gray-600 mt-1">{mappings.length} patients mapped</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full" aria-label="Patient mappings list">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Community User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">FHIR Patient ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Synced</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {mappings.map((mapping: PatientMapping) => (
              <tr key={mapping.communityUserId} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm">{mapping.communityUserId}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">{mapping.fhirPatientId}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">mapped</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {mapping.updatedAt ? new Date(mapping.updatedAt).toLocaleString() : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
