/**
 * Voice Action Context — Medical Term Aliases
 *
 * Lookup dictionaries for diagnosis, medication, and unit abbreviations
 * used by the voice NLP parser to resolve common medical shorthand.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

export const DIAGNOSIS_ALIASES: Record<string, string> = {
  // Heart conditions
  'chf': 'congestive heart failure',
  'heart failure': 'congestive heart failure',
  'mi': 'myocardial infarction',
  'heart attack': 'myocardial infarction',
  'afib': 'atrial fibrillation',
  'a-fib': 'atrial fibrillation',

  // Respiratory
  'copd': 'chronic obstructive pulmonary disease',
  'pneumonia': 'pneumonia',
  'covid': 'covid-19',

  // Metabolic
  'diabetes': 'diabetes mellitus',
  'dm': 'diabetes mellitus',
  'dm2': 'diabetes mellitus type 2',
  'type 2': 'diabetes mellitus type 2',

  // Neurological
  'stroke': 'cerebrovascular accident',
  'cva': 'cerebrovascular accident',
  'tia': 'transient ischemic attack',
  'seizure': 'seizure disorder',
  'epilepsy': 'seizure disorder',
  'parkinsons': 'parkinson disease',
  'parkinson': 'parkinson disease',
  'dementia': 'dementia',
  'alzheimers': 'alzheimer disease',

  // Renal
  'ckd': 'chronic kidney disease',
  'kidney disease': 'chronic kidney disease',
  'esrd': 'end stage renal disease',
  'dialysis': 'end stage renal disease',

  // Other
  'sepsis': 'sepsis',
  'fall': 'fall risk',
  'falls': 'fall risk',
  'pressure ulcer': 'pressure injury',
  'bed sore': 'pressure injury',
};

export const MEDICATION_ALIASES: Record<string, string> = {
  'insulin': 'insulin',
  'metformin': 'metformin',
  'glucophage': 'metformin',
  'lisinopril': 'lisinopril',
  'ace inhibitor': 'lisinopril',
  'lasix': 'furosemide',
  'furosemide': 'furosemide',
  'diuretic': 'furosemide',
  'water pill': 'furosemide',
  'coumadin': 'warfarin',
  'warfarin': 'warfarin',
  'blood thinner': 'anticoagulant',
  'heparin': 'heparin',
  'lovenox': 'enoxaparin',
  'plavix': 'clopidogrel',
  'aspirin': 'aspirin',
  'statin': 'statin',
  'lipitor': 'atorvastatin',
  'metoprolol': 'metoprolol',
  'beta blocker': 'metoprolol',
  'morphine': 'morphine',
  'dilaudid': 'hydromorphone',
  'pain med': 'analgesic',
  'antibiotic': 'antibiotic',
  'vancomycin': 'vancomycin',
  'vanco': 'vancomycin',
  'zosyn': 'piperacillin-tazobactam',
};

export const UNIT_ALIASES: Record<string, string> = {
  'icu': 'icu',
  'intensive care': 'icu',
  'critical care': 'icu',
  'ccu': 'cardiac_icu',
  'cardiac icu': 'cardiac_icu',
  'micu': 'medical_icu',
  'sicu': 'surgical_icu',
  'nicu': 'nicu',
  'picu': 'picu',
  'er': 'ed',
  'emergency': 'ed',
  'emergency room': 'ed',
  'emergency department': 'ed',
  'ed': 'ed',
  'med surg': 'med_surg',
  'med-surg': 'med_surg',
  'medical surgical': 'med_surg',
  'telemetry': 'telemetry',
  'tele': 'telemetry',
  'step down': 'step_down',
  'stepdown': 'step_down',
  'pcu': 'step_down',
  'progressive care': 'step_down',
  'labor and delivery': 'labor_delivery',
  'l&d': 'labor_delivery',
  'labor': 'labor_delivery',
  'ob': 'labor_delivery',
  'postpartum': 'postpartum',
  'mother baby': 'postpartum',
  'nursery': 'nursery',
  'peds': 'peds',
  'pediatrics': 'peds',
  'ortho': 'ortho',
  'orthopedic': 'ortho',
  'neuro': 'neuro',
  'neurology': 'neuro',
  'oncology': 'oncology',
  'cancer': 'oncology',
  'psych': 'psych',
  'psychiatry': 'psych',
  'behavioral health': 'psych',
  'rehab': 'rehab',
  'rehabilitation': 'rehab',
  'or': 'or',
  'operating room': 'or',
  'surgery': 'or',
  'pacu': 'pacu',
  'recovery': 'pacu',
};
