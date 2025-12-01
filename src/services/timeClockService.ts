/**
 * Time Clock Service
 *
 * Handles employee time tracking operations including:
 * - Clock in/out
 * - Streak tracking
 * - Weekly summaries
 * - Time history
 *
 * All operations are tenant-scoped via RLS.
 *
 * Copyright 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';
import type {
  TimeClockEntry,
  TimeClockStreak,
  TimeClockSettings,
  ClockInResult,
  ClockOutResult,
  TodayEntry,
  WeeklySummary,
  CelebrationLevel,
} from '../types/timeClock';

/**
 * Get a random item from an array
 */
function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Determine celebration level based on streak
 */
function getCelebrationLevel(streak: number, bestStreak: number): CelebrationLevel {
  if (streak > bestStreak && bestStreak > 0) return 'new_record';
  if (streak >= 30) return 'streak_30';
  if (streak >= 10) return 'streak_10';
  if (streak >= 5) return 'streak_5';
  return 'normal';
}

export const TimeClockService = {
  // =========================================================================
  // CLOCK IN/OUT
  // =========================================================================

  /**
   * Clock in - start a new time entry
   */
  async clockIn(
    userId: string,
    tenantId: string,
    options?: {
      location?: string;
      scheduledStart?: Date;
    }
  ): Promise<ServiceResult<ClockInResult>> {
    try {
      // Check if already clocked in today
      const todayCheck = await this.getTodayEntry(userId, tenantId);
      if (todayCheck.success && todayCheck.data?.status === 'clocked_in') {
        return failure('ALREADY_EXISTS', 'You are already clocked in today');
      }

      const { data, error } = await supabase.rpc('clock_in', {
        p_user_id: userId,
        p_tenant_id: tenantId,
        p_location: options?.location || null,
        p_scheduled_start: options?.scheduledStart?.toISOString() || null,
      });

      if (error) {
        await auditLogger.error('TIME_CLOCK_IN_FAILED', error, {
          category: 'ADMINISTRATIVE',
          tenantId,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      const result = data?.[0];
      if (!result) {
        return failure('UNKNOWN_ERROR', 'Failed to clock in - no result returned');
      }

      await auditLogger.info('TIME_CLOCK_IN', {
        entry_id: result.entry_id,
        was_on_time: result.was_on_time,
        current_streak: result.current_streak,
      });

      return success({
        entry_id: result.entry_id,
        was_on_time: result.was_on_time,
        minutes_early: result.minutes_early,
        current_streak: result.current_streak,
      });
    } catch (err) {
      await auditLogger.error('TIME_CLOCK_IN_ERROR', err as Error, {
        category: 'ADMINISTRATIVE',
      });
      return failure('UNKNOWN_ERROR', 'Failed to clock in', err);
    }
  },

  /**
   * Clock out - end current time entry
   */
  async clockOut(
    entryId: string,
    notes?: string
  ): Promise<ServiceResult<ClockOutResult>> {
    try {
      const { data, error } = await supabase.rpc('clock_out', {
        p_entry_id: entryId,
        p_notes: notes || null,
      });

      if (error) {
        await auditLogger.error('TIME_CLOCK_OUT_FAILED', error, {
          category: 'ADMINISTRATIVE',
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      const result = data?.[0];
      if (!result) {
        return failure('UNKNOWN_ERROR', 'Failed to clock out - no result returned');
      }

      if (!result.success) {
        return failure('NOT_FOUND', result.message);
      }

      await auditLogger.info('TIME_CLOCK_OUT', {
        entry_id: entryId,
        total_minutes: result.total_minutes,
        total_hours: result.total_hours,
      });

      return success({
        success: result.success,
        total_minutes: result.total_minutes,
        total_hours: Number(result.total_hours),
        message: result.message,
      });
    } catch (err) {
      await auditLogger.error('TIME_CLOCK_OUT_ERROR', err as Error, {
        category: 'ADMINISTRATIVE',
      });
      return failure('UNKNOWN_ERROR', 'Failed to clock out', err);
    }
  },

  // =========================================================================
  // QUERIES
  // =========================================================================

  /**
   * Get today's time entry for a user
   */
  async getTodayEntry(
    userId: string,
    tenantId: string
  ): Promise<ServiceResult<TodayEntry | null>> {
    try {
      const { data, error } = await supabase.rpc('get_todays_time_entry', {
        p_user_id: userId,
        p_tenant_id: tenantId,
      });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      const entry = data?.[0];
      return success(entry || null);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get today\'s entry', err);
    }
  },

  /**
   * Get weekly summary
   */
  async getWeeklySummary(
    userId: string,
    tenantId: string,
    weekStart?: Date
  ): Promise<ServiceResult<WeeklySummary>> {
    try {
      const { data, error } = await supabase.rpc('get_weekly_time_summary', {
        p_user_id: userId,
        p_tenant_id: tenantId,
        p_week_start: weekStart?.toISOString().split('T')[0] || null,
      });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      const summary = data?.[0];
      if (!summary) {
        // Return empty summary if no data
        return success({
          week_start: weekStart?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
          total_entries: 0,
          total_minutes: 0,
          total_hours: 0,
          on_time_count: 0,
          on_time_percentage: 0,
        });
      }

      return success({
        week_start: summary.week_start,
        total_entries: summary.total_entries,
        total_minutes: summary.total_minutes,
        total_hours: Number(summary.total_hours),
        on_time_count: summary.on_time_count,
        on_time_percentage: Number(summary.on_time_percentage),
      });
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get weekly summary', err);
    }
  },

  /**
   * Get time entries history
   */
  async getTimeEntries(
    userId: string,
    tenantId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<ServiceResult<TimeClockEntry[]>> {
    try {
      const { data, error } = await supabase.rpc('get_time_entries', {
        p_user_id: userId,
        p_tenant_id: tenantId,
        p_start_date: options?.startDate?.toISOString().split('T')[0] || null,
        p_end_date: options?.endDate?.toISOString().split('T')[0] || null,
        p_limit: options?.limit || 30,
      });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data || []);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get time entries', err);
    }
  },

  /**
   * Get user's streak info
   */
  async getStreak(
    userId: string,
    tenantId: string
  ): Promise<ServiceResult<TimeClockStreak | null>> {
    try {
      const { data, error } = await supabase
        .from('time_clock_streaks')
        .select('*')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .single();

      if (error && error.code !== 'PGRST116') {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data || null);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get streak', err);
    }
  },

  /**
   * Get tenant's time clock settings
   */
  async getSettings(tenantId: string): Promise<ServiceResult<TimeClockSettings | null>> {
    try {
      const { data, error } = await supabase
        .from('time_clock_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (error && error.code !== 'PGRST116') {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data || null);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get settings', err);
    }
  },

  // =========================================================================
  // ADMIN FUNCTIONS
  // =========================================================================

  /**
   * Get all time entries for a tenant (admin view)
   */
  async getAllTenantEntries(
    tenantId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<ServiceResult<Array<TimeClockEntry & { first_name: string; last_name: string }>>> {
    try {
      let query = supabase
        .from('time_clock_entries')
        .select(`
          *,
          profiles!inner(first_name, last_name)
        `)
        .eq('tenant_id', tenantId)
        .order('clock_in_time', { ascending: false });

      if (options?.startDate) {
        query = query.gte('clock_in_time', options.startDate.toISOString());
      }
      if (options?.endDate) {
        query = query.lte('clock_in_time', options.endDate.toISOString());
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      // Flatten the profiles data
      const entries = (data || []).map((entry) => ({
        ...entry,
        first_name: (entry.profiles as { first_name: string })?.first_name || '',
        last_name: (entry.profiles as { last_name: string })?.last_name || '',
        profiles: undefined,
      }));

      return success(entries);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get tenant entries', err);
    }
  },

  /**
   * Get team entries for a manager
   */
  async getTeamEntries(
    managerUserId: string,
    tenantId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<ServiceResult<Array<TimeClockEntry & { first_name: string; last_name: string }>>> {
    try {
      // Get manager's employee profile ID
      const { data: managerProfile } = await supabase
        .from('employee_profiles')
        .select('id')
        .eq('user_id', managerUserId)
        .single();

      if (!managerProfile) {
        return success([]); // Manager has no profile, no direct reports
      }

      // Get direct reports
      const { data: reports } = await supabase
        .from('employee_profiles')
        .select('user_id')
        .eq('manager_id', managerProfile.id);

      if (!reports || reports.length === 0) {
        return success([]);
      }

      const reportUserIds = reports.map((r) => r.user_id);

      let query = supabase
        .from('time_clock_entries')
        .select(`
          *,
          profiles!inner(first_name, last_name)
        `)
        .eq('tenant_id', tenantId)
        .in('user_id', reportUserIds)
        .order('clock_in_time', { ascending: false });

      if (options?.startDate) {
        query = query.gte('clock_in_time', options.startDate.toISOString());
      }
      if (options?.endDate) {
        query = query.lte('clock_in_time', options.endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      const entries = (data || []).map((entry) => ({
        ...entry,
        first_name: (entry.profiles as { first_name: string })?.first_name || '',
        last_name: (entry.profiles as { last_name: string })?.last_name || '',
        profiles: undefined,
      }));

      return success(entries);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get team entries', err);
    }
  },

  /**
   * Update time clock settings (admin only)
   */
  async updateSettings(
    tenantId: string,
    updates: Partial<Pick<TimeClockSettings, 'grace_period_minutes' | 'auto_close_after_hours' | 'default_shift_start' | 'default_shift_end' | 'celebration_messages'>>
  ): Promise<ServiceResult<TimeClockSettings>> {
    try {
      const { data, error } = await supabase
        .from('time_clock_settings')
        .upsert({
          tenant_id: tenantId,
          ...updates,
        })
        .select()
        .single();

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('TIME_CLOCK_SETTINGS_UPDATED', {
        tenant_id: tenantId,
        fields_updated: Object.keys(updates),
      });

      return success(data);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to update settings', err);
    }
  },

  // =========================================================================
  // UTILITY FUNCTIONS
  // =========================================================================

  /**
   * Get celebration message based on streak and on-time status
   */
  getCelebrationMessage(wasOnTime: boolean, streak: number, bestStreak: number): string {
    if (!wasOnTime) {
      return "Welcome! Let's have a great day! 🌟";
    }

    const level = getCelebrationLevel(streak, bestStreak);
    const messages: Record<CelebrationLevel, string[]> = {
      normal: [
        "Great start to the day! 🎉",
        "Right on time! 👏",
        "Crushing it! 💪",
        "Early bird gets the worm! 🐛",
        "You're on fire! 🔥",
        "Another great day begins! ⭐",
        "Ready to rock! 🎸",
        "Let's do this! 🚀",
      ],
      streak_5: [
        "5 days on time! You're on a roll! 🎯",
        "Five-day streak! Keep it going! 🔥🔥🔥🔥🔥",
        "High five for 5 days! ✋",
      ],
      streak_10: [
        "10 DAYS! You're unstoppable! 🏆",
        "Double digits! Legend status! 🌟",
        "10-day streak! That's dedication! 💎",
      ],
      streak_30: [
        "30 DAYS! You're a time clock champion! 👑",
        "A whole month on time! Incredible! 🎖️",
        "30-day streak! You're inspiring! 🌈",
      ],
      new_record: [
        "NEW PERSONAL BEST! 🏅",
        "You just broke your record! 🎊",
        "New streak record! Hall of fame material! 🏛️",
      ],
    };

    return getRandomItem(messages[level]);
  },

  /**
   * Get clock out message
   */
  getClockOutMessage(totalHours: number): string {
    const messages = [
      "Great work today! See you tomorrow! 👋",
      "Another productive day in the books! 📚",
      "Time to recharge! You earned it! 🔋",
      "Well done! Enjoy your evening! 🌅",
      "Clocked out! Go do something fun! 🎮",
    ];

    // Special messages for long days
    if (totalHours >= 10) {
      return "What a marathon! You definitely earned some rest! 🏃‍♂️";
    }
    if (totalHours >= 8) {
      return "Full day complete! Time to recharge! ⚡";
    }

    return getRandomItem(messages);
  },

  /**
   * Format hours for display
   */
  formatHours(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
      return `${minutes}m`;
    }
    if (minutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
  },

  /**
   * Calculate current work time (for clocked-in state)
   */
  calculateCurrentWorkTime(clockInTime: string): { minutes: number; formatted: string } {
    const start = new Date(clockInTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const minutes = Math.floor(diffMs / 60000);
    return {
      minutes,
      formatted: this.formatHours(minutes),
    };
  },
};

export default TimeClockService;
