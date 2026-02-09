/**
 * Oncology FHIR Observation Helper Functions
 * FHIR resource builders and interpretation utilities
 */

import type {
  FHIRObservation,
  FHIRCodeableConcept,
  FHIRQuantity,
} from './types';

// =====================================================
// Observation Builder
// =====================================================

export function buildOncologyObservation(params: {
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
  category?: string;
}): FHIRObservation {
  const observation: FHIRObservation = {
    resourceType: 'Observation',
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: params.category || 'laboratory',
            display: params.category === 'vital-signs' ? 'Vital Signs' : 'Laboratory',
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
    observation.interpretation = [{ text: params.interpretation }];
  }

  if (params.referenceRangeLow !== undefined && params.referenceRangeHigh !== undefined) {
    observation.referenceRange = [
      {
        low: { value: params.referenceRangeLow },
        high: { value: params.referenceRangeHigh },
      },
    ];
  }

  return observation;
}

// =====================================================
// Interpretation Helpers
// =====================================================

export function interpretANC(anc: number): string {
  if (anc < 500) return 'critical';
  if (anc < 1000) return 'low';
  if (anc < 1500) return 'low-normal';
  return 'normal';
}

export function interpretHemoglobin(hgb: number): string {
  if (hgb < 7) return 'critical';
  if (hgb < 10) return 'low';
  if (hgb <= 17.5) return 'normal';
  return 'high';
}

export function interpretPlatelets(plt: number): string {
  if (plt < 20000) return 'critical';
  if (plt < 50000) return 'low';
  if (plt < 150000) return 'low-normal';
  if (plt <= 400000) return 'normal';
  return 'high';
}

export function interpretECOGStatus(score: number): string {
  if (score === 0) return 'normal';
  if (score <= 2) return 'low';
  if (score <= 3) return 'high';
  return 'critical';
}
