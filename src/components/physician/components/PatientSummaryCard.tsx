/**
 * Patient Summary Card Component
 * Displays patient demographics, vitals, and clinical summary
 */

import React from 'react';
import { Users, Award, DollarSign } from 'lucide-react';
import type { PatientSummary } from './types';

interface PatientSummaryCardProps {
  summary: PatientSummary | null;
  loading: boolean;
}

export const PatientSummaryCard: React.FC<PatientSummaryCardProps> = ({ summary, loading }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 p-8 text-center">
        <Users className="w-16 h-16 mx-auto text-gray-400 mb-3" />
        <p className="text-gray-600 font-medium">No patient selected</p>
        <p className="text-sm text-gray-500 mt-1">Select a patient to view their health summary</p>
      </div>
    );
  }

  const { demographics, vitals, activeConditions, activeMedications, sdohComplexity, ccmEligible, revenueOpportunity } = summary;

  return (
    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-xl p-6 text-white">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">
            {demographics.last_name}, {demographics.first_name}
          </h2>
          <p className="text-blue-100 mt-1">
            DOB: {new Date(demographics.dob).toLocaleDateString()} •{' '}
            Age: {new Date().getFullYear() - new Date(demographics.dob).getFullYear()}
          </p>
        </div>
        {ccmEligible && (
          <div className="bg-amber-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
            <Award className="w-4 h-4" />
            CCM Eligible
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-white bg-opacity-20 rounded-lg p-3">
          <div className="text-xs text-blue-100">Blood Pressure</div>
          <div className="text-lg font-bold">{vitals.bloodPressure || 'N/A'}</div>
        </div>
        <div className="bg-white bg-opacity-20 rounded-lg p-3">
          <div className="text-xs text-blue-100">Heart Rate</div>
          <div className="text-lg font-bold">{vitals.heartRate ? `${vitals.heartRate} bpm` : 'N/A'}</div>
        </div>
        <div className="bg-white bg-opacity-20 rounded-lg p-3">
          <div className="text-xs text-blue-100">O₂ Saturation</div>
          <div className="text-lg font-bold">{vitals.oxygenSaturation ? `${vitals.oxygenSaturation}%` : 'N/A'}</div>
        </div>
        <div className="bg-white bg-opacity-20 rounded-lg p-3">
          <div className="text-xs text-blue-100">Weight</div>
          <div className="text-lg font-bold">{vitals.weight ? `${vitals.weight} lbs` : 'N/A'}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white bg-opacity-10 rounded p-2 text-center">
          <div className="text-xs text-blue-100">Active Conditions</div>
          <div className="text-xl font-bold">{activeConditions}</div>
        </div>
        <div className="bg-white bg-opacity-10 rounded p-2 text-center">
          <div className="text-xs text-blue-100">Active Medications</div>
          <div className="text-xl font-bold">{activeMedications}</div>
        </div>
        <div className="bg-white bg-opacity-10 rounded p-2 text-center">
          <div className="text-xs text-blue-100">SDOH Complexity</div>
          <div className="text-xl font-bold">{sdohComplexity}/10</div>
        </div>
      </div>

      {revenueOpportunity > 0 && (
        <div className="mt-4 bg-amber-500 bg-opacity-30 border border-amber-400 rounded-lg p-3 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-amber-200" />
          <div className="text-sm">
            <span className="font-semibold">Revenue Opportunity:</span>{' '}
            <span className="text-amber-200 font-bold">${revenueOpportunity.toLocaleString()}</span>
            {' '}in unbilled codes detected
          </div>
        </div>
      )}
    </div>
  );
};
