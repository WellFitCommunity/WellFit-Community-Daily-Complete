// =====================================================
// AI TRANSPARENCY SERVICE
// Purpose: Service layer for AI transparency features
// =====================================================

import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/getErrorMessage';

// =====================================================
// TYPES
// =====================================================

export interface ConfidenceScoreLog {
  patient_id?: string;
  encounter_id?: string;
  suggestion_type:
    | 'billing_code_icd10'
    | 'billing_code_cpt'
    | 'billing_code_hcpcs'
    | 'soap_note'
    | 'clinical_recommendation'
    | 'drug_interaction'
    | 'risk_assessment';
  suggested_value: string;
  confidence_score: number;
  model_used: string;
  processing_time_ms?: number;
  reasoning_explanation?: string;
  supporting_evidence?: Record<string, unknown>;
}

export interface VoiceProfileUpdate {
  session_duration_seconds: number;
  corrections_made: number;
  medical_terms_learned: string[];
  workflow_interactions: Record<string, unknown>;
}

export interface PersonalizationEvent {
  feature_clicked: string;
  time_spent_seconds: number;
  workflow_pattern_detected?: string;
  context_data?: Record<string, unknown>;
}

export interface GreetingData {
  show_greeting: boolean;
  greeting: string;
  quote: {
    text: string;
    author: string;
    theme: string;
  } | null;
  user_display_name: string;
  time_of_day: string;
}

export interface VoiceProfile {
  id: string;
  user_id: string;
  maturity_score: number;
  accent_adaptation_score: number;
  terminology_adaptation_score: number;
  workflow_adaptation_score: number;
  status: 'training' | 'maturing' | 'fully_adapted';
  total_sessions: number;
  total_corrections: number;
  total_transcription_time_seconds: number;
  fully_adapted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  milestone_type: string;
  milestone_title: string;
  milestone_description: string;
  badge_icon: string;
  celebration_type: 'toast' | 'modal' | 'confetti' | 'badge';
  acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
}

// =====================================================
// CONFIDENCE SCORE LOGGING
// =====================================================

export const logConfidenceScore = async (
  logData: ConfidenceScoreLog
): Promise<{
  success: boolean;
  log: ConfidenceScoreLog | null;
  confidence_level: 'high' | 'medium' | 'low';
  error?: string;
}> => {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) throw new Error('No authentication token available');

    const { data, error } = await supabase.functions.invoke(
      'log-ai-confidence-score',
      {
        headers: { Authorization: `Bearer ${token}` },
        body: logData,
      }
    );

    if (error) throw error;

    return data;
  } catch (err: unknown) {
    return {
      success: false,
      log: null,
      confidence_level: 'low',
      error: getErrorMessage(err),
    };
  }
};

export const validateAISuggestion = async (
  confidenceLogId: string,
  accepted: boolean,
  modifiedValue?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('ai_confidence_scores')
      .update({
        provider_validated: true,
        provider_accepted: accepted,
        provider_modified_value: modifiedValue,
        validated_at: new Date().toISOString(),
      })
      .eq('id', confidenceLogId);

    if (error) throw error;

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err) };
  }
};

export const getConfidenceScoreHistory = async (limit: number = 50) => {
  try {
    const { data, error } = await supabase
      .from('ai_confidence_scores')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, data: [], error: getErrorMessage(err) };
  }
};

// =====================================================
// VOICE PROFILE MANAGEMENT
// =====================================================

export const updateVoiceProfile = async (
  updateData: VoiceProfileUpdate
): Promise<{ success: boolean; profile?: VoiceProfile; error?: string }> => {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) throw new Error('No authentication token available');

    const { data, error } = await supabase.functions.invoke(
      'update-voice-profile',
      {
        headers: { Authorization: `Bearer ${token}` },
        body: updateData,
      }
    );

    if (error) throw error;

    return { success: true, profile: data.profile };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err) };
  }
};

export const getVoiceProfile = async (): Promise<{
  success: boolean;
  profile?: VoiceProfile;
  error?: string;
}> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('voice_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;

    return { success: true, profile: data || undefined };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err) };
  }
};

// =====================================================
// PERSONALIZED GREETING
// =====================================================

export const getPersonalizedGreeting = async (): Promise<{
  success: boolean;
  data?: GreetingData;
  error?: string;
}> => {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) throw new Error('No authentication token available');

    const { data, error } = await supabase.functions.invoke(
      'get-personalized-greeting',
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (error) throw error;

    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err) };
  }
};

export const updateGreetingPreferences = async (
  showGreeting: boolean,
  showQuote: boolean,
  preferredName?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('user_greeting_preferences')
      .upsert({
        user_id: user.id,
        show_greeting: showGreeting,
        show_quote: showQuote,
        preferred_name: preferredName,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (error) throw error;

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err) };
  }
};

// =====================================================
// DASHBOARD PERSONALIZATION
// ===================================================
