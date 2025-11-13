/**
 * =====================================================
 * FHIR DENTAL OBSERVATION SERVICE
 * =====================================================
 * Purpose: FHIR R4 compliant mapping for dental observations
 * Resources: Observation, Procedure, Condition, DiagnosticReport
 * Standards: LOINC codes for dental observations, SNOMED CT for conditions
 * =====================================================
 */

import { supabase } from '../../lib/supabaseClient';
import type {
  DentalObservation,
  DentalAssessment,
  DentalProcedure,
  ToothChartEntry,
} from '../../types/dentalHealth';

// =====================================================
// FHIR RESOURCE TYPES
// =====================================================

export interface FHIRObservation {
  resourceType: 'Observation';
  id?: string;
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled';
  category?: FHIRCodeableConcept[];
  code: FHIRCodeableConcept;
  subject: FHIRReference;
  encounter?: FHIRReference;
  effectiveDateTime?: string;
  issued?: string;
  performer?: FHIRReference[];
  valueQuantity?: FHIRQuantity;
  valueCodeableConcept?: FHIRCodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  interpretation?: FHIRCodeableConcept[];
  note?: FHIRAnnotation[];
  bodySite?: FHIRCodeableConcept;
  referenceRange?: FHIRReferenceRange[];
}

export interface FHIRProcedure {
  resourceType: 'Procedure';
  id?: string;
  status: 'preparation' | 'in-progress' | 'not-done' | 'on-hold' | 'stopped' | 'completed';
  code: FHIRCodeableConcept;
  subject: FHIRReference;
  encounter?: FHIRReference;
  performedDateTime?: string;
  performer?: Array<{
    actor: FHIRReference;
    role?: FHIRCodeableConcept;
  }>;
  bodySite?: FHIRCodeableConcept[];
  outcome?: FHIRCodeableConcept;
  complication?: FHIRCodeableConcept[];
  note?: FHIRAnnotation[];
  usedCode?: FHIRCodeableConcept[];
}

export interface FHIRCondition {
  resourceType: 'Condition';
  id?: string;
  clinicalStatus?: FHIRCodeableConcept;
  verificationStatus?: FHIRCodeableConcept;
  category?: FHIRCodeableConcept[];
  severity?: FHIRCodeableConcept;
  code: FHIRCodeableConcept;
  bodySite?: FHIRCodeableConcept[];
  subject: FHIRReference;
  encounter?: FHIRReference;
  onsetDateTime?: string;
  recordedDate?: string;
  recorder?: FHIRReference;
  note?: FHIRAnnotation[];
}

export interface FHIRDiagnosticReport {
  resourceType: 'DiagnosticReport';
  id?: string;
  status: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled';
  category?: FHIRCodeableConcept[];
  code: FHIRCodeableConcept;
  subject: FHIRReference;
  encounter?: FHIRReference;
  effectiveDateTime?: string;
  issued?: string;
  performer?: FHIRReference[];
  result?: FHIRReference[];
  conclusion?: string;
  conclusionCode?: FHIRCodeableConcept[];
}

// Supporting FHIR types
export interface FHIRCodeableConcept {
  coding?: FHIRCoding[];
  text?: string;
}

export interface FHIRCoding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
}

export interface FHIRReference {
  reference?: string;
  type?: string;
  display?: string;
}

export interface FHIRQuantity {
  value?: number;
  unit?: string;
  system?: string;
  code?: string;
}

export interface FHIRAnnotation {
  authorReference?: FHIRReference;
  time?: string;
  text: string;
}

export interface FHIRReferenceRange {
  low?: FHIRQuantity;
  high?: FHIRQuantity;
  type?: FHIRCodeableConcept;
  text?: string;
}

export interface FHIRApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// =====================================================
// DENTAL LOINC CODES (Standardized observation codes)
// =====================================================

export const DENTAL_LOINC_CODES = {
  PERIODONTAL_PROBING_DEPTH: '11381-2',
  GINGIVAL_BLEEDING_INDEX: '86254-6',
  PLAQUE_INDEX: '86253-8',
  TOOTH_MOBILITY: '86255-3',
  DENTAL_CARIES_RISK: '86256-1',
  ORAL_HYGIENE_INDEX: '86257-9',
  PERIODONTAL_DISEASE_SEVERITY: '86258-7',
  TOOTH_CONDITION: '86259-5',
  DENTAL_PAIN_SCORE: '72514-3',
  DRY_MOUTH_SEVERITY: '86260-3',
  GUM_RECESSION: '86261-1',
};

// =====================================================
// SNOMED CT CODES FOR DENTAL CONDITIONS
// =====================================================

export const DENTAL_SNOMED_CODES = {
  // Periodontal Conditions
  HEALTHY_GUMS: '87715008',
  GINGIVITIS: '66383009',
  MILD_PERIODONTITIS: '2556008',
  MODERATE_PERIODONTITIS: '109564002',
  SEVERE_PERIODONTITIS: '27528006',

  // Tooth Conditions
  DENTAL_CARIES: '80967001',
  TOOTH_FILLING: '234947003',
  DENTAL_CROWN: '69993004',
  DENTAL_BRIDGE: '257816003',
  DENTAL_IMPLANT: '398044001',
  ROOT_CANAL: '234952001',
  TOOTH_EXTRACTION: '65546002',
  MISSING_TOOTH: '247372009',
  FRACTURED_TOOTH: '21824004',
  TOOTH_ABSCESS: '109564002',
  IMPACTED_TOOTH: '109564009',

  // Procedures
  DENTAL_PROPHYLAXIS: '234960005',
  DENTAL_SCALING: '234961009',
  FLUORIDE_APPLICATION: '234964001',
  DENTAL_RESTORATION: '234947003',
  TOOTH_EXTRACTION_PROCEDURE: '65546002',
  ROOT_CANAL_THERAPY: '234952001',
};

// =====================================================
// SERVICE CLASS
// =====================================================

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
          this.buildObservation({
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
            interpretation: this.interpretPlaqueIndex(assessment.plaque_index),
          })
        );
      }

      // Bleeding Index Observation
      if (assessment.bleeding_index !== undefined && assessment.bleeding_index !== null) {
        observations.push(
          this.buildObservation({
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
            interpretation: this.interpretBleedingIndex(assessment.bleeding_index),
          })
        );
      }

      // Pain Score Observation
      if (assessment.pain_level !== undefined && assessment.pain_level !== null) {
        observations.push(
          this.buildObservation({
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
            interpretation: this.interpretPainScore(assessment.pain_level),
            bodySite: assessment.pain_location,
          })
        );
      }

      // Periodontal Disease Severity Observation
      if (assessment.periodontal_status) {
        observations.push(
          this.buildObservation({
            code: DENTAL_LOINC_CODES.PERIODONTAL_DISEASE_SEVERITY,
            display: 'Periodontal Disease Severity',
            patientId: assessment.patient_id,
            performerId: assessment.provider_id,
            effectiveDateTime: assessment.visit_date,
            valueCodeableConcept: this.getPeriodontalStatusConcept(assessment.periodontal_status),
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
    } catch (error: any) {
      return { success: false, error: error.message };
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
        status: this.mapProcedureStatus(procedure.procedure_status),
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
      const { data, error } = await supabase
        .from('dental_procedures')
        .update({ fhir_procedure_id: fhirProcedure.id })
        .eq('id', procedure.id)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data: fhirProcedure };
    } catch (error: any) {
      return { success: false, error: error.message };
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
        const snomedCode = this.getPeriodontalSnomedCode(assessment.periodontal_status);

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
    } catch (error: any) {
      return { success: false, error: error.message };
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
    } catch (error: any) {
      return { success: false, error: error.message };
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
        .select('*')
        .eq('patient_id', patientId)
        .order('observation_date', { ascending: false });

      if (category) {
        query = query.eq('observation_category', category);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private static buildObservation(params: {
    code: string;
    display: string;
    patientId: string;
    performerId?: string | null;
    effectiveDateTime: string;
    valueQuantity?: FHIRQuantity;
    valueCodeableConcept?: FHIRCodeableConcept;
    valueString?: string;
    referenceRangeLow?: number;
    referenceRangeHigh?: number;
    interpretation?: string;
    bodySite?: string;
  }): FHIRObservation {
    const observation: FHIRObservation = {
      resourceType: 'Observation',
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'exam',
              display: 'Exam',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: params.code,
            display: params.display,
          },
        ],
        text: params.display,
      },
      subject: {
        reference: `Patient/${params.patientId}`,
        type: 'Patient',
      },
      effectiveDateTime: params.effectiveDateTime,
      issued: new Date().toISOString(),
    };

    if (params.performerId) {
      observation.performer = [
        {
          reference: `Practitioner/${params.performerId}`,
          type: 'Practitioner',
        },
      ];
    }

    if (params.valueQuantity) {
      observation.valueQuantity = params.valueQuantity;
    }

    if (params.valueCodeableConcept) {
      observation.valueCodeableConcept = params.valueCodeableConcept;
    }

    if (params.valueString) {
      observation.valueString = params.valueString;
    }

    if (params.interpretation) {
      observation.interpretation = [
        {
          text: params.interpretation,
        },
      ];
    }

    if (params.bodySite) {
      observation.bodySite = {
        text: params.bodySite,
      };
    }

    if (params.referenceRangeLow !== undefined && params.referenceRangeHigh !== undefined) {
      observation.referenceRange = [
        {
          low: {
            value: params.referenceRangeLow,
          },
          high: {
            value: params.referenceRangeHigh,
          },
        },
      ];
    }

    return observation;
  }

  private static interpretPlaqueIndex(value: number): string {
    if (value <= 1.0) return 'normal';
    if (value <= 2.0) return 'high';
    return 'critical';
  }

  private static interpretBleedingIndex(value: number): string {
    if (value <= 1.0) return 'normal';
    if (value <= 2.0) return 'high';
    return 'critical';
  }

  private static interpretPainScore(value: number): string {
    if (value === 0) return 'normal';
    if (value <= 3) return 'low';
    if (value <= 6) return 'high';
    return 'critical';
  }

  private static getPeriodontalStatusConcept(status: string): FHIRCodeableConcept {
    const snomedCode = this.getPeriodontalSnomedCode(status);
    return {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: snomedCode,
          display: status.replace(/_/g, ' '),
        },
      ],
      text: status.replace(/_/g, ' '),
    };
  }

  private static getPeriodontalSnomedCode(status: string): string {
    const mapping: Record<string, string> = {
      healthy: DENTAL_SNOMED_CODES.HEALTHY_GUMS,
      gingivitis: DENTAL_SNOMED_CODES.GINGIVITIS,
      mild_periodontitis: DENTAL_SNOMED_CODES.MILD_PERIODONTITIS,
      moderate_periodontitis: DENTAL_SNOMED_CODES.MODERATE_PERIODONTITIS,
      severe_periodontitis: DENTAL_SNOMED_CODES.SEVERE_PERIODONTITIS,
      advanced_periodontitis: DENTAL_SNOMED_CODES.SEVERE_PERIODONTITIS,
    };
    return mapping[status] || DENTAL_SNOMED_CODES.GINGIVITIS;
  }

  private static mapProcedureStatus(status: string): FHIRProcedure['status'] {
    const mapping: Record<string, FHIRProcedure['status']> = {
      scheduled: 'preparation',
      in_progress: 'in-progress',
      completed: 'completed',
      cancelled: 'not-done',
      on_hold: 'on-hold',
    };
    return mapping[status] || 'completed';
  }
}
