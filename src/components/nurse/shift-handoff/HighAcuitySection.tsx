// ============================================================================
// Shift Handoff - High Acuity Patient Section
// ============================================================================
// Critical & High risk patients — displayed prominently with full detail
// ============================================================================

import React from 'react';
import { AvatarThumbnail } from '../../patient-avatar';
import { RISK_LEVEL_COLORS, RISK_LEVEL_ICONS } from '../../../types/shiftHandoff';
import type { PatientCardListProps } from './types';

export const HighAcuitySection: React.FC<PatientCardListProps> = ({
  patients,
  selectedPatients,
  actions,
}) => {
  const highAcuity = patients.filter(
    p => p.final_risk_level === 'CRITICAL' || p.final_risk_level === 'HIGH'
  );

  if (highAcuity.length === 0) return null;

  return (
    <div className="high-acuity-section">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-linear-to-r from-red-600 via-red-500 to-orange-500 text-white rounded-t-xl p-4 shadow-lg border-b-4 border-red-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-4xl animate-pulse" role="img" aria-label="Alert">🚨</span>
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-wide">HIGH ACUITY — SEE FIRST</h3>
              <p className="text-red-100 text-sm font-medium">Critical and High-risk patients requiring immediate attention</p>
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-xs rounded-xl px-5 py-3 border-2 border-white/30">
            <div className="text-center">
              <span className="text-3xl font-black">{highAcuity.length}</span>
              <div className="text-xs font-medium text-red-100">PATIENTS</div>
            </div>
          </div>
        </div>
      </div>

      {/* Patient Cards */}
      <div className="bg-red-50/80 border-4 border-t-0 border-red-400 rounded-b-xl p-4 space-y-3">
        {highAcuity.map((patient, index) => (
          <div
            key={patient.patient_id}
            className={`bg-white rounded-xl border-l-8 shadow-lg hover:shadow-xl transition-all duration-300 ${
              patient.final_risk_level === 'CRITICAL'
                ? 'border-l-red-600 ring-2 ring-red-300'
                : 'border-l-orange-500 ring-1 ring-orange-200'
            } overflow-hidden`}
          >
            {/* Patient Header */}
            <div className={`p-4 flex items-center justify-between ${
              patient.final_risk_level === 'CRITICAL'
                ? 'bg-linear-to-r from-red-100 to-red-50'
                : 'bg-linear-to-r from-orange-100 to-orange-50'
            }`}>
              <div className="flex items-center gap-4">
                <input
                  type="checkbox"
                  checked={selectedPatients.has(patient.patient_id)}
                  onChange={() => actions.onToggleSelection(patient.patient_id)}
                  className="w-6 h-6 rounded-sm border-2 border-gray-400"
                  aria-label={`Select ${patient.patient_name}`}
                />

                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl ${
                  patient.final_risk_level === 'CRITICAL'
                    ? 'bg-red-600 text-white'
                    : 'bg-orange-500 text-white'
                }`}>
                  {index + 1}
                </div>

                <div className="shrink-0 transform scale-50 origin-center -my-6">
                  <AvatarThumbnail
                    patientId={patient.patient_id}
                    patientName={patient.patient_name}
                    skinTone="medium"
                    genderPresentation="neutral"
                    markers={[]}
                  />
                </div>

                <div className="flex-1">
                  <button
                    className="font-bold text-xl text-gray-900 hover:text-[#1BA39C] transition-colors text-left"
                    onClick={() => actions.onSelect(patient)}
                  >
                    {patient.room_number ? `Room ${patient.room_number}` : 'No Room'} — {patient.patient_name}
                  </button>
                  <div className="text-sm text-gray-600 font-medium">
                    {patient.clinical_snapshot.diagnosis || 'No diagnosis'}
                  </div>
                </div>

                {/* Risk & Review Badges */}
                <div className="flex items-center gap-2">
                  <span className={`px-4 py-2 rounded-lg text-base font-black ${RISK_LEVEL_COLORS[patient.final_risk_level]}`}>
                    {RISK_LEVEL_ICONS[patient.final_risk_level]} {patient.final_risk_level}
                  </span>

                  {!patient.nurse_reviewed ? (
                    <span className="px-3 py-2 bg-yellow-400 text-yellow-900 border-2 border-yellow-600 rounded-lg text-sm font-black animate-pulse">
                      NEEDS REVIEW
                    </span>
                  ) : patient.nurse_adjusted ? (
                    <span className="px-3 py-2 bg-purple-100 text-purple-800 rounded-lg text-sm font-bold">
                      Adjusted
                    </span>
                  ) : (
                    <span className="px-3 py-2 bg-green-100 text-green-800 rounded-lg text-sm font-bold">
                      Reviewed
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => actions.onConfirm(patient.risk_score_id, patient.patient_id)}
                  className="px-5 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold text-base shadow-md min-h-[44px]"
                >
                  Confirm
                </button>
                <button
                  onClick={() => actions.onEscalate(patient.risk_score_id, patient.patient_id)}
                  className="px-5 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold text-base shadow-md min-h-[44px]"
                >
                  Escalate
                </button>
                <button
                  onClick={() => actions.onDeEscalate(patient.risk_score_id, patient.patient_id)}
                  className="px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-base shadow-md min-h-[44px]"
                >
                  Lower
                </button>
              </div>
            </div>

            {/* Clinical Data */}
            <div className="p-4 bg-white">
              <div className="grid grid-cols-4 gap-4 mb-3">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-500 font-medium">BP</div>
                  <div className="font-bold text-gray-800">{patient.clinical_snapshot.bp_trend || 'N/A'}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-500 font-medium">O2 Sat</div>
                  <div className="font-bold text-gray-800">{patient.clinical_snapshot.o2_sat || 'N/A'}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-500 font-medium">HR</div>
                  <div className="font-bold text-gray-800">{patient.clinical_snapshot.heart_rate || 'N/A'}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-500 font-medium">PRN Today</div>
                  <div className="font-bold text-gray-800">{patient.clinical_snapshot.prn_meds_today || 0}</div>
                </div>
              </div>

              {patient.risk_factors.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {patient.risk_factors.map(factor => (
                    <span key={factor} className="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-medium">
                      {factor.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HighAcuitySection;
