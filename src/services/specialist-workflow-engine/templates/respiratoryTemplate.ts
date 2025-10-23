/**
 * Respiratory Therapist Workflow Template
 * For COPD, asthma, and respiratory disease management in rural areas
 */

import { SpecialistWorkflow } from '../types';

export const respiratoryWorkflow: SpecialistWorkflow = {
  id: 'respiratory-therapist-v1',
  version: '1.0.0',
  name: 'Respiratory Therapist',
  description: 'Respiratory disease management and pulmonary rehabilitation',
  specialistType: 'RT',
  icon: '🫁',
  color: '#14B8A6',

  assessmentFields: [
    {
      id: 'spirometry',
      label: 'Spirometry Testing',
      type: 'spirometry',
      required: true,
      offline: false
    },
    {
      id: 'oxygen_saturation',
      label: 'Pulse Oximetry',
      type: 'number',
      required: true,
      offline: true,
      validation: { min: 0, max: 100 }
    },
    {
      id: 'cat_score',
      label: 'COPD Assessment Test (CAT)',
      type: 'questionnaire',
      template: 'copd_cat',
      required: false,
      offline: true
    },
    {
      id: 'mmrc_dyspnea',
      label: 'mMRC Dyspnea Scale',
      type: 'questionnaire',
      template: 'mmrc',
      required: true,
      offline: true
    },
    {
      id: 'inhaler_technique',
      label: 'Inhaler Technique Assessment',
      type: 'checklist',
      required: true,
      offline: true
    },
    {
      id: 'oxygen_equipment_check',
      label: 'Home Oxygen Equipment',
      type: 'checklist',
      required: false,
      offline: true
    },
    {
      id: 'smoking_status',
      label: 'Smoking Cessation Assessment',
      type: 'questionnaire',
      template: 'smoking_cessation',
      required: false,
      offline: true
    },
    {
      id: 'peak_flow',
      label: 'Peak Flow Measurement',
      type: 'number',
      required: false,
      offline: true
    },
    {
      id: 'six_minute_walk',
      label: '6-Minute Walk Test',
      type: 'number',
      required: false,
      offline: true,
      validation: { min: 0 }
    }
  ],

  visitWorkflow: [
    {
      step: 1,
      name: 'Patient Assessment',
      action: 'check-in',
      required: true,
      estimatedMinutes: 5
    },
    {
      step: 2,
      name: 'Pulse Oximetry',
      action: 'measurement',
      required: true,
      estimatedMinutes: 3,
      fields: ['oxygen_saturation']
    },
    {
      step: 3,
      name: 'Spirometry Testing',
      action: 'spirometry',
      required: true,
      estimatedMinutes: 15,
      fields: ['spirometry']
    },
    {
      step: 4,
      name: 'Symptom Assessment',
      action: 'questionnaire',
      required: true,
      estimatedMinutes: 10,
      fields: ['cat_score', 'mmrc_dyspnea']
    },
    {
      step: 5,
      name: 'Inhaler Technique Review',
      action: 'demonstration',
      required: true,
      estimatedMinutes: 15,
      fields: ['inhaler_technique']
    },
    {
      step: 6,
      name: 'Equipment Check',
      action: 'checklist',
      required: false,
      estimatedMinutes: 10,
      fields: ['oxygen_equipment_check']
    },
    {
      step: 7,
      name: 'Functional Assessment',
      action: 'measurement',
      required: false,
      estimatedMinutes: 10,
      fields: ['six_minute_walk', 'peak_flow']
    },
    {
      step: 8,
      name: 'Smoking Cessation',
      action: 'counseling',
      required: false,
      estimatedMinutes: 10,
      fields: ['smoking_status']
    },
    {
      step: 9,
      name: 'Patient Education & Plan',
      action: 'documentation',
      required: true,
      estimatedMinutes: 15
    }
  ],

  alertRules: [
    {
      id: 'critical-hypoxemia',
      name: 'Severe Hypoxemia',
      condition: 'oxygen_saturation < 85',
      severity: 'critical',
      notifyRole: 'physician',
      within: '5min',
      message: 'CRITICAL: O2 saturation <85%. Immediate medical intervention required.'
    },
    {
      id: 'moderate-hypoxemia',
      name: 'Moderate Hypoxemia',
      condition: 'oxygen_saturation < 90',
      severity: 'high',
      notifyRole: 'physician',
      within: '30min',
      message: 'O2 saturation <90%. Physician evaluation needed. Consider supplemental oxygen.'
    },
    {
      id: 'severe-obstruction',
      name: 'Severe Airflow Obstruction',
      condition: 'spirometry.fev1_percent < 30',
      severity: 'high',
      notifyRole: 'pulmonologist',
      within: '24hr',
      message: 'Severe obstruction (FEV1 <30%). Pulmonology consult recommended.'
    },
    {
      id: 'copd-exacerbation',
      name: 'COPD Exacerbation Risk',
      condition: 'cat_score.score >= 30',
      severity: 'high',
      notifyRole: 'physician',
      within: '24hr',
      message: 'High symptom burden (CAT ≥30). Possible exacerbation - evaluate for treatment intensification.'
    },
    {
      id: 'severe-dyspnea',
      name: 'Severe Dyspnea',
      condition: 'mmrc_dyspnea.grade == 4',
      severity: 'high',
      notifyRole: 'physician',
      within: '24hr',
      message: 'Severe dyspnea (mMRC grade 4). Patient too breathless to leave house.'
    },
    {
      id: 'incorrect-inhaler-use',
      name: 'Incorrect Inhaler Technique',
      condition: 'inhaler_technique.errors_count >= 3',
      severity: 'medium',
      notifyRole: 'respiratory-therapist',
      within: '48hr',
      message: 'Multiple inhaler technique errors. Re-education and follow-up needed.'
    },
    {
      id: 'oxygen-equipment-failure',
      name: 'Oxygen Equipment Malfunction',
      condition: 'oxygen_equipment_check.malfunction == true',
      severity: 'high',
      notifyRole: 'dme-company',
      within: '4hr',
      message: 'Home oxygen equipment malfunction. DME company must respond urgently.'
    },
    {
      id: 'active-smoker-copd',
      name: 'Active Smoking with COPD',
      condition: 'smoking_status.current_smoker == true',
      severity: 'medium',
      notifyRole: 'smoking-cessation',
      within: '48hr',
      message: 'Active smoker with respiratory disease. Smoking cessation program referral.'
    }
  ],

  documentationTemplates: [
    {
      id: 'respiratory-therapy-note',
      name: 'Respiratory Therapy Note',
      type: 'note',
      template: 'RT assessment with spirometry, oxygen saturation, symptom scores, and treatment plan',
      requiredFields: ['spirometry', 'oxygen_saturation', 'mmrc_dyspnea', 'inhaler_technique']
    }
  ],

  integrations: {
    canOrderLabs: false,
    canPrescribe: false,
    canReferTo: [
      'physician',
      'pulmonologist',
      'smoking-cessation',
      'pulmonary-rehab',
      'dme-company',
      'home-health'
    ],
    canAccessPHI: [
      'demographics',
      'vitals',
      'medications',
      'pulmonary_function_tests',
      'smoking_history',
      'oxygen_therapy_orders'
    ],
    billingCodes: [
      '94010', // Spirometry
      '94060', // Bronchodilator responsiveness
      '94664', // Aerosol or vapor inhalation treatment
      '94667', // Chest wall manipulation
      '94726', // Plethysmography
      '94729', // DLCO
      'G0237', // Therapeutic procedures to increase strength
      'G0238'  // Respiratory therapy
    ]
  },

  hipaaControls: {
    requireMFA: false,
    sessionTimeout: 20,
    requirePhotoConsent: false,
    requireLocationConsent: false,
    phiAccessLogging: true
  },

  billing: {
    defaultCodes: ['94010', '94664'],
    timeBasedBilling: false,
    requiresSignature: true,
    requiresCoSign: 'physician'
  }
};
