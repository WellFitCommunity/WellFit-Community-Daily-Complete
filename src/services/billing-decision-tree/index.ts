// Billing Decision Tree Service
// Implements integral minimum logic for smart billing and coding
// Follows the 80/20 rule: handles common scenarios efficiently, routes complex cases to manual review
// HIPAA §164.312(b): PHI access logging enabled

import { auditLogger } from '../auditLogger';

// Import types
import type {
  DecisionTreeInput,
  DecisionTreeResult,
  BillableClaimLine,
  DecisionNode,
  ValidationIssue,
  DecisionTreeConfig,
} from './types';

// Import node functions
import { executeNodeA, validateEligibility } from './eligibilityNode';
import { executeNodeB, classifyService, validatePlaceOfService, getEMCodeRangeForPOS } from './serviceClassificationNode';
import { executeNodeC, lookupProcedureCPT } from './procedureLookupNode';
import { executeNodeD, evaluateEMLevel, generateEMCode, isNewPatient, calculateMDMLevel } from './emEvaluationNode';
import { executeNodeE, determineModifiers, checkProlongedServices } from './modifierNode';
import { executeNodeF, lookupFee } from './feeScheduleNode';
import { validateMedicalNecessity, assignICD10Codes } from './medicalNecessityService';
import { enhanceWithSDOH } from './sdohEnhancement';
import { isEMCode, isProcedureCode, assessRiskLevel, matchesPattern } from './utils';

// Default configuration
const defaultConfig: DecisionTreeConfig = {
  enableEligibilityCheck: true,
  requireAuthorization: false,
  enableMedicalNecessityCheck: true,
  enable80_20FastPath: true,
  manualReviewThreshold: 70,
  autoApproveConfidence: 90,
  commonScenarios: [
    {
      scenarioId: 'routine_office_visit',
      name: 'Routine Office Visit',
      encounterTypes: ['office_visit'],
      defaultCPTCodes: ['99213', '99214'],
      defaultICD10Codes: ['Z00.00'],
      frequency: 45,
      autoApproveThreshold: 85,
      requiresReview: false
    },
    {
      scenarioId: 'telehealth_visit',
      name: 'Telehealth Visit',
      encounterTypes: ['telehealth'],
      defaultCPTCodes: ['99213', '99214'],
      defaultICD10Codes: ['Z00.00'],
      frequency: 25,
      autoApproveThreshold: 85,
      requiresReview: false
    }
  ]
};

/**
 * Main entry point: Process encounter through decision tree
 * Implements the integral minimum logic path from encounter to billable claim
 */
async function processEncounter(
  input: DecisionTreeInput,
  _config: DecisionTreeConfig = defaultConfig
): Promise<DecisionTreeResult> {
  const decisions: DecisionNode[] = [];
  const validationErrors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  let requiresManualReview = false;
  let manualReviewReason: string | undefined;

  // HIPAA §164.312(b): Log PHI access for billing processing
  await auditLogger.phi('BILLING_DECISION_TREE_PROCESS', input.patientId, {
    resourceType: 'Claim',
    operation: 'processEncounter',
    encounterType: input.encounterType,
    payerId: input.payerId,
  });

  try {
    // NODE A: Eligibility and Authorization Validation
    const eligibilityResult = await executeNodeA(input, decisions);

    if (!eligibilityResult.eligible) {
      return {
        success: false,
        claimLine: null,
        decisions,
        validationErrors: [
          {
            severity: 'error',
            code: 'INELIGIBLE',
            message: eligibilityResult.denialReason || 'Patient not eligible for service',
            suggestion: 'Verify patient insurance status and coverage dates'
          }
        ],
        warnings,
        requiresManualReview: false
      };
    }

    if (eligibilityResult.authorizationRequired && !eligibilityResult.authorized) {
      return {
        success: false,
        claimLine: null,
        decisions,
        validationErrors: [
          {
            severity: 'error',
            code: 'AUTHORIZATION_REQUIRED',
            message: 'Prior authorization required but not obtained',
            suggestion: 'Submit prior authorization request to payer'
          }
        ],
        warnings,
        requiresManualReview: false
      };
    }

    // NODE B: Service Classification (Procedural vs E/M)
    const classification = await executeNodeB(input, decisions);

    let cptCode: string | undefined;
    let cptModifiers: string[] = [];
    let icd10Codes: string[] = [];

    // Handle based on classification
    if (classification.classificationType === 'procedural') {
      // NODE C: Procedure Logic
      const procedureResult = await executeNodeC(input, decisions);

      if (!procedureResult.found || procedureResult.isUnlistedProcedure) {
        requiresManualReview = true;
        manualReviewReason = 'Unlisted procedure code - requires manual review';
        warnings.push({
          severity: 'warning',
          code: 'UNLISTED_PROCEDURE',
          message: 'Procedure not found in CPT reference table',
          suggestion: 'Use appropriate unlisted procedure code or consult coding specialist'
        });
      } else {
        cptCode = procedureResult.cptCode;
        if (procedureResult.suggestedModifiers) {
          cptModifiers = procedureResult.suggestedModifiers;
        }
      }
    } else if (classification.classificationType === 'evaluation_management') {
      // NODE D: E/M Logic
      const emResult = await executeNodeD(input, decisions);

      if (!emResult.levelDetermined) {
        requiresManualReview = true;
        manualReviewReason = 'Unable to determine E/M level - insufficient documentation';
        warnings.push({
          severity: 'warning',
          code: 'EM_LEVEL_UNDETERMINED',
          message: 'E/M level could not be determined',
          suggestion: `Missing documentation elements: ${emResult.missingElements?.join(', ')}`
        });
      } else {
        cptCode = emResult.emCode;
      }
    } else {
      requiresManualReview = true;
      manualReviewReason = 'Complex encounter requires manual classification';
    }

    // If no CPT code determined, require manual review
    if (!cptCode) {
      return {
        success: false,
        claimLine: null,
        decisions,
        validationErrors: [],
        warnings,
        requiresManualReview: true,
        manualReviewReason
      };
    }

    // Check for prolonged services (99417) if E/M code and time exceeds base
    const prolongedServices = await checkProlongedServices(
      cptCode,
      input.timeSpent,
      classification.classificationType === 'evaluation_management'
    );

    // NODE E: Modifier Logic
    const modifierResult = await executeNodeE(cptCode, input, decisions, prolongedServices);
    cptModifiers = [...cptModifiers, ...modifierResult.modifiersApplied];

    // Assign ICD-10 codes
    icd10Codes = await assignICD10Codes(input);

    // Validate Medical Necessity
    const medicalNecessityCheck = await validateMedicalNecessity(cptCode, icd10Codes);

    if (!medicalNecessityCheck.isValid) {
      validationErrors.push({
        severity: 'error',
        code: 'MEDICAL_NECESSITY_FAILED',
        message: 'CPT and ICD-10 combination does not meet medical necessity requirements',
        suggestion: 'Review diagnosis codes and ensure they support the procedure'
      });

      return {
        success: false,
        claimLine: null,
        decisions,
        validationErrors,
        warnings,
        requiresManualReview: true,
        manualReviewReason: 'Medical necessity validation failed'
      };
    }

    // NODE F: Fee Schedule Lookup
    const feeResult = await executeNodeF(cptCode, input.payerId, input.providerId, decisions);

    // Create billable claim line
    const claimLine: BillableClaimLine = {
      cptCode,
      cptModifiers,
      icd10Codes,
      billedAmount: feeResult.appliedRate,
      allowedAmount: feeResult.allowedAmount,
      payerId: input.payerId,
      serviceDate: input.serviceDate,
      units: 1,
      placeOfService: input.placeOfService,
      renderingProviderId: input.providerId,
      medicalNecessityValidated: true
    };

    // Add prolonged services as additional claim lines if applicable
    const additionalClaimLines: BillableClaimLine[] = [];
    if (modifierResult.prolongedServices?.applies && modifierResult.prolongedServices.additionalCPT) {
      const prolongedFee = await lookupFee(
        modifierResult.prolongedServices.additionalCPT,
        input.payerId,
        input.providerId
      );

      additionalClaimLines.push({
        cptCode: modifierResult.prolongedServices.additionalCPT,
        cptModifiers: [],
        icd10Codes, // Same diagnoses as primary E/M
        billedAmount: prolongedFee.appliedRate,
        allowedAmount: prolongedFee.allowedAmount,
        payerId: input.payerId,
        serviceDate: input.serviceDate,
        units: modifierResult.prolongedServices.units,
        placeOfService: input.placeOfService,
        renderingProviderId: input.providerId,
        medicalNecessityValidated: true
      });
    }

    // Final decision node
    decisions.push({
      nodeId: 'FINAL',
      nodeName: 'Claim Line Generation',
      question: 'Generate final billable claim line?',
      answer: 'Yes',
      result: 'complete',
      rationale: `Successfully generated claim line: ${cptCode} with ${icd10Codes.length} diagnosis codes${additionalClaimLines.length > 0 ? ` + ${additionalClaimLines.length} additional lines (prolonged services)` : ''}`,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      claimLine,
      additionalClaimLines,
      decisions,
      validationErrors,
      warnings,
      requiresManualReview
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    auditLogger.error('Failed to process billing encounter', errorMessage, { patientId: input.patientId });

    return {
      success: false,
      claimLine: null,
      decisions,
      validationErrors: [
        {
          severity: 'error',
          code: 'PROCESSING_ERROR',
          message: `Error processing encounter: ${errorMessage}`
        }
      ],
      warnings,
      requiresManualReview: true,
      manualReviewReason: `System error: ${errorMessage}`
    };
  }
}

/**
 * BillingDecisionTreeService class - maintains backward compatibility
 * All methods are static for stateless operation
 */
export class BillingDecisionTreeService {
  static defaultConfig = defaultConfig;

  // Main entry point
  static processEncounter = processEncounter;

  // Node A: Eligibility
  static validateEligibility = validateEligibility;

  // Node B: Service Classification
  static classifyService = classifyService;

  // Node C: Procedure Lookup
  static lookupProcedureCPT = lookupProcedureCPT;

  // Node D: E/M Evaluation
  static evaluateEMLevel = evaluateEMLevel;

  // Node E: Modifiers
  static determineModifiers = determineModifiers;

  // Node F: Fee Schedule
  static lookupFee = lookupFee;

  // Medical Necessity
  static validateMedicalNecessity = validateMedicalNecessity;

  // SDOH Enhancement
  static enhanceWithSDOH = enhanceWithSDOH;
}

// Re-export types
export type {
  DecisionTreeInput,
  DecisionTreeResult,
  BillableClaimLine,
  DecisionNode,
  ValidationIssue,
  DecisionTreeConfig,
} from './types';

// Re-export individual functions for direct use
export {
  // Orchestrator
  processEncounter,
  defaultConfig,

  // Node A: Eligibility
  executeNodeA,
  validateEligibility,

  // Node B: Service Classification
  executeNodeB,
  classifyService,
  validatePlaceOfService,
  getEMCodeRangeForPOS,

  // Node C: Procedure Lookup
  executeNodeC,
  lookupProcedureCPT,

  // Node D: E/M Evaluation
  executeNodeD,
  evaluateEMLevel,
  generateEMCode,
  isNewPatient,
  calculateMDMLevel,

  // Node E: Modifiers
  executeNodeE,
  determineModifiers,
  checkProlongedServices,

  // Node F: Fee Schedule
  executeNodeF,
  lookupFee,

  // Medical Necessity
  validateMedicalNecessity,
  assignICD10Codes,

  // SDOH Enhancement
  enhanceWithSDOH,

  // Utilities
  isEMCode,
  isProcedureCode,
  assessRiskLevel,
  matchesPattern,
};

export default BillingDecisionTreeService;
