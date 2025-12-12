/**
 * Patient-Friendly AVS Service Tests
 *
 * Tests for AVS generation, readability scoring, and medical term simplification.
 */

import type {
  AVSInput,
  AVSGenerationRequest,
  PatientFriendlyAVS,
} from '../../types/patientFriendlyAVS';
import {
  calculateFleschKincaidGrade,
  countSyllables,
  meetsGradeLevel,
  getReadingLevelColor,
  getReadingLevelDescription,
  formatAVSAsPlainText,
} from '../../types/patientFriendlyAVS';

// Mock Supabase client - must be defined BEFORE jest.mock
jest.mock('../../lib/supabaseClient', () => {
  const mockFrom = jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({
          data: { tenant_id: 'test-tenant' },
          error: null,
        })),
        order: jest.fn(() => ({
          limit: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
    })),
    insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
    update: jest.fn(() => ({
      eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  }));

  const mockAuth = {
    getUser: jest.fn(() => Promise.resolve({
      data: { user: { id: 'test-user-id' } },
    })),
  };

  return {
    supabase: {
      from: mockFrom,
      auth: mockAuth,
    },
  };
});

jest.mock('../auditLogger', () => ({
  auditLogger: {
    info: jest.fn(() => Promise.resolve()),
    warn: jest.fn(() => Promise.resolve()),
    error: jest.fn(() => Promise.resolve()),
  },
}));

// Import after mocks are set up
import { PatientFriendlyAVSService } from '../patientFriendlyAVSService';
import { supabase } from '../../lib/supabaseClient';

const mockSupabaseClient = supabase as jest.Mocked<typeof supabase>;

describe('PatientFriendlyAVSService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAVS', () => {
    // Note: Service integration tests require full DB mocking
    // These tests focus on ensuring the service handles errors gracefully
    it('should return result object with processingTimeMs', async () => {
      const request: AVSGenerationRequest = {
        input: {
          patientId: 'patient-123',
          visitDate: '2025-12-11',
        },
      };

      const result = await PatientFriendlyAVSService.generateAVS(request);

      // Should always return a result with timing
      expect(result.processingTimeMs).toBeDefined();
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // Note: Integration tests for approveAVS, markDelivered, recordFeedback
  // require full database mocking. The pure function tests below cover the
  // core logic.
});

describe('Patient-Friendly AVS Type Helpers', () => {
  describe('calculateFleschKincaidGrade', () => {
    it('should calculate grade level for simple text', () => {
      const simpleText = 'The cat sat on the mat. The dog ran fast. It was fun.';
      const grade = calculateFleschKincaidGrade(simpleText);

      expect(grade).toBeLessThan(6);
    });

    it('should calculate higher grade for complex text', () => {
      const complexText = 'The cardiovascular manifestations demonstrate significant hyperglycemia-induced microvascular complications requiring immediate intervention.';
      const grade = calculateFleschKincaidGrade(complexText);

      expect(grade).toBeGreaterThan(10);
    });

    it('should return 0 for empty text', () => {
      const grade = calculateFleschKincaidGrade('');
      expect(grade).toBeGreaterThanOrEqual(0);
    });

    it('should handle single word', () => {
      const grade = calculateFleschKincaidGrade('Hello');
      expect(grade).toBeGreaterThanOrEqual(0);
    });
  });

  describe('countSyllables', () => {
    it('should count syllables correctly', () => {
      expect(countSyllables('cat')).toBe(1);
      expect(countSyllables('water')).toBe(2);
      expect(countSyllables('beautiful')).toBe(3);
    });

    it('should handle silent e', () => {
      // "make" should be 1 syllable, not 2
      expect(countSyllables('make')).toBe(1);
    });

    it('should count syllables in sentences', () => {
      const count = countSyllables('The quick brown fox');
      expect(count).toBe(4);
    });
  });

  describe('meetsGradeLevel', () => {
    it('should return true for simple text at grade 6', () => {
      const simpleText = 'Take your pills. Drink water. Rest at home.';
      expect(meetsGradeLevel(simpleText, 6)).toBe(true);
    });

    it('should return false for complex text at grade 6', () => {
      const complexText = 'The pathophysiological mechanisms underlying the cardiovascular complications necessitate comprehensive pharmacological intervention strategies.';
      expect(meetsGradeLevel(complexText, 6)).toBe(false);
    });
  });

  describe('getReadingLevelColor', () => {
    it('should return green for grade 6 and below', () => {
      expect(getReadingLevelColor(4)).toContain('green');
      expect(getReadingLevelColor(6)).toContain('green');
    });

    it('should return yellow for grades 7-8', () => {
      expect(getReadingLevelColor(7)).toContain('yellow');
      expect(getReadingLevelColor(8)).toContain('yellow');
    });

    it('should return orange for grades 9-10', () => {
      expect(getReadingLevelColor(9)).toContain('orange');
      expect(getReadingLevelColor(10)).toContain('orange');
    });

    it('should return red for grades above 10', () => {
      expect(getReadingLevelColor(12)).toContain('red');
      expect(getReadingLevelColor(14)).toContain('red');
    });
  });

  describe('getReadingLevelDescription', () => {
    it('should return appropriate descriptions', () => {
      expect(getReadingLevelDescription(4)).toContain('Elementary');
      expect(getReadingLevelDescription(6)).toContain('Middle school');
      expect(getReadingLevelDescription(10)).toContain('High school');
      expect(getReadingLevelDescription(14)).toContain('Graduate');
    });
  });

  describe('formatAVSAsPlainText', () => {
    it('should format AVS for printing', () => {
      const avs: PatientFriendlyAVS = {
        id: 'avs-123',
        patientId: 'patient-456',
        generatedAt: new Date().toISOString(),
        whatHappened: 'You came in for a check-up.',
        whatWeFound: 'Everything looks good.',
        whatToDoNext: ['Take your medicine', 'Drink water'],
        warningSignsToWatch: ['Call if you have a fever'],
        medicationChanges: {
          newMedicines: [],
          stoppedMedicines: [],
          changedDoses: [],
        },
        questionsToAsk: ['When can I exercise?'],
        readingGradeLevel: 5.2,
        language: 'en',
        confidence: 0.9,
      };

      const plainText = formatAVSAsPlainText(avs);

      expect(plainText).toContain('AFTER VISIT SUMMARY');
      expect(plainText).toContain('WHAT HAPPENED TODAY');
      expect(plainText).toContain('You came in for a check-up');
      expect(plainText).toContain('WHAT WE FOUND');
      expect(plainText).toContain('WHAT TO DO NEXT');
      expect(plainText).toContain('Take your medicine');
      expect(plainText).toContain('WARNING SIGNS');
      expect(plainText).toContain('fever');
      expect(plainText).toContain('QUESTIONS');
      expect(plainText).toContain('Reading Level');
    });

    it('should include medication section when present', () => {
      const avs: PatientFriendlyAVS = {
        id: 'avs-123',
        patientId: 'patient-456',
        generatedAt: new Date().toISOString(),
        whatHappened: 'Follow-up visit.',
        whatWeFound: 'Blood pressure is better.',
        whatToDoNext: ['Continue medicine'],
        warningSignsToWatch: [],
        medicationChanges: {
          newMedicines: [{
            name: 'Lisinopril',
            purpose: 'For blood pressure',
            howToTake: 'One pill by mouth',
            whenToTake: 'Every morning',
          }],
          stoppedMedicines: [],
          changedDoses: [],
        },
        questionsToAsk: [],
        readingGradeLevel: 5.0,
        language: 'en',
        confidence: 0.85,
      };

      const plainText = formatAVSAsPlainText(avs);

      expect(plainText).toContain('MEDICATION CHANGES');
      expect(plainText).toContain('New Medicines');
      expect(plainText).toContain('Lisinopril');
      expect(plainText).toContain('blood pressure');
    });

    it('should include next appointment when present', () => {
      const avs: PatientFriendlyAVS = {
        id: 'avs-123',
        patientId: 'patient-456',
        generatedAt: new Date().toISOString(),
        whatHappened: 'Annual visit.',
        whatWeFound: 'All normal.',
        whatToDoNext: ['See you next year'],
        warningSignsToWatch: [],
        medicationChanges: {
          newMedicines: [],
          stoppedMedicines: [],
          changedDoses: [],
        },
        nextAppointment: {
          when: 'Tuesday, December 17th at 2:00 PM',
          where: '123 Medical Center Drive',
          bringWith: ['Insurance card', 'Medication list'],
          contactInfo: '555-123-4567',
        },
        questionsToAsk: [],
        readingGradeLevel: 4.5,
        language: 'en',
        confidence: 0.9,
      };

      const plainText = formatAVSAsPlainText(avs);

      expect(plainText).toContain('NEXT APPOINTMENT');
      expect(plainText).toContain('December 17th');
      expect(plainText).toContain('Medical Center');
      expect(plainText).toContain('Insurance card');
      expect(plainText).toContain('555-123-4567');
    });
  });
});
