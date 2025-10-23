/**
 * Medication-Assisted Treatment (MAT) Provider Workflow Template
 * For opioid use disorder treatment in rural areas
 */

import { SpecialistWorkflow } from '../types';

export const matWorkflow: SpecialistWorkflow = {
  id: 'mat-provider-v1',
  version: '1.0.0',
  name: 'MAT Provider - Opioid Use Disorder',
  description: 'Medication-Assisted Treatment workflow for substance use disorders',
  specialistType: 'MAT',
  icon: '💊',
  color: '#8B5CF6',

  assessmentFields: [
    {
      id: 'cows_score',
      label: 'COWS Assessment (Opioid Withdrawal)',
      type: 'questionnaire',
      template: 'cows',
      required: true,
      offline: true
    },
    {
      id: 'urine_drug_screen',
      label: 'Urine Drug Screen',
      type: 'text',
      required: true,
      offline: false
    },
    {
      id: 'medication_count',
      label: 'Medication Pill Count',
      type: 'number',
      required: true,
      offline: true,
      validation: { min: 0 }
    },
    {
      id: 'side_effects',
      label: 'Side Effects Assessment',
      type: 'checklist',
      required: true,
      offline: true
    },
    {
      id: 'cravings_assessment',
      label: 'Cravings Scale',
      type: 'scale',
      required: true,
      offline: true,
      validation: { min: 0, max: 10 }
    },
    {
      id: 'counseling_attendance',
      label: 'Counseling Attendance',
      type: 'checklist',
      required: true,
      offline: true
    },
    {
      id: 'recovery_capital',
      label: 'Recovery Capital Assessment',
      type: 'questionnaire',
      template: 'brief_arc',
      required: false,
      offline: true
    },
    {
      id: 'suicide_screening',
      label: 'Suicide Risk Screening (Columbia)',
      type: 'questionnaire',
      template: 'columbia_suicide',
      required: true,
      offline: true
    }
  ],

  visitWorkflow: [
    {
      step: 1,
      name: 'Check-In & Privacy',
      action: 'check-in',
      required: true,
      estimatedMinutes: 2
    },
    {
      step: 2,
      name: 'Withdrawal Assessment',
      action: 'questionnaire',
      required: true,
      estimatedMinutes: 10,
      fields: ['cows_score']
    },
    {
      step: 3,
      name: 'Medication Accountability',
      action: 'pill-count',
      required: true,
      estimatedMinutes: 5,
      fields: ['medication_count']
    },
    {
      step: 4,
      name: 'Drug Screen',
      action: 'urine-test',
      required: true,
      estimatedMinutes: 10,
      fields: ['urine_drug_screen']
    },
    {
      step: 5,
      name: 'Side Effects & Cravings',
      action: 'assessment',
      required: true,
      estimatedMinutes: 10,
      fields: ['side_effects', 'cravings_assessment']
    },
    {
      step: 6,
      name: 'Suicide Screening',
      action: 'questionnaire',
      required: true,
      estimatedMinutes: 5,
      fields: ['suicide_screening']
    },
    {
      step: 7,
      name: 'Recovery Support',
      action: 'assessment',
      required: false,
      estimatedMinutes: 10,
      fields: ['counseling_attendance', 'recovery_capital']
    },
    {
      step: 8,
      name: 'Treatment Plan',
      action: 'documentation',
      required: true,
      estimatedMinutes: 10
    }
  ],

  alertRules: [
    {
      id: 'severe-withdrawal',
      name: 'Severe Opioid Withdrawal',
      condition: 'cows_score.total >= 36',
      severity: 'critical',
      notifyRole: 'physician',
      within: '15min',
      message: 'CRITICAL: Severe opioid withdrawal (COWS ≥36). Immediate medical evaluation needed.'
    },
    {
      id: 'positive-opioid-uds',
      name: 'Positive Opioid Drug Screen',
      condition: 'urine_drug_screen.opioid_positive == true',
      severity: 'high',
      notifyRole: 'mat-prescriber',
      within: '4hr',
      message: 'Positive opioid drug screen. Treatment plan review needed.'
    },
    {
      id: 'diversion-risk',
      name: 'Medication Diversion Risk',
      condition: 'medication_count.missing > 5',
      severity: 'high',
      notifyRole: 'mat-prescriber',
      within: '1hr',
      message: 'Medication count discrepancy >5 pills. Possible diversion.'
    },
    {
      id: 'suicide-risk-high',
      name: 'High Suicide Risk',
      condition: 'suicide_screening.risk_level == high',
      severity: 'critical',
      notifyRole: 'behavioral-health',
      within: '5min',
      message: 'CRITICAL: High suicide risk identified. Immediate crisis intervention required.'
    },
    {
      id: 'missed-counseling',
      name: 'Missed Counseling Sessions',
      condition: 'counseling_attendance.missed_count >= 3',
      severity: 'medium',
      notifyRole: 'counselor',
      within: '24hr',
      message: 'Patient has missed 3+ counseling sessions. Outreach needed.'
    },
    {
      id: 'high-cravings',
      name: 'Severe Cravings',
      condition: 'cravings_assessment.score >= 8',
      severity: 'high',
      notifyRole: 'mat-prescriber',
      within: '24hr',
      message: 'Severe cravings reported (8+/10). Medication adjustment may be needed.'
    }
  ],

  documentationTemplates: [
    {
      id: 'mat-visit-note',
      name: 'MAT Visit Note',
      type: 'note',
      template: 'Structured MAT visit documentation with COWS, UDS, and treatment plan',
      requiredFields: ['cows_score', 'urine_drug_screen', 'medication_count', 'suicide_screening']
    }
  ],

  integrations: {
    canOrderLabs: true,
    canPrescribe: true,
    canReferTo: ['physician', 'psychiatrist', 'counselor', 'peer-support', 'case-manager'],
    canAccessPHI: ['demographics', 'medications', 'lab_results', 'substance_use_history', 'mental_health'],
    billingCodes: [
      'H0020', // MAT services
      'G2086', // Buprenorphine induction
      'G2088', // Buprenorphine maintenance
      '99408', // Substance abuse screening 15-30 min
      '99409'  // Substance abuse screening >30 min
    ],
    requiredCredentials: ['DEA-X', 'SAMHSA-waiver']
  },

  hipaaControls: {
    requireMFA: true,
    sessionTimeout: 15,
    requirePhotoConsent: false,
    requireLocationConsent: false,
    phiAccessLogging: true
  },

  billing: {
    defaultCodes: ['H0020', 'G2088'],
    timeBasedBilling: true,
    requiresSignature: true,
    requiresCoSign: 'physician'
  }
};
