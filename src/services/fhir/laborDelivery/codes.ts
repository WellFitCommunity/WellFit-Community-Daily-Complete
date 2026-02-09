/**
 * Labor & Delivery LOINC and SNOMED CT Code Constants
 * Standardized codes for maternal-fetal observations
 */

// =====================================================
// L&D LOINC CODES
// =====================================================

export const LD_LOINC_CODES = {
  // Newborn
  APGAR_1_MIN: '9272-6',
  APGAR_5_MIN: '9273-4',
  APGAR_10_MIN: '9274-2',
  BIRTH_WEIGHT: '8339-4',
  BIRTH_LENGTH: '89269-5',
  HEAD_CIRCUMFERENCE: '9843-4',

  // Fetal Monitoring
  FETAL_HEART_RATE: '55283-6',
  FETAL_PRESENTATION: '11876-0',

  // Maternal
  FUNDAL_HEIGHT: '11881-0',
  GESTATIONAL_AGE: '11884-4',
  GRAVIDA: '11996-6',
  PARITY: '11977-6',
  EDD: '11778-8',

  // Vitals during labor
  MATERNAL_BP_SYSTOLIC: '8480-6',
  MATERNAL_BP_DIASTOLIC: '8462-4',
  MATERNAL_HEART_RATE: '8867-4',
  MATERNAL_TEMPERATURE: '8310-5',

  // Lab
  BLOOD_TYPE: '883-9',
  RH_FACTOR: '10331-7',
  GBS_SCREEN: '21363-8',
};

// =====================================================
// L&D SNOMED CT CODES
// =====================================================

export const LD_SNOMED_CODES = {
  // Conditions
  PREGNANCY: '77386006',
  LABOR: '289259007',
  PREECLAMPSIA: '398254007',
  GESTATIONAL_DIABETES: '11687002',
  PLACENTA_PREVIA: '36813001',
  PREMATURE_LABOR: '17860005',
  POSTPARTUM_HEMORRHAGE: '47821001',

  // Delivery Methods
  SPONTANEOUS_VAGINAL: '177184002',
  CESAREAN: '11466000',
  VACUUM_DELIVERY: '61586001',
  FORCEPS_DELIVERY: '302383004',

  // Procedures
  EPIDURAL: '18946005',
  AMNIOCENTESIS: '34536000',
  FETAL_MONITORING: '252879005',
  NONSTRESS_TEST: '252888003',
  OB_ULTRASOUND: '268445003',
  INDUCTION_OF_LABOR: '236958009',
};
