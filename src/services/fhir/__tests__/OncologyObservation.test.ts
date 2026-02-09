/**
 * Oncology FHIR Observation Tests
 * Tests for FHIR resource building and interpretation helpers
 */

import { describe, it, expect } from 'vitest';
import {
  buildOncologyObservation,
  interpretANC,
  interpretHemoglobin,
  interpretPlatelets,
  interpretECOGStatus,
} from '../oncology/helpers';
import { ONCOLOGY_LOINC_CODES, ONCOLOGY_SNOMED_CODES } from '../oncology/codes';

// =====================================================
// Observation Builder
// =====================================================

describe('buildOncologyObservation', () => {
  it('builds a valid FHIR Observation with required fields', () => {
    const obs = buildOncologyObservation({
      code: ONCOLOGY_LOINC_CODES.ANC,
      display: 'Absolute Neutrophil Count',
      patientId: 'p-123',
      effectiveDateTime: '2026-02-10T14:30:00Z',
      valueQuantity: {
        value: 2500,
        unit: '/uL',
        system: 'http://unitsofmeasure.org',
        code: '/uL',
      },
    });

    expect(obs.resourceType).toBe('Observation');
    expect(obs.status).toBe('final');
    expect(obs.code.coding?.[0]?.code).toBe(ONCOLOGY_LOINC_CODES.ANC);
    expect(obs.subject.reference).toBe('Patient/p-123');
    expect(obs.valueQuantity?.value).toBe(2500);
  });

  it('defaults category to laboratory', () => {
    const obs = buildOncologyObservation({
      code: ONCOLOGY_LOINC_CODES.WBC,
      display: 'WBC',
      patientId: 'p1',
      effectiveDateTime: '2026-02-10T14:30:00Z',
    });
    expect(obs.category?.[0]?.coding?.[0]?.code).toBe('laboratory');
  });

  it('includes performer when provided', () => {
    const obs = buildOncologyObservation({
      code: ONCOLOGY_LOINC_CODES.ECOG,
      display: 'ECOG',
      patientId: 'p1',
      performerId: 'onc-dr-smith',
      effectiveDateTime: '2026-02-10T14:30:00Z',
    });
    expect(obs.performer?.[0]?.reference).toBe('Practitioner/onc-dr-smith');
  });

  it('includes reference range when provided', () => {
    const obs = buildOncologyObservation({
      code: ONCOLOGY_LOINC_CODES.HEMOGLOBIN,
      display: 'Hemoglobin',
      patientId: 'p1',
      effectiveDateTime: '2026-02-10T14:30:00Z',
      referenceRangeLow: 12.0,
      referenceRangeHigh: 17.5,
    });
    expect(obs.referenceRange?.[0]?.low?.value).toBe(12.0);
    expect(obs.referenceRange?.[0]?.high?.value).toBe(17.5);
  });

  it('includes interpretation when provided', () => {
    const obs = buildOncologyObservation({
      code: ONCOLOGY_LOINC_CODES.ANC,
      display: 'ANC',
      patientId: 'p1',
      effectiveDateTime: '2026-02-10T14:30:00Z',
      interpretation: 'critical',
    });
    expect(obs.interpretation?.[0]?.text).toBe('critical');
  });

  it('supports valueString for staging', () => {
    const obs = buildOncologyObservation({
      code: ONCOLOGY_LOINC_CODES.TNM_T,
      display: 'Primary Tumor',
      patientId: 'p1',
      effectiveDateTime: '2026-02-10T14:30:00Z',
      valueString: 'T2a',
    });
    expect(obs.valueString).toBe('T2a');
  });
});

// =====================================================
// Interpretation Helpers
// =====================================================

describe('interpretANC', () => {
  it('returns critical for ANC < 500', () => {
    expect(interpretANC(300)).toBe('critical');
    expect(interpretANC(0)).toBe('critical');
  });

  it('returns low for ANC 500-999', () => {
    expect(interpretANC(700)).toBe('low');
  });

  it('returns low-normal for ANC 1000-1499', () => {
    expect(interpretANC(1200)).toBe('low-normal');
  });

  it('returns normal for ANC >= 1500', () => {
    expect(interpretANC(2500)).toBe('normal');
    expect(interpretANC(1500)).toBe('normal');
  });
});

describe('interpretHemoglobin', () => {
  it('returns critical for Hgb < 7', () => {
    expect(interpretHemoglobin(6.5)).toBe('critical');
  });

  it('returns low for Hgb 7-9.9', () => {
    expect(interpretHemoglobin(8.5)).toBe('low');
  });

  it('returns normal for Hgb 10-17.5', () => {
    expect(interpretHemoglobin(14)).toBe('normal');
  });

  it('returns high for Hgb > 17.5', () => {
    expect(interpretHemoglobin(18)).toBe('high');
  });
});

describe('interpretPlatelets', () => {
  it('returns critical for PLT < 20000', () => {
    expect(interpretPlatelets(15000)).toBe('critical');
  });

  it('returns low for PLT 20000-49999', () => {
    expect(interpretPlatelets(35000)).toBe('low');
  });

  it('returns normal for PLT 150000-400000', () => {
    expect(interpretPlatelets(250000)).toBe('normal');
  });

  it('returns high for PLT > 400000', () => {
    expect(interpretPlatelets(500000)).toBe('high');
  });
});

describe('interpretECOGStatus', () => {
  it('returns normal for score 0', () => {
    expect(interpretECOGStatus(0)).toBe('normal');
  });

  it('returns low for scores 1-2', () => {
    expect(interpretECOGStatus(1)).toBe('low');
    expect(interpretECOGStatus(2)).toBe('low');
  });

  it('returns high for score 3', () => {
    expect(interpretECOGStatus(3)).toBe('high');
  });

  it('returns critical for score 4', () => {
    expect(interpretECOGStatus(4)).toBe('critical');
  });
});

// =====================================================
// LOINC Codes
// =====================================================

describe('ONCOLOGY_LOINC_CODES', () => {
  it('has correct TNM staging codes', () => {
    expect(ONCOLOGY_LOINC_CODES.TNM_T).toBe('21905-5');
    expect(ONCOLOGY_LOINC_CODES.TNM_N).toBe('21906-3');
    expect(ONCOLOGY_LOINC_CODES.TNM_M).toBe('21907-1');
    expect(ONCOLOGY_LOINC_CODES.OVERALL_STAGE).toBe('21908-9');
  });

  it('has correct tumor marker codes', () => {
    expect(ONCOLOGY_LOINC_CODES.CEA).toBe('2039-6');
    expect(ONCOLOGY_LOINC_CODES.CA_125).toBe('10334-1');
    expect(ONCOLOGY_LOINC_CODES.PSA).toBe('2857-1');
  });

  it('has correct hematology codes', () => {
    expect(ONCOLOGY_LOINC_CODES.WBC).toBe('6690-2');
    expect(ONCOLOGY_LOINC_CODES.ANC).toBe('751-8');
    expect(ONCOLOGY_LOINC_CODES.HEMOGLOBIN).toBe('718-7');
    expect(ONCOLOGY_LOINC_CODES.PLATELETS).toBe('777-3');
  });
});

// =====================================================
// SNOMED Codes
// =====================================================

describe('ONCOLOGY_SNOMED_CODES', () => {
  it('has codes for cancer types', () => {
    expect(ONCOLOGY_SNOMED_CODES.BREAST_CANCER).toBeDefined();
    expect(ONCOLOGY_SNOMED_CODES.LUNG_CANCER).toBeDefined();
    expect(ONCOLOGY_SNOMED_CODES.COLORECTAL_CANCER).toBeDefined();
    expect(ONCOLOGY_SNOMED_CODES.LYMPHOMA).toBeDefined();
  });

  it('has codes for oncology procedures', () => {
    expect(ONCOLOGY_SNOMED_CODES.CHEMOTHERAPY).toBeDefined();
    expect(ONCOLOGY_SNOMED_CODES.RADIATION_THERAPY).toBeDefined();
    expect(ONCOLOGY_SNOMED_CODES.IMMUNOTHERAPY).toBeDefined();
  });

  it('has codes for side effects', () => {
    expect(ONCOLOGY_SNOMED_CODES.FEBRILE_NEUTROPENIA).toBeDefined();
    expect(ONCOLOGY_SNOMED_CODES.NEUTROPENIA).toBeDefined();
    expect(ONCOLOGY_SNOMED_CODES.NEUROPATHY).toBeDefined();
  });
});
