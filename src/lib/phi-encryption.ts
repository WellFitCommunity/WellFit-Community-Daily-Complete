// src/lib/phi-encryption.ts
// PHI (Protected Health Information) encryption utilities

import { supabase } from './supabaseClient';

/**
 * Set the PHI encryption key for the current session
 * This should be called once at app startup with a secure key
 */
export async function setPHIEncryptionKey(_key?: string): Promise<void> {
  // NOTE: PostgreSQL's set_config() cannot be called via Supabase REST API.
  // Each REST API call creates a new database session, so session-level configs
  // don't persist anyway. PHI encryption is handled server-side via:
  // 1. Edge Functions that use direct database connections
  // 2. Database triggers with encryption keys stored in vault
  //
  // This function is kept for API compatibility but is now a no-op on the client.
  // The actual encryption happens via database triggers (encrypt_phi_trigger).
  return;
}

/**
 * Utility functions for working with encrypted PHI data
 */
export const PHIUtils = {
  /**
   * Query check-ins with decrypted PHI data
   */
  async getCheckIns(userId?: string) {
    let query = supabase.from('check_ins_decrypted').select(
      'id, user_id, label, is_emergency, emotional_state, heart_rate, pulse_oximeter, bp_systolic, bp_diastolic, glucose_mg_dl, created_at, updated_at'
    );

    if (userId) {
      query = query.eq('user_id', userId);
    }

    return query.order('created_at', { ascending: false });
  },

  /**
   * Query risk assessments with decrypted PHI data
   */
  async getRiskAssessments(patientId?: string) {
    let query = supabase.from('risk_assessments_decrypted').select(
      'id, patient_id, assessor_id, risk_level, priority, medical_risk_score, mobility_risk_score, cognitive_risk_score, social_risk_score, overall_score, assessment_notes, risk_factors, recommended_actions, next_assessment_due, review_frequency, created_at, updated_at'
    );

    if (patientId) {
      query = query.eq('patient_id', patientId);
    }

    return query.order('created_at', { ascending: false });
  },

  /**
   * Insert check-in with automatic PHI encryption
   * The trigger will automatically encrypt sensitive fields
   */
  async insertCheckIn(checkInData: {
    user_id: string;
    label: string;
    is_emergency?: boolean;
    emotional_state?: string;
    heart_rate?: number;
    pulse_oximeter?: number;
    bp_systolic?: number;
    bp_diastolic?: number;
    glucose_mg_dl?: number;
  }) {
    return supabase.from('check_ins').insert([checkInData]);
  },

  /**
   * Insert risk assessment with automatic PHI encryption
   */
  async insertRiskAssessment(assessmentData: {
    patient_id: string;
    assessor_id: string;
    risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    medical_risk_score?: number;
    mobility_risk_score?: number;
    cognitive_risk_score?: number;
    social_risk_score?: number;
    overall_score?: number;
    assessment_notes?: string;
    risk_factors?: string[];
    recommended_actions?: string[];
    next_assessment_due?: string;
    review_frequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
  }) {
    return supabase.from('risk_assessments').insert([assessmentData]);
  }
};

/**
 * Initialize PHI encryption on app startup
 * Call this in your main App component
 *
 * NOTE: This is now a no-op since PHI encryption is handled server-side.
 * Kept for API compatibility with existing code that calls it.
 */
export async function initializePHIEncryption(): Promise<void> {
  // No-op - encryption handled by database triggers
  return;
}