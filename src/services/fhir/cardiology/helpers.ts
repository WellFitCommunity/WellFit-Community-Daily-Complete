/**
 * Cardiology FHIR Observation Helper Functions
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

export function buildCardiacObservation(params: {
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
            code: params.category || 'procedure',
            display: params.category === 'vital-signs' ? 'Vital Signs' : 'Procedure',
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

export function interpretEjectionFraction(ef: number): string {
  if (ef >= 55) return 'normal';
  if (ef >= 40) return 'low';
  if (ef >= 30) return 'high';
  return 'critical';
}

export function interpretHeartRate(hr: number): string {
  if (hr < 50) return 'critical';
  if (hr < 60) return 'low';
  if (hr <= 100) return 'normal';
  if (hr <= 150) return 'high';
  return 'critical';
}

export function interpretBNPLevel(bnp: number): string {
  if (bnp < 100) return 'normal';
  if (bnp < 400) return 'high';
  return 'critical';
}

export function interpretTroponin(troponin: number): string {
  if (troponin < 0.04) return 'normal';
  if (troponin < 0.4) return 'high';
  return 'critical';
}
