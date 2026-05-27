// ============================================================================
// Team Huddle - Shared Types & Thresholds
// ============================================================================

export interface ProviderCheckin {
  user_id: string;
  stress_level: number | null;
  energy_level: number | null;
  mood_rating: number | null;
  work_setting: string | null;
  shift_type: string | null;
  unsafe_staffing: boolean | null;
  felt_overwhelmed: boolean | null;
  missed_break: boolean | null;
  checkin_date: string;
}

export interface PractitionerRow {
  id: string;
  user_id: string;
}

export interface ProfileRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  department: string | null;
}

export interface AuditDiscussedRow {
  metadata: Record<string, unknown> | null;
}

export interface HuddleProvider {
  userId: string;
  fullName: string;
  roleLabel: string;
  lastCheckinDate: string | null;
  daysSinceCheckin: number | null;
  signals: ProviderCheckin | null;
  bucket: HuddleBucket;
}

export type HuddleBucket = 'urgent' | 'watch' | 'good';

export type ToastTone = 'info' | 'error';

export interface ToastState {
  message: string;
  tone: ToastTone;
}

// ----------------------------------------------------------------------------
// Categorization thresholds
// ----------------------------------------------------------------------------

export const STRESS_URGENT = 7;
export const STRESS_WATCH_LOW = 5;
export const STRESS_WATCH_HIGH = 6;
export const ENERGY_URGENT = 4;
export const ENERGY_WATCH_LOW = 5;
export const ENERGY_WATCH_HIGH = 6;
export const MOOD_URGENT = 4;
export const MOOD_WATCH_LOW = 5;
export const MOOD_WATCH_HIGH = 6;
export const STALE_CHECKIN_DAYS = 7;
export const FRESH_CHECKIN_DAYS = 1;

export function categorizeProvider(
  signals: ProviderCheckin | null,
  daysSinceCheckin: number | null
): HuddleBucket {
  // No check-in in 7+ days, or never -> urgent
  if (daysSinceCheckin === null || daysSinceCheckin >= STALE_CHECKIN_DAYS) {
    return 'urgent';
  }

  if (signals && daysSinceCheckin <= FRESH_CHECKIN_DAYS) {
    const stress = signals.stress_level ?? 0;
    const energy = signals.energy_level ?? 10;
    const mood = signals.mood_rating ?? 10;
    const unsafe = signals.unsafe_staffing === true;
    const overwhelmed = signals.felt_overwhelmed === true;

    if (
      stress >= STRESS_URGENT ||
      energy <= ENERGY_URGENT ||
      mood <= MOOD_URGENT ||
      unsafe ||
      overwhelmed
    ) {
      return 'urgent';
    }

    if (
      (stress >= STRESS_WATCH_LOW && stress <= STRESS_WATCH_HIGH) ||
      (energy >= ENERGY_WATCH_LOW && energy <= ENERGY_WATCH_HIGH) ||
      (mood >= MOOD_WATCH_LOW && mood <= MOOD_WATCH_HIGH)
    ) {
      return 'watch';
    }
  }

  return 'good';
}
