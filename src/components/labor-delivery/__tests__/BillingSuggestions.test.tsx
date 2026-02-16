/**
 * BillingSuggestions Component Tests
 * Tier 1: Tests billing code generation from delivery data
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BillingSuggestions from '../BillingSuggestions';
import type { LDDeliveryRecord, LDNewbornAssessment, LDFetalMonitoring } from '../../../types/laborDelivery';

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

describe('BillingSuggestions', () => {
  it('renders vaginal delivery CPT code for vaginal birth', () => {
    render(<BillingSuggestions delivery={baseDelivery} />);
    expect(screen.getByText('59400')).toBeInTheDocument();
    expect(screen.getByText('Routine OB care + vaginal delivery')).toBeInTheDocument();
  });

  it('renders cesarean CPT code for cesarean delivery', () => {
    const cesarean = { ...baseDelivery, method: 'cesarean_planned' as const };
    render(<BillingSuggestions delivery={cesarean} />);
    expect(screen.getByText('59510')).toBeInTheDocument();
    expect(screen.getByText('Routine OB care + cesarean delivery')).toBeInTheDocument();
  });

  it('suggests epidural code when epidural anesthesia used', () => {
    const withEpidural = { ...baseDelivery, anesthesia: 'epidural' as const };
    render(<BillingSuggestions delivery={withEpidural} />);
    expect(screen.getByText('01967')).toBeInTheDocument();
    expect(screen.getByText('Epidural anesthesia for labor')).toBeInTheDocument();
  });

  it('suggests episiotomy code when episiotomy performed', () => {
    const withEpisiotomy = { ...baseDelivery, episiotomy: true };
    render(<BillingSuggestions delivery={withEpisiotomy} />);
    expect(screen.getByText('59300')).toBeInTheDocument();
    expect(screen.getByText('Episiotomy repair')).toBeInTheDocument();
  });

  it('suggests fetal monitoring code when monitoring data provided', () => {
    const monitoring: LDFetalMonitoring = {
      id: 'fm-1',
      patient_id: 'p1',
      tenant_id: 't1',
      pregnancy_id: 'preg-1',
      assessment_time: new Date().toISOString(),
      fhr_baseline: 140,
      fhr_category: 'I',
      variability: 'moderate',
      accelerations_present: true,
      deceleration_type: 'none',
      deceleration_depth_bpm: null,
      uterine_activity: null,
      interpretation: null,
      action_taken: null,
      assessed_by: null,
      created_at: new Date().toISOString(),
    };
    render(<BillingSuggestions delivery={baseDelivery} fetalMonitoring={monitoring} />);
    expect(screen.getByText('59050')).toBeInTheDocument();
    expect(screen.getByText('Fetal monitoring during labor')).toBeInTheDocument();
  });

  it('suggests newborn resuscitation for low APGAR', () => {
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
      apgar_1_min: 3,
      apgar_5_min: 7,
      apgar_10_min: null,
      ballard_gestational_age_weeks: null,
      temperature_c: 37.0,
      heart_rate: 140,
      respiratory_rate: 40,
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
    render(<BillingSuggestions delivery={baseDelivery} newborn={newborn} />);
    expect(screen.getByText('99465')).toBeInTheDocument();
    expect(screen.getByText(/resuscitation/i)).toBeInTheDocument();
  });

  it('suggests NICU code when newborn disposition is nicu', () => {
    const nicuBaby: LDNewbornAssessment = {
      id: 'nb-2',
      patient_id: 'p1',
      tenant_id: 't1',
      pregnancy_id: 'preg-1',
      delivery_id: 'del-1',
      newborn_patient_id: null,
      birth_datetime: new Date().toISOString(),
      sex: 'female',
      weight_g: 2100,
      length_cm: 45,
      head_circumference_cm: 31,
      apgar_1_min: 5,
      apgar_5_min: 7,
      apgar_10_min: null,
      ballard_gestational_age_weeks: null,
      temperature_c: 36.5,
      heart_rate: 150,
      respiratory_rate: 50,
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
    render(<BillingSuggestions delivery={baseDelivery} newborn={nicuBaby} />);
    expect(screen.getByText('99468')).toBeInTheDocument();
    expect(screen.getByText(/neonatal critical care/i)).toBeInTheDocument();
  });

  it('displays confidence badges for suggestions', () => {
    render(<BillingSuggestions delivery={baseDelivery} />);
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('displays heading and verification notice', () => {
    render(<BillingSuggestions delivery={baseDelivery} />);
    expect(screen.getByText('Billing Code Suggestions')).toBeInTheDocument();
    expect(screen.getByText(/verify before submission/i)).toBeInTheDocument();
  });
});
