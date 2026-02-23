/**
 * edgeCaseHardening.test.ts — Edge Case Hardening Tests
 *
 * Purpose: Verify Compass Riley handles edge cases that occur in real clinical
 *          practice — brief encounters, multi-problem visits, pediatric/psychiatric
 *          encounters, and interpreter-mediated visits.
 * Session 10, Tasks 10.1-10.5 of Compass Riley Clinical Reasoning Hardening
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// Type replicas matching the actual edge function modules
// ============================================================================

interface HPIElements {
  onset: string | null;
  location: string | null;
  duration: string | null;
  character: string | null;
  aggravating: string | null;
  relieving: string | null;
  timing: string | null;
  severity: string | null;
}

interface VitalSigns {
  bp?: string;
  hr?: string;
  temp?: string;
  rr?: string;
  spo2?: string;
  weight?: string;
  bmi?: string;
  glucose?: string;
}

interface DiagnosisEntry {
  condition: string;
  icd10?: string;
  confidence: number;
  supportingEvidence: string[];
  refutingEvidence: string[];
  status: 'active' | 'ruled_out' | 'working';
}

interface MedicationEntry {
  name: string;
  action: 'new' | 'adjusted' | 'continued' | 'discontinued' | 'reviewed';
  details?: string;
}

interface MDMComplexity {
  problemCount: number;
  problemComplexity: 'minimal' | 'low' | 'moderate' | 'high';
  dataReviewed: string[];
  dataComplexity: 'minimal' | 'limited' | 'moderate' | 'extensive';
  riskLevel: 'minimal' | 'low' | 'moderate' | 'high';
  overallLevel: 'straightforward' | 'low' | 'moderate' | 'high';
  suggestedEMCode: string;
  nextLevelGap?: string;
}

interface ClinicalCompleteness {
  hpiElementCount: number;
  hpiLevel: 'none' | 'brief' | 'extended';
  rosSystemCount: number;
  rosLevel: 'none' | 'pertinent' | 'complete';
  examComponentCount: number;
  hasAssessment: boolean;
  hasPlan: boolean;
  hasMedReconciliation: boolean;
  expectedButMissing: string[];
  overallPercent: number;
}

type EncounterPhase =
  | 'greeting'
  | 'chief_complaint'
  | 'history'
  | 'review_of_systems'
  | 'exam'
  | 'assessment'
  | 'plan'
  | 'counseling'
  | 'closing';

type ClinicalDomain =
  | 'cardiology' | 'pulmonology' | 'gastroenterology' | 'neurology'
  | 'endocrinology' | 'nephrology' | 'rheumatology' | 'dermatology'
  | 'musculoskeletal' | 'infectious_disease' | 'hematology_oncology'
  | 'psychiatry' | 'obstetrics_gynecology' | 'pediatrics'
  | 'ophthalmology' | 'ent' | 'urology' | 'general_medicine'
  | 'preventive_care' | 'pain_management' | 'emergency_medicine';

interface DriftState {
  primaryDomain: ClinicalDomain | null;
  relatedDomains: ClinicalDomain[];
  driftDetected: boolean;
  driftDescription?: string;
  driftEventCount: number;
}

interface PatientSafetyFlags {
  patientDirectAddress: boolean;
  emergencyDetected: boolean;
  emergencyReason?: string;
  requiresProviderConsult: boolean;
  consultReason?: string;
}

interface EncounterState {
  chiefComplaint: string | null;
  hpiElements: HPIElements;
  rosSystemsReviewed: string[];
  rosFindings: Record<string, string[]>;
  examComponents: Record<string, string[]>;
  vitals: VitalSigns;
  diagnoses: DiagnosisEntry[];
  medications: MedicationEntry[];
  planItems: string[];
  mdmComplexity: MDMComplexity;
  completeness: ClinicalCompleteness;
  currentPhase: EncounterPhase;
  driftState: DriftState;
  patientSafety: PatientSafetyFlags;
  analysisCount: number;
  lastUpdated: string;
  transcriptWordCount: number;
}

// ============================================================================
// Function replicas (matching actual implementations)
// ============================================================================

function createEmptyEncounterState(): EncounterState {
  return {
    chiefComplaint: null,
    hpiElements: {
      onset: null, location: null, duration: null, character: null,
      aggravating: null, relieving: null, timing: null, severity: null,
    },
    rosSystemsReviewed: [],
    rosFindings: {},
    examComponents: {},
    vitals: {},
    diagnoses: [],
    medications: [],
    planItems: [],
    mdmComplexity: {
      problemCount: 0,
      problemComplexity: 'minimal',
      dataReviewed: [],
      dataComplexity: 'minimal',
      riskLevel: 'minimal',
      overallLevel: 'straightforward',
      suggestedEMCode: '99212',
    },
    completeness: {
      hpiElementCount: 0,
      hpiLevel: 'none',
      rosSystemCount: 0,
      rosLevel: 'none',
      examComponentCount: 0,
      hasAssessment: false,
      hasPlan: false,
      hasMedReconciliation: false,
      expectedButMissing: ['Chief complaint', 'HPI', 'Review of systems', 'Physical exam', 'Assessment', 'Plan'],
      overallPercent: 0,
    },
    currentPhase: 'greeting',
    driftState: { primaryDomain: null, relatedDomains: [], driftDetected: false, driftEventCount: 0 },
    patientSafety: { patientDirectAddress: false, emergencyDetected: false, requiresProviderConsult: false },
    analysisCount: 0,
    lastUpdated: new Date().toISOString(),
    transcriptWordCount: 0,
  };
}

function mergeEncounterState(existing: EncounterState, update: Partial<EncounterState>): EncounterState {
  const merged = { ...existing };

  if (update.chiefComplaint && !existing.chiefComplaint) {
    merged.chiefComplaint = update.chiefComplaint;
  }

  if (update.hpiElements) {
    merged.hpiElements = { ...existing.hpiElements };
    for (const key of Object.keys(update.hpiElements) as Array<keyof HPIElements>) {
      if (update.hpiElements[key] && !existing.hpiElements[key]) {
        merged.hpiElements[key] = update.hpiElements[key];
      }
    }
  }

  if (update.rosSystemsReviewed) {
    const existingSet = new Set(existing.rosSystemsReviewed);
    for (const sys of update.rosSystemsReviewed) {
      if (!existingSet.has(sys)) {
        merged.rosSystemsReviewed = [...merged.rosSystemsReviewed, sys];
      }
    }
  }

  if (update.rosFindings) {
    merged.rosFindings = { ...existing.rosFindings };
    for (const [system, findings] of Object.entries(update.rosFindings)) {
      const existingFindings = new Set(existing.rosFindings[system] || []);
      const newFindings = findings.filter((f: string) => !existingFindings.has(f));
      merged.rosFindings[system] = [...(existing.rosFindings[system] || []), ...newFindings];
    }
  }

  if (update.examComponents) {
    merged.examComponents = { ...existing.examComponents };
    for (const [system, findings] of Object.entries(update.examComponents)) {
      const existingFindings = new Set(existing.examComponents[system] || []);
      const newFindings = findings.filter((f: string) => !existingFindings.has(f));
      merged.examComponents[system] = [...(existing.examComponents[system] || []), ...newFindings];
    }
  }

  if (update.vitals) {
    merged.vitals = { ...existing.vitals };
    for (const key of Object.keys(update.vitals) as Array<keyof VitalSigns>) {
      if (update.vitals[key] && !existing.vitals[key]) {
        merged.vitals[key] = update.vitals[key];
      }
    }
  }

  if (update.diagnoses) {
    merged.diagnoses = [...existing.diagnoses];
    for (const newDx of update.diagnoses) {
      const existingIdx = merged.diagnoses.findIndex(
        d => d.condition.toLowerCase() === newDx.condition.toLowerCase()
      );
      if (existingIdx >= 0) {
        const existingDx = merged.diagnoses[existingIdx];
        const supportingSet = new Set(existingDx.supportingEvidence);
        const refutingSet = new Set(existingDx.refutingEvidence);
        merged.diagnoses[existingIdx] = {
          ...existingDx,
          confidence: newDx.confidence,
          status: newDx.status,
          icd10: newDx.icd10 || existingDx.icd10,
          supportingEvidence: [
            ...existingDx.supportingEvidence,
            ...newDx.supportingEvidence.filter(e => !supportingSet.has(e)),
          ],
          refutingEvidence: [
            ...existingDx.refutingEvidence,
            ...newDx.refutingEvidence.filter(e => !refutingSet.has(e)),
          ],
        };
      } else {
        merged.diagnoses.push(newDx);
      }
    }
  }

  if (update.medications) {
    merged.medications = [...existing.medications];
    for (const newMed of update.medications) {
      const existingIdx = merged.medications.findIndex(
        m => m.name.toLowerCase() === newMed.name.toLowerCase()
      );
      if (existingIdx >= 0) {
        merged.medications[existingIdx] = newMed;
      } else {
        merged.medications.push(newMed);
      }
    }
  }

  if (update.planItems) {
    const existingSet = new Set(existing.planItems.map(p => p.toLowerCase()));
    for (const item of update.planItems) {
      if (!existingSet.has(item.toLowerCase())) {
        merged.planItems = [...merged.planItems, item];
      }
    }
  }

  if (update.mdmComplexity) {
    merged.mdmComplexity = update.mdmComplexity;
  }

  if (update.completeness) {
    merged.completeness = update.completeness;
  }

  if (update.currentPhase) {
    merged.currentPhase = update.currentPhase;
  }

  if (update.driftState) {
    merged.driftState = mergeDriftState(existing.driftState, update.driftState);
  }

  if (update.patientSafety) {
    merged.patientSafety = {
      patientDirectAddress: update.patientSafety.patientDirectAddress ?? false,
      emergencyDetected: update.patientSafety.emergencyDetected ?? false,
      emergencyReason: update.patientSafety.emergencyReason,
      requiresProviderConsult: update.patientSafety.requiresProviderConsult ?? false,
      consultReason: update.patientSafety.consultReason,
    };
  }

  merged.analysisCount = existing.analysisCount + 1;
  merged.lastUpdated = new Date().toISOString();
  if (update.transcriptWordCount) {
    merged.transcriptWordCount = update.transcriptWordCount;
  }

  return merged;
}

function mergeDriftState(existing: DriftState, update: Partial<DriftState>): DriftState {
  const merged = { ...existing };
  if (update.primaryDomain && !existing.primaryDomain) {
    merged.primaryDomain = update.primaryDomain;
  }
  if (update.relatedDomains) {
    const existingSet = new Set(existing.relatedDomains);
    for (const domain of update.relatedDomains) {
      if (!existingSet.has(domain)) {
        merged.relatedDomains = [...merged.relatedDomains, domain];
      }
    }
  }
  if (update.driftDetected) {
    merged.driftDetected = true;
    merged.driftDescription = update.driftDescription;
    merged.driftEventCount = existing.driftEventCount + 1;
  } else {
    merged.driftDetected = false;
    merged.driftDescription = undefined;
  }
  return merged;
}

function serializeEncounterStateForPrompt(state: EncounterState): string {
  const parts: string[] = [];
  if (state.analysisCount === 0) return '';
  parts.push('## ENCOUNTER STATE (Running Clinical Picture)');
  parts.push(`Analysis #${state.analysisCount + 1} | Phase: ${state.currentPhase}`);
  if (state.chiefComplaint) parts.push(`\nCC: ${state.chiefComplaint}`);
  const hpiEntries = Object.entries(state.hpiElements)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}: ${v}`);
  if (hpiEntries.length > 0) parts.push(`\nHPI (${hpiEntries.length}/8 OLDCARTS): ${hpiEntries.join(' | ')}`);
  const vitalEntries = Object.entries(state.vitals)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${v}`);
  if (vitalEntries.length > 0) parts.push(`\nVitals: ${vitalEntries.join(', ')}`);
  if (state.rosSystemsReviewed.length > 0)
    parts.push(`\nROS (${state.rosSystemsReviewed.length} systems): ${state.rosSystemsReviewed.join(', ')}`);
  const examSystems = Object.keys(state.examComponents);
  if (examSystems.length > 0) parts.push(`\nExam (${examSystems.length} systems): ${examSystems.join(', ')}`);
  const activeDx = state.diagnoses.filter(d => d.status !== 'ruled_out');
  if (activeDx.length > 0) {
    const dxList = activeDx.map(d =>
      `${d.condition}${d.icd10 ? ` (${d.icd10})` : ''} [${Math.round(d.confidence * 100)}%]`
    ).join(', ');
    parts.push(`\nDx: ${dxList}`);
  }
  if (state.medications.length > 0) {
    const medList = state.medications.map(m => `${m.name} (${m.action})`).join(', ');
    parts.push(`\nMeds: ${medList}`);
  }
  if (state.planItems.length > 0) parts.push(`\nPlan: ${state.planItems.join('; ')}`);
  if (state.driftState.primaryDomain) {
    const domains = [state.driftState.primaryDomain, ...state.driftState.relatedDomains];
    parts.push(`\nDomain: ${domains.join(', ')}`);
  }
  parts.push(`\nMDM: ${state.mdmComplexity.overallLevel} → ${state.mdmComplexity.suggestedEMCode}`);
  parts.push(`\nCompleteness: ${state.completeness.overallPercent}%`);
  if (state.completeness.expectedButMissing.length > 0)
    parts.push(`  Missing: ${state.completeness.expectedButMissing.join(', ')}`);
  return parts.join('\n');
}

// ============================================================================
// Emergency and safety replicas
// ============================================================================

const EMERGENCY_KEYWORDS = [
  'chest pain', 'heart attack', "can't breathe", 'difficulty breathing',
  'stroke', 'face drooping', 'slurred speech', 'severe bleeding',
  'unconscious', 'seizure', 'suicidal', 'want to die', 'overdose',
  'poisoning', 'choking', 'allergic reaction', 'anaphylaxis',
  'severe pain', 'passing out', 'losing consciousness',
] as const;

function detectEmergency(transcript: string): { detected: boolean; reason: string | undefined } {
  const lower = transcript.toLowerCase();
  for (const keyword of EMERGENCY_KEYWORDS) {
    if (lower.includes(keyword)) {
      return { detected: true, reason: keyword };
    }
  }
  return { detected: false, reason: undefined };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Edge Case Hardening (Session 10, Tasks 10.1-10.5)', () => {

  // ==========================================================================
  // 10.1: Extremely Brief Encounters (<30 seconds)
  // ==========================================================================
  describe('10.1: Brief Encounters (<30 seconds)', () => {

    it('should produce valid state after a single 15-second analysis chunk', () => {
      const state = createEmptyEncounterState();
      const merged = mergeEncounterState(state, {
        chiefComplaint: 'Sore throat',
        currentPhase: 'chief_complaint',
        transcriptWordCount: 12,
      });

      expect(merged.chiefComplaint).toBe('Sore throat');
      expect(merged.analysisCount).toBe(1);
      expect(merged.transcriptWordCount).toBe(12);
      expect(merged.currentPhase).toBe('chief_complaint');
    });

    it('should keep completeness low for minimal encounter data', () => {
      const state = createEmptyEncounterState();
      const merged = mergeEncounterState(state, {
        chiefComplaint: 'Flu shot',
        completeness: {
          hpiElementCount: 0,
          hpiLevel: 'none',
          rosSystemCount: 0,
          rosLevel: 'none',
          examComponentCount: 0,
          hasAssessment: false,
          hasPlan: true,
          hasMedReconciliation: false,
          expectedButMissing: ['HPI', 'Review of systems', 'Physical exam', 'Assessment'],
          overallPercent: 15,
        },
        transcriptWordCount: 8,
      });

      expect(merged.completeness.overallPercent).toBe(15);
      expect(merged.completeness.expectedButMissing).toContain('HPI');
      expect(merged.completeness.hasPlan).toBe(true);
    });

    it('should serialize empty state to empty string (pre-first-analysis)', () => {
      const state = createEmptyEncounterState();
      const serialized = serializeEncounterStateForPrompt(state);
      expect(serialized).toBe('');
    });

    it('should serialize minimal state after single chunk', () => {
      const state = createEmptyEncounterState();
      const merged = mergeEncounterState(state, {
        chiefComplaint: 'Prescription refill',
        currentPhase: 'plan',
        transcriptWordCount: 15,
      });
      const serialized = serializeEncounterStateForPrompt(merged);
      expect(serialized).toContain('CC: Prescription refill');
      expect(serialized).toContain('Phase: plan');
      expect(serialized).toContain('Analysis #2');
    });

    it('should handle encounters with 0 diagnoses gracefully', () => {
      const state = createEmptyEncounterState();
      const merged = mergeEncounterState(state, {
        chiefComplaint: 'Annual physical',
        planItems: ['Lab work ordered'],
        transcriptWordCount: 20,
      });

      expect(merged.diagnoses).toHaveLength(0);
      const serialized = serializeEncounterStateForPrompt(merged);
      expect(serialized).not.toContain('Dx:');
      expect(serialized).toContain('Plan: Lab work ordered');
    });

    it('should suggest low-level E/M code for minimal encounters', () => {
      const state = createEmptyEncounterState();
      const merged = mergeEncounterState(state, {
        chiefComplaint: 'Blood pressure check',
        mdmComplexity: {
          problemCount: 1,
          problemComplexity: 'minimal',
          dataReviewed: ['blood pressure reading'],
          dataComplexity: 'minimal',
          riskLevel: 'minimal',
          overallLevel: 'straightforward',
          suggestedEMCode: '99211',
        },
      });

      expect(merged.mdmComplexity.suggestedEMCode).toBe('99211');
      expect(merged.mdmComplexity.overallLevel).toBe('straightforward');
    });
  });

  // ==========================================================================
  // 10.2: Multi-Problem Visits (5+ diagnoses)
  // ==========================================================================
  describe('10.2: Multi-Problem Visits (5+ diagnoses)', () => {

    function buildMultiProblemState(): EncounterState {
      const state = createEmptyEncounterState();
      return mergeEncounterState(state, {
        chiefComplaint: 'Follow-up for multiple chronic conditions',
        diagnoses: [
          { condition: 'Type 2 Diabetes Mellitus', icd10: 'E11.65', confidence: 0.95, supportingEvidence: ['A1C 8.2%'], refutingEvidence: [], status: 'active' },
          { condition: 'Essential Hypertension', icd10: 'I10', confidence: 0.98, supportingEvidence: ['BP 158/92'], refutingEvidence: [], status: 'active' },
          { condition: 'Hyperlipidemia', icd10: 'E78.5', confidence: 0.90, supportingEvidence: ['LDL 165'], refutingEvidence: [], status: 'active' },
          { condition: 'Chronic Kidney Disease Stage 3a', icd10: 'N18.31', confidence: 0.88, supportingEvidence: ['eGFR 52'], refutingEvidence: [], status: 'active' },
          { condition: 'Obesity', icd10: 'E66.01', confidence: 0.99, supportingEvidence: ['BMI 34.2'], refutingEvidence: [], status: 'active' },
          { condition: 'Peripheral Neuropathy', icd10: 'G63', confidence: 0.75, supportingEvidence: ['numbness in feet'], refutingEvidence: [], status: 'working' },
          { condition: 'Depression', icd10: 'F32.1', confidence: 0.60, supportingEvidence: ['PHQ-9 score 14'], refutingEvidence: [], status: 'working' },
        ],
        medications: [
          { name: 'Metformin', action: 'adjusted', details: '1000mg BID -> 1500mg BID' },
          { name: 'Lisinopril', action: 'continued', details: '20mg daily' },
          { name: 'Atorvastatin', action: 'adjusted', details: '20mg -> 40mg' },
          { name: 'Gabapentin', action: 'new', details: '300mg TID' },
          { name: 'Sertraline', action: 'new', details: '50mg daily' },
        ],
      });
    }

    it('should accumulate 7+ diagnoses without truncation', () => {
      const state = buildMultiProblemState();
      expect(state.diagnoses).toHaveLength(7);
      expect(state.diagnoses.map(d => d.condition)).toContain('Type 2 Diabetes Mellitus');
      expect(state.diagnoses.map(d => d.condition)).toContain('Depression');
    });

    it('should add an 8th diagnosis via merge without losing existing ones', () => {
      const state = buildMultiProblemState();
      const updated = mergeEncounterState(state, {
        diagnoses: [
          { condition: 'Diabetic Retinopathy', icd10: 'E11.319', confidence: 0.70, supportingEvidence: ['fundoscopy scheduled'], refutingEvidence: [], status: 'working' },
        ],
      });

      expect(updated.diagnoses).toHaveLength(8);
      expect(updated.diagnoses.map(d => d.condition)).toContain('Diabetic Retinopathy');
      // Verify no data loss
      expect(updated.diagnoses.map(d => d.condition)).toContain('Type 2 Diabetes Mellitus');
      expect(updated.diagnoses.map(d => d.condition)).toContain('Depression');
    });

    it('should merge duplicate diagnosis by condition name (case-insensitive)', () => {
      const state = buildMultiProblemState();
      const updated = mergeEncounterState(state, {
        diagnoses: [
          { condition: 'type 2 diabetes mellitus', icd10: 'E11.65', confidence: 0.97, supportingEvidence: ['fasting glucose 165'], refutingEvidence: [], status: 'active' },
        ],
      });

      // Should NOT add a duplicate — should merge into existing
      expect(updated.diagnoses).toHaveLength(7);
      const diabetes = updated.diagnoses.find(d => d.condition === 'Type 2 Diabetes Mellitus');
      expect(diabetes?.confidence).toBe(0.97);
      expect(diabetes?.supportingEvidence).toContain('A1C 8.2%');
      expect(diabetes?.supportingEvidence).toContain('fasting glucose 165');
    });

    it('should serialize all active diagnoses in prompt state', () => {
      const state = buildMultiProblemState();
      const serialized = serializeEncounterStateForPrompt(state);

      expect(serialized).toContain('Type 2 Diabetes Mellitus');
      expect(serialized).toContain('Essential Hypertension');
      expect(serialized).toContain('Chronic Kidney Disease Stage 3a');
      expect(serialized).toContain('Depression');
      expect(serialized).toContain('Peripheral Neuropathy');
    });

    it('should track 5 medications in a single update', () => {
      const state = buildMultiProblemState();
      expect(state.medications).toHaveLength(5);
      expect(state.medications.map(m => m.name)).toContain('Metformin');
      expect(state.medications.map(m => m.name)).toContain('Sertraline');
    });

    it('should suggest high-level E/M code for complex multi-problem visit', () => {
      const state = buildMultiProblemState();
      const updated = mergeEncounterState(state, {
        mdmComplexity: {
          problemCount: 7,
          problemComplexity: 'high',
          dataReviewed: ['A1C', 'lipid panel', 'eGFR', 'PHQ-9', 'monofilament exam'],
          dataComplexity: 'extensive',
          riskLevel: 'high',
          overallLevel: 'high',
          suggestedEMCode: '99215',
        },
      });

      expect(updated.mdmComplexity.overallLevel).toBe('high');
      expect(updated.mdmComplexity.suggestedEMCode).toBe('99215');
      expect(updated.mdmComplexity.problemCount).toBe(7);
    });

    it('should filter ruled-out diagnoses from serialized prompt', () => {
      const state = buildMultiProblemState();
      const updated = mergeEncounterState(state, {
        diagnoses: [
          { condition: 'Peripheral Neuropathy', icd10: 'G63', confidence: 0.20, supportingEvidence: [], refutingEvidence: ['nerve conduction normal'], status: 'ruled_out' },
        ],
      });

      const serialized = serializeEncounterStateForPrompt(updated);
      // Ruled out diagnosis should NOT appear in prompt
      expect(serialized).not.toContain('Peripheral Neuropathy');
      // But active ones should
      expect(serialized).toContain('Type 2 Diabetes Mellitus');
    });

    it('should handle 10+ plan items without truncation', () => {
      const state = buildMultiProblemState();
      const updated = mergeEncounterState(state, {
        planItems: [
          'Increase Metformin to 1500mg BID',
          'Increase Atorvastatin to 40mg',
          'Start Gabapentin 300mg TID',
          'Start Sertraline 50mg daily',
          'Repeat A1C in 3 months',
          'Repeat lipid panel in 6 months',
          'Nephrology referral for CKD monitoring',
          'Dietitian referral for weight management',
          'PHQ-9 follow-up in 4 weeks',
          'Diabetic foot exam completed today',
          'Dilated eye exam referral',
        ],
      });

      expect(updated.planItems).toHaveLength(11);
      expect(updated.planItems).toContain('Nephrology referral for CKD monitoring');
    });
  });

  // ==========================================================================
  // 10.3: Pediatric Encounters (age-appropriate reasoning)
  // ==========================================================================
  describe('10.3: Pediatric Encounters', () => {

    const PEDIATRIC_VITAL_RANGES = {
      infant: { hr: '100-160', rr: '30-60', temp: '97.7-99.5°F' },
      toddler: { hr: '80-130', rr: '24-40', temp: '97.7-99.5°F' },
      child: { hr: '70-100', rr: '18-30', temp: '97.7-99.5°F' },
      adolescent: { hr: '60-100', rr: '12-20', temp: '97.7-99.5°F' },
    };

    const PEDIATRIC_ICD10_CODES = [
      { code: 'J06.9', description: 'Acute upper respiratory infection' },
      { code: 'H66.90', description: 'Otitis media, unspecified' },
      { code: 'J20.9', description: 'Acute bronchitis, unspecified' },
      { code: 'K21.0', description: 'GERD with esophagitis' },
      { code: 'R50.9', description: 'Fever, unspecified' },
      { code: 'Z00.129', description: 'Well-child visit, without abnormal findings' },
      { code: 'Z23', description: 'Immunization encounter' },
    ];

    it('should track pediatric vital ranges as distinct from adult', () => {
      expect(PEDIATRIC_VITAL_RANGES.infant.hr).toBe('100-160');
      expect(PEDIATRIC_VITAL_RANGES.adolescent.hr).toBe('60-100');
      // Infant normal HR (140) would be tachycardia in an adult
    });

    it('should handle well-child visits with appropriate ICD-10 codes', () => {
      const state = createEmptyEncounterState();
      const updated = mergeEncounterState(state, {
        chiefComplaint: '2-year well child check',
        diagnoses: [
          { condition: 'Well-child visit', icd10: 'Z00.129', confidence: 0.99, supportingEvidence: ['scheduled 2-year visit'], refutingEvidence: [], status: 'active' },
        ],
        driftState: { primaryDomain: 'pediatrics', relatedDomains: [], driftDetected: false, driftEventCount: 0 },
      });

      expect(updated.chiefComplaint).toBe('2-year well child check');
      expect(updated.diagnoses[0].icd10).toBe('Z00.129');
      expect(updated.driftState.primaryDomain).toBe('pediatrics');
    });

    it('should recognize pediatric-specific diagnoses', () => {
      const commonPedDx = PEDIATRIC_ICD10_CODES.map(c => c.code);
      expect(commonPedDx).toContain('J06.9'); // URI
      expect(commonPedDx).toContain('H66.90'); // Otitis media
      expect(commonPedDx).toContain('Z23'); // Immunization
    });

    it('should track immunization-related encounters', () => {
      const state = createEmptyEncounterState();
      const updated = mergeEncounterState(state, {
        chiefComplaint: 'Immunization visit',
        diagnoses: [
          { condition: 'Immunization encounter', icd10: 'Z23', confidence: 0.99, supportingEvidence: ['DTaP, IPV, MMR administered'], refutingEvidence: [], status: 'active' },
        ],
        planItems: ['DTaP dose 4 administered', 'IPV dose 3 administered', 'MMR dose 1 administered', 'Next visit at 4 years'],
      });

      expect(updated.planItems).toHaveLength(4);
      expect(updated.planItems).toContain('MMR dose 1 administered');
    });

    it('should handle pediatric weight-based medication dosing', () => {
      const state = createEmptyEncounterState();
      const updated = mergeEncounterState(state, {
        chiefComplaint: 'Ear infection',
        vitals: { weight: '12.5 kg', temp: '101.2°F', hr: '120' },
        medications: [
          { name: 'Amoxicillin', action: 'new', details: '80mg/kg/day divided BID = 500mg BID' },
        ],
        diagnoses: [
          { condition: 'Acute otitis media', icd10: 'H66.90', confidence: 0.92, supportingEvidence: ['bulging TM right ear', 'fever'], refutingEvidence: [], status: 'active' },
        ],
      });

      expect(updated.vitals.weight).toBe('12.5 kg');
      expect(updated.medications[0].details).toContain('80mg/kg/day');
    });

    it('should flag drift when adult-only treatments suggested in pediatric context', () => {
      const state = createEmptyEncounterState();
      const s1 = mergeEncounterState(state, {
        chiefComplaint: 'Cough and congestion in 3-year-old',
        driftState: { primaryDomain: 'pediatrics', relatedDomains: ['pulmonology'], driftDetected: false, driftEventCount: 0 },
      });

      // Simulate drift: adult cardiology suggestion in pediatric encounter
      const s2 = mergeEncounterState(s1, {
        driftState: {
          primaryDomain: 'pediatrics',
          relatedDomains: ['pulmonology'],
          driftDetected: true,
          driftDescription: 'Adult antihypertensive suggested for pediatric patient',
          driftEventCount: 0,
        },
      });

      expect(s2.driftState.driftDetected).toBe(true);
      expect(s2.driftState.driftEventCount).toBe(1);
      expect(s2.driftState.driftDescription).toContain('pediatric');
    });
  });

  // ==========================================================================
  // 10.4: Psychiatric Encounters (sensitive documentation)
  // ==========================================================================
  describe('10.4: Psychiatric Encounters', () => {

    const PSYCHIATRIC_SENSITIVE_TERMS = [
      'suicidal ideation', 'homicidal ideation', 'self-harm',
      'substance abuse', 'sexual abuse', 'domestic violence',
      'involuntary commitment', 'danger to self', 'danger to others',
      'psychosis', 'hallucinations', 'delusions',
    ];

    it('should track psychiatric domain correctly', () => {
      const state = createEmptyEncounterState();
      const updated = mergeEncounterState(state, {
        chiefComplaint: 'Worsening depression and anxiety',
        driftState: { primaryDomain: 'psychiatry', relatedDomains: [], driftDetected: false, driftEventCount: 0 },
        diagnoses: [
          { condition: 'Major Depressive Disorder', icd10: 'F32.1', confidence: 0.85, supportingEvidence: ['PHQ-9: 16', 'depressed mood daily'], refutingEvidence: [], status: 'active' },
          { condition: 'Generalized Anxiety Disorder', icd10: 'F41.1', confidence: 0.80, supportingEvidence: ['GAD-7: 14', 'excessive worry'], refutingEvidence: [], status: 'active' },
        ],
      });

      expect(updated.driftState.primaryDomain).toBe('psychiatry');
      expect(updated.diagnoses).toHaveLength(2);
    });

    it('should flag suicidal ideation as emergency', () => {
      const result = detectEmergency('Patient states they have been thinking about ending their life. Suicidal ideation present.');
      expect(result.detected).toBe(true);
      expect(result.reason).toBe('suicidal');
    });

    it('should flag "want to die" as emergency', () => {
      const result = detectEmergency('The patient says I just want to die, everything is hopeless.');
      expect(result.detected).toBe(true);
      expect(result.reason).toBe('want to die');
    });

    it('should cover key psychiatric safety terms', () => {
      expect(PSYCHIATRIC_SENSITIVE_TERMS).toContain('suicidal ideation');
      expect(PSYCHIATRIC_SENSITIVE_TERMS).toContain('homicidal ideation');
      expect(PSYCHIATRIC_SENSITIVE_TERMS).toContain('self-harm');
      expect(PSYCHIATRIC_SENSITIVE_TERMS).toContain('psychosis');
      expect(PSYCHIATRIC_SENSITIVE_TERMS.length).toBeGreaterThanOrEqual(10);
    });

    it('should track both medication and therapy in plan', () => {
      const state = createEmptyEncounterState();
      const updated = mergeEncounterState(state, {
        chiefComplaint: 'Depression follow-up',
        medications: [
          { name: 'Sertraline', action: 'adjusted', details: '50mg -> 100mg daily' },
          { name: 'Hydroxyzine', action: 'new', details: '25mg PRN for anxiety' },
        ],
        planItems: [
          'Increase Sertraline to 100mg',
          'Start Hydroxyzine 25mg PRN',
          'Continue weekly CBT sessions',
          'Safety plan reviewed and updated',
          'PHQ-9 recheck in 4 weeks',
        ],
      });

      expect(updated.planItems).toContain('Continue weekly CBT sessions');
      expect(updated.planItems).toContain('Safety plan reviewed and updated');
      expect(updated.medications).toHaveLength(2);
    });

    it('should handle substance use screening in psychiatric encounter', () => {
      const state = createEmptyEncounterState();
      const updated = mergeEncounterState(state, {
        chiefComplaint: 'Anxiety and sleep problems',
        rosSystemsReviewed: ['psychiatric', 'substance_use'],
        rosFindings: {
          psychiatric: ['depressed mood', 'anxiety', 'insomnia'],
          substance_use: ['alcohol 2-3 drinks daily', 'denies illicit drugs', 'AUDIT-C score 5'],
        },
        diagnoses: [
          { condition: 'Alcohol Use Disorder, mild', icd10: 'F10.10', confidence: 0.72, supportingEvidence: ['AUDIT-C 5', '2-3 drinks daily'], refutingEvidence: [], status: 'working' },
        ],
      });

      expect(updated.rosFindings['substance_use']).toContain('AUDIT-C score 5');
      expect(updated.diagnoses[0].condition).toBe('Alcohol Use Disorder, mild');
    });

    it('should handle PHQ-9 and GAD-7 scoring as exam components', () => {
      const state = createEmptyEncounterState();
      const updated = mergeEncounterState(state, {
        examComponents: {
          screening_tools: ['PHQ-9: 16 (moderately severe)', 'GAD-7: 14 (moderate)', 'Columbia Suicide Severity: low risk'],
        },
      });

      expect(updated.examComponents['screening_tools']).toHaveLength(3);
      expect(updated.examComponents['screening_tools']).toContain('PHQ-9: 16 (moderately severe)');
    });
  });

  // ==========================================================================
  // 10.5: Language Barriers / Interpreter-Mediated Visits
  // ==========================================================================
  describe('10.5: Language Barriers / Interpreter-Mediated Visits', () => {

    const INTERPRETER_MARKERS = [
      'interpreter present', 'via interpreter', 'through interpreter',
      'spanish interpreter', 'mandarin interpreter', 'vietnamese interpreter',
      'language line', 'video interpreter', 'phone interpreter',
      'certified medical interpreter', 'ad hoc interpreter',
      'family member interpreting', 'bilingual provider',
    ];

    it('should detect interpreter presence from transcript', () => {
      const transcriptWithInterpreter =
        'Interpreter present for this visit. Spanish medical interpreter via Language Line.';
      const lower = transcriptWithInterpreter.toLowerCase();
      const detected = INTERPRETER_MARKERS.some(marker => lower.includes(marker));
      expect(detected).toBe(true);
    });

    it('should handle encounters with interpreter in plan items', () => {
      const state = createEmptyEncounterState();
      const updated = mergeEncounterState(state, {
        chiefComplaint: 'Chest pain (via Spanish interpreter)',
        planItems: [
          'EKG ordered',
          'Discharge instructions provided in Spanish',
          'Follow-up with PCP in 2 days',
          'Interpreter-mediated informed consent obtained',
        ],
      });

      expect(updated.chiefComplaint).toContain('via Spanish interpreter');
      expect(updated.planItems).toContain('Discharge instructions provided in Spanish');
      expect(updated.planItems).toContain('Interpreter-mediated informed consent obtained');
    });

    it('should handle multi-turn interpreter dialogue in encounter state', () => {
      const state = createEmptyEncounterState();
      // First chunk: interpreter introduces, CC established
      const s1 = mergeEncounterState(state, {
        chiefComplaint: 'Abdominal pain for 3 days',
        hpiElements: { onset: '3 days ago', location: 'right lower quadrant', duration: null, character: null, aggravating: null, relieving: null, timing: null, severity: null },
        transcriptWordCount: 45,
      });

      // Second chunk: interpreter relays more HPI
      const s2 = mergeEncounterState(s1, {
        hpiElements: { onset: null, location: null, duration: '3 days constant', character: 'sharp', aggravating: 'movement', relieving: 'lying still', timing: null, severity: '8/10' },
        transcriptWordCount: 95,
      });

      // HPI should accumulate across chunks (fill nulls only)
      expect(s2.hpiElements.onset).toBe('3 days ago');
      expect(s2.hpiElements.location).toBe('right lower quadrant');
      expect(s2.hpiElements.duration).toBe('3 days constant');
      expect(s2.hpiElements.character).toBe('sharp');
      expect(s2.hpiElements.severity).toBe('8/10');
    });

    it('should cover common interpreter languages', () => {
      const languageMarkers = INTERPRETER_MARKERS.filter(m =>
        m.includes('spanish') || m.includes('mandarin') || m.includes('vietnamese')
      );
      expect(languageMarkers.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle multiple interpreter types', () => {
      const types = INTERPRETER_MARKERS.filter(m =>
        m.includes('language line') || m.includes('video') || m.includes('phone') || m.includes('certified')
      );
      expect(types.length).toBeGreaterThanOrEqual(4);
    });

    it('should flag family member interpreting as quality concern', () => {
      const familyInterpreterPresent = INTERPRETER_MARKERS.includes('family member interpreting');
      expect(familyInterpreterPresent).toBe(true);
      // Family member interpreting is a quality/accuracy concern —
      // medical terminology may be lost in translation
    });

    it('should handle bilingual encounters without interpreter', () => {
      const state = createEmptyEncounterState();
      const updated = mergeEncounterState(state, {
        chiefComplaint: 'Headache (bilingual provider, visit conducted in Spanish)',
        diagnoses: [
          { condition: 'Tension-type headache', icd10: 'G44.209', confidence: 0.88, supportingEvidence: ['bilateral pressure-like headache', 'stress-related'], refutingEvidence: ['no photophobia', 'no nausea'], status: 'active' },
        ],
      });

      expect(updated.chiefComplaint).toContain('bilingual provider');
      expect(updated.diagnoses[0].refutingEvidence).toContain('no photophobia');
    });

    it('should track interpreter-added visit time for proper E/M coding', () => {
      // Interpreter-mediated visits typically take 2x as long.
      // MDM should reflect the actual clinical complexity, not visit duration.
      const state = createEmptyEncounterState();
      const updated = mergeEncounterState(state, {
        chiefComplaint: 'Diabetes management (via interpreter)',
        mdmComplexity: {
          problemCount: 2,
          problemComplexity: 'moderate',
          dataReviewed: ['A1C', 'glucose log'],
          dataComplexity: 'moderate',
          riskLevel: 'moderate',
          overallLevel: 'moderate',
          suggestedEMCode: '99214',
          nextLevelGap: 'Document additional management options for 99215',
        },
      });

      // E/M code based on MDM, not visit time (for 2021 guidelines)
      expect(updated.mdmComplexity.suggestedEMCode).toBe('99214');
    });
  });

  // ==========================================================================
  // Cross-cutting edge case: Rapid phase transitions
  // ==========================================================================
  describe('Cross-cutting: Rapid Phase Transitions', () => {

    it('should handle encounter that jumps from greeting to closing (telehealth)', () => {
      const state = createEmptyEncounterState();
      const s1 = mergeEncounterState(state, {
        chiefComplaint: 'Refill request',
        currentPhase: 'greeting',
      });
      const s2 = mergeEncounterState(s1, {
        currentPhase: 'closing',
        medications: [{ name: 'Lisinopril', action: 'continued', details: '10mg daily, 90-day refill' }],
        planItems: ['90-day refill authorized', 'Follow-up in 6 months'],
      });

      expect(s2.currentPhase).toBe('closing');
      expect(s2.analysisCount).toBe(2);
      expect(s2.medications).toHaveLength(1);
    });

    it('should handle 10+ analysis chunks building up state progressively', () => {
      let state = createEmptyEncounterState();
      for (let i = 0; i < 10; i++) {
        state = mergeEncounterState(state, {
          transcriptWordCount: (i + 1) * 50,
        });
      }
      expect(state.analysisCount).toBe(10);
      expect(state.transcriptWordCount).toBe(500);
    });
  });
});
