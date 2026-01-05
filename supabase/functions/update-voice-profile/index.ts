// =====================================================
// UPDATE VOICE PROFILE - Edge Function
// Purpose: Update Riley voice profile learning metrics
// =====================================================

import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsFromRequest, handleOptions } from '../_shared/cors.ts'
import { createLogger } from '../_shared/auditLogger.ts'

const logger = createLogger('update-voice-profile')

interface VoiceProfileUpdate {
  user_id: string
  session_duration_seconds?: number
  corrections_count?: number
  learned_phrases?: string[]
  learned_terminology?: string[]
  correction_detail?: {
    original: string
    corrected: string
    context: string
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers } = corsFromRequest(req);

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      SUPABASE_URL ?? '',
      SB_PUBLISHABLE_API_KEY ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    // Parse request body
    const update: VoiceProfileUpdate = await req.json()

    // Validate user_id matches authenticated user
    if (update.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'User ID mismatch' }), {
        status: 403,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    // Get or create voice profile
    const { data: existingProfile, error: fetchError } = await supabaseClient
      .from('voice_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError
    }

    let profile = existingProfile

    if (!profile) {
      // Create new profile
      const { data: newProfile, error: createError } = await supabaseClient
        .from('voice_profiles')
        .insert({
          user_id: user.id,
          total_sessions: 0,
          total_corrections: 0,
          total_transcription_time_seconds: 0,
          maturity_score: 0,
          accent_adaptation_score: 0,
          terminology_adaptation_score: 0,
          workflow_adaptation_score: 0,
          status: 'training',
        })
        .select()
        .single()

      if (createError) throw createError
      profile = newProfile
    }

    // Calculate new metrics
    const totalSessions = profile.total_sessions + 1
    const totalCorrections = profile.total_corrections + (update.corrections_count || 0)
    const totalTime = profile.total_transcription_time_seconds + (update.session_duration_seconds || 0)

    // Merge learned phrases
    const existingPhrases = Array.isArray(profile.learned_phrases) ? profile.learned_phrases : []
    const newPhrases = update.learned_phrases || []
    const allPhrases = [...new Set([...existingPhrases, ...newPhrases])]

    // Merge learned terminology
    const existingTerms = Array.isArray(profile.learned_terminology) ? profile.learned_terminology : []
    const newTerms = update.learned_terminology || []
    const allTerms = [...new Set([...existingTerms, ...newTerms])]

    // Add correction to history
    const corrections = Array.isArray(profile.common_corrections) ? profile.common_corrections : []
    if (update.correction_detail) {
      corrections.push({
        ...update.correction_detail,
        timestamp: new Date().toISOString(),
      })
    }

    // Calculate maturity scores
    // Accent adaptation: Based on sessions (max at 50 sessions)
    const accentScore = Math.min(100, Math.floor((totalSessions / 50) * 100))

    // Terminology adaptation: Based on unique terms learned (max at 100 terms)
    const terminologyScore = Math.min(100, Math.floor((allTerms.length / 100) * 100))

    // Workflow adaptation: Based on time spent (max at 10 hours = 36000 seconds)
    const workflowScore = Math.min(100, Math.floor((totalTime / 36000) * 100))

    // Overall maturity: Average of three scores
    const maturityScore = Math.floor((accentScore + terminologyScore + workflowScore) / 3)

    // Determine status
    let status = 'training'
    if (maturityScore >= 90) {
      status = 'fully_adapted'
    } else if (maturityScore >= 50) {
      status = 'maturing'
    }

    // Check for milestones
    const milestones = []
    const existingMilestones = Array.isArray(profile.milestones_achieved) ? profile.milestones_achieved : []

    if (totalSessions === 10 && !existingMilestones.includes('voice_profile_10_sessions')) {
      milestones.push('voice_profile_10_sessions')
      // Insert milestone
      await supabaseClient.from('ai_learning_milestones').insert({
        user_id: user.id,
        milestone_type: 'voice_profile_10_sessions',
        milestone_title: '10 Sessions Complete!',
        milestone_description: 'Riley is starting to learn your voice patterns.',
        badge_icon: '🎤',
        celebration_type: 'toast',
      })
    }

    if (totalSessions === 50 && !existingMilestones.includes('voice_profile_50_sessions')) {
      milestones.push('voice_profile_50_sessions')
      await supabaseClient.from('ai_learning_milestones').insert({
        user_id: user.id,
        milestone_type: 'voice_profile_50_sessions',
        milestone_title: '50 Sessions - Expert Level!',
        milestone_description: 'Riley knows your voice incredibly well now.',
        badge_icon: '🏆',
        celebration_type: 'confetti',
      })
    }

    if (status === 'fully_adapted' && profile.status !== 'fully_adapted' && !existingMilestones.includes('voice_profile_fully_adapted')) {
      milestones.push('voice_profile_fully_adapted')
      await supabaseClient.from('ai_learning_milestones').insert({
        user_id: user.id,
        milestone_type: 'voice_profile_fully_adapted',
        milestone_title: 'Fully Adapted!',
        milestone_description: 'Riley is now perfectly tuned to your voice and workflow.',
        badge_icon: '⭐',
        celebration_type: 'modal',
      })
    }

    // Update profile
    const { data: updatedProfile, error: updateError } = await supabaseClient
      .from('voice_profiles')
      .update({
        total_sessions: totalSessions,
        total_corrections: totalCorrections,
        total_transcription_time_seconds: totalTime,
        maturity_score: maturityScore,
        accent_adaptation_score: accentScore,
        terminology_adaptation_score: terminologyScore,
        workflow_adaptation_score: workflowScore,
        learned_phrases: allPhrases.slice(-100), // Keep last 100
        learned_terminology: allTerms.slice(-200), // Keep last 200
        common_corrections: corrections.slice(-50), // Keep last 50
        status,
        fully_adapted_at: status === 'fully_adapted' && profile.status !== 'fully_adapted' ? new Date().toISOString() : profile.fully_adapted_at,
        milestones_achieved: [...existingMilestones, ...milestones],
        last_milestone_at: milestones.length > 0 ? new Date().toISOString() : profile.last_milestone_at,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({
        success: true,
        profile: updatedProfile,
        milestones_achieved: milestones,
      }),
      {
        headers: { ...headers, 'Content-Type': 'application/json' },
      }
    )
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Error updating voice profile", { error: errorMessage.slice(0, 500) });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      }
    )
  }
})
