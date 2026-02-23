// Guideline Reference Engine — Real-Time Clinical Guideline Matching for Compass Riley
// Session 5 of Compass Riley Clinical Reasoning Hardening (2026-02-23)
//
// Lightweight, rule-based guideline matching from encounter state.
// No additional Claude API calls needed — pure ICD-10 prefix matching against
// a static guideline database. The full AI guideline matcher (ai-clinical-guideline-matcher)
// can be called separately for comprehensive analysis from the patient chart.

import type { EncounterState, DiagnosisEntry } from './encounterStateManager.ts';

// =====================================================
// Types
// =====================================================

/** A single monitoring target for a condition (e.g., HbA1c < 7.0%) */
export interface MonitoringTarget {
  metric: string;
  target: string;
  frequency: string;
}

/** A clinical guideline reference */
export interface GuidelineReference {
  organization: string;
  guidelineName: string;
  year: number;
  /** Top 3-5 actionable recommendations */
  keyRecommendations: string[];
  /** Monitoring targets with goals */
  monitoringTargets: MonitoringTarget[];
  /** Documentation items that should be addressed */
  adherenceChecklist: string[];
}

/** Result of matching a diagnosis to guidelines */
export interface GuidelineMatchResult {
  condition: string;
  icd10: string;
  guidelines: GuidelineReference[];
  /** What's missing from THIS encounter that guidelines recommend */
  adherenceFlags: string[];
  /** Preventive care reminders related to this condition */
  preventiveCareReminders: string[];
}

// =====================================================
// Guideline Database — Top 12 Conditions
// Mapped from the existing ai-clinical-guideline-matcher system
// =====================================================

interface GuidelineEntry {
  icd10Prefixes: string[];
  conditionKeywords: string[];
  guidelines: GuidelineReference[];
  preventiveCare: string[];
}

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
    icd10Prefixes: ['E78'],
    conditionKeywords: ['hyperlipidemia', 'high cholesterol', 'dyslipidemia', 'elevated ldl'],
    guidelines: [{
      organization: 'ACC/AHA',
      guidelineName: 'Guideline on Management of Blood Cholesterol',
      year: 2018,
      keyRecommendations: [
        'High-intensity statin for ASCVD or LDL ≥ 190',
        'Moderate-intensity statin for diabetes age 40-75',
        'Calculate 10-year ASCVD risk for primary prevention',
        'Lifestyle + dietary modifications for all',
        'Consider ezetimibe if LDL not at goal on max statin',
      ],
      monitoringTargets: [
        { metric: 'LDL cholesterol', target: '< 70 mg/dL (ASCVD) or < 100 (primary prevention)', frequency: 'Every 4-12 weeks after starting, then annually' },
        { metric: 'Liver function', target: 'Normal ALT/AST', frequency: 'Baseline, then PRN' },
      ],
      adherenceChecklist: [
        'Lipid panel reviewed',
        'Statin intensity appropriate for risk',
        'Muscle symptoms assessed',
        'Dietary counseling',
      ],
    }],
    preventiveCare: ['ASCVD risk calculator (Pooled Cohort Equations)'],
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
    icd10Prefixes: ['J44'],
    conditionKeywords: ['copd', 'chronic obstructive pulmonary', 'emphysema'],
    guidelines: [{
      organization: 'GOLD',
      guidelineName: 'Global Strategy for Diagnosis, Management, and Prevention of COPD',
      year: 2024,
      keyRecommendations: [
        'LABA + LAMA for Group B-E',
        'Add ICS if eosinophils ≥ 300 or frequent exacerbations',
        'Smoking cessation is #1 intervention',
        'Pulmonary rehabilitation for symptomatic patients',
        'Annual spirometry to track FEV1 decline',
      ],
      monitoringTargets: [
        { metric: 'FEV1', target: 'Track decline rate', frequency: 'Annually' },
        { metric: 'mMRC dyspnea score', target: '< 2', frequency: 'Every visit' },
        { metric: 'Exacerbation frequency', target: '< 2/year', frequency: 'Every visit' },
      ],
      adherenceChecklist: [
        'Inhaler technique reviewed',
        'Smoking status documented',
        'Oxygen requirement assessed',
        'Vaccination status current',
      ],
    }],
    preventiveCare: ['Annual influenza vaccine', 'Pneumococcal vaccine', 'COVID-19 vaccine'],
  },
  {
    icd10Prefixes: ['J45'],
    conditionKeywords: ['asthma'],
    guidelines: [{
      organization: 'GINA',
      guidelineName: 'Global Strategy for Asthma Management and Prevention',
      year: 2024,
      keyRecommendations: [
        'ICS-containing controller for all persistent asthma',
        'As-needed ICS-formoterol preferred over SABA alone',
        'Step-up/step-down approach based on symptom control',
        'Written asthma action plan for every patient',
        'Identify and manage triggers',
      ],
      monitoringTargets: [
        { metric: 'ACT score', target: '≥ 20 (well-controlled)', frequency: 'Every visit' },
        { metric: 'PEF', target: '> 80% personal best', frequency: 'Per action plan' },
        { metric: 'Exacerbation frequency', target: '0', frequency: 'Every visit' },
      ],
      adherenceChecklist: [
        'Inhaler technique checked',
        'Trigger avoidance discussed',
        'Action plan reviewed',
        'Controller adherence assessed',
      ],
    }],
    preventiveCare: ['Annual influenza vaccine'],
  },
  {
    icd10Prefixes: ['I48'],
    conditionKeywords: ['atrial fibrillation', 'afib', 'a-fib', 'atrial flutter'],
    guidelines: [{
      organization: 'ACC/AHA/ACCP/HRS',
      guidelineName: 'Guideline for Diagnosis and Management of Atrial Fibrillation',
      year: 2023,
      keyRecommendations: [
        'CHA₂DS₂-VASc score for stroke risk stratification',
        'DOACs preferred over warfarin for anticoagulation',
        'Rate control: beta-blocker or CCB as first-line',
        'Rhythm control for symptomatic patients or early AFib',
        'Screen for and manage modifiable risk factors',
      ],
      monitoringTargets: [
        { metric: 'Heart rate', target: '< 110 bpm (lenient) or < 80 (strict)', frequency: 'Every visit' },
        { metric: 'CHA₂DS₂-VASc score', target: 'Reassess annually', frequency: 'Annually' },
        { metric: 'Renal function', target: 'eGFR for DOAC dosing', frequency: 'Every 6-12 months' },
      ],
      adherenceChecklist: [
        'Anticoagulation status documented',
        'CHA₂DS₂-VASc calculated',
        'Rate or rhythm strategy documented',
        'Bleeding risk assessed (HAS-BLED)',
      ],
    }],
    preventiveCare: ['Screen for thyroid disease', 'Echo if not done recently'],
  },
  {
    icd10Prefixes: ['N18'],
    conditionKeywords: ['chronic kidney disease', 'ckd', 'renal insufficiency'],
    guidelines: [{
      organization: 'KDIGO',
      guidelineName: 'Clinical Practice Guideline for CKD',
      year: 2024,
      keyRecommendations: [
        'SGLT2 inhibitor for CKD with eGFR 20-45 or albuminuria',
        'ACEi/ARB for proteinuria (UACR > 30)',
        'BP target < 120 systolic (if tolerated)',
        'Avoid nephrotoxins (NSAIDs, contrast dye)',
        'Refer to nephrology if eGFR < 30 or rapidly declining',
      ],
      monitoringTargets: [
        { metric: 'eGFR', target: 'Track decline rate', frequency: 'Every 3-12 months per stage' },
        { metric: 'UACR', target: '< 30 mg/g', frequency: 'Annually' },
        { metric: 'Serum potassium', target: '3.5-5.0 mEq/L', frequency: 'With ACEi/ARB' },
        { metric: 'Hemoglobin', target: '> 10 g/dL', frequency: 'If stage 3b+' },
      ],
      adherenceChecklist: [
        'CKD stage documented (G and A categories)',
        'Nephrotoxin avoidance discussed',
        'SGLT2i or ACEi/ARB if indicated',
        'Referral to nephrology if appropriate',
      ],
    }],
    preventiveCare: ['Hepatitis B vaccine if not immune', 'Annual influenza vaccine'],
  },
  {
    icd10Prefixes: ['M80', 'M81'],
    conditionKeywords: ['osteoporosis', 'osteopenia', 'bone density'],
    guidelines: [{
      organization: 'AACE/ACE',
      guidelineName: 'Clinical Practice Guidelines for Osteoporosis',
      year: 2020,
      keyRecommendations: [
        'Bisphosphonate as first-line for most patients',
        'Calcium 1200mg + Vitamin D 1000-2000 IU daily',
        'Weight-bearing exercise recommended',
        'Fall prevention assessment',
        'FRAX score for fracture risk assessment',
      ],
      monitoringTargets: [
        { metric: 'DEXA T-score', target: '> -2.5', frequency: 'Every 1-2 years on treatment' },
        { metric: 'Vitamin D level', target: '> 30 ng/mL', frequency: 'Annually' },
      ],
      adherenceChecklist: [
        'Fracture risk assessment (FRAX)',
        'Fall risk evaluated',
        'Calcium and Vitamin D intake',
        'Treatment duration reviewed',
      ],
    }],
    preventiveCare: ['DEXA scan per USPSTF guidelines'],
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
  {
    icd10Prefixes: ['I25', 'I20', 'I21'],
    conditionKeywords: ['coronary artery disease', 'cad', 'angina', 'mi', 'myocardial infarction', 'ischemic heart'],
    guidelines: [{
      organization: 'ACC/AHA',
      guidelineName: 'Guideline for Chronic Coronary Disease',
      year: 2023,
      keyRecommendations: [
        'Aspirin + high-intensity statin for all',
        'Beta-blocker if prior MI or reduced EF',
        'ACEi/ARB if EF ≤ 40%, diabetes, or HTN',
        'Cardiac rehabilitation referral',
        'Aggressive risk factor modification',
      ],
      monitoringTargets: [
        { metric: 'LDL cholesterol', target: '< 70 mg/dL', frequency: 'Every 4-12 weeks, then annually' },
        { metric: 'Blood pressure', target: '< 130/80', frequency: 'Every visit' },
        { metric: 'Heart rate', target: '< 70 bpm if on beta-blocker', frequency: 'Every visit' },
      ],
      adherenceChecklist: [
        'DAPT status documented (if post-PCI)',
        'Statin intensity appropriate',
        'Angina frequency and functional status',
        'Cardiac rehab participation',
      ],
    }],
    preventiveCare: ['Annual influenza vaccine', 'Stress testing per clinical indication'],
  },
  {
    icd10Prefixes: ['E03', 'E05'],
    conditionKeywords: ['hypothyroidism', 'hyperthyroidism', 'thyroid'],
    guidelines: [{
      organization: 'ATA',
      guidelineName: 'Guidelines for Management of Thyroid Disease',
      year: 2023,
      keyRecommendations: [
        'Levothyroxine as standard treatment for hypothyroidism',
        'TSH target 0.5-2.5 mIU/L for most adults',
        'Wait 6-8 weeks after dose change before rechecking TSH',
        'Take levothyroxine on empty stomach, 30-60 min before eating',
        'Consider free T4 if TSH unreliable (pituitary disease, pregnancy)',
      ],
      monitoringTargets: [
        { metric: 'TSH', target: '0.5-2.5 mIU/L', frequency: 'Every 6-8 weeks until stable, then annually' },
        { metric: 'Free T4', target: 'Upper half of normal', frequency: 'With TSH if indicated' },
      ],
      adherenceChecklist: [
        'TSH level reviewed',
        'Medication timing discussed',
        'Symptoms of hypo/hyperthyroidism assessed',
        'Drug interactions checked (calcium, iron, PPIs)',
      ],
    }],
    preventiveCare: ['Lipid panel if newly hypothyroid'],
  },
];

// =====================================================
// Matching Logic
// =====================================================

/**
 * Match encounter state diagnoses against the guideline database.
 * Returns applicable guidelines with adherence flags for each condition.
 *
 * This is a lightweight, rule-based matcher — no API calls needed.
 * Runs in <1ms, suitable for every 15-second analysis cycle.
 */
export function matchGuidelinesForEncounter(
  encounterState: EncounterState
): GuidelineMatchResult[] {
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

/**
 * Find guideline entry by ICD-10 prefix or condition keyword matching
 */
function findGuidelineEntry(dx: DiagnosisEntry): GuidelineEntry | null {
  // First try ICD-10 prefix match (most precise)
  if (dx.icd10) {
    const icd10Upper = dx.icd10.toUpperCase();
    for (const entry of GUIDELINE_DATABASE) {
      if (entry.icd10Prefixes.some(prefix => icd10Upper.startsWith(prefix))) {
        return entry;
      }
    }
  }

  // Fall back to keyword matching
  const conditionLower = dx.condition.toLowerCase();
  for (const entry of GUIDELINE_DATABASE) {
    if (entry.conditionKeywords.some(kw => conditionLower.includes(kw))) {
      return entry;
    }
  }

  return null;
}

/**
 * Check encounter state against guideline adherence items.
 * Returns flags for items that are missing from this encounter.
 */
function checkAdherence(
  dx: DiagnosisEntry,
  entry: GuidelineEntry,
  encounterState: EncounterState
): string[] {
  const flags: string[] = [];

  // Check if any guideline monitoring targets are measured in this visit
  for (const guideline of entry.guidelines) {
    for (const target of guideline.monitoringTargets) {
      const metric = target.metric.toLowerCase();
      // Check vitals
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
        // Only flag glucose if diabetes-related
        if (entry.icd10Prefixes.some(p => p.startsWith('E1'))) {
          flags.push(`[GAP] Glucose not documented — guideline target: ${target.target}`);
        }
      }
    }

    // Check if medication reconciliation was done
    const hasMedRecon = encounterState.completeness.hasMedReconciliation;
    if (!hasMedRecon && guideline.adherenceChecklist.some(c => c.toLowerCase().includes('medication'))) {
      flags.push('[GAP] Medication reconciliation not yet documented');
    }
  }

  // Deduplicate
  return [...new Set(flags)];
}

/**
 * Format guideline matches for display as a provider-friendly summary
 */
export function formatGuidelinesForDisplay(matches: GuidelineMatchResult[]): string[] {
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
