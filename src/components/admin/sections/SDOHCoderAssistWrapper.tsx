/**
 * SDOHCoderAssistWrapper — Bridges PatientContext to SDOHCoderAssist props
 *
 * SDOHCoderAssist requires explicit encounterId + patientId props.
 * This wrapper reads the selected patient from PatientContext and shows
 * a "select patient" prompt when no patient is selected.
 */

import React from 'react';
import { usePatientContextSafe } from '../../../contexts/PatientContext';
import { auditLogger } from '../../../services/auditLogger';
import { SDOHCoderAssist } from '../../billing/SDOHCoderAssist';

export const SDOHCoderAssistWrapper: React.FC = () => {
  const patientCtx = usePatientContextSafe();
  const selectedPatient = patientCtx?.selectedPatient ?? null;

  if (!selectedPatient) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
        <div className="text-3xl mb-3">🏥</div>
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Select a Patient</h3>
        <p className="text-sm text-blue-700">
          Use the patient selector or navigate from a patient chart to analyze SDOH billing codes.
        </p>
      </div>
    );
  }

  return (
    <SDOHCoderAssist
      encounterId={selectedPatient.id}
      patientId={selectedPatient.id}
      onSaved={(data) => auditLogger.debug('SDOH coding saved', data)}
    />
  );
};

export default SDOHCoderAssistWrapper;
