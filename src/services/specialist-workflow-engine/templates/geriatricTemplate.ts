/**
 * Geriatric Care Manager Workflow Template
 * For comprehensive geriatric assessments and care coordination
 */

import { SpecialistWorkflow } from '../types';

export const geriatricWorkflow: SpecialistWorkflow = {
  id: 'geriatric-care-v1',
  version: '1.0.0',
  name: 'Geriatric Care Manager',
  description: 'Comprehensive geriatric assessment and care coordination',
  specialistType: 'Geriatric',
  icon: '👴',
  color: '#6366F1',

  assessmentFields: [
    {
      id: 'mmse',
      label: 'Mini-Mental State Exam',
      type: 'questionnaire',
      template: 'mmse',
      required: false,
      offline: true
    },
    {
      id: 'adl_assessment',
      label: 'Activities of Daily Living (ADL)',
      type: 'questionnaire',
      template: 'katz_adl',
      required: true,
      offline: true
    },
    {
      id: 'iadl_assessment',
      label: 'Instrumental ADL (IADL)',
      type: 'questionnaire',
      template: 'lawton_iadl',
      required: true,
      offline: true
    },
    {
      id: 'fall_risk',
      label: 'Fall Risk (Morse Scale)',
      type: 'questionnaire',
      template: 'morse_fall_scale',
      required: true,
      offline: true
    },
    {
      id: 'medication_review',
      label: 'Polypharmacy Review',
      type: 'photo-list',
      required: true,
      offline: true
    },
    {
      id: 'gds',
      label: 'Geriatric Depression Scale',
      type: 'questionnaire',
      template: 'gds_15',
      required: false,
      offline: true
    },
    {
      id: 'nutrition_mna',
      label: 'Mini Nutritional Assessment',
      type: 'questionnaire',
      template: 'mna_sf',
      required: true,
      offline: true
    },
    {
      id: 'caregiver_burden',
      label: 'Caregiver Burden (Zarit)',
      type: 'questionnaire',
      template: 'zarit_burden',
      required: false,
      offline: true
    },
    {
      id: 'safety_assessment',
      label: 'Home Safety Assessment',
      type: 'checklist',
      required: true,
      offline: true
    },
    {
      id: 'advance_directives',
      label: 'Advance Care Planning',
      type: 'checklist',
      required: false,
      offline: true
    }
  ],

  visitWorkflow: [
    {
      step: 1,
      name: 'Intake & History',
      action: 'check-in',
      required: true,
      estimatedMinutes: 10
    },
    {
      step: 2,
      name: 'Cognitive Assessment',
      action: 'questionnaire',
      required: false,
      estimatedMinutes: 15,
      fields: ['mmse']
    },
    {
      step: 3,
      name: 'Functional Assessment',
      action: 'questionnaire',
      required: true,
      estimatedMinutes: 20,
      fields: ['adl_assessment', 'iadl_assessment']
    },
    {
      step: 4,
      name: 'Fall Risk Evaluation',
      action: 'questionnaire',
      required: true,
      estimatedMinutes: 10,
      fields: ['fall_risk']
    },
    {
      step: 5,
      name: 'Medication Review',
      action: 'photo-reconcile',
      required: true,
      estimatedMinutes: 15,
      fields: ['medication_review']
    },
    {
      step: 6,
      name: 'Mood & Nutrition',
      action: 'questionnaire',
      required: false,
      estimatedMinutes: 15,
      fields: ['gds', 'nutrition_mna']
    },
    {
      step: 7,
      name: 'Safety & Environment',
      action: 'checklist',
      required: true,
      estimatedMinutes: 15,
      fields: ['safety_assessment']
    },
    {
      step: 8,
      name: 'Caregiver Support',
      action: 'questionnaire',
      required: false,
      estimatedMinutes: 10,
      fields: ['caregiver_burden']
    },
    {
      step: 9,
      name: 'Advance Care Planning',
      action: 'documentation',
      required: false,
      estimatedMinutes: 15,
      fields: ['advance_directives']
    },
    {
      step: 10,
      name: 'Care Plan Development',
      action: 'documentation',
      required: true,
      estimatedMinutes: 20
    }
  ],

  alertRules: [
    {
      id: 'severe-cognitive-decline',
      name: 'Severe Cognitive Impairment',
      condition: 'mmse.score < 10',
      severity: 'high',
      notifyRole: 'physician',
      within: '24hr',
      message: 'Severe cognitive impairment (MMSE <10). Medical evaluation needed.'
    },
    {
      id: 'adl-dependent',
      name: 'ADL Dependency',
      condition: 'adl_assessment.dependent_count >= 4',
      severity: 'high',
      notifyRole: 'case-manager',
      within: '24hr',
      message: 'Patient dependent in 4+ ADLs. Home care services needed.'
    },
    {
      id: 'high-fall-risk',
      name: 'High Fall Risk',
      condition: 'fall_risk.score >= 45',
      severity: 'high',
      notifyRole: 'physical-therapist',
      within: '24hr',
      message: 'High fall risk (Morse ≥45). PT evaluation recommended.'
    },
    {
      id: 'polypharmacy-concern',
      name: 'Polypharmacy Risk',
      condition: 'medication_review.count >= 10',
      severity: 'medium',
      notifyRole: 'pharmacist',
      within: '48hr',
      message: 'Patient taking 10+ medications. Medication reconciliation needed.'
    },
    {
      id: 'depression-risk',
      name: 'Depression Screening Positive',
      condition: 'gds.score >= 10',
      severity: 'high',
      notifyRole: 'behavioral-health',
      within: '24hr',
      message: 'Positive depression screen (GDS ≥10). Mental health referral needed.'
    },
    {
      id: 'malnutrition-risk',
      name: 'Malnutrition Risk',
      condition: 'nutrition_mna.risk_level == high',
      severity: 'medium',
      notifyRole: 'dietitian',
      within: '48hr',
      message: 'High malnutrition risk. Dietitian consultation recommended.'
    },
    {
      id: 'caregiver-burnout',
      name: 'Caregiver Burnout',
      condition: 'caregiver_burden.score >= 61',
      severity: 'high',
      notifyRole: 'case-manager',
      within: '24hr',
      message: 'Severe caregiver burden (Zarit ≥61). Respite care needed urgently.'
    },
    {
      id: 'unsafe-home',
      name: 'Unsafe Home Environment',
      condition: 'safety_assessment.hazards_count >= 5',
      severity: 'high',
      notifyRole: 'case-manager',
      within: '24hr',
      message: '5+ safety hazards identified. Home modifications needed.'
    }
  ],

  documentationTemplates: [
    {
      id: 'comprehensive-geriatric-assessment',
      name: 'Comprehensive Geriatric Assessment (CGA)',
      type: 'assessment',
      template: 'Full CGA with functional, cognitive, mood, nutrition, and social assessments',
      requiredFields: ['adl_assessment', 'iadl_assessment', 'fall_risk', 'medication_review', 'safety_assessment']
    }
  ],

  integrations: {
    canOrderLabs: false,
    canPrescribe: false,
    canReferTo: [
      'physician',
      'geriatrician',
      'physical-therapist',
      'occupational-therapist',
      'dietitian',
      'pharmacist',
      'behavioral-health',
      'case-manager',
      'home-health',
      'hospice',
      'palliative-care'
    ],
    canAccessPHI: [
      'demographics',
      'vitals',
      'medications',
      'lab_results',
      'functional_status',
      'cognitive_assessments',
      'advance_directives'
    ],
    billingCodes: [
      '99483', // Cognitive assessment and care plan
      '99487', // CCM complex 60+ min
      '99489', // CCM additional time
      '99490', // CCM 20+ min
      'G0506'  // Comprehensive assessment home visit
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
    defaultCodes: ['99483', '99487'],
    timeBasedBilling: true,
    requiresSignature: true,
    requiresCoSign: 'physician'
  }
};
