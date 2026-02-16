/**
 * DeliverySummary - Print-friendly delivery summary / birth record
 *
 * Purpose: Display a comprehensive birth record suitable for printing (@media print)
 * Used by: LaborTab (via "Print Summary" button when delivery exists)
 */

import React, { useRef } from 'react';
import type {
  LDPregnancy,
  LDDeliveryRecord,
  LDNewbornAssessment,
  LDLaborEvent,
  LDFetalMonitoring,
} from '../../types/laborDelivery';

interface DeliverySummaryProps {
  pregnancy: LDPregnancy;
  delivery: LDDeliveryRecord;
  newborn?: LDNewbornAssessment | null;
  laborEvents: LDLaborEvent[];
  fetalMonitoring?: LDFetalMonitoring | null;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

const DeliverySummary: React.FC<DeliverySummaryProps> = ({
  pregnancy,
  delivery,
  newborn,
  laborEvents,
  fetalMonitoring,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      {/* Print button — hidden during print */}
      <div className="print:hidden mb-4 flex justify-end">
        <button
          onClick={handlePrint}
          className="bg-gray-700 text-white px-4 py-2 rounded font-medium min-h-[44px] hover:bg-gray-800"
        >
          Print Summary
        </button>
      </div>

      {/* Printable content */}
      <div ref={printRef} className="bg-white border rounded-lg p-6 print:border-0 print:shadow-none print:p-0">
        {/* Header */}
        <div className="text-center border-b pb-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Delivery Summary</h2>
          <p className="text-sm text-gray-500 mt-1">
            Generated {new Date().toLocaleDateString()} — Verify before filing
          </p>
        </div>

        {/* Maternal Information */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-1 mb-3">Maternal Information</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Gravida/Para:</span>
              <p className="font-medium">G{pregnancy.gravida} P{pregnancy.para} Ab{pregnancy.ab}</p>
            </div>
            <div>
              <span className="text-gray-500">EDD:</span>
              <p className="font-medium">{formatDate(pregnancy.edd)}</p>
            </div>
            <div>
              <span className="text-gray-500">Blood Type:</span>
              <p className="font-medium">{pregnancy.blood_type} {pregnancy.rh_factor}</p>
            </div>
            <div>
              <span className="text-gray-500">GBS Status:</span>
              <p className="font-medium">{pregnancy.gbs_status.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <span className="text-gray-500">Risk Level:</span>
              <p className="font-medium capitalize">{pregnancy.risk_level}</p>
            </div>
            {pregnancy.risk_factors.length > 0 && (
              <div className="col-span-2">
                <span className="text-gray-500">Risk Factors:</span>
                <p className="font-medium">{pregnancy.risk_factors.join(', ')}</p>
              </div>
            )}
          </div>
        </section>

        {/* Delivery Details */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-1 mb-3">Delivery Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Date/Time:</span>
              <p className="font-medium">{formatDateTime(delivery.delivery_datetime)}</p>
            </div>
            <div>
              <span className="text-gray-500">Method:</span>
              <p className="font-medium capitalize">{delivery.method.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <span className="text-gray-500">Anesthesia:</span>
              <p className="font-medium capitalize">{delivery.anesthesia.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <span className="text-gray-500">EBL:</span>
              <p className={`font-medium ${delivery.estimated_blood_loss_ml > 500 ? 'text-red-600' : ''}`}>
                {delivery.estimated_blood_loss_ml} mL
              </p>
            </div>
            {delivery.labor_duration_hours !== null && (
              <div>
                <span className="text-gray-500">Labor Duration:</span>
                <p className="font-medium">{delivery.labor_duration_hours} hours</p>
              </div>
            )}
            {delivery.second_stage_duration_min !== null && (
              <div>
                <span className="text-gray-500">Second Stage:</span>
                <p className="font-medium">{delivery.second_stage_duration_min} min</p>
              </div>
            )}
            <div>
              <span className="text-gray-500">Episiotomy:</span>
              <p className="font-medium">{delivery.episiotomy ? 'Yes' : 'No'}</p>
            </div>
            {delivery.laceration_degree !== null && delivery.laceration_degree !== undefined && delivery.laceration_degree > 0 && (
              <div>
                <span className="text-gray-500">Laceration:</span>
                <p className="font-medium">{delivery.laceration_degree}° degree</p>
              </div>
            )}
            <div>
              <span className="text-gray-500">Cord Clamping:</span>
              <p className="font-medium capitalize">{delivery.cord_clamping.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <span className="text-gray-500">Placenta Intact:</span>
              <p className="font-medium">{delivery.placenta_intact ? 'Yes' : 'No'}</p>
            </div>
            {delivery.cord_gases_ph !== null && (
              <div>
                <span className="text-gray-500">Cord Gas pH:</span>
                <p className="font-medium">{delivery.cord_gases_ph}</p>
              </div>
            )}
            {delivery.cord_gases_base_excess !== null && (
              <div>
                <span className="text-gray-500">Base Excess:</span>
                <p className="font-medium">{delivery.cord_gases_base_excess}</p>
              </div>
            )}
          </div>
          {delivery.complications.length > 0 && (
            <div className="mt-3 text-sm">
              <span className="text-gray-500">Complications:</span>
              <p className="font-medium text-red-700">{delivery.complications.join(', ')}</p>
            </div>
          )}
          {delivery.notes && (
            <div className="mt-3 text-sm">
              <span className="text-gray-500">Notes:</span>
              <p className="font-medium">{delivery.notes}</p>
            </div>
          )}
        </section>

        {/* Newborn Assessment */}
        {newborn && (
          <section className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-1 mb-3">Newborn Assessment</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Sex:</span>
                <p className="font-medium capitalize">{newborn.sex}</p>
              </div>
              <div>
                <span className="text-gray-500">Weight:</span>
                <p className="font-medium">{newborn.weight_g} g ({(newborn.weight_g / 453.592).toFixed(1)} lbs)</p>
              </div>
              <div>
                <span className="text-gray-500">Length:</span>
                <p className="font-medium">{newborn.length_cm} cm</p>
              </div>
              <div>
                <span className="text-gray-500">Head Circumference:</span>
                <p className="font-medium">{newborn.head_circumference_cm} cm</p>
              </div>
              <div>
                <span className="text-gray-500">APGAR 1 min:</span>
                <p className={`font-bold text-lg ${newborn.apgar_1_min < 7 ? 'text-red-600' : 'text-green-700'}`}>
                  {newborn.apgar_1_min}
                </p>
              </div>
              <div>
                <span className="text-gray-500">APGAR 5 min:</span>
                <p className={`font-bold text-lg ${newborn.apgar_5_min < 7 ? 'text-red-600' : 'text-green-700'}`}>
                  {newborn.apgar_5_min}
                </p>
              </div>
              {newborn.apgar_10_min !== null && (
                <div>
                  <span className="text-gray-500">APGAR 10 min:</span>
                  <p className="font-bold text-lg">{newborn.apgar_10_min}</p>
                </div>
              )}
              <div>
                <span className="text-gray-500">Disposition:</span>
                <p className="font-medium uppercase">{newborn.disposition}</p>
              </div>
              {newborn.temperature_c !== null && (
                <div>
                  <span className="text-gray-500">Temperature:</span>
                  <p className="font-medium">{newborn.temperature_c} °C</p>
                </div>
              )}
              {newborn.heart_rate !== null && (
                <div>
                  <span className="text-gray-500">Heart Rate:</span>
                  <p className="font-medium">{newborn.heart_rate} bpm</p>
                </div>
              )}
              {newborn.respiratory_rate !== null && (
                <div>
                  <span className="text-gray-500">Resp Rate:</span>
                  <p className="font-medium">{newborn.respiratory_rate} /min</p>
                </div>
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Vitamin K:</span>
                <p className="font-medium">{newborn.vitamin_k_given ? 'Given' : 'Not given'}</p>
              </div>
              <div>
                <span className="text-gray-500">Erythromycin:</span>
                <p className="font-medium">{newborn.erythromycin_given ? 'Given' : 'Not given'}</p>
              </div>
              <div>
                <span className="text-gray-500">Hep B Vaccine:</span>
                <p className="font-medium">{newborn.hepatitis_b_vaccine ? 'Given' : 'Not given'}</p>
              </div>
            </div>
            {newborn.anomalies.length > 0 && (
              <div className="mt-3 text-sm">
                <span className="text-gray-500">Anomalies:</span>
                <p className="font-medium text-red-700">{newborn.anomalies.join(', ')}</p>
              </div>
            )}
          </section>
        )}

        {/* Fetal Monitoring Summary */}
        {fetalMonitoring && (
          <section className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-1 mb-3">Final Fetal Monitoring</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-gray-500">FHR Baseline:</span>
                <p className="font-medium">{fetalMonitoring.fhr_baseline} bpm</p>
              </div>
              <div>
                <span className="text-gray-500">Category:</span>
                <p className="font-medium">{fetalMonitoring.fhr_category}</p>
              </div>
              <div>
                <span className="text-gray-500">Variability:</span>
                <p className="font-medium capitalize">{fetalMonitoring.variability}</p>
              </div>
              <div>
                <span className="text-gray-500">Decelerations:</span>
                <p className="font-medium capitalize">{fetalMonitoring.deceleration_type.replace(/_/g, ' ')}</p>
              </div>
            </div>
          </section>
        )}

        {/* Labor Timeline (last 10 events) */}
        {laborEvents.length > 0 && (
          <section className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-1 mb-3">Labor Timeline</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-1 pr-2">Time</th>
                  <th className="pb-1 pr-2">Stage</th>
                  <th className="pb-1 pr-2">Dilation</th>
                  <th className="pb-1 pr-2">Station</th>
                  <th className="pb-1">Contractions</th>
                </tr>
              </thead>
              <tbody>
                {laborEvents.slice(-10).map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="py-1 pr-2">{new Date(e.event_time).toLocaleTimeString()}</td>
                    <td className="py-1 pr-2 capitalize">{e.stage.replace(/_/g, ' ')}</td>
                    <td className="py-1 pr-2">{e.dilation_cm} cm</td>
                    <td className="py-1 pr-2">{e.station > 0 ? '+' : ''}{e.station}</td>
                    <td className="py-1">
                      {e.contraction_frequency_per_10min
                        ? `${e.contraction_frequency_per_10min}/10min`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Footer */}
        <div className="border-t pt-4 mt-6 text-xs text-gray-400 text-center">
          <p>This is a computer-generated summary. All clinical data must be verified by the attending provider.</p>
          <p className="mt-1">Envision ATLUS I.H.I.S. — Delivery Summary Report</p>
        </div>
      </div>
    </div>
  );
};

export default DeliverySummary;
