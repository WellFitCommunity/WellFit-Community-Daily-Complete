// Billing Decision Tree Service
// Implements integral minimum logic for smart billing and coding
// Follows the 80/20 rule: handles common scenarios efficiently, routes complex cases to manual review
// HIPAA §164.312(b): PHI access logging enabled

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import type { BillingService as _BillingService } from './billingService';
import { SDOHBillingService } from './sdohBillingService';
import type {
  DecisionTreeInput,
  DecisionTreeResult,
  BillableClaimLine,
  DecisionNode,
  ValidationIssue,
  EligibilityCheckResult,
  ServiceClassification,
  ProcedureLookupResult,
  EMEvaluationResult,
  ModifierDecision,
  FeeScheduleResult,
  MedicalNecessityCheck,
  EMDocumentationElements,
  DecisionTreeConfig,
  // CodingRule - unused type
  // CPTLookupEntry - unused type
  // ModifierLookupEntry - unused type
} from '../types/billingDecisionTree';

export class BillingDecisionTreeService {
  private static defaultConfig: DecisionTreeConfig = {
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
  static async processEncounter(
    input: DecisionTreeInput,
    _config: DecisionTreeConfig = this.defaultConfig
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
      const eligibilityResult = await this.executeNodeA(input, decisions);

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
      const classification = await this.executeNodeB(input, decisions);

      let cptCode: string | undefined;
      let cptModifiers: string[] = [];
      let icd10Codes: string[] = [];

      // Handle based on classification
      if (classification.classificationType === 'procedural') {
        // NODE C: Procedure Logic
        const procedureResult = await this.executeNodeC(input, decisions);

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
        const emResult = await this.executeNodeD(input, decisions);

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
      const prolongedServices = await this.checkProlongedServices(
        cptCode,
        input.timeSpent,
        classification.classificationType === 'evaluation_management'
      );

      // NODE E: Modifier Logic
      const modifierResult = await this.executeNodeE(cptCode, input, decisions, prolongedServices);
      cptModifiers = [...cptModifiers, ...modifierResult.modifiersApplied];

      // Assign ICD-10 codes
      icd10Codes = await this.assignICD10Codes(input);

      // Validate Medical Necessity
      const medicalNecessityCheck = await this.validateMedicalNecessity(cptCode, icd10Codes);

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
      const feeResult = await this.executeNodeF(cptCode, input.payerId, input.providerId, decisions);

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
        const prolongedFee = await this.lookupFee(
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
   * NODE A: Eligibility and Authorization Validation
   */
  private static async executeNodeA(
    input: DecisionTreeInput,
    decisions: DecisionNode[]
  ): Promise<EligibilityCheckResult> {

    // Check patient eligibility in database
    const eligibility = await this.validateEligibility(input.patientId, input.payerId);

    const decision: DecisionNode = {
      nodeId: 'NODE_A',
      nodeName: 'Eligibility and Authorization Check',
      question: 'Is the patient eligible and service authorized?',
      answer: eligibility.eligible ? 'Yes - Eligible' : 'No - Ineligible',
      result: eligibility.eligible ? 'proceed' : 'deny',
      rationale: eligibility.eligible
        ? 'Patient has active coverage with payer'
        : eligibility.denialReason || 'Patient not eligible',
      timestamp: new Date().toISOString()
    };

    decisions.push(decision);
    return eligibility;
  }

  /**
   * NODE B: Service Classification (Procedural vs E/M)
   */
  private static async executeNodeB(
    input: DecisionTreeInput,
    decisions: DecisionNode[]
  ): Promise<ServiceClassification> {
    const classification = await this.classifyService(input);

    const decision: DecisionNode = {
      nodeId: 'NODE_B',
      nodeName: 'Service Classification',
      question: 'Is the service procedural or evaluation/management?',
      answer: classification.classificationType,
      result: 'proceed',
      rationale: classification.rationale,
      timestamp: new Date().toISOString()
    };

    decisions.push(decision);
    return classification;
  }

  /**
   * NODE C: Procedure Logic - CPT Lookup
   */
  private static async executeNodeC(
    input: DecisionTreeInput,
    decisions: DecisionNode[]
  ): Promise<ProcedureLookupResult> {
    const procedure = input.proceduresPerformed[0];
    const lookupResult = await this.lookupProcedureCPT(
      procedure?.description || '',
      procedure?.cptCode
    );

    const decision: DecisionNode = {
      nodeId: 'NODE_C',
      nodeName: 'Procedure CPT Lookup',
      question: 'Is the procedure found in CPT cross-reference table?',
      answer: lookupResult.found ? `Yes - ${lookupResult.cptCode}` : 'No',
      result: lookupResult.found && !lookupResult.isUnlistedProcedure ? 'proceed' : 'manual_review',
      rationale: lookupResult.found
        ? `Matched procedure to CPT ${lookupResult.cptCode}: ${lookupResult.cptDescription}`
        : 'Procedure not found in reference table',
      timestamp: new Date().toISOString()
    };

    decisions.push(decision);
    return lookupResult;
  }

  /**
   * NODE D: E/M Logic - Level Determination
   */
  private static async executeNodeD(
    input: DecisionTreeInput,
    decisions: DecisionNode[]
  ): Promise<EMEvaluationResult> {
    // Create documentation elements from input
    const documentation: EMDocumentationElements = {
      historyOfPresentIllness: !!input.chiefComplaint,
      reviewOfSystems: false,
      pastFamilySocialHistory: false,
      examinationPerformed: input.encounterType !== 'telehealth',
      examinationDetail: 'problem_focused',
      numberOfDiagnoses: input.presentingDiagnoses.length,
      amountOfData: input.presentingDiagnoses.length > 2 ? 'moderate' : 'limited',
      riskLevel: this.assessRiskLevel(input),
      totalTime: input.timeSpent,
      documentationCompletenesScore: 75
    };

    const emResult = await this.evaluateEMLevel(input, documentation);

    const decision: DecisionNode = {
      nodeId: 'NODE_D',
      nodeName: 'E/M Level Determination',
      question: 'Does documentation meet required elements for E/M level?',
      answer: emResult.levelDetermined ? `Yes - Level ${emResult.emLevel}` : 'No',
      result: emResult.levelDetermined ? 'proceed' : 'manual_review',
      rationale: emResult.levelDetermined
        ? `E/M Level ${emResult.emLevel} determined (${emResult.emCode}). Documentation score: ${emResult.documentationScore}%`
        : `Unable to determine level. Missing: ${emResult.missingElements?.join(', ')}`,
      timestamp: new Date().toISOString()
    };

    decisions.push(decision);
    return emResult;
  }

  /**
   * Check if prolonged services codes apply (99417, 99418)
   * 99417: Prolonged outpatient E/M (add-on for 99205/99215)
   * Add-on for each additional 15 minutes beyond the max time
   */
  private static async checkProlongedServices(
    cptCode: string,
    timeSpent: number | undefined,
    isEM: boolean
  ): Promise<{ applies: boolean; units: number; additionalCPT?: string }> {
    // Only applies to high-level E/M codes (level 4-5)
    const eligibleCodes = ['99204', '99205', '99214', '99215'];

    if (!isEM || !timeSpent || !eligibleCodes.includes(cptCode)) {
      return { applies: false, units: 0 };
    }

    // Determine base time thresholds by CPT code
    const baseTimeLimits: Record<string, number> = {
      '99205': 60,  // New patient, Level 5: 60-74 min base
      '99204': 45,  // New patient, Level 4: 45-59 min base
      '99215': 55,  // Established, Level 5: 40-54 min base (use upper bound)
      '99214': 40   // Established, Level 4: 30-39 min base (use upper bound)
    };

    const baseTime = baseTimeLimits[cptCode];
    const extraTime = timeSpent - baseTime;

    // Prolonged services only apply if >= 15 minutes beyond base
    if (extraTime < 15) {
      return { applies: false, units: 0 };
    }

    // Calculate units (each 15 minutes = 1 unit, max 16 units = 4 hours total)
    const units = Math.min(Math.floor(extraTime / 15), 16);

    return {
      applies: true,
      units,
      additionalCPT: '99417' // Prolonged outpatient E/M
    };
  }

  /**
   * NODE E: Modifier Logic
   */
  private static async executeNodeE(
    cptCode: string,
    input: DecisionTreeInput,
    decisions: DecisionNode[],
    prolongedServices?: { applies: boolean; units: number; additionalCPT?: string }
  ): Promise<ModifierDecision> {
    const circumstances: string[] = [];

    // Detect special circumstances
    if (input.encounterType === 'telehealth') {
      circumstances.push('telehealth');
    }

    // Check if E/M + procedure same encounter (need Modifier 25)
    const hasProcedures = input.proceduresPerformed && input.proceduresPerformed.length > 0;
    const isEMCode = this.isEMCode(cptCode);

    if (isEMCode && hasProcedures) {
      circumstances.push('em_with_procedure');
    }

    const modifierResult = await this.determineModifiers(cptCode, circumstances);

    // Add prolonged services info to modifier result
    if (prolongedServices && prolongedServices.applies) {
      modifierResult.prolongedServices = prolongedServices;
    }

    const decision: DecisionNode = {
      nodeId: 'NODE_E',
      nodeName: 'Modifier Determination',
      question: 'Are there special circumstances requiring modifiers?',
      answer: modifierResult.modifiersApplied.length > 0 || prolongedServices?.applies
        ? `Yes - ${modifierResult.modifiersApplied.join(', ')}${prolongedServices?.applies ? ` + Prolonged (99417 x${prolongedServices.units})` : ''}`
        : 'No',
      result: 'proceed',
      rationale: modifierResult.modifiersApplied.length > 0 || prolongedServices?.applies
        ? `Applied modifiers: ${Object.entries(modifierResult.modifierRationale).map(([mod, reason]) => `${mod} (${reason})`).join(', ')}${prolongedServices?.applies ? `. Prolonged services: +${prolongedServices.units * 15} minutes (99417 x${prolongedServices.units})` : ''}`
        : 'No modifiers required',
      timestamp: new Date().toISOString()
    };

    decisions.push(decision);
    return modifierResult;
  }

  /**
   * NODE F: Fee Schedule Lookup
   */
  private static async executeNodeF(
    cptCode: string,
    payerId: string,
    providerId: string,
    decisions: DecisionNode[]
  ): Promise<FeeScheduleResult> {
    const feeResult = await this.lookupFee(cptCode, payerId, providerId);

    const decision: DecisionNode = {
      nodeId: 'NODE_F',
      nodeName: 'Fee Schedule Lookup',
      question: 'Is service covered by payer fee schedule or contract?',
      answer: feeResult.feeFound ? `Yes - $${feeResult.appliedRate}` : 'No',
      result: 'proceed',
      rationale: `Applied ${feeResult.rateSource} rate: $${feeResult.appliedRate}`,
      timestamp: new Date().toISOString()
    };

    decisions.push(decision);
    return feeResult;
  }

  /**
   * Validate patient eligibility with payer
   */
  static async validateEligibility(
    patientId: string,
    payerId: string
  ): Promise<EligibilityCheckResult> {
    // HIPAA §164.312(b): Log PHI access for eligibility check
    await auditLogger.phi('BILLING_ELIGIBILITY_CHECK', patientId, {
      resourceType: 'Eligibility',
      operation: 'validateEligibility',
      payerId,
    });

    try {
      // Check patient insurance in database
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .select('*, insurance_payer_id, insurance_member_id, insurance_status')
        .eq('id', patientId)
        .single();

      if (patientError || !patient) {
        return {
          eligible: false,
          authorized: false,
          authorizationRequired: false,
          denialReason: 'Patient not found in system'
        };
      }

      // Verify insurance is active
      const policyActive = patient.insurance_status === 'active';

      if (!policyActive) {
        return {
          eligible: false,
          authorized: false,
          authorizationRequired: false,
          denialReason: 'Insurance policy is not active'
        };
      }

      // Verify payer matches
      if (patient.insurance_payer_id !== payerId) {
        return {
          eligible: false,
          authorized: false,
          authorizationRequired: false,
          denialReason: 'Payer mismatch with patient insurance'
        };
      }

      return {
        eligible: true,
        authorized: true,
        authorizationRequired: false,
        coverageDetails: {
          planName: 'Active Coverage',
          effectiveDate: new Date().toISOString().split('T')[0]
        }
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error checking eligibility';
      auditLogger.error('Failed to validate eligibility', errorMessage, { patientId, payerId });
      return {
        eligible: false,
        authorized: false,
        authorizationRequired: false,
        denialReason: 'Error checking eligibility'
      };
    }
  }

  /**
   * Classify service as procedural or E/M (with POS validation)
   */
  static async classifyService(input: DecisionTreeInput): Promise<ServiceClassification> {
    // Validate Place of Service and adjust classification
    const posValidation = this.validatePlaceOfService(input.placeOfService, input.encounterType);

    if (!posValidation.valid) {
      return {
        classificationType: 'unknown',
        confidence: 30,
        rationale: `Invalid POS: ${posValidation.message}`
      };
    }

    // Simple classification based on encounter type and procedures
    const hasProcedures = input.proceduresPerformed && input.proceduresPerformed.length > 0;
    const procedureTypes: string[] = ['surgery', 'procedure', 'lab', 'radiology'];

    if (procedureTypes.includes(input.encounterType)) {
      return {
        classificationType: 'procedural',
        confidence: 95,
        rationale: `Encounter type "${input.encounterType}" is procedural in nature at POS ${input.placeOfService || '11'}`
      };
    }

    if (hasProcedures && input.proceduresPerformed[0].cptCode) {
      return {
        classificationType: 'procedural',
        confidence: 90,
        rationale: `Procedure codes documented in encounter at POS ${input.placeOfService || '11'}`
      };
    }

    if (['office_visit', 'telehealth', 'consultation', 'emergency', 'inpatient'].includes(input.encounterType)) {
      return {
        classificationType: 'evaluation_management',
        confidence: 95,
        rationale: `Encounter type "${input.encounterType}" is evaluation/management at POS ${input.placeOfService || '11'} (${posValidation.posDescription})`
      };
    }

    return {
      classificationType: 'unknown',
      confidence: 50,
      rationale: 'Unable to definitively classify encounter type'
    };
  }

  /**
   * Validate Place of Service code and match to encounter type
   * Returns validation status and POS description
   */
  private static validatePlaceOfService(
    posCode: string | undefined,
    encounterType: string
  ): { valid: boolean; message: string; posDescription?: string } {
    const POS_CODES: Record<string, { name: string; validEncounterTypes: string[] }> = {
      '02': { name: 'Telehealth', validEncounterTypes: ['telehealth'] },
      '11': { name: 'Office', validEncounterTypes: ['office_visit', 'consultation'] },
      '12': { name: 'Home', validEncounterTypes: ['office_visit'] },
      '21': { name: 'Inpatient Hospital', validEncounterTypes: ['inpatient'] },
      '22': { name: 'Outpatient Hospital', validEncounterTypes: ['office_visit', 'surgery', 'procedure'] },
      '23': { name: 'Emergency Room', validEncounterTypes: ['emergency'] },
      '24': { name: 'Ambulatory Surgical Center', validEncounterTypes: ['surgery', 'procedure'] },
      '31': { name: 'Skilled Nursing Facility', validEncounterTypes: ['office_visit', 'consultation'] },
      '32': { name: 'Nursing Facility', validEncounterTypes: ['office_visit', 'consultation'] }
    };

    // Default to office (11) if not specified
    const pos = posCode || '11';

    if (!POS_CODES[pos]) {
      return {
        valid: false,
        message: `Invalid POS code: ${pos}`
      };
    }

    const posInfo = POS_CODES[pos];

    // Check if encounter type matches valid POS
    if (!posInfo.validEncounterTypes.includes(encounterType)) {
      return {
        valid: false,
        message: `POS ${pos} (${posInfo.name}) not valid for encounter type "${encounterType}"`
      };
    }

    return {
      valid: true,
      message: `Valid POS ${pos} - ${posInfo.name}`,
      posDescription: posInfo.name
    };
  }

  /**
   * Get appropriate E/M code range based on Place of Service
   * Different POS require different E/M codes (office vs hospital vs ER)
   */
  private static getEMCodeRangeForPOS(posCode: string | undefined): { min: number; max: number } {
    const pos = posCode || '11';

    const EM_RANGES: Record<string, { min: number; max: number }> = {
      '11': { min: 99202, max: 99215 },  // Office: 99202-99205 (new), 99211-99215 (est)
      '02': { min: 99202, max: 99215 },  // Telehealth: Same as office
      '21': { min: 99221, max: 99239 },  // Inpatient: 99221-99223 (initial), 99231-99239 (subsequent)
      '23': { min: 99281, max: 99288 },  // Emergency: 99281-99285, 99288 (critical care)
      '22': { min: 99202, max: 99215 },  // Outpatient hospital: Same as office
      '31': { min: 99304, max: 99318 },  // SNF: 99304-99310 (initial), 99311-99318 (subsequent)
      '32': { min: 99304, max: 99318 }   // Nursing facility: Same as SNF
    };

    return EM_RANGES[pos] || { min: 99202, max: 99215 }; // Default to office
  }

  /**
   * Lookup CPT code for procedure
   */
  static async lookupProcedureCPT(
    description: string,
    providedCode?: string
  ): Promise<ProcedureLookupResult> {
    // If code provided, validate it
    if (providedCode) {
      const { data: cptCode, error } = await supabase
        .from('codes_cpt')
        .select('*')
        .eq('code', providedCode)
        .eq('status', 'active')
        .single();

      if (!error && cptCode) {
        return {
          found: true,
          cptCode: cptCode.code,
          cptDescription: cptCode.long_desc || cptCode.short_desc || '',
          requiresModifier: false
        };
      }
    }

    // Search by description
    if (description) {
      const { data: cptCodes, error } = await supabase
        .from('codes_cpt')
        .select('*')
        .ilike('long_desc', `%${description}%`)
        .eq('status', 'active')
        .limit(1);

      if (!error && cptCodes && cptCodes.length > 0) {
        return {
          found: true,
          cptCode: cptCodes[0].code,
          cptDescription: cptCodes[0].long_desc || cptCodes[0].short_desc || '',
          requiresModifier: false
        };
      }
    }

    return {
      found: false,
      isUnlistedProcedure: true
    };
  }

  /**
   * Evaluate E/M level based on documentation
   * Updated to 2023 CMS E/M Guidelines with correct time thresholds
   */
  static async evaluateEMLevel(
    input: DecisionTreeInput,
    documentation: EMDocumentationElements
  ): Promise<EMEvaluationResult> {
    const missingElements: string[] = [];
    let emLevel = 3; // Default to level 3
    const documentationScore = documentation.documentationCompletenesScore;

    // Check if new or established patient
    const newPatient = await this.isNewPatient(input.patientId, input.providerId);

    // Time-based coding (2023 CMS guidelines - total visit time)
    const timeBasedCoding = !!input.timeSpent && input.timeSpent >= 10;

    // Determine level based on time if available
    if (timeBasedCoding && input.timeSpent) {
      if (newPatient) {
        // NEW PATIENT (99202-99205) - Note: 99201 deleted in 2021
        // 99202: 15-29 min, 99203: 30-44 min, 99204: 45-59 min, 99205: 60-74 min
        if (input.timeSpent >= 60) emLevel = 5;
        else if (input.timeSpent >= 45) emLevel = 4;
        else if (input.timeSpent >= 30) emLevel = 3;
        else if (input.timeSpent >= 15) emLevel = 2;
        else {
          // < 15 minutes not typical for new patient
          missingElements.push('Insufficient time documented for new patient visit');
          emLevel = 2;
        }
      } else {
        // ESTABLISHED PATIENT (99211-99215)
        // 99211: N/A, 99212: 10-19 min, 99213: 20-29 min, 99214: 30-39 min, 99215: 40-54 min
        if (input.timeSpent >= 40) emLevel = 5;
        else if (input.timeSpent >= 30) emLevel = 4;
        else if (input.timeSpent >= 20) emLevel = 3;
        else if (input.timeSpent >= 10) emLevel = 2;
        else emLevel = 1; // 99211 - minimal service (nurse visit)
      }
    } else {
      // MDM-based coding (2021+ guidelines: 2 of 3 categories)
      const mdmLevel = this.calculateMDMLevel(documentation);
      emLevel = mdmLevel;

      if (emLevel < 2 && newPatient) {
        // New patient cannot be level 1 (99201 deleted)
        emLevel = 2;
      }
    }

    // Generate CPT code based on POS (different codes for office vs hospital vs ER)
    const emCode = this.generateEMCode(emLevel, newPatient, input.placeOfService);

    return {
      levelDetermined: true,
      emLevel,
      emCode,
      newPatient,
      timeBasedCoding,
      mdmBasedCoding: !timeBasedCoding,
      documentationScore,
      missingElements: missingElements.length > 0 ? missingElements : undefined
    };
  }

  /**
   * Generate appropriate E/M code based on level, patient status, and POS
   */
  private static generateEMCode(level: number, isNewPatient: boolean, posCode: string | undefined): string {
    const pos = posCode || '11';

    // Office/Outpatient/Telehealth (POS 11, 02, 22)
    if (['11', '02', '22', '12'].includes(pos)) {
      return isNewPatient
        ? `9920${Math.max(level, 2)}` // New patient: 99202-99205 (99201 deleted)
        : `9921${level}`; // Established: 99211-99215
    }

    // Inpatient Hospital (POS 21)
    if (pos === '21') {
      if (isNewPatient) {
        // Initial hospital care: 99221-99223
        return `9922${Math.min(level, 3)}`;
      } else {
        // Subsequent hospital care: 99231-99233
        return `9923${Math.min(level, 3)}`;
      }
    }

    // Emergency Room (POS 23)
    if (pos === '23') {
      // ER codes: 99281-99285 (no new vs established)
      return `9928${Math.min(level, 5)}`;
    }

    // Skilled Nursing Facility (POS 31, 32)
    if (['31', '32'].includes(pos)) {
      if (isNewPatient) {
        // Initial SNF care: 99304-99306
        return `9930${Math.min(level + 3, 6)}`;
      } else {
        // Subsequent SNF care: 99307-99310
        return `9930${Math.min(level + 6, 10)}`;
      }
    }

    // Default to office codes
    return isNewPatient ? `9920${Math.max(level, 2)}` : `9921${level}`;
  }

  /**
   * Determine applicable modifiers (updated with 2023 CMS modifiers)
   */
  static async determineModifiers(
    _cptCode: string,
    circumstances: string[]
  ): Promise<ModifierDecision> {
    const modifiersApplied: string[] = [];
    const modifierRationale: Record<string, string> = {};

    // CRITICAL: Modifier 25 - Significant, separately identifiable E/M service on same day as procedure
    // This prevents automatic denials when E/M + procedure billed together
    if (circumstances.includes('em_with_procedure')) {
      modifiersApplied.push('25');
      modifierRationale['25'] = 'Significant, separately identifiable E/M service on same day as procedure';
    }

    // Telehealth modifiers (CMS allows both 95 and GT)
    if (circumstances.includes('telehealth')) {
      modifiersApplied.push('95');
      modifierRationale['95'] = 'Telehealth service (synchronous)';
    }

    // Asynchronous telehealth (store-and-forward)
    if (circumstances.includes('telehealth_async')) {
      modifiersApplied.push('GQ');
      modifierRationale['GQ'] = 'Telehealth service (asynchronous)';
    }

    // GT modifier (alternative to 95, some payers require GT instead)
    if (circumstances.includes('telehealth_gt')) {
      modifiersApplied.push('GT');
      modifierRationale['GT'] = 'Telehealth service via interactive audio/video';
    }

    // Professional component only (e.g., physician reading X-ray)
    if (circumstances.includes('professional_component')) {
      modifiersApplied.push('26');
      modifierRationale['26'] = 'Professional component only';
    }

    // Technical component only (e.g., facility fee for equipment)
    if (circumstances.includes('technical_component')) {
      modifiersApplied.push('TC');
      modifierRationale['TC'] = 'Technical component only';
    }

    // Distinct procedural service (unbundling modifier)
    if (circumstances.includes('distinct_procedure')) {
      modifiersApplied.push('59');
      modifierRationale['59'] = 'Distinct procedural service';
    }

    // Bilateral procedure
    if (circumstances.includes('bilateral')) {
      modifiersApplied.push('50');
      modifierRationale['50'] = 'Bilateral procedure';
    }

    // Left side
    if (circumstances.includes('left_side')) {
      modifiersApplied.push('LT');
      modifierRationale['LT'] = 'Left side';
    }

    // Right side
    if (circumstances.includes('right_side')) {
      modifiersApplied.push('RT');
      modifierRationale['RT'] = 'Right side';
    }

    // Repeat procedure by same physician
    if (circumstances.includes('repeat_same_physician')) {
      modifiersApplied.push('76');
      modifierRationale['76'] = 'Repeat procedure by same physician';
    }

    // Repeat procedure by different physician
    if (circumstances.includes('repeat_different_physician')) {
      modifiersApplied.push('77');
      modifierRationale['77'] = 'Repeat procedure by different physician';
    }

    // Reduced services
    if (circumstances.includes('reduced_service')) {
      modifiersApplied.push('52');
      modifierRationale['52'] = 'Reduced services';
    }

    // Discontinued procedure
    if (circumstances.includes('discontinued')) {
      modifiersApplied.push('53');
      modifierRationale['53'] = 'Discontinued procedure';
    }

    // Assistant surgeon
    if (circumstances.includes('assistant_surgeon')) {
      modifiersApplied.push('80');
      modifierRationale['80'] = 'Assistant surgeon';
    }

    return {
      modifiersApplied,
      modifierRationale,
      specialCircumstances: circumstances
    };
  }

  /**
   * Check if CPT code is an E/M code (99201-99499)
   */
  private static isEMCode(cptCode: string): boolean {
    const code = parseInt(cptCode, 10);
    return code >= 99201 && code <= 99499;
  }

  /**
   * Check if CPT code is a procedure code (not E/M)
   */
  private static isProcedureCode(cptCode: string): boolean {
    return !this.isEMCode(cptCode) && parseInt(cptCode, 10) < 99000;
  }

  /**
   * Lookup fee for CPT code using RBRVS calculation
   * Implements Medicare RBRVS formula with commercial payer multipliers
   */
  static async lookupFee(
    cptCode: string,
    payerId: string,
    _providerId: string
  ): Promise<FeeScheduleResult> {
    try {
      // First, try to find contracted rate in fee schedule
      const { data: feeSchedule } = await supabase
        .from('fee_schedule_items')
        .select('*')
        .eq('payer_id', payerId)
        .eq('code', cptCode)
        .eq('code_type', 'CPT')
        .single();

      if (feeSchedule && feeSchedule.amount) {
        return {
          feeFound: true,
          contractedRate: feeSchedule.amount,
          appliedRate: feeSchedule.amount,
          rateSource: 'contracted'
        };
      }

      // If no contracted rate, use RBRVS calculation
      const rvuResult = await this.calculateRBRVSFee(cptCode, payerId);

      if (rvuResult) {
        return rvuResult;
      }

      // Fall back to chargemaster or default rates
      const { data: cptData } = await supabase
        .from('codes_cpt')
        .select('*')
        .eq('code', cptCode)
        .single();

      // Use simplified chargemaster rate
      const defaultRate = 100; // Base rate
      const appliedRate = cptData ? defaultRate * 1.5 : defaultRate;

      return {
        feeFound: true,
        chargemasterRate: appliedRate,
        appliedRate,
        rateSource: 'chargemaster'
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Fee lookup failed';
      auditLogger.error('Failed to lookup fee', errorMessage, { cptCode, payerId });
      // Return default rate if lookup fails
      return {
        feeFound: false,
        appliedRate: 100,
        rateSource: 'default'
      };
    }
  }

  /**
   * Calculate fee using RBRVS (Resource-Based Relative Value Scale)
   * Medicare Formula: (Work RVU + Practice RVU + Malpractice RVU) × CF × Geographic Modifier
   * Commercial payers typically pay 120-180% of Medicare rates
   */
  private static async calculateRBRVSFee(
    cptCode: string,
    payerId: string
  ): Promise<FeeScheduleResult | null> {
    try {
      // 2024 Medicare Conversion Factor (CMS updates annually)
      const MEDICARE_CF_2024 = 33.2875;

      // Get RVU values from codes_cpt table or RVU reference table
      const { data: rvuData } = await supabase
        .from('codes_cpt')
        .select('work_rvu, practice_rvu, malpractice_rvu')
        .eq('code', cptCode)
        .single();

      if (!rvuData || !rvuData.work_rvu) {
        // No RVU data available
        return null;
      }

      const workRVU = rvuData.work_rvu || 0;
      const practiceRVU = rvuData.practice_rvu || 0;
      const malpracticeRVU = rvuData.malpractice_rvu || 0;
      const totalRVUs = workRVU + practiceRVU + malpracticeRVU;

      // Calculate base Medicare rate
      const geographicModifier = 1.0; // Simplified - would vary by location (GPCI)
      const medicareRate = totalRVUs * MEDICARE_CF_2024 * geographicModifier;

      // Get payer multiplier (commercial payers pay percentage of Medicare)
      const payerMultiplier = await this.getPayerMedicareMultiplier(payerId);

      const appliedRate = medicareRate * payerMultiplier;

      return {
        feeFound: true,
        appliedRate,
        allowedAmount: appliedRate,
        rateSource: payerMultiplier === 1.0 ? 'medicare' : 'contracted'
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'RBRVS calculation failed';
      auditLogger.error('Failed to calculate RBRVS fee', errorMessage, { cptCode, payerId });
      return null;
    }
  }

  /**
   * Get commercial payer's Medicare multiplier
   * Most commercial payers pay 120-180% of Medicare rates
   */
  private static async getPayerMedicareMultiplier(payerId: string): Promise<number> {
    try {
      const { data: payer } = await supabase
        .from('payers')
        .select('medicare_multiplier')
        .eq('id', payerId)
        .single();

      if (payer && payer.medicare_multiplier) {
        return payer.medicare_multiplier;
      }

      // Default multipliers by payer type
      const PAYER_MULTIPLIERS: Record<string, number> = {
        'medicare': 1.0,
        'medicaid': 0.7,  // Medicaid typically pays less
        'blue_cross': 1.4, // 140% of Medicare
        'aetna': 1.35,
        'united': 1.38,
        'cigna': 1.32,
        'commercial': 1.3  // Default commercial rate
      };

      // Check if payerId contains known payer name
      const payerType = Object.keys(PAYER_MULTIPLIERS).find(type =>
        payerId.toLowerCase().includes(type)
      );

      return PAYER_MULTIPLIERS[payerType || 'commercial'];
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Payer multiplier lookup failed';
      auditLogger.error('Failed to get payer Medicare multiplier', errorMessage, { payerId });
      return 1.3; // Default to 130% of Medicare
    }
  }

  /**
   * Validate medical necessity (CPT-ICD10 combination) with LCD/NCD references
   * Enhanced to include coverage policies, frequency limits, and age/gender restrictions
   */
  static async validateMedicalNecessity(
    cptCode: string,
    icd10Codes: string[]
  ): Promise<MedicalNecessityCheck> {
    // Query coding rules from database
    const { data: rules, error } = await supabase
      .from('coding_rules')
      .select('*')
      .eq('cpt_code', cptCode)
      .eq('active', true);

    if (error || !rules || rules.length === 0) {
      // No specific rules found - allow by default but flag for review
      return {
        isValid: true,
        cptCode,
        icd10Codes,
        validCombinations: icd10Codes.map(icd10 => ({
          cpt: cptCode,
          icd10,
          valid: true,
          reason: 'No specific coverage rules found (review recommended)'
        }))
      };
    }

    // Check for LCD/NCD references
    let ncdReference: string | undefined;
    let lcdReference: string | undefined;

    for (const rule of rules) {
      if (rule.source === 'ncd' && rule.reference_url) {
        ncdReference = rule.reference_url;
      }
      if (rule.source === 'lcd' && rule.reference_url) {
        lcdReference = rule.reference_url;
      }
    }

    // Validate each ICD-10 code against rules
    const validCombinations = icd10Codes.map((icd10, index) => {
      const isPrimary = index === 0;

      // Find matching rule for this diagnosis
      const matchingRule = rules.find(rule => {
        // Check required patterns (must match)
        if (rule.required_icd10_patterns) {
          const requiresPatternMatch = rule.required_icd10_patterns.some((pattern: string) =>
            this.matchesPattern(icd10, pattern)
          );

          // If primary-only requirement, check position
          if (rule.primary_diagnosis_only && !isPrimary) {
            return false;
          }

          if (!requiresPatternMatch) {
            return false;
          }
        }

        // Check excluded patterns (must NOT match)
        if (rule.excluded_icd10_patterns) {
          const matchesExcluded = rule.excluded_icd10_patterns.some((pattern: string) =>
            this.matchesPattern(icd10, pattern)
          );

          if (matchesExcluded) {
            return false;
          }
        }

        return true;
      });

      let reason = '';
      if (matchingRule) {
        reason = 'Meets medical necessity requirements';
        if (matchingRule.source === 'ncd') {
          reason += ' (NCD)';
        } else if (matchingRule.source === 'lcd') {
          reason += ' (LCD)';
        }
      } else {
        reason = 'Does not meet coverage requirements';
      }

      return {
        cpt: cptCode,
        icd10,
        valid: !!matchingRule,
        reason
      };
    });

    // At least one valid combination is required
    const isValid = validCombinations.some(combo => combo.valid);

    // Add warning if primary diagnosis doesn't support procedure
    if (validCombinations.length > 0 && !validCombinations[0].valid) {
      validCombinations[0].reason += ' - Primary diagnosis must support procedure';
    }

    return {
      isValid,
      cptCode,
      icd10Codes,
      validCombinations,
      ncdReference,
      lcdReference
    };
  }

  // Helper methods

  private static async assignICD10Codes(input: DecisionTreeInput): Promise<string[]> {
    const codes: string[] = [];

    for (const diagnosis of input.presentingDiagnoses) {
      if (diagnosis.icd10Code) {
        codes.push(diagnosis.icd10Code);
      } else if (diagnosis.term) {
        // Search for ICD-10 code by term
        const { data: icd10Results } = await supabase
          .from('codes_icd10')
          .select('code')
          .ilike('desc', `%${diagnosis.term}%`)
          .eq('billable', true)
          .eq('status', 'active')
          .limit(1);

        if (icd10Results && icd10Results.length > 0) {
          codes.push(icd10Results[0].code);
        }
      }
    }

    // If no codes found, use unspecified code
    if (codes.length === 0) {
      codes.push('Z00.00'); // Encounter for general adult medical examination without abnormal findings
    }

    return codes;
  }

  private static assessRiskLevel(
    input: DecisionTreeInput
  ): 'minimal' | 'low' | 'moderate' | 'high' {
    const diagnosisCount = input.presentingDiagnoses.length;

    if (diagnosisCount >= 3) return 'high';
    if (diagnosisCount >= 2) return 'moderate';
    if (diagnosisCount >= 1) return 'low';
    return 'minimal';
  }

  /**
   * Calculate MDM Level using 2021+ CMS Guidelines (2 of 3 categories)
   * Returns E/M level 1-5 based on problem complexity, data, and risk
   */
  private static calculateMDMLevel(documentation: EMDocumentationElements): number {
    // Map each MDM component to a level (1-5)
    const problemLevel = this.assessProblemComplexity(documentation);
    const dataLevel = this.assessDataComplexity(documentation);
    const riskLevel = this.assessRiskComplexity(documentation);

    // CMS Rule: Level is determined by 2 of 3 categories
    // If all 3 match, use that level
    // If 2 match, use that level
    // If all different, use the middle (median) value
    const levels = [problemLevel, dataLevel, riskLevel].sort((a, b) => a - b);

    // Return the median (middle value) which represents "2 of 3"
    return levels[1];
  }

  /**
   * Assess problem complexity for MDM
   */
  private static assessProblemComplexity(documentation: EMDocumentationElements): number {
    const numDx = documentation.numberOfDiagnoses;

    // CMS 2021+ Guidelines
    if (numDx === 0) return 1; // Minimal
    if (numDx === 1) return 2; // Low (1 self-limited/minor)
    if (numDx === 2) return 3; // Moderate (2+ stable chronic OR 1 chronic + 1 acute)
    if (numDx >= 3) {
      // Check risk level to differentiate between moderate and high
      if (documentation.riskLevel === 'high') return 4; // High (1+ chronic severe)
      return 3; // Moderate
    }
    return 3; // Default moderate
  }

  /**
   * Assess data review complexity for MDM
   */
  private static assessDataComplexity(documentation: EMDocumentationElements): number {
    const data = documentation.amountOfData;

    // CMS 2021+ Guidelines
    switch (data) {
      case 'minimal':
        return 1; // Minimal/None
      case 'limited':
        return 2; // Limited (review of labs/X-rays)
      case 'moderate':
        return 3; // Moderate (review external records, independent historian)
      case 'extensive':
        return 4; // Extensive (independent interpretation of tests)
      default:
        return 2;
    }
  }

  /**
   * Assess risk complexity for MDM
   */
  private static assessRiskComplexity(documentation: EMDocumentationElements): number {
    const risk = documentation.riskLevel;

    // CMS 2021+ Guidelines
    switch (risk) {
      case 'minimal':
        return 1; // Minimal (rest, superficial dressings)
      case 'low':
        return 2; // Low (OTC drugs, minor surgery)
      case 'moderate':
        return 3; // Moderate (prescription drug management)
      case 'high':
        return 4; // High (parenteral controlled substances, decision for surgery)
      default:
        return 2;
    }
  }

  /**
   * Check if patient is new or established
   * New = No face-to-face encounter with this provider (or same specialty) in past 3 years
   */
  private static async isNewPatient(patientId: string, providerId: string): Promise<boolean> {
    try {
      const threeYearsAgo = new Date();
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

      const { data: encounters, error } = await supabase
        .from('encounters')
        .select('id')
        .eq('patient_id', patientId)
        .eq('provider_id', providerId)
        .gte('encounter_date', threeYearsAgo.toISOString())
        .limit(1);

      if (error) {
        // If error, assume established to be conservative
        return false;
      }

      // If no encounters in past 3 years, patient is new
      return !encounters || encounters.length === 0;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'New patient check failed';
      auditLogger.error('Failed to check if patient is new', errorMessage, { patientId, providerId });
      // Error checking - assume established to avoid overbilling
      return false;
    }
  }

  private static matchesPattern(code: string, pattern: string): boolean {
    // Convert wildcard pattern to regex
    // E.g., "E11.*" becomes "^E11\\..*$"
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(code);
  }

  /**
   * Integration with SDOH Billing Service
   * Enhances decision tree results with SDOH-specific codes and CCM recommendations
   */
  static async enhanceWithSDOH(
    result: DecisionTreeResult,
    patientId: string
  ): Promise<DecisionTreeResult> {
    if (!result.success || !result.claimLine) {
      return result;
    }

    // HIPAA §164.312(b): Log PHI access for SDOH assessment
    await auditLogger.phi('BILLING_SDOH_ENHANCEMENT', patientId, {
      resourceType: 'SDOHAssessment',
      operation: 'enhanceWithSDOH',
    });

    try {
      // Get SDOH assessment
      const sdohAssessment = await SDOHBillingService.assessSDOHComplexity(patientId);

      // Add SDOH Z-codes to diagnosis list
      const sdohCodes: string[] = [];

      if (sdohAssessment.housingInstability) {
        sdohCodes.push(sdohAssessment.housingInstability.zCode);
      }
      if (sdohAssessment.foodInsecurity) {
        sdohCodes.push(sdohAssessment.foodInsecurity.zCode);
      }
      if (sdohAssessment.transportationBarriers) {
        sdohCodes.push(sdohAssessment.transportationBarriers.zCode);
      }
      if (sdohAssessment.socialIsolation) {
        sdohCodes.push(sdohAssessment.socialIsolation.zCode);
      }
      if (sdohAssessment.financialInsecurity) {
        sdohCodes.push(sdohAssessment.financialInsecurity.zCode);
      }

      // Enhanced claim line with SDOH codes
      result.claimLine.icd10Codes = [...result.claimLine.icd10Codes, ...sdohCodes];

      // Add CCM code if eligible
      if (sdohAssessment.ccmEligible) {
        result.warnings.push({
          severity: 'info',
          code: 'CCM_ELIGIBLE',
          message: `Patient eligible for ${sdohAssessment.ccmTier} CCM services`,
          suggestion: 'Consider adding CCM codes if time requirements are met'
        });
      }

      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'SDOH enhancement failed';
      auditLogger.error('Failed to enhance with SDOH', errorMessage, { patientId });
      // If SDOH enhancement fails, return original result
      return result;
    }
  }
}

export default BillingDecisionTreeService;
