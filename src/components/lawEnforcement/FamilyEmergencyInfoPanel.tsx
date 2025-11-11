/**
 * Family Emergency Info Panel
 *
 * Allows family members to view and update emergency response information
 * for their senior loved one
 */

import React, { useState } from 'react';
import { SeniorEmergencyInfoForm } from './SeniorEmergencyInfoForm';

interface FamilyEmergencyInfoPanelProps {
  patientId: string;
  patientName: string;
}

export const FamilyEmergencyInfoPanel: React.FC<FamilyEmergencyInfoPanelProps> = ({
  patientId,
  patientName
}) => {
  const [editing, setEditing] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Emergency Response Information
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            For {patientName} - Keep this information current to help first responders
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Update Information
          </button>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <svg className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Why is this important?</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Helps constables respond safely during welfare checks</li>
              <li>Provides critical medical information for emergencies</li>
              <li>Enables faster entry if your loved one can't answer the door</li>
              <li>Keeps family contacts current for notifications</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Form */}
      <SeniorEmergencyInfoForm
        patientId={patientId}
        onSave={() => {
          setEditing(false);
          // Optional: Show success toast
        }}
        readOnly={!editing}
      />

      {editing && (
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setEditing(false)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default FamilyEmergencyInfoPanel;
