/**
 * Labor & Delivery Billing Service Tests
 * Tier 2-3: Tests CPT code suggestion logic
 */

import { describe, it, expect, vi } from 'vitest';
import { suggestBillingCodes } from '../laborDeliveryBilling';
import type {
  LDDeliveryRecord,
  LDNewbornAssessment,
  LDFetalMonitoring,
} from '../../../types/laborDelivery';

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}));

const baseDelivery: LDDeliveryRecord = {
  id: 'del-1',
  patient_id: 'p1',
  tenant_id: 't1',
  pregnancy_id: 'preg-1',
  delivery_datetime: new Date().toISOString(),
  delivery_provider_id: null,
  method: 'spontaneous_vaginal',
  anesthesia: 'none',
  labor_duration_hours: 10,
  second_stage_duration_min: 30,
  estimated_blood_loss_ml: 300,
  complications: [],
  episiotomy: false,
  laceration_degree: null,
  cord_clamping: 'delayed_60s',
  cord_gases_ph: null,
  cord_gases_base_excess: null,
  placenta_delivery_time: null,
  placenta_intact: true,
  notes: null,
  created_at: new Date().toISOString(),
};

describe('suggestBillingCodes', () => {
  it('returns vaginal delivery code for vaginal birth', () => {
    const suggestions = suggestBillingCodes({ delivery: baseDelivery });
    const vaginal = suggestions.find((s) => s.code === '59400');
    expect(vaginal).toBeDefined();
    expect(vaginal?.confidence).toBe('high');
  });

  it('returns cesarean code for cesarean delivery', () => {
    const cesarean = { ...baseDelivery, method: 'cesarean_planned' as const };
    const suggestions = suggestBillingCodes({ delivery: cesarean });
    const csection = suggestions.find((s) => s.code === '59510');
    expect(csection).toBeDefined();
    expect(csection?.confidence).toBe('high');
  });

  it('includes epidural code when epidural anesthesia used', () => {
    const withEpidural = { ...baseDelivery, anesthesia: 'epidural' as const };
    const suggestions = suggestBillingCodes({ delivery: withEpidural });
    const epidural = suggestions.find((s) => s.code === '01967');
    expect(epidural).toBeDefined();
  });

  it('includes combined spinal epidural as epidural code', () => {
    const combined = { ...baseDelivery, anesthesia: 'combined_spinal_epidural' as const };
    const suggestions = suggestBillingCodes({ delivery: combined });
    const epidural = suggestions.find((s) => s.code === '01967');
    expect(epidural).toBeDefined();
  });

  it('includes fetal monitoring code when monitoring data present', () => {
    const monitoring: LDFetalMonitoring = {
      id: 'fm-1',
      patient_id: 'p1',
      tenant_id: 't1',
      pregnancy_id: 'preg-1',
      assessment_time: new Date().toISOString(),
      assessed_by: null,
      fhr_baseline: 140,
      variability: 'moderate',
      accelerations_present: true,
      deceleration_type: 'none',
      deceleration_depth_bpm: null,
      fhr_category: 'I',
      uterine_activity: null,
      interpretation: null,
      action_taken: null,
      created_at: new Date().toISOString(),
    };
    const suggestions = suggestBillingCodes({ delivery: baseDelivery, fetalMonitoring: monitoring });
    const fetal = suggestions.find((s) => s.code === '59050');
    expect(fetal).toBeDefined();
    expect(fetal?.basis).toContain('Category I');
  });

  it('includes episiotomy code when episiotomy performed', () => {
    const withEpisiotomy = { ...baseDelivery, episiotomy: true };
    const suggestions = suggestBillingCodes({ delivery: withEpisiotomy });
    const epis = suggestions.find((s) => s.code === '59300' && s.description.includes('Episiotomy'));
    expect(epis).toBeDefined();
  });

  it('includes laceration code for 2nd+ degree lacerations', () => {
    const withLaceration = { ...baseDelivery, laceration_degree: 3 as const };
    const suggestions = suggestBillingCodes({ delivery: withLaceration });
    const laceration = suggestions.find((s) => s.basis.includes('3° perineal'));
    expect(laceration).toBeDefined();
    expect(laceration?.code).toBe('59300');
  });

  it('does not include laceration code for 1st degree', () => {
    const minor = { ...baseDelivery, laceration_degree: 1 as const };
    const suggestions = suggestBillingCodes({ delivery: minor });
    const laceration = suggestions.find((s) => s.basis.includes('perineal laceration'));
    expect(laceration).toBeUndefined();
  });

  it('includes newborn resuscitation for APGAR < 4', () => {
    const lowApgar: LDNewbornAssessment = {
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
      apgar_5_min: 6,
      apgar_10_min: null,
      ballard_gestational_age_weeks: null,
      temperature_c: null,
      heart_rate: null,
      respiratory_rate: null,
      disposition: 'well_newborn_nursery',
      skin_color: null,
      reflexes: null,
      anomalies: [],
      vitamin_k_given: true,
      erythromycin_given: true,
      hepatitis_b_vaccine: true,
      notes: null,
      created_at: new Date().toISOString(),
    };
    const suggestions = suggestBillingCodes({ delivery: baseDelivery, newborn: lowApgar });
    const resus = suggestions.find((s) => s.code === '99465');
    expect(resus).toBeDefined();
    expect(resus?.confidence).toBe('medium');
  });

  it('includes NICU code for NICU disposition', () => {
    const nicuBaby: LDNewbornAssessment = {
      id: 'nb-2',
      patient_id: 'p1',
      tenant_id: 't1',
      pregnancy_id: 'preg-1',
      delivery_id: 'del-1',
      newborn_patient_id: null,
      birth_datetime: new Date().toISOString(),
      sex: 'female',
      weight_g: 2000,
      length_cm: 43,
      head_circumference_cm: 30,
      apgar_1_min: 5,
      apgar_5_min: 7,
      apgar_10_min: null,
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
    const suggestions = suggestBillingCodes({ delivery: baseDelivery, newborn: nicuBaby });
    const nicu = suggestions.find((s) => s.code === '99468');
    expect(nicu).toBeDefined();
    expect(nicu?.confidence).toBe('medium');
  });

  it('does not include resuscitation for normal APGAR', () => {
    const normalBaby: LDNewbornAssessment = {
      id: 'nb-3',
      patient_id: 'p1',
      tenant_id: 't1',
      pregnancy_id: 'preg-1',
      delivery_id: 'del-1',
      newborn_patient_id: null,
      birth_datetime: new Date().toISOString(),
      sex: 'male',
      weight_g: 3500,
      length_cm: 51,
      head_circumference_cm: 34,
      apgar_1_min: 8,
      apgar_5_min: 9,
      apgar_10_min: null,
      ballard_gestational_age_weeks: null,
      temperature_c: null,
      heart_rate: null,
      respiratory_rate: null,
      disposition: 'well_newborn_nursery',
      skin_color: null,
      reflexes: null,
      anomalies: [],
      vitamin_k_given: true,
      erythromycin_given: true,
      hepatitis_b_vaccine: true,
      notes: null,
      created_at: new Date().toISOString(),
    };
    const suggestions = suggestBillingCodes({ delivery: baseDelivery, newborn: normalBaby });
    const resus = suggestions.find((s) => s.code === '99465');
    expect(resus).toBeUndefined();
  });

  it('always returns at least the primary delivery code', () => {
    const suggestions = suggestBillingCodes({ delivery: baseDelivery });
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
  });
});
