/**
 * Compass Riley V2 — Session 3: Integration Tests
 *
 * Tests output format verification, sensitivity boundary integration through
 * the full pipeline, reason code audit payload shape, and full encounter
 * integration smoke tests.
 *
 * Companion file: compassRileyReasoningV2.test.ts (pipeline orchestrator + edge cases).
 *
 * Test tiers: Tier 1 (behavior) and Tier 2 (state) — no Tier 5 junk.
 */

import { describe, it, expect } from 'vitest';

import {
  runReasoningPipeline,
  serializeReasoningForClient,
} from '../../../supabase/functions/_shared/compass-riley/reasoningPipeline';

import type {
  ReasoningEncounterInput,
  DiagnosisInput,
} from '../../../supabase/functions/_shared/compass-riley/types';

// =====================================================
// Test Fixtures — Obviously Fake Data per CLAUDE.md
// =====================================================

interface MockOverrides {
  chiefComplaint?: string | null;
  diagnoses?: DiagnosisInput[];
  medications?: Array<{ name: string; action: 'new' | 'adjusted' | 'continued' | 'discontinued' | 'reviewed' }>;
  riskLevel?: string;
  overallPercent?: number;
  expectedButMissing?: string[];
  driftDetected?: boolean;
  driftDescription?: string;
  emergencyDetected?: boolean;
  emergencyReason?: string;
  analysisCount?: number;
  transcriptWordCount?: number;
}

function createEncounter(overrides: MockOverrides = {}): ReasoningEncounterInput {
  return {
    chiefComplaint: overrides.chiefComplaint ?? 'Test complaint alpha',
    diagnoses: overrides.diagnoses ?? [],
    medications: overrides.medications ?? [],
    mdmComplexity: { riskLevel: overrides.riskLevel ?? 'low' },
    completeness: {
      overallPercent: overrides.overallPercent ?? 50,
      expectedButMissing: overrides.expectedButMissing ?? [],
    },
    driftState: {
      driftDetected: overrides.driftDetected ?? false,
      driftDescription: overrides.driftDescription,
    },
    patientSafety: {
      emergencyDetected: overrides.emergencyDetected ?? false,
      emergencyReason: overrides.emergencyReason,
    },
    analysisCount: overrides.analysisCount ?? 1,
    transcriptWordCount: overrides.transcriptWordCount ?? 100,
  };
}

function dx(
  condition: string,
  confidence: number,
  supporting: string[] = [],
  refuting: string[] = [],
  status: 'active' | 'ruled_out' | 'working' = 'working'
): DiagnosisInput {
  return { condition, confidence, supportingEvidence: supporting, refutingEvidence: refuting, status };
}

// =====================================================
// 4. Output Format Verification
// =====================================================

describe('output format verification', () => {
  describe('chain output (concise)', () => {
    it('has no branches, no explain text, no override warning', () => {
      const state = createEncounter({
        diagnoses: [dx('Test Simple URI', 0.92, ['sneezing', 'congestion'])],
        overallPercent: 75,
        transcriptWordCount: 200,
      });
      const result = runReasoningPipeline(state, null, 'auto');

      expect(result.outputZone).toBe('chain');
      expect(result.branchResult).toBeNull();
      expect(result.explainText).toBeNull();
      expect(result.overrideWarning).toBeNull();
      expect(result.triggerResult.reasonCodes).toHaveLength(0);
    });
  });

  describe('chain_caution output (hedge/gap)', () => {
    it('has no branches but shows caution band confidence', () => {
      const state = createEncounter({
        diagnoses: [dx('Test Viral Syndrome', 0.72, ['cough', 'fatigue'])],
        overallPercent: 60,
        transcriptWordCount: 150,
      });
      const result = runReasoningPipeline(state, null, 'auto');

      expect(result.outputZone).toBe('chain_caution');
      expect(result.branchResult).toBeNull();
      expect(result.explainText).toBeNull();
      expect(result.triggerResult.confidenceScore).toBe(72);
    });
  });

  describe('tree escalation output (branching)', () => {
    it('has branches, explain text, and convergence decision', () => {
      const state = createEncounter({
        chiefComplaint: 'Persistent cough with weight loss',
        diagnoses: [
          dx('Test Malignancy', 0.45, ['weight loss', 'persistent cough'], []),
          dx('Test TB', 0.40, ['chronic cough'], []),
          dx('Test GERD', 0.35, ['postprandial'], ['weight loss']),
        ],
        riskLevel: 'high',
      });
      const result = runReasoningPipeline(state, null, 'auto');

      expect(result.outputZone).toBe('tree_escalation');
      expect(result.branchResult).not.toBeNull();
      expect(result.explainText).toBeTruthy();
      if (result.branchResult) {
        for (const branch of result.branchResult.branches) {
          expect(branch).toHaveProperty('hypothesis');
          expect(branch).toHaveProperty('score');
          expect(branch.score.total).toBeGreaterThanOrEqual(0);
          expect(branch.score.total).toBeLessThanOrEqual(100);
        }
      }
    });

    it('explain text is concise (under 65 characters)', () => {
      const state = createEncounter({
        chiefComplaint: 'Acute chest pain',
        diagnoses: [dx('Test ACS', 0.40, ['pain'], [])],
        riskLevel: 'high',
      });
      const result = runReasoningPipeline(state, null, 'auto');

      if (result.explainText) {
        expect(result.explainText.length).toBeLessThanOrEqual(65);
      }
    });
  });

  describe('override warning format', () => {
    it('starts with "Note:" prefix', () => {
      const state = createEncounter({
        chiefComplaint: 'Chest pain radiating',
        diagnoses: [dx('Test ACS', 0.40, ['pain'], [])],
        riskLevel: 'high',
      });
      const result = runReasoningPipeline(state, null, 'chain');

      expect(result.overrideWarning).not.toBeNull();
      expect(result.overrideWarning).toMatch(/^Note:/);
    });

    it('is at most 100 characters', () => {
      const state = createEncounter({
        chiefComplaint: 'Very long presenting complaint with many symptoms',
        diagnoses: [dx('Test Complex', 0.30, [], [])],
        riskLevel: 'high',
        emergencyDetected: true,
        emergencyReason: 'Multiple concerning symptoms',
      });
      const result = runReasoningPipeline(state, null, 'chain');

      if (result.overrideWarning) {
        expect(result.overrideWarning.length).toBeLessThanOrEqual(100);
      }
    });
  });
});

// =====================================================
// 5. Sensitivity Boundary Integration
// =====================================================

describe('sensitivity boundary integration through pipeline', () => {
  describe('conservative thresholds (90/70)', () => {
    const settings = { tree_sensitivity: 'conservative' };

    it('confidence 90 -> chain', () => {
      const state = createEncounter({
        diagnoses: [dx('Test Condition', 0.90, ['evidence'])],
        transcriptWordCount: 200,
      });
      expect(runReasoningPipeline(state, settings, 'auto').outputZone).toBe('chain');
    });

    it('confidence 89 -> chain_caution', () => {
      const state = createEncounter({
        diagnoses: [dx('Test Condition', 0.89, ['evidence'])],
        transcriptWordCount: 200,
      });
      expect(runReasoningPipeline(state, settings, 'auto').outputZone).toBe('chain_caution');
    });

    it('confidence 70 -> chain_caution (at boundary)', () => {
      const state = createEncounter({
        diagnoses: [dx('Test Condition', 0.70, ['evidence'])],
        transcriptWordCount: 200,
      });
      expect(runReasoningPipeline(state, settings, 'auto').outputZone).toBe('chain_caution');
    });

    it('confidence 69 -> tree_escalation', () => {
      const state = createEncounter({
        diagnoses: [dx('Test Condition', 0.69, ['evidence'])],
        transcriptWordCount: 200,
        analysisCount: 1,
      });
      const result = runReasoningPipeline(state, settings, 'auto');
      expect(result.triggerResult.reasonCodes).toContain('LOW_CONFIDENCE');
      expect(result.outputZone).toBe('tree_escalation');
    });
  });

  describe('balanced thresholds (80/60)', () => {
    const settings = { tree_sensitivity: 'balanced' };

    it('confidence 80 -> chain', () => {
      const state = createEncounter({
        diagnoses: [dx('Test Condition', 0.80, ['evidence'])],
        transcriptWordCount: 200,
      });
      expect(runReasoningPipeline(state, settings, 'auto').outputZone).toBe('chain');
    });

    it('confidence 79 -> chain_caution', () => {
      const state = createEncounter({
        diagnoses: [dx('Test Condition', 0.79, ['evidence'])],
        transcriptWordCount: 200,
      });
      expect(runReasoningPipeline(state, settings, 'auto').outputZone).toBe('chain_caution');
    });

    it('confidence 60 -> chain_caution', () => {
      const state = createEncounter({
        diagnoses: [dx('Test Condition', 0.60, ['evidence'])],
        transcriptWordCount: 200,
      });
      expect(runReasoningPipeline(state, settings, 'auto').outputZone).toBe('chain_caution');
    });

    it('confidence 59 -> tree_escalation', () => {
      const state = createEncounter({
        diagnoses: [dx('Test Condition', 0.59, ['evidence'])],
        transcriptWordCount: 200,
        analysisCount: 1,
      });
      const result = runReasoningPipeline(state, settings, 'auto');
      expect(result.triggerResult.reasonCodes).toContain('LOW_CONFIDENCE');
      expect(result.outputZone).toBe('tree_escalation');
    });
  });

  describe('aggressive thresholds (65/50)', () => {
    const settings = { tree_sensitivity: 'aggressive' };

    it('confidence 65 -> chain', () => {
      const state = createEncounter({
        diagnoses: [dx('Test Condition', 0.65, ['evidence'])],
        transcriptWordCount: 200,
      });
      expect(runReasoningPipeline(state, settings, 'auto').outputZone).toBe('chain');
    });

    it('confidence 64 -> chain_caution', () => {
      const state = createEncounter({
        diagnoses: [dx('Test Condition', 0.64, ['evidence'])],
        transcriptWordCount: 200,
      });
      expect(runReasoningPipeline(state, settings, 'auto').outputZone).toBe('chain_caution');
    });

    it('confidence 50 -> chain_caution', () => {
      const state = createEncounter({
        diagnoses: [dx('Test Condition', 0.50, ['evidence'])],
        transcriptWordCount: 200,
      });
      expect(runReasoningPipeline(state, settings, 'auto').outputZone).toBe('chain_caution');
    });

    it('confidence 49 -> tree_escalation', () => {
      const state = createEncounter({
        diagnoses: [dx('Test Condition', 0.49, ['evidence'])],
        transcriptWordCount: 200,
        analysisCount: 1,
      });
      const result = runReasoningPipeline(state, settings, 'auto');
      expect(result.triggerResult.reasonCodes).toContain('LOW_CONFIDENCE');
      expect(result.outputZone).toBe('tree_escalation');
    });
  });

  describe('same encounter, different zones at different sensitivities', () => {
    it('confidence 68 is caution on balanced but tree on conservative', () => {
      const state = createEncounter({
        diagnoses: [dx('Test Condition', 0.68, ['evidence'])],
        transcriptWordCount: 200,
        analysisCount: 1,
      });
      const balanced = runReasoningPipeline(state, { tree_sensitivity: 'balanced' }, 'auto');
      const conservative = runReasoningPipeline(state, { tree_sensitivity: 'conservative' }, 'auto');

      expect(balanced.outputZone).toBe('chain_caution');
      expect(conservative.triggerResult.reasonCodes).toContain('LOW_CONFIDENCE');
      expect(conservative.outputZone).toBe('tree_escalation');
    });

    it('confidence 52 is caution on aggressive but tree on balanced', () => {
      const state = createEncounter({
        diagnoses: [dx('Test Condition', 0.52, ['evidence'])],
        transcriptWordCount: 200,
        analysisCount: 1,
      });
      const aggressive = runReasoningPipeline(state, { tree_sensitivity: 'aggressive' }, 'auto');
      const balanced = runReasoningPipeline(state, { tree_sensitivity: 'balanced' }, 'auto');

      expect(aggressive.outputZone).toBe('chain_caution');
      expect(balanced.triggerResult.reasonCodes).toContain('LOW_CONFIDENCE');
      expect(balanced.outputZone).toBe('tree_escalation');
    });
  });
});

// =====================================================
// 6. Reason Code Audit Payload Shape
// =====================================================

describe('reason code audit payload shape', () => {
  it('all 5 reason codes fire when all triggers activate simultaneously', () => {
    const state = createEncounter({
      chiefComplaint: 'Severe chest pain with syncope',
      diagnoses: [
        dx('Test MI', 0.30, ['chest pain'], ['normal ECG']),
        dx('Test PE', 0.25, ['dyspnea'], ['no DVT history']),
        dx('Test Aortic Dissection', 0.20, ['tearing pain'], []),
      ],
      medications: [
        { name: 'Med Alpha', action: 'continued' },
        { name: 'Med Beta', action: 'continued' },
        { name: 'Med Gamma', action: 'new' },
        { name: 'Med Delta', action: 'adjusted' },
        { name: 'Med Epsilon', action: 'reviewed' },
      ],
      riskLevel: 'high',
      emergencyDetected: true,
      emergencyReason: 'Syncope with chest pain',
      driftDetected: true,
      driftDescription: 'Rapid topic shifts',
      overallPercent: 20,
      expectedButMissing: ['ROS', 'exam', 'HPI duration'],
      transcriptWordCount: 10,
      analysisCount: 3,
    });
    const result = runReasoningPipeline(state, null, 'auto');
    const codes = result.triggerResult.reasonCodes;

    expect(codes).toContain('CONFLICTING_SIGNALS');
    expect(codes).toContain('HIGH_BLAST_RADIUS');
    expect(codes).toContain('AMBIGUOUS_REQUIREMENTS');
    expect(codes).toContain('VERIFICATION_FAILED');
    expect(codes).toContain('LOW_CONFIDENCE');
    expect(codes).toHaveLength(5);
  });

  it('trigger descriptions are non-empty strings', () => {
    const state = createEncounter({
      chiefComplaint: 'Chest pain',
      diagnoses: [dx('Test ACS', 0.40, ['pain'], ['normal ECG'])],
      riskLevel: 'high',
    });
    const result = runReasoningPipeline(state, null, 'auto');

    for (const desc of result.triggerResult.triggerDescriptions) {
      expect(typeof desc).toBe('string');
      expect(desc.length).toBeGreaterThan(0);
    }
  });

  it('serialized result has correct shape for client ReasoningResultSummary', () => {
    const state = createEncounter({
      chiefComplaint: 'Severe headache',
      diagnoses: [
        dx('Test Migraine', 0.60, ['headache'], []),
        dx('Test SAH', 0.30, ['thunderclap onset'], []),
      ],
      riskLevel: 'high',
    });
    const result = runReasoningPipeline(state, null, 'auto');
    const payload = serializeReasoningForClient(result);

    expect(typeof payload.modeUsed).toBe('string');
    expect(typeof payload.outputZone).toBe('string');
    expect(typeof payload.confidenceScore).toBe('number');
    expect(Array.isArray(payload.reasonCodes)).toBe(true);
    expect(typeof payload.sensitivity).toBe('string');
    expect(typeof payload.requiresProviderReview).toBe('boolean');
    expect(payload.explainText === null || typeof payload.explainText === 'string').toBe(true);
    expect(payload.overrideWarning === null || typeof payload.overrideWarning === 'string').toBe(true);
  });
});

// =====================================================
// 7. Integration Smoke Tests (Full Encounter Scenarios)
// =====================================================

describe('integration smoke tests', () => {
  it('rural clinic: straightforward HTN refill -> chain', () => {
    const state = createEncounter({
      chiefComplaint: 'Routine blood pressure check and medication refill',
      diagnoses: [dx('Test Essential HTN', 0.95, ['elevated BP', 'history of HTN'])],
      medications: [
        { name: 'Lisinopril Test', action: 'continued' },
        { name: 'HCTZ Test', action: 'continued' },
      ],
      overallPercent: 80,
      transcriptWordCount: 300,
    });
    const result = runReasoningPipeline(state, { tree_sensitivity: 'aggressive' }, 'auto');

    expect(result.outputZone).toBe('chain');
    expect(result.triggerResult.reasonCodes).toHaveLength(0);
    expect(result.branchResult).toBeNull();
    expect(result.sensitivity).toBe('aggressive');
  });

  it('academic ED: undifferentiated abdominal pain -> tree', () => {
    const state = createEncounter({
      chiefComplaint: 'Acute abdominal pain with nausea and vomiting',
      diagnoses: [
        dx('Test Appendicitis', 0.50, ['RLQ pain', 'anorexia'], ['no rebound']),
        dx('Test Cholecystitis', 0.40, ['RUQ tenderness'], ['no Murphy sign']),
        dx('Test SBO', 0.30, ['vomiting', 'distension'], []),
        dx('Test Gastroenteritis', 0.25, ['nausea'], ['no diarrhea']),
      ],
      riskLevel: 'moderate',
      overallPercent: 45,
      expectedButMissing: ['rectal exam', 'urinalysis'],
      transcriptWordCount: 250,
    });
    const result = runReasoningPipeline(state, { tree_sensitivity: 'conservative' }, 'auto');

    expect(result.outputZone).toBe('tree_escalation');
    expect(result.triggerResult.reasonCodes).toContain('AMBIGUOUS_REQUIREMENTS');
    expect(result.branchResult).not.toBeNull();
    expect(result.branchResult?.branches.length).toBeGreaterThanOrEqual(2);
    expect(result.branchResult?.branches.length).toBeLessThanOrEqual(4);
  });

  it('polypharmacy med reconciliation -> tree via HIGH_BLAST_RADIUS', () => {
    const state = createEncounter({
      chiefComplaint: 'Annual wellness visit medication reconciliation',
      diagnoses: [dx('Test Multiple Chronic Conditions', 0.85, ['chronic care'])],
      medications: [
        { name: 'Metformin Test', action: 'continued' },
        { name: 'Lisinopril Test', action: 'continued' },
        { name: 'Atorvastatin Test', action: 'continued' },
        { name: 'Amlodipine Test', action: 'adjusted' },
        { name: 'Metoprolol Test', action: 'continued' },
        { name: 'Warfarin Test', action: 'reviewed' },
      ],
      overallPercent: 70,
      transcriptWordCount: 400,
    });
    const result = runReasoningPipeline(state, null, 'auto');

    expect(result.triggerResult.reasonCodes).toContain('HIGH_BLAST_RADIUS');
    expect(result.outputZone).toBe('tree_escalation');
  });

  it('user override flow: chain with warning, then tree with branches', () => {
    const state = createEncounter({
      chiefComplaint: 'Altered mental status in elderly patient',
      diagnoses: [
        dx('Test Delirium', 0.50, ['confusion', 'acute onset'], []),
        dx('Test UTI', 0.40, ['confusion in elderly'], []),
        dx('Test Stroke', 0.35, ['unilateral weakness'], ['alert']),
      ],
      riskLevel: 'high',
    });

    const chainResult = runReasoningPipeline(state, null, 'chain');
    expect(chainResult.modeUsed).toBe('force_chain');
    expect(chainResult.outputZone).toBe('chain');
    expect(chainResult.overrideWarning).not.toBeNull();
    expect(chainResult.branchResult).toBeNull();

    const treeResult = runReasoningPipeline(state, null, 'tree');
    expect(treeResult.modeUsed).toBe('force_tree');
    expect(treeResult.outputZone).toBe('tree_escalation');
    expect(treeResult.overrideWarning).toBeNull();
    expect(treeResult.branchResult).not.toBeNull();
    expect(treeResult.branchResult?.branches.length).toBeGreaterThanOrEqual(2);
  });

  it('progressive encounter: starts chain, escalates to tree as complexity grows', () => {
    const phase1 = createEncounter({
      chiefComplaint: 'Cough for 2 days',
      diagnoses: [dx('Test URI', 0.90, ['cough', 'congestion'])],
      overallPercent: 60,
      transcriptWordCount: 100,
    });
    expect(runReasoningPipeline(phase1, null, 'auto').outputZone).toBe('chain');

    const phase2 = createEncounter({
      chiefComplaint: 'Cough for 2 days, now with hemoptysis and weight loss',
      diagnoses: [
        dx('Test URI', 0.40, ['cough'], ['hemoptysis atypical for URI']),
        dx('Test Lung Cancer', 0.35, ['hemoptysis', 'weight loss'], []),
        dx('Test TB', 0.30, ['chronic cough', 'hemoptysis'], []),
      ],
      riskLevel: 'high',
      overallPercent: 45,
      transcriptWordCount: 250,
    });
    const r2 = runReasoningPipeline(phase2, null, 'auto');
    expect(r2.outputZone).toBe('tree_escalation');
    expect(r2.triggerResult.reasonCodes.length).toBeGreaterThan(0);
    expect(r2.branchResult).not.toBeNull();
  });

  it('pediatric weight-based dosing -> HIGH_BLAST_RADIUS via high-risk MDM', () => {
    const state = createEncounter({
      chiefComplaint: 'Pediatric patient weight-based dosing calculation needed',
      diagnoses: [dx('Test Otitis Media', 0.85, ['ear pain', 'fever'])],
      medications: [{ name: 'Amoxicillin Test', action: 'new' }],
      riskLevel: 'high',
      transcriptWordCount: 150,
    });
    const result = runReasoningPipeline(state, null, 'auto');
    expect(result.triggerResult.reasonCodes).toContain('HIGH_BLAST_RADIUS');
  });
});
