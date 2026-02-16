/**
 * Labor & Delivery Service Tests
 * Behavioral tests for alert generation, helper functions, and data validation
 */

import { describe, it, expect } from 'vitest';
import {
  calculateGestationalAge,
  interpretAPGAR,
  isSeverePreeclampsia,
  classifyFetalHR,
  RISK_FACTOR_OPTIONS,
  LD_BILLING_CODES,
} from '../../../types/laborDelivery';
import type {
  LDPregnancy,
  LDPrenatalVisit,
  LDFetalMonitoring,
  LDDeliveryRecord,
  LDNewbornAssessment,
  LDAlert,
} from '../../../types/laborDelivery';
import { generateLDAlerts } from '../laborDeliveryAlerts';

// =====================================================
// Gestational Age Calculation
// =====================================================

describe('calculateGestationalAge', () => {
  it('returns positive weeks for future EDD', () => {
    const futureEdd = new Date();
    futureEdd.setDate(futureEdd.getDate() + 70); // 10 weeks from now = ~30 weeks GA
    const ga = calculateGestationalAge(futureEdd.toISOString());
    expect(ga.weeks).toBeGreaterThan(0);
    expect(ga.days).toBeGreaterThanOrEqual(0);
    expect(ga.days).toBeLessThan(7);
  });

  it('returns 40 weeks for EDD = today (date-only)', () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const ga = calculateGestationalAge(todayStr);
    expect(ga.weeks).toBe(40);
    expect(ga.days).toBeGreaterThanOrEqual(0);
    expect(ga.days).toBeLessThanOrEqual(1);
  });

  it('returns weeks > 40 for past EDD (post-dates)', () => {
    const pastEdd = new Date();
    pastEdd.setDate(pastEdd.getDate() - 7);
    const ga = calculateGestationalAge(pastEdd.toISOString());
    expect(ga.weeks).toBe(41);
  });
});

// =====================================================
// APGAR Interpretation
// =====================================================

describe('interpretAPGAR', () => {
  it('returns Reassuring for score >= 7', () => {
    expect(interpretAPGAR(8)).toBe('Reassuring');
    expect(interpretAPGAR(9)).toBe('Reassuring');
    expect(interpretAPGAR(10)).toBe('Reassuring');
    expect(interpretAPGAR(7)).toBe('Reassuring');
  });

  it('returns moderately depressed for score 4-6', () => {
    expect(interpretAPGAR(5)).toContain('Moderately depressed');
    expect(interpretAPGAR(4)).toContain('Moderately depressed');
  });

  it('returns severely depressed for score < 4', () => {
    expect(interpretAPGAR(2)).toContain('Severely depressed');
    expect(interpretAPGAR(0)).toContain('Severely depressed');
  });
});

// =====================================================
// Preeclampsia Detection
// =====================================================

describe('isSeverePreeclampsia', () => {
  it('returns true for systolic >= 160', () => {
    expect(isSeverePreeclampsia(165, 90)).toBe(true);
    expect(isSeverePreeclampsia(160, 85)).toBe(true);
  });

  it('returns true for diastolic >= 110', () => {
    expect(isSeverePreeclampsia(140, 115)).toBe(true);
    expect(isSeverePreeclampsia(130, 110)).toBe(true);
  });

  it('returns false for normal BP', () => {
    expect(isSeverePreeclampsia(120, 80)).toBe(false);
    expect(isSeverePreeclampsia(140, 90)).toBe(false);
  });
});

// =====================================================
// Fetal Heart Rate Classification
// =====================================================

describe('classifyFetalHR', () => {
  it('returns Bradycardia for FHR < 110', () => {
    expect(classifyFetalHR(100)).toBe('Bradycardia');
    expect(classifyFetalHR(90)).toBe('Bradycardia');
  });

  it('returns Normal for FHR 110-160', () => {
    expect(classifyFetalHR(140)).toBe('Normal');
    expect(classifyFetalHR(110)).toBe('Normal');
    expect(classifyFetalHR(160)).toBe('Normal');
  });

  it('returns Tachycardia for FHR > 160', () => {
    expect(classifyFetalHR(175)).toBe('Tachycardia');
  });
});

// =====================================================
// Alert Generation
// =====================================================

describe('generateLDAlerts', () => {
  const makePregnancy = (overrides: Partial<LDPregnancy> = {}): LDPregnancy => ({
    id: 'preg-1',
    patient_id: 'p1',
    tenant_id: 't1',
    gravida: 1,
    para: 0,
    ab: 0,
    living: 0,
    edd: '2026-05-15',
    lmp: null,
    blood_type: 'A+',
    rh_factor: 'positive',
    gbs_status: 'negative',
    risk_level: 'low',
    risk_factors: [],
    status: 'active',
    primary_provider_id: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  });

  it('generates CRITICAL alert for fetal bradycardia', () => {
    const monitoring: LDFetalMonitoring = {
      id: 'fm-1',
      patient_id: 'p1',
      tenant_id: 't1',
      pregnancy_id: 'preg-1',
      assessment_time: new Date().toISOString(),
      assessed_by: null,
      fhr_baseline: 95,
      variability: 'minimal',
      accelerations_present: false,
      deceleration_type: 'late',
      deceleration_depth_bpm: 30,
      fhr_category: 'III',
      uterine_activity: null,
      interpretation: null,
      action_taken: null,
      created_at: new Date().toISOString(),
    };

    const alerts = generateLDAlerts(
      null, [], monitoring, null, null, null
    );
    expect(alerts.some((a: LDAlert) => a.type === 'fetal_bradycardia' && a.severity === 'critical')).toBe(true);
  });

  it('generates CRITICAL alert for Category III tracing', () => {
    const monitoring: LDFetalMonitoring = {
      id: 'fm-2',
      patient_id: 'p1',
      tenant_id: 't1',
      pregnancy_id: 'preg-1',
      assessment_time: new Date().toISOString(),
      assessed_by: null,
      fhr_baseline: 130,
      variability: 'absent',
      accelerations_present: false,
      deceleration_type: 'late',
      deceleration_depth_bpm: null,
      fhr_category: 'III',
      uterine_activity: null,
      interpretation: null,
      action_taken: null,
      created_at: new Date().toISOString(),
    };

    const alerts = generateLDAlerts(
      null, [], monitoring, null, null, null
    );
    expect(alerts.some((a: LDAlert) => a.type === 'category_iii_tracing')).toBe(true);
  });

  it('generates CRITICAL alert for severe preeclampsia', () => {
    const visit: LDPrenatalVisit = {
      id: 'pv-1',
      patient_id: 'p1',
      tenant_id: 't1',
      pregnancy_id: 'preg-1',
      visit_date: new Date().toISOString(),
      provider_id: null,
      gestational_age_weeks: 34,
      gestational_age_days: 2,
      fundal_height_cm: 32,
      fetal_heart_rate: 145,
      fetal_presentation: null,
      weight_kg: 80,
      bp_systolic: 170,
      bp_diastolic: 115,
      urine_protein: '+3',
      urine_glucose: null,
      cervical_dilation_cm: null,
      cervical_effacement_percent: null,
      cervical_station: null,
      edema: true,
      complaints: [],
      notes: null,
      created_at: new Date().toISOString(),
    };

    const alerts = generateLDAlerts(
      null, [visit], null, null, null, null
    );
    expect(alerts.some((a: LDAlert) => a.type === 'severe_preeclampsia' && a.severity === 'critical')).toBe(true);
  });

  it('generates CRITICAL alert for postpartum hemorrhage', () => {
    const delivery: LDDeliveryRecord = {
      id: 'del-1',
      patient_id: 'p1',
      tenant_id: 't1',
      pregnancy_id: 'preg-1',
      delivery_datetime: new Date().toISOString(),
      delivery_provider_id: null,
      method: 'cesarean_emergent',
      anesthesia: 'general',
      labor_duration_hours: null,
      second_stage_duration_min: null,
      estimated_blood_loss_ml: 1500,
      complications: ['postpartum_hemorrhage'],
      episiotomy: false,
      laceration_degree: null,
      cord_clamping: 'immediate',
      cord_gases_ph: null,
      cord_gases_base_excess: null,
      placenta_delivery_time: null,
      placenta_intact: true,
      notes: null,
      created_at: new Date().toISOString(),
    };

    const alerts = generateLDAlerts(
      null, [], null, delivery, null, null
    );
    expect(alerts.some((a: LDAlert) => a.type === 'postpartum_hemorrhage' && a.severity === 'critical')).toBe(true);
  });

  it('generates CRITICAL alert for neonatal distress (APGAR < 4)', () => {
    const newborn: LDNewbornAssessment = {
      id: 'nb-1',
      patient_id: 'p1',
      tenant_id: 't1',
      pregnancy_id: 'preg-1',
      delivery_id: 'del-1',
      newborn_patient_id: null,
      birth_datetime: new Date().toISOString(),
      sex: 'male',
      weight_g: 3200,
      length_cm: 50,
      head_circumference_cm: 34,
      apgar_1_min: 2,
      apgar_5_min: 3,
      apgar_10_min: 5,
      ballard_gestational_age_weeks: null,
      temperature_c: null,
      heart_rate: null,
      respiratory_rate: null,
      disposition: 'nicu',
      skin_color: null,
      reflexes: null,
      anomalies: [],
      vitamin_k_given: true,
      erythromycin_given: true,
      hepatitis_b_vaccine: false,
      notes: null,
      created_at: new Date().toISOString(),
    };

    const alerts = generateLDAlerts(
      null, [], null, null, newborn, null
    );
    expect(alerts.some((a: LDAlert) => a.type === 'neonatal_distress' && a.severity === 'critical')).toBe(true);
  });

  it('generates HIGH alert for GBS positive', () => {
    const alerts = generateLDAlerts(
      makePregnancy({ gbs_status: 'positive' }), [], null, null, null, null
    );
    expect(alerts.some((a: LDAlert) => a.type === 'gbs_no_antibiotics' && a.severity === 'high')).toBe(true);
  });

  it('returns empty alerts for normal data', () => {
    const alerts = generateLDAlerts(
      makePregnancy(), [], null, null, null, null
    );
    expect(alerts.length).toBe(0);
  });
});

// =====================================================
// Constants
// =====================================================

describe('L&D Constants', () => {
  it('has common risk factors', () => {
    expect(RISK_FACTOR_OPTIONS.length).toBeGreaterThan(10);
    expect(RISK_FACTOR_OPTIONS).toContain('Gestational diabetes');
    expect(RISK_FACTOR_OPTIONS).toContain('Preeclampsia');
  });

  it('has correct billing codes', () => {
    expect(LD_BILLING_CODES.vaginal_delivery.code).toBe('59400');
    expect(LD_BILLING_CODES.cesarean_delivery.code).toBe('59510');
    expect(LD_BILLING_CODES.nst.code).toBe('59025');
  });
});
