/**
 * FHIR Dental Observation Service
 * FHIR R4 compliant mapping for dental observations
 * Resources: Observation, Procedure, Condition, DiagnosticReport
 */

import { supabase } from '../../../lib/supabaseClient';
import { getErrorMessage } from '../../../lib/getErrorMessage';
import type {
  DentalObservation,
  DentalAssessment,
  DentalProcedure,
} from '../../../types/dentalHealth';
import type {
  FHIRObservation,
  FHIRProcedure,
  FHIRCondition,
  FHIRDiagnosticReport,
  FHIRApiResponse,
} from './types';
import { DENTAL_LOINC_CODES } from './codes';
import {
  buildObservation,
  interpretPlaqueIndex,
  interpretBleedingIndex,
  interpretPainScore,
  getPeriodontalStatusConcept,
  getPeriodontalSnomedCode,
  mapProcedureStatus,
} from './helpers';

export class DentalObservationService {
  /**
   * Create FHIR Observation from Dental Assessment
   */
  static async createObservationFromAssessment(
    assessment: DentalAssessment
  ): Promise<FHIRApiResponse<FHIRObservation[]>> {
    try {
      const observations: FHIRObservation[] = [];

      // Plaque Index Observation
      if (assessment.plaque_index !== undefined && assessment.plaque_index !== null) {
        observations.push(
          buildObservation({
            code: DENTAL_LOINC_CODES.PLAQUE_INDEX,
            display: 'Plaque Index',
            patientId: assessment.patient_id,
            performerId: assessment.provider_id,
            effectiveDateTime: assessment.visit_date,
            valueQuantity: {
              value: assessment.plaque_index,
              unit: 'score',
              system: 'http://unitsofmeasure.org',
              code: '{score}',
            },
            referenceRangeLow: 0,
            referenceRangeHigh: 1,
            interpretation: interpretPlaqueIndex(assessment.plaque_index),
          })
        );
      }

      // Bleeding Index Observation
      if (assessment.bleeding_index !== undefined && assessment.bleeding_index !== null) {
        observations.push(
          buildObservation({
            code: DENTAL_LOINC_CODES.GINGIVAL_BLEEDING_INDEX,
            display: 'Gingival Bleeding Index',
            patientId: assessment.patient_id,
            performerId: assessment.provider_id,
            effectiveDateTime: assessment.visit_date,
            valueQuantity: {
              value: assessment.bleeding_index,
              unit: 'score',
              system: 'http://unitsofmeasure.org',
              code: '{score}',
            },
            referenceRangeLow: 0,
            referenceRangeHigh: 1,
            interpretation: interpretBleedingIndex(assessment.bleeding_index),
          })
        );
      }

      // Pain Score Observation
      if (assessment.pain_level !== undefined && assessment.pain_level !== null) {
        observations.push(
          buildObservation({
            code: DENTAL_LOINC_CODES.DENTAL_PAIN_SCORE,
            display: 'Dental Pain Score',
            patientId: assessment.patient_id,
            performerId: assessment.provider_id,
            effectiveDateTime: assessment.visit_date,
            valueQuantity: {
              value: assessment.pain_level,
              unit: 'score',
              system: 'http://unitsofmeasure.org',
              code: '{score}',
            },
            referenceRangeLow: 0,
            referenceRangeHigh: 10,
            interpretation: interpretPainScore(assessment.pain_level),
            bodySite: assessment.pain_location,
          })
        );
      }

      // Periodontal Disease Severity Observation
      if (assessment.periodontal_status) {
        observations.push(
          buildObservation({
            code: DENTAL_LOINC_CODES.PERIODONTAL_DISEASE_SEVERITY,
            display: 'Periodontal Disease Severity',
            patientId: assessment.patient_id,
            performerId: assessment.provider_id,
            effectiveDateTime: assessment.visit_date,
            valueCodeableConcept: getPeriodontalStatusConcept(assessment.periodontal_status),
          })
        );
      }

      // Store observations in database
      if (observations.length > 0) {
        const dentalObservations = observations.map(obs => ({
          patient_id: assessment.patient_id,
          assessment_id: assessment.id,
          observation_code: obs.code.coding?.[0]?.code || '',
          observation_name: obs.code.text || '',
          observation_category: 'dental-assessment',
          value_quantity: obs.valueQuantity?.value,
          value_unit: obs.valueQuantity?.unit,
          value_text: obs.valueString,
          value_codeable_concept: obs.valueCodeableConcept,
          observation_date: assessment.visit_date,
          observed_by: assessment.provider_id,
          fhir_resource: obs,
        }));

        const { error } = await supabase
          .from('dental_observations')
          .insert(dentalObservations);

        if (error) throw error;
      }

      return { success: true, data: observations };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Create FHIR Procedure from Dental Procedure
   */
  static async createFHIRProcedure(
    procedure: DentalProcedure
  ): Promise<FHIRApiResponse<FHIRProcedure>> {
    try {
      const fhirProcedure: FHIRProcedure = {
        resourceType: 'Procedure',
        status: mapProcedureStatus(procedure.procedure_status),
        code: {
          coding: [
            {
              system: 'http://www.ada.org/cdt',
              code: procedure.cdt_code,
              display: procedure.procedure_name,
            },
          ],
          text: procedure.procedure_name,
        },
        subject: {
          reference: `Patient/${procedure.patient_id}`,
          type: 'Patient',
        },
        performedDateTime: procedure.procedure_date,
      };

      // Add SNOMED code if available
      if (procedure.snomed_code) {
        fhirProcedure.code.coding?.push({
          system: 'http://snomed.info/sct',
          code: procedure.snomed_code,
          display: procedure.procedure_name,
        });
      }

      // Add performer
      if (procedure.provider_id) {
        fhirProcedure.performer = [
          {
            actor: {
              reference: `Practitioner/${procedure.provider_id}`,
              type: 'Practitioner',
            },
          },
        ];
      }

      // Add body site (tooth numbers)
      if (procedure.tooth_numbers && procedure.tooth_numbers.length > 0) {
        fhirProcedure.bodySite = procedure.tooth_numbers.map(toothNum => ({
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/tooth',
              code: toothNum.toString(),
              display: `Tooth #${toothNum}`,
            },
          ],
          text: `Tooth #${toothNum}`,
        }));
      }

      // Add complications
      if (procedure.complications) {
        fhirProcedure.note = [
          {
            text: `Complications: ${procedure.complications}`,
            time: new Date().toISOString(),
          },
        ];
      }

      // Update procedure record with FHIR ID
      const { data: _data, error } = await supabase
        .from('dental_procedures')
        .update({ fhir_procedure_id: fhirProcedure.id })
        .eq('id', procedure.id)
        .select('id, patient_id, assessment_id, tooth_number, procedure_name, cdt_code, snomed_code, procedure_status, procedure_date, provider_id, tooth_numbers, complications, notes, fhir_procedure_id, created_at, updated_at')
        .single();

      if (error) throw error;

      return { success: true, data: fhirProcedure };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Create FHIR Condition from Dental Assessment
   */
  static async createConditionFromAssessment(
    assessment: DentalAssessment
  ): Promise<FHIRApiResponse<FHIRCondition[]>> {
    try {
      const conditions: FHIRCondition[] = [];

      // Periodontal condition
      if (assessment.periodontal_status && assessment.periodontal_status !== 'healthy') {
        const snomedCode = getPeriodontalSnomedCode(assessment.periodontal_status);

        conditions.push({
          resourceType: 'Condition',
          clinicalStatus: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
                code: 'active',
                display: 'Active',
              },
            ],
          },
          verificationStatus: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
                code: 'confirmed',
                display: 'Confirmed',
              },
            ],
          },
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/condition-category',
                  code: 'problem-list-item',
                  display: 'Problem List Item',
                },
              ],
            },
          ],
          code: {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: snomedCode,
                display: assessment.periodontal_status.replace(/_/g, ' '),
              },
            ],
            text: assessment.periodontal_status.replace(/_/g, ' '),
          },
          bodySite: [
            {
              coding: [
                {
                  system: 'http://snomed.info/sct',
                  code: '113279003',
                  display: 'Gingiva structure',
                },
              ],
              text: 'Gums',
            },
          ],
          subject: {
            reference: `Patient/${assessment.patient_id}`,
            type: 'Patient',
          },
          onsetDateTime: assessment.visit_date,
          recordedDate: assessment.created_at,
        });
      }

      return { success: true, data: conditions };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Create FHIR Diagnostic Report from Assessment
   */
  static async createDiagnosticReport(
    assessment: DentalAssessment,
    observations: FHIRObservation[]
  ): Promise<FHIRApiResponse<FHIRDiagnosticReport>> {
    try {
      const report: FHIRDiagnosticReport = {
        resourceType: 'DiagnosticReport',
        status: assessment.status === 'completed' ? 'final' : 'preliminary',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
                code: 'DEN',
                display: 'Dental',
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '51969-4',
              display: 'Dental Examination',
            },
          ],
          text: 'Dental Assessment',
        },
        subject: {
          reference: `Patient/${assessment.patient_id}`,
          type: 'Patient',
        },
        effectiveDateTime: assessment.visit_date,
        issued: assessment.created_at,
        result: observations.map(obs => ({
          reference: `Observation/${obs.id}`,
          type: 'Observation',
        })),
        conclusion: assessment.clinical_notes,
      };

      if (assessment.provider_id) {
        report.performer = [
          {
            reference: `Practitioner/${assessment.provider_id}`,
            type: 'Practitioner',
          },
        ];
      }

      return { success: true, data: report };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Retrieve Dental Observations for a Patient
   */
  static async getObservationsByPatient(
    patientId: string,
    category?: string
  ): Promise<FHIRApiResponse<DentalObservation[]>> {
    try {
      let query = supabase
        .from('dental_observations')
        .select('id, patient_id, assessment_id, observation_code, observation_name, observation_category, value_quantity, value_unit, value_text, value_codeable_concept, observation_date, observed_by, fhir_resource, created_at, updated_at')
        .eq('patient_id', patientId)
        .order('observation_date', { ascending: false });

      if (category) {
        query = query.eq('observation_category', category);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }
}
