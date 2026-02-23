// Treatment Pathway Quick Reference — Real-Time Treatment Step Display for Compass Riley
// Session 6 of Compass Riley Clinical Reasoning Hardening (2026-02-23)
//
// Lightweight, rule-based treatment pathway references for common conditions.
// Provides first-line → third-line treatment steps with evidence levels, generic
// contraindications, and SDOH-aware notes. Runs in <1ms, no API calls.
// The full ai-treatment-pathway edge function provides patient-specific recommendations.

import type { EncounterState, DiagnosisEntry } from './encounterStateManager.ts';

// =====================================================
// Types
// =====================================================

/** Evidence level per established clinical guidelines */
export type EvidenceLevel = 'A' | 'B' | 'C' | 'D' | 'expert_consensus';

/** A single treatment step in a pathway */
export interface TreatmentStep {
  phase: 'first_line' | 'second_line' | 'third_line' | 'adjunct';
  intervention: string;
  medicationClass?: string;
  examples?: string[];
  evidenceLevel: EvidenceLevel;
  guidelineSource: string;
  contraindications: string[];
  /** Cost/access/barrier note for SDOH-aware prescribing */
  sdohNote?: string;
}

/** Quick-reference treatment pathway for a condition */
export interface TreatmentPathwayRef {
  condition: string;
  treatmentGoal: string;
  steps: TreatmentStep[];
  redFlags: string[];
  lifestyleRecommendations: string[];
}

/** Result of matching a diagnosis to treatment pathways */
export interface TreatmentPathwayResult {
  condition: string;
  icd10: string;
  pathway: TreatmentPathwayRef;
}

// =====================================================
// Treatment Pathway Database — Top 12 Conditions
// =====================================================

interface PathwayEntry {
  icd10Prefixes: string[];
  conditionKeywords: string[];
  pathway: TreatmentPathwayRef;
}

const PATHWAY_DATABASE: PathwayEntry[] = [
  {
    icd10Prefixes: ['E11', 'E10', 'E13'],
    conditionKeywords: ['diabetes', 'diabetic', 'dm', 'type 2 diabetes', 'type 1 diabetes'],
    pathway: {
      condition: 'Type 2 Diabetes Mellitus',
      treatmentGoal: 'HbA1c < 7.0% (individualize based on age, comorbidities, hypoglycemia risk)',
      steps: [
        { phase: 'first_line', intervention: 'Metformin + lifestyle modifications', medicationClass: 'Biguanide', examples: ['Metformin 500mg BID, titrate to 1000mg BID'], evidenceLevel: 'A', guidelineSource: 'ADA Standards of Care 2024', contraindications: ['eGFR < 30 mL/min', 'Acute metabolic acidosis', 'Hepatic impairment'], sdohNote: 'Generic metformin is very low cost ($4/month at many pharmacies)' },
        { phase: 'second_line', intervention: 'Add SGLT2 inhibitor (if ASCVD, HF, or CKD) or GLP-1 RA', medicationClass: 'SGLT2i / GLP-1 RA', examples: ['Empagliflozin 10mg daily', 'Semaglutide 0.25mg weekly → 1mg'], evidenceLevel: 'A', guidelineSource: 'ADA Standards of Care 2024', contraindications: ['SGLT2i: recurrent UTI/DKA risk, eGFR < 20', 'GLP-1 RA: personal/family MTC history, pancreatitis history'], sdohNote: 'Brand-name SGLT2i/GLP-1 RA can be expensive — check manufacturer coupons and prior auth' },
        { phase: 'third_line', intervention: 'Add basal insulin or additional oral agent', medicationClass: 'Insulin / DPP-4i / TZD', examples: ['Insulin glargine 10 units at bedtime', 'Sitagliptin 100mg daily', 'Pioglitazone 15mg daily'], evidenceLevel: 'A', guidelineSource: 'ADA Standards of Care 2024', contraindications: ['TZD: heart failure NYHA III-IV, bladder cancer history', 'Insulin: requires self-management education'], sdohNote: 'NPH and regular insulin are available at low cost; insulin pens may improve adherence but cost more' },
        { phase: 'adjunct', intervention: 'Statin therapy for cardiovascular risk reduction', medicationClass: 'Statin', examples: ['Atorvastatin 40mg daily'], evidenceLevel: 'A', guidelineSource: 'ADA Standards of Care 2024', contraindications: ['Active liver disease', 'Pregnancy'], sdohNote: 'Generic statins are low-cost' },
      ],
      redFlags: ['DKA symptoms (nausea, vomiting, abdominal pain, Kussmaul breathing)', 'Severe hypoglycemia (confusion, seizure, LOC)', 'New foot ulcer or gangrene', 'Sudden vision loss'],
      lifestyleRecommendations: ['150 min/week moderate aerobic activity', 'Medical nutrition therapy (MNT) referral', 'Weight loss 5-10% if overweight', 'Smoking cessation'],
    },
  },
  {
    icd10Prefixes: ['I10', 'I11', 'I12', 'I13', 'I15'],
    conditionKeywords: ['hypertension', 'htn', 'high blood pressure', 'elevated bp'],
    pathway: {
      condition: 'Hypertension',
      treatmentGoal: 'BP < 130/80 mmHg for most adults',
      steps: [
        { phase: 'first_line', intervention: 'ACE inhibitor or ARB (preferred if diabetes/CKD)', medicationClass: 'ACEi / ARB', examples: ['Lisinopril 10mg daily', 'Losartan 50mg daily'], evidenceLevel: 'A', guidelineSource: 'ACC/AHA HTN Guideline 2017', contraindications: ['Bilateral renal artery stenosis', 'Pregnancy', 'Angioedema history (ACEi)'], sdohNote: 'Generic ACEi/ARB are low-cost' },
        { phase: 'first_line', intervention: 'Thiazide diuretic or CCB (alternative first-line)', medicationClass: 'Thiazide / CCB', examples: ['Chlorthalidone 12.5mg daily', 'Amlodipine 5mg daily'], evidenceLevel: 'A', guidelineSource: 'ACC/AHA HTN Guideline 2017', contraindications: ['Thiazide: severe hyponatremia, gout', 'CCB: severe aortic stenosis (dihydropyridine)'], sdohNote: 'Generic thiazides and amlodipine are very low-cost' },
        { phase: 'second_line', intervention: 'Combination therapy (ACEi/ARB + CCB or thiazide)', medicationClass: 'Combination', examples: ['Amlodipine/benazepril 5/20mg', 'Losartan/HCTZ 50/12.5mg'], evidenceLevel: 'A', guidelineSource: 'ACC/AHA HTN Guideline 2017', contraindications: ['Do NOT combine ACEi + ARB'], sdohNote: 'Combination pills improve adherence for patients with polypharmacy' },
        { phase: 'third_line', intervention: 'Add spironolactone for resistant HTN', medicationClass: 'MRA', examples: ['Spironolactone 25mg daily'], evidenceLevel: 'B', guidelineSource: 'ACC/AHA HTN Guideline 2017', contraindications: ['Hyperkalemia (K+ > 5.0)', 'eGFR < 30'], sdohNote: 'Generic spironolactone is low-cost' },
      ],
      redFlags: ['Hypertensive urgency (BP > 180/120 without symptoms)', 'Hypertensive emergency (BP > 180/120 with end-organ damage)', 'New headache/vision changes/chest pain with elevated BP'],
      lifestyleRecommendations: ['DASH diet (sodium < 2300mg/day)', 'Regular aerobic exercise 30 min/day', 'Limit alcohol', 'Weight loss if overweight', 'Stress management'],
    },
  },
  {
    icd10Prefixes: ['E78'],
    conditionKeywords: ['hyperlipidemia', 'high cholesterol', 'dyslipidemia', 'elevated ldl'],
    pathway: {
      condition: 'Hyperlipidemia',
      treatmentGoal: 'LDL < 70 mg/dL (ASCVD) or < 100 mg/dL (primary prevention)',
      steps: [
        { phase: 'first_line', intervention: 'High-intensity statin (ASCVD or LDL ≥ 190) or moderate-intensity (diabetes/elevated risk)', medicationClass: 'Statin', examples: ['Atorvastatin 40-80mg daily', 'Rosuvastatin 20-40mg daily'], evidenceLevel: 'A', guidelineSource: 'ACC/AHA Cholesterol Guideline 2018', contraindications: ['Active liver disease', 'Pregnancy/lactation', 'Unexplained persistent CK elevation'], sdohNote: 'Generic atorvastatin and rosuvastatin are low-cost' },
        { phase: 'second_line', intervention: 'Add ezetimibe if LDL not at goal on max statin', medicationClass: 'Cholesterol absorption inhibitor', examples: ['Ezetimibe 10mg daily'], evidenceLevel: 'B', guidelineSource: 'ACC/AHA Cholesterol Guideline 2018', contraindications: ['Active liver disease when combined with statin'], sdohNote: 'Generic ezetimibe is affordable' },
        { phase: 'third_line', intervention: 'Add PCSK9 inhibitor for very high-risk or familial hypercholesterolemia', medicationClass: 'PCSK9 inhibitor', examples: ['Evolocumab 140mg SC every 2 weeks', 'Alirocumab 75mg SC every 2 weeks'], evidenceLevel: 'A', guidelineSource: 'ACC/AHA Cholesterol Guideline 2018', contraindications: ['Hypersensitivity'], sdohNote: 'PCSK9 inhibitors are expensive (~$5,000+/year) — requires prior authorization' },
        { phase: 'adjunct', intervention: 'Icosapent ethyl for elevated triglycerides with ASCVD', medicationClass: 'Omega-3 (prescription)', examples: ['Icosapent ethyl 2g BID'], evidenceLevel: 'A', guidelineSource: 'REDUCE-IT Trial', contraindications: ['Fish/shellfish allergy', 'AFib risk'], sdohNote: 'Brand-name only; OTC fish oil does NOT substitute' },
      ],
      redFlags: ['Severe hypertriglyceridemia (TG > 500) — pancreatitis risk', 'Rhabdomyolysis symptoms (severe muscle pain, dark urine, weakness)'],
      lifestyleRecommendations: ['Heart-healthy diet (Mediterranean or DASH)', 'Regular exercise 150 min/week', 'Weight management', 'Smoking cessation', 'Limit alcohol'],
    },
  },
  {
    icd10Prefixes: ['I50'],
    conditionKeywords: ['heart failure', 'chf', 'hf', 'hfref', 'hfpef'],
    pathway: {
      condition: 'Heart Failure (HFrEF)',
      treatmentGoal: 'Symptom relief, prevent hospitalization, improve survival — optimize GDMT (4 pillars)',
      steps: [
        { phase: 'first_line', intervention: 'GDMT Pillar 1: ACEi/ARB/ARNI', medicationClass: 'ARNI / ACEi / ARB', examples: ['Sacubitril/valsartan 24/26mg BID → 97/103mg BID', 'Enalapril 2.5mg BID → 10mg BID'], evidenceLevel: 'A', guidelineSource: 'ACC/AHA HF Guideline 2022', contraindications: ['ARNI: ACEi within 36h, angioedema, pregnancy', 'eGFR < 20 (use caution)'], sdohNote: 'Generic enalapril is low-cost; sacubitril/valsartan requires prior auth' },
        { phase: 'first_line', intervention: 'GDMT Pillar 2: Beta-blocker', medicationClass: 'Beta-blocker (HF-approved)', examples: ['Carvedilol 3.125mg BID → 25mg BID', 'Metoprolol succinate 12.5mg daily → 200mg daily'], evidenceLevel: 'A', guidelineSource: 'ACC/AHA HF Guideline 2022', contraindications: ['Decompensated HF (start when euvolemic)', 'Severe bradycardia', 'Advanced AV block'], sdohNote: 'Generic carvedilol and metoprolol succinate are low-cost' },
        { phase: 'first_line', intervention: 'GDMT Pillar 3: MRA', medicationClass: 'Mineralocorticoid receptor antagonist', examples: ['Spironolactone 12.5-25mg daily', 'Eplerenone 25mg daily'], evidenceLevel: 'A', guidelineSource: 'ACC/AHA HF Guideline 2022', contraindications: ['K+ > 5.0 mEq/L', 'eGFR < 30', 'Gynecomastia (spironolactone → switch to eplerenone)'] },
        { phase: 'first_line', intervention: 'GDMT Pillar 4: SGLT2 inhibitor', medicationClass: 'SGLT2i', examples: ['Dapagliflozin 10mg daily', 'Empagliflozin 10mg daily'], evidenceLevel: 'A', guidelineSource: 'ACC/AHA HF Guideline 2022 (DAPA-HF, EMPEROR-Reduced)', contraindications: ['Type 1 DM (DKA risk)', 'eGFR < 20'], sdohNote: 'Brand-name; check manufacturer assistance programs' },
        { phase: 'adjunct', intervention: 'Loop diuretic for volume overload', medicationClass: 'Loop diuretic', examples: ['Furosemide 20-40mg daily PRN'], evidenceLevel: 'B', guidelineSource: 'ACC/AHA HF Guideline 2022', contraindications: ['Dehydration', 'Severe hyponatremia'], sdohNote: 'Generic furosemide is very low-cost' },
      ],
      redFlags: ['Acute decompensation (dyspnea at rest, weight gain > 3 lbs overnight)', 'Syncope or near-syncope', 'Chest pain or new arrhythmia', 'eGFR decline > 30% from baseline'],
      lifestyleRecommendations: ['Sodium restriction < 2g/day', 'Fluid restriction if hyponatremia', 'Daily weight monitoring', 'Cardiac rehabilitation referral', 'Avoid NSAIDs'],
    },
  },
  {
    icd10Prefixes: ['J44'],
    conditionKeywords: ['copd', 'chronic obstructive pulmonary', 'emphysema'],
    pathway: {
      condition: 'COPD',
      treatmentGoal: 'Reduce symptoms (mMRC < 2), prevent exacerbations (< 2/year), slow FEV1 decline',
      steps: [
        { phase: 'first_line', intervention: 'LABA + LAMA combination (Group B-E)', medicationClass: 'LABA + LAMA', examples: ['Umeclidinium/vilanterol 62.5/25 mcg inhaled daily', 'Tiotropium/olodaterol 5/5 mcg inhaled daily'], evidenceLevel: 'A', guidelineSource: 'GOLD 2024', contraindications: ['Narrow-angle glaucoma (LAMA)', 'Urinary retention (LAMA)'], sdohNote: 'Brand-name inhalers can be expensive — check patient assistance programs' },
        { phase: 'second_line', intervention: 'Add ICS if eosinophils ≥ 300 or frequent exacerbations', medicationClass: 'LABA + LAMA + ICS (triple therapy)', examples: ['Fluticasone/umeclidinium/vilanterol (Trelegy) 100/62.5/25 mcg daily'], evidenceLevel: 'A', guidelineSource: 'GOLD 2024 (IMPACT trial)', contraindications: ['Recurrent pneumonia on ICS', 'Active TB'], sdohNote: 'Single inhaler triple therapy improves adherence vs. multiple devices' },
        { phase: 'third_line', intervention: 'Roflumilast for frequent exacerbators with chronic bronchitis phenotype', medicationClass: 'PDE4 inhibitor', examples: ['Roflumilast 500mcg daily'], evidenceLevel: 'B', guidelineSource: 'GOLD 2024', contraindications: ['Moderate-severe liver impairment', 'Depression/suicidal ideation'], sdohNote: 'Brand-name only' },
        { phase: 'adjunct', intervention: 'Pulmonary rehabilitation', evidenceLevel: 'A', guidelineSource: 'GOLD 2024', contraindications: ['Unstable angina', 'Recent MI (< 1 month)'], sdohNote: 'Transportation to rehab center may be a barrier — explore home-based programs' },
      ],
      redFlags: ['Acute exacerbation (increased dyspnea, sputum volume/purulence)', 'SpO2 < 88% at rest', 'Right heart failure signs', 'Hemoptysis'],
      lifestyleRecommendations: ['Smoking cessation (#1 intervention)', 'Annual influenza + pneumococcal + COVID vaccines', 'Pulmonary rehabilitation', 'Supplemental O2 if resting SpO2 < 88%'],
    },
  },
  {
    icd10Prefixes: ['J45'],
    conditionKeywords: ['asthma'],
    pathway: {
      condition: 'Asthma',
      treatmentGoal: 'Well-controlled symptoms (ACT ≥ 20), no exacerbations, normal activity',
      steps: [
        { phase: 'first_line', intervention: 'As-needed low-dose ICS-formoterol (mild) or daily low-dose ICS + PRN SABA (alternative)', medicationClass: 'ICS / ICS-formoterol', examples: ['Budesonide/formoterol 80/4.5 mcg PRN', 'Fluticasone 88 mcg BID + albuterol PRN'], evidenceLevel: 'A', guidelineSource: 'GINA 2024', contraindications: ['Untreated fungal infection (oral ICS)'], sdohNote: 'Generic ICS available; ICS-formoterol combination may be brand-name' },
        { phase: 'second_line', intervention: 'Medium-dose ICS or low-dose ICS + LABA', medicationClass: 'ICS + LABA', examples: ['Fluticasone/salmeterol 250/50 mcg BID', 'Budesonide/formoterol 160/4.5 mcg BID'], evidenceLevel: 'A', guidelineSource: 'GINA 2024', contraindications: ['LABA monotherapy without ICS is contraindicated (black box)'] },
        { phase: 'third_line', intervention: 'High-dose ICS + LABA ± LAMA or biologic therapy', medicationClass: 'High-dose ICS-LABA / Biologics', examples: ['Fluticasone/salmeterol 500/50 mcg BID', 'Omalizumab, Dupilumab, Mepolizumab'], evidenceLevel: 'A', guidelineSource: 'GINA 2024', contraindications: ['Biologics: hypersensitivity, parasitic infections'], sdohNote: 'Biologics are very expensive ($10K-$30K/year) — prior auth required, specialty pharmacy' },
      ],
      redFlags: ['Status asthmaticus (severe exacerbation unresponsive to initial treatment)', 'Peak flow < 50% predicted', 'Altered consciousness', 'Silent chest on auscultation'],
      lifestyleRecommendations: ['Identify and avoid triggers (allergens, irritants)', 'Written asthma action plan', 'Annual flu vaccine', 'Exercise (with proper warm-up)'],
    },
  },
  {
    icd10Prefixes: ['I48'],
    conditionKeywords: ['atrial fibrillation', 'afib', 'a-fib', 'atrial flutter'],
    pathway: {
      condition: 'Atrial Fibrillation',
      treatmentGoal: 'Stroke prevention (anticoagulation), symptom control (rate or rhythm)',
      steps: [
        { phase: 'first_line', intervention: 'Anticoagulation based on CHA₂DS₂-VASc (≥ 2 men, ≥ 3 women)', medicationClass: 'DOAC', examples: ['Apixaban 5mg BID', 'Rivaroxaban 20mg daily with food'], evidenceLevel: 'A', guidelineSource: 'ACC/AHA/HRS AFib Guideline 2023', contraindications: ['Active major bleeding', 'Mechanical heart valve', 'Moderate-severe mitral stenosis', 'CrCl < 15 mL/min (apixaban) or < 30 (rivaroxaban)'], sdohNote: 'Generic apixaban now available, significantly reducing cost' },
        { phase: 'first_line', intervention: 'Rate control: beta-blocker or non-dihydropyridine CCB', medicationClass: 'Beta-blocker / CCB', examples: ['Metoprolol tartrate 25mg BID', 'Diltiazem ER 120mg daily'], evidenceLevel: 'B', guidelineSource: 'ACC/AHA/HRS AFib Guideline 2023', contraindications: ['CCB: HFrEF (diltiazem/verapamil)', 'Beta-blocker: severe bradycardia, decompensated HF'], sdohNote: 'Generic rate control agents are low-cost' },
        { phase: 'second_line', intervention: 'Rhythm control: antiarrhythmic or catheter ablation', medicationClass: 'Antiarrhythmic', examples: ['Flecainide 50mg BID (no structural heart disease)', 'Amiodarone 200mg daily (if structural)'], evidenceLevel: 'A', guidelineSource: 'ACC/AHA/HRS AFib Guideline 2023', contraindications: ['Flecainide: structural heart disease, CAD, HF', 'Amiodarone: thyroid disease, pulmonary fibrosis'] },
      ],
      redFlags: ['Rapid ventricular response (HR > 150 with hemodynamic instability)', 'New stroke symptoms', 'Syncope', 'Acute HF decompensation'],
      lifestyleRecommendations: ['Limit alcohol and caffeine', 'Weight management', 'Treat sleep apnea if present', 'Regular exercise (moderate)'],
    },
  },
  {
    icd10Prefixes: ['N18'],
    conditionKeywords: ['chronic kidney disease', 'ckd', 'renal insufficiency'],
    pathway: {
      condition: 'Chronic Kidney Disease',
      treatmentGoal: 'Slow progression, prevent complications, prepare for RRT if advanced',
      steps: [
        { phase: 'first_line', intervention: 'ACEi or ARB for proteinuria (UACR > 30)', medicationClass: 'ACEi / ARB', examples: ['Lisinopril 5mg daily → titrate to 20mg', 'Losartan 25mg daily → 100mg'], evidenceLevel: 'A', guidelineSource: 'KDIGO CKD Guideline 2024', contraindications: ['Bilateral renal artery stenosis', 'Pregnancy', 'K+ > 5.5'], sdohNote: 'Generic ACEi/ARB are low-cost' },
        { phase: 'first_line', intervention: 'SGLT2 inhibitor (eGFR 20-45 or UACR > 200)', medicationClass: 'SGLT2i', examples: ['Dapagliflozin 10mg daily'], evidenceLevel: 'A', guidelineSource: 'KDIGO CKD Guideline 2024 (DAPA-CKD)', contraindications: ['Type 1 DM', 'eGFR < 20 (do not initiate)'], sdohNote: 'Brand-name; manufacturer assistance available' },
        { phase: 'second_line', intervention: 'Finerenone for diabetic kidney disease', medicationClass: 'Nonsteroidal MRA', examples: ['Finerenone 10-20mg daily'], evidenceLevel: 'A', guidelineSource: 'KDIGO CKD Guideline 2024 (FIDELIO-DKD)', contraindications: ['K+ > 5.0', 'Adrenal insufficiency', 'Strong CYP3A4 inhibitors'] },
        { phase: 'adjunct', intervention: 'BP control < 120 systolic (if tolerated)', evidenceLevel: 'A', guidelineSource: 'KDIGO CKD Guideline 2024', contraindications: ['Symptomatic hypotension'] },
      ],
      redFlags: ['Rapid eGFR decline (> 5 mL/min/year)', 'Severe hyperkalemia (K+ > 6.0)', 'Volume overload unresponsive to diuretics', 'Uremic symptoms (nausea, encephalopathy)'],
      lifestyleRecommendations: ['Protein intake 0.8 g/kg/day', 'Sodium < 2g/day', 'Avoid nephrotoxins (NSAIDs, aminoglycosides)', 'Nephrology referral if eGFR < 30'],
    },
  },
  {
    icd10Prefixes: ['M80', 'M81'],
    conditionKeywords: ['osteoporosis', 'osteopenia', 'bone density'],
    pathway: {
      condition: 'Osteoporosis',
      treatmentGoal: 'Prevent fractures, increase or stabilize BMD',
      steps: [
        { phase: 'first_line', intervention: 'Oral bisphosphonate', medicationClass: 'Bisphosphonate', examples: ['Alendronate 70mg weekly', 'Risedronate 150mg monthly'], evidenceLevel: 'A', guidelineSource: 'AACE/ACE Osteoporosis Guideline 2020', contraindications: ['Esophageal abnormalities', 'Inability to stay upright 30 min', 'Hypocalcemia', 'eGFR < 30-35'], sdohNote: 'Generic alendronate is low-cost' },
        { phase: 'second_line', intervention: 'IV bisphosphonate or denosumab', medicationClass: 'IV bisphosphonate / RANKL inhibitor', examples: ['Zoledronic acid 5mg IV annually', 'Denosumab 60mg SC every 6 months'], evidenceLevel: 'A', guidelineSource: 'AACE/ACE Osteoporosis Guideline 2020', contraindications: ['Denosumab: hypocalcemia (correct first), pregnancy', 'Zoledronic acid: eGFR < 35'], sdohNote: 'Denosumab requires ongoing clinic visits every 6 months — transportation may be a barrier' },
        { phase: 'third_line', intervention: 'Anabolic agent (romosozumab or teriparatide) for very high fracture risk', medicationClass: 'Anabolic', examples: ['Romosozumab 210mg SC monthly x 12 months', 'Teriparatide 20mcg SC daily'], evidenceLevel: 'A', guidelineSource: 'AACE/ACE Osteoporosis Guideline 2020', contraindications: ['Romosozumab: MI/stroke within past year', 'Teriparatide: Paget disease, unexplained elevated ALP, prior radiation to skeleton'], sdohNote: 'Very expensive ($20K+/year) — prior auth required' },
        { phase: 'adjunct', intervention: 'Calcium 1200mg + Vitamin D 1000-2000 IU daily', evidenceLevel: 'B', guidelineSource: 'AACE/ACE Osteoporosis Guideline 2020', contraindications: ['Hypercalcemia', 'Nephrolithiasis (use caution with calcium)'], sdohNote: 'OTC calcium and vitamin D are low-cost' },
      ],
      redFlags: ['New fracture on therapy (treatment failure)', 'Atypical femoral fracture (thigh/groin pain)', 'ONJ symptoms (jaw pain, exposed bone)'],
      lifestyleRecommendations: ['Weight-bearing and balance exercises', 'Fall prevention (home safety, vision check)', 'Adequate calcium and vitamin D intake', 'Limit alcohol, avoid tobacco'],
    },
  },
  {
    icd10Prefixes: ['F32', 'F33'],
    conditionKeywords: ['depression', 'major depressive', 'mdd'],
    pathway: {
      condition: 'Major Depressive Disorder',
      treatmentGoal: 'Remission (PHQ-9 < 5), functional recovery, prevent relapse',
      steps: [
        { phase: 'first_line', intervention: 'SSRI or SNRI + psychotherapy (CBT or IPT)', medicationClass: 'SSRI / SNRI', examples: ['Sertraline 50mg daily → 100-200mg', 'Escitalopram 10mg daily → 20mg'], evidenceLevel: 'A', guidelineSource: 'APA Practice Guidelines 2023', contraindications: ['MAOi use within 14 days', 'Sertraline: caution in hepatic impairment', 'Uncontrolled narrow-angle glaucoma (SNRI)'], sdohNote: 'Generic SSRIs are very low-cost; CBT availability may be limited — consider telehealth options' },
        { phase: 'second_line', intervention: 'Switch SSRI class, augment with bupropion, or add atypical antipsychotic', medicationClass: 'Bupropion / Atypical antipsychotic', examples: ['Bupropion XL 150mg daily → 300mg', 'Aripiprazole 2-5mg augmentation'], evidenceLevel: 'B', guidelineSource: 'APA Practice Guidelines 2023 / STAR*D', contraindications: ['Bupropion: seizure disorder, eating disorder', 'Aripiprazole: metabolic monitoring required'], sdohNote: 'Generic bupropion is affordable; atypical antipsychotics may require monitoring labs' },
        { phase: 'third_line', intervention: 'TMS, esketamine, or ECT for treatment-resistant depression', medicationClass: 'Neuromodulation / Esketamine', examples: ['Esketamine nasal spray (Spravato) — REMS program', 'rTMS 5 sessions/week x 4-6 weeks'], evidenceLevel: 'B', guidelineSource: 'APA Practice Guidelines 2023', contraindications: ['Esketamine: aneurysmal vascular disease, AVM, intracerebral hemorrhage history', 'ECT: raised ICP, pheochromocytoma'], sdohNote: 'TMS and esketamine require frequent clinic visits — transportation barrier; ECT requires anesthesia access' },
      ],
      redFlags: ['Suicidal ideation with plan or intent', 'Psychotic features', 'Catatonia', 'Severe functional impairment (not eating, not bathing)'],
      lifestyleRecommendations: ['Regular exercise (30 min moderate, 3-5x/week)', 'Sleep hygiene', 'Social engagement', 'Limit alcohol', 'Structured daily routine'],
    },
  },
  {
    icd10Prefixes: ['I25', 'I20', 'I21'],
    conditionKeywords: ['coronary artery disease', 'cad', 'angina', 'mi', 'myocardial infarction', 'ischemic heart'],
    pathway: {
      condition: 'Coronary Artery Disease',
      treatmentGoal: 'Prevent MI and cardiac death, control angina, optimize risk factors',
      steps: [
        { phase: 'first_line', intervention: 'Aspirin + high-intensity statin + ACEi/ARB (if EF ≤ 40% or diabetes)', medicationClass: 'Antiplatelet + Statin + ACEi', examples: ['ASA 81mg daily', 'Atorvastatin 80mg daily', 'Lisinopril 10mg daily'], evidenceLevel: 'A', guidelineSource: 'ACC/AHA Chronic Coronary Disease 2023', contraindications: ['ASA: active GI bleed, ASA allergy', 'Statin: active liver disease'], sdohNote: 'All generics, very low-cost regimen' },
        { phase: 'first_line', intervention: 'Beta-blocker (if prior MI or angina)', medicationClass: 'Beta-blocker', examples: ['Metoprolol succinate 25-200mg daily'], evidenceLevel: 'A', guidelineSource: 'ACC/AHA Chronic Coronary Disease 2023', contraindications: ['Severe bradycardia', 'Decompensated HF', 'Severe reactive airway disease'] },
        { phase: 'second_line', intervention: 'Add long-acting nitrate or CCB for persistent angina', medicationClass: 'Nitrate / CCB', examples: ['Isosorbide mononitrate 30mg daily', 'Amlodipine 5mg daily'], evidenceLevel: 'B', guidelineSource: 'ACC/AHA Chronic Coronary Disease 2023', contraindications: ['Nitrates: PDE5 inhibitor use, severe aortic stenosis'] },
        { phase: 'adjunct', intervention: 'Cardiac rehabilitation (all patients)', evidenceLevel: 'A', guidelineSource: 'ACC/AHA Chronic Coronary Disease 2023', contraindications: ['Unstable angina', 'Uncontrolled arrhythmia'], sdohNote: 'Transportation to rehab may be a barrier — explore home-based cardiac rehab programs' },
      ],
      redFlags: ['New/worsening angina (unstable angina)', 'Acute MI symptoms (chest pain, diaphoresis, dyspnea)', 'Syncope', 'New heart failure symptoms'],
      lifestyleRecommendations: ['Smoking cessation (most impactful)', 'Mediterranean diet', 'Regular exercise (cardiac rehab → 150 min/week)', 'Weight management', 'Stress reduction'],
    },
  },
  {
    icd10Prefixes: ['E03', 'E05'],
    conditionKeywords: ['hypothyroidism', 'hyperthyroidism', 'thyroid'],
    pathway: {
      condition: 'Thyroid Disease',
      treatmentGoal: 'Euthyroid state: TSH 0.5-2.5 mIU/L for most adults',
      steps: [
        { phase: 'first_line', intervention: 'Levothyroxine for hypothyroidism (start low, titrate)', medicationClass: 'Thyroid hormone', examples: ['Levothyroxine 25-50 mcg daily (increase by 12.5-25 mcg every 6-8 weeks)'], evidenceLevel: 'A', guidelineSource: 'ATA Thyroid Guidelines 2023', contraindications: ['Untreated adrenal insufficiency (treat cortisol first)', 'Acute MI (start very low dose)'], sdohNote: 'Generic levothyroxine is very low-cost; brand-name (Synthroid) preferred for narrow therapeutic index' },
        { phase: 'first_line', intervention: 'Methimazole for hyperthyroidism (Graves disease)', medicationClass: 'Antithyroid drug', examples: ['Methimazole 5-30mg daily (based on severity)'], evidenceLevel: 'A', guidelineSource: 'ATA Thyroid Guidelines 2023', contraindications: ['Pregnancy (first trimester — use PTU instead)', 'Prior agranulocytosis'], sdohNote: 'Generic methimazole is affordable; requires periodic CBC monitoring' },
        { phase: 'second_line', intervention: 'Radioactive iodine (RAI) or thyroidectomy for Graves disease', evidenceLevel: 'A', guidelineSource: 'ATA Thyroid Guidelines 2023', contraindications: ['RAI: pregnancy, breastfeeding, Graves ophthalmopathy (relative)', 'Surgery: high surgical risk patients'] },
      ],
      redFlags: ['Thyroid storm (tachycardia, fever, altered mentation, GI symptoms)', 'Myxedema coma (hypothermia, bradycardia, altered mentation)', 'Agranulocytosis on antithyroid drugs (fever, sore throat)'],
      lifestyleRecommendations: ['Take levothyroxine on empty stomach, 30-60 min before food', 'Separate from calcium, iron, PPIs by 4 hours', 'Regular TSH monitoring', 'Avoid excess iodine with thyroid disease'],
    },
  },
];

// =====================================================
// Matching Logic
// =====================================================

/**
 * Match encounter state diagnoses against treatment pathway database.
 * Returns treatment pathway references for each recognized condition.
 */
export function matchTreatmentPathways(
  encounterState: EncounterState
): TreatmentPathwayResult[] {
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

/**
 * Find pathway entry by ICD-10 prefix or condition keyword
 */
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

/**
 * Format treatment pathway results for display as a provider-friendly summary
 */
export function formatTreatmentForDisplay(results: TreatmentPathwayResult[]): string[] {
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
