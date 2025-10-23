/**
 * Community Health Worker (CHW) Workflow Template
 * For rural home visits, SDOH screening, medication reconciliation, and care coordination
 */

import { SpecialistWorkflow } from '../types';

export const chwWorkflow: SpecialistWorkflow = {
  id: 'chw-rural-v1',
  version: '1.0.0',
  name: 'Community Health Worker - Rural Care',
  description: 'Home visit workflow for Community Health Workers serving rural populations',
  specialistType: 'CHW',
  icon: '🏠',
  color: '#10B981',

  assessmentFields: [
    {
      id: 'vitals',
      label: 'Vital Signs',
      type: 'vitals',
      required: true,
      offline: true
    },
    {
      id: 'medications',
      label: 'Medication Review',
      type: 'photo-list',
      required: true,
      offline: true
    },
    {
      id: 'sdoh_prapare',
      label: 'PRAPARE SDOH Assessment',
      type: 'questionnaire',
      template: 'prapare',
      required: false,
      offline: true
    },
    {
      id: 'home_safety',
      label: 'Home Safety Checklist',
      type: 'checklist',
      required: false,
      offline: true
    },
    {
      id: 'fall_risk',
      label: 'Fall Risk Assessment',
      type: 'questionnaire',
      template: 'morse_fall_scale',
      required: false,
      offline: true
    },
    {
      id: 'nutrition_screening',
      label: 'Nutrition Screening',
      type: 'questionnaire',
      template: 'determine',
      required: false,
      offline: true
    },
    {
      id: 'depression_phq2',
      label: 'Depression Screening (PHQ-2)',
      type: 'questionnaire',
      template: 'phq2',
      required: false,
      offline: true
    },
    {
      id: 'visit_notes',
      label: 'Visit Notes',
      type: 'text',
      required: true,
      offline: true
    },
    {
      id: 'patient_education',
      label: 'Patient Education Provided',
      type: 'checklist',
      required: false,
      offline: true
    },
    {
      id: 'barriers_identified',
      label: 'Barriers to Care',
      type: 'checklist',
      required: false,
      offline: true
    }
  ],

  visitWorkflow: [
    {
      step: 1,
      name: 'Check-In',
      description: 'Verify location and start visit',
      action: 'gps-verify',
      required: true,
      estimatedMinutes: 1
    },
    {
      step: 2,
      name: 'Vital Signs',
      description: 'Measure BP, HR, O2, weight, temperature',
      action: 'capture-vitals',
      required: true,
      estimatedMinutes: 5,
      fields: ['vitals']
    },
    {
      step: 3,
      name: 'Medication Reconciliation',
      description: 'Photo all medication bottles, verify adherence',
      action: 'photo-reconcile',
      required: true,
      estimatedMinutes: 10,
      fields: ['medications']
    },
    {
      step: 4,
      name: 'SDOH Assessment',
      description: 'Screen for social determinants of health',
      action: 'questionnaire',
      required: false,
      estimatedMinutes: 10,
      fields: ['sdoh_prapare']
    },
    {
      step: 5,
      name: 'Health Screenings',
      description: 'Fall risk, nutrition, depression screenings',
      action: 'questionnaire',
      required: false,
      estimatedMinutes: 10,
      fields: ['fall_risk', 'nutrition_screening', 'depression_phq2']
    },
    {
      step: 6,
      name: 'Home Safety',
      description: 'Assess home environment for safety hazards',
      action: 'checklist',
      required: false,
      estimatedMinutes: 5,
      fields: ['home_safety']
    },
    {
      step: 7,
      name: 'Patient Education',
      description: 'Provide education, identify barriers',
      action: 'documentation',
      required: true,
      estimatedMinutes: 10,
      fields: ['patient_education', 'barriers_identified', 'visit_notes']
    },
    {
      step: 8,
      name: 'Check-Out',
      description: 'Complete visit and schedule follow-up',
      action: 'gps-verify',
      required: true,
      estimatedMinutes: 2
    }
  ],

  alertRules: [
    {
      id: 'critical-bp-high',
      name: 'Hypertensive Crisis',
      condition: 'vitals.systolic > 180',
      severity: 'critical',
      notifyRole: 'physician',
      within: '15min',
      message: 'Critical: BP >180 systolic detected during home visit. Immediate physician review required.'
    },
    {
      id: 'critical-bp-low',
      name: 'Severe Hypotension',
      condition: 'vitals.systolic < 90',
      severity: 'critical',
      notifyRole: 'physician',
      within: '15min',
      message: 'Critical: BP <90 systolic detected. Patient may be in shock.'
    },
    {
      id: 'critical-o2-low',
      name: 'Hypoxemia',
      condition: 'vitals.oxygen_saturation < 88',
      severity: 'critical',
      notifyRole: 'physician',
      within: '15min',
      message: 'Critical: O2 saturation <88%. Immediate intervention needed.'
    },
    {
      id: 'high-bp-elevated',
      name: 'Elevated Blood Pressure',
      condition: 'vitals.systolic > 160',
      severity: 'high',
      notifyRole: 'physician',
      within: '4hr',
      message: 'High: BP >160 systolic. Physician review needed within 4 hours.'
    },
    {
      id: 'med-adherence-issue',
      name: 'Medication Non-Adherence',
      condition: 'medications.missing_doses == true',
      severity: 'medium',
      notifyRole: 'pharmacist',
      within: '24hr',
      message: 'Patient reports missing medication doses. Pharmacist intervention needed.'
    },
    {
      id: 'food-insecurity',
      name: 'Food Insecurity Identified',
      condition: 'sdoh_prapare.food_insecurity == true',
      severity: 'medium',
      notifyRole: 'case-manager',
      within: '24hr',
      message: 'Food insecurity identified. Connect patient to food resources.'
    },
    {
      id: 'housing-unstable',
      name: 'Housing Instability',
      condition: 'sdoh_prapare.housing_unstable == true',
      severity: 'high',
      notifyRole: 'case-manager',
      within: '4hr',
      message: 'Housing instability detected. Urgent case management needed.'
    },
    {
      id: 'fall-risk-high',
      name: 'High Fall Risk',
      condition: 'fall_risk.score > 45',
      severity: 'high',
      notifyRole: 'physical-therapist',
      within: '24hr',
      message: 'High fall risk identified. PT evaluation recommended.'
    },
    {
      id: 'depression-positive',
      name: 'Positive Depression Screen',
      condition: 'depression_phq2.score >= 3',
      severity: 'high',
      notifyRole: 'behavioral-health',
      within: '24hr',
      message: 'Positive depression screening. Behavioral health referral needed.'
    },
    {
      id: 'no-medications',
      name: 'No Medications in Home',
      condition: 'medications.count == 0',
      severity: 'high',
      notifyRole: 'pharmacist',
      within: '4hr',
      message: 'No medications found in home. Patient may have run out. Urgent pharmacy contact needed.'
    }
  ],

  documentationTemplates: [
    {
      id: 'chw-visit-note',
      name: 'CHW Home Visit Note',
      type: 'note',
      template: `Community Health Worker Home Visit

PATIENT: {{patient.name}}
DATE: {{visit.date}}
TIME: {{visit.check_in_time}} - {{visit.check_out_time}}

VITAL SIGNS:
BP: {{vitals.systolic}}/{{vitals.diastolic}} mmHg
HR: {{vitals.heart_rate}} bpm
O2 Sat: {{vitals.oxygen_saturation}}%
Weight: {{vitals.weight}} lbs
Temp: {{vitals.temperature}}°F

MEDICATIONS REVIEWED:
{{medications.list}}
Adherence: {{medications.adherence_status}}

SOCIAL DETERMINANTS:
{{sdoh_summary}}

ASSESSMENT:
{{visit_notes}}

EDUCATION PROVIDED:
{{patient_education}}

BARRIERS IDENTIFIED:
{{barriers_identified}}

FOLLOW-UP NEEDED:
{{follow_up_actions}}

CHW Signature: {{specialist.name}}
Date: {{visit.date}}`,
      requiredFields: ['vitals', 'medications', 'visit_notes']
    }
  ],

  integrations: {
    canOrderLabs: false,
    canPrescribe: false,
    canReferTo: [
      'physician',
      'case-manager',
      'pharmacist',
      'physical-therapist',
      'behavioral-health',
      'dietitian',
      'transportation',
      'food-bank',
      'utility-assistance',
      'housing-assistance'
    ],
    canAccessPHI: [
      'demographics',
      'vitals',
      'medications',
      'appointments',
      'care_plans',
      'sdoh_data'
    ],
    billingCodes: [
      'G0506', // CHW visit 30 min
      'G0507', // CHW visit 60 min
      'S0280', // Medical home care coordination
      'S0281', // Home health aide services
      '99490', // CCM 20+ minutes
      '99439'  // Additional CCM time
    ]
  },

  hipaaControls: {
    requireMFA: false,
    sessionTimeout: 30,
    requirePhotoConsent: true,
    requireLocationConsent: true,
    phiAccessLogging: true
  },

  billing: {
    defaultCodes: ['G0506'],
    timeBasedBilling: true,
    requiresSignature: true,
    requiresCoSign: 'physician'
  }
};
