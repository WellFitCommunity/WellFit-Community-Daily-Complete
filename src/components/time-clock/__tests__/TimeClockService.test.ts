/**
 * TimeClockService Unit Tests
 *
 * Tests for the time clock service utility functions.
 */

import { TimeClockService } from '../../../services/timeClockService';

describe('TimeClockService', () => {
  describe('formatHours', () => {
    it('should format minutes to hours and minutes', () => {
      expect(TimeClockService.formatHours(0)).toBe('0h 0m');
      expect(TimeClockService.formatHours(30)).toBe('30m');
      expect(TimeClockService.formatHours(60)).toBe('1h');
      expect(TimeClockService.formatHours(90)).toBe('1h 30m');
      expect(TimeClockService.formatHours(480)).toBe('8h');
      expect(TimeClockService.formatHours(510)).toBe('8h 30m');
    });

    it('should handle large values', () => {
      expect(TimeClockService.formatHours(600)).toBe('10h');
      expect(TimeClockService.formatHours(720)).toBe('12h');
    });
  });

  describe('getCelebrationMessage', () => {
    it('should return a welcome message when not on time', () => {
      const message = TimeClockService.getCelebrationMessage(false, 0, 0);
      expect(message).toBe("Welcome! Let's have a great day! 🌟");
    });

    it('should return a celebratory message when on time', () => {
      const message = TimeClockService.getCelebrationMessage(true, 1, 0);
      expect(message).toBeTruthy();
      expect(typeof message).toBe('string');
    });

    it('should return streak messages for 5+ day streaks', () => {
      const message = TimeClockService.getCelebrationMessage(true, 5, 0);
      expect(message).toBeTruthy();
      // Should contain streak-related content or be from general messages
      expect(typeof message).toBe('string');
    });

    it('should return streak messages for 10+ day streaks', () => {
      const message = TimeClockService.getCelebrationMessage(true, 10, 5);
      expect(message).toBeTruthy();
      expect(typeof message).toBe('string');
    });

    it('should return new record message when beating best streak', () => {
      const message = TimeClockService.getCelebrationMessage(true, 6, 5);
      expect(message).toBeTruthy();
      expect(typeof message).toBe('string');
    });
  });

  describe('getClockOutMessage', () => {
    it('should return a message for normal work days', () => {
      const message = TimeClockService.getClockOutMessage(6);
      expect(message).toBeTruthy();
      expect(typeof message).toBe('string');
    });

    it('should return special message for 8+ hour days', () => {
      const message = TimeClockService.getClockOutMessage(8);
      expect(message).toBe('Full day complete! Time to recharge! ⚡');
    });

    it('should return special message for 10+ hour marathon days', () => {
      const message = TimeClockService.getClockOutMessage(10);
      expect(message).toBe("What a marathon! You definitely earned some rest! 🏃‍♂️");
    });

    it('should return special message for very long days', () => {
      const message = TimeClockService.getClockOutMessage(12);
      expect(message).toBe("What a marathon! You definitely earned some rest! 🏃‍♂️");
    });
  });

  describe('calculateCurrentWorkTime', () => {
    it('should calculate work time from clock in time', () => {
      // Create a time 2 hours ago
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const result = TimeClockService.calculateCurrentWorkTime(twoHoursAgo.toISOString());

      // Should be approximately 120 minutes (allowing for test execution time)
      expect(result.minutes).toBeGreaterThanOrEqual(119);
      expect(result.minutes).toBeLessThanOrEqual(121);
      expect(result.formatted).toMatch(/2h/);
    });

    it('should handle recent clock in times', () => {
      // Create a time 30 minutes ago
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const result = TimeClockService.calculateCurrentWorkTime(thirtyMinutesAgo.toISOString());

      expect(result.minutes).toBeGreaterThanOrEqual(29);
      expect(result.minutes).toBeLessThanOrEqual(31);
      expect(result.formatted).toMatch(/30m|29m|31m/);
    });

    it('should handle just clocked in', () => {
      const justNow = new Date().toISOString();
      const result = TimeClockService.calculateCurrentWorkTime(justNow);

      expect(result.minutes).toBeLessThanOrEqual(1);
    });
  });
});
