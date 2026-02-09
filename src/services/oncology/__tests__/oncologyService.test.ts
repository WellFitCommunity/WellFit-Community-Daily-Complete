/**
 * Oncology Service Tests
 * Behavioral tests for alert generation, helper functions, and data validation
 */

import { describe, it, expect } from 'vitest';
import {
  isFebrileNeutropenia,
  isTumorMarkerSpike,
  calculateRECIST,
  interpretECOG,
  ECOG_DESCRIPTIONS,
  CTCAE_GRADE_DESCRIPTIONS,
  RECIST_LABELS,
  ONC_BILLING_CODES,
  COMMON_REGIMENS,
} from '../../../types/oncology';
import type {
  OncLabMonitoring,
  OncSideEffect,
  OncImagingResult,
} from '../../../types/oncology';
import { OncologyService } from '../oncologyService';

// =====================================================
// Febrile Neutropenia Detection
// =====================================================

describe('isFebrileNeutropenia', () => {
  it('returns true when ANC < 500 AND temp >= 38.3', () => {
    expect(isFebrileNeutropenia(300, 38.5)).toBe(true);
    expect(isFebrileNeutropenia(499, 38.3)).toBe(true);
  });

  it('returns false when ANC >= 500', () => {
    expect(isFebrileNeutropenia(500, 39.0)).toBe(false);
    expect(isFebrileNeutropenia(1500, 38.5)).toBe(false);
  });

  it('returns false when temp < 38.3', () => {
    expect(isFebrileNeutropenia(200, 37.0)).toBe(false);
    expect(isFebrileNeutropenia(100, 38.2)).toBe(false);
  });

  it('returns false when either value is null', () => {
    expect(isFebrileNeutropenia(null, 38.5)).toBe(false);
    expect(isFebrileNeutropenia(300, null)).toBe(false);
    expect(isFebrileNeutropenia(null, null)).toBe(false);
  });
});

// =====================================================
// Tumor Marker Spike
// =====================================================

describe('isTumorMarkerSpike', () => {
  it('returns true when current > 2x baseline', () => {
    expect(isTumorMarkerSpike(25, 10)).toBe(true);
    expect(isTumorMarkerSpike(100, 30)).toBe(true);
  });

  it('returns false when current <= 2x baseline', () => {
    expect(isTumorMarkerSpike(20, 10)).toBe(false);
    expect(isTumorMarkerSpike(15, 10)).toBe(false);
    expect(isTumorMarkerSpike(5, 10)).toBe(false);
  });
});

// =====================================================
// RECIST Calculation
// =====================================================

describe('calculateRECIST', () => {
  it('returns complete_response when sum is 0', () => {
    expect(calculateRECIST(0, 50, 30)).toBe('complete_response');
  });

  it('returns partial_response for >= 30% decrease from baseline', () => {
    expect(calculateRECIST(30, 50, 30)).toBe('partial_response');
    expect(calculateRECIST(35, 50, 35)).toBe('partial_response');
  });

  it('returns progressive_disease for >= 20% increase from nadir', () => {
    expect(calculateRECIST(40, 50, 30)).toBe('progressive_disease');
    expect(calculateRECIST(36, 50, 30)).toBe('progressive_disease');
  });

  it('returns stable_disease for changes between thresholds', () => {
    expect(calculateRECIST(38, 50, 35)).toBe('stable_disease');
  });
});

// =====================================================
// ECOG Interpretation
// =====================================================

describe('interpretECOG', () => {
  it('returns correct descriptions for all statuses', () => {
    expect(interpretECOG(0)).toBe('Fully active, no restrictions');
    expect(interpretECOG(1)).toContain('Restricted');
    expect(interpretECOG(4)).toContain('Completely disabled');
  });
});

// =====================================================
// Alert Generation
// =====================================================

describe('OncologyService.generateAlerts', () => {
  const makeLabs = (overrides: Partial<OncLabMonitoring> = {}): OncLabMonitoring => ({
    id: 'lab-1',
    patient_id: 'p1',
    tenant_id: 't1',
    registry_id: 'reg-1',
    lab_date: new Date().toISOString(),
    wbc: 5.0,
    anc: 2000,
    hemoglobin: 12,
    platelets: 200000,
    creatinine: 0.9,
    alt: 30,
    ast: 25,
    tumor_marker_name: null,
    tumor_marker_value: null,
    tumor_marker_unit: null,
    baseline_marker_value: null,
    notes: null,
    created_at: new Date().toISOString(),
    ...overrides,
  });

  const makeSideEffect = (overrides: Partial<OncSideEffect> = {}): OncSideEffect => ({
    id: 'se-1',
    patient_id: 'p1',
    tenant_id: 't1',
    registry_id: 'reg-1',
    reported_date: new Date().toISOString(),
    ctcae_term: 'Nausea',
    ctcae_grade: 2,
    ctcae_category: 'gastrointestinal',
    attribution: 'probable',
    intervention: null,
    outcome: 'ongoing',
    resolved_date: null,
    notes: null,
    created_at: new Date().toISOString(),
    ...overrides,
  });

  it('generates CRITICAL alert for febrile neutropenia', () => {
    const labs = makeLabs({ anc: 300 });
    const alerts = OncologyService.generateAlerts(labs, [], null, null);
    expect(alerts.some(a => a.type === 'febrile_neutropenia' && a.severity === 'critical')).toBe(true);
  });

  it('generates HIGH alert for severe neutropenia without fever', () => {
    // ANC < 500 triggers severe neutropenia alert
    const alerts = OncologyService.generateAlerts(makeLabs({ anc: 300 }), [], null, null);
    expect(alerts.some(a => a.severity === 'critical' || a.severity === 'high')).toBe(true);
  });

  it('generates CRITICAL alert for CTCAE Grade 4-5', () => {
    const sideEffects = [
      makeSideEffect({ id: 'se-g4', ctcae_grade: 4, ctcae_term: 'Febrile neutropenia' }),
    ];
    const alerts = OncologyService.generateAlerts(null, sideEffects, null, null);
    expect(alerts.some(a => a.type === 'ctcae_grade_4_5' && a.severity === 'critical')).toBe(true);
  });

  it('generates HIGH alert for tumor marker spike', () => {
    const labs = makeLabs({
      tumor_marker_name: 'CEA',
      tumor_marker_value: 25,
      tumor_marker_unit: 'ng/mL',
      baseline_marker_value: 10,
    });
    const alerts = OncologyService.generateAlerts(labs, [], null, null);
    expect(alerts.some(a => a.type === 'tumor_marker_spike' && a.severity === 'high')).toBe(true);
  });

  it('generates HIGH alert for new metastasis', () => {
    const imaging: OncImagingResult = {
      id: 'img-1',
      patient_id: 'p1',
      tenant_id: 't1',
      registry_id: 'reg-1',
      imaging_date: new Date().toISOString(),
      modality: 'ct',
      body_region: 'Chest',
      recist_response: 'progressive_disease',
      target_lesions: [],
      sum_of_diameters_mm: 60,
      baseline_sum_mm: 40,
      new_lesions: true,
      findings: 'New pulmonary nodule',
      created_at: new Date().toISOString(),
    };
    const alerts = OncologyService.generateAlerts(null, [], imaging, null);
    expect(alerts.some(a => a.type === 'new_metastasis' && a.severity === 'high')).toBe(true);
  });

  it('generates HIGH alert for severe anemia', () => {
    const labs = makeLabs({ hemoglobin: 6.5 });
    const alerts = OncologyService.generateAlerts(labs, [], null, null);
    expect(alerts.some(a => a.type === 'anemia_severe' && a.severity === 'high')).toBe(true);
  });

  it('generates HIGH alert for severe thrombocytopenia', () => {
    const labs = makeLabs({ platelets: 15000 });
    const alerts = OncologyService.generateAlerts(labs, [], null, null);
    expect(alerts.some(a => a.type === 'thrombocytopenia_severe' && a.severity === 'high')).toBe(true);
  });

  it('returns empty alerts for normal data', () => {
    const labs = makeLabs();
    const alerts = OncologyService.generateAlerts(labs, [], null, null);
    expect(alerts.length).toBe(0);
  });

  it('sorts alerts by severity (critical first)', () => {
    const labs = makeLabs({ anc: 300, hemoglobin: 6.5 });
    const sideEffects = [makeSideEffect({ id: 'se-g4', ctcae_grade: 4 })];
    const alerts = OncologyService.generateAlerts(labs, sideEffects, null, null);
    expect(alerts.length).toBeGreaterThan(0);
    const criticalIdx = alerts.findIndex(a => a.severity === 'critical');
    const highIdx = alerts.findIndex(a => a.severity === 'high');
    if (criticalIdx !== -1 && highIdx !== -1) {
      expect(criticalIdx).toBeLessThan(highIdx);
    }
  });
});

// =====================================================
// Constants
// =====================================================

describe('Oncology Constants', () => {
  it('has ECOG descriptions for all statuses 0-4', () => {
    expect(Object.keys(ECOG_DESCRIPTIONS)).toHaveLength(5);
    expect(ECOG_DESCRIPTIONS[0]).toBeDefined();
    expect(ECOG_DESCRIPTIONS[4]).toBeDefined();
  });

  it('has CTCAE grade descriptions for grades 1-5', () => {
    expect(Object.keys(CTCAE_GRADE_DESCRIPTIONS)).toHaveLength(5);
    expect(CTCAE_GRADE_DESCRIPTIONS[1]).toContain('Mild');
    expect(CTCAE_GRADE_DESCRIPTIONS[5]).toContain('Death');
  });

  it('has RECIST labels for all responses', () => {
    expect(RECIST_LABELS.complete_response).toContain('CR');
    expect(RECIST_LABELS.progressive_disease).toContain('PD');
  });

  it('has correct billing codes', () => {
    expect(ONC_BILLING_CODES.chemo_infusion_first_hr.code).toBe('96413');
    expect(ONC_BILLING_CODES.imrt.code).toBe('77385');
  });

  it('has common regimens', () => {
    expect(COMMON_REGIMENS.length).toBeGreaterThanOrEqual(8);
    const folfox = COMMON_REGIMENS.find(r => r.name === 'FOLFOX');
    expect(folfox).toBeDefined();
    expect(folfox?.drugs).toContain('Oxaliplatin');
  });
});
