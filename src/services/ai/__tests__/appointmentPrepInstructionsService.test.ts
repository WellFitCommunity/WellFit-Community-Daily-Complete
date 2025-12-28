/**
 * Tests for Appointment Prep Instructions AI Service
 * Skill #27 - Personalized appointment preparation instructions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppointmentPrepInstructionsService } from '../appointmentPrepInstructionsService';
import type {
  AppointmentPrepRequest,
  AppointmentPrepResponse,
  AppointmentPrepResult,
  AppointmentDetails,
  PatientPrepContext,
  SavedAppointmentPrep as _SavedAppointmentPrep,
  AppointmentType,
} from '../appointmentPrepInstructionsService';

// Mock supabase client
const mockFrom = vi.fn();
const mockInvoke = vi.fn();

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

describe('AppointmentPrepInstructionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test Data
  // ─────────────────────────────────────────────────────────────────────────

  const mockAppointment: AppointmentDetails = {
    type: 'lab_work',
    specialty: 'Laboratory',
    providerName: 'Dr. Smith',
    appointmentDateTime: '2025-12-25T09:00:00.000Z',
    location: 'Main Clinic Lab',
    durationMinutes: 30,
    plannedTests: ['Complete Blood Count', 'Basic Metabolic Panel'],
  };

  const mockPatientContext: PatientPrepContext = {
    age: 65,
    activeConditions: [
      { code: 'E11.9', display: 'Type 2 Diabetes' },
      { code: 'I10', display: 'Essential Hypertension' },
    ],
    currentMedications: [
      { name: 'Metformin', dosage: '500mg', frequency: 'BID' },
      { name: 'Lisinopril', dosage: '10mg', frequency: 'Daily' },
    ],
    allergies: ['Penicillin'],
    language: 'English',
  };

  const mockRequest: AppointmentPrepRequest = {
    patientId: 'patient-uuid-123',
    appointment: mockAppointment,
    patientContext: mockPatientContext,
    tenantId: 'tenant-uuid-456',
  };

  const mockPrepResult: AppointmentPrepResult = {
    greeting: "We're looking forward to seeing you for your lab work on Wednesday!",
    appointmentSummary: 'Blood tests to check your overall health and blood sugar control.',
    instructions: [
      {
        category: 'dietary',
        priority: 'required',
        timing: '8-12 hours before',
        instruction: 'Do not eat or drink anything except water',
        rationale: 'Fasting ensures accurate test results',
      },
      {
        category: 'medication',
        priority: 'required',
        timing: 'Morning of appointment',
        instruction: 'Take your blood pressure medication as usual',
        rationale: 'Blood pressure control is important',
      },
    ],
    bringChecklist: [
      { item: 'Photo ID', required: true },
      { item: 'Insurance card', required: true },
      { item: 'List of current medications', required: true },
      { item: 'Lab order form (if you have one)', required: false, note: 'We may already have it on file' },
    ],
    medicationInstructions: [
      {
        medication: 'Metformin',
        instruction: 'Hold until after blood draw',
        timing: 'Morning of appointment',
        warning: 'Take with breakfast after your appointment',
      },
      {
        medication: 'Lisinopril',
        instruction: 'Take as usual',
        timing: 'Morning of appointment',
      },
    ],
    dietaryInstructions: {
      fastingRequired: true,
      fastingHours: 12,
      foodRestrictions: ['No food', 'No beverages except water'],
      hydrationGuidance: 'Drink plenty of water - it makes drawing blood easier',
    },
    whatToExpect: [
      'Check in at the lab front desk',
      'Show your ID and insurance card',
      'A phlebotomist will call your name',
      'Blood draw takes about 5-10 minutes',
      'You may feel a small pinch',
    ],
    estimatedDuration: '30 minutes',
    suggestedQuestions: [
      'When will my results be available?',
      'How should I interpret my results?',
      'Will you share results with my doctor automatically?',
    ],
    keyReminders: [
      'Fast for 12 hours before your appointment',
      'Drink plenty of water',
      'Wear short sleeves or loose sleeves',
      'Hold your Metformin until after the blood draw',
    ],
  };

  const mockResponse: AppointmentPrepResponse = {
    result: mockPrepResult,
    metadata: {
      generatedAt: '2025-12-23T20:00:00.000Z',
      model: 'claude-haiku-4-20250514',
      responseTimeMs: 1200,
      appointmentType: 'lab_work',
      language: 'English',
    },
  };

  // ─────────────────────────────────────────────────────────────────────────
  // generatePrepInstructions Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('generatePrepInstructions', () => {
    it('should successfully generate prep instructions', async () => {
      mockInvoke.mockResolvedValueOnce({ data: mockResponse, error: null });

      const result = await AppointmentPrepInstructionsService.generatePrepInstructions(mockRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.result.dietaryInstructions?.fastingRequired).toBe(true);
        expect(result.data.result.keyReminders.length).toBeGreaterThan(0);
        expect(result.data.metadata.appointmentType).toBe('lab_work');
      }

      expect(mockInvoke).toHaveBeenCalledWith('ai-appointment-prep-instructions', {
        body: expect.objectContaining({
          patientId: 'patient-uuid-123',
          appointment: mockAppointment,
        }),
      });
    });

    it('should fail when patientId is missing', async () => {
      const invalidRequest = { ...mockRequest, patientId: '' };

      const result = await AppointmentPrepInstructionsService.generatePrepInstructions(invalidRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
        expect(result.error.message).toBe('Patient ID is required');
      }
    });

    it('should fail when appointment is missing', async () => {
      const invalidRequest = { ...mockRequest, appointment: undefined as unknown as AppointmentDetails };

      const result = await AppointmentPrepInstructionsService.generatePrepInstructions(invalidRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
        expect(result.error.message).toBe('Appointment details are required');
      }
    });

    it('should fail when appointment type is missing', async () => {
      const invalidRequest = {
        ...mockRequest,
        appointment: { ...mockAppointment, type: '' as AppointmentType },
      };

      const result = await AppointmentPrepInstructionsService.generatePrepInstructions(invalidRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
        expect(result.error.message).toBe('Appointment type is required');
      }
    });

    it('should fail when appointmentDateTime is missing', async () => {
      const invalidRequest = {
        ...mockRequest,
        appointment: { ...mockAppointment, appointmentDateTime: '' },
      };

      const result = await AppointmentPrepInstructionsService.generatePrepInstructions(invalidRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
        expect(result.error.message).toBe('Appointment date/time is required');
      }
    });

    it('should handle edge function errors gracefully', async () => {
      mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('Service unavailable') });

      const result = await AppointmentPrepInstructionsService.generatePrepInstructions(mockRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('APPOINTMENT_PREP_GENERATION_FAILED');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // savePrepInstructions Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('savePrepInstructions', () => {
    const mockSavedRecord = {
      id: 'saved-uuid-123',
      prep_id: 'prep-uuid-456',
      patient_id: 'patient-uuid-123',
      appointment_type: 'lab_work',
      appointment_date_time: '2025-12-25T09:00:00.000Z',
      result: mockPrepResult,
      created_at: '2025-12-23T20:00:00.000Z',
    };

    it('should successfully save prep instructions', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockSavedRecord, error: null }),
        }),
      });
      mockFrom.mockReturnValueOnce({ insert: mockInsert });

      const result = await AppointmentPrepInstructionsService.savePrepInstructions(
        mockRequest,
        mockResponse
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('saved-uuid-123');
        expect(result.data.appointmentType).toBe('lab_work');
      }
    });

    it('should handle save errors gracefully', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: new Error('Database error') }),
        }),
      });
      mockFrom.mockReturnValueOnce({ insert: mockInsert });

      const result = await AppointmentPrepInstructionsService.savePrepInstructions(
        mockRequest,
        mockResponse
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('APPOINTMENT_PREP_SAVE_FAILED');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // markAsSent Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('markAsSent', () => {
    const mockUpdatedRecord = {
      id: 'saved-uuid-123',
      prep_id: 'prep-uuid-456',
      patient_id: 'patient-uuid-123',
      appointment_type: 'lab_work',
      appointment_date_time: '2025-12-25T09:00:00.000Z',
      result: mockPrepResult,
      sent_via: 'sms',
      sent_at: '2025-12-23T21:00:00.000Z',
      created_at: '2025-12-23T20:00:00.000Z',
    };

    it('should successfully mark prep as sent via SMS', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockUpdatedRecord, error: null }),
          }),
        }),
      });
      mockFrom.mockReturnValueOnce({ update: mockUpdate });

      const result = await AppointmentPrepInstructionsService.markAsSent('saved-uuid-123', 'sms');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sentVia).toBe('sms');
        expect(result.data.sentAt).toBeDefined();
      }
    });

    it('should successfully mark prep as sent via email', async () => {
      const emailRecord = { ...mockUpdatedRecord, sent_via: 'email' };
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: emailRecord, error: null }),
          }),
        }),
      });
      mockFrom.mockReturnValueOnce({ update: mockUpdate });

      const result = await AppointmentPrepInstructionsService.markAsSent('saved-uuid-123', 'email');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sentVia).toBe('email');
      }
    });

    it('should handle update errors gracefully', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
          }),
        }),
      });
      mockFrom.mockReturnValueOnce({ update: mockUpdate });

      const result = await AppointmentPrepInstructionsService.markAsSent('invalid-uuid', 'sms');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('APPOINTMENT_PREP_UPDATE_FAILED');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getPatientPrepHistory Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('getPatientPrepHistory', () => {
    const mockHistoryRecords = [
      {
        id: 'record-1',
        prep_id: 'prep-1',
        patient_id: 'patient-uuid-123',
        appointment_type: 'lab_work',
        appointment_date_time: '2025-12-25T09:00:00.000Z',
        result: mockPrepResult,
        created_at: '2025-12-23T20:00:00.000Z',
      },
      {
        id: 'record-2',
        prep_id: 'prep-2',
        patient_id: 'patient-uuid-123',
        appointment_type: 'annual_physical',
        appointment_date_time: '2025-12-20T14:00:00.000Z',
        result: mockPrepResult,
        created_at: '2025-12-18T10:00:00.000Z',
      },
    ];

    it('should successfully fetch patient prep history', async () => {
      const mockLimitFn = vi.fn().mockResolvedValue({ data: mockHistoryRecords, error: null });
      const mockOrderFn = vi.fn().mockReturnValue({ limit: mockLimitFn });
      const mockEqFn = vi.fn().mockReturnValue({ order: mockOrderFn });
      const mockSelectFn = vi.fn().mockReturnValue({ eq: mockEqFn });
      mockFrom.mockReturnValueOnce({ select: mockSelectFn });

      const result = await AppointmentPrepInstructionsService.getPatientPrepHistory('patient-uuid-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(2);
        expect(result.data[0].appointmentType).toBe('lab_work');
      }
    });

    it('should respect the limit parameter', async () => {
      const mockLimitFn = vi.fn().mockResolvedValue({ data: [mockHistoryRecords[0]], error: null });
      const mockOrderFn = vi.fn().mockReturnValue({ limit: mockLimitFn });
      const mockEqFn = vi.fn().mockReturnValue({ order: mockOrderFn });
      const mockSelectFn = vi.fn().mockReturnValue({ eq: mockEqFn });
      mockFrom.mockReturnValueOnce({ select: mockSelectFn });

      const result = await AppointmentPrepInstructionsService.getPatientPrepHistory('patient-uuid-123', 1);

      expect(result.success).toBe(true);
      expect(mockLimitFn).toHaveBeenCalledWith(1);
    });

    it('should handle empty history gracefully', async () => {
      const mockLimitFn = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockOrderFn = vi.fn().mockReturnValue({ limit: mockLimitFn });
      const mockEqFn = vi.fn().mockReturnValue({ order: mockOrderFn });
      const mockSelectFn = vi.fn().mockReturnValue({ eq: mockEqFn });
      mockFrom.mockReturnValueOnce({ select: mockSelectFn });

      const result = await AppointmentPrepInstructionsService.getPatientPrepHistory('patient-uuid-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(0);
      }
    });

    it('should handle fetch errors gracefully', async () => {
      const mockLimitFn = vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Database connection failed'),
      });
      const mockOrderFn = vi.fn().mockReturnValue({ limit: mockLimitFn });
      const mockEqFn = vi.fn().mockReturnValue({ order: mockOrderFn });
      const mockSelectFn = vi.fn().mockReturnValue({ eq: mockEqFn });
      mockFrom.mockReturnValueOnce({ select: mockSelectFn });

      const result = await AppointmentPrepInstructionsService.getPatientPrepHistory('patient-uuid-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('HISTORY_FETCH_FAILED');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getQuickPrepSummary Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('getQuickPrepSummary', () => {
    it('should return quick summary for lab_work', () => {
      const result = AppointmentPrepInstructionsService.getQuickPrepSummary('lab_work');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBeGreaterThan(0);
        expect(result.data.some((s) => s.toLowerCase().includes('fasting'))).toBe(true);
      }
    });

    it('should return quick summary for annual_physical', () => {
      const result = AppointmentPrepInstructionsService.getQuickPrepSummary('annual_physical');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBeGreaterThan(0);
        expect(result.data.some((s) => s.toLowerCase().includes('medication'))).toBe(true);
      }
    });

    it('should return quick summary for imaging', () => {
      const result = AppointmentPrepInstructionsService.getQuickPrepSummary('imaging');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.some((s) => s.toLowerCase().includes('metal'))).toBe(true);
      }
    });

    it('should return quick summary for telehealth', () => {
      const result = AppointmentPrepInstructionsService.getQuickPrepSummary('telehealth');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.some((s) => s.toLowerCase().includes('device') || s.toLowerCase().includes('internet'))).toBe(true);
      }
    });

    it('should return fallback summary for unknown type', () => {
      const result = AppointmentPrepInstructionsService.getQuickPrepSummary('other');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBeGreaterThan(0);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // formatForSMS Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('formatForSMS', () => {
    it('should format prep instructions for SMS', () => {
      const output = AppointmentPrepInstructionsService.formatForSMS(mockPrepResult, 'John');

      expect(output).toContain('Hi John');
      expect(output).toContain('IMPORTANT');
      expect(output).toContain('BRING');
      expect(output.length).toBeLessThanOrEqual(1600);
    });

    it('should truncate long SMS messages', () => {
      const longResult: AppointmentPrepResult = {
        ...mockPrepResult,
        keyReminders: Array(100).fill('This is a very long reminder that should cause truncation when repeated many many times'),
        instructions: Array(50).fill({
          category: 'before',
          priority: 'required',
          timing: 'Before visit',
          instruction: 'This is an extremely long instruction that when repeated many times will exceed the SMS character limit',
        }),
        bringChecklist: Array(50).fill({ item: 'Very long item name that takes up a lot of space', required: true }),
      };

      const output = AppointmentPrepInstructionsService.formatForSMS(longResult, 'John');

      expect(output.length).toBeLessThanOrEqual(1600);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // formatForEmail Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('formatForEmail', () => {
    it('should format prep instructions for email with HTML', () => {
      const output = AppointmentPrepInstructionsService.formatForEmail(
        mockPrepResult,
        'John Doe',
        mockAppointment
      );

      expect(output).toContain('<html>');
      expect(output).toContain('Your Appointment Preparation Guide');
      expect(output).toContain('Key Reminders');
      expect(output).toContain('What to Bring');
      expect(output).toContain('</html>');
    });

    it('should include dietary instructions when fasting is required', () => {
      const output = AppointmentPrepInstructionsService.formatForEmail(
        mockPrepResult,
        'John Doe',
        mockAppointment
      );

      expect(output).toContain('Dietary Instructions');
      expect(output).toContain('Fasting Required');
      expect(output).toContain('12 hours');
    });

    it('should include medication instructions when present', () => {
      const output = AppointmentPrepInstructionsService.formatForEmail(
        mockPrepResult,
        'John Doe',
        mockAppointment
      );

      expect(output).toContain('Medication Instructions');
      expect(output).toContain('Metformin');
      expect(output).toContain('Lisinopril');
    });

    it('should include suggested questions when present', () => {
      const output = AppointmentPrepInstructionsService.formatForEmail(
        mockPrepResult,
        'John Doe',
        mockAppointment
      );

      expect(output).toContain('Questions You Might Want to Ask');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // formatForPrint Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('formatForPrint', () => {
    it('should format prep instructions for printing', () => {
      const output = AppointmentPrepInstructionsService.formatForPrint(
        mockPrepResult,
        'John Doe',
        mockAppointment
      );

      expect(output).toContain('APPOINTMENT PREPARATION INSTRUCTIONS');
      expect(output).toContain('Patient: John Doe');
      expect(output).toContain('KEY REMINDERS');
      expect(output).toContain('WHAT TO BRING');
      expect(output).toContain('[REQUIRED]');
    });

    it('should include dietary instructions section', () => {
      const output = AppointmentPrepInstructionsService.formatForPrint(
        mockPrepResult,
        'John Doe',
        mockAppointment
      );

      expect(output).toContain('DIETARY INSTRUCTIONS');
      expect(output).toContain('FASTING REQUIRED');
    });

    it('should include medication instructions section', () => {
      const output = AppointmentPrepInstructionsService.formatForPrint(
        mockPrepResult,
        'John Doe',
        mockAppointment
      );

      expect(output).toContain('MEDICATION INSTRUCTIONS');
      expect(output).toContain('Metformin');
    });

    it('should include questions section', () => {
      const output = AppointmentPrepInstructionsService.formatForPrint(
        mockPrepResult,
        'John Doe',
        mockAppointment
      );

      expect(output).toContain('QUESTIONS TO ASK');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Edge Cases
  // ─────────────────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle whitespace-only patient ID', async () => {
      const result = await AppointmentPrepInstructionsService.generatePrepInstructions({
        ...mockRequest,
        patientId: '   ',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });

    it('should handle missing patient context', async () => {
      mockInvoke.mockResolvedValueOnce({ data: mockResponse, error: null });

      const requestWithoutContext = {
        patientId: 'patient-uuid',
        appointment: mockAppointment,
      };

      const result = await AppointmentPrepInstructionsService.generatePrepInstructions(requestWithoutContext);

      expect(result.success).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith(
        'ai-appointment-prep-instructions',
        expect.objectContaining({
          body: expect.objectContaining({
            patientContext: {},
          }),
        })
      );
    });

    it('should handle all appointment types', () => {
      const appointmentTypes: AppointmentType[] = [
        'annual_physical',
        'follow_up',
        'specialist_consult',
        'lab_work',
        'imaging',
        'procedure',
        'telehealth',
        'vaccination',
        'mental_health',
        'dental',
        'eye_exam',
        'pre_surgical',
        'post_surgical',
        'other',
      ];

      appointmentTypes.forEach((type) => {
        const result = AppointmentPrepInstructionsService.getQuickPrepSummary(type);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.length).toBeGreaterThan(0);
        }
      });
    });
  });
});
