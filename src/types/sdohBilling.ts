// SDOH (Social Determinants of Health) billing types for WellFit Community
// Enhanced billing support for Z-codes and CCM complexity assessment

export interface SDOHFactor {
  zCode: string;
  description: string;
  severity: 'mild' | 'moderate' | 'severe';
  impact: 'low' | 'medium' | 'high';
  documented: boolean;
  source: string;
}

export interface SDOHAssessment {
  id?: string;
  patientId: string;
  encounterId?: string;
  assessmentDate: string;
  housingInstability: SDOHFactor | null;
  foodInsecurity: SDOHFactor | null;
  transportationBarriers: SDOHFactor | null;
  socialIsolation: SDOHFactor | null;
  financialInsecurity: SDOHFactor | null;
  educationBarriers: SDOHFactor | null;
  employmentConcerns: SDOHFactor | null;
  overallComplexityScore: number;
  ccmEligible: boolean;
  ccmTier: 'standard' | 'complex' | 'non-eligible';
}

export interface CCMBillingCodes {
  '99490': {
    description: 'Chronic care management services, first 20 minutes';
    timeRequired: 20;
    baseReimbursement: number;
  };
  '99491': {
    description: 'Chronic care management services, each additional 20 minutes';
    timeRequired: 20;
    baseReimbursement: number;
  };
  '99487': {
    description: 'Complex chronic care management services, first 60 minutes';
    timeRequired: 60;
    baseReimbursement: number;
    requiresSDOH: boolean;
  };
  '99489': {
    description: 'Complex chronic care management services, each additional 30 minutes';
    timeRequired: 30;
    baseReimbursement: number;
  };
}

export interface ZCodeMapping {
  'Z59.0': {
    category: 'housing';
    description: 'Homelessness';
    complexityWeight: 3;
    ccmImpact: 'high';
  };
  'Z59.1': {
    category: 'housing';
    description: 'Inadequate housing';
    complexityWeight: 2;
    ccmImpact: 'medium';
  };
  'Z59.3': {
    category: 'nutrition';
    description: 'Problems related to housing and economic circumstances, food insecurity';
    complexityWeight: 2;
    ccmImpact: 'high';
  };
  'Z59.8': {
    category: 'transportation';
    description: 'Other problems related to housing and economic circumstances';
    complexityWeight: 2;
    ccmImpact: 'medium';
  };
  'Z60.2': {
    category: 'social';
    description: 'Problems related to living alone';
    complexityWeight: 1;
    ccmImpact: 'medium';
  };
  'Z59.6': {
    category: 'financial';
    description: 'Low income';
    complexityWeight: 2;
    ccmImpact: 'medium';
  };
}

export interface CCMTimeTracking {
  id?: string;
  encounterId: string;
  patientId: string;
  serviceDate: string;
  activities: CCMActivity[];
  totalMinutes: number;
  billableMinutes: number;
  suggestedCodes: string[];
  isCompliant: boolean;
  complianceNotes: string[];
}

export interface CCMActivity {
  type: 'assessment' | 'care_coordination' | 'medication_mgmt' | 'patient_education' | 'communication';
  duration: number;
  description: string;
  provider: string;
  billable: boolean;
}

export interface CMSDocumentation {
  id?: string;
  encounterId: string;
  patientId: string;
  consentObtained: boolean;
  consentDate?: string;
  carePlanUpdated: boolean;
  carePlanDate?: string;
  patientAccessProvided: boolean;
  communicationLog: CMSCommunication[];
  qualityMeasures: QualityMeasure[];
}

export interface CMSCommunication {
  date: string;
  type: 'phone' | 'secure_message' | 'email' | 'in_person';
  duration?: number;
  summary: string;
  provider: string;
  billable: boolean;
}

export interface QualityMeasure {
  measure: string;
  value: string | number;
  target: string | number;
  achieved: boolean;
  date: string;
}

export interface EnhancedCodingSuggestion {
  medicalCodes: {
    icd10: Array<{
      code: string;
      rationale: string;
      principal: boolean;
      category: 'medical' | 'sdoh';
    }>;
  };
  procedureCodes: {
    cpt: Array<{
      code: string;
      modifiers?: string[];
      rationale: string;
      timeRequired?: number;
      sdohJustification?: string;
    }>;
    hcpcs: Array<{
      code: string;
      modifiers?: string[];
      rationale: string;
    }>;
  };
  sdohAssessment: SDOHAssessment;
  ccmRecommendation: {
    eligible: boolean;
    tier: 'standard' | 'complex' | 'non-eligible';
    justification: string;
    expectedReimbursement: number;
    requiredDocumentation: string[];
  };
  auditReadiness: {
    score: number;
    missingElements: string[];
    recommendations: string[];
  };
  confidence: number;
  notes: string;
}

export interface BillingValidation {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  auditFlags: AuditFlag[];
}

export interface ValidationError {
  code: string;
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationWarning {
  code: string;
  field: string;
  message: string;
  recommendation: string;
}

export interface AuditFlag {
  type: 'documentation' | 'coding' | 'compliance' | 'financial';
  risk: 'low' | 'medium' | 'high';
  description: string;
  remediation: string;
}

// Z-Code constants for easy reference
export const ZCODE_MAPPING: Record<string, {
  category: string;
  description: string;
  complexityWeight: number;
  ccmImpact: 'low' | 'medium' | 'high';
}> = {
  'Z59.0': {
    category: 'housing',
    description: 'Homelessness',
    complexityWeight: 3,
    ccmImpact: 'high'
  },
  'Z59.1': {
    category: 'housing',
    description: 'Inadequate housing',
    complexityWeight: 2,
    ccmImpact: 'medium'
  },
  'Z59.3': {
    category: 'nutrition',
    description: 'Problems related to housing and economic circumstances, food insecurity',
    complexityWeight: 2,
    ccmImpact: 'high'
  },
  'Z59.8': {
    category: 'transportation',
    description: 'Other problems related to housing and economic circumstances',
    complexityWeight: 2,
    ccmImpact: 'medium'
  },
  'Z60.2': {
    category: 'social',
    description: 'Problems related to living alone',
    complexityWeight: 1,
    ccmImpact: 'medium'
  },
  'Z59.6': {
    category: 'financial',
    description: 'Low income',
    complexityWeight: 2,
    ccmImpact: 'medium'
  }
};

// CCM Billing codes with reimbursement data (2024 Medicare rates - update annually)
export const CCM_CODES: Record<string, {
  description: string;
  timeRequired: number;
  baseReimbursement: number;
  requiresSDOH?: boolean;
}> = {
  '99490': {
    description: 'Chronic care management services, first 20 minutes',
    timeRequired: 20,
    baseReimbursement: 64.72
  },
  '99491': {
    description: 'Chronic care management services, each additional 20 minutes',
    timeRequired: 20,
    baseReimbursement: 58.34
  },
  '99487': {
    description: 'Complex chronic care management services, first 60 minutes',
    timeRequired: 60,
    baseReimbursement: 145.60,
    requiresSDOH: true
  },
  '99489': {
    description: 'Complex chronic care management services, each additional 30 minutes',
    timeRequired: 30,
    baseReimbursement: 69.72
  }
};

export interface SDOHBillingEncoder {
  analyzeEncounter(encounterId: string): Promise<EnhancedCodingSuggestion>;
  assessSDOHComplexity(patientId: string): Promise<SDOHAssessment>;
  calculateCCMEligibility(assessment: SDOHAssessment, medicalConditions: string[]): Promise<{
    eligible: boolean;
    tier: string;
    justification: string;
  }>;
  generateCMSDocumentation(encounterId: string): Promise<CMSDocumentation>;
  validateBillingCompliance(suggestion: EnhancedCodingSuggestion): Promise<BillingValidation>;
  trackCCMTime(encounterId: string, activities: CCMActivity[]): Promise<CCMTimeTracking>;
}