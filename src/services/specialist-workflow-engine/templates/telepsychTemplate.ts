/**
 * Telepsychiatrist Workflow Template
 * For rural mental health care via telemedicine
 */

import { SpecialistWorkflow } from '../types';

export const telepsychWorkflow: SpecialistWorkflow = {
  id: 'telepsych-v1',
  version: '1.0.0',
  name: 'Telepsychiatrist',
  description: 'Telemedicine psychiatric evaluation and medication management',
  specialistType: 'Telepsych',
  icon: '🧠',
  color: '#EC4899',

  assessmentFields: [
    {
      id: 'phq9',
      label: 'PHQ-9 (Depression)',
      type: 'questionnaire',
      template: 'phq9',
      required: true,
      offline: true
    },
    {
      id: 'gad7',
      label: 'GAD-7 (Anxiety)',
      type: 'questionnaire',
      template: 'gad7',
      required: true,
      offline: true
    },
    {
      id: 'columbia_suicide',
      label: 'Columbia Suicide Severity Rating',
      type: 'questionnaire',
      template: 'columbia_suicide',
      required: true,
      offline: true
    },
    {
      id: 'mood_chart',
      label: 'Mood Tracking',
      type: 'scale',
      required: false,
      offline: true,
      validation: { min: 0, max: 10 }
    },
    {
      id: 'medication_adherence',
      label: 'Medication Adherence',
      type: 'questionnaire',
      template: 'morisky',
      required: true,
      offline: true
    },
    {
      id: 'side_effects',
      label: 'Medication Side Effects',
      type: 'checklist',
      required: true,
      offline: true
    },
    {
      id: 'substance_use_audit',
      label: 'AUDIT (Alcohol Use)',
      type: 'questionnaire',
      template: 'audit',
      required: false,
      offline: true
    },
    {
      id: 'therapy_engagement',
      label: 'Therapy Participation',
      type: 'text',
      required: false,
      offline: true
    }
  ],

  visitWorkflow: [
    {
      step: 1,
      name: 'Telehealth Connection',
      action: 'video-connect',
      required: true,
      estimatedMinutes: 3
    },
    {
      step: 2,
      name: 'Safety Screening',
      action: 'questionnaire',
      required: true,
      estimatedMinutes: 5,
      fields: ['columbia_suicide']
    },
    {
      step: 3,
      name: 'Symptom Assessment',
      action: 'questionnaire',
      required: true,
      estimatedMinutes: 10,
      fields: ['phq9', 'gad7', 'mood_chart']
    },
    {
      step: 4,
      name: 'Medication Review',
      action: 'assessment',
      required: true,
      estimatedMinutes: 10,
      fields: ['medication_adherence', 'side_effects']
    },
    {
      step: 5,
      name: 'Substance Use Screening',
      action: 'questionnaire',
      required: false,
      estimatedMinutes: 5,
      fields: ['substance_use_audit']
    },
    {
      step: 6,
      name: 'Psychiatric Interview',
      action: 'clinical-interview',
      required: true,
      estimatedMinutes: 20
    },
    {
      step: 7,
      name: 'Treatment Planning',
      action: 'documentation',
      required: true,
      estimatedMinutes: 10
    },
    {
      step: 8,
      name: 'E-Prescribing',
      action: 'prescribe',
      required: false,
      estimatedMinutes: 5
    }
  ],

  alertRules: [
    {
      id: 'suicide-imminent',
      name: 'Imminent Suicide Risk',
      condition: 'columbia_suicide.imminent_risk == true',
      severity: 'critical',
      notifyRole: 'crisis-team',
      within: '5min',
      message: 'CRITICAL: Imminent suicide risk. Immediate crisis intervention required. Contact emergency services.'
    },
    {
      id: 'suicide-high-risk',
      name: 'High Suicide Risk',
      condition: 'columbia_suicide.risk_level == high',
      severity: 'critical',
      notifyRole: 'psychiatrist',
      within: '15min',
      message: 'CRITICAL: High suicide risk. Immediate psychiatric evaluation needed.'
    },
    {
      id: 'severe-depression',
      name: 'Severe Depression',
      condition: 'phq9.score >= 20',
      severity: 'high',
      notifyRole: 'psychiatrist',
      within: '24hr',
      message: 'Severe depression (PHQ-9 ≥20). Intensive treatment needed.'
    },
    {
      id: 'severe-anxiety',
      name: 'Severe Anxiety',
      condition: 'gad7.score >= 15',
      severity: 'high',
      notifyRole: 'psychiatrist',
      within: '24hr',
      message: 'Severe anxiety (GAD-7 ≥15). Treatment escalation needed.'
    },
    {
      id: 'medication-non-adherence',
      name: 'Medication Non-Adherence',
      condition: 'medication_adherence.adherent == false',
      severity: 'medium',
      notifyRole: 'case-manager',
      within: '48hr',
      message: 'Medication non-adherence detected. Barriers assessment needed.'
    },
    {
      id: 'severe-side-effects',
      name: 'Severe Medication Side Effects',
      condition: 'side_effects.severe == true',
      severity: 'high',
      notifyRole: 'psychiatrist',
      within: '24hr',
      message: 'Severe medication side effects reported. Medication change may be needed.'
    },
    {
      id: 'alcohol-dependence',
      name: 'Alcohol Dependence',
      condition: 'substance_use_audit.score >= 20',
      severity: 'high',
      notifyRole: 'addiction-specialist',
      within: '48hr',
      message: 'Likely alcohol dependence (AUDIT ≥20). Addiction services referral needed.'
    }
  ],

  documentationTemplates: [
    {
      id: 'psychiatric-progress-note',
      name: 'Psychiatric Progress Note',
      type: 'note',
      template: 'Structured psychiatric note with MSE, risk assessment, and treatment plan',
      requiredFields: ['phq9', 'gad7', 'columbia_suicide', 'medication_adherence']
    }
  ],

  integrations: {
    canOrderLabs: true,
    canPrescribe: true,
    canReferTo: [
      'therapist',
      'psychologist',
      'addiction-specialist',
      'case-manager',
      'crisis-team',
      'peer-support',
      'hospital-psych-unit'
    ],
    canAccessPHI: [
      'demographics',
      'medications',
      'mental_health_history',
      'substance_use_history',
      'lab_results',
      'hospitalization_history'
    ],
    billingCodes: [
      '90792', // Psychiatric diagnostic evaluation
      '90833', // Psychotherapy 30 min with E&M
      '90836', // Psychotherapy 45 min with E&M
      '90838', // Psychotherapy 60 min with E&M
      '90863', // Pharmacologic management
      'G2012'  // Virtual check-in 5-10 min
    ]
  },

  hipaaControls: {
    requireMFA: true,
    sessionTimeout: 15,
    requirePhotoConsent: false,
    requireLocationConsent: false,
    phiAccessLogging: true
  },

  billing: {
    defaultCodes: ['90836', '90863'],
    timeBasedBilling: true,
    requiresSignature: true
  }
};
