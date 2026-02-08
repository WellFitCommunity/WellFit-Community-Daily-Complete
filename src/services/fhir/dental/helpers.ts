/**
 * Dental Observation Helper Functions
 * FHIR resource builders and interpretation utilities
 */

import type {
  FHIRObservation,
  FHIRProcedure,
  FHIRCodeableConcept,
  FHIRQuantity,
} from './types';
import { DENTAL_SNOMED_CODES } from './codes';

// =====================================================
// Observation Builder
// =====================================================

export function buildObservation(params: {
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

// =====================================================
// Interpretation Helpers
// =====================================================

export function interpretPlaqueIndex(value: number): string {
  if (value <= 1.0) return 'normal';
  if (value <= 2.0) return 'high';
  return 'critical';
}

export function interpretBleedingIndex(value: number): string {
  if (value <= 1.0) return 'normal';
  if (value <= 2.0) return 'high';
  return 'critical';
}

export function interpretPainScore(value: number): string {
  if (value === 0) return 'normal';
  if (value <= 3) return 'low';
  if (value <= 6) return 'high';
  return 'critical';
}

// =====================================================
// SNOMED / Status Mapping Helpers
// =====================================================

export function getPeriodontalStatusConcept(status: string): FHIRCodeableConcept {
  const snomedCode = getPeriodontalSnomedCode(status);
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

export function getPeriodontalSnomedCode(status: string): string {
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

export function mapProcedureStatus(status: string): FHIRProcedure['status'] {
  const mapping: Record<string, FHIRProcedure['status']> = {
    scheduled: 'preparation',
    in_progress: 'in-progress',
    completed: 'completed',
    cancelled: 'not-done',
    on_hold: 'on-hold',
  };
  return mapping[status] || 'completed';
}
