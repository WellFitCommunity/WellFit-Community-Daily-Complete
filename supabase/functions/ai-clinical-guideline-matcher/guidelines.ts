/**
 * Static Clinical Guidelines Database
 *
 * Evidence-based guideline references and preventive screening definitions
 * used for rule-based matching against patient conditions.
 *
 * @module ai-clinical-guideline-matcher/guidelines
 */

import type { ClinicalGuideline, ScreeningConfig } from "./types.ts";

// =====================================================
// MAJOR CLINICAL GUIDELINES
// =====================================================

export const MAJOR_GUIDELINES: Record<string, ClinicalGuideline[]> = {
  diabetes: [
    {
      guidelineId: "ada-2024",
      guidelineName: "ADA Standards of Care in Diabetes",
      organization: "American Diabetes Association",
      year: 2024,
      condition: "Diabetes Mellitus",
      conditionCode: "E11",
      url: "https://diabetesjournals.org/care",
    },
    {
      guidelineId: "aace-2023",
      guidelineName: "AACE Clinical Practice Guidelines",
      organization: "American Association of Clinical Endocrinologists",
      year: 2023,
      condition: "Diabetes Mellitus",
      conditionCode: "E11",
    },
  ],
  hypertension: [
    {
      guidelineId: "acc-aha-htn-2017",
      guidelineName: "ACC/AHA Hypertension Guidelines",
      organization: "American College of Cardiology/American Heart Association",
      year: 2017,
      condition: "Hypertension",
      conditionCode: "I10",
    },
  ],
  hyperlipidemia: [
    {
      guidelineId: "acc-aha-chol-2018",
      guidelineName: "ACC/AHA Cholesterol Guidelines",
      organization: "American College of Cardiology/American Heart Association",
      year: 2018,
      condition: "Hyperlipidemia",
      conditionCode: "E78",
    },
  ],
  heart_failure: [
    {
      guidelineId: "acc-aha-hf-2022",
      guidelineName: "ACC/AHA Heart Failure Guidelines",
      organization: "American College of Cardiology/American Heart Association",
      year: 2022,
      condition: "Heart Failure",
      conditionCode: "I50",
    },
  ],
  copd: [
    {
      guidelineId: "gold-2024",
      guidelineName: "GOLD Guidelines",
      organization: "Global Initiative for Chronic Obstructive Lung Disease",
      year: 2024,
      condition: "COPD",
      conditionCode: "J44",
    },
  ],
  asthma: [
    {
      guidelineId: "gina-2024",
      guidelineName: "GINA Guidelines",
      organization: "Global Initiative for Asthma",
      year: 2024,
      condition: "Asthma",
      conditionCode: "J45",
    },
  ],
  afib: [
    {
      guidelineId: "acc-aha-afib-2023",
      guidelineName: "ACC/AHA/ACCP/HRS Atrial Fibrillation Guidelines",
      organization: "American College of Cardiology",
      year: 2023,
      condition: "Atrial Fibrillation",
      conditionCode: "I48",
    },
  ],
  ckd: [
    {
      guidelineId: "kdigo-2024",
      guidelineName: "KDIGO Clinical Practice Guidelines",
      organization: "Kidney Disease: Improving Global Outcomes",
      year: 2024,
      condition: "Chronic Kidney Disease",
      conditionCode: "N18",
    },
  ],
  osteoporosis: [
    {
      guidelineId: "aace-osteo-2020",
      guidelineName: "AACE/ACE Osteoporosis Guidelines",
      organization: "American Association of Clinical Endocrinologists",
      year: 2020,
      condition: "Osteoporosis",
      conditionCode: "M81",
    },
  ],
  depression: [
    {
      guidelineId: "apa-mdd-2023",
      guidelineName: "APA Practice Guidelines for Depression",
      organization: "American Psychiatric Association",
      year: 2023,
      condition: "Major Depressive Disorder",
      conditionCode: "F32",
    },
  ],
  cad: [
    {
      guidelineId: "acc-aha-cad-2023",
      guidelineName: "ACC/AHA Chronic Coronary Disease Guidelines",
      organization: "American College of Cardiology/American Heart Association",
      year: 2023,
      condition: "Coronary Artery Disease",
      conditionCode: "I25",
    },
  ],
};

// =====================================================
// PREVENTIVE SCREENING DEFINITIONS
// =====================================================

export const PREVENTIVE_SCREENINGS: Record<string, ScreeningConfig> = {
  colonoscopy: {
    name: "Colorectal Cancer Screening",
    frequency: "every 10 years",
    ages: { min: 45, max: 75 },
    guidelineSource: "USPSTF 2021",
  },
  mammogram: {
    name: "Breast Cancer Screening",
    frequency: "every 2 years",
    ages: { min: 50, max: 74 },
    sex: "female",
    guidelineSource: "USPSTF 2024",
  },
  pap_smear: {
    name: "Cervical Cancer Screening",
    frequency: "every 3 years",
    ages: { min: 21, max: 65 },
    sex: "female",
    guidelineSource: "USPSTF 2018",
  },
  bone_density: {
    name: "Osteoporosis Screening",
    frequency: "baseline at 65",
    ages: { min: 65 },
    sex: "female",
    guidelineSource: "USPSTF 2018",
  },
  aaa_screening: {
    name: "Abdominal Aortic Aneurysm Screening",
    frequency: "one-time",
    ages: { min: 65, max: 75 },
    sex: "male",
    guidelineSource: "USPSTF 2019",
  },
  lung_cancer: {
    name: "Lung Cancer Screening (LDCT)",
    frequency: "annually",
    ages: { min: 50, max: 80 },
    guidelineSource: "USPSTF 2021",
  },
  diabetes_screening: {
    name: "Diabetes Screening",
    frequency: "every 3 years",
    ages: { min: 35, max: 70 },
    guidelineSource: "USPSTF 2021",
  },
  lipid_panel: {
    name: "Lipid Panel",
    frequency: "every 5 years",
    ages: { min: 40, max: 75 },
    guidelineSource: "USPSTF 2016",
  },
  hiv_screening: {
    name: "HIV Screening",
    frequency: "at least once",
    ages: { min: 15, max: 65 },
    guidelineSource: "USPSTF 2019",
  },
  hep_c: {
    name: "Hepatitis C Screening",
    frequency: "one-time",
    ages: { min: 18, max: 79 },
    guidelineSource: "USPSTF 2020",
  },
};
