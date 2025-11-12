// src/lib/phi-encryption.ts
// PHI (Protected Health Information) encryption utilities

import { supabase } from './supabaseClient';

/**
 * Set the PHI encryption key for the current session
 * This should be called once at app startup with a secure key
 */
export async function setPHIEncryptionKey(key?: string): Promise<void> {
  // Use environment variable or provided key
  // PHI_ENCRYPTION_KEY is server-side only (not exposed to client)
  const encryptionKey = key || process.env.PHI_ENCRYPTION_KEY || generateSessionKey();

  try {
    // Set the encryption key for this session
    await supabase.rpc('set_config', {
      setting_name: 'app.phi_encryption_key',
      new_value: encryptionKey,
      is_local: true
    });

    // HIPAA COMPLIANCE: Log encryption key initialization to security_events
    await logSecurityEvent({
      event_type: 'ENCRYPTION_KEY_INITIALIZED',
      severity: 'LOW',
      description: 'PHI encryption key successfully initialized for session',
      metadata: {
        key_source: key ? 'provided' : process.env.PHI_ENCRYPTION_KEY ? 'environment' : 'generated',
        timestamp: new Date().toISOString(),
        session_id: crypto.randomUUID()
      }
    });
  } catch (error) {
    // Log encryption failure as HIGH severity security event
    await logSecurityEvent({
      event_type: 'ENCRYPTION_KEY_FAILURE',
      severity: 'HIGH',
      description: `PHI encryption key initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }).catch(() => {}); // Don't throw on logging failure

    throw new Error('PHI encryption setup failed');
  }
}

/**
 * Generate a session-specific encryption key
 * In production, this should be loaded from secure environment variables
 */
function generateSessionKey(): string {
  // For development - in production use a proper key management system
  const baseKey = process.env.PHI_ENCRYPTION_KEY || 'wellfit-phi-key-2025';
  const sessionId = Math.random().toString(36).substring(2, 15);
  return `${baseKey}-${sessionId}`;
}

/**
 * Utility functions for working with encrypted PHI data
 */
export const PHIUtils = {
  /**
   * Query check-ins with decrypted PHI data
   */
  async getCheckIns(userId?: string) {
    let query = supabase.from('check_ins_decrypted').select('*');

    if (userId) {
      query = query.eq('user_id', userId);
    }

    return query.order('created_at', { ascending: false });
  },

  /**
   * Query risk assessments with decrypted PHI data
   */
  async getRiskAssessments(patientId?: string) {
    let query = supabase.from('risk_assessments_decrypted').select('*');

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
 * HIPAA COMPLIANCE: Log security events related to encryption
 */
async function logSecurityEvent(event: {
  event_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('security_events').insert({
      event_type: event.event_type,
      severity: event.severity,
      actor_user_id: user?.id || null,
      description: event.description,
      metadata: event.metadata || {},
      requires_investigation: event.severity === 'HIGH' || event.severity === 'CRITICAL'
    });
  } catch (error) {
    // Don't throw - audit logging failure should not break functionality
    // Error is silently ignored to prevent blocking application functionality
  }
}

/**
 * Initialize PHI encryption on app startup
 * Call this in your main App component
 */
export async function initializePHIEncryption(): Promise<void> {
  try {
    await setPHIEncryptionKey();
  } catch (error) {
    // In production, you might want to prevent app startup if encryption fails
    // Error is caught to allow graceful degradation
  }
}