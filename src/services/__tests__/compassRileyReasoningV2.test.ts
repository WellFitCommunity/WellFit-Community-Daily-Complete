/**
 * Compass Riley V2 — Session 3: Pipeline Orchestrator + Edge Cases
 *
 * Tests runReasoningPipeline, serializeReasoningForClient, and edge cases
 * (empty transcript, zero diagnoses, contradictory vitals, extreme confidence).
 *
 * Companion file: compassRileyReasoningV2Integration.test.ts (output format,
 * sensitivity boundaries, audit payload, integration smoke tests).
 *
 * Test tiers: Tier 1 (behavior) and Tier 2 (state) — no Tier 5 junk.
 */

import { describe, it, expect } from 'vitest';

// --- Pipeline orchestrator (Session 2) ---
import {
  runReasoningPipeline,
  serializeReasoningForClient,
} from '../../../supabase/functions/_shared/compass-riley/reasoningPipeline';

// --- Types ---
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
// 1. Pipeline Orchestrator (runReasoningPipeline)
// =====================================================

describe('runReasoningPipeline', () => {
  it('returns a complete ReasoningResult with all required fields', () => {
    const state = createEncounter({
      diagnoses: [dx('Test Condition Alpha', 0.85, ['symptom-a'])],
      transcriptWordCount: 200,
    });
    const result = runReasoningPipeline(state, null, 'auto');

    expect(result).toHaveProperty('modeUsed');
    expect(result).toHaveProperty('outputZone');
    expect(result).toHaveProperty('triggerResult');
    expect(result).toHaveProperty('branchResult');
    expect(result).toHaveProperty('explainText');
    expect(result).toHaveProperty('overrideWarning');
    expect(result).toHaveProperty('sensitivity');
    expect(result).toHaveProperty('thresholds');
  });

  it('defaults to balanced sensitivity when tenant settings are null', () => {
    const state = createEncounter({
      diagnoses: [dx('Test Condition', 0.90)],
    });
    const result = runReasoningPipeline(state, null);

    expect(result.sensitivity).toBe('balanced');
    expect(result.thresholds.chainThreshold).toBe(80);
    expect(result.thresholds.treeThreshold).toBe(60);
  });

  it('uses conservative sensitivity from tenant settings', () => {
    const state = createEncounter({
      diagnoses: [dx('Test Condition', 0.90)],
    });
    const result = runReasoningPipeline(state, { tree_sensitivity: 'conservative' });

    expect(result.sensitivity).toBe('conservative');
    expect(result.thresholds.chainThreshold).toBe(90);
    expect(result.thresholds.treeThreshold).toBe(70);
  });

  it('uses aggressive sensitivity from tenant settings', () => {
    const state = createEncounter({
      diagnoses: [dx('Test Condition', 0.70)],
    });
    const result = runReasoningPipeline(state, { tree_sensitivity: 'aggressive' });

    expect(result.sensitivity).toBe('aggressive');
    expect(result.thresholds.chainThreshold).toBe(65);
  });

  it('produces chain output for high-confidence simple case', () => {
    const state = createEncounter({
      chiefComplaint: 'Seasonal sneezing',
      diagnoses: [dx('Test Allergic Rhinitis', 0.92, ['sneezing', 'rhinorrhea'])],
      overallPercent: 75,
      transcriptWordCount: 200,
    });
    const result = runReasoningPipeline(state, null, 'auto');

    expect(result.outputZone).toBe('chain');
    expect(result.branchResult).toBeNull();
    expect(result.explainText).toBeNull();
    expect(result.overrideWarning).toBeNull();
  });

  it('produces tree escalation for complex multi-diagnosis case', () => {
    const state = createEncounter({
      chiefComplaint: 'Chest pain with diaphoresis',
      diagnoses: [
        dx('Test ACS', 0.55, ['chest pain', 'diaphoresis'], []),
        dx('Test GERD', 0.40, ['postprandial'], ['diaphoresis']),
        dx('Test PE', 0.30, [], []),
      ],
      riskLevel: 'high',
      transcriptWordCount: 150,
    });
    const result = runReasoningPipeline(state, null, 'auto');

    expect(result.outputZone).toBe('tree_escalation');
    expect(result.branchResult).not.toBeNull();
    expect(result.branchResult?.branches.length).toBeGreaterThanOrEqual(2);
    expect(result.explainText).not.toBeNull();
  });

  it('honors force_chain mode via shorthand "chain"', () => {
    const state = createEncounter({
      chiefComplaint: 'Complex case with chest pain',
      diagnoses: [
        dx('Test ACS', 0.45, ['chest pain'], []),
        dx('Test PE', 0.35, [], []),
        dx('Test Anxiety', 0.30, [], []),
      ],
      riskLevel: 'high',
    });
    const result = runReasoningPipeline(state, null, 'chain');

    expect(result.modeUsed).toBe('force_chain');
    expect(result.outputZone).toBe('chain');
    expect(result.overrideWarning).not.toBeNull();
    expect(result.branchResult).toBeNull();
  });

  it('honors force_tree mode via shorthand "tree"', () => {
    const state = createEncounter({
      chiefComplaint: 'Simple runny nose',
      diagnoses: [dx('Test URI', 0.95, ['congestion', 'rhinorrhea'])],
      overallPercent: 80,
      transcriptWordCount: 200,
    });
    const result = runReasoningPipeline(state, null, 'tree');

    expect(result.modeUsed).toBe('force_tree');
    expect(result.outputZone).toBe('tree_escalation');
    expect(result.branchResult).not.toBeNull();
    expect(result.overrideWarning).toBeNull();
  });

  it('defaults mode to auto when null/undefined', () => {
    const state = createEncounter({
      diagnoses: [dx('Test Condition', 0.85)],
    });
    const r1 = runReasoningPipeline(state, null, null);
    const r2 = runReasoningPipeline(state, null, undefined);
    const r3 = runReasoningPipeline(state, null);

    expect(r1.modeUsed).toBe('auto');
    expect(r2.modeUsed).toBe('auto');
    expect(r3.modeUsed).toBe('auto');
  });
});

// =====================================================
// 2. serializeReasoningForClient
// =====================================================

describe('serializeReasoningForClient', () => {
  it('strips internal details and includes required UI fields', () => {
    const state = createEncounter({
      diagnoses: [dx('Test Condition', 0.85, ['evidence-a'])],
    });
    const result = runReasoningPipeline(state, null, 'auto');
    const serialized = serializeReasoningForClient(result);

    expect(serialized).toHaveProperty('modeUsed');
    expect(serialized).toHaveProperty('outputZone');
    expect(serialized).toHaveProperty('confidenceScore');
    expect(serialized).toHaveProperty('reasonCodes');
    expect(serialized).toHaveProperty('explainText');
    expect(serialized).toHaveProperty('overrideWarning');
    expect(serialized).toHaveProperty('sensitivity');
    expect(serialized).toHaveProperty('branches');
    expect(serialized).toHaveProperty('convergence');
    expect(serialized).toHaveProperty('requiresProviderReview');
  });

  it('does not expose raw triggerResult or thresholds', () => {
    const state = createEncounter({
      diagnoses: [dx('Test', 0.85)],
    });
    const result = runReasoningPipeline(state, null, 'auto');
    const serialized = serializeReasoningForClient(result);

    expect(serialized).not.toHaveProperty('triggerResult');
    expect(serialized).not.toHaveProperty('thresholds');
    expect(serialized).not.toHaveProperty('branchResult');
  });

  it('serializes branches as null for chain result', () => {
    const state = createEncounter({
      diagnoses: [dx('Test URI', 0.92, ['congestion'])],
      transcriptWordCount: 200,
    });
    const result = runReasoningPipeline(state, null, 'auto');
    const serialized = serializeReasoningForClient(result);

    expect(serialized.branches).toBeNull();
    expect(serialized.convergence).toBeNull();
    expect(serialized.requiresProviderReview).toBe(false);
  });

  it('serializes branches with score/hypothesis for tree result', () => {
    const state = createEncounter({
      chiefComplaint: 'Test chest pain',
      diagnoses: [
        dx('Test ACS', 0.55, ['pain'], []),
        dx('Test GERD', 0.40, ['acid'], ['exercise']),
      ],
      riskLevel: 'high',
    });
    const result = runReasoningPipeline(state, null, 'tree');
    const serialized = serializeReasoningForClient(result);

    expect(Array.isArray(serialized.branches)).toBe(true);
    const branches = serialized.branches as Array<Record<string, unknown>>;
    expect(branches.length).toBeGreaterThanOrEqual(1);
    expect(branches[0]).toHaveProperty('hypothesis');
    expect(branches[0]).toHaveProperty('score');
    expect(branches[0]).toHaveProperty('selected');
    expect(typeof branches[0].score).toBe('number');
  });

  it('confidence score is on 0-100 scale', () => {
    const state = createEncounter({
      diagnoses: [dx('Test', 0.73)],
    });
    const result = runReasoningPipeline(state, null);
    const serialized = serializeReasoningForClient(result);

    expect(serialized.confidenceScore).toBe(73);
  });
});

// =====================================================
// 3. Edge Cases
// =====================================================

describe('edge cases', () => {
  describe('empty/minimal encounter data', () => {
    it('handles zero diagnoses without crashing', () => {
      const state = createEncounter({
        chiefComplaint: 'Test vague complaint',
        diagnoses: [],
        transcriptWordCount: 50,
      });
      const result = runReasoningPipeline(state, null, 'auto');

      expect(result.triggerResult.confidenceScore).toBe(50);
      expect(result.outputZone).toBeDefined();
    });

    it('handles null chief complaint', () => {
      const state = createEncounter({
        chiefComplaint: null,
        diagnoses: [dx('Test Condition', 0.85)],
      });
      const result = runReasoningPipeline(state, null, 'auto');
      expect(result).toBeDefined();
      expect(result.triggerResult.reasonCodes).not.toContain('HIGH_BLAST_RADIUS');
    });

    it('handles sparse transcript on first analysis without penalty', () => {
      const state = createEncounter({
        diagnoses: [dx('Test Condition', 0.85)],
        transcriptWordCount: 5,
        analysisCount: 0,
      });
      const result = runReasoningPipeline(state, null, 'auto');
      expect(result.triggerResult.reasonCodes).not.toContain('LOW_CONFIDENCE');
    });

    it('fires LOW_CONFIDENCE for sparse transcript after multiple analyses', () => {
      const state = createEncounter({
        diagnoses: [dx('Test Condition', 0.85)],
        transcriptWordCount: 10,
        analysisCount: 3,
      });
      const result = runReasoningPipeline(state, null, 'auto');
      expect(result.triggerResult.reasonCodes).toContain('LOW_CONFIDENCE');
    });
  });

  describe('contradictory clinical data', () => {
    it('fires CONFLICTING_SIGNALS for diagnosis with supporting AND refuting evidence', () => {
      const state = createEncounter({
        diagnoses: [
          dx('Test Pneumonia', 0.60, ['fever', 'productive cough'], ['clear lung sounds', 'normal CXR']),
        ],
      });
      const result = runReasoningPipeline(state, null, 'auto');
      expect(result.triggerResult.reasonCodes).toContain('CONFLICTING_SIGNALS');
      expect(result.triggerResult.escalate).toBe(true);
    });

    it('fires VERIFICATION_FAILED when drift detected', () => {
      const state = createEncounter({
        diagnoses: [dx('Test Condition', 0.85)],
        driftDetected: true,
        driftDescription: 'Topic shifted from pulmonary to dermatology',
      });
      const result = runReasoningPipeline(state, null, 'auto');
      expect(result.triggerResult.reasonCodes).toContain('VERIFICATION_FAILED');
    });

    it('fires both CONFLICTING_SIGNALS and HIGH_BLAST_RADIUS for complex emergency', () => {
      const state = createEncounter({
        chiefComplaint: 'Patient with severe chest pain',
        diagnoses: [
          dx('Test MI', 0.50, ['chest pain', 'diaphoresis'], ['normal troponin', 'no ST changes']),
        ],
        riskLevel: 'high',
        emergencyDetected: true,
        emergencyReason: 'Acute chest pain presentation',
      });
      const result = runReasoningPipeline(state, null, 'auto');
      expect(result.triggerResult.reasonCodes).toContain('CONFLICTING_SIGNALS');
      expect(result.triggerResult.reasonCodes).toContain('HIGH_BLAST_RADIUS');
      expect(result.outputZone).toBe('tree_escalation');
    });
  });

  describe('single diagnosis edge cases', () => {
    it('force_tree with single diagnosis produces exactly 1 branch', () => {
      const state = createEncounter({
        diagnoses: [dx('Only Diagnosis Alpha', 0.90, ['evidence-a', 'evidence-b'])],
      });
      const result = runReasoningPipeline(state, null, 'tree');

      expect(result.branchResult).not.toBeNull();
      expect(result.branchResult?.branches).toHaveLength(1);
    });

    it('all-ruled-out diagnoses produce provider review in tree mode', () => {
      const state = createEncounter({
        diagnoses: [
          dx('Ruled Out Alpha', 0.80, ['evidence'], [], 'ruled_out'),
          dx('Ruled Out Beta', 0.70, ['evidence'], [], 'ruled_out'),
        ],
      });
      const result = runReasoningPipeline(state, null, 'tree');

      expect(result.branchResult).not.toBeNull();
      expect(result.branchResult?.branches).toHaveLength(0);
      expect(result.branchResult?.requiresProviderReview).toBe(true);
    });
  });

  describe('extreme confidence values', () => {
    it('handles confidence of 1.0 (100%) correctly', () => {
      const state = createEncounter({
        diagnoses: [dx('Certain Diagnosis', 1.0, ['definitive-test'])],
      });
      const result = runReasoningPipeline(state, null, 'auto');
      expect(result.triggerResult.confidenceScore).toBe(100);
      expect(result.outputZone).toBe('chain');
    });

    it('handles confidence of 0.0 (0%) — triggers LOW_CONFIDENCE', () => {
      const state = createEncounter({
        diagnoses: [dx('Unknown Condition', 0.0, [], [])],
        analysisCount: 1,
      });
      const result = runReasoningPipeline(state, null, 'auto');
      expect(result.triggerResult.confidenceScore).toBe(0);
      expect(result.triggerResult.reasonCodes).toContain('LOW_CONFIDENCE');
      expect(result.outputZone).toBe('tree_escalation');
    });
  });
});
