// ============================================================================
// NurseOS Emotional Resilience Hub - Service Layer
// ============================================================================
// Purpose: CRUD operations for burnout prevention platform
// Database: provider_burnout_assessments, provider_daily_checkins, etc.
// Zero Tech Debt: Full error handling, type safety, JSDoc comments
// ============================================================================

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import type {
  ProviderBurnoutAssessment,
  ProviderDailyCheckin,
  ResilienceTrainingModule,
  ProviderTrainingCompletion,
  ResilienceResource,
  ProviderSupportCircle,
  ProviderSupportReflection,
  BurnoutRiskLevel,
  DailyCheckinFormData,
  StressTrendAnalysis,
  ResilienceHubDashboardStats,
} from '../types/nurseos';

// ============================================================================
// PART 1: DAILY CHECK-INS
// ============================================================================

/**
 * Submit daily check-in (upserts: updates if exists for today, else creates)
 * @param data Check-in form data
 * @returns Created/updated check-in record
 * @throws Error if submission fails
 */
export async function submitDailyCheckin(
  data: Partial<DailyCheckinFormData>
): Promise<ProviderDailyCheckin> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Get practitioner_id for current user
  const { data: practitioner, error: practError } = await supabase
    .from('fhir_practitioners')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (practError || !practitioner) {
    throw new Error('Practitioner record not found. Please complete your profile.');
  }

  const checkinData = {
    ...data,
    user_id: user.id,
    practitioner_id: practitioner.id,
    checkin_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  };

  // Upsert: update if exists for today, else insert
  const { data: result, error } = await supabase
    .from('provider_daily_checkins')
    .upsert(checkinData, {
      onConflict: 'user_id,checkin_date',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) {

    throw new Error(`Failed to submit check-in: ${error.message}`);
  }

  return result;
}

/**
 * Get current user's check-ins for a date range
 * @param startDate Start date (ISO 8601)
 * @param endDate End date (ISO 8601)
 * @returns Array of check-ins, sorted by date descending
 */
export async function getMyCheckins(
  startDate: string,
  endDate: string
): Promise<ProviderDailyCheckin[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('provider_daily_checkins')
    .select('*')
    .eq('user_id', user.id)
    .gte('checkin_date', startDate)
    .lte('checkin_date', endDate)
    .order('checkin_date', { ascending: false });

  if (error) {

    throw new Error(`Failed to fetch check-ins: ${error.message}`);
  }

  return data || [];
}

/**
 * Check if user has checked in today
 * @returns True if check-in exists for current date
 */
export async function hasCheckedInToday(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const { data, error } = await supabase
    .from('provider_daily_checkins')
    .select('id')
    .eq('user_id', user.id)
    .eq('checkin_date', today)
    .maybeSingle();

  if (error) {

    return false;
  }

  return data !== null;
}

/**
 * Get stress trend analysis (7-day vs 30-day comparison)
 * @returns Stress trend data
 */
export async function getStressTrend(): Promise<StressTrendAnalysis> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase.rpc('get_provider_stress_trend', {
    p_user_id: user.id,
  });

  if (error) {

    throw new Error(`Failed to get stress trend: ${error.message}`);
  }

  return data as StressTrendAnalysis;
}

// ============================================================================
// PART 2: BURNOUT ASSESSMENTS
// ============================================================================

/**
 * Submit burnout assessment (MBI)
 * @param assessment Partial assessment data
 * @returns Created assessment record with computed scores
 * @throws Error if submission fails
 */
export async function submitBurnoutAssessment(
  assessment: Partial<ProviderBurnoutAssessment>
): Promise<ProviderBurnoutAssessment> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Get practitioner_id
  const { data: practitioner, error: practError } = await supabase
    .from('fhir_practitioners')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (practError || !practitioner) {
    throw new Error('Practitioner record not found');
  }

  const assessmentData = {
    ...assessment,
    user_id: user.id,
    practitioner_id: practitioner.id,
    assessment_date: new Date().toISOString(),
  };

  const { data: result, error } = await supabase
    .from('provider_burnout_assessments')
    .insert(assessmentData)
    .select()
    .single();

  if (error) {

    throw new Error(`Failed to submit assessment: ${error.message}`);
  }

  return result;
}

/**
 * Get current user's burnout assessments
 * @returns Array of assessments, sorted by date descending
 */
export async function getMyAssessments(): Promise<ProviderBurnoutAssessment[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('provider_burnout_assessments')
    .select('*')
    .eq('user_id', user.id)
    .order('assessment_date', { ascending: false });

  if (error) {

    throw new Error(`Failed to fetch assessments: ${error.message}`);
  }

  return data || [];
}

/**
 * Get latest burnout risk level for current user
 * @returns Risk level ('low', 'moderate', 'high', 'critical', or 'unknown')
 */
export async function getLatestBurnoutRisk(): Promise<BurnoutRiskLevel> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'unknown';

  const { data, error } = await supabase.rpc('get_provider_burnout_risk', {
    p_user_id: user.id,
  });

  if (error) {

    return 'unknown';
  }

  return (data as BurnoutRiskLevel) || 'unknown';
}

/**
 * Check if intervention is needed based on burnout/stress metrics
 * @returns True if intervention should be triggered
 */
export async function checkInterventionNeeded(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase.rpc('check_burnout_intervention_needed', {
    p_user_id: user.id,
  });

  if (error) {

    return false;
  }

  return data as boolean;
}

// ============================================================================
// PART 3: RESILIENCE TRAINING MODULES
// ============================================================================

/**
 * Get active training modules, optionally filtered by category
 * @param category Optional category filter
 * @returns Array of active modules
 */
export async function getActiveModules(
  category?: string
): Promise<ResilienceTrainingModule[]> {
  let query = supabase
    .from('resilience_training_modules')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {

    throw new Error(`Failed to fetch modules: ${error.message}`);
  }

  return data || [];
}

/**
 * Track when user starts a module
 * @param moduleId Module ID
 */
export async function trackModuleStart(moduleId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Get practitioner_id
  const { data: practitioner } = await supabase
    .from('fhir_practitioners')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!practitioner) throw new Error('Practitioner record not found');

  const { error } = await supabase.from('provider_training_completions').upsert(
    {
      user_id: user.id,
      practitioner_id: practitioner.id,
      module_id: moduleId,
      started_at: new Date().toISOString(),
      completion_percentage: 0,
    },
    {
      onConflict: 'user_id,module_id',
      ignoreDuplicates: false,
    }
  );

  if (error) {

    throw new Error(`Failed to track module start: ${error.message}`);
  }
}

/**
 * Track module completion
 * @param moduleId Module ID
 * @param timeSpent Time spent in minutes
 * @param helpful Whether user found it helpful
 */
export async function trackModuleCompletion(
  moduleId: string,
  timeSpent: number,
  helpful: boolean
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('provider_training_completions')
    .update({
      completed_at: new Date().toISOString(),
      completion_percentage: 100,
      time_spent_minutes: timeSpent,
      found_helpful: helpful,
    })
    .eq('user_id', user.id)
    .eq('module_id', moduleId);

  if (error) {

    throw new Error(`Failed to track completion: ${error.message}`);
  }
}

/**
 * Get current user's module completions
 * @returns Array of completions
 */
export async function getMyCompletions(): Promise<ProviderTrainingCompletion[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('provider_training_completions')
    .select('*')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false });

  if (error) {

    throw new Error(`Failed to fetch completions: ${error.message}`);
  }

  return data || [];
}

// ============================================================================
// PART 4: RESOURCE LIBRARY
// ============================================================================

/**
 * Get active resilience resources
 * @param filters Optional filters (category, resource_type)
 * @returns Array of active resources
 */
export async function getResources(filters?: {
  category?: string;
  resource_type?: string;
}): Promise<ResilienceResource[]> {
  let query = supabase
    .from('resilience_resources')
    .select('*')
    .eq('is_active', true)
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters?.category) {
    query = query.contains('categories', [filters.category]);
  }

  if (filters?.resource_type) {
    query = query.eq('resource_type', filters.resource_type);
  }

  const { data, error } = await query;

  if (error) {

    throw new Error(`Failed to fetch resources: ${error.message}`);
  }

  return data || [];
}

/**
 * Track resource view (increment view count)
 * @param resourceId Resource ID
 */
export async function trackResourceView(resourceId: string): Promise<void> {
  const { error } = await supabase.rpc('increment', {
    table_name: 'resilience_resources',
    row_id: resourceId,
    column_name: 'view_count',
  });

  // Note: If increment RPC doesn't exist, we can do manual update
  if (error) {


    const { data: resource } = await supabase
      .from('resilience_resources')
      .select('view_count')
      .eq('id', resourceId)
      .single();

    if (resource) {
      await supabase
        .from('resilience_resources')
        .update({ view_count: (resource.view_count || 0) + 1 })
        .eq('id', resourceId);
    }
  }
}

// ============================================================================
// PART 5: PEER SUPPORT CIRCLES
// ============================================================================

/**
 * Get current user's support circles
 * @returns Array of circles user is a member of
 */
export async function getMyCircles(): Promise<ProviderSupportCircle[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('provider_support_circles')
    .select(`
      *,
      provider_support_circle_members!inner(user_id, is_active)
    `)
    .eq('provider_support_circle_members.user_id', user.id)
    .eq('provider_support_circle_members.is_active', true)
    .eq('is_active', true);

  if (error) {

    throw new Error(`Failed to fetch circles: ${error.message}`);
  }

  return data || [];
}

/**
 * Get reflections from a support circle
 * @param circleId Circle ID
 * @param limit Max number of reflections to return
 * @returns Array of reflections
 */
export async function getCircleReflections(
  circleId: string,
  limit: number = 20
): Promise<ProviderSupportReflection[]> {
  const { data, error } = await supabase
    .from('provider_support_reflections')
    .select('*')
    .eq('circle_id', circleId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {

    throw new Error(`Failed to fetch reflections: ${error.message}`);
  }

  return data || [];
}

/**
 * Post a reflection to a support circle
 * @param circleId Circle ID
 * @param text Reflection text
 * @param isAnonymous Whether to post anonymously
 * @param tags Optional tags
 * @returns Created reflection
 */
export async function postReflection(
  circleId: string,
  text: string,
  isAnonymous: boolean,
  tags?: string[]
): Promise<ProviderSupportReflection> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('provider_support_reflections')
    .insert({
      circle_id: circleId,
      author_id: isAnonymous ? null : user.id,
      reflection_text: text,
      is_anonymous: isAnonymous,
      tags: tags || null,
    })
    .select()
    .single();

  if (error) {

    throw new Error(`Failed to post reflection: ${error.message}`);
  }

  return data;
}

/**
 * Mark a reflection as helpful (increment helpful_count)
 * @param reflectionId Reflection ID
 */
export async function markReflectionHelpful(reflectionId: string): Promise<void> {
  const { data: reflection } = await supabase
    .from('provider_support_reflections')
    .select('helpful_count')
    .eq('id', reflectionId)
    .single();

  if (reflection) {
    const { error } = await supabase
      .from('provider_support_reflections')
      .update({ helpful_count: (reflection.helpful_count || 0) + 1 })
      .eq('id', reflectionId);

    if (error) {

      throw new Error(`Failed to mark helpful: ${error.message}`);
    }
  }
}

// ============================================================================
// PART 6: DASHBOARD STATS
// ============================================================================

/**
 * Calculate check-in streak for current user
 * @returns Number of consecutive days with check-ins (including today)
 */
export async function getCheckinStreak(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  try {
    const { data, error } = await supabase.rpc('calculate_checkin_streak', {
      p_user_id: user.id,
    });

    if (error) {
      await auditLogger.error('RESILIENCE_CHECKIN_STREAK_FAILED', error.message, {
        userId: user.id,
        errorCode: error.code,
      });
      return 0;
    }

    return (data as number) || 0;
  } catch (err) {
    await auditLogger.error('RESILIENCE_CHECKIN_STREAK_ERROR', err instanceof Error ? err : String(err), {
      userId: user.id,
    });
    return 0;
  }
}

/**
 * Get dashboard summary stats for current user
 * @returns Dashboard stats object
 */
export async function getDashboardStats(): Promise<ResilienceHubDashboardStats> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Fetch all data in parallel
  const [
    burnoutRisk,
    checkedInToday,
    completions,
    stressTrend,
    interventionNeeded,
    circles,
    streakDays,
  ] = await Promise.all([
    getLatestBurnoutRisk(),
    hasCheckedInToday(),
    getMyCompletions(),
    getStressTrend().catch(() => null),
    checkInterventionNeeded(),
    getMyCircles().catch(() => []),
    getCheckinStreak(),
  ]);

  const completedModules = completions.filter((c) => c.completion_percentage === 100).length;
  const inProgressModules = completions.filter(
    (c) => c.completion_percentage > 0 && c.completion_percentage < 100
  ).length;

  // Calculate stress trend direction
  let stressTrendDirection: 'improving' | 'worsening' | 'stable' = 'stable';
  if (stressTrend && stressTrend.trend) {
    stressTrendDirection = stressTrend.trend === 'decreasing' ? 'improving' :
                          stressTrend.trend === 'increasing' ? 'worsening' : 'stable';
  }

  return {
    current_burnout_risk: burnoutRisk,
    has_checked_in_today: checkedInToday,
    check_in_streak_days: streakDays,
    modules_completed: completedModules,
    modules_in_progress: inProgressModules,
    avg_stress_7_days: stressTrend?.avg_stress_7_days || null,
    stress_trend: stressTrendDirection,
    my_support_circles: circles.length,
    intervention_needed: interventionNeeded,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const ResilienceHubService = {
  // Check-ins
  submitDailyCheckin,
  getMyCheckins,
  hasCheckedInToday,
  getStressTrend,
  getCheckinStreak,

  // Burnout assessments
  submitBurnoutAssessment,
  getMyAssessments,
  getLatestBurnoutRisk,
  checkInterventionNeeded,

  // Training modules
  getActiveModules,
  trackModuleStart,
  trackModuleCompletion,
  getMyCompletions,

  // Resources
  getResources,
  trackResourceView,

  // Support circles
  getMyCircles,
  getCircleReflections,
  postReflection,
  markReflectionHelpful,

  // Dashboard
  getDashboardStats,
};
