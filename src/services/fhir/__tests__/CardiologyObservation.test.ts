/**
 * Cardiology FHIR Observation Tests
 * Tests for FHIR resource building and interpretation helpers
 */

import { describe, it, expect } from 'vitest';
import { buildCardiacObservation, interpretEjectionFraction, interpretHeartRate, interpretBNPLevel, interpretTroponin } from '../cardiology/helpers';
import { CARDIOLOGY_LOINC_CODES, CARDIOLOGY_SNOMED_CODES } from '../cardiology/codes';

// =====================================================
// Observation Builder
// =====================================================

describe('buildCardiacObservation', () => {
  it('builds a valid FHIR Observation with required fields', () => {
    const obs = buildCardiacObservation({
      code: CARDIOLOGY_LOINC_CODES.HEART_RATE,
      display: 'Heart Rate',
      patientId: 'patient-123',
      effectiveDateTime: '2026-02-10T10:00:00Z',
      valueQuantity: {
        value: 72,
        unit: 'beats/min',
        system: 'http://unitsofmeasure.org',
        code: '/min',
      },
    });

    expect(obs.resourceType).toBe('Observation');
    expect(obs.status).toBe('final');
    expect(obs.code.coding?.[0]?.code).toBe(CARDIOLOGY_LOINC_CODES.HEART_RATE);
    expect(obs.subject.reference).toBe('Patient/patient-123');
    expect(obs.valueQuantity?.value).toBe(72);
  });

  it('includes performer when provided', () => {
    const obs = buildCardiacObservation({
      code: CARDIOLOGY_LOINC_CODES.LVEF,
      display: 'LVEF',
      patientId: 'p1',
      performerId: 'dr-smith',
      effectiveDateTime: '2026-02-10T10:00:00Z',
    });

    expect(obs.performer).toBeDefined();
    expect(obs.performer?.[0]?.reference).toBe('Practitioner/dr-smith');
  });

  it('omits performer when not provided', () => {
    const obs = buildCardiacObservation({
      code: CARDIOLOGY_LOINC_CODES.BNP,
      display: 'BNP',
      patientId: 'p1',
      effectiveDateTime: '2026-02-10T10:00:00Z',
    });

    expect(obs.performer).toBeUndefined();
  });

  it('includes reference range when both low and high provided', () => {
    const obs = buildCardiacObservation({
      code: CARDIOLOGY_LOINC_CODES.LVEF,
      display: 'LVEF',
      patientId: 'p1',
      effectiveDateTime: '2026-02-10T10:00:00Z',
      referenceRangeLow: 55,
      referenceRangeHigh: 75,
    });

    expect(obs.referenceRange).toBeDefined();
    expect(obs.referenceRange?.[0]?.low?.value).toBe(55);
    expect(obs.referenceRange?.[0]?.high?.value).toBe(75);
  });

  it('includes interpretation text', () => {
    const obs = buildCardiacObservation({
      code: CARDIOLOGY_LOINC_CODES.HEART_RATE,
      display: 'Heart Rate',
      patientId: 'p1',
      effectiveDateTime: '2026-02-10T10:00:00Z',
      interpretation: 'normal',
    });

    expect(obs.interpretation?.[0]?.text).toBe('normal');
  });

  it('sets correct category for vital signs', () => {
    const obs = buildCardiacObservation({
      code: CARDIOLOGY_LOINC_CODES.HEART_RATE,
      display: 'Heart Rate',
      patientId: 'p1',
      effectiveDateTime: '2026-02-10T10:00:00Z',
      category: 'vital-signs',
    });

    expect(obs.category?.[0]?.coding?.[0]?.code).toBe('vital-signs');
  });
});

// =====================================================
// Interpretation Helpers
// =====================================================

describe('interpretEjectionFraction', () => {
  it('returns normal for EF >= 55', () => {
    expect(interpretEjectionFraction(60)).toBe('normal');
  });

  it('returns low for EF 40-54 (mildly reduced)', () => {
    expect(interpretEjectionFraction(45)).toBe('low');
  });

  it('returns high for EF 30-39 (moderately reduced)', () => {
    expect(interpretEjectionFraction(35)).toBe('high');
  });

  it('returns critical for EF < 30', () => {
    expect(interpretEjectionFraction(15)).toBe('critical');
  });
});

describe('interpretHeartRate', () => {
  it('returns critical for HR < 50 (severe bradycardia)', () => {
    expect(interpretHeartRate(40)).toBe('critical');
  });

  it('returns low for HR 50-59 (mild bradycardia)', () => {
    expect(interpretHeartRate(55)).toBe('low');
  });

  it('returns normal for HR 60-100', () => {
    expect(interpretHeartRate(72)).toBe('normal');
    expect(interpretHeartRate(60)).toBe('normal');
    expect(interpretHeartRate(100)).toBe('normal');
  });

  it('returns high for HR 101-150 (tachycardia)', () => {
    expect(interpretHeartRate(120)).toBe('high');
  });

  it('returns critical for HR > 150', () => {
    expect(interpretHeartRate(180)).toBe('critical');
  });
});

describe('interpretBNPLevel', () => {
  it('returns normal for BNP < 100', () => {
    expect(interpretBNPLevel(50)).toBe('normal');
  });

  it('returns high for BNP 100-399', () => {
    expect(interpretBNPLevel(200)).toBe('high');
  });

  it('returns critical for BNP >= 400', () => {
    expect(interpretBNPLevel(500)).toBe('critical');
    expect(interpretBNPLevel(1500)).toBe('critical');
  });
});

describe('interpretTroponin', () => {
  it('returns normal for troponin < 0.04', () => {
    expect(interpretTroponin(0.01)).toBe('normal');
  });

  it('returns high for troponin 0.04-0.39', () => {
    expect(interpretTroponin(0.1)).toBe('high');
  });

  it('returns critical for troponin >= 0.4', () => {
    expect(interpretTroponin(2.0)).toBe('critical');
  });
});

// =====================================================
// LOINC Code Constants
// =====================================================

describe('CARDIOLOGY_LOINC_CODES', () => {
  it('has correct LVEF code', () => {
    expect(CARDIOLOGY_LOINC_CODES.LVEF).toBe('10230-1');
  });

  it('has correct BNP code', () => {
    expect(CARDIOLOGY_LOINC_CODES.BNP).toBe('42637-9');
  });

  it('has correct Troponin-I code', () => {
    expect(CARDIOLOGY_LOINC_CODES.TROPONIN_I).toBe('10839-9');
  });

  it('has correct ECG code', () => {
    expect(CARDIOLOGY_LOINC_CODES.ECG_12_LEAD).toBe('11524-6');
  });

  it('has correct Heart Rate code', () => {
    expect(CARDIOLOGY_LOINC_CODES.HEART_RATE).toBe('8867-4');
  });
});

// =====================================================
// SNOMED Codes
// =====================================================

describe('CARDIOLOGY_SNOMED_CODES', () => {
  it('has standard codes for common cardiac conditions', () => {
    expect(CARDIOLOGY_SNOMED_CODES.HEART_FAILURE).toBe('84114007');
    expect(CARDIOLOGY_SNOMED_CODES.ATRIAL_FIBRILLATION).toBe('49436004');
    expect(CARDIOLOGY_SNOMED_CODES.CORONARY_ARTERY_DISEASE).toBe('53741008');
    expect(CARDIOLOGY_SNOMED_CODES.STEMI).toBe('401303003');
  });

  it('has codes for cardiac procedures', () => {
    expect(CARDIOLOGY_SNOMED_CODES.ECG_PROCEDURE).toBeDefined();
    expect(CARDIOLOGY_SNOMED_CODES.ECHOCARDIOGRAM).toBeDefined();
    expect(CARDIOLOGY_SNOMED_CODES.CARDIAC_CATHETERIZATION).toBeDefined();
    expect(CARDIOLOGY_SNOMED_CODES.CARDIAC_REHAB).toBeDefined();
  });
});
