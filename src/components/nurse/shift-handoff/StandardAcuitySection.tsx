// ============================================================================
// Shift Handoff - Standard Acuity Patient Section
// ============================================================================
// Medium & Low risk patients — compact card layout
// ============================================================================

import React from 'react';
import { AvatarThumbnail } from '../../patient-avatar';
import { RISK_LEVEL_COLORS, RISK_LEVEL_ICONS } from '../../../types/shiftHandoff';
import type { PatientCardListProps } from './types';

export const StandardAcuitySection: React.FC<PatientCardListProps> = ({
  patients,
  selectedPatients,
  actions,
}) => {
  const standard = patients.filter(
    p => p.final_risk_level === 'MEDIUM' || p.final_risk_level === 'LOW'
  );

  if (standard.length === 0) return null;

  return (
    <div className="standard-acuity-section">
      {/* Header */}
      <div className="bg-linear-to-r from-slate-600 to-slate-500 text-white rounded-t-xl p-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl" role="img" aria-label="Clipboard">📋</span>
            <div>
              <h3 className="text-lg font-semibold">Standard Acuity</h3>
              <p className="text-slate-200 text-xs">Medium and Low-risk patients</p>
            </div>
          </div>
          <div className="bg-white/20 rounded-lg px-3 py-1">
            <span className="text-xl font-bold">{standard.length}</span>
            <span className="text-sm ml-1">patients</span>
          </div>
        </div>
      </div>

      {/* Compact Patient Cards */}
      <div className="bg-slate-50 border-2 border-t-0 border-slate-300 rounded-b-xl p-3 space-y-2">
        {standard.map((patient, index) => (
          <div
            key={patient.patient_id}
            className={`bg-white rounded-lg border-l-4 shadow hover:shadow-md transition-all ${
              patient.final_risk_level === 'MEDIUM'
                ? 'border-l-yellow-500'
                : 'border-l-green-500'
            } p-3`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedPatients.has(patient.patient_id)}
                  onChange={() => actions.onToggleSelection(patient.patient_id)}
                  className="w-5 h-5"
                  aria-label={`Select ${patient.patient_name}`}
                />

                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  patient.final_risk_level === 'MEDIUM'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {index + 1}
                </div>

                <div className="shrink-0 transform scale-[0.35] origin-center -my-8 -mx-4">
                  <AvatarThumbnail
                    patientId={patient.patient_id}
                    patientName={patient.patient_name}
                    skinTone="medium"
                    genderPresentation="neutral"
                    markers={[]}
                  />
                </div>

                <div>
                  <button
                    className="font-semibold text-gray-800 hover:text-[#1BA39C] transition-colors text-left"
                    onClick={() => actions.onSelect(patient)}
                  >
                    {patient.room_number ? `Room ${patient.room_number}` : 'No Room'} — {patient.patient_name}
                  </button>
                  <div className="text-xs text-gray-500">{patient.clinical_snapshot.diagnosis || 'No diagnosis'}</div>
                </div>

                <span className={`px-2 py-1 rounded-sm text-xs font-bold ${RISK_LEVEL_COLORS[patient.final_risk_level]}`}>
                  {RISK_LEVEL_ICONS[patient.final_risk_level]} {patient.final_risk_level}
                </span>

                {!patient.nurse_reviewed && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-sm text-xs font-medium">
                    Needs Review
                  </span>
                )}
              </div>

              <div className="flex gap-1">
                <button
                  onClick={() => actions.onConfirm(patient.risk_score_id, patient.patient_id)}
                  className="px-3 py-1 bg-green-600 text-white rounded-sm hover:bg-green-700 text-sm font-medium min-h-[44px] min-w-[44px]"
                  aria-label={`Confirm ${patient.patient_name}`}
                >
                  Confirm
                </button>
                <button
                  onClick={() => actions.onEscalate(patient.risk_score_id, patient.patient_id)}
                  className="px-3 py-1 bg-orange-500 text-white rounded-sm hover:bg-orange-600 text-sm font-medium min-h-[44px] min-w-[44px]"
                  aria-label={`Escalate ${patient.patient_name}`}
                >
                  Escalate
                </button>
                <button
                  onClick={() => actions.onDeEscalate(patient.risk_score_id, patient.patient_id)}
                  className="px-3 py-1 bg-blue-500 text-white rounded-sm hover:bg-blue-600 text-sm font-medium min-h-[44px] min-w-[44px]"
                  aria-label={`Lower risk for ${patient.patient_name}`}
                >
                  Lower
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StandardAcuitySection;
