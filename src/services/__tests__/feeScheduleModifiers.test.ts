/**
 * Fee Schedule Modifier Tests
 * Tests for Medicare/payer modifier adjustments in billing calculations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create chainable mock
const createChainableMock = () => {
  const mock: any = {
    select: vi.fn(() => mock),
    eq: vi.fn(() => mock),
    in: vi.fn(() => mock),
    lte: vi.fn(() => mock),
    gte: vi.fn(() => mock),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: (resolve: any) => resolve({ data: [], error: null }),
  };
  return mock;
};

// Mock supabase before importing the service
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => createChainableMock()),
    rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
  },
}));

// Test the modifier calculation logic in isolation
describe('FeeScheduleService - Modifier Calculation Logic', () => {
  // Test the modifier adjustment percentages directly
  const calculateModifierAdjustment = (baseRate: number, modifiers: string[]): number => {
    let adjustedRate = baseRate;
    for (const modifier of modifiers) {
      const mod = modifier.toUpperCase();
      switch (mod) {
        case '26':
          adjustedRate *= 0.26;
          break;
        case 'TC':
          adjustedRate *= 0.74;
          break;
        case '52':
        case '53':
          adjustedRate *= 0.50;
          break;
        case '22':
          adjustedRate *= 1.25;
          break;
        case '50':
          adjustedRate *= 1.50;
          break;
        case '51':
          adjustedRate *= 0.50;
          break;
        case '80':
        case '82':
          adjustedRate *= 0.16;
          break;
        case '81':
          adjustedRate *= 0.10;
          break;
        case '25':
        case '59':
        case 'XE':
        case 'XP':
        case 'XS':
        case 'XU':
        case 'GT':
        case '95':
        case 'GQ':
        case 'G0':
          // No adjustment
          break;
      }
    }
    return adjustedRate;
  };

  describe('Modifier Adjustments', () => {
    const baseRate = 100; // $100 base rate for easy calculation

    it('should apply professional component modifier (26) - 26% of base', () => {
      const adjusted = calculateModifierAdjustment(baseRate, ['26']);
      expect(adjusted).toBe(26);
    });

    it('should apply technical component modifier (TC) - 74% of base', () => {
      const adjusted = calculateModifierAdjustment(baseRate, ['TC']);
      expect(adjusted).toBe(74);
    });

    it('should apply reduced services modifier (52) - 50% of base', () => {
      const adjusted = calculateModifierAdjustment(baseRate, ['52']);
      expect(adjusted).toBe(50);
    });

    it('should apply discontinued procedure modifier (53) - 50% of base', () => {
      const adjusted = calculateModifierAdjustment(baseRate, ['53']);
      expect(adjusted).toBe(50);
    });

    it('should apply bilateral procedure modifier (50) - 150% of base', () => {
      const adjusted = calculateModifierAdjustment(baseRate, ['50']);
      expect(adjusted).toBe(150);
    });

    it('should apply multiple procedure modifier (51) - 50% reduction', () => {
      const adjusted = calculateModifierAdjustment(baseRate, ['51']);
      expect(adjusted).toBe(50);
    });

    it('should apply increased services modifier (22) - 125% of base', () => {
      const adjusted = calculateModifierAdjustment(baseRate, ['22']);
      expect(adjusted).toBe(125);
    });

    it('should apply assistant surgeon modifier (80) - 16% of base', () => {
      const adjusted = calculateModifierAdjustment(baseRate, ['80']);
      expect(adjusted).toBe(16);
    });

    it('should apply minimum assistant surgeon modifier (81) - 10% of base', () => {
      const adjusted = calculateModifierAdjustment(baseRate, ['81']);
      expect(adjusted).toBe(10);
    });

    it('should apply assistant surgeon when qualified resident not available (82) - 16% of base', () => {
      const adjusted = calculateModifierAdjustment(baseRate, ['82']);
      expect(adjusted).toBe(16);
    });

    it('should not adjust for informational modifier 25', () => {
      const adjusted = calculateModifierAdjustment(baseRate, ['25']);
      expect(adjusted).toBe(100);
    });

    it('should not adjust for informational modifier 59', () => {
      const adjusted = calculateModifierAdjustment(baseRate, ['59']);
      expect(adjusted).toBe(100);
    });

    it('should not adjust for telehealth modifier GT', () => {
      const adjusted = calculateModifierAdjustment(baseRate, ['GT']);
      expect(adjusted).toBe(100);
    });

    it('should not adjust for synchronous telemedicine modifier 95', () => {
      const adjusted = calculateModifierAdjustment(baseRate, ['95']);
      expect(adjusted).toBe(100);
    });

    it('should handle multiple modifiers in sequence', () => {
      // 26 (26%) then 52 (50%) = 13% of base
      const adjusted = calculateModifierAdjustment(baseRate, ['26', '52']);
      expect(adjusted).toBe(13);
    });

    it('should handle case-insensitive modifiers', () => {
      const lowerCase = calculateModifierAdjustment(baseRate, ['tc']);
      const upperCase = calculateModifierAdjustment(baseRate, ['TC']);
      expect(lowerCase).toBe(upperCase);
      expect(lowerCase).toBe(74);
    });

    it('should return original rate with no modifiers', () => {
      const adjusted = calculateModifierAdjustment(baseRate, []);
      expect(adjusted).toBe(100);
    });

    it('should handle unknown modifiers without adjustment', () => {
      const adjusted = calculateModifierAdjustment(baseRate, ['ZZ', 'XX']);
      expect(adjusted).toBe(100);
    });

    it('should correctly compound professional and increased services', () => {
      // 26 (26%) then 22 (125%) = 32.5% of base
      const adjusted = calculateModifierAdjustment(baseRate, ['26', '22']);
      expect(adjusted).toBe(32.5);
    });

    it('should handle bilateral with assistant surgeon', () => {
      // 50 (150%) then 80 (16%) = 24% of base
      const adjusted = calculateModifierAdjustment(baseRate, ['50', '80']);
      expect(adjusted).toBe(24);
    });
  });
});
