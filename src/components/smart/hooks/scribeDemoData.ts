/**
 * scribeDemoData.ts — Demo mode data fixtures for SmartScribe
 *
 * Static demo data simulating a diabetes follow-up encounter.
 * Activated when VITE_COMPASS_DEMO=true or forceDemoMode prop is set.
 * Covers all Sessions 1-8 of Compass Riley Clinical Reasoning.
 *
 * Extracted from useSmartScribe.ts for modularity.
 */

import type {
  CodeSuggestion,
  GroundingFlags,
  EncounterStateSummary,
  EvidenceSearchResultSummary,
  GuidelineMatchSummary,
  TreatmentPathwaySummary,
  ConsultationResponseSummary,
  ConsultPrepSummary,
  SOAPNote,
} from './useSmartScribe.types';

// ============================================================================
// DEMO TRANSCRIPT
// ============================================================================

export const DEMO_TRANSCRIPT = `Good morning Mrs. Johnson. I see you're here for your diabetes follow-up. How have you been feeling since our last visit?

Patient reports feeling generally well but mentions occasional dizziness in the mornings. She's been checking her blood sugar regularly, fasting glucose around 140 to 150. She admits she hasn't been as consistent with her diet over the holidays.

Let me check your vitals. Blood pressure is 138 over 85, pulse 78, temperature 98.6. Weight is 185 pounds, which is up 3 pounds from last visit.

Looking at your labs from last week, your A1C is 7.8, up from 7.2 three months ago. Kidney function looks stable, eGFR 72. Lipid panel shows LDL at 118.

Based on today's visit, I think we need to adjust your Metformin. I'd like to increase it from 500 twice daily to 850 twice daily. Let's also add a morning blood pressure check routine. I want you to keep a log and bring it to your next visit.

We'll schedule a follow-up in 6 weeks. In the meantime, I'd like you to meet with our nutritionist to review your diet plan. Any questions?`;

// ============================================================================
// DEMO BILLING CODES
// ============================================================================

export const DEMO_CODES: CodeSuggestion[] = [
  {
    code: '99214',
    type: 'CPT',
    description: 'Office visit, established patient, moderate complexity (30-39 min)',
    reimbursement: 164.00,
    confidence: 0.94,
    reasoning: 'Moderate complexity MDM with chronic condition management, medication adjustment, and coordination of care',
    missingDocumentation: 'Consider documenting time spent if >50% on counseling'
  },
  {
    code: 'E11.65',
    type: 'ICD10',
    description: 'Type 2 diabetes mellitus with hyperglycemia',
    reimbursement: 0,
    confidence: 0.96,
    reasoning: 'A1C 7.8% indicates poor glycemic control, fasting glucose 140-150 mg/dL'
  },
  {
    code: 'I10',
    type: 'ICD10',
    description: 'Essential (primary) hypertension',
    reimbursement: 0,
    confidence: 0.88,
    reasoning: 'BP 138/85 indicates elevated blood pressure requiring monitoring'
  },
  {
    code: 'R42',
    type: 'ICD10',
    description: 'Dizziness and giddiness',
    reimbursement: 0,
    confidence: 0.82,
    reasoning: 'Patient reports morning dizziness, possibly related to BP or glucose'
  },
  {
    code: 'Z71.3',
    type: 'ICD10',
    description: 'Dietary counseling and surveillance',
    reimbursement: 0,
    confidence: 0.90,
    reasoning: 'Nutritionist referral for diet plan review'
  }
];

// ============================================================================
// DEMO SOAP NOTE
// ============================================================================

export const DEMO_SOAP: SOAPNote = {
  subjective: 'Patient presents for diabetes follow-up. Reports feeling generally well with occasional morning dizziness. Self-monitoring blood glucose shows fasting levels 140-150 mg/dL. Admits to dietary non-compliance over holidays. No polyuria, polydipsia, or vision changes.',
  objective: 'Vitals: BP 138/85, HR 78, Temp 98.6°F, Weight 185 lbs (+3 lbs from last visit). Labs: A1C 7.8% (up from 7.2%), eGFR 72 (stable), LDL 118 mg/dL. Patient appears well-nourished, no acute distress.',
  assessment: '1. Type 2 diabetes mellitus with hyperglycemia (E11.65) - suboptimally controlled, A1C worsening\n2. Essential hypertension (I10) - borderline elevated today\n3. Dizziness (R42) - likely related to glycemic variability',
  plan: '1. Increase Metformin from 500mg BID to 850mg BID\n2. Home BP monitoring - log readings for next visit\n3. Refer to nutritionist for dietary counseling\n4. Follow-up in 6 weeks with A1C recheck\n5. Continue current statin therapy',
  hpi: 'Mrs. Johnson is a 62-year-old female with established type 2 diabetes presenting for routine follow-up. She reports generally feeling well but describes intermittent morning dizziness over the past month. Home glucose monitoring shows fasting readings consistently between 140-150 mg/dL. She acknowledges dietary indiscretion during the holiday season. Denies hypoglycemic episodes, chest pain, shortness of breath, or changes in vision. Currently taking Metformin 500mg twice daily and Lisinopril 10mg daily.',
  ros: 'Constitutional: Denies fever, chills, fatigue, unintentional weight loss. Cardiovascular: Denies chest pain, palpitations, leg swelling. Respiratory: Denies cough, shortness of breath. Neurological: Positive for morning dizziness, denies headache, numbness, tingling. Endocrine: Denies polyuria, polydipsia, heat/cold intolerance.'
};

// ============================================================================
// DEMO MESSAGES & SUGGESTIONS
// ============================================================================

export const DEMO_SUGGESTIONS = [
  'Consider documenting patient\'s medication adherence rate',
  'PHQ-2 screening may capture depression comorbidity for Z-code billing',
  'Document diabetic foot exam if performed for quality measure'
];

export const DEMO_MESSAGES = [
  "Hey! I'm Riley, your AI scribe. I'll be documenting this visit for you.",
  "I'm picking up on diabetes management discussion. Capturing A1C values and medication changes.",
  "Nice catch on the dizziness - I've added R42 to the assessment.",
  "Looks like a solid 99214 visit. I've captured the medication adjustment and referral."
];

// ============================================================================
// SESSION 1: GROUNDING FLAGS
// ============================================================================

export const DEMO_GROUNDING_FLAGS: GroundingFlags = {
  statedCount: 12,
  inferredCount: 2,
  gapCount: 1,
  gaps: ['Allergies not explicitly reviewed in transcript'],
};

// ============================================================================
// SESSION 2: ENCOUNTER STATE
// ============================================================================

export const DEMO_ENCOUNTER_STATE: EncounterStateSummary = {
  currentPhase: 'plan',
  analysisCount: 3,
  chiefComplaint: 'Diabetes follow-up, morning dizziness',
  diagnosisCount: 3,
  activeDiagnoses: [
    { condition: 'Type 2 diabetes with hyperglycemia', icd10: 'E11.65', confidence: 0.95 },
    { condition: 'Essential hypertension', icd10: 'I10', confidence: 0.88 },
    { condition: 'Dizziness', icd10: 'R42', confidence: 0.80 },
  ],
  mdmComplexity: {
    overallLevel: 'moderate',
    suggestedEMCode: '99214',
    nextLevelGap: 'Document independent interpretation of test results for 99215',
  },
  completeness: {
    overallPercent: 82,
    hpiLevel: 'extended',
    rosLevel: 'pertinent',
    expectedButMissing: ['Physical exam documentation'],
  },
  medicationCount: 1,
  planItemCount: 5,
  driftState: {
    primaryDomain: 'endocrinology',
    relatedDomains: ['cardiology'],
    driftDetected: false,
    driftDescription: null,
  },
  patientSafety: {
    patientDirectAddress: false,
    emergencyDetected: false,
    emergencyReason: null,
    requiresProviderConsult: false,
    consultReason: null,
  },
};

// ============================================================================
// SESSION 4: EVIDENCE CITATIONS
// ============================================================================

export const DEMO_EVIDENCE_CITATIONS: EvidenceSearchResultSummary[] = [
  {
    query: 'Type 2 diabetes A1C management',
    trigger: 'low_confidence_diagnosis',
    triggerDetail: 'Active diagnosis with A1C above target',
    citations: [
      {
        pmid: '30291106',
        title: 'Pharmacologic Approaches to Glycemic Treatment: Standards of Care in Diabetes—2024',
        authors: ['American Diabetes Association Professional Practice Committee'],
        journal: 'Diabetes Care',
        year: '2024',
        doi: '10.2337/dc24-S009',
        relevanceNote: 'ADA recommends intensifying therapy when A1C >7.0% — supports Metformin dose increase',
      },
    ],
    searchTimeMs: 450,
  },
];

// ============================================================================
// SESSION 5: GUIDELINE REFERENCES
// ============================================================================

export const DEMO_GUIDELINE_REFERENCES: GuidelineMatchSummary[] = [
  {
    condition: 'Type 2 diabetes',
    icd10: 'E11.65',
    guidelines: [
      {
        organization: 'ADA',
        guidelineName: 'Standards of Care in Diabetes',
        year: 2024,
        keyRecommendations: [
          'A1C target <7.0% for most adults',
          'Metformin as first-line therapy',
          'Consider GLP-1 RA or SGLT2i for cardiovascular benefit',
        ],
        monitoringTargets: [
          { metric: 'A1C', target: '<7.0%', frequency: 'Every 3 months until stable' },
          { metric: 'eGFR', target: '>60 mL/min', frequency: 'Annually' },
        ],
        adherenceChecklist: [
          'A1C checked within 3 months',
          'Foot exam annually',
          'Eye exam annually',
          'Lipid panel annually',
        ],
      },
    ],
    adherenceFlags: ['A1C 7.8% above target — therapy intensification appropriate'],
    preventiveCareReminders: ['Due for annual diabetic foot exam', 'Due for annual eye exam referral'],
  },
];

// ============================================================================
// SESSION 6: TREATMENT PATHWAYS
// ============================================================================

export const DEMO_TREATMENT_PATHWAYS: TreatmentPathwaySummary[] = [
  {
    condition: 'Type 2 diabetes',
    icd10: 'E11.65',
    pathway: {
      condition: 'Type 2 diabetes mellitus',
      treatmentGoal: 'A1C <7.0%, prevent micro/macrovascular complications',
      steps: [
        {
          phase: 'First-line',
          intervention: 'Metformin + lifestyle modifications',
          medicationClass: 'Biguanide',
          examples: ['Metformin 500-2000mg daily'],
          evidenceLevel: 'A',
          guidelineSource: 'ADA 2024',
          contraindications: ['eGFR <30', 'Active liver disease'],
          sdohNote: 'Generic available at $4/month — cost-friendly',
        },
        {
          phase: 'Second-line (if A1C >7% on metformin)',
          intervention: 'Add GLP-1 receptor agonist or SGLT2 inhibitor',
          medicationClass: 'GLP-1 RA / SGLT2i',
          examples: ['Semaglutide', 'Empagliflozin'],
          evidenceLevel: 'A',
          guidelineSource: 'ADA 2024',
          contraindications: ['GLP-1: pancreatitis history', 'SGLT2i: recurrent UTI'],
          sdohNote: 'Brand-name medications — check insurance coverage, manufacturer coupons available',
        },
      ],
      redFlags: ['Hypoglycemia symptoms', 'Lactic acidosis signs (with metformin)', 'DKA risk if on SGLT2i'],
      lifestyleRecommendations: ['150 min/week moderate exercise', 'Medical nutrition therapy', 'Weight management'],
    },
  },
];

// ============================================================================
// SESSIONS 7-8: CONSULTATION MODE
// ============================================================================

export const DEMO_CONSULTATION_RESPONSE: ConsultationResponseSummary = {
  casePresentation: {
    oneLiner: '62-year-old female with T2DM presenting for follow-up with worsening glycemic control and new morning dizziness',
    hpi: 'Mrs. Johnson presents for routine diabetes follow-up. A1C has risen from 7.2% to 7.8% over 3 months. Reports morning dizziness for past month. Fasting glucose 140-150. Admits dietary non-compliance during holidays.',
    pastMedicalHistory: ['Type 2 diabetes x 5 years', 'Hypertension'],
    medications: ['Metformin 500mg BID', 'Lisinopril 10mg daily'],
    allergies: ['No known drug allergies'],
    socialHistory: ['Non-smoker', 'Sedentary lifestyle'],
    familyHistory: ['Mother: T2DM'],
    ros: ['Positive: morning dizziness', 'Negative: polyuria, polydipsia, vision changes, chest pain'],
    physicalExam: { general: ['Well-nourished, NAD'], cardiovascular: ['RRR, no murmur'] },
    diagnostics: ['A1C 7.8%', 'eGFR 72', 'LDL 118', 'BP 138/85'],
    assessment: 'T2DM with worsening control requiring therapy intensification. Morning dizziness likely orthostatic vs glycemic.',
    differentials: [
      {
        diagnosis: 'Orthostatic hypotension',
        probability: 'moderate' as const,
        supporting: ['Morning dizziness', 'On antihypertensive'],
        against: ['No documented orthostatic vitals'],
        redFlags: ['Syncope', 'Fall risk'],
        keyTest: 'Orthostatic vital signs',
      },
      {
        diagnosis: 'Hypoglycemia',
        probability: 'low' as const,
        supporting: ['On metformin', 'Morning timing'],
        against: ['Fasting glucose 140-150 (elevated, not low)', 'Metformin rarely causes hypoglycemia'],
        keyTest: 'Home glucose log during symptomatic episodes',
      },
    ],
    plan: ['Increase Metformin to 850mg BID', 'Home BP monitoring', 'Nutritionist referral', 'Follow-up 6 weeks'],
  },
  reasoningSteps: [
    {
      question: 'Why is A1C rising despite current metformin therapy?',
      analysis: 'Patient admits dietary non-compliance during holidays. Current dose (500mg BID) is submaximal — dose increase is appropriate before adding second agent.',
      considerations: ['Check medication adherence', 'Assess for secondary causes of hyperglycemia'],
      pivotPoints: ['If A1C still >7.5% at follow-up despite max metformin, consider adding GLP-1 RA'],
    },
  ],
  cannotMiss: [
    {
      diagnosis: 'Cardiac arrhythmia causing dizziness',
      severity: 'urgent' as const,
      whyDangerous: 'New dizziness in a patient with hypertension could indicate atrial fibrillation or other arrhythmia',
      distinguishingFeatures: ['Palpitations', 'Irregular pulse', 'Syncope'],
      ruleOutTest: 'ECG',
      timeframe: 'This visit or within 1 week',
    },
  ],
  suggestedWorkup: ['Orthostatic vital signs', 'ECG if dizziness persists', 'Fasting glucose log'],
  guidelineNotes: ['ADA 2024: Intensify therapy when A1C >7.0% — Metformin dose increase appropriate'],
  confidenceCalibration: {
    highConfidence: ['T2DM diagnosis', 'Metformin dose increase indicated'],
    uncertain: ['Cause of morning dizziness', 'Whether SGLT2i/GLP-1 RA needed now vs at follow-up'],
    insufficientData: ['Orthostatic vitals not measured', 'No ECG on file'],
  },
  groundingFlags: {
    statedCount: 10,
    inferredCount: 3,
    gapCount: 2,
    gaps: ['Orthostatic vitals not measured', 'No ECG documented'],
  },
};

// ============================================================================
// SESSION 8: PEER CONSULT PREP
// ============================================================================

export const DEMO_CONSULT_PREP: ConsultPrepSummary = {
  targetSpecialty: 'Endocrinology',
  situation: '62-year-old female with T2DM, A1C rising from 7.2% to 7.8% over 3 months despite metformin therapy.',
  background: 'PMH: T2DM x 5y, HTN. Current meds: Metformin 500mg BID (being increased to 850mg BID), Lisinopril 10mg. eGFR 72, LDL 118. Admitted dietary non-compliance.',
  assessment: 'Worsening glycemic control. Currently intensifying metformin but may need second-line agent if A1C remains >7.5% at 6-week follow-up.',
  recommendation: 'Requesting guidance on second-line agent selection — GLP-1 RA vs SGLT2i given mild CKD (eGFR 72) and hypertension.',
  criticalData: [
    'A1C: 7.8% (up from 7.2%)',
    'eGFR: 72 mL/min',
    'BP: 138/85 on Lisinopril 10mg',
    'LDL: 118 mg/dL',
    'BMI: 31 (calculated from 185 lbs)',
  ],
  consultQuestion: 'Given eGFR 72 and uncontrolled HTN, would you recommend SGLT2i (renal/cardiac benefit) over GLP-1 RA as second-line, or is a GLP-1 RA preferred for weight management?',
  urgency: 'routine',
};
