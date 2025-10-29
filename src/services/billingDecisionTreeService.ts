// Billing Decision Tree Service
// Implements integral minimum logic for smart billing and coding
// Follows the 80/20 rule: handles common scenarios efficiently, routes complex cases to manual review

import { supabase } from '../lib/supabaseClient';
import { BillingService } from './billingService';
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
    config: DecisionTreeConfig = this.defaultConfig
  ): Promise<DecisionTreeResult> {
    const decisions: DecisionNode[] = [];
    const validationErrors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    let requiresManualReview = false;
    let manualReviewReason: string | undefined;

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

      // NODE E: Modifier Logic
      const modifierResult = await this.executeNodeE(cptCode, input, decisions);
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

      // Final decision node
      decisions.push({
        nodeId: 'FINAL',
        nodeName: 'Claim Line Generation',
        question: 'Generate final billable claim line?',
        answer: 'Yes',
        result: 'complete',
        rationale: `Successfully generated claim line: ${cptCode} with ${icd10Codes.length} diagnosis codes`,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        claimLine,
        decisions,
        validationErrors,
        warnings,
        requiresManualReview
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

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
    const _nodeStart = Date.now();

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
   * NODE E: Modifier Logic
   */
  private static async executeNodeE(
    cptCode: string,
    input: DecisionTreeInput,
    decisions: DecisionNode[]
  ): Promise<ModifierDecision> {
    const circumstances: string[] = [];

    // Detect special circumstances
    if (input.encounterType === 'telehealth') {
      circumstances.push('telehealth');
    }

    const modifierResult = await this.determineModifiers(cptCode, circumstances);

    const decision: DecisionNode = {
      nodeId: 'NODE_E',
      nodeName: 'Modifier Determination',
      question: 'Are there special circumstances requiring modifiers?',
      answer: modifierResult.modifiersApplied.length > 0
        ? `Yes - ${modifierResult.modifiersApplied.join(', ')}`
        : 'No',
      result: 'proceed',
      rationale: modifierResult.modifiersApplied.length > 0
        ? `Applied modifiers: ${Object.entries(modifierResult.modifierRationale).map(([mod, reason]) => `${mod} (${reason})`).join(', ')}`
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
    } catch (error) {
      return {
        eligible: false,
        authorized: false,
        authorizationRequired: false,
        denialReason: 'Error checking eligibility'
      };
    }
  }

  /**
   * Classify service as procedural or E/M
   */
  static async classifyService(input: DecisionTreeInput): Promise<ServiceClassification> {
    // Simple classification based on encounter type and procedures
    const hasProcedures = input.proceduresPerformed && input.proceduresPerformed.length > 0;
    const procedureTypes: string[] = ['surgery', 'procedure', 'lab', 'radiology'];

    if (procedureTypes.includes(input.encounterType)) {
      return {
        classificationType: 'procedural',
        confidence: 95,
        rationale: `Encounter type "${input.encounterType}" is procedural in nature`
      };
    }

    if (hasProcedures && input.proceduresPerformed[0].cptCode) {
      return {
        classificationType: 'procedural',
        confidence: 90,
        rationale: 'Procedure codes documented in encounter'
      };
    }

    if (['office_visit', 'telehealth', 'consultation', 'emergency'].includes(input.encounterType)) {
      return {
        classificationType: 'evaluation_management',
        confidence: 95,
        rationale: `Encounter type "${input.encounterType}" is evaluation/management in nature`
      };
    }

    return {
      classificationType: 'unknown',
      confidence: 50,
      rationale: 'Unable to definitively classify encounter type'
    };
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
   */
  static async evaluateEMLevel(
    input: DecisionTreeInput,
    documentation: EMDocumentationElements
  ): Promise<EMEvaluationResult> {
    const missingElements: string[] = [];
    let emLevel = 3; // Default to level 3
    let documentationScore = documentation.documentationCompletenesScore;

    // Time-based coding (if > 50% time spent on counseling/coordination)
    const timeBasedCoding = !!input.timeSpent && input.timeSpent >= 20;

    // Determine level based on time if available
    if (timeBasedCoding && input.timeSpent) {
      if (input.timeSpent >= 60) emLevel = 5;
      else if (input.timeSpent >= 40) emLevel = 4;
      else if (input.timeSpent >= 30) emLevel = 3;
      else if (input.timeSpent >= 20) emLevel = 2;
      else emLevel = 1;
    } else {
      // MDM-based coding
      const mdmScore = this.calculateMDMScore(documentation);

      if (mdmScore >= 90) emLevel = 5;
      else if (mdmScore >= 75) emLevel = 4;
      else if (mdmScore >= 60) emLevel = 3;
      else if (mdmScore >= 40) emLevel = 2;
      else emLevel = 1;
    }

    // Determine if new or established patient (simplified)
    const newPatient = false; // Would check patient history

    // Generate CPT code
    const emCode = newPatient ? `9920${emLevel}` : `9921${emLevel}`;

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
   * Determine applicable modifiers
   */
  static async determineModifiers(
    cptCode: string,
    circumstances: string[]
  ): Promise<ModifierDecision> {
    const modifiersApplied: string[] = [];
    const modifierRationale: Record<string, string> = {};

    // Telehealth modifier
    if (circumstances.includes('telehealth')) {
      modifiersApplied.push('95');
      modifierRationale['95'] = 'Telehealth service';
    }

    // Distinct procedural service
    if (circumstances.includes('distinct_procedure')) {
      modifiersApplied.push('59');
      modifierRationale['59'] = 'Distinct procedural service';
    }

    // Bilateral procedure
    if (circumstances.includes('bilateral')) {
      modifiersApplied.push('50');
      modifierRationale['50'] = 'Bilateral procedure';
    }

    return {
      modifiersApplied,
      modifierRationale,
      specialCircumstances: circumstances
    };
  }

  /**
   * Lookup fee for CPT code
   */
  static async lookupFee(
    cptCode: string,
    payerId: string,
    providerId: string
  ): Promise<FeeScheduleResult> {
    try {
      // First, try to find contracted rate
      const contractedRate = await BillingService.lookupFee(
        payerId,
        'CPT',
        cptCode
      );

      if (contractedRate) {
        return {
          feeFound: true,
          contractedRate,
          appliedRate: contractedRate,
          rateSource: 'contracted'
        };
      }

      // Fall back to chargemaster or default rates
      const { data: cptData } = await supabase
        .from('codes_cpt')
        .select('*')
        .eq('code', cptCode)
        .single();

      // Use RVU-based calculation (simplified)
      const defaultRate = 100; // Base rate
      const appliedRate = cptData ? defaultRate * 1.5 : defaultRate;

      return {
        feeFound: true,
        chargemasterRate: appliedRate,
        appliedRate,
        rateSource: 'chargemaster'
      };
    } catch (error) {
      // Return default rate if lookup fails
      return {
        feeFound: false,
        appliedRate: 100,
        rateSource: 'default'
      };
    }
  }

  /**
   * Validate medical necessity (CPT-ICD10 combination)
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
      // No specific rules found - allow by default
      return {
        isValid: true,
        cptCode,
        icd10Codes,
        validCombinations: icd10Codes.map(icd10 => ({
          cpt: cptCode,
          icd10,
          valid: true
        }))
      };
    }

    // Validate each ICD-10 code against rules
    const validCombinations = icd10Codes.map(icd10 => {
      const matchingRule = rules.find(rule => {
        if (rule.required_icd10_patterns) {
          return rule.required_icd10_patterns.some((pattern: string) =>
            this.matchesPattern(icd10, pattern)
          );
        }
        return true;
      });

      return {
        cpt: cptCode,
        icd10,
        valid: !!matchingRule,
        reason: matchingRule ? 'Matches coding rule' : 'No matching rule found'
      };
    });

    const isValid = validCombinations.some(combo => combo.valid);

    return {
      isValid,
      cptCode,
      icd10Codes,
      validCombinations
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

  private static calculateMDMScore(documentation: EMDocumentationElements): number {
    let score = 0;

    // Number of diagnoses (0-30 points)
    score += Math.min(documentation.numberOfDiagnoses * 10, 30);

    // Amount of data (0-30 points)
    const dataPoints = {
      'minimal': 5,
      'limited': 15,
      'moderate': 25,
      'extensive': 30
    };
    score += dataPoints[documentation.amountOfData];

    // Risk level (0-40 points)
    const riskPoints = {
      'minimal': 10,
      'low': 20,
      'moderate': 30,
      'high': 40
    };
    score += riskPoints[documentation.riskLevel];

    return score;
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
    } catch (error) {
      // If SDOH enhancement fails, return original result
      return result;
    }
  }
}

export default BillingDecisionTreeService;
