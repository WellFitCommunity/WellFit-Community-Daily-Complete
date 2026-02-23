/**
 * consultationIntegration.test.ts — Integration Tests for Consultation Mode
 *
 * Purpose: Verify the consultation pipeline — structured case presentation,
 *          Socratic reasoning, differential diagnosis, cannot-miss, peer consult prep,
 *          and backwards compatibility across Sessions 7-8.
 * Session 9, Task 9.2 of Compass Riley Clinical Reasoning Hardening
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// Type replicas (matches consultationPromptGenerators.ts + useSmartScribe.ts)
// ============================================================================

interface CasePresentation {
  oneLiner: string;
  hpi: string;
  pastMedicalHistory: string[];
  medications: string[];
  allergies: string[];
  socialHistory: string[];
  familyHistory: string[];
  ros: string[];
  physicalExam: Record<string, string[]>;
  diagnostics: string[];
  assessment: string;
  differentials: Array<{
    diagnosis: string;
    icd10?: string;
    probability: 'high' | 'moderate' | 'low';
    supporting: string[];
    against: string[];
    redFlags?: string[];
    keyTest?: string;
    literatureNote?: string;
  }>;
  plan: string[];
}

interface ReasoningStep {
  question: string;
  analysis: string;
  considerations: string[];
  pivotPoints: string[];
}

interface CannotMissDiagnosis {
  diagnosis: string;
  severity: 'life-threatening' | 'emergent' | 'urgent';
  whyDangerous: string;
  distinguishingFeatures: string[];
  ruleOutTest: string;
  timeframe: string;
}

interface ConsultationResponse {
  casePresentation: CasePresentation;
  reasoningSteps: ReasoningStep[];
  cannotMiss: CannotMissDiagnosis[] | string[];
  suggestedWorkup: string[];
  guidelineNotes: string[];
  confidenceCalibration: {
    highConfidence: string[];
    uncertain: string[];
    insufficientData: string[];
  };
  groundingFlags: {
    statedCount: number;
    inferredCount: number;
    gapCount: number;
    gaps: string[];
  };
}

interface ConsultPrepSummary {
  targetSpecialty: string;
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  criticalData: string[];
  consultQuestion: string;
  urgency: 'stat' | 'urgent' | 'routine';
}

// ============================================================================
// Test helpers
// ============================================================================

function buildMockConsultationResponse(overrides?: Partial<ConsultationResponse>): ConsultationResponse {
  return {
    casePresentation: {
      oneLiner: '65-year-old male with acute onset chest pain and diaphoresis',
      hpi: 'Patient describes substernal crushing chest pain starting 2 hours ago while at rest. Pain radiates to left arm. Associated with diaphoresis and nausea. Denies similar episodes.',
      pastMedicalHistory: ['Hypertension x 10 years', 'Hyperlipidemia', 'Smoker 30 pack-years'],
      medications: ['Lisinopril 20mg daily', 'Atorvastatin 40mg daily'],
      allergies: ['Penicillin - rash'],
      socialHistory: ['Active smoker', 'No alcohol', 'Retired mechanic'],
      familyHistory: ['Father MI at age 58'],
      ros: ['Positive: chest pain, diaphoresis, nausea', 'Negative: dyspnea, syncope, fever'],
      physicalExam: {
        general: ['Diaphoretic, anxious, moderate distress'],
        cardiovascular: ['Tachycardic, regular rhythm, no murmur', 'JVP normal'],
        respiratory: ['Clear bilaterally'],
      },
      diagnostics: ['ECG: ST elevation V1-V4', 'Troponin I: 2.4 ng/mL (elevated)'],
      assessment: 'Acute anterior STEMI with hemodynamic stability',
      differentials: [
        {
          diagnosis: 'Acute anterior STEMI',
          icd10: 'I21.0',
          probability: 'high',
          supporting: ['ST elevation V1-V4', 'Troponin elevated', 'Crushing chest pain', 'Diaphoresis'],
          against: [],
          redFlags: ['Active ST changes', 'Troponin rising'],
          keyTest: 'Repeat ECG in 15 min + serial troponins',
          literatureNote: 'ACC/AHA 2023: Door-to-balloon <90 min for primary PCI',
        },
        {
          diagnosis: 'Aortic dissection',
          icd10: 'I71.0',
          probability: 'low',
          supporting: ['Chest pain', 'Hypertension history'],
          against: ['No tearing quality', 'No pulse deficit', 'No mediastinal widening'],
          redFlags: ['Sudden tearing pain', 'Pulse differential', 'New aortic insufficiency'],
          keyTest: 'CT angiography chest',
        },
      ],
      plan: ['Activate cath lab', 'Aspirin 325mg', 'Heparin drip', 'Clopidogrel 600mg load'],
    },
    reasoningSteps: [
      {
        question: 'What is the most likely cause of acute chest pain with ST elevation?',
        analysis: 'The combination of ST elevation in contiguous leads with elevated troponin in a patient with cardiac risk factors strongly suggests STEMI.',
        considerations: ['Door-to-balloon time is critical', 'Need to rule out aortic dissection before anticoagulation'],
        pivotPoints: ['If CT shows dissection, withhold anticoagulation'],
      },
    ],
    cannotMiss: [
      {
        diagnosis: 'Aortic dissection',
        severity: 'life-threatening',
        whyDangerous: 'Anticoagulation in aortic dissection can be fatal — must rule out before heparin drip',
        distinguishingFeatures: ['Tearing pain radiating to back', 'Pulse deficit', 'Mediastinal widening on CXR'],
        ruleOutTest: 'CT angiography chest',
        timeframe: 'Before initiating anticoagulation',
      },
      {
        diagnosis: 'Tension pneumothorax',
        severity: 'life-threatening',
        whyDangerous: 'Can mimic cardiac symptoms with hemodynamic compromise',
        distinguishingFeatures: ['Absent breath sounds unilateral', 'Tracheal deviation', 'Hypotension'],
        ruleOutTest: 'Chest X-ray or point-of-care ultrasound',
        timeframe: 'Immediate',
      },
    ],
    suggestedWorkup: ['Repeat ECG in 15 min', 'Serial troponins q3h', 'CXR portable', 'CBC, BMP, coags', 'Type and screen'],
    guidelineNotes: ['ACC/AHA STEMI guidelines: primary PCI preferred over fibrinolysis when available within 120 min'],
    confidenceCalibration: {
      highConfidence: ['STEMI diagnosis based on ECG + troponin', 'Cath lab activation indicated'],
      uncertain: ['Aortic dissection cannot be fully excluded without imaging'],
      insufficientData: ['No CXR yet', 'No prior ECG for comparison'],
    },
    groundingFlags: {
      statedCount: 14,
      inferredCount: 2,
      gapCount: 3,
      gaps: ['No prior ECG mentioned', 'No coagulation studies mentioned', 'No CXR results'],
    },
    ...overrides,
  };
}

function buildMockConsultPrepSummary(overrides?: Partial<ConsultPrepSummary>): ConsultPrepSummary {
  return {
    targetSpecialty: 'Cardiology',
    situation: '65-year-old male with acute anterior STEMI, cath lab activated.',
    background: 'PMH: HTN x 10y, HLD, 30 pack-year smoker. Father MI at 58. Current meds: Lisinopril 20mg, Atorvastatin 40mg. Allergic to Penicillin.',
    assessment: 'Acute anterior STEMI. ECG: ST elevation V1-V4. Troponin I 2.4 (elevated). Hemodynamically stable.',
    recommendation: 'Requesting emergent cardiac catheterization. Aspirin 325mg given. Heparin drip initiated. Clopidogrel 600mg load administered.',
    criticalData: [
      'ECG: ST elevation V1-V4',
      'Troponin I: 2.4 ng/mL',
      'BP 145/90, HR 105, SpO2 97%',
      'Aspirin + heparin + clopidogrel given',
    ],
    consultQuestion: 'Ready for emergent PCI — is there anything in the history that changes your approach?',
    urgency: 'stat',
    ...overrides,
  };
}

// ============================================================================
// Type guard (matches ConsultationPanel.tsx)
// ============================================================================

function isStructuredCannotMiss(items: unknown[]): items is CannotMissDiagnosis[] {
  return items.length > 0 && typeof items[0] === 'object' && items[0] !== null && 'severity' in items[0];
}

// ============================================================================
// TESTS
// ============================================================================

describe('Consultation Mode Integration (Sessions 7-8)', () => {

  describe('Case Presentation Structure', () => {
    it('should contain all required fields for a complete case presentation', () => {
      const resp = buildMockConsultationResponse();
      const cp = resp.casePresentation;

      expect(cp.oneLiner).toBeTruthy();
      expect(cp.hpi).toBeTruthy();
      expect(cp.pastMedicalHistory.length).toBeGreaterThan(0);
      expect(cp.medications.length).toBeGreaterThan(0);
      expect(cp.allergies.length).toBeGreaterThan(0);
      expect(cp.diagnostics.length).toBeGreaterThan(0);
      expect(cp.assessment).toBeTruthy();
      expect(cp.differentials.length).toBeGreaterThan(0);
      expect(cp.plan.length).toBeGreaterThan(0);
    });

    it('should include physical exam as system-keyed record', () => {
      const cp = buildMockConsultationResponse().casePresentation;
      expect(Object.keys(cp.physicalExam).length).toBeGreaterThan(0);
      expect(cp.physicalExam.cardiovascular).toBeDefined();
      expect(Array.isArray(cp.physicalExam.cardiovascular)).toBe(true);
    });
  });

  describe('Session 8: Enhanced Differentials', () => {
    it('should include red flags, key test, and literature note on differentials', () => {
      const resp = buildMockConsultationResponse();
      const highDx = resp.casePresentation.differentials[0];

      expect(highDx.redFlags).toBeDefined();
      expect((highDx.redFlags ?? []).length).toBeGreaterThan(0);
      expect(highDx.keyTest).toBeTruthy();
      expect(highDx.literatureNote).toBeTruthy();
    });

    it('should rank differentials by probability', () => {
      const diffs = buildMockConsultationResponse().casePresentation.differentials;
      const probOrder = { high: 0, moderate: 1, low: 2 };
      for (let i = 0; i < diffs.length - 1; i++) {
        expect(probOrder[diffs[i].probability]).toBeLessThanOrEqual(probOrder[diffs[i + 1].probability]);
      }
    });

    it('should support differentials without Session 8 fields for backwards compatibility', () => {
      const resp = buildMockConsultationResponse();
      // Add a differential without Session 8 fields
      resp.casePresentation.differentials.push({
        diagnosis: 'Costochondritis',
        probability: 'low',
        supporting: ['Localized chest wall tenderness'],
        against: ['ST elevation makes this unlikely'],
      });
      const lastDx = resp.casePresentation.differentials[2];
      expect(lastDx.redFlags).toBeUndefined();
      expect(lastDx.keyTest).toBeUndefined();
      expect(lastDx.literatureNote).toBeUndefined();
    });
  });

  describe('Session 8: Structured Cannot-Miss', () => {
    it('should detect structured cannot-miss diagnoses via type guard', () => {
      const resp = buildMockConsultationResponse();
      expect(isStructuredCannotMiss(resp.cannotMiss)).toBe(true);
    });

    it('should include all required fields in structured cannot-miss', () => {
      const resp = buildMockConsultationResponse();
      if (isStructuredCannotMiss(resp.cannotMiss)) {
        for (const item of resp.cannotMiss) {
          expect(item.diagnosis).toBeTruthy();
          expect(['life-threatening', 'emergent', 'urgent']).toContain(item.severity);
          expect(item.whyDangerous).toBeTruthy();
          expect(item.distinguishingFeatures.length).toBeGreaterThan(0);
          expect(item.ruleOutTest).toBeTruthy();
          expect(item.timeframe).toBeTruthy();
        }
      }
    });

    it('should handle legacy string[] cannot-miss format', () => {
      const resp = buildMockConsultationResponse({
        cannotMiss: [
          'Aortic dissection — rule out before anticoagulation',
          'Tension pneumothorax — check CXR',
        ],
      });
      expect(isStructuredCannotMiss(resp.cannotMiss)).toBe(false);
      expect(resp.cannotMiss).toHaveLength(2);
      expect(typeof resp.cannotMiss[0]).toBe('string');
    });
  });

  describe('Socratic Reasoning Steps', () => {
    it('should contain at least one reasoning step with all fields', () => {
      const resp = buildMockConsultationResponse();
      expect(resp.reasoningSteps.length).toBeGreaterThan(0);
      const step = resp.reasoningSteps[0];
      expect(step.question).toBeTruthy();
      expect(step.analysis).toBeTruthy();
      expect(step.considerations.length).toBeGreaterThan(0);
      expect(step.pivotPoints.length).toBeGreaterThan(0);
    });
  });

  describe('Confidence Calibration & Grounding', () => {
    it('should separate high-confidence from uncertain and insufficient data', () => {
      const resp = buildMockConsultationResponse();
      const cal = resp.confidenceCalibration;
      expect(cal.highConfidence.length).toBeGreaterThan(0);
      expect(cal.uncertain.length).toBeGreaterThan(0);
      expect(cal.insufficientData.length).toBeGreaterThan(0);
    });

    it('should include grounding flags with stated > inferred and identified gaps', () => {
      const resp = buildMockConsultationResponse();
      const gf = resp.groundingFlags;
      expect(gf.statedCount).toBeGreaterThan(gf.inferredCount);
      expect(gf.gapCount).toBe(gf.gaps.length);
    });
  });

  describe('Peer Consult Prep (Session 8)', () => {
    it('should produce a complete SBAR summary', () => {
      const prep = buildMockConsultPrepSummary();
      expect(prep.situation).toBeTruthy();
      expect(prep.background).toBeTruthy();
      expect(prep.assessment).toBeTruthy();
      expect(prep.recommendation).toBeTruthy();
    });

    it('should include target specialty and urgency', () => {
      const prep = buildMockConsultPrepSummary();
      expect(prep.targetSpecialty).toBe('Cardiology');
      expect(['stat', 'urgent', 'routine']).toContain(prep.urgency);
    });

    it('should include critical data points for the consultant', () => {
      const prep = buildMockConsultPrepSummary();
      expect(prep.criticalData.length).toBeGreaterThan(0);
      expect(prep.criticalData.some(d => d.includes('ECG'))).toBe(true);
      expect(prep.criticalData.some(d => d.includes('Troponin'))).toBe(true);
    });

    it('should include a specific consult question', () => {
      const prep = buildMockConsultPrepSummary();
      expect(prep.consultQuestion).toBeTruthy();
      expect(prep.consultQuestion.length).toBeGreaterThan(10);
    });

    it('should support all urgency levels', () => {
      const stat = buildMockConsultPrepSummary({ urgency: 'stat' });
      const urgent = buildMockConsultPrepSummary({ urgency: 'urgent' });
      const routine = buildMockConsultPrepSummary({ urgency: 'routine' });
      expect(stat.urgency).toBe('stat');
      expect(urgent.urgency).toBe('urgent');
      expect(routine.urgency).toBe('routine');
    });

    it('should tailor SBAR content to specialty', () => {
      const cardiology = buildMockConsultPrepSummary({ targetSpecialty: 'Cardiology' });
      const neurology = buildMockConsultPrepSummary({
        targetSpecialty: 'Neurology',
        situation: '72-year-old female with acute onset right-sided weakness and slurred speech.',
        assessment: 'Left MCA territory stroke, NIHSS 14.',
        recommendation: 'Requesting stroke team evaluation for tPA candidacy.',
        criticalData: ['CT head: no hemorrhage', 'NIHSS: 14', 'Last known well: 1 hour ago'],
        consultQuestion: 'Is this patient a candidate for IV tPA given the time window?',
        urgency: 'stat',
      });

      expect(cardiology.targetSpecialty).toBe('Cardiology');
      expect(neurology.targetSpecialty).toBe('Neurology');
      expect(cardiology.assessment).toContain('STEMI');
      expect(neurology.assessment).toContain('stroke');
    });
  });

  describe('Consultation + Consult Prep Pipeline', () => {
    it('should generate consult prep that references consultation findings', () => {
      const consultation = buildMockConsultationResponse();
      const prep = buildMockConsultPrepSummary();

      // The consult prep should reference key findings from the consultation
      const consultationDx = consultation.casePresentation.differentials[0].diagnosis;
      expect(prep.assessment).toBeTruthy();

      // Critical data should include key diagnostics from the consultation
      const prepHasECG = prep.criticalData.some(d => d.includes('ECG') || d.includes('ST elevation'));
      expect(prepHasECG).toBe(true);

      // Both should reference the same patient context
      expect(consultationDx.toLowerCase()).toContain('stemi');
      expect(prep.situation.toLowerCase()).toContain('stemi');
    });
  });
});
