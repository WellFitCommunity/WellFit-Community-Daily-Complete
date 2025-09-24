// Shared Risk Assessment Types

export interface RiskAssessment {
  id?: string;
  patient_id: string;
  assessor_id: string;
  risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  medical_risk_score: number;
  mobility_risk_score: number;
  cognitive_risk_score: number;
  social_risk_score: number;
  overall_score: number;
  assessment_notes: string;
  risk_factors: string[];
  recommended_actions: string[];
  next_assessment_due: string;
  review_frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
  created_at?: string;
  updated_at?: string;
  valid_until?: string;
  // Extended fields for manager component
  patient_name?: string;
  assessor_name?: string;
}

export interface PatientProfile {
  user_id: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
}

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type ReviewFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';