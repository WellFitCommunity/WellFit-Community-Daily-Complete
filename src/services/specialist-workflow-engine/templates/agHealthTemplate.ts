/**
 * Agricultural Health Specialist Workflow Template
 * For farmworkers and agricultural occupational health
 */

import { SpecialistWorkflow } from '../types';

export const agHealthWorkflow: SpecialistWorkflow = {
  id: 'ag-health-v1',
  version: '1.0.0',
  name: 'Agricultural Medicine Specialist',
  description: 'Occupational health workflow for agricultural workers',
  specialistType: 'AgHealth',
  icon: '🌾',
  color: '#F59E0B',

  assessmentFields: [
    {
      id: 'exposure_screening',
      label: 'Pesticide/Chemical Exposure Screening',
      type: 'questionnaire',
      template: 'pesticide_exposure',
      required: true,
      offline: true
    },
    {
      id: 'respiratory_assessment',
      label: 'Respiratory Function',
      type: 'spirometry',
      required: true,
      offline: false
    },
    {
      id: 'skin_inspection',
      label: 'Dermatological Inspection',
      type: 'photo-single',
      required: false,
      offline: true
    },
    {
      id: 'injury_assessment',
      label: 'Injury/Musculoskeletal Assessment',
      type: 'body-diagram',
      required: false,
      offline: true
    },
    {
      id: 'heat_illness_screening',
      label: 'Heat Illness Risk',
      type: 'questionnaire',
      template: 'heat_illness',
      required: true,
      offline: true
    },
    {
      id: 'ppe_compliance',
      label: 'PPE Usage Assessment',
      type: 'checklist',
      required: true,
      offline: true
    }
  ],

  visitWorkflow: [
    {
      step: 1,
      name: 'Safety Check-In',
      action: 'gps-verify',
      required: true,
      estimatedMinutes: 2
    },
    {
      step: 2,
      name: 'Exposure History',
      action: 'questionnaire',
      required: true,
      estimatedMinutes: 15,
      fields: ['exposure_screening', 'ppe_compliance']
    },
    {
      step: 3,
      name: 'Respiratory Assessment',
      action: 'spirometry',
      required: true,
      estimatedMinutes: 10,
      fields: ['respiratory_assessment']
    },
    {
      step: 4,
      name: 'Physical Examination',
      action: 'examination',
      required: true,
      estimatedMinutes: 15,
      fields: ['skin_inspection', 'injury_assessment']
    },
    {
      step: 5,
      name: 'Heat Stress Evaluation',
      action: 'questionnaire',
      required: true,
      estimatedMinutes: 5,
      fields: ['heat_illness_screening']
    },
    {
      step: 6,
      name: 'Education & Recommendations',
      action: 'documentation',
      required: true,
      estimatedMinutes: 10
    },
    {
      step: 7,
      name: 'Complete Assessment',
      action: 'finalize',
      required: true,
      estimatedMinutes: 3
    }
  ],

  alertRules: [
    {
      id: 'acute-pesticide-exposure',
      name: 'Acute Pesticide Poisoning',
      condition: 'exposure_screening.acute_symptoms == true',
      severity: 'critical',
      notifyRole: 'physician',
      within: '5min',
      message: 'CRITICAL: Suspected acute pesticide poisoning. Immediate medical attention required.'
    },
    {
      id: 'respiratory-decline',
      name: 'Abnormal Spirometry',
      condition: 'respiratory_assessment.fev1_percent < 80',
      severity: 'high',
      notifyRole: 'pulmonologist',
      within: '24hr',
      message: 'Abnormal spirometry results. Pulmonology referral needed.'
    },
    {
      id: 'heat-illness-risk',
      name: 'High Heat Illness Risk',
      condition: 'heat_illness_screening.risk_level == high',
      severity: 'high',
      notifyRole: 'physician',
      within: '4hr',
      message: 'High risk for heat illness. Immediate workplace modifications needed.'
    },
    {
      id: 'ppe-non-compliance',
      name: 'PPE Non-Compliance',
      condition: 'ppe_compliance.compliant == false',
      severity: 'medium',
      notifyRole: 'safety-officer',
      within: '24hr',
      message: 'Worker not using required PPE. Safety officer intervention needed.'
    }
  ],

  documentationTemplates: [
    {
      id: 'ag-health-assessment',
      name: 'Agricultural Health Assessment',
      type: 'assessment',
      template: 'Standard occupational health assessment for agricultural workers',
      requiredFields: ['exposure_screening', 'respiratory_assessment', 'ppe_compliance']
    }
  ],

  integrations: {
    canOrderLabs: true,
    canPrescribe: false,
    canReferTo: ['physician', 'pulmonologist', 'dermatologist', 'occupational-therapy'],
    canAccessPHI: ['demographics', 'vitals', 'lab_results', 'work_history', 'exposure_records'],
    billingCodes: ['99213', '99214', '94010', '94060'] // Office visit + spirometry
  },

  hipaaControls: {
    requireMFA: true,
    sessionTimeout: 15,
    requirePhotoConsent: true,
    requireLocationConsent: false,
    phiAccessLogging: true
  },

  billing: {
    defaultCodes: ['99213', '94010'],
    timeBasedBilling: false,
    requiresSignature: true
  }
};
