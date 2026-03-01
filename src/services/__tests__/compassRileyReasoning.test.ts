/**
 * Compass Riley V2 — Reasoning Engine Unit Tests
 *
 * Tests all 6 core components + sensitivity boundary tests
 * at conservative/balanced/aggressive threshold edges.
 *
 * Test tiers: Tier 1 (behavior) and Tier 2 (state) — no Tier 5 junk.
 */

import { describe, it, expect } from 'vitest';

// --- Import pure logic functions ---
// These are Deno-runtime modules but contain zero Deno APIs.
// Vitest resolves .ts extension imports via Vite module resolution.
import { resolveMode, isUserOverride } from '../../../supabase/functions/_shared/compass-riley/modeRouter';
import {
  getThresholds,
  resolveSensitivity,
  resolveSensitivityWithThresholds,
} from '../../../supabase/functions/_shared/compass-riley/sensitivityConfig';
import {
  evaluateTriggers,
  computeAggregateConfidence,
} from '../../../supabase/functions/_shared/compass-riley/treeTriggerEngine';
import {
  evaluateBranches,
  scoreBranch,
} from '../../../supabase/functions/_shared/compass-riley/branchEvaluator';
import { getExplainText, getExplainForCode } from '../../../supabase/functions/_shared/compass-riley/minimalExplainLayer';
import { applyOverride, determineOutputZone } from '../../../supabase/functions/_shared/compass-riley/overrideGate';

// --- Type imports for constructing test fixtures ---
import type {
  ConfidenceThresholds,
  ReasonCode,
  ReasoningEncounterInput,
  DiagnosisInput,
  MedicationInput,
} from '../../../supabase/functions/_shared/compass-riley/types';

// =====================================================
// Test Fixtures — Obviously Fake Data per CLAUDE.md
// =====================================================

interface MockOverrides {
  chiefComplaint?: string | null;
  diagnoses?: DiagnosisInput[];
  medications?: MedicationInput[];
  riskLevel?: string;
  problemComplexity?: string;
  overallPercent?: number;
  expectedButMissing?: string[];
  driftDetected?: boolean;
  driftDescription?: string;
  emergencyDetected?: boolean;
  emergencyReason?: string;
  analysisCount?: number;
  transcriptWordCount?: number;
}

/** Minimal valid ReasoningEncounterInput for testing */
function createMockEncounterState(overrides: MockOverrides = {}): ReasoningEncounterInput {
  return {
    chiefComplaint: overrides.chiefComplaint ?? 'Test complaint alpha',
    diagnoses: overrides.diagnoses ?? [],
    medications: overrides.medications ?? [],
    mdmComplexity: {
      riskLevel: overrides.riskLevel ?? 'low',
    },
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

function createDiagnosis(
  condition: string,
  confidence: number,
  supporting: string[] = [],
  refuting: string[] = [],
  status: 'active' | 'ruled_out' | 'working' = 'working'
): DiagnosisInput {
  return { condition, confidence, supportingEvidence: supporting, refutingEvidence: refuting, status };
}

// =====================================================
// 1. Mode Router Tests
// =====================================================

describe('modeRouter', () => {
  it('defaults to auto when no mode provided', () => {
    expect(resolveMode(null)).toBe('auto');
    expect(resolveMode(undefined)).toBe('auto');
    expect(resolveMode('')).toBe('auto');
  });

  it('resolves valid modes correctly', () => {
    expect(resolveMode('auto')).toBe('auto');
    expect(resolveMode('force_chain')).toBe('force_chain');
    expect(resolveMode('force_tree')).toBe('force_tree');
  });

  it('normalizes case and whitespace', () => {
    expect(resolveMode('FORCE_CHAIN')).toBe('force_chain');
    expect(resolveMode('  Force_Tree  ')).toBe('force_tree');
    expect(resolveMode('AUTO')).toBe('auto');
  });

  it('supports shorthand aliases', () => {
    expect(resolveMode('chain')).toBe('force_chain');
    expect(resolveMode('tree')).toBe('force_tree');
    expect(resolveMode('CHAIN')).toBe('force_chain');
  });

  it('falls back to auto for invalid input', () => {
    expect(resolveMode('invalid')).toBe('auto');
    expect(resolveMode('manual')).toBe('auto');
    expect(resolveMode('both')).toBe('auto');
  });

  it('identifies user overrides correctly', () => {
    expect(isUserOverride('auto')).toBe(false);
    expect(isUserOverride('force_chain')).toBe(true);
    expect(isUserOverride('force_tree')).toBe(true);
  });
});

// =====================================================
// 2. Sensitivity Config Tests
// =====================================================

describe('sensitivityConfig', () => {
  it('returns balanced thresholds by default', () => {
    const t = getThresholds('balanced');
    expect(t.chainThreshold).toBe(80);
    expect(t.treeThreshold).toBe(60);
  });

  it('returns conservative thresholds', () => {
    const t = getThresholds('conservative');
    expect(t.chainThreshold).toBe(90);
    expect(t.treeThreshold).toBe(70);
  });

  it('returns aggressive thresholds', () => {
    const t = getThresholds('aggressive');
    expect(t.chainThreshold).toBe(65);
    expect(t.treeThreshold).toBe(50);
  });

  it('resolves sensitivity from tenant settings', () => {
    expect(resolveSensitivity({ tree_sensitivity: 'conservative' })).toBe('conservative');
    expect(resolveSensitivity({ tree_sensitivity: 'balanced' })).toBe('balanced');
    expect(resolveSensitivity({ tree_sensitivity: 'aggressive' })).toBe('aggressive');
  });

  it('defaults to balanced for null/missing settings', () => {
    expect(resolveSensitivity(null)).toBe('balanced');
    expect(resolveSensitivity(undefined)).toBe('balanced');
    expect(resolveSensitivity({})).toBe('balanced');
  });

  it('defaults to balanced for invalid settings values', () => {
    expect(resolveSensitivity({ tree_sensitivity: 'invalid' })).toBe('balanced');
    expect(resolveSensitivity({ tree_sensitivity: 42 })).toBe('balanced');
    expect(resolveSensitivity({ tree_sensitivity: true })).toBe('balanced');
  });

  it('returns both sensitivity and thresholds in convenience method', () => {
    const result = resolveSensitivityWithThresholds({ tree_sensitivity: 'aggressive' });
    expect(result.sensitivity).toBe('aggressive');
    expect(result.thresholds.chainThreshold).toBe(65);
    expect(result.thresholds.treeThreshold).toBe(50);
  });

  // --- Boundary tests per tracker spec ---
  describe('threshold boundaries', () => {
    it('conservative: chain at 90, caution at 70-89, tree at <70', () => {
      const t = getThresholds('conservative');
      expect(t.chainThreshold).toBe(90);
      expect(t.treeThreshold).toBe(70);
      // Caution band is 70..89 (inclusive)
      expect(90).toBeGreaterThanOrEqual(t.chainThreshold); // chain zone
      expect(89).toBeLessThan(t.chainThreshold); // caution zone
      expect(70).toBeGreaterThanOrEqual(t.treeThreshold); // caution zone
      expect(69).toBeLessThan(t.treeThreshold); // tree zone
    });

    it('balanced: chain at 80, caution at 60-79, tree at <60', () => {
      const t = getThresholds('balanced');
      expect(80).toBeGreaterThanOrEqual(t.chainThreshold);
      expect(79).toBeLessThan(t.chainThreshold);
      expect(60).toBeGreaterThanOrEqual(t.treeThreshold);
      expect(59).toBeLessThan(t.treeThreshold);
    });

    it('aggressive: chain at 65, caution at 50-64, tree at <50', () => {
      const t = getThresholds('aggressive');
      expect(65).toBeGreaterThanOrEqual(t.chainThreshold);
      expect(64).toBeLessThan(t.chainThreshold);
      expect(50).toBeGreaterThanOrEqual(t.treeThreshold);
      expect(49).toBeLessThan(t.treeThreshold);
    });
  });
});

// =====================================================
// 3. Tree Trigger Engine Tests
// =====================================================

describe('treeTriggerEngine', () => {
  const balancedThresholds: ConfidenceThresholds = { chainThreshold: 80, treeThreshold: 60 };

  describe('computeAggregateConfidence', () => {
    it('returns 50 when no diagnoses exist', () => {
      const state = createMockEncounterState({ diagnoses: [] });
      expect(computeAggregateConfidence(state)).toBe(50);
    });

    it('converts 0-1 confidence to 0-100 scale', () => {
      const state = createMockEncounterState({
        diagnoses: [createDiagnosis('Test Condition A', 0.85)],
      });
      expect(computeAggregateConfidence(state)).toBe(85);
    });

    it('averages multiple active diagnoses', () => {
      const state = createMockEncounterState({
        diagnoses: [
          createDiagnosis('Condition Alpha', 0.90),
          createDiagnosis('Condition Beta', 0.70),
        ],
      });
      expect(computeAggregateConfidence(state)).toBe(80);
    });

    it('excludes ruled-out diagnoses from calculation', () => {
      const state = createMockEncounterState({
        diagnoses: [
          createDiagnosis('Active Condition', 0.90),
          createDiagnosis('Ruled Out Condition', 0.20, [], [], 'ruled_out'),
        ],
      });
      expect(computeAggregateConfidence(state)).toBe(90);
    });
  });

  describe('anomaly/conflict triggers', () => {
    it('fires CONFLICTING_SIGNALS when working diagnosis has conflicting evidence', () => {
      const state = createMockEncounterState({
        diagnoses: [
          createDiagnosis('Test Pneumonia', 0.6, ['fever', 'cough'], ['clear lungs']),
        ],
      });
      const result = evaluateTriggers(state, balancedThresholds);
      expect(result.escalate).toBe(true);
      expect(result.reasonCodes).toContain('CONFLICTING_SIGNALS');
    });

    it('does not fire for active diagnosis without conflicting evidence', () => {
      const state = createMockEncounterState({
        diagnoses: [
          createDiagnosis('Simple URI', 0.90, ['runny nose', 'sneezing'], []),
        ],
      });
      const result = evaluateTriggers(state, balancedThresholds);
      expect(result.reasonCodes).not.toContain('CONFLICTING_SIGNALS');
    });

    it('fires VERIFICATION_FAILED when drift detected', () => {
      const state = createMockEncounterState({
        diagnoses: [createDiagnosis('Test Condition', 0.85)],
        driftDetected: true,
        driftDescription: 'Topic changed from cardiology to dermatology',
      });
      const result = evaluateTriggers(state, balancedThresholds);
      expect(result.escalate).toBe(true);
      expect(result.reasonCodes).toContain('VERIFICATION_FAILED');
    });
  });

  describe('ambiguity triggers', () => {
    it('fires AMBIGUOUS_REQUIREMENTS when 3+ working diagnoses', () => {
      const state = createMockEncounterState({
        diagnoses: [
          createDiagnosis('Condition Alpha', 0.5),
          createDiagnosis('Condition Beta', 0.4),
          createDiagnosis('Condition Gamma', 0.3),
        ],
      });
      const result = evaluateTriggers(state, balancedThresholds);
      expect(result.escalate).toBe(true);
      expect(result.reasonCodes).toContain('AMBIGUOUS_REQUIREMENTS');
    });

    it('does not fire for 2 working diagnoses', () => {
      const state = createMockEncounterState({
        diagnoses: [
          createDiagnosis('Condition Alpha', 0.85),
          createDiagnosis('Condition Beta', 0.80),
        ],
      });
      const result = evaluateTriggers(state, balancedThresholds);
      expect(result.reasonCodes).not.toContain('AMBIGUOUS_REQUIREMENTS');
    });

    it('fires when assessment made with low completeness', () => {
      const state = createMockEncounterState({
        diagnoses: [createDiagnosis('Premature Assessment', 0.80)],
        overallPercent: 30,
        expectedButMissing: ['ROS', 'exam', 'HPI duration'],
      });
      const result = evaluateTriggers(state, balancedThresholds);
      expect(result.reasonCodes).toContain('AMBIGUOUS_REQUIREMENTS');
      expect(result.triggerDescriptions.some(d => d.includes('30%'))).toBe(true);
    });
  });

  describe('high-stakes triggers', () => {
    it('fires HIGH_BLAST_RADIUS for red flag chief complaints', () => {
      const state = createMockEncounterState({
        chiefComplaint: 'Patient reports chest pain radiating to left arm',
        diagnoses: [createDiagnosis('Test ACS', 0.85)],
      });
      const result = evaluateTriggers(state, balancedThresholds);
      expect(result.escalate).toBe(true);
      expect(result.reasonCodes).toContain('HIGH_BLAST_RADIUS');
    });

    it('fires for emergency detected by safety system', () => {
      const state = createMockEncounterState({
        diagnoses: [createDiagnosis('Test Condition', 0.85)],
        emergencyDetected: true,
        emergencyReason: 'Suicidal ideation expressed',
      });
      const result = evaluateTriggers(state, balancedThresholds);
      expect(result.reasonCodes).toContain('HIGH_BLAST_RADIUS');
    });

    it('fires for high-risk MDM', () => {
      const state = createMockEncounterState({
        diagnoses: [createDiagnosis('Complex Condition', 0.85)],
        riskLevel: 'high',
      });
      const result = evaluateTriggers(state, balancedThresholds);
      expect(result.reasonCodes).toContain('HIGH_BLAST_RADIUS');
    });

    it('fires for 5+ active medications', () => {
      const state = createMockEncounterState({
        diagnoses: [createDiagnosis('Test Polypharmacy', 0.85)],
        medications: [
          { name: 'Med Alpha', action: 'continued' },
          { name: 'Med Beta', action: 'continued' },
          { name: 'Med Gamma', action: 'new' },
          { name: 'Med Delta', action: 'adjusted' },
          { name: 'Med Epsilon', action: 'reviewed' },
        ],
      });
      const result = evaluateTriggers(state, balancedThresholds);
      expect(result.reasonCodes).toContain('HIGH_BLAST_RADIUS');
    });

    it('excludes discontinued meds from count', () => {
      const state = createMockEncounterState({
        diagnoses: [createDiagnosis('Test Condition', 0.85)],
        medications: [
          { name: 'Med Alpha', action: 'continued' },
          { name: 'Med Beta', action: 'continued' },
          { name: 'Med Gamma', action: 'discontinued' },
          { name: 'Med Delta', action: 'discontinued' },
          { name: 'Med Epsilon', action: 'discontinued' },
        ],
      });
      const result = evaluateTriggers(state, balancedThresholds);
      // Only 2 active meds — should NOT trigger
      expect(result.reasonCodes).not.toContain('HIGH_BLAST_RADIUS');
    });

    it('does not fire for routine low-risk case', () => {
      const state = createMockEncounterState({
        chiefComplaint: 'Runny nose for 3 days',
        diagnoses: [createDiagnosis('Test URI', 0.92, ['congestion', 'rhinorrhea'])],
      });
      const result = evaluateTriggers(state, balancedThresholds);
      expect(result.reasonCodes).not.toContain('HIGH_BLAST_RADIUS');
    });
  });

  describe('low-confidence triggers', () => {
    it('fires LOW_CONFIDENCE when aggregate below tree threshold', () => {
      const state = createMockEncounterState({
        diagnoses: [createDiagnosis('Uncertain Condition', 0.45)],
      });
      const result = evaluateTriggers(state, balancedThresholds);
      expect(result.escalate).toBe(true);
      expect(result.reasonCodes).toContain('LOW_CONFIDENCE');
      expect(result.confidenceScore).toBe(45);
    });

    it('fires for sparse transcript data', () => {
      const state = createMockEncounterState({
        diagnoses: [createDiagnosis('Test Condition', 0.85)],
        transcriptWordCount: 15,
        analysisCount: 2,
      });
      const result = evaluateTriggers(state, balancedThresholds);
      expect(result.reasonCodes).toContain('LOW_CONFIDENCE');
    });

    it('does not fire for sparse transcript on first analysis (not enough data yet)', () => {
      const state = createMockEncounterState({
        diagnoses: [createDiagnosis('Test Condition', 0.85)],
        transcriptWordCount: 15,
        analysisCount: 0,
      });
      const result = evaluateTriggers(state, balancedThresholds);
      expect(result.reasonCodes).not.toContain('LOW_CONFIDENCE');
    });
  });

  describe('no triggers (clean case)', () => {
    it('returns escalate=false for high-confidence simple case', () => {
      const state = createMockEncounterState({
        chiefComplaint: 'Seasonal allergies with sneezing',
        diagnoses: [createDiagnosis('Test Allergic Rhinitis', 0.92, ['sneezing', 'rhinorrhea'])],
        overallPercent: 75,
        transcriptWordCount: 200,
      });
      const result = evaluateTriggers(state, balancedThresholds);
      expect(result.escalate).toBe(false);
      expect(result.reasonCodes).toHaveLength(0);
      expect(result.confidenceScore).toBe(92);
    });
  });
});

// =====================================================
// 4. Branch Evaluator Tests
// =====================================================

describe('branchEvaluator', () => {
  it('returns provider review for empty diagnoses', () => {
    const result = evaluateBranches([]);
    expect(result.branches).toHaveLength(0);
    expect(result.convergence).toBeNull();
    expect(result.requiresProviderReview).toBe(true);
  });

  it('evaluates 2 candidates and converges to higher confidence', () => {
    const diagnoses = [
      createDiagnosis('Likely Condition', 0.85, ['evidence-a', 'evidence-b'], []),
      createDiagnosis('Less Likely', 0.40, ['weak-evidence'], ['refuting-a']),
    ];
    const result = evaluateBranches(diagnoses);
    expect(result.branches.length).toBeGreaterThanOrEqual(2);
    expect(result.convergence).not.toBeNull();
    expect(result.convergence?.hypothesis).toBe('Likely Condition');
    expect(result.requiresProviderReview).toBe(false);
  });

  it('caps at 4 branches even with more candidates', () => {
    const diagnoses = [
      createDiagnosis('Cond A', 0.80),
      createDiagnosis('Cond B', 0.70),
      createDiagnosis('Cond C', 0.60),
      createDiagnosis('Cond D', 0.50),
      createDiagnosis('Cond E', 0.40),
      createDiagnosis('Cond F', 0.30),
    ];
    const result = evaluateBranches(diagnoses);
    expect(result.branches.length).toBeLessThanOrEqual(4);
  });

  it('excludes ruled-out diagnoses from branches', () => {
    const diagnoses = [
      createDiagnosis('Active Condition', 0.85, ['strong-evidence'], []),
      createDiagnosis('Ruled Out', 0.90, ['evidence'], [], 'ruled_out'),
    ];
    const result = evaluateBranches(diagnoses);
    expect(result.branches.length).toBe(1);
    expect(result.branches[0].hypothesis).toBe('Active Condition');
  });

  it('flags provider review when scores are too close', () => {
    const diagnoses = [
      createDiagnosis('Condition A', 0.75, ['evidence-a'], []),
      createDiagnosis('Condition B', 0.74, ['evidence-b'], []),
    ];
    const result = evaluateBranches(diagnoses);
    // Scores will be very close — should flag for provider review
    expect(result.requiresProviderReview).toBe(true);
    expect(result.convergence).toBeNull();
  });

  it('marks the winning branch as selected', () => {
    const diagnoses = [
      createDiagnosis('Clear Winner', 0.95, ['strong-a', 'strong-b', 'strong-c'], []),
      createDiagnosis('Unlikely', 0.30, [], ['refuting-evidence']),
    ];
    const result = evaluateBranches(diagnoses);
    expect(result.convergence?.selected).toBe(true);
    const selectedBranches = result.branches.filter(b => b.selected);
    expect(selectedBranches).toHaveLength(1);
  });

  it('clamps depth to max 2', () => {
    const diagnoses = [createDiagnosis('Test', 0.80)];
    const result = evaluateBranches(diagnoses, 5);
    expect(result.depth).toBe(2);
  });

  describe('scoreBranch', () => {
    it('scores high-confidence diagnosis with high safety and low blast radius', () => {
      const dx = createDiagnosis('High Confidence', 0.95, ['a', 'b', 'c', 'd'], []);
      const score = scoreBranch(dx);
      expect(score.safety).toBe(95);
      expect(score.evidence).toBe(100); // 4 * 25 = 100
      expect(score.blastRadius).toBe(5); // (1-0.95)*100
      expect(score.reversibility).toBe(96); // 0.95*80+20
      expect(score.total).toBeGreaterThan(80);
    });

    it('penalizes safety score when refuting evidence exists', () => {
      const dxClean = createDiagnosis('No Refuting', 0.80, ['support'], []);
      const dxRefuted = createDiagnosis('Has Refuting', 0.80, ['support'], ['refute']);
      const scoreClean = scoreBranch(dxClean);
      const scoreRefuted = scoreBranch(dxRefuted);
      expect(scoreRefuted.safety).toBeLessThan(scoreClean.safety);
    });

    it('caps evidence score at 100', () => {
      const dx = createDiagnosis('Lots of Evidence', 0.80,
        ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], []);
      const score = scoreBranch(dx);
      expect(score.evidence).toBe(100);
    });
  });
});

// =====================================================
// 5. Minimal Explain Layer Tests
// =====================================================

describe('minimalExplainLayer', () => {
  it('returns null for empty reason codes', () => {
    expect(getExplainText([])).toBeNull();
  });

  it('returns correct text for each reason code', () => {
    const codes: ReasonCode[] = [
      'HIGH_BLAST_RADIUS',
      'CONFLICTING_SIGNALS',
      'VERIFICATION_FAILED',
      'AMBIGUOUS_REQUIREMENTS',
      'LOW_CONFIDENCE',
    ];
    for (const code of codes) {
      const text = getExplainForCode(code);
      expect(text).toBeTruthy();
      expect(text.length).toBeLessThanOrEqual(65); // Roughly 12 words
    }
  });

  it('prioritizes HIGH_BLAST_RADIUS over other codes', () => {
    const text = getExplainText(['LOW_CONFIDENCE', 'HIGH_BLAST_RADIUS', 'AMBIGUOUS_REQUIREMENTS']);
    expect(text).toContain('High-stakes');
  });

  it('prioritizes CONFLICTING_SIGNALS over ambiguity and low confidence', () => {
    const text = getExplainText(['LOW_CONFIDENCE', 'CONFLICTING_SIGNALS']);
    expect(text).toContain('Signals conflict');
  });

  it('falls through to LOW_CONFIDENCE when it is the only code', () => {
    const text = getExplainText(['LOW_CONFIDENCE']);
    expect(text).toContain('Insufficient confidence');
  });
});

// =====================================================
// 6. Override Gate Tests
// =====================================================

describe('overrideGate', () => {
  const balancedThresholds: ConfidenceThresholds = { chainThreshold: 80, treeThreshold: 60 };

  describe('determineOutputZone', () => {
    it('returns chain for high confidence with no triggers', () => {
      expect(determineOutputZone(90, balancedThresholds, false)).toBe('chain');
    });

    it('returns chain_caution for caution band confidence', () => {
      expect(determineOutputZone(70, balancedThresholds, false)).toBe('chain_caution');
    });

    it('returns tree_escalation for low confidence', () => {
      expect(determineOutputZone(50, balancedThresholds, false)).toBe('tree_escalation');
    });

    it('returns tree_escalation when triggers fire regardless of confidence', () => {
      expect(determineOutputZone(95, balancedThresholds, true)).toBe('tree_escalation');
    });

    // --- Boundary tests at exact thresholds ---
    it('balanced boundary: 80 = chain, 79 = caution', () => {
      expect(determineOutputZone(80, balancedThresholds, false)).toBe('chain');
      expect(determineOutputZone(79, balancedThresholds, false)).toBe('chain_caution');
    });

    it('balanced boundary: 60 = caution, 59 = tree', () => {
      expect(determineOutputZone(60, balancedThresholds, false)).toBe('chain_caution');
      expect(determineOutputZone(59, balancedThresholds, false)).toBe('tree_escalation');
    });

    it('conservative boundary: 90/89 and 70/69', () => {
      const ct: ConfidenceThresholds = { chainThreshold: 90, treeThreshold: 70 };
      expect(determineOutputZone(90, ct, false)).toBe('chain');
      expect(determineOutputZone(89, ct, false)).toBe('chain_caution');
      expect(determineOutputZone(70, ct, false)).toBe('chain_caution');
      expect(determineOutputZone(69, ct, false)).toBe('tree_escalation');
    });

    it('aggressive boundary: 65/64 and 50/49', () => {
      const ct: ConfidenceThresholds = { chainThreshold: 65, treeThreshold: 50 };
      expect(determineOutputZone(65, ct, false)).toBe('chain');
      expect(determineOutputZone(64, ct, false)).toBe('chain_caution');
      expect(determineOutputZone(50, ct, false)).toBe('chain_caution');
      expect(determineOutputZone(49, ct, false)).toBe('tree_escalation');
    });
  });

  describe('applyOverride', () => {
    it('AUTO mode passes through the natural zone', () => {
      const trigger = {
        escalate: false,
        reasonCodes: [] as ReasonCode[],
        confidenceScore: 85,
        triggerDescriptions: [],
      };
      const result = applyOverride('auto', trigger, balancedThresholds);
      expect(result.effectiveMode).toBe('auto');
      expect(result.outputZone).toBe('chain');
      expect(result.warning).toBeNull();
    });

    it('AUTO mode escalates to tree when triggers fire', () => {
      const trigger = {
        escalate: true,
        reasonCodes: ['HIGH_BLAST_RADIUS'] as ReasonCode[],
        confidenceScore: 85,
        triggerDescriptions: ['Red flag: chest pain'],
      };
      const result = applyOverride('auto', trigger, balancedThresholds);
      expect(result.outputZone).toBe('tree_escalation');
    });

    it('FORCE_CHAIN overrides tree escalation with warning', () => {
      const trigger = {
        escalate: true,
        reasonCodes: ['HIGH_BLAST_RADIUS'] as ReasonCode[],
        confidenceScore: 45,
        triggerDescriptions: ['Red flag in chief complaint: chest pain'],
      };
      const result = applyOverride('force_chain', trigger, balancedThresholds);
      expect(result.effectiveMode).toBe('force_chain');
      expect(result.outputZone).toBe('chain');
      expect(result.warning).not.toBeNull();
      expect(result.warning).toContain('Note:');
    });

    it('FORCE_CHAIN produces no warning when system agrees', () => {
      const trigger = {
        escalate: false,
        reasonCodes: [] as ReasonCode[],
        confidenceScore: 90,
        triggerDescriptions: [],
      };
      const result = applyOverride('force_chain', trigger, balancedThresholds);
      expect(result.effectiveMode).toBe('force_chain');
      expect(result.outputZone).toBe('chain');
      expect(result.warning).toBeNull();
    });

    it('FORCE_TREE always returns tree_escalation with no warning', () => {
      const trigger = {
        escalate: false,
        reasonCodes: [] as ReasonCode[],
        confidenceScore: 95,
        triggerDescriptions: [],
      };
      const result = applyOverride('force_tree', trigger, balancedThresholds);
      expect(result.effectiveMode).toBe('force_tree');
      expect(result.outputZone).toBe('tree_escalation');
      expect(result.warning).toBeNull();
    });

    it('truncates long override warnings to ~80 chars', () => {
      const trigger = {
        escalate: true,
        reasonCodes: ['AMBIGUOUS_REQUIREMENTS'] as ReasonCode[],
        confidenceScore: 40,
        triggerDescriptions: [
          'This is a very long trigger description that exceeds sixty characters and should be truncated by the override gate system',
        ],
      };
      const result = applyOverride('force_chain', trigger, balancedThresholds);
      expect(result.warning).not.toBeNull();
      if (result.warning) {
        expect(result.warning.length).toBeLessThanOrEqual(100);
        expect(result.warning).toContain('...');
      }
    });
  });
});

// =====================================================
// 7. Integration: Full Pipeline Scenarios
// =====================================================

describe('full pipeline scenarios', () => {
  it('simple URI → chain output, no triggers', () => {
    const state = createMockEncounterState({
      chiefComplaint: 'Runny nose and sneezing for 3 days',
      diagnoses: [createDiagnosis('Test Allergic Rhinitis', 0.92, ['sneezing', 'rhinorrhea'])],
      overallPercent: 75,
      transcriptWordCount: 200,
    });
    const thresholds = getThresholds('balanced');
    const mode = resolveMode('auto');

    const triggerResult = evaluateTriggers(state, thresholds);
    expect(triggerResult.escalate).toBe(false);

    const overrideResult = applyOverride(mode, triggerResult, thresholds);
    expect(overrideResult.outputZone).toBe('chain');

    const explainText = getExplainText(triggerResult.reasonCodes);
    expect(explainText).toBeNull();
  });

  it('chest pain → tree escalation with HIGH_BLAST_RADIUS', () => {
    const state = createMockEncounterState({
      chiefComplaint: 'Acute chest pain with diaphoresis',
      diagnoses: [
        createDiagnosis('Test ACS', 0.60, ['chest pain', 'diaphoresis'], []),
        createDiagnosis('Test GERD', 0.45, ['postprandial'], ['diaphoresis']),
        createDiagnosis('Test PE', 0.30, [], []),
      ],
      riskLevel: 'high',
      transcriptWordCount: 150,
    });
    const thresholds = getThresholds('balanced');

    const triggerResult = evaluateTriggers(state, thresholds);
    expect(triggerResult.escalate).toBe(true);
    expect(triggerResult.reasonCodes).toContain('HIGH_BLAST_RADIUS');

    const overrideResult = applyOverride('auto', triggerResult, thresholds);
    expect(overrideResult.outputZone).toBe('tree_escalation');

    const branchResult = evaluateBranches(state.diagnoses);
    expect(branchResult.branches.length).toBeGreaterThanOrEqual(2);

    const explainText = getExplainText(triggerResult.reasonCodes);
    expect(explainText).toContain('High-stakes');
  });

  it('user forces chain on complex case → chain + warning', () => {
    const state = createMockEncounterState({
      chiefComplaint: 'Altered mental status in elderly patient',
      diagnoses: [
        createDiagnosis('Test Delirium', 0.50, ['confusion'], []),
        createDiagnosis('Test Stroke', 0.40, ['acute onset'], []),
        createDiagnosis('Test Metabolic', 0.35, [], []),
      ],
      riskLevel: 'high',
    });
    const thresholds = getThresholds('balanced');
    const mode = resolveMode('chain');

    const triggerResult = evaluateTriggers(state, thresholds);
    expect(triggerResult.escalate).toBe(true);

    const overrideResult = applyOverride(mode, triggerResult, thresholds);
    expect(overrideResult.effectiveMode).toBe('force_chain');
    expect(overrideResult.outputZone).toBe('chain');
    expect(overrideResult.warning).not.toBeNull();
  });

  it('conservative sensitivity catches uncertainty that balanced would not', () => {
    const state = createMockEncounterState({
      chiefComplaint: 'Mild cough and fatigue',
      diagnoses: [createDiagnosis('Test Viral Syndrome', 0.72, ['cough', 'fatigue'])],
      overallPercent: 60,
      transcriptWordCount: 120,
    });

    // Balanced: confidence 72 > treeThreshold 60 → no low-confidence trigger
    const balancedResult = evaluateTriggers(state, getThresholds('balanced'));
    expect(balancedResult.reasonCodes).not.toContain('LOW_CONFIDENCE');
    expect(determineOutputZone(72, getThresholds('balanced'), false)).toBe('chain_caution');

    // Conservative: confidence 72 > treeThreshold 70 → still no trigger, but in caution band
    const conservativeResult = evaluateTriggers(state, getThresholds('conservative'));
    expect(conservativeResult.reasonCodes).not.toContain('LOW_CONFIDENCE');
    expect(determineOutputZone(72, getThresholds('conservative'), false)).toBe('chain_caution');

    // At 68: balanced is caution, conservative fires tree
    const lowState = createMockEncounterState({
      chiefComplaint: 'Mild cough',
      diagnoses: [createDiagnosis('Test Condition', 0.68)],
      overallPercent: 60,
      transcriptWordCount: 120,
    });
    const conservativeLow = evaluateTriggers(lowState, getThresholds('conservative'));
    const balancedLow = evaluateTriggers(lowState, getThresholds('balanced'));
    // Conservative: 68 < 70 treeThreshold → LOW_CONFIDENCE fires
    expect(conservativeLow.reasonCodes).toContain('LOW_CONFIDENCE');
    // Balanced: 68 >= 60 treeThreshold → no trigger
    expect(balancedLow.reasonCodes).not.toContain('LOW_CONFIDENCE');
  });
});
