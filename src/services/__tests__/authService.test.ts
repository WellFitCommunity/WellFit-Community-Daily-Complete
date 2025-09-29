import { toE164 } from '../authService';

describe('authService', () => {
  describe('toE164', () => {
    it('should convert 10-digit US phone number', () => {
      expect(toE164('5551234567')).toBe('+15551234567');
    });

    it('should convert phone number with formatting', () => {
      expect(toE164('(555) 123-4567')).toBe('+15551234567');
    });

    it('should handle 11-digit number starting with 1', () => {
      expect(toE164('15551234567')).toBe('+15551234567');
    });

    it('should preserve already formatted international number', () => {
      expect(toE164('+15551234567')).toBe('+15551234567');
    });

    it('should handle phone with spaces and dashes', () => {
      expect(toE164('555-123-4567')).toBe('+15551234567');
    });

    it('should handle phone with dots', () => {
      expect(toE164('555.123.4567')).toBe('+15551234567');
    });
  });
});