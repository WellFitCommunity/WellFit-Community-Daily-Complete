/**
 * Cardiology Service Tests
 * Behavioral tests for alert generation, helper functions, and data validation
 */

import { describe, it, expect } from 'vitest';
import {
  calculateCHA2DS2VASc,
  interpretLVEF,
  interpretBNP,
  getWeightChangeAlert,
  NYHA_DESCRIPTIONS,
  STENOSIS_LABELS,
  CARDIAC_BILLING_CODES,
} from '../../../types/cardiology';
import type {
  CardEcgResult,
  CardEchoResult,
  CardHeartFailure,
  CardDeviceMonitoring,
  CardArrhythmiaEvent,
} from '../../../types/cardiology';
import { CardiologyService } from '../cardiologyService';

// =====================================================
// CHA2DS2-VASc Score Calculation
// =====================================================

describe('calculateCHA2DS2VASc', () => {
  it('returns 0 for a young male with no risk factors', () => {
    const score = calculateCHA2DS2VASc({
      age: 45,
      isFemale: false,
      hasChf: false,
      hasHypertension: false,
      hasDiabetes: false,
      hasStrokeTia: false,
      hasVascularDisease: false,
    });
    expect(score).toBe(0);
  });

  it('adds 2 points for stroke/TIA history', () => {
    const score = calculateCHA2DS2VASc({
      age: 45,
      isFemale: false,
      hasChf: false,
      hasHypertension: false,
      hasDiabetes: false,
      hasStrokeTia: true,
      hasVascularDisease: false,
    });
    expect(score).toBe(2);
  });

  it('adds 2 points for age >= 75', () => {
    const score = calculateCHA2DS2VASc({
      age: 78,
      isFemale: false,
      hasChf: false,
      hasHypertension: false,
      hasDiabetes: false,
      hasStrokeTia: false,
      hasVascularDisease: false,
    });
    expect(score).toBe(2);
  });

  it('adds 1 point for age 65-74', () => {
    const score = calculateCHA2DS2VASc({
      age: 70,
      isFemale: false,
      hasChf: false,
      hasHypertension: false,
      hasDiabetes: false,
      hasStrokeTia: false,
      hasVascularDisease: false,
    });
    expect(score).toBe(1);
  });

  it('calculates maximum score of 9', () => {
    const score = calculateCHA2DS2VASc({
      age: 80,
      isFemale: true,
      hasChf: true,
      hasHypertension: true,
      hasDiabetes: true,
      hasStrokeTia: true,
      hasVascularDisease: true,
    });
    expect(score).toBe(9);
  });

  it('adds 1 point each for CHF, HTN, DM, vascular disease, female', () => {
    const score = calculateCHA2DS2VASc({
      age: 45,
      isFemale: true,
      hasChf: true,
      hasHypertension: true,
      hasDiabetes: true,
      hasStrokeTia: false,
      hasVascularDisease: true,
    });
    expect(score).toBe(5);
  });
});

// =====================================================
// LVEF Interpretation
// =====================================================

describe('interpretLVEF', () => {
  it('returns Normal for EF >= 55', () => {
    expect(interpretLVEF(60)).toBe('Normal');
    expect(interpretLVEF(55)).toBe('Normal');
    expect(interpretLVEF(70)).toBe('Normal');
  });

  it('returns mildly reduced for EF 40-54', () => {
    expect(interpretLVEF(45)).toContain('Mildly reduced');
    expect(interpretLVEF(40)).toContain('Mildly reduced');
  });

  it('returns moderately reduced for EF 30-39', () => {
    expect(interpretLVEF(35)).toContain('Moderately reduced');
    expect(interpretLVEF(30)).toContain('Moderately reduced');
  });

  it('returns severely reduced for EF < 30', () => {
    expect(interpretLVEF(20)).toContain('Severely reduced');
    expect(interpretLVEF(10)).toContain('Severely reduced');
  });
});

// =====================================================
// BNP Interpretation
// =====================================================

describe('interpretBNP', () => {
  it('identifies normal BNP < 100', () => {
    expect(interpretBNP(50)).toContain('unlikely');
  });

  it('identifies indeterminate BNP 100-399', () => {
    expect(interpretBNP(200)).toContain('Indeterminate');
  });

  it('identifies elevated BNP 400-999', () => {
    expect(interpretBNP(600)).toContain('likely');
  });

  it('identifies markedly elevated BNP >= 1000', () => {
    expect(interpretBNP(1500)).toContain('severe');
  });
});

// =====================================================
// Weight Change Alert
// =====================================================

describe('getWeightChangeAlert', () => {
  it('returns null for minimal weight gain', () => {
    expect(getWeightChangeAlert(0.5)).toBeNull();
  });

  it('returns medium for 2+ lb gain', () => {
    // 2 lbs = ~0.91 kg
    expect(getWeightChangeAlert(0.91)).toBe('medium');
  });

  it('returns high for 3+ lb gain per day', () => {
    // 3 lbs = ~1.36 kg
    expect(getWeightChangeAlert(1.4)).toBe('high');
  });

  it('returns null for weight loss', () => {
    expect(getWeightChangeAlert(-1.0)).toBeNull();
  });
});

// =====================================================
// Alert Generation
// =====================================================

describe('CardiologyService.generateAlerts', () => {
  const makeEcg = (overrides: Partial<CardEcgResult> = {}): CardEcgResult => ({
    id: 'ecg-1',
    patient_id: 'p1',
    tenant_id: 't1',
    registry_id: 'r1',
    performed_date: new Date().toISOString(),
    performed_by: null,
    rhythm: 'normal_sinus',
    heart_rate: 72,
    pr_interval_ms: 160,
    qrs_duration_ms: 90,
    qtc_ms: 420,
    axis_degrees: 0,
    st_changes: 'none',
    is_stemi: false,
    interpretation: null,
    is_normal: true,
    findings: [],
    created_at: new Date().toISOString(),
    ...overrides,
  });

  const makeEcho = (overrides: Partial<CardEchoResult> = {}): CardEchoResult => ({
    id: 'echo-1',
    patient_id: 'p1',
    tenant_id: 't1',
    registry_id: 'r1',
    performed_date: new Date().toISOString(),
    performed_by: null,
    lvef_percent: 55,
    rv_function: 'normal',
    lv_end_diastolic_diameter_mm: null,
    lv_end_systolic_diameter_mm: null,
    lv_mass_index: null,
    wall_motion_abnormalities: [],
    valve_results: [],
    pericardial_effusion: false,
    diastolic_function: null,
    interpretation: null,
    created_at: new Date().toISOString(),
    ...overrides,
  });

  it('generates CRITICAL alert for STEMI', () => {
    const alerts = CardiologyService.generateAlerts(
      makeEcg({ is_stemi: true }), null, null, null, []
    );
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].type).toBe('stemi_detected');
  });

  it('generates CRITICAL alert for EF < 20%', () => {
    const alerts = CardiologyService.generateAlerts(
      null, makeEcho({ lvef_percent: 15 }), null, null, []
    );
    expect(alerts.some(a => a.type === 'low_ef' && a.severity === 'critical')).toBe(true);
  });

  it('generates HIGH alert for AFib with RVR', () => {
    const afibEvent: CardArrhythmiaEvent = {
      id: 'arr-1',
      patient_id: 'p1',
      tenant_id: 't1',
      registry_id: 'r1',
      event_date: new Date().toISOString(),
      detected_by: 'ecg',
      type: 'atrial_fibrillation',
      duration_seconds: 300,
      heart_rate_during: 140,
      hemodynamically_stable: true,
      symptoms: [],
      treatment_given: null,
      cardioversion_performed: false,
      notes: null,
      created_at: new Date().toISOString(),
    };
    const alerts = CardiologyService.generateAlerts(null, null, null, null, [afibEvent]);
    expect(alerts.some(a => a.type === 'new_afib_rvr' && a.severity === 'high')).toBe(true);
  });

  it('generates HIGH alert for BNP > 1000', () => {
    const hf: CardHeartFailure = {
      id: 'hf-1',
      patient_id: 'p1',
      tenant_id: 't1',
      registry_id: 'r1',
      assessment_date: new Date().toISOString(),
      assessed_by: null,
      nyha_class: 'III',
      bnp_pg_ml: 1500,
      nt_pro_bnp_pg_ml: null,
      daily_weight_kg: 85,
      previous_weight_kg: 83,
      weight_change_kg: 2,
      fluid_status: 'hypervolemic',
      edema_grade: 2,
      dyspnea_at_rest: true,
      orthopnea: true,
      pnd: false,
      jugular_venous_distension: true,
      crackles: true,
      s3_gallop: false,
      fluid_restriction_ml: 1500,
      sodium_restriction_mg: 2000,
      diuretic_adjustment: null,
      notes: null,
      created_at: new Date().toISOString(),
    };
    const alerts = CardiologyService.generateAlerts(null, null, hf, null, []);
    expect(alerts.some(a => a.type === 'bnp_elevated')).toBe(true);
  });

  it('generates HIGH alert for device end of life', () => {
    const device: CardDeviceMonitoring = {
      id: 'dev-1',
      patient_id: 'p1',
      tenant_id: 't1',
      registry_id: 'r1',
      device_type: 'icd',
      device_manufacturer: 'Medtronic',
      device_model: 'Evera',
      implant_date: '2020-01-01',
      check_date: new Date().toISOString(),
      checked_by: null,
      battery_status: 'end_of_life',
      battery_voltage: 2.4,
      battery_longevity_months: 3,
      atrial_pacing_percent: 5,
      ventricular_pacing_percent: 40,
      lead_impedance_atrial_ohms: 500,
      lead_impedance_ventricular_ohms: 450,
      sensing_atrial_mv: 2.0,
      sensing_ventricular_mv: 8.0,
      threshold_atrial_v: 0.5,
      threshold_ventricular_v: 0.75,
      shocks_delivered: 0,
      anti_tachycardia_pacing_events: 2,
      atrial_arrhythmia_burden_percent: 5,
      alerts: [],
      notes: null,
      created_at: new Date().toISOString(),
    };
    const alerts = CardiologyService.generateAlerts(null, null, null, device, []);
    expect(alerts.some(a => a.type === 'device_alert' && a.severity === 'high')).toBe(true);
  });

  it('returns empty alerts for normal data', () => {
    const alerts = CardiologyService.generateAlerts(
      makeEcg(), makeEcho(), null, null, []
    );
    expect(alerts.length).toBe(0);
  });

  it('sorts alerts by severity (critical first)', () => {
    const alerts = CardiologyService.generateAlerts(
      makeEcg({ is_stemi: true, heart_rate: 45, rhythm: 'sinus_bradycardia' }),
      makeEcho({ lvef_percent: 15 }),
      null,
      null,
      []
    );
    expect(alerts.length).toBeGreaterThanOrEqual(2);
    expect(alerts[0].severity).toBe('critical');
  });
});

// =====================================================
// Constants Validation
// =====================================================

describe('Cardiology Constants', () => {
  it('NYHA_DESCRIPTIONS covers all 4 classes', () => {
    expect(Object.keys(NYHA_DESCRIPTIONS)).toHaveLength(4);
    expect(NYHA_DESCRIPTIONS.I).toBeDefined();
    expect(NYHA_DESCRIPTIONS.IV).toContain('rest');
  });

  it('STENOSIS_LABELS covers all grades', () => {
    expect(Object.keys(STENOSIS_LABELS)).toHaveLength(6);
    expect(STENOSIS_LABELS.total_occlusion).toContain('100%');
  });

  it('CARDIAC_BILLING_CODES has correct CPT codes', () => {
    expect(CARDIAC_BILLING_CODES.ecg_12_lead.code).toBe('93000');
    expect(CARDIAC_BILLING_CODES.echocardiogram_tte.code).toBe('93306');
    expect(CARDIAC_BILLING_CODES.left_heart_cath.code).toBe('93452');
  });
});
