/**
 * Time Clock Types
 *
 * Types for the employee time tracking system.
 * Supports clock in/out, streak tracking, and weekly summaries.
 */

// =============================================================================
// TIME CLOCK ENTRY
// =============================================================================

export type TimeClockStatus = 'clocked_in' | 'clocked_out' | 'on_break' | 'auto_closed';

export interface TimeClockEntry {
  id: string;
  user_id: string;
  employee_profile_id?: string;
  tenant_id: string;

  // Times
  clock_in_time: string;
  clock_out_time?: string;
  scheduled_start?: string;
  scheduled_end?: string;

  // Status & calculations
  status: TimeClockStatus;
  total_minutes?: number;
  total_hours?: number;

  // On-time tracking
  was_on_time?: boolean;
  minutes_early?: number;

  // Metadata
  location?: string;
  notes?: string;
  ip_address?: string;
  user_agent?: string;

  // Audit
  created_at: string;
  updated_at: string;
}

// =============================================================================
// TIME CLOCK STREAK
// =============================================================================

export interface TimeClockStreak {
  id: string;
  user_id: string;
  tenant_id: string;

  // Current streak
  current_streak: number;
  streak_start_date?: string;
  last_on_time_date?: string;

  // Best streak ever
  best_streak: number;
  best_streak_start_date?: string;
  best_streak_end_date?: string;

  // Stats
  total_on_time_days: number;
  total_work_days: number;

  // Audit
  created_at: string;
  updated_at: string;
}

// =============================================================================
// TIME CLOCK SETTINGS
// =============================================================================

export interface TimeClockSettings {
  id: string;
  tenant_id: string;

  grace_period_minutes: number;
  auto_close_after_hours: number;
  default_shift_start: string;
  default_shift_end: string;
  celebration_messages: string[];

  created_at: string;
  updated_at: string;
}

// =============================================================================
// FUNCTION RETURN TYPES
// =============================================================================

export interface ClockInResult {
  entry_id: string;
  was_on_time: boolean;
  minutes_early: number;
  current_streak: number;
}

export interface ClockOutResult {
  success: boolean;
  total_minutes: number;
  total_hours: number;
  message: string;
}

export interface TodayEntry {
  id: string;
  clock_in_time: string;
  clock_out_time?: string;
  status: TimeClockStatus;
  was_on_time?: boolean;
  minutes_early?: number;
  total_minutes?: number;
  total_hours?: number;
  notes?: string;
}

export interface WeeklySummary {
  week_start: string;
  total_entries: number;
  total_minutes: number;
  total_hours: number;
  on_time_count: number;
  on_time_percentage: number;
}

// =============================================================================
// UI STATE TYPES
// =============================================================================

export interface TimeClockState {
  isClockingIn: boolean;
  isClockingOut: boolean;
  showCelebration: boolean;
  celebrationMessage: string;
  todayEntry: TodayEntry | null;
  streak: TimeClockStreak | null;
  weeklySummary: WeeklySummary | null;
  settings: TimeClockSettings | null;
  error: string | null;
}

export type CelebrationLevel = 'normal' | 'streak_5' | 'streak_10' | 'streak_30' | 'new_record';

// =============================================================================
// CELEBRATION MESSAGES
// =============================================================================

export const DEFAULT_CELEBRATION_MESSAGES = [
  "Great start to the day! 🎉",
  "Right on time! 👏",
  "Crushing it! 💪",
  "Early bird gets the worm! 🐛",
  "You're on fire! 🔥",
  "Another great day begins! ⭐",
  "Ready to rock! 🎸",
  "Let's do this! 🚀",
];

export const STREAK_MESSAGES: Record<CelebrationLevel, string[]> = {
  normal: DEFAULT_CELEBRATION_MESSAGES,
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

export const CLOCK_OUT_MESSAGES = [
  "Great work today! See you tomorrow! 👋",
  "Another productive day in the books! 📚",
  "Time to recharge! You earned it! 🔋",
  "Well done! Enjoy your evening! 🌅",
  "Clocked out! Go do something fun! 🎮",
];
