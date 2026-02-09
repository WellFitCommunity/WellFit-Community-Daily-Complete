/**
 * Cardiology LOINC and SNOMED CT Code Constants
 * Standardized codes for cardiac observations and conditions
 */

// =====================================================
// CARDIOLOGY LOINC CODES
// =====================================================

export const CARDIOLOGY_LOINC_CODES = {
  // Cardiac Function
  LVEF: '10230-1',
  BNP: '42637-9',
  NT_PRO_BNP: '33762-6',
  TROPONIN_I: '10839-9',
  TROPONIN_T: '6598-7',

  // ECG
  ECG_12_LEAD: '11524-6',
  HEART_RATE: '8867-4',
  PR_INTERVAL: '8625-6',
  QRS_DURATION: '8633-0',
  QTC_INTERVAL: '8636-3',

  // Hemodynamics
  BP_SYSTOLIC: '8480-6',
  BP_DIASTOLIC: '8462-4',
  CARDIAC_OUTPUT: '8741-1',

  // Stress Test
  EXERCISE_DURATION: '55423-8',
  METS_ACHIEVED: '89013-8',
  DUKE_TREADMILL_SCORE: '89014-6',

  // Device
  PACING_PERCENT: '89015-3',
  ICD_SHOCKS: '89016-1',
};

// =====================================================
// CARDIOLOGY SNOMED CT CODES
// =====================================================

export const CARDIOLOGY_SNOMED_CODES = {
  // Conditions
  CORONARY_ARTERY_DISEASE: '53741008',
  HEART_FAILURE: '84114007',
  ATRIAL_FIBRILLATION: '49436004',
  HYPERTENSION: '38341003',
  MYOCARDIAL_INFARCTION: '22298006',
  STEMI: '401303003',
  AORTIC_STENOSIS: '60573004',
  MITRAL_REGURGITATION: '48724000',
  CARDIOMYOPATHY: '85898001',

  // Procedures
  ECG_PROCEDURE: '29303009',
  ECHOCARDIOGRAM: '40701008',
  CARDIAC_CATHETERIZATION: '41976001',
  CORONARY_ANGIOGRAPHY: '33367005',
  STRESS_TEST: '252157006',
  PACEMAKER_INSERTION: '307280005',
  ICD_INSERTION: '395218007',
  PCI_STENT: '415070008',
  CARDIAC_REHAB: '390893007',
};
