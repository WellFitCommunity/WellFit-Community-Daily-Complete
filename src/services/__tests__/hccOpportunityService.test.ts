/**
 * hccOpportunityService Test Suite
 *
 * Tests HCC opportunity detection (expiring, documented, suspected),
 * hierarchy suppression, revenue calculation, stats aggregation,
 * filtering, and dismissal.
 * Deletion Test: All tests fail if service logic is removed.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hccOpportunityService } from '../hccOpportunityService';

// =============================================================================
// MOCKS
// =============================================================================

const tableResults = vi.hoisted(() => new Map<string, { data: unknown; error: unknown }>());

/**
 * Build a fluent/thenable chain mock (same pattern as undercodingDetectionService tests).
 */
function chainBuilder(tableName: string) {
  const currentTable = tableName;

  const getResult = () => {
    return tableResults.get(currentTable) || { data: null, error: null };
  };

  const chain: Record<string, unknown> = {};
  const self = () => chain;

  chain.then = (
    onFulfilled?: ((value: unknown) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null
  ) => {
    const result = getResult();
    return Promise.resolve(result).then(onFulfilled, onRejected);
  };

  chain.select = vi.fn().mockImplementation(self);
  chain.insert = vi.fn().mockImplementation(self);
  chain.update = vi.fn().mockImplementation(self);
  chain.eq = vi.fn().mockImplementation(self);
  chain.neq = vi.fn().mockImplementation(self);
  chain.gte = vi.fn().mockImplementation(self);
  chain.lte = vi.fn().mockImplementation(self);
  chain.in = vi.fn().mockImplementation(self);
  chain.order = vi.fn().mockImplementation(self);
  chain.limit = vi.fn().mockImplementation(self);
  chain.single = vi.fn().mockImplementation(self);

  return chain;
}

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn((tableName: string) => chainBuilder(tableName)),
  },
}));

vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    clinical: vi.fn(),
  },
}));

// =============================================================================
// FIXTURES
// =============================================================================

const MOCK_CATEGORIES = [
  { hcc_code: 'HCC38', description: 'Diabetes with Chronic Complications', coefficient: 0.318 },
  { hcc_code: 'HCC37', description: 'Diabetes with Acute Complications', coefficient: 0.368 },
  { hcc_code: 'HCC85', description: 'Congestive Heart Failure', coefficient: 0.368 },
  { hcc_code: 'HCC111', description: 'COPD', coefficient: 0.335 },
  { hcc_code: 'HCC238', description: 'Specified Heart Arrhythmias', coefficient: 0.273 },
  { hcc_code: 'HCC52', description: 'Dementia without Complication', coefficient: 0.357 },
  { hcc_code: 'HCC78', description: "Parkinson's Disease", coefficient: 0.606 },
];

const MOCK_MAPPINGS = [
  { icd10_code: 'E11.40', hcc_code: 'HCC38' },
  { icd10_code: 'E11.65', hcc_code: 'HCC37' },
  { icd10_code: 'I50.22', hcc_code: 'HCC85' },
  { icd10_code: 'J44.9', hcc_code: 'HCC111' },
  { icd10_code: 'I48.91', hcc_code: 'HCC238' },
  { icd10_code: 'F03.90', hcc_code: 'HCC52' },
  { icd10_code: 'G20', hcc_code: 'HCC78' },
];

const MOCK_HIERARCHIES = [
  { higher_hcc: 'HCC37', suppressed_hcc: 'HCC38' },
];

const currentYear = new Date().getFullYear();

// Current year encounters
const MOCK_CURRENT_ENCOUNTERS = [
  { id: 'enc-curr-1', patient_id: 'pat-1', date_of_service: `${currentYear}-02-10` },
  { id: 'enc-curr-2', patient_id: 'pat-3', date_of_service: `${currentYear}-01-20` },
];

const MOCK_CURRENT_DIAGNOSES = [
  { id: 'dx-curr-1', encounter_id: 'enc-curr-1', code: 'I50.22', description: 'Chronic systolic heart failure' },
  { id: 'dx-curr-2', encounter_id: 'enc-curr-2', code: 'I48.91', description: 'Unspecified atrial fibrillation' },
];

// Medications for suspected HCC detection
const MOCK_MEDICATIONS = [
  { id: 'med-1', user_id: 'pat-4', medication_name: 'Metformin 500mg', generic_name: 'metformin', status: 'active' },
  { id: 'med-2', user_id: 'pat-5', medication_name: 'Donepezil 10mg', generic_name: 'donepezil', status: 'active' },
];

// =============================================================================
// SETUP
// =============================================================================

function setDefaultData() {
  tableResults.clear();

  tableResults.set('hcc_categories', { data: MOCK_CATEGORIES, error: null });
  tableResults.set('icd10_hcc_mappings', { data: MOCK_MAPPINGS, error: null });
  tableResults.set('hcc_hierarchies', { data: MOCK_HIERARCHIES, error: null });
  tableResults.set('encounters', { data: MOCK_CURRENT_ENCOUNTERS, error: null });
  tableResults.set('encounter_diagnoses', { data: MOCK_CURRENT_DIAGNOSES, error: null });
  tableResults.set('medications', { data: MOCK_MEDICATIONS, error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  setDefaultData();
});

// =============================================================================
// TESTS: getHCCOpportunities
// =============================================================================

describe('hccOpportunityService', () => {
  describe('getHCCOpportunities', () => {
    it('returns opportunities with correct structure', async () => {
      const result = await hccOpportunityService.getHCCOpportunities();

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.length).toBeGreaterThan(0);

      const opp = result.data[0];
      expect(opp).toHaveProperty('id');
      expect(opp).toHaveProperty('patient_id');
      expect(opp).toHaveProperty('opportunity_type');
      expect(opp).toHaveProperty('icd10_code');
      expect(opp).toHaveProperty('hcc_code');
      expect(opp).toHaveProperty('hcc_description');
      expect(opp).toHaveProperty('hcc_coefficient');
      expect(opp).toHaveProperty('raf_score_impact');
      expect(opp).toHaveProperty('annual_payment_impact');
      expect(opp).toHaveProperty('confidence');
      expect(opp).toHaveProperty('evidence_source');
      expect(opp).toHaveProperty('status');
    });

    it('detects documented HCCs from current year encounters', async () => {
      const result = await hccOpportunityService.getHCCOpportunities({
        opportunity_type: 'documented_hcc',
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      // Current encounters have I50.22 -> HCC85 and I48.91 -> HCC238
      const hccCodes = result.data.map(o => o.hcc_code);
      expect(hccCodes).toContain('HCC85');
      expect(hccCodes).toContain('HCC238');

      for (const opp of result.data) {
        expect(opp.opportunity_type).toBe('documented_hcc');
        expect(opp.confidence).toBe(1.0);
      }
    });

    it('detects suspected HCCs from medication analysis', async () => {
      const result = await hccOpportunityService.getHCCOpportunities({
        opportunity_type: 'suspected_hcc',
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      // Metformin -> HCC38 (diabetes), Donepezil -> HCC52 (dementia)
      const hccCodes = result.data.map(o => o.hcc_code);
      expect(hccCodes).toContain('HCC38');
      expect(hccCodes).toContain('HCC52');

      for (const opp of result.data) {
        expect(opp.opportunity_type).toBe('suspected_hcc');
        expect(opp.evidence_source).toBe('Medication Analysis');
      }
    });

    it('calculates RAF score impact from HCC coefficient', async () => {
      const result = await hccOpportunityService.getHCCOpportunities({
        opportunity_type: 'documented_hcc',
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      // HCC85 coefficient = 0.368
      const hfOpp = result.data.find(o => o.hcc_code === 'HCC85');
      expect(hfOpp).toBeDefined();
      expect(hfOpp?.raf_score_impact).toBe(0.368);
    });

    it('calculates annual payment impact as coefficient x base rate', async () => {
      const result = await hccOpportunityService.getHCCOpportunities({
        opportunity_type: 'documented_hcc',
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      // HCC85: 0.368 * 11000 = 4048
      const hfOpp = result.data.find(o => o.hcc_code === 'HCC85');
      expect(hfOpp).toBeDefined();
      expect(hfOpp?.annual_payment_impact).toBeCloseTo(0.368 * 11000, 0);
    });

    it('applies hierarchy suppression (higher HCC suppresses lower)', async () => {
      // Set up: both HCC37 (acute DM) and HCC38 (chronic DM) for same patient
      tableResults.set('hcc_hierarchies', { data: MOCK_HIERARCHIES, error: null });

      // Current encounters have both E11.65 (HCC37) and E11.40 (HCC38) for pat-1
      tableResults.set('encounter_diagnoses', {
        data: [
          { id: 'dx-1', encounter_id: 'enc-curr-1', code: 'E11.65', description: 'DM with hyperglycemia' },
          { id: 'dx-2', encounter_id: 'enc-curr-1', code: 'E11.40', description: 'DM with neuropathy' },
        ],
        error: null,
      });

      const result = await hccOpportunityService.getHCCOpportunities({
        opportunity_type: 'documented_hcc',
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      // HCC37 should be present, HCC38 should be suppressed for pat-1
      const pat1Opps = result.data.filter(o => o.patient_id === 'pat-1');
      const hccCodes = pat1Opps.map(o => o.hcc_code);
      expect(hccCodes).toContain('HCC37');
      expect(hccCodes).not.toContain('HCC38');
    });

    it('filters by opportunity type', async () => {
      const result = await hccOpportunityService.getHCCOpportunities({
        opportunity_type: 'suspected_hcc',
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      for (const opp of result.data) {
        expect(opp.opportunity_type).toBe('suspected_hcc');
      }
    });

    it('filters by minimum confidence', async () => {
      const result = await hccOpportunityService.getHCCOpportunities({
        min_confidence: 0.90,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      for (const opp of result.data) {
        expect(opp.confidence).toBeGreaterThanOrEqual(0.90);
      }
    });

    it('filters by search query on ICD-10 code', async () => {
      const result = await hccOpportunityService.getHCCOpportunities({
        search: 'I50',
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      for (const opp of result.data) {
        const matchesSearch =
          opp.icd10_code.includes('I50') ||
          opp.hcc_code.toLowerCase().includes('i50') ||
          (opp.icd10_description ?? '').toLowerCase().includes('i50') ||
          opp.hcc_description.toLowerCase().includes('i50');
        expect(matchesSearch).toBe(true);
      }
    });

    it('sorts results by annual payment impact descending', async () => {
      const result = await hccOpportunityService.getHCCOpportunities();

      expect(result.success).toBe(true);
      if (!result.success) return;

      for (let i = 1; i < result.data.length; i++) {
        expect(result.data[i - 1].annual_payment_impact)
          .toBeGreaterThanOrEqual(result.data[i].annual_payment_impact);
      }
    });

    it('returns empty array when no HCC categories exist', async () => {
      tableResults.set('hcc_categories', { data: [], error: null });

      const result = await hccOpportunityService.getHCCOpportunities();

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toEqual([]);
    });

    it('returns empty array when no HCC mappings exist', async () => {
      tableResults.set('icd10_hcc_mappings', { data: [], error: null });

      const result = await hccOpportunityService.getHCCOpportunities();

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toEqual([]);
    });

    it('returns failure on database error', async () => {
      tableResults.set('hcc_categories', {
        data: null,
        error: { message: 'Connection refused' },
      });

      const result = await hccOpportunityService.getHCCOpportunities();

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.message).toContain('Connection refused');
    });

    it('does not flag suspected HCC if already documented this year', async () => {
      // pat-4 has metformin (suggests HCC38), but also has E11.40 documented
      tableResults.set('encounters', {
        data: [
          { id: 'enc-curr-1', patient_id: 'pat-4', date_of_service: `${currentYear}-02-10` },
        ],
        error: null,
      });
      tableResults.set('encounter_diagnoses', {
        data: [
          { id: 'dx-1', encounter_id: 'enc-curr-1', code: 'E11.40', description: 'DM neuropathy' },
        ],
        error: null,
      });
      tableResults.set('medications', {
        data: [
          { id: 'med-1', user_id: 'pat-4', medication_name: 'Metformin 500mg', generic_name: 'metformin', status: 'active' },
        ],
        error: null,
      });

      const result = await hccOpportunityService.getHCCOpportunities({
        opportunity_type: 'suspected_hcc',
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      // HCC38 should NOT be suspected since E11.40 (HCC38) is already documented
      const pat4Suspects = result.data.filter(
        o => o.patient_id === 'pat-4' && o.hcc_code === 'HCC38'
      );
      expect(pat4Suspects.length).toBe(0);
    });
  });

  // ===========================================================================
  // TESTS: getHCCStats
  // ===========================================================================

  describe('getHCCStats', () => {
    it('aggregates opportunity counts correctly', async () => {
      const result = await hccOpportunityService.getHCCStats();

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.total_opportunities).toBeGreaterThan(0);
      const { expiring_hcc, suspected_hcc, documented_hcc } = result.data.opportunities_by_type;
      expect(expiring_hcc + suspected_hcc + documented_hcc).toBe(result.data.total_opportunities);
    });

    it('calculates total annual impact', async () => {
      const result = await hccOpportunityService.getHCCStats();

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.total_annual_impact).toBeGreaterThan(0);
      expect(typeof result.data.total_annual_impact).toBe('number');
    });

    it('calculates average RAF impact per patient', async () => {
      const result = await hccOpportunityService.getHCCStats();

      expect(result.success).toBe(true);
      if (!result.success) return;

      if (result.data.patients_with_gaps > 0) {
        expect(result.data.avg_raf_impact_per_patient).toBeGreaterThan(0);
      }
    });

    it('counts unique patients with gaps', async () => {
      const result = await hccOpportunityService.getHCCStats();

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.patients_with_gaps).toBeGreaterThan(0);
    });

    it('returns zero stats when no opportunities exist', async () => {
      tableResults.set('hcc_categories', { data: [], error: null });

      const result = await hccOpportunityService.getHCCStats();

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.total_opportunities).toBe(0);
      expect(result.data.total_annual_impact).toBe(0);
      expect(result.data.patients_with_gaps).toBe(0);
    });

    it('returns failure when underlying query fails', async () => {
      tableResults.set('hcc_categories', {
        data: null,
        error: { message: 'DB timeout' },
      });

      const result = await hccOpportunityService.getHCCStats();

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.message).toContain('DB timeout');
    });
  });

  // ===========================================================================
  // TESTS: dismissOpportunity
  // ===========================================================================

  describe('dismissOpportunity', () => {
    it('returns success when opportunity is dismissed', async () => {
      const result = await hccOpportunityService.dismissOpportunity(
        'expiring-pat-1-HCC38',
        'HCC already captured in external system'
      );

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toBe(true);
    });

    it('logs the dismissal via auditLogger', async () => {
      const { auditLogger } = await import('../auditLogger');

      await hccOpportunityService.dismissOpportunity(
        'expiring-pat-1-HCC38',
        'Provider confirmed'
      );

      expect(auditLogger.info).toHaveBeenCalledWith(
        'HCC_OPPORTUNITY_DISMISSED',
        expect.objectContaining({
          opportunityId: 'expiring-pat-1-HCC38',
          reason: 'Provider confirmed',
        })
      );
    });

    it('returns failure on unexpected error', async () => {
      const { auditLogger } = await import('../auditLogger');
      vi.mocked(auditLogger.info).mockRejectedValueOnce(new Error('Audit write failed'));

      const result = await hccOpportunityService.dismissOpportunity('bad-id', 'reason');

      expect(result.success).toBe(false);
    });
  });
});
