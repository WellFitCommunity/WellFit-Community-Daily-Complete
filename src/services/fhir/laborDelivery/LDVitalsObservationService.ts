/**
 * FHIR L&D Vitals Observation Service
 * Maps prenatal visit vitals and labor event vitals to FHIR R4 Observations
 */

import { supabase } from '../../../lib/supabaseClient';
import { getErrorMessage } from '../../../lib/getErrorMessage';
import type { LDPrenatalVisit, LDLaborEvent } from '../../../types/laborDelivery';
import type { FHIRObservation, FHIRApiResponse } from './types';
import { LD_LOINC_CODES } from './codes';
import { buildLDObservation } from './helpers';

export class LDVitalsObservationService {
  /**
   * Create FHIR Observations from a prenatal visit (BP, weight, FHR, fundal height, GA)
   */
  static async createObservationsFromPrenatalVisit(
    visit: LDPrenatalVisit
  ): Promise<FHIRApiResponse<FHIRObservation[]>> {
    try {
      const observations: FHIRObservation[] = [];
      const patientId = visit.patient_id;
      const date = visit.visit_date;

      // Blood Pressure — Systolic
      observations.push(
        buildLDObservation({
          code: LD_LOINC_CODES.MATERNAL_BP_SYSTOLIC,
          display: 'Systolic blood pressure',
          patientId,
          performerId: visit.provider_id,
          effectiveDateTime: date,
          valueQuantity: {
            value: visit.bp_systolic,
            unit: 'mmHg',
            system: 'http://unitsofmeasure.org',
            code: 'mm[Hg]',
          },
          referenceRangeLow: 90,
          referenceRangeHigh: 140,
          interpretation: visit.bp_systolic >= 140 ? 'high' : visit.bp_systolic < 90 ? 'low' : 'normal',
        })
      );

      // Blood Pressure — Diastolic
      observations.push(
        buildLDObservation({
          code: LD_LOINC_CODES.MATERNAL_BP_DIASTOLIC,
          display: 'Diastolic blood pressure',
          patientId,
          performerId: visit.provider_id,
          effectiveDateTime: date,
          valueQuantity: {
            value: visit.bp_diastolic,
            unit: 'mmHg',
            system: 'http://unitsofmeasure.org',
            code: 'mm[Hg]',
          },
          referenceRangeLow: 60,
          referenceRangeHigh: 90,
          interpretation: visit.bp_diastolic >= 90 ? 'high' : 'normal',
        })
      );

      // Maternal Weight
      observations.push(
        buildLDObservation({
          code: '29463-7', // Body weight LOINC
          display: 'Body weight',
          patientId,
          performerId: visit.provider_id,
          effectiveDateTime: date,
          valueQuantity: {
            value: visit.weight_kg,
            unit: 'kg',
            system: 'http://unitsofmeasure.org',
            code: 'kg',
          },
        })
      );

      // Fetal Heart Rate (if recorded)
      if (visit.fetal_heart_rate) {
        observations.push(
          buildLDObservation({
            code: LD_LOINC_CODES.FETAL_HEART_RATE,
            display: 'Fetal heart rate',
            patientId,
            performerId: visit.provider_id,
            effectiveDateTime: date,
            valueQuantity: {
              value: visit.fetal_heart_rate,
              unit: 'beats/min',
              system: 'http://unitsofmeasure.org',
              code: '/min',
            },
            referenceRangeLow: 110,
            referenceRangeHigh: 160,
          })
        );
      }

      // Fundal Height (if recorded)
      if (visit.fundal_height_cm) {
        observations.push(
          buildLDObservation({
            code: LD_LOINC_CODES.FUNDAL_HEIGHT,
            display: 'Fundal height',
            patientId,
            performerId: visit.provider_id,
            effectiveDateTime: date,
            valueQuantity: {
              value: visit.fundal_height_cm,
              unit: 'cm',
              system: 'http://unitsofmeasure.org',
              code: 'cm',
            },
          })
        );
      }

      // Gestational Age
      observations.push(
        buildLDObservation({
          code: LD_LOINC_CODES.GESTATIONAL_AGE,
          display: 'Gestational age',
          patientId,
          performerId: visit.provider_id,
          effectiveDateTime: date,
          valueString: `${visit.gestational_age_weeks}w${visit.gestational_age_days}d`,
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
   * Create FHIR Observations from labor event (cervical dilation, station, maternal vitals)
   */
  static async createObservationsFromLaborEvent(
    event: LDLaborEvent
  ): Promise<FHIRApiResponse<FHIRObservation[]>> {
    try {
      const observations: FHIRObservation[] = [];
      const patientId = event.patient_id;
      const date = event.event_time;

      // Cervical dilation (no standard LOINC — use display-only code)
      observations.push(
        buildLDObservation({
          code: '11979-2', // Cervical dilation LOINC
          display: 'Cervical dilation',
          patientId,
          effectiveDateTime: date,
          valueQuantity: {
            value: event.dilation_cm,
            unit: 'cm',
            system: 'http://unitsofmeasure.org',
            code: 'cm',
          },
          referenceRangeLow: 0,
          referenceRangeHigh: 10,
        })
      );

      // Fetal station
      observations.push(
        buildLDObservation({
          code: '11980-0', // Fetal station LOINC
          display: 'Fetal station',
          patientId,
          effectiveDateTime: date,
          valueString: `${event.station > 0 ? '+' : ''}${event.station}`,
        })
      );

      // Maternal BP if recorded
      if (event.maternal_bp_systolic) {
        observations.push(
          buildLDObservation({
            code: LD_LOINC_CODES.MATERNAL_BP_SYSTOLIC,
            display: 'Systolic blood pressure',
            patientId,
            effectiveDateTime: date,
            valueQuantity: {
              value: event.maternal_bp_systolic,
              unit: 'mmHg',
              system: 'http://unitsofmeasure.org',
              code: 'mm[Hg]',
            },
          })
        );
      }

      if (event.maternal_bp_diastolic) {
        observations.push(
          buildLDObservation({
            code: LD_LOINC_CODES.MATERNAL_BP_DIASTOLIC,
            display: 'Diastolic blood pressure',
            patientId,
            effectiveDateTime: date,
            valueQuantity: {
              value: event.maternal_bp_diastolic,
              unit: 'mmHg',
              system: 'http://unitsofmeasure.org',
              code: 'mm[Hg]',
            },
          })
        );
      }

      // Maternal heart rate if recorded
      if (event.maternal_hr) {
        observations.push(
          buildLDObservation({
            code: LD_LOINC_CODES.MATERNAL_HEART_RATE,
            display: 'Heart rate',
            patientId,
            effectiveDateTime: date,
            valueQuantity: {
              value: event.maternal_hr,
              unit: 'beats/min',
              system: 'http://unitsofmeasure.org',
              code: '/min',
            },
          })
        );
      }

      // Maternal temperature if recorded
      if (event.maternal_temp_c) {
        observations.push(
          buildLDObservation({
            code: LD_LOINC_CODES.MATERNAL_TEMPERATURE,
            display: 'Body temperature',
            patientId,
            effectiveDateTime: date,
            valueQuantity: {
              value: event.maternal_temp_c,
              unit: '°C',
              system: 'http://unitsofmeasure.org',
              code: 'Cel',
            },
          })
        );
      }

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
}
