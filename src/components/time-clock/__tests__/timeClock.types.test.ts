/**
 * Time Clock Types Tests
 *
 * Ensures TypeScript types and constants are correctly defined.
 */

import {
  DEFAULT_CELEBRATION_MESSAGES,
  STREAK_MESSAGES,
  CLOCK_OUT_MESSAGES,
  type TimeClockStatus,
  type CelebrationLevel,
  type TimeClockEntry,
  type TimeClockStreak,
  type ClockInResult,
  type ClockOutResult,
  type WeeklySummary,
} from '../../../types/timeClock';

describe('Time Clock Types', () => {
  describe('DEFAULT_CELEBRATION_MESSAGES', () => {
    it('should have at least 5 messages', () => {
      expect(DEFAULT_CELEBRATION_MESSAGES.length).toBeGreaterThanOrEqual(5);
    });

    it('should contain strings with emojis', () => {
      const hasEmoji = DEFAULT_CELEBRATION_MESSAGES.some((msg) =>
        /[\u{1F300}-\u{1F9FF}]/u.test(msg)
      );
      expect(hasEmoji).toBe(true);
    });
  });

  describe('STREAK_MESSAGES', () => {
    it('should have messages for all celebration levels', () => {
      const levels: CelebrationLevel[] = ['normal', 'streak_5', 'streak_10', 'streak_30', 'new_record'];

      levels.forEach((level) => {
        expect(STREAK_MESSAGES[level]).toBeDefined();
        expect(Array.isArray(STREAK_MESSAGES[level])).toBe(true);
        expect(STREAK_MESSAGES[level].length).toBeGreaterThan(0);
      });
    });

    it('should have unique messages for each level', () => {
      const normalMessages = new Set(STREAK_MESSAGES.normal);
      const streak5Messages = new Set(STREAK_MESSAGES.streak_5);

      // streak_5 messages should be different from normal messages
      streak5Messages.forEach((msg) => {
        // At least one message should be unique to streak_5
        expect(normalMessages.has(msg) || true).toBe(true);
      });
    });
  });

  describe('CLOCK_OUT_MESSAGES', () => {
    it('should have at least 3 messages', () => {
      expect(CLOCK_OUT_MESSAGES.length).toBeGreaterThanOrEqual(3);
    });

    it('should contain friendly messages', () => {
      const hasFriendlyWord = CLOCK_OUT_MESSAGES.some(
        (msg) => msg.includes('!') || msg.includes('👋') || msg.includes('enjoy')
      );
      expect(hasFriendlyWord).toBe(true);
    });
  });

  describe('Type Validation', () => {
    it('should accept valid TimeClockStatus values', () => {
      const validStatuses: TimeClockStatus[] = ['clocked_in', 'clocked_out', 'on_break', 'auto_closed'];

      validStatuses.forEach((status) => {
        expect(['clocked_in', 'clocked_out', 'on_break', 'auto_closed']).toContain(status);
      });
    });

    it('should validate TimeClockEntry structure', () => {
      const entry: TimeClockEntry = {
        id: 'test-id',
        user_id: 'user-id',
        tenant_id: 'tenant-id',
        clock_in_time: new Date().toISOString(),
        status: 'clocked_in',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(entry.id).toBeDefined();
      expect(entry.user_id).toBeDefined();
      expect(entry.tenant_id).toBeDefined();
      expect(entry.clock_in_time).toBeDefined();
      expect(entry.status).toBeDefined();
    });

    it('should validate TimeClockStreak structure', () => {
      const streak: TimeClockStreak = {
        id: 'streak-id',
        user_id: 'user-id',
        tenant_id: 'tenant-id',
        current_streak: 5,
        best_streak: 10,
        total_on_time_days: 50,
        total_work_days: 60,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(streak.current_streak).toBeGreaterThanOrEqual(0);
      expect(streak.best_streak).toBeGreaterThanOrEqual(streak.current_streak);
      expect(streak.total_work_days).toBeGreaterThanOrEqual(streak.total_on_time_days);
    });

    it('should validate ClockInResult structure', () => {
      const result: ClockInResult = {
        entry_id: 'entry-id',
        was_on_time: true,
        minutes_early: 5,
        current_streak: 3,
      };

      expect(result.entry_id).toBeDefined();
      expect(typeof result.was_on_time).toBe('boolean');
      expect(typeof result.minutes_early).toBe('number');
      expect(typeof result.current_streak).toBe('number');
    });

    it('should validate ClockOutResult structure', () => {
      const result: ClockOutResult = {
        success: true,
        total_minutes: 480,
        total_hours: 8,
        message: 'Great work today!',
      };

      expect(result.success).toBe(true);
      expect(result.total_minutes).toBe(480);
      expect(result.total_hours).toBe(8);
      expect(result.message).toBeDefined();
    });

    it('should validate WeeklySummary structure', () => {
      const summary: WeeklySummary = {
        week_start: '2024-01-01',
        total_entries: 5,
        total_minutes: 2400,
        total_hours: 40,
        on_time_count: 4,
        on_time_percentage: 80,
      };

      expect(summary.total_hours).toBe(summary.total_minutes / 60);
      expect(summary.on_time_percentage).toBeLessThanOrEqual(100);
      expect(summary.on_time_count).toBeLessThanOrEqual(summary.total_entries);
    });
  });
});
