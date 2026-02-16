/**
 * NewbornTab - Newborn assessment display + form
 *
 * Purpose: Shows newborn APGAR scores, measurements, and initial care
 * Used by: LaborDeliveryDashboard
 */

import React, { useState } from 'react';
import type { LDDashboardSummary } from '../../types/laborDelivery';
import NewbornAssessmentForm from './NewbornAssessmentForm';

interface NewbornTabProps {
  summary: LDDashboardSummary;
  onDataChange: () => void;
}

const NewbornTab: React.FC<NewbornTabProps> = ({ summary, onDataChange }) => {
  const [showForm, setShowForm] = useState(false);
  const nb = summary.newborn_assessment;
  const { pregnancy, delivery_record } = summary;

  const handleSuccess = () => {
    setShowForm(false);
    onDataChange();
  };

  return (
    <div className="space-y-6">
      {/* Record Button - only when delivery exists but no newborn assessment */}
      {pregnancy && delivery_record && !nb && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-pink-600 text-white px-4 py-2 rounded font-medium min-h-[44px] hover:bg-pink-700"
          >
            {showForm ? 'Close' : 'Record Newborn Assessment'}
          </button>
        </div>
      )}

      {/* Form */}
      {showForm && pregnancy && delivery_record && (
        <NewbornAssessmentForm
          patientId={pregnancy.patient_id}
          tenantId={pregnancy.tenant_id}
          pregnancyId={pregnancy.id}
          deliveryId={delivery_record.id}
          onSuccess={handleSuccess}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Display */}
      {nb ? (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h3 className="text-lg font-semibold">Newborn Assessment</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">APGAR (1/5/10 min)</p>
              <p className="text-2xl font-bold">
                {nb.apgar_1_min}/{nb.apgar_5_min}
                {nb.apgar_10_min !== null ? `/${nb.apgar_10_min}` : ''}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Birth Weight</p>
              <p className="text-xl font-bold">{nb.weight_g}g</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Length</p>
              <p className="text-base font-medium">{nb.length_cm} cm</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Head Circ</p>
              <p className="text-base font-medium">{nb.head_circumference_cm} cm</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
            <div>
              <p className="text-sm text-gray-500">Sex</p>
              <p className="text-base font-medium capitalize">{nb.sex}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Disposition</p>
              <p className="text-base font-medium">{nb.disposition.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Birth Time</p>
              <p className="text-base font-medium">{new Date(nb.birth_datetime).toLocaleString()}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { label: 'Vitamin K', given: nb.vitamin_k_given },
              { label: 'Erythromycin', given: nb.erythromycin_given },
              { label: 'Hep B Vaccine', given: nb.hepatitis_b_vaccine },
            ].map((item) => (
              <div key={item.label} className="text-center p-2 bg-gray-50 rounded">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className={`text-sm font-bold ${item.given ? 'text-green-600' : 'text-gray-400'}`}>
                  {item.given ? 'Given' : 'Not given'}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-gray-500 text-center py-8">
          {delivery_record ? 'No newborn assessment recorded' : 'Delivery must be recorded first'}
        </p>
      )}
    </div>
  );
};

export default NewbornTab;
