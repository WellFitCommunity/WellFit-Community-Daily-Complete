/**
 * Patient Data Gatherer
 *
 * Extracted verbatim from readmissionRiskPredictor.ts during god-file
 * decomposition (CLAUDE.md Commandment #12). Behavior-preserving move only.
 *
 * NOTE: This was a private method on ReadmissionRiskPredictor that is no longer
 * called by predictReadmissionRisk (the feature extractor superseded it). It is
 * preserved here verbatim rather than deleted — deletion is a Tier-3 action that
 * requires sign-off. See the god-file decomposition note for 2026-05-29.
 */

import { supabase } from '../../../lib/supabaseClient';
import {
  isHighRiskLevel,
  isCompletedStatus,
  isMissedStatus,
  isTruthy,
  type DischargeContext,
  type GatheredPatientData,
  type ReadmissionRow,
  type SdohIndicatorRow,
  type CheckInRow,
  type MedicationRequestRow,
  type CarePlanRow,
  type PatientProfileRow,
} from './types';

/**
 * Gather comprehensive patient data for prediction
 */
export async function gatherPatientData(context: DischargeContext): Promise<GatheredPatientData> {
  const patientId = context.patientId;
  const data: GatheredPatientData = {
    sources: {
      readmissionHistory: false,
      sdohIndicators: false,
      checkinPatterns: false,
      medicationAdherence: false,
      carePlanAdherence: false
    }
  };

  try {
    // 1. Readmission history (last 90 days)
    const { data: readmissions } = await supabase
      .from('patient_readmissions')
      .select('id, patient_id, admission_date, discharge_date, readmission_type, facility_id, created_at')
      .eq('patient_id', patientId)
      .gte('admission_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('admission_date', { ascending: false })
      .limit(10);

    if (readmissions && readmissions.length > 0) {
      const typedReadmissions = readmissions as ReadmissionRow[];
      data.readmissions = typedReadmissions;
      data.readmissionCount = typedReadmissions.length;
      data.recentReadmissions7d = typedReadmissions.filter(r =>
        new Date(r.admission_date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length;
      data.recentReadmissions30d = typedReadmissions.filter(r =>
        new Date(r.admission_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      ).length;
      data.sources.readmissionHistory = true;
    }

    // 2. SDOH indicators
    const { data: sdohIndicators } = await supabase
      .from('sdoh_indicators')
      .select('id, patient_id, domain, risk_level, status, indicator_text, created_at, updated_at')
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .limit(20);

    if (sdohIndicators && sdohIndicators.length > 0) {
      const typedSdoh = sdohIndicators as SdohIndicatorRow[];
      data.sdohIndicators = typedSdoh;
      data.highRiskSDOH = typedSdoh.filter((s) => isHighRiskLevel(s.risk_level));
      data.sources.sdohIndicators = true;
    }

    // 3. Check-in patterns (last 30 days)
    const { data: checkIns } = await supabase
      .from('patient_daily_check_ins')
      .select('id, patient_id, check_in_date, status, alert_triggered, created_at')
      .eq('patient_id', patientId)
      .gte('check_in_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('check_in_date', { ascending: false })
      .limit(30);

    if (checkIns && checkIns.length > 0) {
      const typedCheckIns = checkIns as CheckInRow[];
      data.checkIns = typedCheckIns;
      data.checkInCompletionRate = typedCheckIns.filter((c) => isCompletedStatus(c.status)).length / 30;
      data.missedCheckIns = typedCheckIns.filter((c) => isMissedStatus(c.status)).length;
      data.alertsTriggered = typedCheckIns.filter((c) => isTruthy(c.alert_triggered)).length;
      data.sources.checkinPatterns = true;
    }

    // 4. Medication data
    const { data: medications } = await supabase
      .from('fhir_medication_requests')
      .select('id, patient_id, medication_id, status, intent, medication_display, dosage_text, created_at, updated_at')
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .limit(20);

    if (medications && medications.length > 0) {
      data.activeMedications = medications as MedicationRequestRow[];
      data.medicationCount = medications.length;
      data.sources.medicationAdherence = true;
    }

    // 5. Active care plan
    const { data: carePlans } = await supabase
      .from('care_coordination_plans')
      .select('id, patient_id, tenant_id, status, plan_type, start_date, end_date, created_at, updated_at')
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .limit(1);

    if (carePlans && carePlans.length > 0) {
      data.hasActiveCarePlan = true;
      data.carePlan = carePlans[0] as CarePlanRow;
      data.sources.carePlanAdherence = true;
    } else {
      data.hasActiveCarePlan = false;
    }

    // 6. Patient profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('date_of_birth, chronic_conditions')
      .eq('user_id', patientId)
      .single();

    if (profile) {
      const typedProfile = profile as PatientProfileRow;
      data.profile = typedProfile;

      const dob = typedProfile.date_of_birth;
      if (typeof dob === 'string' && dob) {
        const age = Math.floor(
          (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
        );
        data.age = age;
      }

      const chronic = typedProfile.chronic_conditions;
      if (Array.isArray(chronic)) {
        data.chronicConditionsCount = chronic.length;
      } else {
        data.chronicConditionsCount = 0;
      }
    }

    return data;
  } catch (err: unknown) {
    throw new Error(`Failed to gather patient data: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}
