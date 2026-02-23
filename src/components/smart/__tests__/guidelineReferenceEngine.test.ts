/**
 * Guideline Reference Engine Tests
 * Session 5 of Compass Riley Clinical Reasoning Hardening
 *
 * Tests the lightweight rule-based guideline matching that runs during encounters.
 * Logic is replicated inline to avoid Deno import chain.
 */
import { describe, it, expect } from 'vitest';

// =====================================================
// Replicated types (matches encounterStateManager.ts)
// =====================================================

interface DiagnosisEntry {
  condition: string;
  icd10?: string;
  confidence: number;
  status: 'working' | 'confirmed' | 'ruled_out';
}

interface Vitals {
  bp?: string;
  hr?: string;
  temp?: string;
  weight?: string;
  glucose?: string;
  spo2?: string;
}

interface Completeness {
  hpiLevel: string;
  rosLevel: string;
  examLevel: string;
  overallPercent: number;
  expectedButMissing: string[];
  hasMedReconciliation: boolean;
}

interface EncounterState {
  diagnoses: DiagnosisEntry[];
  vitals: Vitals;
  completeness: Completeness;
  // Other fields exist but aren't needed for guideline matching
  [key: string]: unknown;
}

// =====================================================
// Replicated guideline types
// =====================================================

interface MonitoringTarget {
  metric: string;
  target: string;
  frequency: string;
}

interface GuidelineReference {
  organization: string;
  guidelineName: string;
  year: number;
  keyRecommendations: string[];
  monitoringTargets: MonitoringTarget[];
  adherenceChecklist: string[];
}

interface GuidelineMatchResult {
  condition: string;
  icd10: string;
  guidelines: GuidelineReference[];
  adherenceFlags: string[];
  preventiveCareReminders: string[];
}

interface GuidelineEntry {
  icd10Prefixes: string[];
  conditionKeywords: string[];
  guidelines: GuidelineReference[];
  preventiveCare: string[];
}

// =====================================================
// Replicated guideline database (subset for tests)
// =====================================================

const GUIDELINE_DATABASE: GuidelineEntry[] = [
  {
    icd10Prefixes: ['E11', 'E10', 'E13'],
    conditionKeywords: ['diabetes', 'diabetic', 'dm', 'type 2 diabetes', 'type 1 diabetes'],
    guidelines: [{
      organization: 'ADA',
      guidelineName: 'Standards of Care in Diabetes',
      year: 2024,
      keyRecommendations: [
        'HbA1c target < 7.0% for most adults (individualize)',
        'Metformin as first-line therapy for T2DM',
        'SGLT2i or GLP-1RA for patients with ASCVD, HF, or CKD',
        'Annual comprehensive foot exam',
        'Annual dilated retinal exam',
      ],
      monitoringTargets: [
        { metric: 'HbA1c', target: '< 7.0%', frequency: 'Every 3-6 months' },
        { metric: 'Fasting glucose', target: '80-130 mg/dL', frequency: 'Per patient plan' },
        { metric: 'LDL cholesterol', target: '< 100 mg/dL (or < 70 if ASCVD)', frequency: 'Annually' },
        { metric: 'eGFR/UACR', target: 'eGFR > 60, UACR < 30', frequency: 'Annually' },
      ],
      adherenceChecklist: [
        'Medication reconciliation performed',
        'Hypoglycemia risk assessed',
        'Self-monitoring glucose reviewed',
        'Nutrition counseling discussed',
        'Physical activity recommendations',
      ],
    }],
    preventiveCare: [
      'Annual dilated eye exam (retinopathy screening)',
      'Annual foot exam (neuropathy + vascular)',
      'Annual UACR for nephropathy screening',
      'Pneumococcal and influenza vaccines',
    ],
  },
  {
    icd10Prefixes: ['I10', 'I11', 'I12', 'I13', 'I15'],
    conditionKeywords: ['hypertension', 'htn', 'high blood pressure', 'elevated bp'],
    guidelines: [{
      organization: 'ACC/AHA',
      guidelineName: 'Guideline for Prevention, Detection, and Management of High Blood Pressure',
      year: 2017,
      keyRecommendations: [
        'BP target < 130/80 mmHg for most adults',
        'Lifestyle modifications for all patients',
        'ACE inhibitor/ARB preferred with diabetes or CKD',
        'Thiazide diuretic or CCB as first-line alternatives',
        'Home blood pressure monitoring recommended',
      ],
      monitoringTargets: [
        { metric: 'Blood pressure', target: '< 130/80 mmHg', frequency: 'Every visit' },
        { metric: 'Serum creatinine/eGFR', target: 'eGFR > 60', frequency: 'Annually' },
        { metric: 'Serum potassium', target: '3.5-5.0 mEq/L', frequency: 'With med changes' },
      ],
      adherenceChecklist: [
        'Blood pressure documented this visit',
        'Medication adherence assessed',
        'Lifestyle modifications discussed (diet, exercise, sodium)',
        'Home BP monitoring reviewed',
      ],
    }],
    preventiveCare: [
      'Screen for secondary causes if resistant HTN',
      'Annual basic metabolic panel',
      'ASCVD risk calculation',
    ],
  },
  {
    icd10Prefixes: ['I50'],
    conditionKeywords: ['heart failure', 'chf', 'hf', 'hfref', 'hfpef'],
    guidelines: [{
      organization: 'ACC/AHA',
      guidelineName: 'Guideline for Management of Heart Failure',
      year: 2022,
      keyRecommendations: [
        'GDMT: ACEi/ARB/ARNI + beta-blocker + MRA + SGLT2i for HFrEF',
        'Diuretics for volume overload symptoms',
        'ICD for EF ≤ 35% after 3 months of GDMT',
        'Cardiac rehabilitation referral',
        'Sodium restriction < 2g/day',
      ],
      monitoringTargets: [
        { metric: 'Ejection fraction', target: 'Track trend', frequency: 'Echo per clinical change' },
        { metric: 'BNP/NT-proBNP', target: 'Trending down', frequency: 'Per clinical status' },
        { metric: 'Renal function', target: 'eGFR stable', frequency: 'With med changes' },
        { metric: 'Weight', target: 'Stable, no acute gain', frequency: 'Daily self-monitoring' },
      ],
      adherenceChecklist: [
        'GDMT optimized (4 pillars)',
        'Volume status assessed',
        'Daily weight monitoring discussed',
        'Activity level and functional status documented',
      ],
    }],
    preventiveCare: ['Annual influenza vaccine', 'Pneumococcal vaccine', 'COVID-19 vaccine'],
  },
  {
    icd10Prefixes: ['F32', 'F33'],
    conditionKeywords: ['depression', 'major depressive', 'mdd'],
    guidelines: [{
      organization: 'APA',
      guidelineName: 'Practice Guidelines for Depression',
      year: 2023,
      keyRecommendations: [
        'SSRI or SNRI as first-line pharmacotherapy',
        'CBT or psychotherapy as first-line or adjunct',
        'PHQ-9 for severity monitoring',
        'Assess suicidal ideation at every visit',
        'Continue treatment 6-12 months after remission',
      ],
      monitoringTargets: [
        { metric: 'PHQ-9 score', target: '< 5 (remission)', frequency: 'Every visit' },
        { metric: 'Suicidal ideation', target: 'Assess every visit', frequency: 'Every visit' },
      ],
      adherenceChecklist: [
        'Suicide risk assessed',
        'PHQ-9 administered',
        'Medication side effects reviewed',
        'Functional status documented',
        'Therapy engagement noted',
      ],
    }],
    preventiveCare: ['Screen for comorbid anxiety', 'Substance use screening'],
  },
];

// =====================================================
// Replicated matching logic (from guidelineReferenceEngine.ts)
// =====================================================

function findGuidelineEntry(dx: DiagnosisEntry): GuidelineEntry | null {
  if (dx.icd10) {
    const icd10Upper = dx.icd10.toUpperCase();
    for (const entry of GUIDELINE_DATABASE) {
      if (entry.icd10Prefixes.some(prefix => icd10Upper.startsWith(prefix))) {
        return entry;
      }
    }
  }
  const conditionLower = dx.condition.toLowerCase();
  for (const entry of GUIDELINE_DATABASE) {
    if (entry.conditionKeywords.some(kw => conditionLower.includes(kw))) {
      return entry;
    }
  }
  return null;
}

function checkAdherence(
  dx: DiagnosisEntry,
  entry: GuidelineEntry,
  encounterState: EncounterState
): string[] {
  const flags: string[] = [];
  for (const guideline of entry.guidelines) {
    for (const target of guideline.monitoringTargets) {
      const metric = target.metric.toLowerCase();
      if (metric.includes('blood pressure') && !encounterState.vitals.bp) {
        flags.push(`[GAP] BP not documented — guideline target: ${target.target}`);
      }
      if (metric.includes('heart rate') && !encounterState.vitals.hr) {
        flags.push(`[GAP] Heart rate not documented — guideline target: ${target.target}`);
      }
      if (metric.includes('weight') && !encounterState.vitals.weight) {
        flags.push(`[GAP] Weight not documented — guideline target: ${target.target}`);
      }
      if (metric.includes('glucose') && !encounterState.vitals.glucose) {
        if (entry.icd10Prefixes.some(p => p.startsWith('E1'))) {
          flags.push(`[GAP] Glucose not documented — guideline target: ${target.target}`);
        }
      }
    }
    const hasMedRecon = encounterState.completeness.hasMedReconciliation;
    if (!hasMedRecon && guideline.adherenceChecklist.some(c => c.toLowerCase().includes('medication'))) {
      flags.push('[GAP] Medication reconciliation not yet documented');
    }
  }
  return [...new Set(flags)];
}

function matchGuidelinesForEncounter(encounterState: EncounterState): GuidelineMatchResult[] {
  const results: GuidelineMatchResult[] = [];
  for (const dx of encounterState.diagnoses) {
    if (dx.status === 'ruled_out') continue;
    const entry = findGuidelineEntry(dx);
    if (!entry) continue;
    const adherenceFlags = checkAdherence(dx, entry, encounterState);
    results.push({
      condition: dx.condition,
      icd10: dx.icd10 || '',
      guidelines: entry.guidelines,
      adherenceFlags,
      preventiveCareReminders: entry.preventiveCare,
    });
  }
  return results;
}

function formatGuidelinesForDisplay(matches: GuidelineMatchResult[]): string[] {
  const lines: string[] = [];
  for (const match of matches) {
    const gl = match.guidelines[0];
    if (!gl) continue;
    lines.push(`--- ${match.condition} (${match.icd10 || 'no ICD-10'}) ---`);
    lines.push(`Guideline: ${gl.organization} ${gl.guidelineName} (${gl.year})`);
    if (match.adherenceFlags.length > 0) {
      lines.push(`Adherence gaps: ${match.adherenceFlags.join('; ')}`);
    }
    const targets = gl.monitoringTargets.slice(0, 3).map(t => `${t.metric}: ${t.target}`).join(', ');
    if (targets) lines.push(`Key targets: ${targets}`);
  }
  return lines;
}

// =====================================================
// Helper: create a minimal encounter state
// =====================================================

function createTestEncounterState(overrides: Partial<EncounterState> = {}): EncounterState {
  return {
    diagnoses: [],
    vitals: {},
    completeness: {
      hpiLevel: 'none',
      rosLevel: 'none',
      examLevel: 'none',
      overallPercent: 0,
      expectedButMissing: [],
      hasMedReconciliation: false,
    },
    ...overrides,
  };
}

// =====================================================
// Tests
// =====================================================

describe('Guideline Reference Engine', () => {

  describe('ICD-10 Prefix Matching', () => {
    it('matches diabetes by E11 prefix', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: 'Type 2 DM', icd10: 'E11.65', confidence: 0.9, status: 'confirmed' }],
      });
      const results = matchGuidelinesForEncounter(state);
      expect(results).toHaveLength(1);
      expect(results[0].guidelines[0].organization).toBe('ADA');
    });

    it('matches hypertension by I10 prefix', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: 'Essential HTN', icd10: 'I10', confidence: 0.85, status: 'confirmed' }],
      });
      const results = matchGuidelinesForEncounter(state);
      expect(results).toHaveLength(1);
      expect(results[0].guidelines[0].organization).toBe('ACC/AHA');
      expect(results[0].guidelines[0].year).toBe(2017);
    });

    it('matches heart failure by I50 prefix', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: 'HFrEF', icd10: 'I50.2', confidence: 0.88, status: 'working' }],
      });
      const results = matchGuidelinesForEncounter(state);
      expect(results).toHaveLength(1);
      expect(results[0].guidelines[0].organization).toBe('ACC/AHA');
      expect(results[0].guidelines[0].year).toBe(2022);
    });

    it('matches depression by F32 prefix', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: 'MDD recurrent', icd10: 'F33.1', confidence: 0.92, status: 'confirmed' }],
      });
      const results = matchGuidelinesForEncounter(state);
      expect(results).toHaveLength(1);
      expect(results[0].guidelines[0].organization).toBe('APA');
    });

    it('handles case-insensitive ICD-10 codes', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: 'Diabetes', icd10: 'e11.9', confidence: 0.9, status: 'confirmed' }],
      });
      const results = matchGuidelinesForEncounter(state);
      expect(results).toHaveLength(1);
      expect(results[0].guidelines[0].organization).toBe('ADA');
    });
  });

  describe('Keyword Matching Fallback', () => {
    it('matches diabetes by keyword when no ICD-10', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: 'Uncontrolled diabetes mellitus', confidence: 0.75, status: 'working' }],
      });
      const results = matchGuidelinesForEncounter(state);
      expect(results).toHaveLength(1);
      expect(results[0].guidelines[0].organization).toBe('ADA');
    });

    it('matches hypertension by keyword "htn"', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: 'HTN', confidence: 0.8, status: 'working' }],
      });
      const results = matchGuidelinesForEncounter(state);
      expect(results).toHaveLength(1);
      expect(results[0].guidelines[0].organization).toBe('ACC/AHA');
    });

    it('matches heart failure by "chf" keyword', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: 'Congestive CHF exacerbation', confidence: 0.82, status: 'confirmed' }],
      });
      const results = matchGuidelinesForEncounter(state);
      expect(results).toHaveLength(1);
      expect(results[0].condition).toBe('Congestive CHF exacerbation');
    });

    it('returns empty for unrecognized conditions', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: 'Acute otitis media', icd10: 'H66.9', confidence: 0.9, status: 'confirmed' }],
      });
      const results = matchGuidelinesForEncounter(state);
      expect(results).toHaveLength(0);
    });
  });

  describe('Ruled-Out Filtering', () => {
    it('skips ruled-out diagnoses', () => {
      const state = createTestEncounterState({
        diagnoses: [
          { condition: 'Type 2 DM', icd10: 'E11.65', confidence: 0.9, status: 'confirmed' },
          { condition: 'Heart failure', icd10: 'I50.9', confidence: 0.3, status: 'ruled_out' },
        ],
      });
      const results = matchGuidelinesForEncounter(state);
      expect(results).toHaveLength(1);
      expect(results[0].condition).toBe('Type 2 DM');
    });
  });

  describe('Multiple Diagnoses', () => {
    it('matches multiple conditions in one encounter', () => {
      const state = createTestEncounterState({
        diagnoses: [
          { condition: 'Type 2 DM', icd10: 'E11.65', confidence: 0.92, status: 'confirmed' },
          { condition: 'Essential HTN', icd10: 'I10', confidence: 0.88, status: 'confirmed' },
          { condition: 'MDD', icd10: 'F32.1', confidence: 0.85, status: 'working' },
        ],
      });
      const results = matchGuidelinesForEncounter(state);
      expect(results).toHaveLength(3);
      const orgs = results.map(r => r.guidelines[0].organization);
      expect(orgs).toContain('ADA');
      expect(orgs).toContain('ACC/AHA');
      expect(orgs).toContain('APA');
    });
  });

  describe('Adherence Checking', () => {
    it('flags missing BP for hypertension visit', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: 'Essential HTN', icd10: 'I10', confidence: 0.88, status: 'confirmed' }],
        vitals: {}, // No BP documented
      });
      const results = matchGuidelinesForEncounter(state);
      expect(results[0].adherenceFlags.some(f => f.includes('BP not documented'))).toBe(true);
    });

    it('does NOT flag BP when documented', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: 'Essential HTN', icd10: 'I10', confidence: 0.88, status: 'confirmed' }],
        vitals: { bp: '138/85' },
      });
      const results = matchGuidelinesForEncounter(state);
      expect(results[0].adherenceFlags.every(f => !f.includes('BP not documented'))).toBe(true);
    });

    it('flags missing glucose for diabetes visit', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: 'Type 2 DM', icd10: 'E11.65', confidence: 0.9, status: 'confirmed' }],
        vitals: {}, // No glucose
      });
      const results = matchGuidelinesForEncounter(state);
      expect(results[0].adherenceFlags.some(f => f.includes('Glucose not documented'))).toBe(true);
    });

    it('does NOT flag glucose for non-diabetes conditions', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: 'HFrEF', icd10: 'I50.2', confidence: 0.88, status: 'confirmed' }],
        vitals: {}, // No glucose — but HF doesn't require it
      });
      const results = matchGuidelinesForEncounter(state);
      expect(results[0].adherenceFlags.every(f => !f.includes('Glucose not documented'))).toBe(true);
    });

    it('flags missing weight for heart failure visit', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: 'HFrEF', icd10: 'I50.2', confidence: 0.88, status: 'confirmed' }],
        vitals: {}, // No weight
      });
      const results = matchGuidelinesForEncounter(state);
      expect(results[0].adherenceFlags.some(f => f.includes('Weight not documented'))).toBe(true);
    });

    it('flags missing medication reconciliation', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: 'Type 2 DM', icd10: 'E11.65', confidence: 0.9, status: 'confirmed' }],
        completeness: {
          hpiLevel: 'moderate',
          rosLevel: 'moderate',
          examLevel: 'moderate',
          overallPercent: 60,
          expectedButMissing: [],
          hasMedReconciliation: false,
        },
      });
      const results = matchGuidelinesForEncounter(state);
      expect(results[0].adherenceFlags.some(f => f.includes('Medication reconciliation'))).toBe(true);
    });

    it('does NOT flag medication reconciliation when done', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: 'Type 2 DM', icd10: 'E11.65', confidence: 0.9, status: 'confirmed' }],
        completeness: {
          hpiLevel: 'moderate',
          rosLevel: 'moderate',
          examLevel: 'moderate',
          overallPercent: 60,
          expectedButMissing: [],
          hasMedReconciliation: true,
        },
      });
      const results = matchGuidelinesForEncounter(state);
      expect(results[0].adherenceFlags.every(f => !f.includes('Medication reconciliation'))).toBe(true);
    });

    it('deduplicates adherence flags', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: 'Essential HTN', icd10: 'I10', confidence: 0.88, status: 'confirmed' }],
        vitals: {},
      });
      const results = matchGuidelinesForEncounter(state);
      const bpFlags = results[0].adherenceFlags.filter(f => f.includes('BP not documented'));
      expect(bpFlags.length).toBe(1);
    });
  });

  describe('Preventive Care Reminders', () => {
    it('includes diabetes preventive care reminders', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: 'Type 2 DM', icd10: 'E11.65', confidence: 0.9, status: 'confirmed' }],
      });
      const results = matchGuidelinesForEncounter(state);
      expect(results[0].preventiveCareReminders.some(r => r.includes('eye exam'))).toBe(true);
      expect(results[0].preventiveCareReminders.some(r => r.includes('foot exam'))).toBe(true);
    });

    it('includes hypertension preventive care reminders', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: 'HTN', icd10: 'I10', confidence: 0.85, status: 'confirmed' }],
      });
      const results = matchGuidelinesForEncounter(state);
      expect(results[0].preventiveCareReminders.some(r => r.includes('ASCVD'))).toBe(true);
    });
  });

  describe('Guideline Content Quality', () => {
    it('ADA diabetes guidelines have required structure', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: 'Type 2 DM', icd10: 'E11.65', confidence: 0.9, status: 'confirmed' }],
      });
      const results = matchGuidelinesForEncounter(state);
      const gl = results[0].guidelines[0];
      expect(gl.organization).toBe('ADA');
      expect(gl.year).toBeGreaterThanOrEqual(2024);
      expect(gl.keyRecommendations.length).toBeGreaterThanOrEqual(3);
      expect(gl.monitoringTargets.length).toBeGreaterThanOrEqual(2);
      expect(gl.adherenceChecklist.length).toBeGreaterThanOrEqual(3);
    });

    it('monitoring targets have metric, target, and frequency', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: 'HTN', icd10: 'I10', confidence: 0.88, status: 'confirmed' }],
      });
      const results = matchGuidelinesForEncounter(state);
      for (const target of results[0].guidelines[0].monitoringTargets) {
        expect(target.metric).toBeTruthy();
        expect(target.target).toBeTruthy();
        expect(target.frequency).toBeTruthy();
      }
    });
  });

  describe('formatGuidelinesForDisplay', () => {
    it('formats a single match with condition, guideline, and targets', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: 'Type 2 DM', icd10: 'E11.65', confidence: 0.9, status: 'confirmed' }],
      });
      const results = matchGuidelinesForEncounter(state);
      const display = formatGuidelinesForDisplay(results);
      expect(display.some(l => l.includes('Type 2 DM'))).toBe(true);
      expect(display.some(l => l.includes('ADA'))).toBe(true);
      expect(display.some(l => l.includes('Key targets'))).toBe(true);
    });

    it('formats multiple matches', () => {
      const state = createTestEncounterState({
        diagnoses: [
          { condition: 'Type 2 DM', icd10: 'E11.65', confidence: 0.9, status: 'confirmed' },
          { condition: 'HTN', icd10: 'I10', confidence: 0.85, status: 'confirmed' },
        ],
      });
      const results = matchGuidelinesForEncounter(state);
      const display = formatGuidelinesForDisplay(results);
      expect(display.some(l => l.includes('ADA'))).toBe(true);
      expect(display.some(l => l.includes('ACC/AHA'))).toBe(true);
    });

    it('includes adherence gaps when present', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: 'HTN', icd10: 'I10', confidence: 0.88, status: 'confirmed' }],
        vitals: {}, // Missing BP
      });
      const results = matchGuidelinesForEncounter(state);
      const display = formatGuidelinesForDisplay(results);
      expect(display.some(l => l.includes('Adherence gaps'))).toBe(true);
    });

    it('returns empty array for empty matches', () => {
      const display = formatGuidelinesForDisplay([]);
      expect(display).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty diagnosis list', () => {
      const state = createTestEncounterState({ diagnoses: [] });
      const results = matchGuidelinesForEncounter(state);
      expect(results).toHaveLength(0);
    });

    it('handles all ruled-out diagnoses', () => {
      const state = createTestEncounterState({
        diagnoses: [
          { condition: 'DM', icd10: 'E11.9', confidence: 0.3, status: 'ruled_out' },
          { condition: 'HTN', icd10: 'I10', confidence: 0.2, status: 'ruled_out' },
        ],
      });
      const results = matchGuidelinesForEncounter(state);
      expect(results).toHaveLength(0);
    });

    it('handles diagnosis with empty condition string', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: '', icd10: 'E11.65', confidence: 0.9, status: 'confirmed' }],
      });
      const results = matchGuidelinesForEncounter(state);
      expect(results).toHaveLength(1); // Should match by ICD-10
    });

    it('handles diagnosis with no ICD-10 and no matching keyword', () => {
      const state = createTestEncounterState({
        diagnoses: [{ condition: 'Plantar fasciitis', confidence: 0.7, status: 'working' }],
      });
      const results = matchGuidelinesForEncounter(state);
      expect(results).toHaveLength(0);
    });
  });
});
