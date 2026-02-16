/**
 * PostpartumTab - Postpartum assessment display + form
 *
 * Purpose: Shows postpartum vitals, fundus, lochia, breastfeeding, emotional status
 * Used by: LaborDeliveryDashboard
 */

import React, { useState } from 'react';
import type { LDDashboardSummary } from '../../types/laborDelivery';
import PostpartumAssessmentForm from './PostpartumAssessmentForm';

interface PostpartumTabProps {
  summary: LDDashboardSummary;
  onDataChange: () => void;
}

const PostpartumTab: React.FC<PostpartumTabProps> = ({ summary, onDataChange }) => {
  const [showForm, setShowForm] = useState(false);
  const pp = summary.latest_postpartum;
  const { pregnancy, delivery_record } = summary;

  const handleSuccess = () => {
    setShowForm(false);
    onDataChange();
  };

  return (
    <div className="space-y-6">
      {/* Record Button - available after delivery */}
      {pregnancy && delivery_record && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-pink-600 text-white px-4 py-2 rounded font-medium min-h-[44px] hover:bg-pink-700"
          >
            {showForm ? 'Close' : 'Record Postpartum Assessment'}
          </button>
        </div>
      )}

      {/* Form */}
      {showForm && pregnancy && (
        <PostpartumAssessmentForm
          patientId={pregnancy.patient_id}
          tenantId={pregnancy.tenant_id}
          pregnancyId={pregnancy.id}
          onSuccess={handleSuccess}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Display */}
      {pp ? (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h3 className="text-lg font-semibold">Postpartum Assessment</h3>
          <p className="text-xs text-gray-500">{pp.hours_postpartum} hours postpartum</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">BP</p>
              <p className="text-xl font-bold">{pp.bp_systolic}/{pp.bp_diastolic}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Fundus</p>
              <p className="text-base font-medium">{pp.fundal_height} / {pp.fundal_firmness}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Lochia</p>
              <p className="text-base font-medium">{pp.lochia} ({pp.lochia_amount})</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Breastfeeding</p>
              <p className="text-base font-medium">{pp.breastfeeding_status.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
            <div>
              <p className="text-sm text-gray-500">Pain</p>
              <p className="text-base font-medium">{pp.pain_score}/10</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Emotional Status</p>
              <p className="text-base font-medium">{pp.emotional_status.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">EPDS</p>
              <p className={`text-base font-bold ${
                pp.epds_score !== null && pp.epds_score >= 13 ? 'text-red-600' : 'text-gray-900'
              }`}>
                {pp.epds_score ?? 'Not assessed'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Temp</p>
              <p className="text-base font-medium">{pp.temperature_c}&deg;C</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="text-center p-2 bg-gray-50 rounded">
              <p className="text-xs text-gray-500">Voiding</p>
              <p className={`text-sm font-bold ${pp.voiding ? 'text-green-600' : 'text-red-600'}`}>
                {pp.voiding ? 'Yes' : 'No'}
              </p>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded">
              <p className="text-xs text-gray-500">Bowel Movement</p>
              <p className={`text-sm font-bold ${pp.bowel_movement ? 'text-green-600' : 'text-red-600'}`}>
                {pp.bowel_movement ? 'Yes' : 'No'}
              </p>
            </div>
            {pp.incision_intact !== null && (
              <div className="text-center p-2 bg-gray-50 rounded">
                <p className="text-xs text-gray-500">Incision</p>
                <p className={`text-sm font-bold ${pp.incision_intact ? 'text-green-600' : 'text-red-600'}`}>
                  {pp.incision_intact ? 'Intact' : 'Concern'}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-gray-500 text-center py-8">
          {delivery_record ? 'No postpartum assessments recorded' : 'Delivery must be recorded first'}
        </p>
      )}
    </div>
  );
};

export default PostpartumTab;
