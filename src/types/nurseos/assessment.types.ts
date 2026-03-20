// NurseOS Assessment Types — Burnout & Risk

export interface ProviderBurnoutAssessment {
  id: string;
  practitioner_id: string;
  user_id: string;
  assessment_date: string;
  assessment_type: 'MBI-HSS' | 'MBI-ES' | 'custom';
  emotional_exhaustion_score: number;
  depersonalization_score: number;
  personal_accomplishment_score: number;
  composite_burnout_score?: number;
  risk_level?: 'low' | 'moderate' | 'high' | 'critical';
  questionnaire_responses?: MBIQuestionnaireResponse[];
  provider_notes?: string | null;
  intervention_triggered: boolean;
  intervention_type?: 'automatic_workload_reduction' | 'peer_support_referral' | 'eap_referral' | 'manager_notification' | null;
  follow_up_scheduled?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MBIQuestionnaireResponse {
  question: string;
  score: number;
  dimension: 'emotional_exhaustion' | 'depersonalization' | 'personal_accomplishment';
}

export type BurnoutRiskLevel = 'low' | 'moderate' | 'high' | 'critical' | 'unknown';

export interface BurnoutAssessmentFormData {
  assessment_type: 'MBI-HSS' | 'MBI-ES' | 'custom';
  emotional_exhaustion_responses: number[];
  depersonalization_responses: number[];
  personal_accomplishment_responses: number[];
  provider_notes?: string;
}

export interface InterventionRecommendation {
  needed: boolean;
  reason?: 'high_burnout' | 'sustained_stress' | 'high_workload' | 'moral_injury';
  recommendation?: string;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
}
