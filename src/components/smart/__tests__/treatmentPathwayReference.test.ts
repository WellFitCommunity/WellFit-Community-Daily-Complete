/**
 * Treatment Pathway Reference Tests
 * Session 6 of Compass Riley Clinical Reasoning Hardening
 *
 * Tests the lightweight rule-based treatment pathway engine that provides
 * first-line → third-line treatment steps with evidence levels during encounters.
 * Logic replicated inline to avoid Deno import chain.
 */
import { describe, it, expect } from 'vitest';

// =====================================================
// Replicated types
// =====================================================

type EvidenceLevel = 'A' | 'B' | 'C' | 'D' | 'expert_consensus';

interface DiagnosisEntry {
  condition: string;
  icd10?: string;
  confidence: number;
  status: 'working' | 'confirmed' | 'ruled_out';
}

interface TreatmentStep {
  phase: 'first_line' | 'second_line' | 'third_line' | 'adjunct';
  intervention: string;
  medicationClass?: string;
  examples?: string[];
  evidenceLevel: EvidenceLevel;
  guidelineSource: string;
  contraindications: string[];
  sdohNote?: string;
}

interface TreatmentPathwayRef {
  condition: string;
  treatmentGoal: string;
  steps: TreatmentStep[];
  redFlags: string[];
  lifestyleRecommendations: string[];
}

interface TreatmentPathwayResult {
  condition: string;
  icd10: string;
  pathway: TreatmentPathwayRef;
}

interface PathwayEntry {
  icd10Prefixes: string[];
  conditionKeywords: string[];
  pathway: TreatmentPathwayRef;
}

interface EncounterState {
  diagnoses: DiagnosisEntry[];
  [key: string]: unknown;
}

// =====================================================
// Replicated pathway database (subset for tests)
// =====================================================

const PATHWAY_DATABASE: PathwayEntry[] = [
  {
    icd10Prefixes: ['E11', 'E10', 'E13'],
    conditionKeywords: ['diabetes', 'diabetic', 'dm', 'type 2 diabetes'],
    pathway: {
      condition: 'Type 2 Diabetes Mellitus',
      treatmentGoal: 'HbA1c < 7.0% (individualize based on age, comorbidities, hypoglycemia risk)',
      steps: [
        { phase: 'first_line', intervention: 'Metformin + lifestyle modifications', medicationClass: 'Biguanide', examples: ['Metformin 500mg BID, titrate to 1000mg BID'], evidenceLevel: 'A', guidelineSource: 'ADA Standards of Care 2024', contraindications: ['eGFR < 30 mL/min', 'Acute metabolic acidosis', 'Hepatic impairment'], sdohNote: 'Generic metformin is very low cost ($4/month at many pharmacies)' },
        { phase: 'second_line', intervention: 'Add SGLT2 inhibitor or GLP-1 RA', medicationClass: 'SGLT2i / GLP-1 RA', examples: ['Empagliflozin 10mg daily', 'Semaglutide 0.25mg weekly'], evidenceLevel: 'A', guidelineSource: 'ADA Standards of Care 2024', contraindications: ['SGLT2i: recurrent UTI/DKA risk, eGFR < 20'], sdohNote: 'Brand-name SGLT2i/GLP-1 RA can be expensive' },
        { phase: 'third_line', intervention: 'Add basal insulin or additional oral agent', medicationClass: 'Insulin / DPP-4i / TZD', examples: ['Insulin glargine 10 units at bedtime'], evidenceLevel: 'A', guidelineSource: 'ADA Standards of Care 2024', contraindications: ['TZD: heart failure NYHA III-IV'] },
        { phase: 'adjunct', intervention: 'Statin therapy for cardiovascular risk reduction', medicationClass: 'Statin', examples: ['Atorvastatin 40mg daily'], evidenceLevel: 'A', guidelineSource: 'ADA Standards of Care 2024', contraindications: ['Active liver disease'], sdohNote: 'Generic statins are low-cost' },
      ],
      redFlags: ['DKA symptoms (nausea, vomiting, abdominal pain)', 'Severe hypoglycemia'],
      lifestyleRecommendations: ['150 min/week moderate aerobic activity', 'Medical nutrition therapy', 'Weight loss 5-10% if overweight'],
    },
  },
  {
    icd10Prefixes: ['I10', 'I11', 'I12', 'I13', 'I15'],
    conditionKeywords: ['hypertension', 'htn', 'high blood pressure'],
    pathway: {
      condition: 'Hypertension',
      treatmentGoal: 'BP < 130/80 mmHg for most adults',
      steps: [
        { phase: 'first_line', intervention: 'ACE inhibitor or ARB', medicationClass: 'ACEi / ARB', examples: ['Lisinopril 10mg daily'], evidenceLevel: 'A', guidelineSource: 'ACC/AHA HTN Guideline 2017', contraindications: ['Bilateral renal artery stenosis', 'Pregnancy'], sdohNote: 'Generic ACEi/ARB are low-cost' },
        { phase: 'first_line', intervention: 'Thiazide diuretic or CCB', medicationClass: 'Thiazide / CCB', examples: ['Amlodipine 5mg daily'], evidenceLevel: 'A', guidelineSource: 'ACC/AHA HTN Guideline 2017', contraindications: ['Thiazide: severe hyponatremia, gout'] },
        { phase: 'second_line', intervention: 'Combination therapy', medicationClass: 'Combination', examples: ['Losartan/HCTZ 50/12.5mg'], evidenceLevel: 'A', guidelineSource: 'ACC/AHA HTN Guideline 2017', contraindications: ['Do NOT combine ACEi + ARB'] },
        { phase: 'third_line', intervention: 'Add spironolactone for resistant HTN', medicationClass: 'MRA', examples: ['Spironolactone 25mg daily'], evidenceLevel: 'B', guidelineSource: 'ACC/AHA HTN Guideline 2017', contraindications: ['Hyperkalemia'] },
      ],
      redFlags: ['Hypertensive emergency (BP > 180/120 with end-organ damage)'],
      lifestyleRecommendations: ['DASH diet', 'Regular exercise', 'Limit alcohol', 'Weight loss if overweight'],
    },
  },
  {
    icd10Prefixes: ['I50'],
    conditionKeywords: ['heart failure', 'chf', 'hf', 'hfref', 'hfpef'],
    pathway: {
      condition: 'Heart Failure (HFrEF)',
      treatmentGoal: 'Symptom relief, prevent hospitalization — optimize GDMT (4 pillars)',
      steps: [
        { phase: 'first_line', intervention: 'GDMT Pillar 1: ACEi/ARB/ARNI', medicationClass: 'ARNI / ACEi / ARB', examples: ['Sacubitril/valsartan'], evidenceLevel: 'A', guidelineSource: 'ACC/AHA HF Guideline 2022', contraindications: ['ARNI: ACEi within 36h, angioedema'] },
        { phase: 'first_line', intervention: 'GDMT Pillar 2: Beta-blocker', medicationClass: 'Beta-blocker', examples: ['Carvedilol 3.125mg BID'], evidenceLevel: 'A', guidelineSource: 'ACC/AHA HF Guideline 2022', contraindications: ['Decompensated HF'] },
        { phase: 'first_line', intervention: 'GDMT Pillar 3: MRA', medicationClass: 'MRA', examples: ['Spironolactone 25mg daily'], evidenceLevel: 'A', guidelineSource: 'ACC/AHA HF Guideline 2022', contraindications: ['K+ > 5.0 mEq/L'] },
        { phase: 'first_line', intervention: 'GDMT Pillar 4: SGLT2 inhibitor', medicationClass: 'SGLT2i', examples: ['Dapagliflozin 10mg daily'], evidenceLevel: 'A', guidelineSource: 'ACC/AHA HF Guideline 2022', contraindications: ['Type 1 DM'] },
        { phase: 'adjunct', intervention: 'Loop diuretic for volume overload', medicationClass: 'Loop diuretic', examples: ['Furosemide 20-40mg daily'], evidenceLevel: 'B', guidelineSource: 'ACC/AHA HF Guideline 2022', contraindications: ['Dehydration'] },
      ],
      redFlags: ['Acute decompensation', 'Syncope', 'New arrhythmia'],
      lifestyleRecommendations: ['Sodium restriction < 2g/day', 'Daily weight monitoring', 'Cardiac rehabilitation'],
    },
  },
  {
    icd10Prefixes: ['F32', 'F33'],
    conditionKeywords: ['depression', 'major depressive', 'mdd'],
    pathway: {
      condition: 'Major Depressive Disorder',
      treatmentGoal: 'Remission (PHQ-9 < 5), functional recovery',
      steps: [
        { phase: 'first_line', intervention: 'SSRI or SNRI + psychotherapy', medicationClass: 'SSRI / SNRI', examples: ['Sertraline 50mg daily', 'Escitalopram 10mg daily'], evidenceLevel: 'A', guidelineSource: 'APA Practice Guidelines 2023', contraindications: ['MAOi use within 14 days'], sdohNote: 'Generic SSRIs are very low-cost; CBT may need telehealth' },
        { phase: 'second_line', intervention: 'Switch class or augment with bupropion', medicationClass: 'Bupropion', examples: ['Bupropion XL 150mg daily'], evidenceLevel: 'B', guidelineSource: 'APA Practice Guidelines 2023', contraindications: ['Seizure disorder', 'Eating disorder'] },
        { phase: 'third_line', intervention: 'TMS, esketamine, or ECT for treatment-resistant', medicationClass: 'Neuromodulation', examples: ['Esketamine nasal spray'], evidenceLevel: 'B', guidelineSource: 'APA Practice Guidelines 2023', contraindications: ['Esketamine: aneurysmal vascular disease'], sdohNote: 'Requires frequent clinic visits — transportation barrier' },
      ],
      redFlags: ['Suicidal ideation with plan', 'Psychotic features', 'Catatonia'],
      lifestyleRecommendations: ['Regular exercise', 'Sleep hygiene', 'Social engagement', 'Limit alcohol'],
    },
  },
];

// =====================================================
// Replicated matching logic
// =====================================================

function findPathwayEntry(dx: DiagnosisEntry): PathwayEntry | null {
  if (dx.icd10) {
    const icd10Upper = dx.icd10.toUpperCase();
    for (const entry of PATHWAY_DATABASE) {
      if (entry.icd10Prefixes.some(prefix => icd10Upper.startsWith(prefix))) {
        return entry;
      }
    }
  }
  const conditionLower = dx.condition.toLowerCase();
  for (const entry of PATHWAY_DATABASE) {
    if (entry.conditionKeywords.some(kw => conditionLower.includes(kw))) {
      return entry;
    }
  }
  return null;
}

function matchTreatmentPathways(encounterState: EncounterState): TreatmentPathwayResult[] {
  const results: TreatmentPathwayResult[] = [];
  for (const dx of encounterState.diagnoses) {
    if (dx.status === 'ruled_out') continue;
    const entry = findPathwayEntry(dx);
    if (!entry) continue;
    results.push({
      condition: dx.condition,
      icd10: dx.icd10 || '',
      pathway: entry.pathway,
    });
  }
  return results;
}

function formatTreatmentForDisplay(results: TreatmentPathwayResult[]): string[] {
  const lines: string[] = [];
  for (const result of results) {
    const p = result.pathway;
    lines.push(`=== ${result.condition} (${result.icd10 || 'no ICD-10'}) ===`);
    lines.push(`Goal: ${p.treatmentGoal}`);
    for (const step of p.steps) {
      const evLabel = step.evidenceLevel === 'expert_consensus' ? 'Expert' : `Level ${step.evidenceLevel}`;
      lines.push(`  [${step.phase.replace('_', ' ')}] ${step.intervention} (${evLabel} — ${step.guidelineSource})`);
      if (step.contraindications.length > 0) {
        lines.push(`    CI: ${step.contraindications.slice(0, 2).join('; ')}`);
      }
    }
    if (p.redFlags.length > 0) {
      lines.push(`  Red flags: ${p.redFlags[0]}`);
    }
  }
  return lines;
}

// =====================================================
// Tests
// =====================================================

describe('Treatment Pathway Reference Engine', () => {

  describe('ICD-10 Matching', () => {
    it('matches diabetes by E11 prefix', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'Type 2 DM', icd10: 'E11.65', confidence: 0.92, status: 'confirmed' },
      ] });
      expect(results).toHaveLength(1);
      expect(results[0].pathway.condition).toBe('Type 2 Diabetes Mellitus');
    });

    it('matches hypertension by I10 prefix', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'HTN', icd10: 'I10', confidence: 0.88, status: 'confirmed' },
      ] });
      expect(results).toHaveLength(1);
      expect(results[0].pathway.condition).toBe('Hypertension');
    });

    it('matches heart failure by I50 prefix', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'HFrEF', icd10: 'I50.2', confidence: 0.85, status: 'working' },
      ] });
      expect(results).toHaveLength(1);
      expect(results[0].pathway.condition).toBe('Heart Failure (HFrEF)');
    });

    it('handles case-insensitive ICD-10', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'DM', icd10: 'e11.9', confidence: 0.9, status: 'confirmed' },
      ] });
      expect(results).toHaveLength(1);
    });
  });

  describe('Keyword Matching Fallback', () => {
    it('matches by keyword when no ICD-10', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'Uncontrolled diabetes', confidence: 0.75, status: 'working' },
      ] });
      expect(results).toHaveLength(1);
      expect(results[0].pathway.condition).toBe('Type 2 Diabetes Mellitus');
    });

    it('matches depression by keyword', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'Major depressive disorder', confidence: 0.88, status: 'confirmed' },
      ] });
      expect(results).toHaveLength(1);
      expect(results[0].pathway.condition).toBe('Major Depressive Disorder');
    });

    it('returns empty for unrecognized condition', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'Plantar fasciitis', icd10: 'M72.2', confidence: 0.9, status: 'confirmed' },
      ] });
      expect(results).toHaveLength(0);
    });
  });

  describe('Ruled-Out Filtering', () => {
    it('skips ruled-out diagnoses', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'DM', icd10: 'E11.9', confidence: 0.9, status: 'confirmed' },
        { condition: 'HF', icd10: 'I50.9', confidence: 0.3, status: 'ruled_out' },
      ] });
      expect(results).toHaveLength(1);
      expect(results[0].condition).toBe('DM');
    });
  });

  describe('Multiple Diagnoses', () => {
    it('returns pathways for all matching conditions', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'Type 2 DM', icd10: 'E11.65', confidence: 0.92, status: 'confirmed' },
        { condition: 'HTN', icd10: 'I10', confidence: 0.88, status: 'confirmed' },
        { condition: 'MDD', icd10: 'F32.1', confidence: 0.85, status: 'working' },
      ] });
      expect(results).toHaveLength(3);
    });
  });

  describe('Treatment Step Structure', () => {
    it('diabetes has first-line, second-line, third-line, and adjunct steps', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'DM', icd10: 'E11.9', confidence: 0.9, status: 'confirmed' },
      ] });
      const phases = results[0].pathway.steps.map(s => s.phase);
      expect(phases).toContain('first_line');
      expect(phases).toContain('second_line');
      expect(phases).toContain('third_line');
      expect(phases).toContain('adjunct');
    });

    it('heart failure has 4 GDMT pillars as first-line', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'HF', icd10: 'I50.9', confidence: 0.88, status: 'confirmed' },
      ] });
      const firstLineSteps = results[0].pathway.steps.filter(s => s.phase === 'first_line');
      expect(firstLineSteps.length).toBe(4);
    });
  });

  describe('Evidence Levels', () => {
    it('all steps have valid evidence levels', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'DM', icd10: 'E11.9', confidence: 0.9, status: 'confirmed' },
        { condition: 'HTN', icd10: 'I10', confidence: 0.88, status: 'confirmed' },
      ] });
      const validLevels: EvidenceLevel[] = ['A', 'B', 'C', 'D', 'expert_consensus'];
      for (const r of results) {
        for (const step of r.pathway.steps) {
          expect(validLevels).toContain(step.evidenceLevel);
        }
      }
    });

    it('diabetes first-line has Level A evidence', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'DM', icd10: 'E11.9', confidence: 0.9, status: 'confirmed' },
      ] });
      const firstLine = results[0].pathway.steps.find(s => s.phase === 'first_line');
      expect(firstLine?.evidenceLevel).toBe('A');
    });

    it('each step includes guideline source', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'HTN', icd10: 'I10', confidence: 0.88, status: 'confirmed' },
      ] });
      for (const step of results[0].pathway.steps) {
        expect(step.guidelineSource).toBeTruthy();
        expect(step.guidelineSource.length).toBeGreaterThan(5);
      }
    });
  });

  describe('Contraindications', () => {
    it('diabetes first-line includes eGFR contraindication for metformin', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'DM', icd10: 'E11.9', confidence: 0.9, status: 'confirmed' },
      ] });
      const firstLine = results[0].pathway.steps.find(s => s.phase === 'first_line');
      expect(firstLine?.contraindications.some(c => c.includes('eGFR'))).toBe(true);
    });

    it('hypertension ACEi includes pregnancy contraindication', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'HTN', icd10: 'I10', confidence: 0.88, status: 'confirmed' },
      ] });
      const aceiStep = results[0].pathway.steps.find(s => s.intervention.includes('ACE'));
      expect(aceiStep?.contraindications.some(c => c.includes('Pregnancy'))).toBe(true);
    });

    it('every step has a contraindications array (may be empty)', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'HF', icd10: 'I50.9', confidence: 0.88, status: 'confirmed' },
      ] });
      for (const step of results[0].pathway.steps) {
        expect(Array.isArray(step.contraindications)).toBe(true);
      }
    });
  });

  describe('SDOH Notes', () => {
    it('diabetes first-line has low-cost SDOH note', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'DM', icd10: 'E11.9', confidence: 0.9, status: 'confirmed' },
      ] });
      const firstLine = results[0].pathway.steps.find(s => s.phase === 'first_line');
      expect(firstLine?.sdohNote).toBeTruthy();
      expect(firstLine?.sdohNote).toContain('low cost');
    });

    it('depression third-line mentions transportation barrier', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'MDD', icd10: 'F32.1', confidence: 0.88, status: 'confirmed' },
      ] });
      const thirdLine = results[0].pathway.steps.find(s => s.phase === 'third_line');
      expect(thirdLine?.sdohNote).toContain('transportation');
    });

    it('hypertension ACEi mentions cost', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'HTN', icd10: 'I10', confidence: 0.88, status: 'confirmed' },
      ] });
      const aceiStep = results[0].pathway.steps.find(s => s.intervention.includes('ACE'));
      expect(aceiStep?.sdohNote).toContain('low-cost');
    });
  });

  describe('Red Flags', () => {
    it('diabetes includes DKA red flag', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'DM', icd10: 'E11.9', confidence: 0.9, status: 'confirmed' },
      ] });
      expect(results[0].pathway.redFlags.some(f => f.includes('DKA'))).toBe(true);
    });

    it('depression includes suicidal ideation red flag', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'MDD', icd10: 'F32.1', confidence: 0.88, status: 'confirmed' },
      ] });
      expect(results[0].pathway.redFlags.some(f => f.toLowerCase().includes('suicid'))).toBe(true);
    });
  });

  describe('Lifestyle Recommendations', () => {
    it('diabetes includes exercise recommendation', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'DM', icd10: 'E11.9', confidence: 0.9, status: 'confirmed' },
      ] });
      expect(results[0].pathway.lifestyleRecommendations.some(r => r.includes('aerobic'))).toBe(true);
    });

    it('heart failure includes sodium restriction', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'HF', icd10: 'I50.9', confidence: 0.88, status: 'confirmed' },
      ] });
      expect(results[0].pathway.lifestyleRecommendations.some(r => r.includes('Sodium'))).toBe(true);
    });
  });

  describe('formatTreatmentForDisplay', () => {
    it('formats pathway with condition, goal, and steps', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'Type 2 DM', icd10: 'E11.65', confidence: 0.9, status: 'confirmed' },
      ] });
      const display = formatTreatmentForDisplay(results);
      expect(display.some(l => l.includes('Type 2 DM'))).toBe(true);
      expect(display.some(l => l.includes('Goal:'))).toBe(true);
      expect(display.some(l => l.includes('first line'))).toBe(true);
    });

    it('includes evidence level labels', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'HTN', icd10: 'I10', confidence: 0.88, status: 'confirmed' },
      ] });
      const display = formatTreatmentForDisplay(results);
      expect(display.some(l => l.includes('Level A') || l.includes('Level B'))).toBe(true);
    });

    it('includes contraindication lines', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'DM', icd10: 'E11.9', confidence: 0.9, status: 'confirmed' },
      ] });
      const display = formatTreatmentForDisplay(results);
      expect(display.some(l => l.includes('CI:'))).toBe(true);
    });

    it('includes red flags', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'DM', icd10: 'E11.9', confidence: 0.9, status: 'confirmed' },
      ] });
      const display = formatTreatmentForDisplay(results);
      expect(display.some(l => l.includes('Red flags:'))).toBe(true);
    });

    it('returns empty for no results', () => {
      const display = formatTreatmentForDisplay([]);
      expect(display).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty diagnosis list', () => {
      const results = matchTreatmentPathways({ diagnoses: [] });
      expect(results).toHaveLength(0);
    });

    it('handles all ruled-out', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'DM', icd10: 'E11.9', confidence: 0.3, status: 'ruled_out' },
      ] });
      expect(results).toHaveLength(0);
    });

    it('handles diagnosis with no ICD-10 and no keyword match', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'Tinea pedis', confidence: 0.7, status: 'working' },
      ] });
      expect(results).toHaveLength(0);
    });

    it('preserves original diagnosis condition name in result', () => {
      const results = matchTreatmentPathways({ diagnoses: [
        { condition: 'Uncontrolled T2DM with hyperglycemia', icd10: 'E11.65', confidence: 0.92, status: 'confirmed' },
      ] });
      expect(results[0].condition).toBe('Uncontrolled T2DM with hyperglycemia');
      expect(results[0].pathway.condition).toBe('Type 2 Diabetes Mellitus');
    });
  });
});
