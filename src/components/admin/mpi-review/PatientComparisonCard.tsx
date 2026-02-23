/**
 * PatientComparisonCard — Side-by-side patient field comparison grid
 *
 * @module mpi-review/PatientComparisonCard
 * Copyright © 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import type { PatientInfo } from './types';

interface PatientComparisonCardProps {
  patientA: PatientInfo | undefined;
  patientB: PatientInfo | undefined;
  fieldScores: Record<string, number>;
}

const PatientComparisonCard: React.FC<PatientComparisonCardProps> = ({
  patientA,
  patientB,
  fieldScores,
}) => {
  const fields = [
    { key: 'first_name', label: 'First Name', aValue: patientA?.first_name, bValue: patientB?.first_name },
    { key: 'last_name', label: 'Last Name', aValue: patientA?.last_name, bValue: patientB?.last_name },
    { key: 'date_of_birth', label: 'Date of Birth', aValue: patientA?.dob, bValue: patientB?.dob },
    { key: 'phone', label: 'Phone', aValue: patientA?.phone, bValue: patientB?.phone },
    { key: 'mrn', label: 'MRN', aValue: patientA?.mrn, bValue: patientB?.mrn },
    { key: 'address', label: 'Address', aValue: patientA?.address, bValue: patientB?.address },
    { key: 'gender', label: 'Gender', aValue: patientA?.gender, bValue: patientB?.gender },
  ];

  const getMatchIndicator = (fieldKey: string, aVal: string | null | undefined, bVal: string | null | undefined) => {
    const score = fieldScores[fieldKey];
    if (score !== undefined) {
      if (score >= 95) return <CheckCircle className="w-4 h-4 text-green-500" />;
      if (score >= 80) return <div className="w-4 h-4 rounded-full bg-yellow-400" />;
      return <XCircle className="w-4 h-4 text-red-400" />;
    }
    if (aVal && bVal && aVal.toLowerCase() === bVal.toLowerCase()) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    return <div className="w-4 h-4" />;
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-[1fr,auto,1fr] bg-gray-50 border-b">
        <div className="p-3 font-medium text-gray-700 text-center">Patient A</div>
        <div className="p-3 font-medium text-gray-500 text-center border-x bg-white">Match</div>
        <div className="p-3 font-medium text-gray-700 text-center">Patient B</div>
      </div>
      {fields.map((field) => (
        <div key={field.key} className="grid grid-cols-[1fr,auto,1fr] border-b last:border-b-0">
          <div className="p-3 text-sm">
            <div className="text-xs text-gray-500">{field.label}</div>
            <div className="font-medium text-gray-800">{field.aValue || '—'}</div>
          </div>
          <div className="p-3 flex items-center justify-center border-x bg-gray-50 w-16">
            {getMatchIndicator(field.key, field.aValue, field.bValue)}
          </div>
          <div className="p-3 text-sm">
            <div className="text-xs text-gray-500">{field.label}</div>
            <div className="font-medium text-gray-800">{field.bValue || '—'}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PatientComparisonCard;
