/**
 * LaborTab - Labor progress display + forms for recording labor events and delivery
 *
 * Purpose: Shows fetal monitoring, labor events, + buttons to record new events/delivery
 * Used by: LaborDeliveryDashboard
 */

import React, { useState } from 'react';
import type { LDDashboardSummary } from '../../types/laborDelivery';
import LaborEventForm from './LaborEventForm';
import DeliveryRecordForm from './DeliveryRecordForm';

interface LaborTabProps {
  summary: LDDashboardSummary;
  onDataChange: () => void;
}

const LaborTab: React.FC<LaborTabProps> = ({ summary, onDataChange }) => {
  const [showLaborForm, setShowLaborForm] = useState(false);
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const { labor_events, latest_fetal_monitoring, delivery_record, pregnancy } = summary;

  const handleLaborSuccess = () => {
    setShowLaborForm(false);
    onDataChange();
  };

  const handleDeliverySuccess = () => {
    setShowDeliveryForm(false);
    onDataChange();
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      {pregnancy && (
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => { setShowLaborForm(!showLaborForm); setShowDeliveryForm(false); }}
            className="bg-pink-600 text-white px-4 py-2 rounded font-medium min-h-[44px] hover:bg-pink-700"
          >
            {showLaborForm ? 'Close' : 'Record Labor Event'}
          </button>
          {!delivery_record && (
            <button
              onClick={() => { setShowDeliveryForm(!showDeliveryForm); setShowLaborForm(false); }}
              className="bg-purple-600 text-white px-4 py-2 rounded font-medium min-h-[44px] hover:bg-purple-700"
            >
              {showDeliveryForm ? 'Close' : 'Record Delivery'}
            </button>
          )}
        </div>
      )}

      {/* Labor Event Form */}
      {showLaborForm && pregnancy && (
        <LaborEventForm
          patientId={pregnancy.patient_id}
          tenantId={pregnancy.tenant_id}
          pregnancyId={pregnancy.id}
          onSuccess={handleLaborSuccess}
          onCancel={() => setShowLaborForm(false)}
        />
      )}

      {/* Delivery Record Form */}
      {showDeliveryForm && pregnancy && (
        <DeliveryRecordForm
          patientId={pregnancy.patient_id}
          tenantId={pregnancy.tenant_id}
          pregnancyId={pregnancy.id}
          onSuccess={handleDeliverySuccess}
          onCancel={() => setShowDeliveryForm(false)}
        />
      )}

      {/* Delivery Record Display */}
      {delivery_record && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Delivery Record</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Method</p>
              <p className="text-base font-medium">{delivery_record.method.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">EBL</p>
              <p className={`text-base font-bold ${delivery_record.estimated_blood_loss_ml > 500 ? 'text-red-600' : 'text-gray-900'}`}>
                {delivery_record.estimated_blood_loss_ml} mL
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Anesthesia</p>
              <p className="text-base font-medium">{delivery_record.anesthesia.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Date</p>
              <p className="text-base font-medium">
                {new Date(delivery_record.delivery_datetime).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Fetal Monitoring */}
      {latest_fetal_monitoring && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Latest Fetal Monitoring</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">FHR Baseline</p>
              <p className="text-xl font-bold">{latest_fetal_monitoring.fhr_baseline} bpm</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Category</p>
              <p className={`text-xl font-bold ${
                latest_fetal_monitoring.fhr_category === 'III' ? 'text-red-600' :
                latest_fetal_monitoring.fhr_category === 'II' ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {latest_fetal_monitoring.fhr_category}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Variability</p>
              <p className="text-base font-medium">{latest_fetal_monitoring.variability}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Decelerations</p>
              <p className="text-base font-medium">{latest_fetal_monitoring.deceleration_type}</p>
            </div>
          </div>
        </div>
      )}

      {/* Labor Progress */}
      {labor_events.length > 0 ? (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Labor Progress</h3>
          <div className="space-y-2">
            {labor_events.slice(-10).map((e) => (
              <div key={e.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <div>
                  <p className="text-sm font-medium">{e.stage.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-500">{new Date(e.event_time).toLocaleTimeString()}</p>
                </div>
                <div className="text-right text-sm">
                  <p>{e.dilation_cm} cm | {e.effacement_percent}% | Station {e.station > 0 ? '+' : ''}{e.station}</p>
                  {e.contraction_frequency_per_10min && (
                    <p className="text-xs text-gray-500">
                      Ctx: {e.contraction_frequency_per_10min}/10min
                      {e.contraction_duration_seconds ? ` x ${e.contraction_duration_seconds}s` : ''}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-gray-500 text-center py-8">No labor events recorded</p>
      )}
    </div>
  );
};

export default LaborTab;
