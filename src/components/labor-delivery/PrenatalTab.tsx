/**
 * PrenatalTab - Prenatal visits display + form for recording new visits
 *
 * Purpose: Shows visit history table + "Record Visit" button that opens form
 * Used by: LaborDeliveryDashboard
 */

import React, { useState } from 'react';
import type { LDDashboardSummary } from '../../types/laborDelivery';
import PrenatalVisitForm from './PrenatalVisitForm';
import LDGuidelineCompliancePanel from './LDGuidelineCompliancePanel';
import LDSDOHPanel from './LDSDOHPanel';

interface PrenatalTabProps {
  summary: LDDashboardSummary;
  onDataChange: () => void;
}

const PrenatalTab: React.FC<PrenatalTabProps> = ({ summary, onDataChange }) => {
  const [showForm, setShowForm] = useState(false);
  const visits = summary.recent_prenatal_visits;
  const pregnancy = summary.pregnancy;

  const handleSuccess = () => {
    setShowForm(false);
    onDataChange();
  };

  return (
    <div className="space-y-4">
      {/* Add Visit Button */}
      {pregnancy && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-pink-600 text-white px-4 py-2 rounded font-medium min-h-[44px] hover:bg-pink-700"
          >
            {showForm ? 'Close Form' : 'Record Visit'}
          </button>
        </div>
      )}

      {/* Form */}
      {showForm && pregnancy && (
        <PrenatalVisitForm
          patientId={pregnancy.patient_id}
          tenantId={pregnancy.tenant_id}
          pregnancyId={pregnancy.id}
          onSuccess={handleSuccess}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* AI Panels — Guideline Compliance + SDOH Detection */}
      {pregnancy && (
        <LDGuidelineCompliancePanel
          patientId={pregnancy.patient_id}
          tenantId={pregnancy.tenant_id}
        />
      )}
      {pregnancy && visits.length > 0 && visits[0].notes && (
        <LDSDOHPanel
          patientId={pregnancy.patient_id}
          tenantId={pregnancy.tenant_id}
          noteText={[visits[0].notes, ...visits[0].complaints].filter(Boolean).join('. ')}
          sourceId={visits[0].id}
        />
      )}

      {/* Visit History Table */}
      {visits.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No prenatal visits recorded</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">GA</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">BP</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">FHR</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Weight</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Fundal Ht</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {visits.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-3 text-sm">{new Date(v.visit_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm">{v.gestational_age_weeks}w{v.gestational_age_days}d</td>
                  <td className="px-4 py-3 text-sm">{v.bp_systolic}/{v.bp_diastolic}</td>
                  <td className="px-4 py-3 text-sm">{v.fetal_heart_rate ?? 'N/A'}</td>
                  <td className="px-4 py-3 text-sm">{v.weight_kg} kg</td>
                  <td className="px-4 py-3 text-sm">{v.fundal_height_cm ? `${v.fundal_height_cm} cm` : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PrenatalTab;
