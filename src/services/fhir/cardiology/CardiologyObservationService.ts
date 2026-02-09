/**
 * FHIR Cardiology Observation Service
 * FHIR R4 compliant mapping for cardiac observations
 * Resources: Observation (EF, BNP, ECG, vitals)
 */

import { supabase } from '../../../lib/supabaseClient';
import { getErrorMessage } from '../../../lib/getErrorMessage';
import type { CardEcgResult, CardEchoResult, CardHeartFailure } from '../../../types/cardiology';
import type { FHIRObservation, FHIRApiResponse } from './types';
import { CARDIOLOGY_LOINC_CODES } from './codes';
import {
  buildCardiacObservation,
  interpretEjectionFraction,
  interpretHeartRate,
  interpretBNPLevel,
} from './helpers';

export class CardiologyObservationService {
  /**
   * Create FHIR Observations from ECG result
   */
  static async createObservationsFromEcg(
    ecg: CardEcgResult
  ): Promise<FHIRApiResponse<FHIRObservation[]>> {
    try {
      const observations: FHIRObservation[] = [];

      // Heart Rate Observation
      observations.push(
        buildCardiacObservation({
          code: CARDIOLOGY_LOINC_CODES.HEART_RATE,
          display: 'Heart Rate',
          patientId: ecg.patient_id,
          performerId: ecg.performed_by,
          effectiveDateTime: ecg.performed_date,
          valueQuantity: {
            value: ecg.heart_rate,
            unit: 'beats/min',
            system: 'http://unitsofmeasure.org',
            code: '/min',
          },
          referenceRangeLow: 60,
          referenceRangeHigh: 100,
          interpretation: interpretHeartRate(ecg.heart_rate),
          category: 'vital-signs',
        })
      );

      // ECG Interpretation (12-lead)
      observations.push(
        buildCardiacObservation({
          code: CARDIOLOGY_LOINC_CODES.ECG_12_LEAD,
          display: '12-lead ECG',
          patientId: ecg.patient_id,
          performerId: ecg.performed_by,
          effectiveDateTime: ecg.performed_date,
          valueString: `Rhythm: ${ecg.rhythm.replace(/_/g, ' ')}. ${ecg.interpretation || 'No additional interpretation.'}`,
        })
      );

      // PR Interval
      if (ecg.pr_interval_ms !== null && ecg.pr_interval_ms !== undefined) {
        observations.push(
          buildCardiacObservation({
            code: CARDIOLOGY_LOINC_CODES.PR_INTERVAL,
            display: 'PR Interval',
            patientId: ecg.patient_id,
            performerId: ecg.performed_by,
            effectiveDateTime: ecg.performed_date,
            valueQuantity: {
              value: ecg.pr_interval_ms,
              unit: 'ms',
              system: 'http://unitsofmeasure.org',
              code: 'ms',
            },
            referenceRangeLow: 120,
            referenceRangeHigh: 200,
          })
        );
      }

      // QRS Duration
      if (ecg.qrs_duration_ms !== null && ecg.qrs_duration_ms !== undefined) {
        observations.push(
          buildCardiacObservation({
            code: CARDIOLOGY_LOINC_CODES.QRS_DURATION,
            display: 'QRS Duration',
            patientId: ecg.patient_id,
            performerId: ecg.performed_by,
            effectiveDateTime: ecg.performed_date,
            valueQuantity: {
              value: ecg.qrs_duration_ms,
              unit: 'ms',
              system: 'http://unitsofmeasure.org',
              code: 'ms',
            },
            referenceRangeLow: 60,
            referenceRangeHigh: 120,
          })
        );
      }

      // Store in FHIR observations table
      for (const obs of observations) {
        await supabase.from('fhir_observations').insert({
          patient_id: ecg.patient_id,
          resource_type: 'Observation',
          resource_data: obs,
          loinc_code: obs.code.coding?.[0]?.code,
          status: 'final',
        });
      }

      return { success: true, data: observations };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Create FHIR Observation from Echo (EF)
   */
  static async createObservationFromEcho(
    echo: CardEchoResult
  ): Promise<FHIRApiResponse<FHIRObservation>> {
    try {
      const observation = buildCardiacObservation({
        code: CARDIOLOGY_LOINC_CODES.LVEF,
        display: 'Left Ventricular Ejection Fraction',
        patientId: echo.patient_id,
        performerId: echo.performed_by,
        effectiveDateTime: echo.performed_date,
        valueQuantity: {
          value: echo.lvef_percent,
          unit: '%',
          system: 'http://unitsofmeasure.org',
          code: '%',
        },
        referenceRangeLow: 55,
        referenceRangeHigh: 75,
        interpretation: interpretEjectionFraction(echo.lvef_percent),
      });

      await supabase.from('fhir_observations').insert({
        patient_id: echo.patient_id,
        resource_type: 'Observation',
        resource_data: observation,
        loinc_code: CARDIOLOGY_LOINC_CODES.LVEF,
        status: 'final',
      });

      return { success: true, data: observation };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Create FHIR Observation from Heart Failure Assessment (BNP)
   */
  static async createObservationFromHF(
    hf: CardHeartFailure
  ): Promise<FHIRApiResponse<FHIRObservation | null>> {
    try {
      if (!hf.bnp_pg_ml) {
        return { success: true, data: null };
      }

      const observation = buildCardiacObservation({
        code: CARDIOLOGY_LOINC_CODES.BNP,
        display: 'Brain Natriuretic Peptide',
        patientId: hf.patient_id,
        performerId: hf.assessed_by,
        effectiveDateTime: hf.assessment_date,
        valueQuantity: {
          value: hf.bnp_pg_ml,
          unit: 'pg/mL',
          system: 'http://unitsofmeasure.org',
          code: 'pg/mL',
        },
        referenceRangeLow: 0,
        referenceRangeHigh: 100,
        interpretation: interpretBNPLevel(hf.bnp_pg_ml),
      });

      await supabase.from('fhir_observations').insert({
        patient_id: hf.patient_id,
        resource_type: 'Observation',
        resource_data: observation,
        loinc_code: CARDIOLOGY_LOINC_CODES.BNP,
        status: 'final',
      });

      return { success: true, data: observation };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Get cardiac observations for a patient
   */
  static async getCardiacObservations(
    patientId: string,
    loincCodes?: string[]
  ): Promise<FHIRApiResponse<FHIRObservation[]>> {
    try {
      let query = supabase
        .from('fhir_observations')
        .select('resource_data')
        .eq('patient_id', patientId)
        .eq('resource_type', 'Observation');

      if (loincCodes && loincCodes.length > 0) {
        query = query.in('loinc_code', loincCodes);
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(50);

      if (error) {
        return { success: false, error: error.message };
      }

      const observations = (data || []).map(
        (row: { resource_data: unknown }) => row.resource_data as FHIRObservation
      );

      return { success: true, data: observations };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }
}
