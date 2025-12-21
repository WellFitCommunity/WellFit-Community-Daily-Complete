// =====================================================
// AI TRANSPARENCY SERVICE
// Purpose: Service layer for AI transparency features
// =====================================================

import { supabase } from '../lib/supabaseClient';

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
  supporting_evidence?: Record<string, any>;
}

export interface VoiceProfileUpdate {
  session_duration_seconds: number;
  corrections_made: number;
  medical_terms_learned: string[];
  workflow_interactions: Record<string, any>;
}

export interface PersonalizationEvent {
  feature_clicked: string;
  time_spent_seconds: number;
  workflow_pattern_detected?: string;
  context_data?: Record<string, any>;
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

/**
 * Log an AI confidence score for transparency
 * @param logData - Confidence score data to log
 * @returns Response with confidence level and log ID
 */
export const logConfidenceScore = async (logData: ConfidenceScoreLog): Promise<{
  success: boolean;
  log: any;
  confidence_level: 'high' | 'medium' | 'low';
  error?: string;
}> => {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase.functions.invoke('log-ai-confidence-score', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: logData,
    });

    if (error) throw error;

    return data;
  } catch (error: any) {
    return {
      success: false,
      log: null,
      confidence_level: 'low',
      error: error.message || 'Failed to log confidence score',
    };
  }
};

/**
 * Validate a provider's response to an AI suggestion
 * @param confidenceLogId - ID of the confidence score log
 * @param accepted - Whether the provider accepted the suggestion
 * @param modifiedValue - The provider's modified value (if rejected)
 */
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
  } catch (error: any) {
    // Error silently handled
    return { success: false, error: error.message || 'Failed to validate suggestion' };
  }
};

/**
 * Get confidence score history for a user
 * @param limit - Number of records to fetch (default: 50)
 */
export const getConfidenceScoreHistory = async (limit: number = 50) => {
  try {
    const { data, error } = await supabase
      .from('ai_confidence_scores')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return { success: true, data };
  } catch (error: any) {
    // Error silently handled
    return { success: false, data: [], error: error.message };
  }
};

// =====================================================
// VOICE PROFILE MANAGEMENT
// =====================================================

/**
 * Update voice profile after a Smart Scribe session
 * @param updateData - Voice profile update data
 */
export const updateVoiceProfile = async (
  updateData: VoiceProfileUpdate
): Promise<{ success: boolean; profile?: VoiceProfile; error?: string }> => {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase.functions.invoke('update-voice-profile', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: updateData,
    });

    if (error) throw error;

    return { success: true, profile: data.profile };
  } catch (error: any) {
    // Error silently handled
    return { success: false, error: error.message || 'Failed to update voice profile' };
  }
};

/**
 * Get current voice profile for the authenticated user
 */
export const getVoiceProfile = async (): Promise<{
  success: boolean;
  profile?: VoiceProfile;
  error?: string;
}> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase.from('voice_profiles').select('*').eq('user_id', user.id).maybeSingle();

    if (error) throw error;

    return { success: true, profile: data || undefined };
  } catch (error: any) {
    // Error silently handled
    return { success: false, error: error.message };
  }
};

// =====================================================
// PERSONALIZED GREETING
// =====================================================

/**
 * Get personalized greeting with motivational quote
 */
export const getPersonalizedGreeting = async (): Promise<{
  success: boolean;
  data?: GreetingData;
  error?: string;
}> => {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase.functions.invoke('get-personalized-greeting', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (error) throw error;

    return { success: true, data };
  } catch (error: any) {
    // Error silently handled
    return { success: false, error: error.message || 'Failed to fetch greeting' };
  }
};

/**
 * Update greeting preferences
 * @param showGreeting - Whether to show greeting
 * @param showQuote - Whether to show motivational quote
 * @param preferredName - Preferred name for greeting
 */
export const updateGreetingPreferences = async (
  showGreeting: boolean,
  showQuote: boolean,
  preferredName?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

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
  } catch (error: any) {
    // Error silently handled
    return { success: false, error: error.message };
  }
};

// =====================================================
// DASHBOARD PERSONALIZATION
// =====================================================

/**
 * Log a dashboard personalization event
 * @param eventData - Personalization event data
 */
export const logPersonalizationEvent = async (
  eventData: PersonalizationEvent
): Promise<{ success: boolean; error?: string }> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase.from('dashboard_personalization_events').insert({
      user_id: user.id,
      feature_clicked: eventData.feature_clicked,
      time_spent_seconds: eventData.time_spent_seconds,
      workflow_pattern_detected: eventData.workflow_pattern_detected,
      context_data: eventData.context_data || {},
    });

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    // Error silently handled
    return { success: false, error: error.message };
  }
};

/**
 * Get dashboard personalization metrics
 */
export const getPersonalizationMetrics = async () => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get total events count
    const { count: totalEvents, error: countError } = await supabase
      .from('dashboard_personalization_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) throw countError;

    // Get most used features
    const { data: features, error: featuresError } = await supabase
      .from('dashboard_personalization_events')
      .select('feature_clicked, click_count')
      .eq('user_id', user.id)
      .order('click_count', { ascending: false })
      .limit(10);

    if (featuresError) throw featuresError;

    // Get workflow patterns
    const { count: patternsCount, error: patternsError } = await supabase
      .from('dashboard_personalization_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('workflow_pattern_detected', 'is', null);

    if (patternsError) throw patternsError;

    return {
      success: true,
      data: {
        total_events: totalEvents || 0,
        most_used_features: features || [],
        patterns_detected: patternsCount || 0,
      },
    };
  } catch (error: any) {
    // Error silently handled
    return { success: false, error: error.message };
  }
};

// =====================================================
// LEARNING MILESTONES
// =====================================================

/**
 * Get unacknowledged milestones for the user
 */
export const getUnacknowledgedMilestones = async (): Promise<{
  success: boolean;
  milestones?: Milestone[];
  error?: string;
}> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('ai_learning_milestones')
      .select('*')
      .eq('user_id', user.id)
      .eq('acknowledged', false)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return { success: true, milestones: data || [] };
  } catch (error: any) {
    // Error silently handled
    return { success: false, error: error.message };
  }
};

/**
 * Acknowledge a milestone
 * @param milestoneId - ID of the milestone to acknowledge
 */
export const acknowledgeMilestone = async (milestoneId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('ai_learning_milestones')
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', milestoneId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    // Error silently handled
    return { success: false, error: error.message };
  }
};

/**
 * Get all milestones for the user (with pagination)
 * @param limit - Number of milestones to fetch
 * @param offset - Offset for pagination
 */
export const getAllMilestones = async (
  limit: number = 20,
  offset: number = 0
): Promise<{ success: boolean; milestones?: Milestone[]; total?: number; error?: string }> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error, count } = await supabase
      .from('ai_learning_milestones')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return { success: true, milestones: data || [], total: count || 0 };
  } catch (error: any) {
    // Error silently handled
    return { success: false, error: error.message };
  }
};

// =====================================================
// ANALYTICS & INSIGHTS
// =====================================================

/**
 * Get AI transparency analytics for the user
 */
export const getAITransparencyAnalytics = async () => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get confidence score statistics
    const { data: confidenceStats, error: confidenceError } = await supabase
      .from('ai_confidence_scores')
      .select('confidence_level, provider_accepted')
      .eq('user_id', user.id);

    if (confidenceError) throw confidenceError;

    // Calculate accuracy metrics
    const totalSuggestions = confidenceStats?.length || 0;
    const acceptedSuggestions = confidenceStats?.filter((s: any) => s.provider_accepted === true).length || 0;
    const highConfidenceSuggestions = confidenceStats?.filter((s: any) => s.confidence_level === 'high').length || 0;

    // Get voice profile
    const { data: voiceProfile, error: voiceError } = await supabase
      .from('voice_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (voiceError && voiceError.code !== 'PGRST116') throw voiceError;

    // Get milestone count
    const { count: milestoneCount, error: milestoneError } = await supabase
      .from('ai_learning_milestones')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (milestoneError) throw milestoneError;

    return {
      success: true,
      analytics: {
        confidence_scores: {
          total_suggestions: totalSuggestions,
          accepted_suggestions: acceptedSuggestions,
          acceptance_rate: totalSuggestions > 0 ? (acceptedSuggestions / totalSuggestions) * 100 : 0,
          high_confidence_rate: totalSuggestions > 0 ? (highConfidenceSuggestions / totalSuggestions) * 100 : 0,
        },
        voice_profile: voiceProfile
          ? {
              maturity_score: voiceProfile.maturity_score,
              total_sessions: voiceProfile.total_sessions,
              status: voiceProfile.status,
            }
          : null,
        milestones: {
          total_achieved: milestoneCount || 0,
        },
      },
    };
  } catch (error: any) {
    // Error silently handled
    return { success: false, error: error.message };
  }
};
