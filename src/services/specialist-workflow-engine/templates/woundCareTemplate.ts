/**
 * Wound Care Specialist Workflow Template
 * For diabetic wounds, pressure ulcers, and chronic wound management
 */

import { SpecialistWorkflow } from '../types';

export const woundCareWorkflow: SpecialistWorkflow = {
  id: 'wound-care-v1',
  version: '1.0.0',
  name: 'Wound Care Specialist',
  description: 'Chronic wound assessment and treatment workflow',
  specialistType: 'WoundCare',
  icon: '🩹',
  color: '#EF4444',

  assessmentFields: [
    {
      id: 'wound_photos',
      label: 'Wound Photography (with ruler)',
      type: 'photo-list',
      required: true,
      offline: true
    },
    {
      id: 'wound_measurement',
      label: 'Wound Dimensions',
      type: 'number',
      required: true,
      offline: true
    },
    {
      id: 'wound_characteristics',
      label: 'Wound Characteristics',
      type: 'checklist',
      required: true,
      offline: true
    },
    {
      id: 'pain_assessment',
      label: 'Pain Scale',
      type: 'scale',
      required: true,
      offline: true,
      validation: { min: 0, max: 10 }
    },
    {
      id: 'push_score',
      label: 'PUSH Score (Pressure Ulcer Scale)',
      type: 'questionnaire',
      template: 'push',
      required: false,
      offline: true
    },
    {
      id: 'circulation_assessment',
      label: 'Circulation Check',
      type: 'checklist',
      required: true,
      offline: true
    },
    {
      id: 'infection_signs',
      label: 'Signs of Infection',
      type: 'checklist',
      required: true,
      offline: true
    },
    {
      id: 'treatment_applied',
      label: 'Treatment & Dressing',
      type: 'checklist',
      required: true,
      offline: true
    }
  ],

  visitWorkflow: [
    {
      step: 1,
      name: 'Patient Preparation',
      action: 'check-in',
      required: true,
      estimatedMinutes: 5
    },
    {
      step: 2,
      name: 'Pain Assessment',
      action: 'assessment',
      required: true,
      estimatedMinutes: 3,
      fields: ['pain_assessment']
    },
    {
      step: 3,
      name: 'Wound Photography',
      action: 'photo-documentation',
      required: true,
      estimatedMinutes: 5,
      fields: ['wound_photos']
    },
    {
      step: 4,
      name: 'Wound Measurement',
      action: 'measurement',
      required: true,
      estimatedMinutes: 5,
      fields: ['wound_measurement', 'wound_characteristics']
    },
    {
      step: 5,
      name: 'Infection Assessment',
      action: 'assessment',
      required: true,
      estimatedMinutes: 5,
      fields: ['infection_signs', 'circulation_assessment']
    },
    {
      step: 6,
      name: 'PUSH Scoring',
      action: 'questionnaire',
      required: false,
      estimatedMinutes: 3,
      fields: ['push_score']
    },
    {
      step: 7,
      name: 'Wound Care Treatment',
      action: 'treatment',
      required: true,
      estimatedMinutes: 20,
      fields: ['treatment_applied']
    },
    {
      step: 8,
      name: 'Documentation & Education',
      action: 'documentation',
      required: true,
      estimatedMinutes: 10
    }
  ],

  alertRules: [
    {
      id: 'wound-infection-critical',
      name: 'Severe Wound Infection',
      condition: 'infection_signs.systemic_signs == true',
      severity: 'critical',
      notifyRole: 'physician',
      within: '15min',
      message: 'CRITICAL: Systemic infection signs (fever, sepsis). Immediate hospitalization may be needed.'
    },
    {
      id: 'wound-deteriorating',
      name: 'Wound Deterioration',
      condition: 'wound_measurement.size_increase > 20',
      severity: 'high',
      notifyRole: 'wound-care-specialist',
      within: '24hr',
      message: 'Wound size increased >20%. Treatment plan revision needed.'
    },
    {
      id: 'poor-circulation',
      name: 'Inadequate Circulation',
      condition: 'circulation_assessment.pulses_absent == true',
      severity: 'high',
      notifyRole: 'vascular-surgeon',
      within: '24hr',
      message: 'Absent pulses detected. Vascular surgery consult needed.'
    },
    {
      id: 'severe-pain',
      name: 'Severe Wound Pain',
      condition: 'pain_assessment.score >= 8',
      severity: 'high',
      notifyRole: 'physician',
      within: '4hr',
      message: 'Severe pain (8+/10) reported. Pain management review needed.'
    },
    {
      id: 'local-infection',
      name: 'Local Wound Infection',
      condition: 'infection_signs.purulent_drainage == true',
      severity: 'medium',
      notifyRole: 'physician',
      within: '24hr',
      message: 'Purulent drainage observed. Consider antibiotic therapy.'
    }
  ],

  documentationTemplates: [
    {
      id: 'wound-care-note',
      name: 'Wound Care Visit Note',
      type: 'note',
      template: 'Detailed wound assessment with measurements, photos, and treatment plan',
      requiredFields: ['wound_photos', 'wound_measurement', 'infection_signs', 'treatment_applied']
    }
  ],

  integrations: {
    canOrderLabs: true,
    canPrescribe: false,
    canReferTo: ['physician', 'vascular-surgeon', 'endocrinologist', 'infectious-disease', 'dietitian'],
    canAccessPHI: ['demographics', 'vitals', 'lab_results', 'medications', 'wound_history'],
    billingCodes: [
      '97597', // Debridement <20 cm
      '97598', // Debridement 20+ cm
      '97602', // Wound care non-selective
      '97605', // Negative pressure wound therapy
      '11042', // Debridement subcutaneous
      '11043'  // Debridement muscle/fascia
    ]
  },

  hipaaControls: {
    requireMFA: false,
    sessionTimeout: 20,
    requirePhotoConsent: true,
    requireLocationConsent: false,
    phiAccessLogging: true
  },

  billing: {
    defaultCodes: ['97602'],
    timeBasedBilling: false,
    requiresSignature: true
  }
};
