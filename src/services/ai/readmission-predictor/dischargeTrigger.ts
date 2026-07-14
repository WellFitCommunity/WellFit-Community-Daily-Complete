/**
 * dischargeTrigger - Fires AI readmission-risk prediction when a clinician
 * discharges a patient from the bed board.
 *
 * This is the reachability bridge between the bed-management discharge action
 * (the one discharge a clinician can actually perform in the UI) and the
 * readmission prediction pipeline (readmissionRiskPredictor), which persists
 * the prediction row that PatientRiskStrip, the priority boards, and the
 * readmission dashboards read.
 *
 * Never blocks or fails the discharge itself — every failure path returns a
 * ServiceResult and is audit-logged.
 */

import { supabase } from '../../../lib/supabaseClient';
import { auditLogger } from '../../auditLogger';
import { ServiceResult, success, failure } from '../../_base';
import { readmissionRiskPredictor } from '../readmissionRiskPredictor';
import type { DischargeContext } from './types';

type PredictorDisposition = DischargeContext['dischargeDisposition'];

/**
 * Bed-board disposition labels → predictor enum.
 * Returns null for dispositions where a community readmission prediction
 * does not apply: deceased patients and inpatient transfers (the patient is
 * not being discharged to the community).
 */
export function mapBedBoardDisposition(label: string): PredictorDisposition | null {
  switch (label) {
    case 'Home':
      return 'home';
    case 'Home with Home Health':
      return 'home_health';
    case 'Skilled Nursing Facility':
      return 'snf';
    case 'Inpatient Rehab':
      return 'rehab';
    case 'Long-Term Acute Care':
      return 'ltac';
    case 'Hospice':
      return 'hospice';
    case 'Against Medical Advice':
      // AMA patients leave to home; their elevated risk shows up in the model's inputs
      return 'home';
    case 'Expired':
    case 'Transfer to Another Hospital':
      return null;
    default:
      return null;
  }
}

export interface DischargePredictionOutcome {
  skipped: boolean;
  skipReason?: string;
  predictionId?: string;
  riskCategory?: 'low' | 'moderate' | 'high' | 'critical';
  readmissionRisk30Day?: number;
}

/**
 * Fire-and-forget prediction at discharge time. Resolves the caller's tenant,
 * maps the bed-board disposition, and runs the full prediction pipeline
 * (features → AI → persist → care plan / alert side effects).
 */
export async function triggerDischargeReadmissionPrediction(
  patientId: string,
  bedBoardDisposition: string,
  dischargeFacility?: string
): Promise<ServiceResult<DischargePredictionOutcome>> {
  try {
    const disposition = mapBedBoardDisposition(bedBoardDisposition);
    if (!disposition) {
      return success({
        skipped: true,
        skipReason: `No community readmission prediction for disposition "${bedBoardDisposition}"`
      });
    }

    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      return failure('UNAUTHORIZED', 'No authenticated user for prediction trigger');
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', auth.user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      return failure('NOT_FOUND', 'Could not resolve tenant for prediction trigger');
    }

    const prediction = await readmissionRiskPredictor.predictReadmissionRisk({
      patientId,
      tenantId: profile.tenant_id,
      dischargeDate: new Date().toISOString(),
      dischargeFacility: dischargeFacility ?? '',
      dischargeDisposition: disposition
    });

    return success({
      skipped: false,
      predictionId: prediction.predictionId,
      riskCategory: prediction.riskCategory,
      readmissionRisk30Day: prediction.readmissionRisk30Day
    });
  } catch (err: unknown) {
    await auditLogger.error('DISCHARGE_PREDICTION_TRIGGER_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { patientId, disposition: bedBoardDisposition }
    );
    return failure('PREDICTION_FAILED', 'Readmission prediction could not be generated');
  }
}
