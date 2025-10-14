// Billing Decision Tree Types
// Implements integral minimum logic for smart billing and coding

export interface DecisionTreeInput {
  // Patient Information
  patientId: string;
  payerId: string;
  policyStatus: 'active' | 'inactive' | 'pending';
  memberNumber?: string;

  // Clinical Service Information
  encounterId: string;
  encounterType: EncounterType;
  serviceDate: string;

  // Clinical Documentation
  chiefComplaint?: string;
  presentingDiagnoses: DiagnosisInput[];
  proceduresPerformed: ProcedureInput[];
  timeSpent?: number; // minutes
  medicalDecisionMaking?: MDMComplexity;

  // Provider Information
  providerId: string;
  placeOfService?: string;
}

export type EncounterType =
  | 'office_visit'
  | 'telehealth'
  | 'surgery'
  | 'procedure'
  | 'lab'
  | 'radiology'
  | 'emergency'
  | 'inpatient'
  | 'consultation';

export interface DiagnosisInput {
  term: string;
  icd10Code?: string;
  isPrimary?: boolean;
  clinicalNotes?: string;
}

export interface ProcedureInput {
  description: string;
  cptCode?: string;
  duration?: number;
  clinicalNotes?: string;
}

export type MDMComplexity = 'straightforward' | 'low' | 'moderate' | 'high';

// Decision Tree Node Results
export interface DecisionTreeResult {
  success: boolean;
  claimLine: BillableClaimLine | null;
  decisions: DecisionNode[];
  validationErrors: ValidationIssue[];
  warnings: ValidationIssue[];
  requiresManualReview: boolean;
  manualReviewReason?: string;
}

export interface BillableClaimLine {
  cptCode: string;
  cptModifiers: string[];
  icd10Codes: string[]; // Ordered by priority (primary first)
  billedAmount: number;
  allowedAmount?: number;
  payerId: string;
  serviceDate: string;
  units: number;
  placeOfService?: string;
  renderingProviderId: string;
  medicalNecessityValidated: boolean;
}

export interface DecisionNode {
  nodeId: string;
  nodeName: string;
  question: string;
  answer: string | boolean;
  result: 'proceed' | 'deny' | 'manual_review' | 'complete';
  rationale: string;
  timestamp: string;
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  field?: string;
  suggestion?: string;
}

// Node A: Eligibility and Authorization
export interface EligibilityCheckResult {
  eligible: boolean;
  authorized: boolean;
  authorizationRequired: boolean;
  authorizationNumber?: string;
  coverageDetails?: CoverageDetails;
  denialReason?: string;
}

export interface CoverageDetails {
  planName: string;
  effectiveDate: string;
  terminationDate?: string;
  copay?: number;
  deductible?: number;
  deductibleMet?: number;
  outOfPocketMax?: number;
  outOfPocketMet?: number;
}

// Node B: Service Classification
export interface ServiceClassification {
  classificationType: 'procedural' | 'evaluation_management' | 'both' | 'unknown';
  confidence: number;
  rationale: string;
}

// Node C: Procedure Logic
export interface ProcedureLookupResult {
  found: boolean;
  cptCode?: string;
  cptDescription?: string;
  requiresModifier?: boolean;
  suggestedModifiers?: string[];
  isUnlistedProcedure?: boolean;
}

// Node D: E/M Logic
export interface EMEvaluationResult {
  levelDetermined: boolean;
  emLevel?: number; // 1-5
  emCode?: string; // e.g., 99213, 99203
  newPatient?: boolean;
  timeBasedCoding: boolean;
  mdmBasedCoding: boolean;
  documentationScore: number; // 0-100
  missingElements?: string[];
}

// Node E: Modifier Logic
export interface ModifierDecision {
  modifiersApplied: string[];
  modifierRationale: Record<string, string>;
  specialCircumstances: string[];
}

// Node F: Fee Schedule Lookup
export interface FeeScheduleResult {
  feeFound: boolean;
  contractedRate?: number;
  chargemasterRate?: number;
  appliedRate: number;
  rateSource: 'contracted' | 'chargemaster' | 'default' | 'medicare';
  allowedAmount?: number;
}

// Medical Necessity Validation
export interface MedicalNecessityCheck {
  isValid: boolean;
  cptCode: string;
  icd10Codes: string[];
  validCombinations: Array<{
    cpt: string;
    icd10: string;
    valid: boolean;
    reason?: string;
  }>;
  ncdReference?: string; // National Coverage Determination
  lcdReference?: string; // Local Coverage Determination
}

// E/M Documentation Requirements
export interface EMDocumentationElements {
  // History
  historyOfPresentIllness: boolean;
  reviewOfSystems: boolean;
  pastFamilySocialHistory: boolean;

  // Examination
  examinationPerformed: boolean;
  examinationDetail: 'problem_focused' | 'expanded' | 'detailed' | 'comprehensive';

  // Medical Decision Making
  numberOfDiagnoses: number;
  amountOfData: 'minimal' | 'limited' | 'moderate' | 'extensive';
  riskLevel: 'minimal' | 'low' | 'moderate' | 'high';

  // Time
  totalTime?: number;
  counselingTime?: number;
  coordinationTime?: number;

  // Overall Score
  documentationCompletenesScore: number; // 0-100
}

// CPT-ICD10 Validation Rules
export interface CodingRule {
  ruleId: string;
  cptCode: string;
  requiredICD10Patterns?: string[]; // e.g., ["E11.*", "I10"]
  excludedICD10Patterns?: string[];
  requiredModifiers?: string[];
  ageRestrictions?: {
    minAge?: number;
    maxAge?: number;
  };
  genderRestrictions?: ('M' | 'F')[];
  frequencyLimits?: {
    maxPerDay?: number;
    maxPerMonth?: number;
    maxPerYear?: number;
  };
  active: boolean;
  effectiveDate: string;
  source: 'cms' | 'payer' | 'internal';
}

// Lookup Table Structures
export interface CPTLookupEntry {
  cptCode: string;
  description: string;
  category: string;
  subcategory?: string;
  requiresModifier: boolean;
  commonModifiers: string[];
  averageDuration?: number; // minutes
  relativeValueUnit?: number;
  billingClass: 'procedure' | 'em' | 'anesthesia' | 'radiology' | 'pathology';
  active: boolean;
}

export interface ICD10LookupEntry {
  icd10Code: string;
  description: string;
  chapter: string;
  category: string;
  billable: boolean;
  validFrom: string;
  validTo?: string;
  active: boolean;
}

export interface ModifierLookupEntry {
  modifierCode: string;
  description: string;
  applicableScenarios: string[];
  impactOnReimbursement: 'increase' | 'decrease' | 'none' | 'variable';
  reimbursementMultiplier?: number; // e.g., 0.5 for 50% reduction
  active: boolean;
}

// 80/20 Rule Configuration
export interface CommonScenarioConfig {
  scenarioId: string;
  name: string;
  encounterTypes: EncounterType[];
  defaultCPTCodes: string[];
  defaultICD10Codes: string[];
  frequency: number; // percentage of encounters
  autoApproveThreshold: number; // confidence threshold for auto-approval
  requiresReview: boolean;
}

// Decision Tree Configuration
export interface DecisionTreeConfig {
  enableEligibilityCheck: boolean;
  requireAuthorization: boolean;
  enableMedicalNecessityCheck: boolean;
  enable80_20FastPath: boolean;
  commonScenarios: CommonScenarioConfig[];
  manualReviewThreshold: number; // confidence threshold below which manual review is required
  autoApproveConfidence: number; // confidence threshold for auto-approval
}

// Export for service use
export interface BillingDecisionTreeService {
  processEncounter(input: DecisionTreeInput, config?: DecisionTreeConfig): Promise<DecisionTreeResult>;
  validateEligibility(patientId: string, payerId: string): Promise<EligibilityCheckResult>;
  classifyService(input: DecisionTreeInput): Promise<ServiceClassification>;
  lookupProcedureCPT(procedureDescription: string): Promise<ProcedureLookupResult>;
  evaluateEMLevel(input: DecisionTreeInput, documentation: EMDocumentationElements): Promise<EMEvaluationResult>;
  determineModifiers(cptCode: string, circumstances: string[]): Promise<ModifierDecision>;
  lookupFee(cptCode: string, payerId: string, providerId: string): Promise<FeeScheduleResult>;
  validateMedicalNecessity(cptCode: string, icd10Codes: string[]): Promise<MedicalNecessityCheck>;
}
