/**
 * Unified Billing Service - Orchestrates the complete billing workflow
 *
 * This service provides a single entry point for all billing operations,
 * coordinating between:
 * - Core billing operations (BillingService)
 * - SDOH assessment and coding (SDOHBillingService)
 * - Decision tree logic (BillingDecisionTreeService)
 * - AI-powered coding suggestions (Claude)
 *
 * @module UnifiedBillingService
 */

import { supabase } from '../lib/supabaseClient';
import { logPhiAccess } from './phiAccessLogger';
import { auditLogger } from './auditLogger';
import { BillingService } from './billingService';
import { SDOHBillingService } from './sdohBillingService';
import { BillingDecisionTreeService } from './billing-decision-tree';
import type {
  Claim,
  ClaimLine,
  CreateClaim,
  CodingSuggestion
} from '../types/billing';
import type {
  EnhancedCodingSuggestion,
  SDOHAssessment,
  BillingValidation
} from '../types/sdohBilling';
import type {
  DecisionTreeInput,
  DecisionTreeResult
} from '../types/billingDecisionTree';

// ============================================================================
// Types for Unified Billing Workflow
// ============================================================================

export interface BillingWorkflowInput {
  // Required encounter information
  encounterId: string;
  patientId: string;
  providerId: string;
  payerId: string;
  policyStatus?: 'active' | 'inactive' | 'pending';

  // Clinical context
  serviceDate: string;
  encounterType: 'office_visit' | 'telehealth' | 'emergency' | 'procedure' | 'surgery';
  chiefComplaint?: string;
  diagnoses: Array<{ term?: string; icd10Code?: string }>;
  procedures?: Array<{ description?: string; cptCode?: string }>;

  // Additional context
  timeSpent?: number;
  placeOfService: string;

  // Workflow options
  enableAIAssist?: boolean;
  enableSDOHAnalysis?: boolean;
  enableDecisionTree?: boolean;
  autoSubmit?: boolean;
}

export interface BillingWorkflowResult {
  success: boolean;

  // Generated claim data
  claim?: Claim;
  claimLines?: ClaimLine[];

  // Analysis results
  codingSuggestions?: EnhancedCodingSuggestion | CodingSuggestion;
  sdohAssessment?: SDOHAssessment;
  decisionTreeResult?: DecisionTreeResult;
  validation?: BillingValidation;

  // Workflow tracking
  workflowSteps: WorkflowStep[];
  errors: BillingError[];
  warnings: BillingWarning[];

  // Financial summary
  totalCharges: number;
  estimatedReimbursement: number;

  // Next actions
  requiresManualReview: boolean;
  manualReviewReasons: string[];
  recommendedActions: string[];
}

export interface WorkflowStep {
  stepId: string;
  stepName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startTime: string;
  endTime?: string;
  duration?: number;
  details?: Record<string, unknown>;
  error?: string;
}

export interface BillingError {
  code: string;
  severity: 'critical' | 'error';
  message: string;
  field?: string;
  suggestion?: string;
}

export interface BillingWarning {
  code: string;
  severity: 'warning' | 'info';
  message: string;
  field?: string;
  recommendation?: string;
}

// ============================================================================
// Unified Billing Service Class
// ============================================================================

export class UnifiedBillingService {
  /**
   * Main entry point: Process complete billing workflow
   * Orchestrates all billing services to generate a complete, validated claim
   */
  static async processBillingWorkflow(
    input: BillingWorkflowInput
  ): Promise<BillingWorkflowResult> {
    const workflowSteps: WorkflowStep[] = [];
    const errors: BillingError[] = [];
    const warnings: BillingWarning[] = [];
    const manualReviewReasons: string[] = [];
    const recommendedActions: string[] = [];

    try {
      // HIPAA Audit: Log billing workflow start
      await auditLogger.billing('WORKFLOW_START', true, {
        encounterId: input.encounterId,
        patientId: input.patientId,
        provider: input.providerId,
        enableAI: input.enableAIAssist !== false,
        enableSDOH: input.enableSDOHAnalysis !== false
      });

      // HIPAA §164.312(b): Log PHI access for billing
      await logPhiAccess({
        phiType: 'billing',
        phiResourceId: input.encounterId,
        patientId: input.patientId,
        accessType: 'view',
        accessMethod: 'API',
        purpose: 'payment',
      });

      // STEP 1: Validate input and prerequisites
      const validationStep = await this.executeStep(
        'validate_input',
        'Validate Input & Prerequisites',
        async () => {
          await this.validateWorkflowInput(input);
          return { validated: true };
        },
        workflowSteps
      );

      if (!validationStep.success) {
        throw new Error('Input validation failed');
      }

      // STEP 1.5: Retrieve scribe session data if available
      const scribeStep = await this.executeStep(
        'retrieve_scribe_data',
        'Retrieve AI Scribe Session Data',
        async () => {
          const { data: scribeSession } = await supabase
            .from('scribe_sessions')
            .select('*')
            .eq('encounter_id', input.encounterId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return { scribeSession };
        },
        workflowSteps
      );

      // Pre-populate codes from scribe session if available
      if (scribeStep.result?.scribeSession) {
        const scribeSession = scribeStep.result.scribeSession;

        // Pre-populate CPT codes from AI suggestions if not already provided
        if ((!input.procedures || input.procedures.length === 0) && scribeSession.suggested_cpt_codes) {
          input.procedures = (scribeSession.suggested_cpt_codes as Array<{ code: string; description?: string }>).map(c => ({
            cptCode: c.code,
            description: c.description
          }));

          auditLogger.info('BILLING_SCRIBE_CODES_LOADED', {
            encounterId: input.encounterId,
            cptCodesLoaded: input.procedures.length
          });
        }

        // Pre-populate ICD-10 codes from AI suggestions if not already provided
        if ((!input.diagnoses || input.diagnoses.length === 0) && scribeSession.suggested_icd10_codes) {
          input.diagnoses = (scribeSession.suggested_icd10_codes as Array<{ code: string; description?: string }>).map(c => ({
            icd10Code: c.code,
            term: c.description
          }));

          auditLogger.info('BILLING_SCRIBE_DIAGNOSES_LOADED', {
            encounterId: input.encounterId,
            icd10CodesLoaded: input.diagnoses.length
          });
        }

        // Add CCM code if eligible and time documented
        if (scribeSession.is_ccm_eligible && scribeSession.clinical_time_minutes >= 20) {
          const ccmCode = {
            cptCode: '99490',
            description: `Chronic Care Management - ${scribeSession.clinical_time_minutes} minutes`
          };

          if (!input.procedures) {
            input.procedures = [ccmCode];
          } else {
            // Add CCM code if not already present
            const hasCCM = input.procedures.some(p => p.cptCode === '99490' || p.cptCode === '99439');
            if (!hasCCM) {
              input.procedures.push(ccmCode);
            }
          }

          auditLogger.billing('CCM_CODE_AUTO_ADDED', true, {
            encounterId: input.encounterId,
            clinicalMinutes: scribeSession.clinical_time_minutes,
            code: '99490'
          });
        }

        // Add extended CCM code if 40+ minutes
        if (scribeSession.clinical_time_minutes >= 40) {
          const extendedCCM = {
            cptCode: '99439',
            description: `Extended CCM - Each Additional 20 minutes`
          };

          if (!input.procedures) {
            input.procedures = [extendedCCM];
          } else {
            const hasExtendedCCM = input.procedures.some(p => p.cptCode === '99439');
            if (!hasExtendedCCM) {
              input.procedures.push(extendedCCM);
            }
          }

          auditLogger.billing('EXTENDED_CCM_CODE_AUTO_ADDED', true, {
            encounterId: input.encounterId,
            clinicalMinutes: scribeSession.clinical_time_minutes,
            code: '99439'
          });
        }
      }

      // STEP 2: Run decision tree analysis (if enabled)
      let decisionTreeResult: DecisionTreeResult | undefined;
      if (input.enableDecisionTree !== false) {
        const decisionTreeStep = await this.executeStep(
          'decision_tree',
          'Decision Tree Analysis',
          async () => {
            const treeInput = this.mapToDecisionTreeInput(input);
            const result = await BillingDecisionTreeService.processEncounter(treeInput);

            // Enhance with SDOH if enabled
            if (input.enableSDOHAnalysis !== false) {
              return await BillingDecisionTreeService.enhanceWithSDOH(result, input.patientId);
            }

            return result;
          },
          workflowSteps
        );

        decisionTreeResult = decisionTreeStep.result;

        if (decisionTreeResult && !decisionTreeResult.success) {
          errors.push(...decisionTreeResult.validationErrors.map(e => ({
            code: e.code,
            severity: 'error' as const,
            message: e.message,
            field: e.field,
            suggestion: e.suggestion
          })));
        }

        if (decisionTreeResult?.requiresManualReview) {
          manualReviewReasons.push(decisionTreeResult.manualReviewReason || 'Decision tree flagged for review');
        }
      }

      // STEP 3: Get AI coding suggestions (if enabled)
      let codingSuggestions: EnhancedCodingSuggestion | CodingSuggestion | undefined;
      if (input.enableAIAssist !== false) {
        const aiStep = await this.executeStep(
          'ai_coding',
          'AI Coding Suggestions',
          async () => {
            if (input.enableSDOHAnalysis !== false) {
              // Use SDOH-enhanced AI suggestions
              return await SDOHBillingService.analyzeEncounter(input.encounterId);
            } else {
              // Use basic AI suggestions
              return await BillingService.getCodingSuggestions(input.encounterId);
            }
          },
          workflowSteps
        );

        codingSuggestions = aiStep.result;
      }

      // STEP 4: SDOH Assessment (if enabled and not already done)
      let sdohAssessment: SDOHAssessment | undefined;
      if (input.enableSDOHAnalysis !== false) {
        const sdohStep = await this.executeStep(
          'sdoh_assessment',
          'SDOH Assessment',
          async () => {
            // Check if we already have assessment from AI step (only in EnhancedCodingSuggestion)
            if (codingSuggestions && 'sdohAssessment' in codingSuggestions && codingSuggestions.sdohAssessment) {
              return codingSuggestions.sdohAssessment;
            }
            return await SDOHBillingService.assessSDOHComplexity(input.patientId);
          },
          workflowSteps
        );

        sdohAssessment = sdohStep.result;
      }

      // STEP 5: Combine and validate all coding suggestions
      const finalCodingStep = await this.executeStep(
        'finalize_coding',
        'Finalize Coding',
        async () => {
          return this.reconcileCodingSources(
            decisionTreeResult,
            codingSuggestions,
            sdohAssessment
          );
        },
        workflowSteps
      );

      const finalCoding = finalCodingStep.result;

      if (!finalCoding) {
        throw new Error('Failed to finalize coding');
      }

      // STEP 6: Validate billing compliance (only for EnhancedCodingSuggestion)
      let validation: BillingValidation | undefined;
      if (codingSuggestions && 'medicalCodes' in codingSuggestions) {
        const validationStep = await this.executeStep(
          'validate_compliance',
          'Validate Billing Compliance',
          async () => {
            return await SDOHBillingService.validateBillingCompliance(codingSuggestions as EnhancedCodingSuggestion);
          },
          workflowSteps
        );

        validation = validationStep.result;

        if (validation && !validation.isValid) {
          errors.push(...validation.errors.map(e => ({
            code: e.code,
            severity: e.severity as 'critical' | 'error',
            message: e.message,
            field: e.field
          })));
        }

        if (validation) {
          warnings.push(...validation.warnings.map(w => ({
            code: w.code,
            severity: 'warning' as const,
            message: w.message,
            field: w.field,
            recommendation: w.recommendation
          })));
        }
      }

      // STEP 7: Create claim
      const claimStep = await this.executeStep(
        'create_claim',
        'Create Claim',
        async () => {
          const claimData: CreateClaim = {
            encounter_id: input.encounterId,
            payer_id: input.payerId,
            billing_provider_id: input.providerId,
            claim_type: 'professional',
            status: 'generated',
            total_charge: this.calculateTotalCharges(finalCoding)
          };

          return await BillingService.createClaim(claimData);
        },
        workflowSteps
      );

      const claim = claimStep.result;

      if (!claim?.id) {
        throw new Error('Failed to create claim');
      }

      // STEP 8: Create claim lines
      const claimLinesStep = await this.executeStep(
        'create_claim_lines',
        'Create Claim Lines',
        async () => {
          const claimLines: ClaimLine[] = [];

          // Add procedure codes
          if (finalCoding.cptCodes) {
            for (const cpt of finalCoding.cptCodes) {
              const line = await BillingService.addClaimLine({
                claim_id: claim.id,
                code_system: 'CPT',
                procedure_code: cpt.code,
                modifiers: cpt.modifiers || [],
                units: 1,
                charge_amount: cpt.chargeAmount || 0,
                diagnosis_pointers: [1],
                service_date: input.serviceDate
              });
              claimLines.push(line);
            }
          }

          return claimLines;
        },
        workflowSteps
      );

      const claimLines = claimLinesStep.result || [];

      // STEP 9: Generate X12 (if auto-submit enabled)
      if (input.autoSubmit && claim) {
        await this.executeStep(
          'generate_x12',
          'Generate X12 EDI',
          async () => {
            return await BillingService.generateX12Claim(input.encounterId, input.providerId);
          },
          workflowSteps
        );
      }

      // Calculate financial summary
      const totalCharges = this.calculateTotalCharges(finalCoding);
      const estimatedReimbursement = this.estimateReimbursement(finalCoding);

      // Determine if manual review required
      const requiresManualReview: boolean =
        manualReviewReasons.length > 0 ||
        errors.length > 0 ||
        (validation ? !validation.isValid : false) ||
        (validation ? validation.auditFlags.length > 0 : false);

      // Generate recommended actions
      if (requiresManualReview) {
        recommendedActions.push('Review and correct identified issues before claim submission');
      }
      if (sdohAssessment?.ccmEligible) {
        recommendedActions.push(`Patient eligible for ${sdohAssessment.ccmTier} CCM services - ensure time tracking`);
      }
      if (codingSuggestions && 'auditReadiness' in codingSuggestions && codingSuggestions.auditReadiness && codingSuggestions.auditReadiness.score < 85) {
        recommendedActions.push('Complete missing documentation to improve audit readiness');
      }

      // HIPAA Audit: Log successful billing workflow completion
      await auditLogger.billing('WORKFLOW_COMPLETE', true, {
        encounterId: input.encounterId,
        patientId: input.patientId,
        totalCharges,
        estimatedReimbursement,
        requiresManualReview,
        claimLinesCount: claimLines?.length || 0
      });

      return {
        success: true,
        claim,
        claimLines,
        codingSuggestions,
        sdohAssessment,
        decisionTreeResult,
        validation,
        workflowSteps,
        errors,
        warnings,
        totalCharges,
        estimatedReimbursement,
        requiresManualReview,
        manualReviewReasons,
        recommendedActions
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // HIPAA Audit: Log billing workflow failure
      await auditLogger.billing('WORKFLOW_FAILED', false, {
        encounterId: input.encounterId,
        patientId: input.patientId,
        error: errorMessage
      });

      errors.push({
        code: 'WORKFLOW_ERROR',
        severity: 'critical',
        message: errorMessage
      });

      return {
        success: false,
        workflowSteps,
        errors,
        warnings,
        totalCharges: 0,
        estimatedReimbursement: 0,
        requiresManualReview: true,
        manualReviewReasons: [`Critical workflow error: ${errorMessage}`],
        recommendedActions: ['Contact billing support for assistance']
      };
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Execute a workflow step with timing and error handling
   */
  private static async executeStep<T>(
    stepId: string,
    stepName: string,
    fn: () => Promise<T>,
    workflowSteps: WorkflowStep[]
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    const step: WorkflowStep = {
      stepId,
      stepName,
      status: 'in_progress',
      startTime: new Date().toISOString()
    };

    workflowSteps.push(step);

    try {
      const result = await fn();

      step.endTime = new Date().toISOString();
      step.duration = Date.now() - new Date(step.startTime).getTime();
      step.status = 'completed';
      step.details = { success: true };

      // HIPAA Audit: Log billing step completion (debug level)
      auditLogger.debug(`Billing step completed: ${stepName} (${step.duration}ms)`);

      return { success: true, result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      step.endTime = new Date().toISOString();
      step.duration = Date.now() - new Date(step.startTime).getTime();
      step.status = 'failed';
      step.error = errorMessage;

      // HIPAA Audit: Log billing step failure (error level)
      await auditLogger.error(`BILLING_STEP_FAILED_${stepId.toUpperCase()}`, error instanceof Error ? error : new Error(errorMessage), {
        stepName,
        duration: step.duration
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Validate workflow input
   */
  private static async validateWorkflowInput(input: BillingWorkflowInput): Promise<void> {
    const errors: string[] = [];

    if (!input.encounterId) errors.push('encounterId is required');
    if (!input.patientId) errors.push('patientId is required');
    if (!input.providerId) errors.push('providerId is required');
    if (!input.payerId) errors.push('payerId is required');
    if (!input.serviceDate) errors.push('serviceDate is required');
    if (!input.diagnoses || input.diagnoses.length === 0) {
      errors.push('At least one diagnosis is required');
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Verify entities exist
    const [patient, provider, payer] = await Promise.all([
      supabase.from('patients').select('id').eq('id', input.patientId).single(),
      supabase.from('billing_providers').select('id').eq('id', input.providerId).single(),
      supabase.from('billing_payers').select('id').eq('id', input.payerId).single()
    ]);

    if (patient.error) throw new Error('Patient not found');
    if (provider.error) throw new Error('Provider not found');
    if (payer.error) throw new Error('Payer not found');
  }

  /**
   * Map workflow input to decision tree input format
   */
  private static mapToDecisionTreeInput(input: BillingWorkflowInput): DecisionTreeInput {
    return {
      encounterId: input.encounterId,
      patientId: input.patientId,
      providerId: input.providerId,
      payerId: input.payerId,
      policyStatus: input.policyStatus || 'active',
      serviceDate: input.serviceDate,
      encounterType: input.encounterType,
      chiefComplaint: input.chiefComplaint,
      presentingDiagnoses: input.diagnoses
        .filter((d): d is { term: string; icd10Code?: string } => !!d.term)
        .map(d => ({
          term: d.term,
          icd10Code: d.icd10Code
        })),
      proceduresPerformed: (input.procedures || [])
        .filter((p): p is { description: string; cptCode?: string } => !!p.description)
        .map(p => ({
          description: p.description,
          cptCode: p.cptCode
        })),
      timeSpent: input.timeSpent,
      placeOfService: input.placeOfService
    };
  }

  /**
   * Reconcile coding suggestions from multiple sources
   */
  private static reconcileCodingSources(
    decisionTree?: DecisionTreeResult,
    aiSuggestions?: EnhancedCodingSuggestion | CodingSuggestion,
    _sdohAssessment?: SDOHAssessment
  ): {
    cptCodes: Array<{ code: string; modifiers?: string[]; chargeAmount?: number }>;
    icd10Codes: Array<{ code: string; description?: string }>;
    hcpcsCodes: Array<{ code: string; modifiers?: string[] }>;
  } {
    const cptCodes = [];
    const icd10Codes = [];
    const hcpcsCodes = [];

    // Priority: Decision tree > AI suggestions

    // CPT codes
    if (decisionTree?.claimLine?.cptCode) {
      cptCodes.push({
        code: decisionTree.claimLine.cptCode,
        modifiers: decisionTree.claimLine.cptModifiers,
        chargeAmount: decisionTree.claimLine.billedAmount
      });
    } else if (aiSuggestions) {
      // Check if it's EnhancedCodingSuggestion
      if ('procedureCodes' in aiSuggestions && aiSuggestions.procedureCodes.cpt) {
        cptCodes.push(...aiSuggestions.procedureCodes.cpt.map(c => ({
          code: c.code,
          modifiers: c.modifiers,
          chargeAmount: undefined
        })));
      } else if ('cpt' in aiSuggestions && aiSuggestions.cpt) {
        // Basic CodingSuggestion
        cptCodes.push(...aiSuggestions.cpt.map(c => ({
          code: c.code,
          modifiers: c.modifiers,
          chargeAmount: undefined
        })));
      }
    }

    // ICD-10 codes
    if (decisionTree?.claimLine?.icd10Codes) {
      icd10Codes.push(...decisionTree.claimLine.icd10Codes.map(code => ({
        code,
        description: undefined
      })));
    } else if (aiSuggestions) {
      // Check if it's EnhancedCodingSuggestion
      if ('medicalCodes' in aiSuggestions && aiSuggestions.medicalCodes.icd10) {
        icd10Codes.push(...aiSuggestions.medicalCodes.icd10.map(c => ({
          code: c.code,
          description: c.rationale
        })));
      } else if ('icd10' in aiSuggestions && aiSuggestions.icd10) {
        // Basic CodingSuggestion
        icd10Codes.push(...aiSuggestions.icd10.map(c => ({
          code: c.code,
          description: c.rationale
        })));
      }
    }

    // HCPCS codes
    if (aiSuggestions) {
      // Check if it's EnhancedCodingSuggestion
      if ('procedureCodes' in aiSuggestions && aiSuggestions.procedureCodes.hcpcs) {
        hcpcsCodes.push(...aiSuggestions.procedureCodes.hcpcs.map(c => ({
          code: c.code,
          modifiers: c.modifiers
        })));
      } else if ('hcpcs' in aiSuggestions && aiSuggestions.hcpcs) {
        // Basic CodingSuggestion
        hcpcsCodes.push(...aiSuggestions.hcpcs.map(c => ({
          code: c.code,
          modifiers: c.modifiers
        })));
      }
    }

    return { cptCodes, icd10Codes, hcpcsCodes };
  }

  /**
   * Calculate total charges
   */
  private static calculateTotalCharges(coding: {
    cptCodes: Array<{ chargeAmount?: number }>;
  }): number {
    return coding.cptCodes.reduce((sum, code) => sum + (code.chargeAmount || 100), 0);
  }

  /**
   * Estimate reimbursement
   */
  private static estimateReimbursement(coding: {
    cptCodes: Array<{ chargeAmount?: number }>;
  }): number {
    // Simplified: assume 80% reimbursement rate
    return this.calculateTotalCharges(coding) * 0.8;
  }

  // ============================================================================
  // Monitoring & Analytics Methods
  // ============================================================================

  /**
   * Get billing workflow metrics
   */
  static async getWorkflowMetrics(
    dateFrom: string,
    dateTo: string
  ): Promise<{
    totalWorkflows: number;
    successRate: number;
    averageProcessingTime: number;
    manualReviewRate: number;
    totalCharges: number;
    estimatedReimbursement: number;
    topErrors: Array<{ code: string; count: number; message: string }>;
  }> {
    // Query workflow history from database
    const { data: workflows, error } = await supabase
      .from('billing_workflows')
      .select('*')
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo);

    if (error) throw new Error(`Failed to get workflow metrics: ${error.message}`);

    const totalWorkflows = workflows?.length || 0;
    const successfulWorkflows = workflows?.filter(w => w.success).length || 0;
    const manualReviews = workflows?.filter(w => w.requires_manual_review).length || 0;

    const successRate = totalWorkflows > 0 ? (successfulWorkflows / totalWorkflows) * 100 : 0;
    const manualReviewRate = totalWorkflows > 0 ? (manualReviews / totalWorkflows) * 100 : 0;

    const totalCharges = workflows?.reduce((sum, w) => sum + (w.total_charges || 0), 0) || 0;
    const estimatedReimbursement = workflows?.reduce((sum, w) => sum + (w.estimated_reimbursement || 0), 0) || 0;

    const processingTimes = workflows?.map(w => w.processing_time_ms).filter(t => t > 0) || [];
    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length
      : 0;

    // Top errors
    const errorCounts = new Map<string, { count: number; message: string }>();
    workflows?.forEach(w => {
      if (w.errors && Array.isArray(w.errors)) {
        w.errors.forEach((error: { code: string; message?: string }) => {
          const existing = errorCounts.get(error.code);
          if (existing) {
            existing.count += 1;
          } else {
            errorCounts.set(error.code, { count: 1, message: error.message || 'Unknown error' });
          }
        });
      }
    });

    const topErrors = Array.from(errorCounts.entries())
      .map(([code, { count, message }]) => ({ code, count, message }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalWorkflows,
      successRate,
      averageProcessingTime,
      manualReviewRate,
      totalCharges,
      estimatedReimbursement,
      topErrors
    };
  }
}

export default UnifiedBillingService;
