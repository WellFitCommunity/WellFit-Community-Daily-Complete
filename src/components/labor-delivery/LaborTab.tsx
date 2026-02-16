/**
 * LaborTab - Labor progress display + forms for recording labor events, delivery,
 *   fetal monitoring, and medication administration
 *
 * Purpose: Shows fetal monitoring, labor events, + buttons to record new events/delivery/meds
 * Used by: LaborDeliveryDashboard
 */

import React, { useState } from 'react';
import type { LDDashboardSummary } from '../../types/laborDelivery';
import LaborEventForm from './LaborEventForm';
import DeliveryRecordForm from './DeliveryRecordForm';
import FetalMonitoringForm from './FetalMonitoringForm';
import MedicationAdminForm from './MedicationAdminForm';
import Partogram from './Partogram';
import BillingSuggestions from './BillingSuggestions';
import DeliverySummary from './DeliverySummary';
import LDEscalationPanel from './LDEscalationPanel';
import LDProgressNotePanel from './LDProgressNotePanel';
import LDShiftHandoffPanel from './LDShiftHandoffPanel';

interface LaborTabProps {
  summary: LDDashboardSummary;
  onDataChange: () => void;
}

type ActiveForm = 'none' | 'labor' | 'delivery' | 'fetal' | 'medication';

const LaborTab: React.FC<LaborTabProps> = ({ summary, onDataChange }) => {
  const [activeForm, setActiveForm] = useState<ActiveForm>('none');
  const [showSummary, setShowSummary] = useState(false);
  const { labor_events, latest_fetal_monitoring, delivery_record, pregnancy } = summary;

  const handleFormSuccess = () => {
    setActiveForm('none');
    onDataChange();
  };

  const toggleForm = (form: ActiveForm) => {
    setActiveForm((prev) => (prev === form ? 'none' : form));
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      {pregnancy && (
        <div className="flex flex-wrap gap-3 justify-end">
          <button
            onClick={() => toggleForm('labor')}
            className="bg-pink-600 text-white px-4 py-2 rounded font-medium min-h-[44px] hover:bg-pink-700"
          >
            {activeForm === 'labor' ? 'Close' : 'Record Labor Event'}
          </button>
          <button
            onClick={() => toggleForm('fetal')}
            className="bg-blue-600 text-white px-4 py-2 rounded font-medium min-h-[44px] hover:bg-blue-700"
          >
            {activeForm === 'fetal' ? 'Close' : 'Fetal Monitoring'}
          </button>
          <button
            onClick={() => toggleForm('medication')}
            className="bg-teal-600 text-white px-4 py-2 rounded font-medium min-h-[44px] hover:bg-teal-700"
          >
            {activeForm === 'medication' ? 'Close' : 'Administer Medication'}
          </button>
          {!delivery_record && (
            <button
              onClick={() => toggleForm('delivery')}
              className="bg-purple-600 text-white px-4 py-2 rounded font-medium min-h-[44px] hover:bg-purple-700"
            >
              {activeForm === 'delivery' ? 'Close' : 'Record Delivery'}
            </button>
          )}
        </div>
      )}

      {/* Active Form */}
      {activeForm === 'labor' && pregnancy && (
        <LaborEventForm
          patientId={pregnancy.patient_id} tenantId={pregnancy.tenant_id}
          pregnancyId={pregnancy.id} onSuccess={handleFormSuccess}
          onCancel={() => setActiveForm('none')}
        />
      )}
      {activeForm === 'delivery' && pregnancy && (
        <DeliveryRecordForm
          patientId={pregnancy.patient_id} tenantId={pregnancy.tenant_id}
          pregnancyId={pregnancy.id} onSuccess={handleFormSuccess}
          onCancel={() => setActiveForm('none')}
        />
      )}
      {activeForm === 'fetal' && pregnancy && (
        <FetalMonitoringForm
          patientId={pregnancy.patient_id} tenantId={pregnancy.tenant_id}
          pregnancyId={pregnancy.id} onSuccess={handleFormSuccess}
          onCancel={() => setActiveForm('none')}
        />
      )}
      {activeForm === 'medication' && pregnancy && (
        <MedicationAdminForm
          patientId={pregnancy.patient_id} tenantId={pregnancy.tenant_id}
          pregnancyId={pregnancy.id} onSuccess={handleFormSuccess}
          onCancel={() => setActiveForm('none')}
        />
      )}

      {/* Delivery Record Display */}
      {delivery_record && (
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Delivery Record</h3>
            <button
              onClick={() => setShowSummary(!showSummary)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium min-h-[44px] px-3"
            >
              {showSummary ? 'Hide Summary' : 'View Full Summary'}
            </button>
          </div>
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

      {/* Print-Friendly Delivery Summary */}
      {showSummary && delivery_record && pregnancy && (
        <DeliverySummary
          pregnancy={pregnancy}
          delivery={delivery_record}
          newborn={summary.newborn_assessment}
          laborEvents={labor_events}
          fetalMonitoring={latest_fetal_monitoring}
        />
      )}

      {/* Billing Suggestions (when delivery exists) */}
      {delivery_record && (
        <BillingSuggestions
          delivery={delivery_record}
          newborn={summary.newborn_assessment}
          fetalMonitoring={latest_fetal_monitoring}
        />
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

      {/* AI Panels */}
      {pregnancy && (
        <>
          <LDEscalationPanel
            patientId={pregnancy.patient_id}
            assessorId={pregnancy.primary_provider_id ?? pregnancy.patient_id}
            triggerReason={latest_fetal_monitoring ? `FHR Category ${latest_fetal_monitoring.fhr_category}` : undefined}
          />
          <LDProgressNotePanel
            patientId={pregnancy.patient_id}
            providerId={pregnancy.primary_provider_id ?? pregnancy.patient_id}
          />
          <LDShiftHandoffPanel
            patientId={pregnancy.patient_id}
            tenantId={pregnancy.tenant_id}
            pregnancyId={pregnancy.id}
          />
        </>
      )}

      {/* Partogram */}
      {labor_events.length > 0 && (
        <Partogram laborEvents={labor_events} />
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
