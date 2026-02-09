/**
 * L&D FHIR Observation Tests
 * Tests for FHIR resource building and interpretation helpers
 */

import { describe, it, expect } from 'vitest';
import { buildLDObservation, interpretFetalHeartRate, interpretAPGARScore, interpretBirthWeight } from '../laborDelivery/helpers';
import { LD_LOINC_CODES, LD_SNOMED_CODES } from '../laborDelivery/codes';

// =====================================================
// Observation Builder
// =====================================================

describe('buildLDObservation', () => {
  it('builds a valid FHIR Observation with required fields', () => {
    const obs = buildLDObservation({
      code: LD_LOINC_CODES.APGAR_1_MIN,
      display: 'APGAR 1 minute',
      patientId: 'newborn-123',
      effectiveDateTime: '2026-02-10T14:30:00Z',
      valueQuantity: {
        value: 8,
        unit: '{score}',
        system: 'http://unitsofmeasure.org',
        code: '{score}',
      },
    });

    expect(obs.resourceType).toBe('Observation');
    expect(obs.status).toBe('final');
    expect(obs.code.coding?.[0]?.code).toBe(LD_LOINC_CODES.APGAR_1_MIN);
    expect(obs.subject.reference).toBe('Patient/newborn-123');
    expect(obs.valueQuantity?.value).toBe(8);
  });

  it('includes performer when provided', () => {
    const obs = buildLDObservation({
      code: LD_LOINC_CODES.FETAL_HEART_RATE,
      display: 'FHR',
      patientId: 'p1',
      performerId: 'dr-jones',
      effectiveDateTime: '2026-02-10T14:30:00Z',
    });
    expect(obs.performer?.[0]?.reference).toBe('Practitioner/dr-jones');
  });

  it('includes reference range', () => {
    const obs = buildLDObservation({
      code: LD_LOINC_CODES.BIRTH_WEIGHT,
      display: 'Birth weight',
      patientId: 'nb-1',
      effectiveDateTime: '2026-02-10T14:30:00Z',
      referenceRangeLow: 2500,
      referenceRangeHigh: 4000,
    });
    expect(obs.referenceRange?.[0]?.low?.value).toBe(2500);
    expect(obs.referenceRange?.[0]?.high?.value).toBe(4000);
  });
});

// =====================================================
// Interpretation Helpers
// =====================================================

describe('interpretFetalHeartRate', () => {
  it('returns critical for FHR < 110 (bradycardia)', () => {
    expect(interpretFetalHeartRate(90)).toBe('critical');
    expect(interpretFetalHeartRate(109)).toBe('critical');
  });

  it('returns normal for FHR 110-160', () => {
    expect(interpretFetalHeartRate(140)).toBe('normal');
    expect(interpretFetalHeartRate(110)).toBe('normal');
    expect(interpretFetalHeartRate(160)).toBe('normal');
  });

  it('returns high for FHR > 160 (tachycardia)', () => {
    expect(interpretFetalHeartRate(170)).toBe('high');
  });
});

describe('interpretAPGARScore', () => {
  it('returns normal for scores >= 7', () => {
    expect(interpretAPGARScore(8)).toBe('normal');
    expect(interpretAPGARScore(10)).toBe('normal');
  });

  it('returns low for scores 4-6', () => {
    expect(interpretAPGARScore(5)).toBe('low');
  });

  it('returns critical for scores < 4', () => {
    expect(interpretAPGARScore(2)).toBe('critical');
    expect(interpretAPGARScore(0)).toBe('critical');
  });
});

describe('interpretBirthWeight', () => {
  it('identifies very low birth weight', () => {
    expect(interpretBirthWeight(1200)).toBe('very low birth weight');
  });

  it('identifies low birth weight', () => {
    expect(interpretBirthWeight(2000)).toBe('low birth weight');
  });

  it('identifies normal birth weight', () => {
    expect(interpretBirthWeight(3200)).toBe('normal');
  });

  it('identifies macrosomia', () => {
    expect(interpretBirthWeight(4500)).toBe('macrosomia');
  });
});

// =====================================================
// LOINC Codes
// =====================================================

describe('LD_LOINC_CODES', () => {
  it('has correct APGAR codes', () => {
    expect(LD_LOINC_CODES.APGAR_1_MIN).toBe('9272-6');
    expect(LD_LOINC_CODES.APGAR_5_MIN).toBe('9273-4');
    expect(LD_LOINC_CODES.APGAR_10_MIN).toBe('9274-2');
  });

  it('has correct fetal heart rate code', () => {
    expect(LD_LOINC_CODES.FETAL_HEART_RATE).toBe('55283-6');
  });

  it('has correct birth weight code', () => {
    expect(LD_LOINC_CODES.BIRTH_WEIGHT).toBe('8339-4');
  });
});

// =====================================================
// SNOMED Codes
// =====================================================

describe('LD_SNOMED_CODES', () => {
  it('has codes for delivery methods', () => {
    expect(LD_SNOMED_CODES.SPONTANEOUS_VAGINAL).toBeDefined();
    expect(LD_SNOMED_CODES.CESAREAN).toBeDefined();
    expect(LD_SNOMED_CODES.VACUUM_DELIVERY).toBeDefined();
  });

  it('has codes for maternal conditions', () => {
    expect(LD_SNOMED_CODES.PREECLAMPSIA).toBeDefined();
    expect(LD_SNOMED_CODES.POSTPARTUM_HEMORRHAGE).toBeDefined();
    expect(LD_SNOMED_CODES.GESTATIONAL_DIABETES).toBeDefined();
  });
});
