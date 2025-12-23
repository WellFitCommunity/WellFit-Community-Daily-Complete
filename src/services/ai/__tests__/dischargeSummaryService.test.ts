/**
 * Discharge Summary AI Service Tests
 *
 * Tests for the AI-powered discharge summary generator service.
 * Includes safety guardrail verification and medication reconciliation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DischargeSummaryService, DischargeSummary } from '../dischargeSummaryService';

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { id: 'summary-123' }, error: null }),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { status: 'approved', summary_json: {} }, error: null }),
        })),
      })),
    })),
  },
}));

import { supabase } from '../../../lib/supabaseClient';

describe('DischargeSummaryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSummary: DischargeSummary = {
    patientName: 'John Doe',
    dateOfBirth: '1960-01-15',
    admissionDate: '2025-12-20T10:00:00Z',
    dischargeDate: '2025-12-23T14:00:00Z',
    lengthOfStay: 3,
    attendingPhysician: 'Dr. Smith',
    dischargeDisposition: 'home',
    chiefComplaint: 'Chest pain',
    admissionDiagnosis: 'Acute coronary syndrome',
    hospitalCourse: 'Patient was admitted with chest pain. Cardiac catheterization performed showing 80% LAD stenosis. Successful PCI with stent placement. Post-procedure course uncomplicated. Patient recovered well and is stable for discharge.',
    dischargeDiagnoses: [
      { code: 'I25.10', display: 'Coronary artery disease', type: 'principal' },
      { code: 'I10', display: 'Essential hypertension', type: 'secondary' },
    ],
    proceduresPerformed: [
      { code: '92928', display: 'PCI with stent placement', date: '2025-12-21', provider: 'Dr. Johnson' },
    ],
    medicationReconciliation: {
      continued: [
        { name: 'Lisinopril', dose: '10mg', route: 'oral', frequency: 'daily', indication: 'Blood pressure control' },
      ],
      new: [
        { name: 'Aspirin', dose: '81mg', route: 'oral', frequency: 'daily', indication: 'Antiplatelet after stent' },
        { name: 'Clopidogrel', dose: '75mg', route: 'oral', frequency: 'daily', indication: 'Dual antiplatelet therapy' },
      ],
      changed: [
        { name: 'Atorvastatin', previousDose: '20mg', newDose: '80mg', reason: 'Intensive lipid therapy post-PCI' },
      ],
      discontinued: [
        { name: 'Ibuprofen', dose: '400mg', route: 'oral', frequency: 'as needed', indication: 'Avoid NSAIDs with antiplatelet therapy' },
      ],
      allergies: ['Penicillin (rash)'],
      interactions: [],
    },
    followUpAppointments: [
      { specialty: 'Cardiology', provider: 'Dr. Johnson', timeframe: '2 weeks', purpose: 'Post-PCI follow-up', urgency: 'routine' },
      { specialty: 'Primary Care', provider: 'Dr. Brown', timeframe: '7 days', purpose: 'Medication check', urgency: 'routine' },
    ],
    pendingTests: ['Lipid panel in 6 weeks'],
    pendingConsults: [],
    patientInstructions: [
      { category: 'medication', instruction: 'Take aspirin and clopidogrel every day without missing doses', importance: 'critical' },
      { category: 'activity', instruction: 'No heavy lifting over 10 pounds for 1 week', importance: 'important' },
    ],
    warningSigns: [
      { sign: 'Chest pain or pressure', action: 'Call 911 immediately', urgency: 'emergency' },
      { sign: 'Bleeding from groin site', action: 'Apply pressure and call doctor', urgency: 'urgent_care' },
    ],
    activityRestrictions: ['No heavy lifting for 1 week', 'May resume normal activities gradually'],
    dietaryInstructions: ['Heart-healthy diet', 'Limit sodium intake'],
    homeHealthOrdered: false,
    dmeOrdered: false,
    readmissionRiskScore: 35,
    readmissionRiskCategory: 'moderate',
    confidence: 0.85,
    requiresReview: true,
    reviewReasons: ['All AI-generated summaries require physician review'],
    disclaimer: 'This discharge summary was generated with AI assistance and requires physician review.',
  };

  describe('generateSummary', () => {
    it('should successfully generate a discharge summary', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: {
          summary: mockSummary,
          metadata: {
            generated_at: new Date().toISOString(),
            model: 'claude-sonnet-4-20250514',
            response_time_ms: 3000,
            encounter_id: 'encounter-123',
            discharge_disposition: 'home',
            context_summary: {
              conditions_count: 5,
              procedures_count: 1,
              medications_count: 8,
              allergies_count: 1,
            },
          },
        },
        error: null,
      });

      const result = await DischargeSummaryService.generateSummary({
        patientId: 'patient-123',
        encounterId: 'encounter-123',
      });

      expect(result.success).toBe(true);
      expect(result.data?.summary.patientName).toBe('John Doe');
      expect(result.data?.summary.hospitalCourse.toLowerCase()).toContain('cardiac catheterization');
    });

    it('should reject empty patient ID', async () => {
      const result = await DischargeSummaryService.generateSummary({
        patientId: '',
        encounterId: 'encounter-123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
      expect(result.error?.message).toContain('Patient ID');
    });

    it('should reject empty encounter ID', async () => {
      const result = await DischargeSummaryService.generateSummary({
        patientId: 'patient-123',
        encounterId: '',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
      expect(result.error?.message).toContain('Encounter ID');
    });

    it('should handle edge function errors', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: null,
        error: { message: 'Service unavailable' },
      });

      const result = await DischargeSummaryService.generateSummary({
        patientId: 'patient-123',
        encounterId: 'encounter-123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DISCHARGE_SUMMARY_GENERATION_FAILED');
    });
  });

  describe('Safety Guardrails', () => {
    it('should always set requiresReview to true', async () => {
      const summaryWithReviewFalse = {
        ...mockSummary,
        requiresReview: false,
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { summary: summaryWithReviewFalse, metadata: {} },
        error: null,
      });

      const result = await DischargeSummaryService.generateSummary({
        patientId: 'patient-123',
        encounterId: 'encounter-123',
      });

      expect(result.data?.summary.requiresReview).toBe(true);
    });

    it('should add review reason for low confidence', async () => {
      const lowConfidenceSummary = {
        ...mockSummary,
        confidence: 0.4,
        reviewReasons: [],
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { summary: lowConfidenceSummary, metadata: {} },
        error: null,
      });

      const result = await DischargeSummaryService.generateSummary({
        patientId: 'patient-123',
        encounterId: 'encounter-123',
      });

      expect(result.data?.summary.reviewReasons).toContain(
        'Senior physician review recommended'
      );
    });

    it('should flag multiple medication changes for pharmacy review', async () => {
      const manyMedChangesSummary = {
        ...mockSummary,
        medicationReconciliation: {
          ...mockSummary.medicationReconciliation,
          new: Array(4).fill(mockSummary.medicationReconciliation.new[0]),
          changed: Array(3).fill(mockSummary.medicationReconciliation.changed[0]),
        },
        reviewReasons: [],
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { summary: manyMedChangesSummary, metadata: {} },
        error: null,
      });

      const result = await DischargeSummaryService.generateSummary({
        patientId: 'patient-123',
        encounterId: 'encounter-123',
      });

      expect(result.data?.summary.reviewReasons.some((r) => r.includes('pharmacist'))).toBe(true);
    });

    it('should prominently flag drug interactions', async () => {
      const summaryWithInteractions = {
        ...mockSummary,
        medicationReconciliation: {
          ...mockSummary.medicationReconciliation,
          interactions: ['Aspirin + Warfarin: Increased bleeding risk'],
        },
        reviewReasons: [],
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { summary: summaryWithInteractions, metadata: {} },
        error: null,
      });

      const result = await DischargeSummaryService.generateSummary({
        patientId: 'patient-123',
        encounterId: 'encounter-123',
      });

      // Should be first in review reasons
      expect(result.data?.summary.reviewReasons[0]).toContain('drug interactions');
    });

    it('should flag high readmission risk', async () => {
      const highRiskSummary = {
        ...mockSummary,
        readmissionRiskScore: 75,
        reviewReasons: [],
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { summary: highRiskSummary, metadata: {} },
        error: null,
      });

      const result = await DischargeSummaryService.generateSummary({
        patientId: 'patient-123',
        encounterId: 'encounter-123',
      });

      expect(result.data?.summary.reviewReasons.some((r) => r.includes('readmission'))).toBe(true);
    });

    it('should ensure warning signs are present', async () => {
      const noWarningSummary = {
        ...mockSummary,
        warningSigns: [],
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { summary: noWarningSummary, metadata: {} },
        error: null,
      });

      const result = await DischargeSummaryService.generateSummary({
        patientId: 'patient-123',
        encounterId: 'encounter-123',
      });

      expect(result.data?.summary.warningSigns.length).toBeGreaterThan(0);
    });

    it('should ensure follow-up appointments are present', async () => {
      const noFollowUpSummary = {
        ...mockSummary,
        followUpAppointments: [],
        reviewReasons: [],
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { summary: noFollowUpSummary, metadata: {} },
        error: null,
      });

      const result = await DischargeSummaryService.generateSummary({
        patientId: 'patient-123',
        encounterId: 'encounter-123',
      });

      expect(result.data?.summary.followUpAppointments.length).toBeGreaterThan(0);
      expect(result.data?.summary.reviewReasons).toContain('Follow-up appointment needs scheduling');
    });

    it('should ensure disclaimer is present', async () => {
      const noDisclaimerSummary = {
        ...mockSummary,
        disclaimer: '',
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { summary: noDisclaimerSummary, metadata: {} },
        error: null,
      });

      const result = await DischargeSummaryService.generateSummary({
        patientId: 'patient-123',
        encounterId: 'encounter-123',
      });

      expect(result.data?.summary.disclaimer.length).toBeGreaterThan(20);
    });
  });

  describe('saveSummary', () => {
    it('should save summary with draft status', async () => {
      const mockFrom = vi.mocked(supabase.from);
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'summary-123' }, error: null }),
        }),
      });

      mockFrom.mockReturnValue({
        insert: mockInsert,
      } as any);

      const result = await DischargeSummaryService.saveSummary(
        'patient-123',
        'encounter-123',
        mockSummary,
        'physician-456'
      );

      expect(result.success).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'draft',
          ai_generated: true,
        })
      );
    });

    it('should reject summary without hospital course', async () => {
      const noHospitalCourseSummary = { ...mockSummary, hospitalCourse: '' };

      const result = await DischargeSummaryService.saveSummary(
        'patient-123',
        'encounter-123',
        noHospitalCourseSummary,
        'physician-456'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('Hospital course');
    });

    it('should reject summary without diagnoses', async () => {
      const noDiagnosesSummary = { ...mockSummary, dischargeDiagnoses: [] };

      const result = await DischargeSummaryService.saveSummary(
        'patient-123',
        'encounter-123',
        noDiagnosesSummary,
        'physician-456'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should reject summary without follow-up appointments', async () => {
      const noFollowUpSummary = { ...mockSummary, followUpAppointments: [] };

      const result = await DischargeSummaryService.saveSummary(
        'patient-123',
        'encounter-123',
        noFollowUpSummary,
        'physician-456'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('approveSummary', () => {
    it('should approve summary successfully', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { summary_json: {} }, error: null }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: {}, error: null }),
          }),
        }),
      } as any);

      const result = await DischargeSummaryService.approveSummary('summary-123', 'physician-456');

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'approved',
        })
      );
    });
  });

  describe('rejectSummary', () => {
    it('should reject summary successfully', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: {}, error: null }),
          }),
        }),
      } as any);

      const result = await DischargeSummaryService.rejectSummary(
        'summary-123',
        'physician-456',
        'Hospital course incomplete'
      );

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'rejected',
          rejection_reason: 'Hospital course incomplete',
        })
      );
    });
  });

  describe('releaseSummary', () => {
    it('should release approved summary', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { status: 'approved' }, error: null }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: {}, error: null }),
          }),
        }),
      } as any);

      const result = await DischargeSummaryService.releaseSummary(
        'summary-123',
        'physician-456',
        ['pcp', 'patient_portal']
      );

      expect(result.success).toBe(true);
      expect(result.data?.releasedTo).toContain('pcp');
      expect(result.data?.releasedTo).toContain('patient_portal');
    });

    it('should reject releasing non-approved summary', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { status: 'draft' }, error: null }),
          }),
        }),
      } as any);

      const result = await DischargeSummaryService.releaseSummary(
        'summary-123',
        'physician-456',
        ['pcp']
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('approved');
    });
  });

  describe('getMedicationSummary', () => {
    it('should calculate medication statistics correctly', () => {
      const stats = DischargeSummaryService.getMedicationSummary(mockSummary.medicationReconciliation);

      expect(stats.continued).toBe(1);
      expect(stats.new).toBe(2);
      expect(stats.changed).toBe(1);
      expect(stats.discontinued).toBe(1);
      expect(stats.totalMedications).toBe(4); // continued + new + changed
      expect(stats.hasInteractions).toBe(false);
    });

    it('should detect drug interactions', () => {
      const reconciliationWithInteractions = {
        ...mockSummary.medicationReconciliation,
        interactions: ['Drug A + Drug B: Interaction'],
      };

      const stats = DischargeSummaryService.getMedicationSummary(reconciliationWithInteractions);

      expect(stats.hasInteractions).toBe(true);
    });
  });

  describe('formatForPrint', () => {
    it('should format summary as plain text', () => {
      const plainText = DischargeSummaryService.formatForPrint(mockSummary);

      expect(plainText).toContain('DISCHARGE SUMMARY');
      expect(plainText).toContain('John Doe');
      expect(plainText).toContain('DIAGNOSES');
      expect(plainText).toContain('HOSPITAL COURSE');
      expect(plainText).toContain('DISCHARGE MEDICATIONS');
      expect(plainText).toContain('CONTINUED:');
      expect(plainText).toContain('NEW:');
      expect(plainText).toContain('CHANGED:');
      expect(plainText).toContain('DISCONTINUED:');
      expect(plainText).toContain('WARNING SIGNS');
    });
  });
});
