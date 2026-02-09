/**
 * L&D FHIR Observation Helper Functions
 * FHIR resource builders for maternal-fetal observations
 */

import type { FHIRObservation, FHIRQuantity, FHIRCodeableConcept } from './types';

// =====================================================
// Observation Builder
// =====================================================

export function buildLDObservation(params: {
  code: string;
  display: string;
  patientId: string;
  performerId?: string | null;
  effectiveDateTime: string;
  valueQuantity?: FHIRQuantity;
  valueCodeableConcept?: FHIRCodeableConcept;
  valueString?: string;
  valueInteger?: number;
  referenceRangeLow?: number;
  referenceRangeHigh?: number;
  interpretation?: string;
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
      { reference: `Practitioner/${params.performerId}`, type: 'Practitioner' },
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

export function interpretFetalHeartRate(fhr: number): string {
  if (fhr < 110) return 'critical';
  if (fhr <= 160) return 'normal';
  return 'high';
}

export function interpretAPGARScore(score: number): string {
  if (score >= 7) return 'normal';
  if (score >= 4) return 'low';
  return 'critical';
}

export function interpretBirthWeight(weightG: number): string {
  if (weightG < 1500) return 'very low birth weight';
  if (weightG < 2500) return 'low birth weight';
  if (weightG <= 4000) return 'normal';
  return 'macrosomia';
}
