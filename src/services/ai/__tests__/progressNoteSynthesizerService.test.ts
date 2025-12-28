/**
 * Progress Note Synthesizer Service Tests
 *
 * @module progressNoteSynthesizerService.test
 * @skill #21 - Progress Note Synthesizer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ProgressNoteSynthesizerService,
  GeneratedProgressNote,
  ProgressNoteGenerationResponse,
  SavedProgressNote,
} from '../progressNoteSynthesizerService';

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(),
  },
}));

// Mock audit logger
vi.mock('../../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { supabase } from '../../../lib/supabaseClient';

describe('ProgressNoteSynthesizerService', () => {
  let service: ProgressNoteSynthesizerService;

  const mockProgressNote: GeneratedProgressNote = {
    noteId: 'note-123',
    patientId: 'patient-456',
    providerId: 'provider-789',
    periodStart: '2025-12-16T00:00:00Z',
    periodEnd: '2025-12-23T00:00:00Z',
    noteType: 'routine',
    vitalsTrends: [
      {
        parameter: 'Heart Rate',
        unit: 'bpm',
        readings: [
          { date: '2025-12-20', value: 72 },
          { date: '2025-12-21', value: 75 },
          { date: '2025-12-22', value: 70 },
        ],
        average: 72.3,
        min: 70,
        max: 75,
        trend: 'stable',
        concernLevel: 'normal',
      },
      {
        parameter: 'Blood Pressure (Systolic)',
        unit: 'mmHg',
        readings: [
          { date: '2025-12-20', value: 128 },
          { date: '2025-12-21', value: 135 },
          { date: '2025-12-22', value: 132 },
        ],
        average: 131.7,
        min: 128,
        max: 135,
        trend: 'stable',
        concernLevel: 'monitor',
      },
    ],
    moodSummary: {
      dominantMood: 'Good',
      moodDistribution: { Good: 4, Fair: 2, Excellent: 1 },
      trend: 'stable',
      concernLevel: 'normal',
    },
    activitySummary: {
      physicalActivityDays: 4,
      socialEngagementDays: 3,
      totalCheckIns: 7,
      completedCheckIns: 6,
      missedCheckIns: 1,
      adherenceRate: 86,
    },
    concernFlags: [
      {
        type: 'vital',
        severity: 'low',
        description: 'Blood pressure slightly elevated',
        recommendation: 'Continue monitoring',
      },
    ],
    summary: {
      subjective:
        'Patient reports feeling well overall with occasional fatigue. No new complaints.',
      objective:
        'Vital signs stable. Heart rate averaging 72 bpm. Blood pressure slightly elevated at 132/82 mmHg average.',
      assessment:
        'Patient making good progress with daily monitoring. Mild hypertension noted, currently managed.',
      plan:
        'Continue current monitoring regimen. Review blood pressure at next visit. Encourage continued physical activity.',
    },
    keyFindings: [
      'Good check-in adherence (86%)',
      'Stable heart rate',
      'Mild BP elevation - continue monitoring',
      'Positive mood trend',
    ],
    recommendations: [
      'Continue daily check-ins',
      'Monitor blood pressure closely',
      'Review medications at next appointment',
    ],
    confidence: 0.82,
    requiresReview: true,
    reviewReasons: ['Standard clinical review required'],
    dataQuality: 'good',
    generatedAt: '2025-12-23T10:00:00Z',
  };

  const mockResponse: ProgressNoteGenerationResponse = {
    progressNote: mockProgressNote,
    metadata: {
      generated_at: '2025-12-23T10:00:00Z',
      response_time_ms: 1250,
      model: 'claude-haiku-4-5-20250919',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProgressNoteSynthesizerService();

    // Default mock for auth
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          access_token: 'mock-token',
          refresh_token: 'mock-refresh',
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: 'user-123',
            email: 'test@example.com',
            aud: 'authenticated',
            created_at: '2024-01-01',
            app_metadata: {},
            user_metadata: {},
          },
        },
      },
      error: null,
    });
  });

  describe('synthesize', () => {
    it('should generate a progress note successfully', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await service.synthesize({
        patientId: 'patient-456',
        providerId: 'provider-789',
        periodDays: 7,
        noteType: 'routine',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.progressNote.noteId).toBe('note-123');
        expect(result.data.progressNote.summary.subjective).toContain('feeling well');
        expect(result.data.progressNote.confidence).toBeGreaterThan(0.5);
      }
    });

    it('should fail without patient ID', async () => {
      const result = await service.synthesize({
        patientId: '',
        providerId: 'provider-789',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });

    it('should fail without provider ID', async () => {
      const result = await service.synthesize({
        patientId: 'patient-456',
        providerId: '',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });

    it('should reject invalid period days', async () => {
      const result = await service.synthesize({
        patientId: 'patient-456',
        providerId: 'provider-789',
        periodDays: 15 as 7, // Invalid period
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid period');
      }
    });

    it('should fail without authentication', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const result = await service.synthesize({
        patientId: 'patient-456',
        providerId: 'provider-789',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('should always require review for clinical notes', async () => {
      const noteWithHighConfidence = {
        ...mockResponse,
        progressNote: { ...mockProgressNote, confidence: 0.95, requiresReview: false },
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: noteWithHighConfidence,
        error: null,
      });

      const result = await service.synthesize({
        patientId: 'patient-456',
        providerId: 'provider-789',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Should always require review regardless of confidence
        expect(result.data.progressNote.requiresReview).toBe(true);
      }
    });

    it('should add review reason for low confidence', async () => {
      const lowConfidenceNote = {
        ...mockResponse,
        progressNote: {
          ...mockProgressNote,
          confidence: 0.4,
          reviewReasons: [],
        },
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: lowConfidenceNote,
        error: null,
      });

      const result = await service.synthesize({
        patientId: 'patient-456',
        providerId: 'provider-789',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.progressNote.reviewReasons).toContain(
          'Low confidence - requires careful review'
        );
      }
    });

    it('should handle edge function error', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: 'Edge function timeout' },
      });

      const result = await service.synthesize({
        patientId: 'patient-456',
        providerId: 'provider-789',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('PROGRESS_NOTE_SYNTHESIS_FAILED');
      }
    });
  });

  describe('synthesizeWeekly', () => {
    it('should call synthesize with 7-day period', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await service.synthesizeWeekly('patient-456', 'provider-789');

      expect(result.success).toBe(true);
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-progress-note-synthesizer',
        expect.objectContaining({
          body: expect.objectContaining({
            periodDays: 7,
            noteType: 'routine',
          }),
        })
      );
    });
  });

  describe('synthesizeMonthly', () => {
    it('should call synthesize with 30-day period and comprehensive type', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await service.synthesizeMonthly('patient-456', 'provider-789');

      expect(result.success).toBe(true);
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-progress-note-synthesizer',
        expect.objectContaining({
          body: expect.objectContaining({
            periodDays: 30,
            noteType: 'comprehensive',
          }),
        })
      );
    });
  });

  describe('synthesizeFocused', () => {
    it('should call synthesize with focus areas', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await service.synthesizeFocused(
        'patient-456',
        'provider-789',
        ['blood pressure', 'medication adherence'],
        14
      );

      expect(result.success).toBe(true);
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-progress-note-synthesizer',
        expect.objectContaining({
          body: expect.objectContaining({
            periodDays: 14,
            noteType: 'focused',
            focusAreas: ['blood pressure', 'medication adherence'],
          }),
        })
      );
    });
  });

  describe('saveNote', () => {
    const _mockSavedNote: SavedProgressNote = {
      ...mockProgressNote,
      id: 'db-id-123',
      status: 'pending_review',
      createdAt: '2025-12-23T10:00:00Z',
      updatedAt: '2025-12-23T10:00:00Z',
    };

    it('should save a progress note', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'db-id-123',
                note_id: mockProgressNote.noteId,
                patient_id: mockProgressNote.patientId,
                provider_id: mockProgressNote.providerId,
                period_start: mockProgressNote.periodStart,
                period_end: mockProgressNote.periodEnd,
                note_type: mockProgressNote.noteType,
                vitals_trends: mockProgressNote.vitalsTrends,
                mood_summary: mockProgressNote.moodSummary,
                activity_summary: mockProgressNote.activitySummary,
                concern_flags: mockProgressNote.concernFlags,
                summary: mockProgressNote.summary,
                key_findings: mockProgressNote.keyFindings,
                recommendations: mockProgressNote.recommendations,
                confidence: mockProgressNote.confidence,
                requires_review: mockProgressNote.requiresReview,
                review_reasons: mockProgressNote.reviewReasons,
                data_quality: mockProgressNote.dataQuality,
                status: 'pending_review',
                created_at: '2025-12-23T10:00:00Z',
                updated_at: '2025-12-23T10:00:00Z',
              },
              error: null,
            }),
          }),
        }),
      });

      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await service.saveNote(mockProgressNote);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('pending_review');
        expect(result.data.id).toBe('db-id-123');
      }
    });

    it('should handle save error', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      });

      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await service.saveNote(mockProgressNote);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('PROGRESS_NOTE_SAVE_FAILED');
      }
    });
  });

  describe('approveNote', () => {
    it('should approve a pending review note', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'db-id-123',
                    note_id: 'note-123',
                    patient_id: 'patient-456',
                    provider_id: 'provider-789',
                    status: 'approved',
                    reviewed_by: 'reviewer-001',
                    reviewed_at: '2025-12-23T11:00:00Z',
                    review_notes: 'Looks good',
                    summary: mockProgressNote.summary,
                    vitals_trends: mockProgressNote.vitalsTrends,
                    mood_summary: mockProgressNote.moodSummary,
                    activity_summary: mockProgressNote.activitySummary,
                    concern_flags: mockProgressNote.concernFlags,
                    key_findings: mockProgressNote.keyFindings,
                    recommendations: mockProgressNote.recommendations,
                    confidence: mockProgressNote.confidence,
                    requires_review: true,
                    review_reasons: [],
                    data_quality: 'good',
                    period_start: mockProgressNote.periodStart,
                    period_end: mockProgressNote.periodEnd,
                    note_type: 'routine',
                    created_at: '2025-12-23T10:00:00Z',
                    updated_at: '2025-12-23T11:00:00Z',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await service.approveNote('note-123', 'reviewer-001', 'Looks good');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('approved');
        expect(result.data.reviewedBy).toBe('reviewer-001');
      }
    });

    it('should fail if note not found or not pending', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await service.approveNote('note-123', 'reviewer-001');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('rejectNote', () => {
    it('should reject a note with reason', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'db-id-123',
                    note_id: 'note-123',
                    patient_id: 'patient-456',
                    provider_id: 'provider-789',
                    status: 'rejected',
                    reviewed_by: 'reviewer-001',
                    reviewed_at: '2025-12-23T11:00:00Z',
                    review_notes: 'Missing key information',
                    summary: mockProgressNote.summary,
                    vitals_trends: mockProgressNote.vitalsTrends,
                    mood_summary: mockProgressNote.moodSummary,
                    activity_summary: mockProgressNote.activitySummary,
                    concern_flags: mockProgressNote.concernFlags,
                    key_findings: mockProgressNote.keyFindings,
                    recommendations: mockProgressNote.recommendations,
                    confidence: mockProgressNote.confidence,
                    requires_review: true,
                    review_reasons: [],
                    data_quality: 'good',
                    period_start: mockProgressNote.periodStart,
                    period_end: mockProgressNote.periodEnd,
                    note_type: 'routine',
                    created_at: '2025-12-23T10:00:00Z',
                    updated_at: '2025-12-23T11:00:00Z',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await service.rejectNote(
        'note-123',
        'reviewer-001',
        'Missing key information'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('rejected');
        expect(result.data.reviewNotes).toBe('Missing key information');
      }
    });
  });

  describe('finalizeNote', () => {
    it('should finalize an approved note', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'db-id-123',
                      note_id: 'note-123',
                      patient_id: 'patient-456',
                      provider_id: 'provider-789',
                      status: 'finalized',
                      finalized_at: '2025-12-23T12:00:00Z',
                      summary: mockProgressNote.summary,
                      vitals_trends: mockProgressNote.vitalsTrends,
                      mood_summary: mockProgressNote.moodSummary,
                      activity_summary: mockProgressNote.activitySummary,
                      concern_flags: mockProgressNote.concernFlags,
                      key_findings: mockProgressNote.keyFindings,
                      recommendations: mockProgressNote.recommendations,
                      confidence: mockProgressNote.confidence,
                      requires_review: true,
                      review_reasons: [],
                      data_quality: 'good',
                      period_start: mockProgressNote.periodStart,
                      period_end: mockProgressNote.periodEnd,
                      note_type: 'routine',
                      created_at: '2025-12-23T10:00:00Z',
                      updated_at: '2025-12-23T12:00:00Z',
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await service.finalizeNote('note-123', 'provider-789');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('finalized');
        expect(result.data.finalizedAt).toBeDefined();
      }
    });
  });

  describe('getPatientNotes', () => {
    it('should fetch patient progress notes', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'db-id-123',
                  note_id: 'note-123',
                  patient_id: 'patient-456',
                  provider_id: 'provider-789',
                  status: 'finalized',
                  summary: mockProgressNote.summary,
                  vitals_trends: mockProgressNote.vitalsTrends,
                  mood_summary: mockProgressNote.moodSummary,
                  activity_summary: mockProgressNote.activitySummary,
                  concern_flags: mockProgressNote.concernFlags,
                  key_findings: mockProgressNote.keyFindings,
                  recommendations: mockProgressNote.recommendations,
                  confidence: mockProgressNote.confidence,
                  requires_review: true,
                  review_reasons: [],
                  data_quality: 'good',
                  period_start: mockProgressNote.periodStart,
                  period_end: mockProgressNote.periodEnd,
                  note_type: 'routine',
                  created_at: '2025-12-23T10:00:00Z',
                  updated_at: '2025-12-23T12:00:00Z',
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await service.getPatientNotes('patient-456');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].noteId).toBe('note-123');
      }
    });
  });

  describe('formatForClinicalRecord', () => {
    it('should format progress note for clinical documentation', () => {
      const formatted = service.formatForClinicalRecord(mockProgressNote);

      expect(formatted).toContain('PROGRESS NOTE');
      expect(formatted).toContain('SUBJECTIVE');
      expect(formatted).toContain('OBJECTIVE');
      expect(formatted).toContain('ASSESSMENT');
      expect(formatted).toContain('PLAN');
      expect(formatted).toContain('feeling well');
      expect(formatted).toContain('Heart Rate');
      expect(formatted).toContain('AI-GENERATED - REQUIRES CLINICAL REVIEW');
    });

    it('should include vital signs trends', () => {
      const formatted = service.formatForClinicalRecord(mockProgressNote);

      expect(formatted).toContain('Heart Rate: avg 72.3 bpm');
      expect(formatted).toContain('Blood Pressure (Systolic)');
    });

    it('should include concern flags', () => {
      const formatted = service.formatForClinicalRecord(mockProgressNote);

      expect(formatted).toContain('[LOW]');
      expect(formatted).toContain('Blood pressure slightly elevated');
    });

    it('should include recommendations', () => {
      const formatted = service.formatForClinicalRecord(mockProgressNote);

      expect(formatted).toContain('Continue daily check-ins');
      expect(formatted).toContain('Monitor blood pressure closely');
    });

    it('should include confidence score', () => {
      const formatted = service.formatForClinicalRecord(mockProgressNote);

      expect(formatted).toContain('Confidence: 82%');
    });
  });
});
