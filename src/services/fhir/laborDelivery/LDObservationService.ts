/**
 * FHIR L&D Observation Service
 * FHIR R4 compliant mapping for maternal-fetal observations
 * Resources: Observation (APGAR, FHR, birth weight, vitals)
 */

import { supabase } from '../../../lib/supabaseClient';
import { getErrorMessage } from '../../../lib/getErrorMessage';
import type { LDNewbornAssessment, LDFetalMonitoring } from '../../../types/laborDelivery';
import type { FHIRObservation, FHIRApiResponse } from './types';
import { LD_LOINC_CODES } from './codes';
import { buildLDObservation, interpretFetalHeartRate, interpretAPGARScore, interpretBirthWeight } from './helpers';

export class LDObservationService {
  /**
   * Create FHIR Observations from newborn assessment (APGAR + birth measurements)
   */
  static async createObservationsFromNewborn(
    assessment: LDNewbornAssessment
  ): Promise<FHIRApiResponse<FHIRObservation[]>> {
    try {
      const observations: FHIRObservation[] = [];
      const patientId = assessment.newborn_patient_id || assessment.patient_id;

      // APGAR 1-minute
      observations.push(
        buildLDObservation({
          code: LD_LOINC_CODES.APGAR_1_MIN,
          display: 'APGAR Score 1 minute',
          patientId,
          effectiveDateTime: assessment.birth_datetime,
          valueQuantity: {
            value: assessment.apgar_1_min,
            unit: '{score}',
            system: 'http://unitsofmeasure.org',
            code: '{score}',
          },
          referenceRangeLow: 7,
          referenceRangeHigh: 10,
          interpretation: interpretAPGARScore(assessment.apgar_1_min),
        })
      );

      // APGAR 5-minute
      observations.push(
        buildLDObservation({
          code: LD_LOINC_CODES.APGAR_5_MIN,
          display: 'APGAR Score 5 minutes',
          patientId,
          effectiveDateTime: assessment.birth_datetime,
          valueQuantity: {
            value: assessment.apgar_5_min,
            unit: '{score}',
            system: 'http://unitsofmeasure.org',
            code: '{score}',
          },
          referenceRangeLow: 7,
          referenceRangeHigh: 10,
          interpretation: interpretAPGARScore(assessment.apgar_5_min),
        })
      );

      // APGAR 10-minute (if performed)
      if (assessment.apgar_10_min !== null && assessment.apgar_10_min !== undefined) {
        observations.push(
          buildLDObservation({
            code: LD_LOINC_CODES.APGAR_10_MIN,
            display: 'APGAR Score 10 minutes',
            patientId,
            effectiveDateTime: assessment.birth_datetime,
            valueQuantity: {
              value: assessment.apgar_10_min,
              unit: '{score}',
              system: 'http://unitsofmeasure.org',
              code: '{score}',
            },
            interpretation: interpretAPGARScore(assessment.apgar_10_min),
          })
        );
      }

      // Birth Weight
      observations.push(
        buildLDObservation({
          code: LD_LOINC_CODES.BIRTH_WEIGHT,
          display: 'Birth weight',
          patientId,
          effectiveDateTime: assessment.birth_datetime,
          valueQuantity: {
            value: assessment.weight_g,
            unit: 'g',
            system: 'http://unitsofmeasure.org',
            code: 'g',
          },
          referenceRangeLow: 2500,
          referenceRangeHigh: 4000,
          interpretation: interpretBirthWeight(assessment.weight_g),
        })
      );

      // Birth Length
      observations.push(
        buildLDObservation({
          code: LD_LOINC_CODES.BIRTH_LENGTH,
          display: 'Birth length',
          patientId,
          effectiveDateTime: assessment.birth_datetime,
          valueQuantity: {
            value: assessment.length_cm,
            unit: 'cm',
            system: 'http://unitsofmeasure.org',
            code: 'cm',
          },
        })
      );

      // Head Circumference
      observations.push(
        buildLDObservation({
          code: LD_LOINC_CODES.HEAD_CIRCUMFERENCE,
          display: 'Head circumference at birth',
          patientId,
          effectiveDateTime: assessment.birth_datetime,
          valueQuantity: {
            value: assessment.head_circumference_cm,
            unit: 'cm',
            system: 'http://unitsofmeasure.org',
            code: 'cm',
          },
        })
      );

      // Store all observations
      for (const obs of observations) {
        await supabase.from('fhir_observations').insert({
          patient_id: patientId,
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
   * Create FHIR Observation from fetal monitoring (FHR)
   */
  static async createObservationFromFetalMonitoring(
    monitoring: LDFetalMonitoring
  ): Promise<FHIRApiResponse<FHIRObservation>> {
    try {
      const observation = buildLDObservation({
        code: LD_LOINC_CODES.FETAL_HEART_RATE,
        display: 'Fetal heart rate',
        patientId: monitoring.patient_id,
        performerId: monitoring.assessed_by,
        effectiveDateTime: monitoring.assessment_time,
        valueQuantity: {
          value: monitoring.fhr_baseline,
          unit: 'beats/min',
          system: 'http://unitsofmeasure.org',
          code: '/min',
        },
        referenceRangeLow: 110,
        referenceRangeHigh: 160,
        interpretation: interpretFetalHeartRate(monitoring.fhr_baseline),
      });

      await supabase.from('fhir_observations').insert({
        patient_id: monitoring.patient_id,
        resource_type: 'Observation',
        resource_data: observation,
        loinc_code: LD_LOINC_CODES.FETAL_HEART_RATE,
        status: 'final',
      });

      return { success: true, data: observation };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }
}
