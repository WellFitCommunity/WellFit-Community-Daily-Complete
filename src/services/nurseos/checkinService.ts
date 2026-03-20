// ============================================================================
// NurseOS Check-In Service — ServiceResult Pattern
// ============================================================================

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import { success, failure } from '../_base';
import type { ServiceResult } from '../_base';
import type {
  ProviderDailyCheckin,
  DailyCheckinFormData,
  StressTrendAnalysis,
} from '../../types/nurseos';

/**
 * Submit daily check-in (upserts: updates if exists for today, else creates)
 */
export async function submitDailyCheckin(
  data: Partial<DailyCheckinFormData>
): Promise<ServiceResult<ProviderDailyCheckin>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return failure('UNAUTHORIZED', 'User not authenticated');

    const { data: practitioner, error: practError } = await supabase
      .from('fhir_practitioners')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (practError || !practitioner) {
      return failure('NOT_FOUND', 'Practitioner record not found. Please complete your profile.');
    }

    const checkinData = {
      ...data,
      user_id: user.id,
      practitioner_id: practitioner.id,
      checkin_date: new Date().toISOString().split('T')[0],
    };

    const { data: result, error } = await supabase
      .from('provider_daily_checkins')
      .upsert(checkinData, {
        onConflict: 'user_id,checkin_date',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      await auditLogger.error('RESILIENCE_CHECKIN_SUBMIT_FAILED', error.message, {
        userId: user.id,
        errorCode: error.code,
      });
      return failure('DATABASE_ERROR', `Failed to submit check-in: ${error.message}`, error);
    }

    return success(result as ProviderDailyCheckin);
  } catch (err: unknown) {
    await auditLogger.error(
      'RESILIENCE_CHECKIN_SUBMIT_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { context: 'submitDailyCheckin' }
    );
    return failure('OPERATION_FAILED', 'Failed to submit check-in', err);
  }
}

/**
 * Get current user's check-ins for a date range
 */
export async function getMyCheckins(
  startDate: string,
  endDate: string
): Promise<ServiceResult<ProviderDailyCheckin[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return failure('UNAUTHORIZED', 'User not authenticated');

    const { data, error } = await supabase
      .from('provider_daily_checkins')
      .select('id, practitioner_id, user_id, checkin_date, work_setting, product_line, stress_level, energy_level, mood_rating, patients_contacted_today, difficult_patient_calls, prior_auth_denials, compassion_fatigue_level, shift_type, patient_census, patient_acuity_score, codes_responded_to, lateral_violence_incident, unsafe_staffing, overtime_hours, felt_overwhelmed, felt_supported_by_team, missed_break, after_hours_work, notes, created_at')
      .eq('user_id', user.id)
      .gte('checkin_date', startDate)
      .lte('checkin_date', endDate)
      .order('checkin_date', { ascending: false });

    if (error) {
      await auditLogger.error('RESILIENCE_CHECKINS_FETCH_FAILED', error.message, {
        userId: user.id,
        errorCode: error.code,
      });
      return failure('DATABASE_ERROR', `Failed to fetch check-ins: ${error.message}`, error);
    }

    return success((data || []) as ProviderDailyCheckin[]);
  } catch (err: unknown) {
    await auditLogger.error(
      'RESILIENCE_CHECKINS_FETCH_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { context: 'getMyCheckins' }
    );
    return failure('OPERATION_FAILED', 'Failed to fetch check-ins', err);
  }
}

/**
 * Check if user has checked in today
 */
export async function hasCheckedInToday(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('provider_daily_checkins')
    .select('id')
    .eq('user_id', user.id)
    .eq('checkin_date', today)
    .maybeSingle();

  if (error) {
    await auditLogger.error('RESILIENCE_CHECKIN_TODAY_CHECK_FAILED', error.message, {
      userId: user.id,
    });
    return false;
  }

  return data !== null;
}

/**
 * Get stress trend analysis (7-day vs 30-day comparison)
 */
export async function getStressTrend(): Promise<ServiceResult<StressTrendAnalysis>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return failure('UNAUTHORIZED', 'User not authenticated');

    const { data, error } = await supabase.rpc('get_provider_stress_trend', {
      p_user_id: user.id,
    });

    if (error) {
      await auditLogger.error('RESILIENCE_STRESS_TREND_FAILED', error.message, {
        userId: user.id,
        errorCode: error.code,
      });
      return failure('DATABASE_ERROR', `Failed to get stress trend: ${error.message}`, error);
    }

    return success(data as StressTrendAnalysis);
  } catch (err: unknown) {
    await auditLogger.error(
      'RESILIENCE_STRESS_TREND_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { context: 'getStressTrend' }
    );
    return failure('OPERATION_FAILED', 'Failed to get stress trend', err);
  }
}

/**
 * Calculate check-in streak for current user
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
  } catch (err: unknown) {
    await auditLogger.error(
      'RESILIENCE_CHECKIN_STREAK_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { userId: user.id }
    );
    return 0;
  }
}
