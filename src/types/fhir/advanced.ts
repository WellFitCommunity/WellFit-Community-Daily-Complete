/**
 * FHIR R4 Advanced/Innovative Types
 *
 * CareCoordinationEvent, HealthEquityMetrics — WellFit differentiators.
 * Part of the fhir types decomposition (Strangler Fig from fhir.ts).
 */

import type { FHIRResource } from './base';

// ============================================================================
// CARE COORDINATION HUB
// Real-time patient journey tracking across all touchpoints
// ============================================================================

export interface CareCoordinationEvent extends FHIRResource {
  patient_id: string;

  // Event details
  event_type: 'appointment' | 'admission' | 'discharge' | 'transfer' | 'referral' | 'medication-change' | 'lab-order' | 'imaging-order' | 'procedure' | 'telehealth' | 'home-visit' | 'care-plan-update' | 'ems-transport' | 'readmission';
  event_timestamp: string;
  event_status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';

  // Location/Setting
  care_setting: 'inpatient' | 'outpatient' | 'emergency' | 'home' | 'skilled-nursing' | 'telehealth' | 'ambulance';
  location_name?: string;

  // Participants
  primary_provider_id?: string;
  primary_provider_name?: string;
  care_team_members?: Array<{
    provider_id: string;
    provider_name: string;
    role: string;
  }>;

  // Clinical context
  encounter_id?: string;
  diagnosis_codes?: string[];
  chief_complaint?: string;

  // Care coordination flags
  handoff_occurred?: boolean;
  handoff_quality?: 'complete' | 'incomplete' | 'missing-info';
  care_gap_identified?: boolean;
  care_gap_description?: string;

  // Patient engagement
  patient_notified?: boolean;
  patient_attended?: boolean;
  patient_satisfaction?: number;

  // Outcomes
  action_items?: string[];
  next_appointment_scheduled?: boolean;
  next_appointment_date?: string;

  // Integration tracking
  ehr_synced?: boolean;
  external_system_id?: string;

  notes?: string;
}

// ============================================================================
// HEALTH EQUITY ANALYTICS
// Built-in bias detection & disparities tracking
// ============================================================================

export interface HealthEquityMetrics extends FHIRResource {
  patient_id: string;

  // Demographic factors (de-identified for analytics)
  age_group: '0-17' | '18-44' | '45-64' | '65-74' | '75+';
  race_ethnicity?: string;
  preferred_language?: string;
  insurance_type: 'medicare' | 'medicaid' | 'commercial' | 'uninsured' | 'va' | 'tricare';

  // SDOH composite score (from SDOH screening)
  sdoh_risk_score?: number;
  sdoh_barriers_count?: number;

  // Access metrics
  avg_days_to_appointment?: number;
  no_show_rate?: number;
  telehealth_adoption?: boolean;
  transportation_barrier?: boolean;

  // Clinical outcomes (aggregated)
  chronic_conditions_controlled?: boolean;
  preventive_care_up_to_date?: boolean;
  medication_adherence_rate?: number;

  // Healthcare utilization
  er_visits_last_year?: number;
  hospital_admissions_last_year?: number;
  readmissions_30_day?: number;
  primary_care_visits_last_year?: number;

  // Disparities flags (compared to population average)
  has_access_disparity?: boolean;
  has_outcome_disparity?: boolean;
  has_utilization_disparity?: boolean;

  // Interventions provided
  equity_interventions?: Array<{
    intervention_type: 'transportation-assistance' | 'interpreter-services' | 'patient-navigator' | 'financial-assistance' | 'community-referral' | 'care-coordination' | 'telehealth-enabled';
    intervention_date: string;
    outcome?: string;
  }>;

  calculated_date: string;
}
