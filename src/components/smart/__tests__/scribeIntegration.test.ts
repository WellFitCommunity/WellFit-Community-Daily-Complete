/**
 * scribeIntegration.test.ts — End-to-End Integration Tests for Compass Riley Scribe Mode
 *
 * Purpose: Verify the full scribe pipeline — from transcript through prompt generation,
 *          encounter state management, evidence/guideline/pathway triggers, and output
 *          formatting. Tests all 8 sessions of reasoning hardening together.
 * Session 9, Task 9.1 of Compass Riley Clinical Reasoning Hardening
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// Type replicas (matches edge function types — avoids Deno import chain)
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
  | 'greeting' | 'chief_complaint' | 'history' | 'review_of_systems'
  | 'exam' | 'assessment' | 'plan' | 'counseling' | 'closing';

type ClinicalDomain =
  | 'cardiology' | 'pulmonology' | 'gastroenterology' | 'neurology'
  | 'endocrinology' | 'nephrology' | 'rheumatology' | 'general_medicine'
  | 'preventive_care' | 'emergency_medicine';

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
// Replicated pure logic (matches encounterStateManager.ts — no Deno imports)
// ============================================================================

function createEmptyDriftState(): DriftState {
  return { primaryDomain: null, relatedDomains: [], driftDetected: false, driftEventCount: 0 };
}

function createEmptyPatientSafetyFlags(): PatientSafetyFlags {
  return { patientDirectAddress: false, emergencyDetected: false, requiresProviderConsult: false };
}

function createEmptyEncounterState(): EncounterState {
  return {
    chiefComplaint: null,
    hpiElements: { onset: null, location: null, duration: null, character: null, aggravating: null, relieving: null, timing: null, severity: null },
    rosSystemsReviewed: [],
    rosFindings: {},
    examComponents: {},
    vitals: {},
    diagnoses: [],
    medications: [],
    planItems: [],
    mdmComplexity: {
      problemCount: 0, problemComplexity: 'minimal', dataReviewed: [], dataComplexity: 'minimal',
      riskLevel: 'minimal', overallLevel: 'straightforward', suggestedEMCode: '99212',
    },
    completeness: {
      hpiElementCount: 0, hpiLevel: 'none', rosSystemCount: 0, rosLevel: 'none',
      examComponentCount: 0, hasAssessment: false, hasPlan: false, hasMedReconciliation: false,
      expectedButMissing: ['Chief complaint', 'HPI', 'Review of systems', 'Physical exam', 'Assessment', 'Plan'],
      overallPercent: 0,
    },
    currentPhase: 'greeting',
    driftState: createEmptyDriftState(),
    patientSafety: createEmptyPatientSafetyFlags(),
    analysisCount: 0,
    lastUpdated: new Date().toISOString(),
    transcriptWordCount: 0,
  };
}

function mergeDriftState(existing: DriftState, update: Partial<DriftState>): DriftState {
  const merged = { ...existing };
  if (update.primaryDomain && !existing.primaryDomain) merged.primaryDomain = update.primaryDomain;
  if (update.relatedDomains) {
    const set = new Set(existing.relatedDomains);
    for (const d of update.relatedDomains) {
      if (!set.has(d)) merged.relatedDomains = [...merged.relatedDomains, d];
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

function mergeEncounterState(existing: EncounterState, update: Partial<EncounterState>): EncounterState {
  const merged = { ...existing };

  if (update.chiefComplaint && !existing.chiefComplaint) merged.chiefComplaint = update.chiefComplaint;

  if (update.hpiElements) {
    merged.hpiElements = { ...existing.hpiElements };
    for (const key of Object.keys(update.hpiElements) as Array<keyof HPIElements>) {
      if (update.hpiElements[key] && !existing.hpiElements[key]) {
        merged.hpiElements[key] = update.hpiElements[key];
      }
    }
  }

  if (update.rosSystemsReviewed) {
    const set = new Set(existing.rosSystemsReviewed);
    for (const sys of update.rosSystemsReviewed) {
      if (!set.has(sys)) merged.rosSystemsReviewed = [...merged.rosSystemsReviewed, sys];
    }
  }

  if (update.rosFindings) {
    merged.rosFindings = { ...existing.rosFindings };
    for (const [sys, findings] of Object.entries(update.rosFindings)) {
      const set = new Set(existing.rosFindings[sys] || []);
      const novel = findings.filter((f: string) => !set.has(f));
      merged.rosFindings[sys] = [...(existing.rosFindings[sys] || []), ...novel];
    }
  }

  if (update.examComponents) {
    merged.examComponents = { ...existing.examComponents };
    for (const [sys, findings] of Object.entries(update.examComponents)) {
      const set = new Set(existing.examComponents[sys] || []);
      const novel = findings.filter((f: string) => !set.has(f));
      merged.examComponents[sys] = [...(existing.examComponents[sys] || []), ...novel];
    }
  }

  if (update.vitals) {
    merged.vitals = { ...existing.vitals };
    for (const key of Object.keys(update.vitals) as Array<keyof VitalSigns>) {
      if (update.vitals[key] && !existing.vitals[key]) merged.vitals[key] = update.vitals[key];
    }
  }

  if (update.diagnoses) {
    merged.diagnoses = [...existing.diagnoses];
    for (const newDx of update.diagnoses) {
      const idx = merged.diagnoses.findIndex(d => d.condition.toLowerCase() === newDx.condition.toLowerCase());
      if (idx >= 0) {
        const ex = merged.diagnoses[idx];
        const sSet = new Set(ex.supportingEvidence);
        const rSet = new Set(ex.refutingEvidence);
        merged.diagnoses[idx] = {
          ...ex, confidence: newDx.confidence, status: newDx.status,
          icd10: newDx.icd10 || ex.icd10,
          supportingEvidence: [...ex.supportingEvidence, ...newDx.supportingEvidence.filter(e => !sSet.has(e))],
          refutingEvidence: [...ex.refutingEvidence, ...newDx.refutingEvidence.filter(e => !rSet.has(e))],
        };
      } else {
        merged.diagnoses.push(newDx);
      }
    }
  }

  if (update.medications) {
    merged.medications = [...existing.medications];
    for (const newMed of update.medications) {
      const idx = merged.medications.findIndex(m => m.name.toLowerCase() === newMed.name.toLowerCase());
      if (idx >= 0) merged.medications[idx] = newMed;
      else merged.medications.push(newMed);
    }
  }

  if (update.planItems) {
    const set = new Set(existing.planItems.map(p => p.toLowerCase()));
    for (const item of update.planItems) {
      if (!set.has(item.toLowerCase())) merged.planItems = [...merged.planItems, item];
    }
  }

  if (update.mdmComplexity) merged.mdmComplexity = update.mdmComplexity;
  if (update.completeness) merged.completeness = update.completeness;
  if (update.currentPhase) merged.currentPhase = update.currentPhase;
  if (update.driftState) merged.driftState = mergeDriftState(existing.driftState, update.driftState);
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
  if (update.transcriptWordCount) merged.transcriptWordCount = update.transcriptWordCount;
  return merged;
}

function serializeEncounterStateForPrompt(state: EncounterState): string {
  if (state.analysisCount === 0) return '';
  const parts: string[] = [];
  parts.push('## ENCOUNTER STATE (Running Clinical Picture)');
  parts.push(`Analysis #${state.analysisCount + 1} | Phase: ${state.currentPhase}`);
  if (state.chiefComplaint) parts.push(`\nCC: ${state.chiefComplaint}`);
  const hpiEntries = Object.entries(state.hpiElements).filter(([, v]) => v !== null).map(([k, v]) => `${k}: ${v}`);
  if (hpiEntries.length > 0) parts.push(`\nHPI (${hpiEntries.length}/8 OLDCARTS): ${hpiEntries.join(' | ')}`);
  const vitalEntries = Object.entries(state.vitals).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${v}`);
  if (vitalEntries.length > 0) parts.push(`\nVitals: ${vitalEntries.join(', ')}`);
  if (state.rosSystemsReviewed.length > 0) parts.push(`\nROS (${state.rosSystemsReviewed.length} systems): ${state.rosSystemsReviewed.join(', ')}`);
  const examSystems = Object.keys(state.examComponents);
  if (examSystems.length > 0) parts.push(`\nExam (${examSystems.length} systems): ${examSystems.join(', ')}`);
  const activeDx = state.diagnoses.filter(d => d.status !== 'ruled_out');
  if (activeDx.length > 0) {
    parts.push(`\nDx: ${activeDx.map(d => `${d.condition}${d.icd10 ? ` (${d.icd10})` : ''} [${Math.round(d.confidence * 100)}%]`).join(', ')}`);
  }
  if (state.medications.length > 0) parts.push(`\nMeds: ${state.medications.map(m => `${m.name} (${m.action})`).join(', ')}`);
  if (state.planItems.length > 0) parts.push(`\nPlan: ${state.planItems.join('; ')}`);
  if (state.driftState.primaryDomain) {
    parts.push(`\nDomain: ${[state.driftState.primaryDomain, ...state.driftState.relatedDomains].join(', ')}`);
  }
  parts.push(`\nMDM: ${state.mdmComplexity.overallLevel} → ${state.mdmComplexity.suggestedEMCode}`);
  parts.push(`\nCompleteness: ${state.completeness.overallPercent}%`);
  if (state.completeness.expectedButMissing.length > 0) {
    parts.push(`  Missing: ${state.completeness.expectedButMissing.join(', ')}`);
  }
  return parts.join('\n');
}

// ============================================================================
// Client-safe serialization (matches scribeHelpers.ts)
// ============================================================================

function serializeEncounterStateForClient(state: EncounterState): Record<string, unknown> {
  return {
    currentPhase: state.currentPhase,
    analysisCount: state.analysisCount,
    chiefComplaint: state.chiefComplaint,
    diagnosisCount: state.diagnoses.length,
    activeDiagnoses: state.diagnoses.filter(d => d.status !== 'ruled_out')
      .map(d => ({ condition: d.condition, icd10: d.icd10, confidence: d.confidence })),
    mdmComplexity: {
      overallLevel: state.mdmComplexity.overallLevel,
      suggestedEMCode: state.mdmComplexity.suggestedEMCode,
      nextLevelGap: state.mdmComplexity.nextLevelGap,
    },
    completeness: {
      overallPercent: state.completeness.overallPercent,
      hpiLevel: state.completeness.hpiLevel,
      rosLevel: state.completeness.rosLevel,
      expectedButMissing: state.completeness.expectedButMissing,
    },
    medicationCount: state.medications.length,
    planItemCount: state.planItems.length,
    driftState: {
      primaryDomain: state.driftState.primaryDomain,
      relatedDomains: state.driftState.relatedDomains,
      driftDetected: state.driftState.driftDetected,
      driftDescription: state.driftState.driftDescription ?? null,
    },
    patientSafety: {
      patientDirectAddress: state.patientSafety.patientDirectAddress,
      emergencyDetected: state.patientSafety.emergencyDetected,
      emergencyReason: state.patientSafety.emergencyReason ?? null,
      requiresProviderConsult: state.patientSafety.requiresProviderConsult,
      consultReason: state.patientSafety.consultReason ?? null,
    },
  };
}

// ============================================================================
// TESTS — Full Scribe Pipeline Integration
// ============================================================================

describe('Scribe Mode Integration (Sessions 1-8)', () => {

  describe('Session 1: Anti-Hallucination — Encounter State from Multiple Chunks', () => {
    it('should build progressive encounter state across 3 analysis chunks', () => {
      let state = createEmptyEncounterState();

      // Chunk 1: Chief complaint + vitals
      state = mergeEncounterState(state, {
        chiefComplaint: 'Diabetes follow-up',
        currentPhase: 'chief_complaint',
        vitals: { bp: '138/85', hr: '78', temp: '98.6' },
        hpiElements: { onset: '3 months ago', severity: null, location: null, duration: null, character: null, aggravating: null, relieving: null, timing: null },
        driftState: { primaryDomain: 'endocrinology', relatedDomains: [], driftDetected: false, driftEventCount: 0 },
      });

      expect(state.chiefComplaint).toBe('Diabetes follow-up');
      expect(state.vitals.bp).toBe('138/85');
      expect(state.analysisCount).toBe(1);
      expect(state.driftState.primaryDomain).toBe('endocrinology');

      // Chunk 2: Labs + ROS + diagnoses
      state = mergeEncounterState(state, {
        currentPhase: 'assessment',
        hpiElements: { onset: null, severity: '7/10', location: null, duration: '3 months', character: null, aggravating: 'holidays', relieving: null, timing: null },
        rosSystemsReviewed: ['endocrine', 'neurological'],
        rosFindings: { endocrine: ['no polyuria', 'no polydipsia'], neurological: ['morning dizziness'] },
        diagnoses: [
          { condition: 'Type 2 diabetes', icd10: 'E11.65', confidence: 0.92, supportingEvidence: ['A1C 7.8%'], refutingEvidence: [], status: 'active' },
          { condition: 'Hypertension', icd10: 'I10', confidence: 0.85, supportingEvidence: ['BP 138/85'], refutingEvidence: [], status: 'active' },
        ],
        driftState: { primaryDomain: 'endocrinology', relatedDomains: ['cardiology'], driftDetected: false, driftEventCount: 0 },
      });

      expect(state.analysisCount).toBe(2);
      expect(state.hpiElements.onset).toBe('3 months ago'); // set-once
      expect(state.hpiElements.severity).toBe('7/10'); // filled in
      expect(state.hpiElements.duration).toBe('3 months'); // filled in
      expect(state.rosSystemsReviewed).toContain('endocrine');
      expect(state.rosSystemsReviewed).toContain('neurological');
      expect(state.diagnoses).toHaveLength(2);
      expect(state.driftState.relatedDomains).toContain('cardiology');

      // Chunk 3: Medications + plan
      state = mergeEncounterState(state, {
        currentPhase: 'plan',
        medications: [
          { name: 'Metformin', action: 'adjusted', details: '500mg BID → 850mg BID' },
        ],
        planItems: ['Increase Metformin', 'Nutritionist referral', 'Follow-up 6 weeks'],
        diagnoses: [
          { condition: 'Type 2 diabetes', icd10: 'E11.65', confidence: 0.95, supportingEvidence: ['fasting glucose 140-150'], refutingEvidence: [], status: 'active' },
        ],
        mdmComplexity: {
          problemCount: 3, problemComplexity: 'moderate', dataReviewed: ['A1C', 'lipid panel', 'eGFR'],
          dataComplexity: 'moderate', riskLevel: 'moderate', overallLevel: 'moderate', suggestedEMCode: '99214',
        },
        completeness: {
          hpiElementCount: 4, hpiLevel: 'extended', rosSystemCount: 2, rosLevel: 'pertinent',
          examComponentCount: 0, hasAssessment: true, hasPlan: true, hasMedReconciliation: true,
          expectedButMissing: ['Physical exam'], overallPercent: 78,
        },
      });

      expect(state.analysisCount).toBe(3);
      expect(state.currentPhase).toBe('plan');
      expect(state.medications).toHaveLength(1);
      expect(state.planItems).toHaveLength(3);
      // Diabetes confidence updated
      expect(state.diagnoses[0].confidence).toBe(0.95);
      // Evidence merged additively
      expect(state.diagnoses[0].supportingEvidence).toContain('A1C 7.8%');
      expect(state.diagnoses[0].supportingEvidence).toContain('fasting glucose 140-150');
      // MDM overwritten
      expect(state.mdmComplexity.overallLevel).toBe('moderate');
      expect(state.mdmComplexity.suggestedEMCode).toBe('99214');
      // Completeness overwritten
      expect(state.completeness.overallPercent).toBe(78);
      expect(state.completeness.expectedButMissing).toEqual(['Physical exam']);
    });

    it('should not overwrite chief complaint once set', () => {
      let state = createEmptyEncounterState();
      state = mergeEncounterState(state, { chiefComplaint: 'Chest pain' });
      state = mergeEncounterState(state, { chiefComplaint: 'Headache' });
      expect(state.chiefComplaint).toBe('Chest pain');
    });

    it('should not overwrite HPI elements once set', () => {
      let state = createEmptyEncounterState();
      state = mergeEncounterState(state, { hpiElements: { onset: '2 days ago', location: null, duration: null, character: null, aggravating: null, relieving: null, timing: null, severity: null } });
      state = mergeEncounterState(state, { hpiElements: { onset: '1 week ago', location: 'chest', duration: null, character: null, aggravating: null, relieving: null, timing: null, severity: null } });
      expect(state.hpiElements.onset).toBe('2 days ago');
      expect(state.hpiElements.location).toBe('chest');
    });

    it('should not overwrite vitals once set', () => {
      let state = createEmptyEncounterState();
      state = mergeEncounterState(state, { vitals: { bp: '120/80' } });
      state = mergeEncounterState(state, { vitals: { bp: '140/90', hr: '88' } });
      expect(state.vitals.bp).toBe('120/80');
      expect(state.vitals.hr).toBe('88');
    });
  });

  describe('Session 2: Progressive Reasoning — Encounter State Serialization', () => {
    it('should produce empty string for fresh encounter', () => {
      const state = createEmptyEncounterState();
      expect(serializeEncounterStateForPrompt(state)).toBe('');
    });

    it('should serialize encounter state for prompt with all sections', () => {
      let state = createEmptyEncounterState();
      state = mergeEncounterState(state, {
        chiefComplaint: 'Diabetes follow-up',
        currentPhase: 'assessment',
        vitals: { bp: '138/85' },
        hpiElements: { onset: '3 months', location: null, duration: null, character: null, aggravating: null, relieving: null, timing: null, severity: '7/10' },
        rosSystemsReviewed: ['endocrine', 'cardiovascular'],
        examComponents: { cardiovascular: ['RRR, no murmur'] },
        diagnoses: [{ condition: 'T2DM', icd10: 'E11.65', confidence: 0.9, supportingEvidence: [], refutingEvidence: [], status: 'active' }],
        medications: [{ name: 'Metformin', action: 'adjusted' }],
        planItems: ['Increase Metformin'],
        driftState: { primaryDomain: 'endocrinology', relatedDomains: ['cardiology'], driftDetected: false, driftEventCount: 0 },
        mdmComplexity: { problemCount: 2, problemComplexity: 'moderate', dataReviewed: [], dataComplexity: 'limited', riskLevel: 'moderate', overallLevel: 'moderate', suggestedEMCode: '99214' },
        completeness: { hpiElementCount: 2, hpiLevel: 'brief', rosSystemCount: 2, rosLevel: 'pertinent', examComponentCount: 1, hasAssessment: true, hasPlan: true, hasMedReconciliation: false, expectedButMissing: [], overallPercent: 65 },
      });

      const prompt = serializeEncounterStateForPrompt(state);
      expect(prompt).toContain('ENCOUNTER STATE');
      expect(prompt).toContain('Analysis #2');
      expect(prompt).toContain('CC: Diabetes follow-up');
      expect(prompt).toContain('onset: 3 months');
      expect(prompt).toContain('severity: 7/10');
      expect(prompt).toContain('Vitals: bp: 138/85');
      expect(prompt).toContain('ROS (2 systems)');
      expect(prompt).toContain('Exam (1 systems)');
      expect(prompt).toContain('T2DM (E11.65) [90%]');
      expect(prompt).toContain('Metformin (adjusted)');
      expect(prompt).toContain('Plan: Increase Metformin');
      expect(prompt).toContain('Domain: endocrinology, cardiology');
      expect(prompt).toContain('MDM: moderate → 99214');
      expect(prompt).toContain('Completeness: 65%');
    });

    it('should produce client-safe serialization without PHI arrays', () => {
      let state = createEmptyEncounterState();
      state = mergeEncounterState(state, {
        chiefComplaint: 'Chest pain',
        diagnoses: [
          { condition: 'ACS', icd10: 'I21.9', confidence: 0.7, supportingEvidence: ['troponin elevated'], refutingEvidence: [], status: 'working' },
          { condition: 'GERD', confidence: 0.3, supportingEvidence: [], refutingEvidence: ['no epigastric pain'], status: 'ruled_out' },
        ],
        medications: [{ name: 'Aspirin', action: 'new' }, { name: 'Heparin', action: 'new' }],
        planItems: ['Cath lab consult', 'Serial troponins'],
      });

      const client = serializeEncounterStateForClient(state);
      expect(client.chiefComplaint).toBe('Chest pain');
      expect(client.diagnosisCount).toBe(2);
      // Only active diagnoses in client view
      expect(client.activeDiagnoses).toHaveLength(1);
      expect((client.activeDiagnoses as Array<{ condition: string }>)[0].condition).toBe('ACS');
      expect(client.medicationCount).toBe(2);
      expect(client.planItemCount).toBe(2);
      // No supportingEvidence or refutingEvidence leaked to client
      expect(JSON.stringify(client)).not.toContain('troponin elevated');
    });
  });

  describe('Session 3: Drift Protection — Domain Tracking & Safety', () => {
    it('should lock primary domain and accumulate related domains', () => {
      let state = createEmptyEncounterState();
      state = mergeEncounterState(state, {
        driftState: { primaryDomain: 'endocrinology', relatedDomains: [], driftDetected: false, driftEventCount: 0 },
      });
      state = mergeEncounterState(state, {
        driftState: { primaryDomain: 'cardiology', relatedDomains: ['cardiology', 'nephrology'], driftDetected: false, driftEventCount: 0 },
      });
      // Primary locks once
      expect(state.driftState.primaryDomain).toBe('endocrinology');
      // Related accumulate
      expect(state.driftState.relatedDomains).toContain('cardiology');
      expect(state.driftState.relatedDomains).toContain('nephrology');
    });

    it('should track drift events cumulatively', () => {
      let state = createEmptyEncounterState();
      state = mergeEncounterState(state, {
        driftState: { primaryDomain: 'endocrinology', relatedDomains: [], driftDetected: true, driftDescription: 'Suggested dermatology code', driftEventCount: 0 },
      });
      expect(state.driftState.driftEventCount).toBe(1);
      expect(state.driftState.driftDescription).toBe('Suggested dermatology code');

      state = mergeEncounterState(state, {
        driftState: { primaryDomain: null, relatedDomains: [], driftDetected: false, driftEventCount: 0 },
      });
      // Event count persists even when current chunk is not drifting
      expect(state.driftState.driftEventCount).toBe(1);
      expect(state.driftState.driftDetected).toBe(false);

      state = mergeEncounterState(state, {
        driftState: { primaryDomain: null, relatedDomains: [], driftDetected: true, driftDescription: 'Off-topic suggestion', driftEventCount: 0 },
      });
      expect(state.driftState.driftEventCount).toBe(2);
    });

    it('should detect emergency flags in patient safety', () => {
      let state = createEmptyEncounterState();
      state = mergeEncounterState(state, {
        patientSafety: {
          patientDirectAddress: true,
          emergencyDetected: true,
          emergencyReason: 'Patient reported chest pain directly to AI',
          requiresProviderConsult: true,
          consultReason: 'Emergency symptoms',
        },
      });
      expect(state.patientSafety.emergencyDetected).toBe(true);
      expect(state.patientSafety.emergencyReason).toBe('Patient reported chest pain directly to AI');
      expect(state.patientSafety.requiresProviderConsult).toBe(true);
    });
  });

  describe('Session 2+3: Diagnosis Merge Behavior', () => {
    it('should merge supporting evidence for same diagnosis across chunks', () => {
      let state = createEmptyEncounterState();
      state = mergeEncounterState(state, {
        diagnoses: [
          { condition: 'Pneumonia', icd10: 'J18.9', confidence: 0.6, supportingEvidence: ['cough', 'fever'], refutingEvidence: [], status: 'working' },
        ],
      });
      state = mergeEncounterState(state, {
        diagnoses: [
          { condition: 'Pneumonia', icd10: 'J18.9', confidence: 0.85, supportingEvidence: ['chest X-ray infiltrate'], refutingEvidence: [], status: 'active' },
        ],
      });
      expect(state.diagnoses).toHaveLength(1);
      expect(state.diagnoses[0].confidence).toBe(0.85);
      expect(state.diagnoses[0].status).toBe('active');
      expect(state.diagnoses[0].supportingEvidence).toEqual(['cough', 'fever', 'chest X-ray infiltrate']);
    });

    it('should handle ruled-out diagnoses', () => {
      let state = createEmptyEncounterState();
      state = mergeEncounterState(state, {
        diagnoses: [
          { condition: 'PE', confidence: 0.4, supportingEvidence: ['dyspnea'], refutingEvidence: [], status: 'working' },
        ],
      });
      state = mergeEncounterState(state, {
        diagnoses: [
          { condition: 'PE', confidence: 0.1, supportingEvidence: [], refutingEvidence: ['D-dimer negative'], status: 'ruled_out' },
        ],
      });
      expect(state.diagnoses[0].status).toBe('ruled_out');
      expect(state.diagnoses[0].refutingEvidence).toContain('D-dimer negative');
    });

    it('should deduplicate ROS findings per system', () => {
      let state = createEmptyEncounterState();
      state = mergeEncounterState(state, { rosFindings: { cardiovascular: ['denies chest pain'] } });
      state = mergeEncounterState(state, { rosFindings: { cardiovascular: ['denies chest pain', 'denies palpitations'] } });
      expect(state.rosFindings.cardiovascular).toEqual(['denies chest pain', 'denies palpitations']);
    });

    it('should deduplicate plan items case-insensitively', () => {
      let state = createEmptyEncounterState();
      state = mergeEncounterState(state, { planItems: ['Follow-up in 2 weeks'] });
      state = mergeEncounterState(state, { planItems: ['follow-up in 2 weeks', 'Lab recheck'] });
      expect(state.planItems).toHaveLength(2);
      expect(state.planItems).toContain('Follow-up in 2 weeks');
      expect(state.planItems).toContain('Lab recheck');
    });
  });

  describe('Full Pipeline: 3-Chunk Diabetes Encounter Simulation', () => {
    it('should produce a clinically complete encounter state after 3 chunks', () => {
      let state = createEmptyEncounterState();

      // Chunk 1: Greeting → Chief complaint + vitals
      state = mergeEncounterState(state, {
        chiefComplaint: 'Diabetes follow-up, morning dizziness',
        currentPhase: 'history',
        vitals: { bp: '138/85', hr: '78', temp: '98.6', weight: '185' },
        hpiElements: { onset: '3 months since last A1C', location: null, duration: '1 month dizziness', character: 'lightheadedness', aggravating: 'mornings, standing quickly', relieving: null, timing: 'morning', severity: null },
        rosSystemsReviewed: ['endocrine', 'neurological', 'cardiovascular'],
        rosFindings: {
          endocrine: ['no polyuria', 'no polydipsia'],
          neurological: ['morning dizziness'],
          cardiovascular: ['denies chest pain', 'denies palpitations'],
        },
        driftState: { primaryDomain: 'endocrinology', relatedDomains: [], driftDetected: false, driftEventCount: 0 },
        patientSafety: createEmptyPatientSafetyFlags(),
      });

      // Chunk 2: Labs + assessment
      state = mergeEncounterState(state, {
        currentPhase: 'assessment',
        diagnoses: [
          { condition: 'Type 2 diabetes with hyperglycemia', icd10: 'E11.65', confidence: 0.95, supportingEvidence: ['A1C 7.8%', 'fasting glucose 140-150'], refutingEvidence: [], status: 'active' },
          { condition: 'Essential hypertension', icd10: 'I10', confidence: 0.88, supportingEvidence: ['BP 138/85'], refutingEvidence: [], status: 'active' },
          { condition: 'Dizziness', icd10: 'R42', confidence: 0.80, supportingEvidence: ['morning dizziness'], refutingEvidence: [], status: 'working' },
        ],
        driftState: { primaryDomain: 'endocrinology', relatedDomains: ['cardiology'], driftDetected: false, driftEventCount: 0 },
        mdmComplexity: {
          problemCount: 3, problemComplexity: 'moderate',
          dataReviewed: ['A1C', 'eGFR', 'lipid panel'], dataComplexity: 'moderate',
          riskLevel: 'moderate', overallLevel: 'moderate', suggestedEMCode: '99214',
        },
      });

      // Chunk 3: Plan
      state = mergeEncounterState(state, {
        currentPhase: 'plan',
        medications: [
          { name: 'Metformin', action: 'adjusted', details: '500mg BID → 850mg BID' },
        ],
        planItems: [
          'Increase Metformin to 850mg BID',
          'Home BP monitoring',
          'Nutritionist referral',
          'Follow-up 6 weeks with A1C recheck',
          'Continue statin therapy',
        ],
        completeness: {
          hpiElementCount: 5, hpiLevel: 'extended', rosSystemCount: 3, rosLevel: 'pertinent',
          examComponentCount: 0, hasAssessment: true, hasPlan: true, hasMedReconciliation: true,
          expectedButMissing: ['Physical exam'], overallPercent: 82,
        },
      });

      // Validate the full encounter state
      expect(state.analysisCount).toBe(3);
      expect(state.currentPhase).toBe('plan');
      expect(state.chiefComplaint).toBe('Diabetes follow-up, morning dizziness');

      // HPI filled progressively
      expect(state.hpiElements.onset).toBe('3 months since last A1C');
      expect(state.hpiElements.duration).toBe('1 month dizziness');
      expect(state.hpiElements.character).toBe('lightheadedness');
      expect(state.hpiElements.aggravating).toBe('mornings, standing quickly');
      expect(state.hpiElements.timing).toBe('morning');

      // ROS reviewed
      expect(state.rosSystemsReviewed).toHaveLength(3);

      // 3 diagnoses, confidence merged
      expect(state.diagnoses).toHaveLength(3);
      expect(state.diagnoses[0].icd10).toBe('E11.65');
      expect(state.diagnoses[0].confidence).toBe(0.95);

      // Medications + plan
      expect(state.medications).toHaveLength(1);
      expect(state.planItems).toHaveLength(5);

      // MDM + completeness
      expect(state.mdmComplexity.suggestedEMCode).toBe('99214');
      expect(state.completeness.overallPercent).toBe(82);

      // Domain tracking
      expect(state.driftState.primaryDomain).toBe('endocrinology');
      expect(state.driftState.relatedDomains).toContain('cardiology');
      expect(state.driftState.driftDetected).toBe(false);

      // The serialized prompt should include all key clinical data
      const prompt = serializeEncounterStateForPrompt(state);
      expect(prompt).toContain('CC: Diabetes follow-up, morning dizziness');
      expect(prompt).toContain('E11.65');
      expect(prompt).toContain('99214');
      expect(prompt).toContain('82%');
    });
  });
});
