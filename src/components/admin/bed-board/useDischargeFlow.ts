/**
 * useDischargeFlow - Bed-board discharge action + post-discharge AI
 * readmission prediction trigger.
 *
 * Extracted from BedManagementPanel (600-line limit) and extended so that
 * completing a discharge fires the readmission prediction pipeline
 * (fire-and-forget — a prediction failure never blocks the discharge).
 *
 * Used by: BedManagementPanel
 */

import { useState, useCallback } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { BedManagementService } from '../../../services/bedManagementService';
import { triggerDischargeReadmissionPrediction } from '../../../services/ai/readmission-predictor/dischargeTrigger';
import type { useActivityBroadcast } from '../../collaboration';
import type { BedBoardEntry } from '../../../types/bed';
import type { BedAffirmationType } from './BedBoard.types';

interface UseDischargeFlowArgs {
  selectedBed: BedBoardEntry | null;
  dischargeDisposition: string;
  navigate: NavigateFunction;
  broadcast: ReturnType<typeof useActivityBroadcast>['broadcast'];
  showAffirmation: (type: BedAffirmationType) => void;
  notify: (toast: { message: string; type: 'success' | 'info' }) => void;
  loadData: () => Promise<void>;
  setError: (message: string | null) => void;
  onClosed: () => void;
}

const POST_ACUTE_DISPOSITIONS = ['Skilled Nursing Facility', 'Inpatient Rehab', 'Long-Term Acute Care', 'Hospice'];

export function useDischargeFlow({
  selectedBed,
  dischargeDisposition,
  navigate,
  broadcast,
  showAffirmation,
  notify,
  loadData,
  setError,
  onClosed,
}: UseDischargeFlowArgs) {
  const [discharging, setDischarging] = useState(false);

  const firePrediction = useCallback((patientId: string, disposition: string, facilityName?: string) => {
    void triggerDischargeReadmissionPrediction(patientId, disposition, facilityName).then((result) => {
      if (result.success && !result.data.skipped && result.data.riskCategory) {
        const pct = Math.round((result.data.readmissionRisk30Day ?? 0) * 100);
        const isHigh = result.data.riskCategory === 'high' || result.data.riskCategory === 'critical';
        notify({
          message: `Readmission risk for discharged patient: ${result.data.riskCategory.toUpperCase()} (${pct}% 30-day)${isHigh ? ' — care team alerted' : ''}`,
          type: 'info',
        });
      } else if (!result.success) {
        notify({ message: 'Readmission prediction unavailable for this discharge', type: 'info' });
      }
    });
  }, [notify]);

  const handleDischargePatient = useCallback(async () => {
    if (!selectedBed?.patient_id || !dischargeDisposition) {
      setError('Please select a discharge disposition');
      return;
    }
    const patientId = selectedBed.patient_id;
    const facilityName = selectedBed.facility_name ?? selectedBed.unit_name;
    setDischarging(true);
    try {
      const result = await BedManagementService.dischargePatient(patientId, dischargeDisposition);
      if (result.success) {
        showAffirmation('discharge_complete');
        broadcast('update', 'bed', `Discharged patient from ${selectedBed.bed_label}`, selectedBed.bed_id, `Bed ${selectedBed.bed_label}`);
        firePrediction(patientId, dischargeDisposition, facilityName);
        if (POST_ACUTE_DISPOSITIONS.includes(dischargeDisposition)) {
          navigate('/transfer-logs', {
            state: {
              createTransfer: true,
              patientId,
              patientName: selectedBed.patient_name,
              patientMrn: selectedBed.patient_mrn,
              disposition: dischargeDisposition,
              fromBedManagement: true,
            },
          });
        } else {
          await loadData();
        }
        onClosed();
      } else {
        setError(result.error.message);
      }
    } finally {
      setDischarging(false);
    }
  }, [selectedBed, dischargeDisposition, navigate, broadcast, showAffirmation, loadData, setError, onClosed, firePrediction]);

  return { discharging, handleDischargePatient };
}
