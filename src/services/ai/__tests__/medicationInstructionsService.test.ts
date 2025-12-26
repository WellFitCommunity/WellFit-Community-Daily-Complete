/**
 * Tests for Medication Instructions Service
 *
 * Covers personalized medication instructions with visual aids
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MedicationInstructionsService,
  MedicationInstructionsRequest,
  MedicationInstructionsResponse,
  MedicationInfo,
  MedicationInstructionResult,
} from '../medicationInstructionsService';

// Mock supabaseClient
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'test-id',
          instruction_id: 'inst-123',
          patient_id: 'patient-123',
          medication_name: 'Metformin',
          dosage: '500mg',
          result: {},
          created_at: new Date().toISOString(),
        },
        error: null,
      }),
    })),
  },
}));

// =====================================================
// MOCK DATA FACTORIES
// =====================================================

function createMockMedication(overrides?: Partial<MedicationInfo>): MedicationInfo {
  return {
    name: 'Metformin',
    genericName: 'Metformin Hydrochloride',
    dosage: '500mg',
    form: 'tablet',
    frequency: 'twice daily',
    route: 'oral',
    purpose: 'Type 2 Diabetes management',
    prescriber: 'Dr. Smith',
    refillsRemaining: 3,
    pillColor: 'white',
    pillShape: 'oval',
    pillImprint: 'MET 500',
    ...overrides,
  };
}

function createMockInstructionResult(): MedicationInstructionResult {
  return {
    medicationName: 'Metformin 500mg',
    whatItDoes: 'Helps control your blood sugar levels',
    whyYouTakeIt: 'To manage your Type 2 Diabetes',
    pillIdentification: {
      color: 'White',
      shape: 'Oval',
      size: 'Medium',
      imprint: 'MET 500',
      visualDescription: 'A white, oval-shaped pill with "MET 500" stamped on one side',
    },
    dosingSchedule: [
      {
        timeOfDay: 'Morning',
        specificTime: '8:00 AM',
        doseAmount: '1 tablet (500mg)',
        withFood: 'required',
        timingNotes: 'Take with breakfast',
      },
      {
        timeOfDay: 'Evening',
        specificTime: '6:00 PM',
        doseAmount: '1 tablet (500mg)',
        withFood: 'required',
        timingNotes: 'Take with dinner',
      },
    ],
    howToTake: [
      'Swallow the tablet whole with a full glass of water',
      'Take with food to reduce stomach upset',
    ],
    foodDrinkInteractions: [
      {
        substance: 'Alcohol',
        type: 'alcohol',
        severity: 'caution',
        description: 'May increase risk of low blood sugar',
        recommendation: 'Limit alcohol consumption',
      },
    ],
    drugInteractions: [],
    storageInstructions: [
      'Store at room temperature',
      'Keep away from moisture and heat',
    ],
    missedDoseInstructions: [
      'Take the missed dose as soon as you remember',
      'Skip the missed dose if it is almost time for your next dose',
    ],
    sideEffects: [
      {
        effect: 'Upset stomach',
        likelihood: 'common',
        severity: 'mild',
        action: 'Usually improves with time. Take with food.',
        callDoctorIf: 'Symptoms persist for more than 2 weeks',
      },
    ],
    warningSigns: [
      {
        sign: 'Extreme tiredness or weakness',
        action: 'Call your doctor immediately',
        urgency: 'call_doctor',
      },
    ],
    refillInfo: {
      refillsRemaining: 3,
      howToRefill: 'Contact your pharmacy or use the online portal',
    },
    reminderTips: [
      'Take your medication at the same times each day',
      'Set a daily alarm on your phone',
    ],
    questionsForDoctor: [
      'What should I do if I miss multiple doses?',
    ],
    dosAndDonts: {
      dos: ['Take with meals', 'Stay hydrated'],
      donts: ['Do not skip doses', 'Do not drink excessive alcohol'],
    },
    emergencyInfo: {
      overdoseSymptoms: ['Extreme low blood sugar', 'Confusion', 'Seizures'],
      overdoseAction: 'Call 911 or Poison Control immediately',
      poisonControlNumber: '1-800-222-1222',
    },
  };
}

function createMockRequest(overrides?: Partial<MedicationInstructionsRequest>): MedicationInstructionsRequest {
  return {
    patientId: 'patient-123',
    medication: createMockMedication(),
    patientContext: {
      age: 65,
      language: 'en',
      readingLevel: 'simple',
    },
    tenantId: 'test-tenant',
    ...overrides,
  };
}

function createMockResponse(): MedicationInstructionsResponse {
  return {
    result: createMockInstructionResult(),
    metadata: {
      generatedAt: new Date().toISOString(),
      model: 'claude-haiku-4.5',
      responseTimeMs: 800,
      language: 'en',
      readingLevel: 'simple',
    },
  };
}

// =====================================================
// TESTS
// =====================================================

describe('MedicationInstructionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateInstructions', () => {
    it('should return failure when patientId is empty', async () => {
      const request = createMockRequest({ patientId: '' });
      const result = await MedicationInstructionsService.generateInstructions(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should return failure when patientId is whitespace only', async () => {
      const request = createMockRequest({ patientId: '   ' });
      const result = await MedicationInstructionsService.generateInstructions(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should return failure when medication is missing', async () => {
      const request = createMockRequest({ medication: undefined as unknown as MedicationInfo });
      const result = await MedicationInstructionsService.generateInstructions(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should return failure when medication name is missing', async () => {
      const request = createMockRequest({ medication: { ...createMockMedication(), name: '' } });
      const result = await MedicationInstructionsService.generateInstructions(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should return failure when medication dosage is missing', async () => {
      const request = createMockRequest({ medication: { ...createMockMedication(), dosage: '' } });
      const result = await MedicationInstructionsService.generateInstructions(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should handle edge function errors gracefully', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: 'Edge function error' },
      });

      const request = createMockRequest();
      const result = await MedicationInstructionsService.generateInstructions(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MEDICATION_INSTRUCTIONS_GENERATION_FAILED');
    });

    it('should successfully generate instructions', async () => {
      const mockResponse = createMockResponse();
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const request = createMockRequest();
      const result = await MedicationInstructionsService.generateInstructions(request);

      expect(result.success).toBe(true);
      expect(result.data?.result.medicationName).toBe('Metformin 500mg');
      expect(result.data?.result.dosingSchedule.length).toBe(2);
    });
  });

  describe('generateBulkInstructions', () => {
    it('should return failure when patientId is empty', async () => {
      const result = await MedicationInstructionsService.generateBulkInstructions('', [createMockMedication()]);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should return failure when medications array is empty', async () => {
      const result = await MedicationInstructionsService.generateBulkInstructions('patient-123', []);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should generate instructions for multiple medications', async () => {
      const mockResponse = createMockResponse();
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const medications = [
        createMockMedication(),
        createMockMedication({ name: 'Lisinopril', dosage: '10mg' }),
      ];

      const result = await MedicationInstructionsService.generateBulkInstructions('patient-123', medications);

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(2);
    });
  });

  describe('saveInstructions', () => {
    it('should save instructions successfully', async () => {
      const request = createMockRequest();
      const response = createMockResponse();

      const result = await MedicationInstructionsService.saveInstructions(request, response);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('test-id');
    });
  });

  describe('markAsDelivered', () => {
    it('should mark instructions as delivered', async () => {
      const result = await MedicationInstructionsService.markAsDelivered('inst-123', 'sms');

      expect(result.success).toBe(true);
    });
  });

  describe('formatForSMS', () => {
    it('should format instructions for SMS', () => {
      const result = createMockInstructionResult();
      const sms = MedicationInstructionsService.formatForSMS(result, 'John');

      expect(sms).toContain('Hi John!');
      expect(sms).toContain('Metformin 500mg');
      expect(sms).toContain('Morning');
      expect(sms.length).toBeLessThanOrEqual(1500);
    });

    it('should truncate long SMS messages', () => {
      const result = createMockInstructionResult();
      // Make message actually exceed 1500 chars by adding many dosing schedules
      // SMS format includes: greeting, whatItDoes, "WHEN TO TAKE:" header, schedule items, AVOID section
      result.dosingSchedule = Array(100).fill({
        timeOfDay: 'Morning with a very long time description that adds extra length',
        specificTime: '8:00 AM',
        doseAmount: '1 tablet (500mg) of this very long medication name for testing truncation',
        withFood: 'required' as const,
        timingNotes: 'Take with breakfast',
      });
      result.whatItDoes = 'A'.repeat(500); // Make whatItDoes very long too
      result.dosAndDonts.donts = Array(20).fill('This is a very long instruction that should not be done under any circumstances whatsoever');

      const sms = MedicationInstructionsService.formatForSMS(result, 'John');

      expect(sms.length).toBeLessThanOrEqual(1500);
      expect(sms.endsWith('...')).toBe(true);
    });
  });

  describe('formatForPrint', () => {
    it('should format instructions for print', () => {
      const result = createMockInstructionResult();
      const print = MedicationInstructionsService.formatForPrint(result, 'John Doe');

      expect(print).toContain('JOHN DOE');
      expect(print).toContain('MEDICATION: Metformin 500mg');
      expect(print).toContain('WHEN TO TAKE');
      expect(print).toContain('HOW TO TAKE');
      expect(print).toContain('POSSIBLE SIDE EFFECTS');
      expect(print).toContain('EMERGENCY');
    });
  });

  describe('generateReminderCard', () => {
    it('should generate a reminder card', () => {
      const result = createMockInstructionResult();
      const card = MedicationInstructionsService.generateReminderCard(result);

      expect(card).toContain('Metformin 500mg');
      expect(card).toContain('Morning');
      expect(card).toContain('Evening');
    });
  });

  describe('getPatientInstructionHistory', () => {
    it('should fetch patient instruction history', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'test-id',
              instruction_id: 'inst-123',
              patient_id: 'patient-123',
              medication_name: 'Metformin',
              dosage: '500mg',
              result: createMockInstructionResult(),
              created_at: new Date().toISOString(),
            },
          ],
          error: null,
        }),
      } as never);

      const result = await MedicationInstructionsService.getPatientInstructionHistory('patient-123');

      expect(result.success).toBe(true);
    });
  });
});
