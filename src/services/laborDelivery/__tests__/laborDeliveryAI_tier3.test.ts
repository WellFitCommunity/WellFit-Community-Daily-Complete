/**
 * L&D AI Service Tier 3 Tests
 * Tests: Birth Plan Generation, PPD Risk Calculation,
 *   Contraindication Checking, Patient Education
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
const mockSingle = vi.fn();
const mockLimit = vi.fn(() => ({ single: mockSingle }));
const mockOrder = vi.fn(() => ({ limit: mockLimit }));
const mockEq2 = vi.fn(() => ({ order: mockOrder }));
const mockEq1 = vi.fn(() => ({ eq: mockEq2, order: mockOrder }));
const mockSelect = vi.fn(() => ({ eq: mockEq1 }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(args[0] as string, args[1] as Record<string, unknown>),
    },
    from: () => mockFrom(),
  },
}));

vi.mock('../../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockCalculateHolisticRisk = vi.fn();
vi.mock('../../holisticRiskAssessment', () => ({
  calculateHolisticRiskAssessment: (...args: unknown[]) => mockCalculateHolisticRisk(...args),
}));

import {
  generateBirthPlan,
  calculatePPDRisk,
  checkLDContraindication,
  generateLDPatientEducation,
} from '../laborDeliveryAI_tier3';

describe('laborDeliveryAI_tier3 service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore chain after clearAllMocks resets all mock implementations
    // mockEq1 handles both 1-eq chains (.eq().order()) and 2-eq chains (.eq().eq().order())
    mockLimit.mockReturnValue({ single: mockSingle });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockEq2.mockReturnValue({ order: mockOrder });
    mockEq1.mockReturnValue({ eq: mockEq2, order: mockOrder });
    mockSelect.mockReturnValue({ eq: mockEq1 });
    mockFrom.mockReturnValue({ select: mockSelect });
  });

  // =====================================================
  // generateBirthPlan
  // =====================================================
  describe('generateBirthPlan', () => {
    it('returns a birth plan with all 8 sections on success', async () => {
      mockSingle.mockResolvedValue({
        data: {
          gravida: 2,
          para: 1,
          edd: '2026-06-01',
          risk_level: 'low',
          risk_factors: ['advanced maternal age'],
          blood_type: 'O+',
          gbs_status: 'negative',
        },
        error: null,
      });

      mockInvoke.mockResolvedValue({
        data: {
          sections: {
            labor_environment: { title: 'Labor Environment', content: 'Dim lighting preferred', preferences: ['music', 'dim lights'] },
            pain_management: { title: 'Pain Management', content: 'Epidural preferred', preferences: ['epidural'] },
            delivery_preferences: { title: 'Delivery Preferences', content: 'Vaginal delivery', preferences: [] },
            newborn_care: { title: 'Newborn Care', content: 'Immediate skin-to-skin', preferences: ['skin-to-skin'] },
            feeding_plan: { title: 'Feeding Plan', content: 'Breastfeeding only', preferences: ['breastfeeding'] },
            support_team: { title: 'Support Team', content: 'Partner and doula present', preferences: ['partner', 'doula'] },
            emergency_preferences: { title: 'Emergency Preferences', content: 'Discuss all options', preferences: [] },
            postpartum_wishes: { title: 'Postpartum Wishes', content: 'Room-in with baby', preferences: ['rooming-in'] },
          },
          confidence: 0.92,
        },
        error: null,
      });

      const result = await generateBirthPlan('p1', 'dr1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.patientId).toBe('p1');
        expect(result.data.requiresReview).toBe(true);
        expect(result.data.confidenceScore).toBe(0.92);
        const sectionKeys = Object.keys(result.data.sections);
        expect(sectionKeys).toHaveLength(8);
        expect(result.data.sections.labor_environment.content).toBe('Dim lighting preferred');
        expect(result.data.sections.pain_management.preferences).toContain('epidural');
        expect(result.data.sections.feeding_plan.title).toBe('Feeding Plan');
      }
    });

    it('invokes ai-patient-education with correct params including pregnancy context', async () => {
      mockSingle.mockResolvedValue({
        data: {
          gravida: 1,
          para: 0,
          edd: '2026-08-15',
          risk_level: 'moderate',
          risk_factors: ['gestational hypertension'],
          blood_type: 'B-',
          gbs_status: 'positive',
        },
        error: null,
      });

      mockInvoke.mockResolvedValue({
        data: { sections: {}, confidence: 0.80 },
        error: null,
      });

      await generateBirthPlan('p2', 'dr2');

      expect(mockInvoke).toHaveBeenCalledWith('ai-patient-education', {
        body: expect.objectContaining({
          patientId: 'p2',
          providerId: 'dr2',
          condition: 'pregnancy birth plan labor delivery preferences',
          format: 'structured',
          sections: expect.arrayContaining([
            'labor_environment',
            'pain_management',
            'delivery_preferences',
            'newborn_care',
            'feeding_plan',
            'support_team',
            'emergency_preferences',
            'postpartum_wishes',
          ]),
        }),
      });
    });

    it('returns failure when edge function returns error', async () => {
      mockSingle.mockResolvedValue({ data: null, error: null });

      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'ai-patient-education timeout' },
      });

      const result = await generateBirthPlan('p1', 'dr1');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AI_SERVICE_ERROR');
        expect(result.error.message).toBe('ai-patient-education timeout');
      }
    });
  });

  // =====================================================
  // calculatePPDRisk
  // =====================================================
  describe('calculatePPDRisk', () => {
    it('calculates composite PPD risk score using EPDS + holistic scores', async () => {
      // EPDS score of 15 (positive screen — 15/3 = 5.0 normalized)
      mockSingle.mockResolvedValue({
        data: { epds_score: 15, emotional_status: 'anxious', hours_postpartum: 36 },
        error: null,
      });

      mockCalculateHolisticRisk.mockResolvedValue({
        mental_health_risk: 7.0,
        social_isolation_risk: 6.5,
        engagement_risk: 4.0,
        readmission_risk: 3.2,
        fall_risk: 2.1,
        medication_adherence_risk: 1.8,
      });

      const result = await calculatePPDRisk('p1');

      expect(result.success).toBe(true);
      if (result.success) {
        // epdsNormalized = min(15/3, 10) = 5.0
        // composite = (5.0 * 0.40) + (7.0 * 0.25) + (6.5 * 0.20) + (4.0 * 0.15)
        //           = 2.0 + 1.75 + 1.30 + 0.60 = 5.65 → 'high'
        expect(result.data.compositeScore).toBeCloseTo(5.7, 0);
        expect(result.data.riskLevel).toBe('high');
        expect(result.data.epdsScore).toBe(15);
        expect(result.data.requiresIntervention).toBe(true);
        expect(result.data.contributingFactors).toHaveLength(4);
        expect(result.data.recommendedActions).toContain(
          'Schedule mental health follow-up within 48 hours'
        );
        expect(result.data.recommendedActions).toContain(
          'EPDS positive screen — clinical evaluation required'
        );
        expect(result.data.recommendedActions).toContain(
          'Assess social support network — consider peer support group referral'
        );
      }
    });

    it('uses default EPDS normalized score of 5 when no EPDS data available', async () => {
      mockSingle.mockResolvedValue({ data: null, error: null });

      mockCalculateHolisticRisk.mockResolvedValue({
        mental_health_risk: 2.0,
        social_isolation_risk: 2.0,
        engagement_risk: 2.0,
        readmission_risk: 1.0,
        fall_risk: 1.0,
        medication_adherence_risk: 1.0,
      });

      const result = await calculatePPDRisk('p2');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.epdsScore).toBeNull();
        // epdsNormalized defaults to 5 when no data
        // composite = (5 * 0.40) + (2.0 * 0.25) + (2.0 * 0.20) + (2.0 * 0.15)
        //           = 2.0 + 0.5 + 0.4 + 0.3 = 3.2 → 'low'
        expect(result.data.compositeScore).toBeCloseTo(3.2, 0);
        expect(result.data.riskLevel).toBe('low');
        expect(result.data.requiresIntervention).toBe(false);
        expect(result.data.recommendedActions).toContain('Continue routine postpartum follow-up');
      }
    });

    it('assigns critical risk level when composite score >= 7.5', async () => {
      // EPDS score of 27 (27/3 = 9 normalized)
      mockSingle.mockResolvedValue({
        data: { epds_score: 27, emotional_status: 'severely depressed', hours_postpartum: 72 },
        error: null,
      });

      mockCalculateHolisticRisk.mockResolvedValue({
        mental_health_risk: 9.5,
        social_isolation_risk: 8.0,
        engagement_risk: 7.5,
        readmission_risk: 5.0,
        fall_risk: 3.0,
        medication_adherence_risk: 2.0,
      });

      const result = await calculatePPDRisk('p3');

      expect(result.success).toBe(true);
      if (result.success) {
        // composite = (9 * 0.40) + (9.5 * 0.25) + (8.0 * 0.20) + (7.5 * 0.15)
        //           = 3.6 + 2.375 + 1.6 + 1.125 = 8.7 → 'critical'
        expect(result.data.riskLevel).toBe('critical');
        expect(result.data.recommendedActions).toContain(
          'Urgent psychiatric evaluation — consider safety assessment'
        );
      }
    });

    it('returns failure when holistic risk assessment throws', async () => {
      mockSingle.mockResolvedValue({ data: null, error: null });
      mockCalculateHolisticRisk.mockRejectedValue(new Error('Holistic risk DB failure'));

      const result = await calculatePPDRisk('p1');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AI_SERVICE_ERROR');
        expect(result.error.message).toBe('Holistic risk DB failure');
      }
    });
  });

  // =====================================================
  // checkLDContraindication
  // =====================================================
  describe('checkLDContraindication', () => {
    it('returns contraindication result with findings when issues detected', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          assessment: 'warning',
          findings: [
            {
              type: 'pregnancy_risk',
              severity: 'moderate',
              description: 'Teratogenic risk in first trimester',
              evidence: 'Category D',
              recommendation: 'Use alternative if possible',
            },
          ],
          clinicalSummary: 'Use with caution in obstetric setting',
        },
        error: null,
      });

      const result = await checkLDContraindication('p1', 'dr1', 'Ibuprofen', 'pain_management', '400mg PO');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assessment).toBe('warning');
        expect(result.data.findings).toHaveLength(1);
        expect(result.data.requiresClinicalReview).toBe(true);
        expect(result.data.clinicalSummary).toBe('Use with caution in obstetric setting');
      }
    });

    it('calls ai-contraindication-detector with obstetric context and pregnancy condition', async () => {
      mockInvoke.mockResolvedValue({
        data: { assessment: 'safe', findings: [], clinicalSummary: 'No concerns' },
        error: null,
      });

      await checkLDContraindication('p1', 'dr1', 'Penicillin G', 'gbs_prophylaxis', '5MU IV');

      expect(mockInvoke).toHaveBeenCalledWith('ai-contraindication-detector', {
        body: {
          patientId: 'p1',
          providerId: 'dr1',
          medicationName: 'Penicillin G',
          indication: 'gbs_prophylaxis',
          proposedDosage: '5MU IV',
          context: 'obstetric',
          additionalConditions: ['pregnancy'],
        },
      });
    });

    it('returns safe assessment with requiresClinicalReview false when no findings', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          assessment: 'safe',
          findings: [],
          clinicalSummary: 'No contraindications identified for labor and delivery use',
        },
        error: null,
      });

      const result = await checkLDContraindication('p1', 'dr1', 'Oxytocin');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assessment).toBe('safe');
        expect(result.data.findings).toHaveLength(0);
        expect(result.data.requiresClinicalReview).toBe(false);
      }
    });

    it('uses default indication of labor_and_delivery when not provided', async () => {
      mockInvoke.mockResolvedValue({
        data: { assessment: 'safe', findings: [], clinicalSummary: 'Safe' },
        error: null,
      });

      await checkLDContraindication('p1', 'dr1', 'Magnesium Sulfate');

      expect(mockInvoke).toHaveBeenCalledWith('ai-contraindication-detector', {
        body: expect.objectContaining({
          indication: 'labor_and_delivery',
        }),
      });
    });

    it('returns failure when edge function errors', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Contraindication service unavailable' },
      });

      const result = await checkLDContraindication('p1', 'dr1', 'Unknown Drug');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AI_SERVICE_ERROR');
        expect(result.error.message).toBe('Contraindication service unavailable');
      }
    });
  });

  // =====================================================
  // generateLDPatientEducation
  // =====================================================
  describe('generateLDPatientEducation', () => {
    it('returns structured patient education content on success', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          title: 'Understanding Labor & Delivery Preparation',
          content: 'During labor, you may experience contractions every 3-5 minutes...',
        },
        error: null,
      });

      const result = await generateLDPatientEducation(
        'labor_preparation',
        'pregnancy labor preparation',
        'p1',
        'text'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.topic).toBe('labor_preparation');
        expect(result.data.title).toBe('Understanding Labor & Delivery Preparation');
        expect(result.data.content).toContain('contractions every 3-5 minutes');
        expect(result.data.format).toBe('text');
        expect(result.data.requiresReview).toBe(true);
      }
    });

    it('calls ai-patient-education with correct payload including optional params', async () => {
      mockInvoke.mockResolvedValue({
        data: { title: 'Breastfeeding Guidance', content: 'Latch techniques...' },
        error: null,
      });

      await generateLDPatientEducation('breastfeeding', 'breastfeeding lactation', 'p2', 'structured');

      expect(mockInvoke).toHaveBeenCalledWith('ai-patient-education', {
        body: {
          patientId: 'p2',
          topic: 'breastfeeding',
          condition: 'breastfeeding lactation',
          format: 'structured',
        },
      });
    });

    it('falls back to topic as condition when condition not provided', async () => {
      mockInvoke.mockResolvedValue({
        data: { title: 'Newborn Care', content: 'Safe sleep guidelines...' },
        error: null,
      });

      await generateLDPatientEducation('newborn_care');

      expect(mockInvoke).toHaveBeenCalledWith('ai-patient-education', {
        body: expect.objectContaining({
          topic: 'newborn_care',
          condition: 'newborn_care',
          format: 'text',
        }),
      });
    });

    it('returns failure when edge function returns error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Patient education service timeout' },
      });

      const result = await generateLDPatientEducation('postpartum_warning_signs');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AI_SERVICE_ERROR');
        expect(result.error.message).toBe('Patient education service timeout');
      }
    });

    it('returns failure when edge function returns null data', async () => {
      mockInvoke.mockResolvedValue({ data: null, error: null });

      const result = await generateLDPatientEducation('breastfeeding');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('No education content returned');
      }
    });
  });
});
