// SDOH Billing Service - AI-powered billing encoder with social determinants focus
// Integrates with existing WellFit billing infrastructure

import { supabase } from '../lib/supabaseClient';
import { logPhiAccess } from './phiAccessLogger';
import type {
  SDOHAssessment,
  SDOHFactor,
  CCMTimeTracking,
  CCMActivity,
  CMSDocumentation,
  EnhancedCodingSuggestion,
  BillingValidation,
  ValidationError,
  ValidationWarning,
  AuditFlag
} from '../types/sdohBilling';
import { CCM_CODES } from '../types/sdohBilling';
import type { CodingSuggestion } from '../types/billing';
import { BillingService } from './billingService';
import { FeeScheduleService } from './feeScheduleService';

export class SDOHBillingService {
  // Z-Code and SDOH Assessment
  static async assessSDOHComplexity(patientId: string): Promise<SDOHAssessment> {
    // HIPAA §164.312(b): Log PHI access
    await logPhiAccess({
      phiType: 'assessment',
      phiResourceId: `sdoh_${patientId}`,
      patientId,
      accessType: 'view',
      accessMethod: 'API',
      purpose: 'treatment',
    });

    // Get patient's recent check-ins and assessment data
    const { data: checkIns, error: checkInError } = await supabase
      .from('check_ins')
      .select('*')
      .eq('user_id', patientId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (checkInError) throw new Error(`Failed to get check-ins: ${checkInError.message}`);

    // Get existing SDOH assessment if available
    const { data: existingAssessment } = await supabase
      .from('sdoh_assessments')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1);

    // Analyze check-in data for SDOH factors
    const sdohFactors = this.analyzeCheckInsForSDOH(checkIns || []);

    // Calculate complexity score
    const complexityScore = this.calculateComplexityScore(sdohFactors);

    // Determine CCM eligibility and tier
    const ccmAssessment = this.assessCCMEligibility(complexityScore, sdohFactors);

    const assessment: SDOHAssessment = {
      patientId,
      assessmentDate: new Date().toISOString().split('T')[0],
      housingInstability: sdohFactors.housing,
      foodInsecurity: sdohFactors.nutrition,
      transportationBarriers: sdohFactors.transportation,
      socialIsolation: sdohFactors.social,
      financialInsecurity: sdohFactors.financial,
      educationBarriers: sdohFactors.education,
      employmentConcerns: sdohFactors.employment,
      overallComplexityScore: complexityScore,
      ccmEligible: ccmAssessment.eligible,
      ccmTier: ccmAssessment.tier
    };

    // Save assessment to database
    const { data: savedAssessment, error: saveError } = await supabase
      .from('sdoh_assessments')
      .insert({
        patient_id: patientId,
        assessment_date: assessment.assessmentDate,
        housing_instability: assessment.housingInstability,
        food_insecurity: assessment.foodInsecurity,
        transportation_barriers: assessment.transportationBarriers,
        social_isolation: assessment.socialIsolation,
        financial_insecurity: assessment.financialInsecurity,
        education_barriers: assessment.educationBarriers,
        employment_concerns: assessment.employmentConcerns,
        overall_complexity_score: assessment.overallComplexityScore,
        ccm_eligible: assessment.ccmEligible,
        ccm_tier: assessment.ccmTier
      })
      .select()
      .single();

    if (saveError) throw new Error(`Failed to save SDOH assessment: ${saveError.message}`);

    return { ...assessment, id: savedAssessment.id };
  }

  // Enhanced coding suggestions with SDOH integration
  static async analyzeEncounter(encounterId: string): Promise<EnhancedCodingSuggestion> {
    // Get encounter details with related data
    const { data: encounter, error: encounterError } = await supabase
      .from('encounters')
      .select(`
        *,
        patient:patients(*),
        procedures:encounter_procedures(*),
        diagnoses:encounter_diagnoses(*),
        clinical_notes(*)
      `)
      .eq('id', encounterId)
      .single();

    if (encounterError) throw new Error(`Failed to get encounter: ${encounterError.message}`);
    if (!encounter.patient_id) throw new Error('Patient ID required for encounter analysis');

    // Get SDOH assessment for patient
    const sdohAssessment = await this.assessSDOHComplexity(encounter.patient_id);

    // Get AI suggestions from existing system
    const aiSuggestions = await BillingService.getCodingSuggestions(encounterId);

    // Enhance suggestions with SDOH codes and CCM recommendations
    const enhancedSuggestion = await this.enhanceWithSDOH(
      aiSuggestions,
      sdohAssessment,
      encounter
    );

    // Calculate audit readiness
    const auditReadiness = this.assessAuditReadiness(enhancedSuggestion, encounter);

    return {
      ...enhancedSuggestion,
      auditReadiness,
      sdohAssessment
    };
  }

  // CCM Time Tracking
  static async trackCCMTime(
    encounterId: string,
    patientId: string,
    activities: CCMActivity[]
  ): Promise<CCMTimeTracking> {
    const totalMinutes = activities.reduce((sum, activity) => sum + activity.duration, 0);
    const billableMinutes = activities
      .filter(activity => activity.billable)
      .reduce((sum, activity) => sum + activity.duration, 0);

    // Determine suggested codes based on time and complexity
    const suggestedCodes = this.determineCCMCodes(billableMinutes, patientId);

    // Check compliance
    const { isCompliant, complianceNotes } = this.checkCCMCompliance(activities, billableMinutes);

    const serviceDate = new Date().toISOString().split('T')[0];
    const serviceMonth = new Date(serviceDate).toISOString().slice(0, 8) + '01'; // First day of month

    const timeTracking: CCMTimeTracking = {
      encounterId,
      patientId,
      serviceDate,
      activities,
      totalMinutes,
      billableMinutes,
      suggestedCodes,
      isCompliant,
      complianceNotes
    };

    // Save to database
    const { data: savedTracking, error: saveError } = await supabase
      .from('ccm_time_tracking')
      .insert({
        encounter_id: encounterId,
        patient_id: patientId,
        service_month: serviceMonth,
        activities: activities,
        total_minutes: totalMinutes,
        billable_minutes: billableMinutes,
        suggested_codes: suggestedCodes,
        is_compliant: isCompliant,
        compliance_notes: complianceNotes
      })
      .select()
      .single();

    if (saveError) throw new Error(`Failed to save CCM time tracking: ${saveError.message}`);

    return { ...timeTracking, id: savedTracking.id };
  }

  // CMS Documentation Generator
  static async generateCMSDocumentation(encounterId: string): Promise<CMSDocumentation> {
    // Get encounter and patient data
    const { data: encounter, error } = await supabase
      .from('encounters')
      .select(`
        *,
        patient:patients(*),
        clinical_notes(*)
      `)
      .eq('id', encounterId)
      .single();

    if (error) throw new Error(`Failed to get encounter: ${error.message}`);
    if (!encounter.patient_id) throw new Error('Patient ID required');

    // Check existing CMS documentation
    const { data: existingDoc } = await supabase
      .from('cms_documentation')
      .select('*')
      .eq('encounter_id', encounterId)
      .single();

    // Generate or update documentation
    const documentation: CMSDocumentation = {
      encounterId,
      patientId: encounter.patient_id,
      consentObtained: existingDoc?.consent_obtained || false,
      consentDate: existingDoc?.consent_date,
      carePlanUpdated: existingDoc?.care_plan_updated || false,
      carePlanDate: existingDoc?.care_plan_date,
      patientAccessProvided: existingDoc?.patient_access_provided || false,
      communicationLog: existingDoc?.communication_log || [],
      qualityMeasures: existingDoc?.quality_measures || []
    };

    // Save documentation
    const { data: savedDoc, error: saveError } = await supabase
      .from('cms_documentation')
      .upsert({
        encounter_id: encounterId,
        patient_id: encounter.patient_id,
        consent_obtained: documentation.consentObtained,
        consent_date: documentation.consentDate,
        care_plan_updated: documentation.carePlanUpdated,
        care_plan_date: documentation.carePlanDate,
        patient_access_provided: documentation.patientAccessProvided,
        communication_log: documentation.communicationLog,
        quality_measures: documentation.qualityMeasures
      })
      .select()
      .single();

    if (saveError) throw new Error(`Failed to save CMS documentation: ${saveError.message}`);

    return { ...documentation, id: savedDoc.id };
  }

  // Billing Compliance Validation
  static async validateBillingCompliance(
    suggestion: EnhancedCodingSuggestion
  ): Promise<BillingValidation> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const auditFlags: AuditFlag[] = [];

    // Validate SDOH coding
    this.validateSDOHCoding(suggestion, errors, warnings);

    // Validate CCM requirements
    this.validateCCMRequirements(suggestion, errors, warnings, auditFlags);

    // Check documentation completeness
    this.validateDocumentationCompleteness(suggestion, warnings, auditFlags);

    // Validate code combinations
    this.validateCodeCombinations(suggestion, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      auditFlags
    };
  }

  // Private helper methods
  private static analyzeCheckInsForSDOH(checkIns: any[]): Record<string, SDOHFactor | null> {
    const factors: Record<string, SDOHFactor | null> = {
      housing: null,
      nutrition: null,
      transportation: null,
      social: null,
      financial: null,
      education: null,
      employment: null
    };

    // CRITICAL FIX: Handle empty check-ins data
    if (!checkIns || checkIns.length === 0) {
      console.warn('No check-in data available for SDOH analysis - returning empty factors');
      return factors;
    }

    // Analyze check-in data for SDOH indicators
    checkIns.forEach(checkIn => {
      // Safety checks for missing data
      if (!checkIn) {
        console.warn('Null check-in encountered, skipping');
        return;
      }
      // Look for housing indicators
      if (checkIn.housing_situation && checkIn.housing_situation !== 'stable') {
        factors.housing = {
          zCode: checkIn.housing_situation === 'homeless' ? 'Z59.0' : 'Z59.1',
          description: checkIn.housing_situation === 'homeless' ? 'Homelessness' : 'Inadequate housing',
          severity: this.assessSeverity(checkIn.housing_situation),
          impact: 'high',
          documented: true,
          source: 'patient_checkin'
        };
      }

      // Look for food security indicators (with null safety)
      if (checkIn.food_security === 'insecure' || (checkIn.meals_missed != null && checkIn.meals_missed > 0)) {
        factors.nutrition = {
          zCode: 'Z59.3',
          description: 'Food insecurity',
          severity: (checkIn.meals_missed || 0) > 2 ? 'severe' : 'moderate',
          impact: 'high',
          documented: true,
          source: 'patient_checkin'
        };
      }

      // Look for transportation barriers (with null safety)
      if (checkIn.transportation_barriers === true) {
        factors.transportation = {
          zCode: 'Z59.8',
          description: 'Transportation barriers',
          severity: 'moderate',
          impact: 'medium',
          documented: true,
          source: 'patient_checkin'
        };
      }

      // Look for social isolation indicators (with null safety)
      if (checkIn.social_isolation_score != null && checkIn.social_isolation_score > 7) {
        factors.social = {
          zCode: 'Z60.2',
          description: 'Social isolation',
          severity: checkIn.social_isolation_score > 12 ? 'severe' : 'moderate',
          impact: 'medium',
          documented: true,
          source: 'patient_checkin'
        };
      }
    });

    return factors;
  }

  private static calculateComplexityScore(factors: Record<string, SDOHFactor | null>): number {
    let score = 0;

    Object.values(factors).forEach(factor => {
      if (factor) {
        // Base weight from ZCODE_MAPPING
        const baseWeight = this.getZCodeWeight(factor.zCode);

        // Severity multiplier
        const severityMultiplier = {
          'mild': 1,
          'moderate': 1.5,
          'severe': 2
        }[factor.severity];

        score += baseWeight * severityMultiplier;
      }
    });

    return Math.round(score);
  }

  private static assessCCMEligibility(
    complexityScore: number,
    factors: Record<string, SDOHFactor | null>
  ): { eligible: boolean; tier: 'standard' | 'complex' | 'non-eligible' } {
    const hasSDOHFactors = Object.values(factors).some(factor => factor !== null);

    if (complexityScore >= 4 && hasSDOHFactors) {
      return { eligible: true, tier: 'complex' };
    } else if (complexityScore >= 2) {
      return { eligible: true, tier: 'standard' };
    } else {
      return { eligible: false, tier: 'non-eligible' };
    }
  }

  private static async enhanceWithSDOH(
    baseSuggestions: CodingSuggestion,
    sdohAssessment: SDOHAssessment,
    encounter: any
  ): Promise<EnhancedCodingSuggestion> {
    // Add SDOH Z-codes to ICD-10 suggestions
    const sdohCodes = this.generateSDOHCodes(sdohAssessment);

    // Add CCM CPT codes based on assessment
    const ccmCodes = this.generateCCMCodes(sdohAssessment);

    // Calculate expected reimbursement (now async)
    const expectedReimbursement = await this.calculateExpectedReimbursement(ccmCodes);

    return {
      medicalCodes: {
        icd10: [
          ...(baseSuggestions.icd10?.map(code => ({
            code: code.code,
            rationale: code.rationale || 'Standard diagnostic code',
            principal: code.principal || false,
            category: 'medical' as const
          })) || []),
          ...sdohCodes
        ]
      },
      procedureCodes: {
        cpt: [
          ...(baseSuggestions.cpt?.map(code => ({
            code: code.code,
            modifiers: code.modifiers,
            rationale: code.rationale || 'Standard procedure code'
          })) || []),
          ...ccmCodes
        ],
        hcpcs: baseSuggestions.hcpcs?.map(code => ({
          code: code.code,
          modifiers: code.modifiers,
          rationale: code.rationale || 'Standard HCPCS code'
        })) || []
      },
      sdohAssessment,
      ccmRecommendation: {
        eligible: sdohAssessment.ccmEligible,
        tier: sdohAssessment.ccmTier,
        justification: this.generateCCMJustification(sdohAssessment),
        expectedReimbursement,
        requiredDocumentation: this.getRequiredDocumentation(sdohAssessment.ccmTier)
      },
      auditReadiness: {
        score: 0, // Will be calculated later
        missingElements: [],
        recommendations: []
      },
      confidence: baseSuggestions.confidence || 85,
      notes: baseSuggestions.notes || 'Enhanced with SDOH analysis'
    };
  }

  private static generateSDOHCodes(assessment: SDOHAssessment) {
    const codes = [];

    if (assessment.housingInstability) {
      codes.push({
        code: assessment.housingInstability.zCode,
        rationale: `Housing instability documented: ${assessment.housingInstability.description}`,
        principal: false,
        category: 'sdoh' as const
      });
    }

    if (assessment.foodInsecurity) {
      codes.push({
        code: assessment.foodInsecurity.zCode,
        rationale: `Food insecurity documented: ${assessment.foodInsecurity.description}`,
        principal: false,
        category: 'sdoh' as const
      });
    }

    if (assessment.transportationBarriers) {
      codes.push({
        code: assessment.transportationBarriers.zCode,
        rationale: `Transportation barriers documented: ${assessment.transportationBarriers.description}`,
        principal: false,
        category: 'sdoh' as const
      });
    }

    if (assessment.socialIsolation) {
      codes.push({
        code: assessment.socialIsolation.zCode,
        rationale: `Social isolation documented: ${assessment.socialIsolation.description}`,
        principal: false,
        category: 'sdoh' as const
      });
    }

    if (assessment.financialInsecurity) {
      codes.push({
        code: assessment.financialInsecurity.zCode,
        rationale: `Financial insecurity documented: ${assessment.financialInsecurity.description}`,
        principal: false,
        category: 'sdoh' as const
      });
    }

    return codes;
  }

  private static generateCCMCodes(assessment: SDOHAssessment) {
    const codes = [];

    if (assessment.ccmEligible) {
      if (assessment.ccmTier === 'complex') {
        codes.push({
          code: '99487',
          rationale: `Complex CCM justified by SDOH complexity score: ${assessment.overallComplexityScore}`,
          timeRequired: 60,
          sdohJustification: 'Multiple social determinants requiring complex care coordination'
        });
      } else if (assessment.ccmTier === 'standard') {
        codes.push({
          code: '99490',
          rationale: `Standard CCM justified by chronic conditions and moderate complexity score: ${assessment.overallComplexityScore}`,
          timeRequired: 20
        });
      }
    }

    return codes;
  }

  private static async calculateExpectedReimbursement(codes: any[]): Promise<number> {
    // Use database fee schedule service instead of hardcoded rates
    const codeList = codes.map(c => ({ code: c.code, units: 1 }));
    const { total } = await FeeScheduleService.calculateExpectedReimbursement(
      codeList,
      'cpt',
      'medicare'
    );

    // Fallback to hardcoded if database unavailable
    if (total === 0 && codes.length > 0) {
      return codes.reduce((sum, code) => {
        const codeData = CCM_CODES[code.code as keyof typeof CCM_CODES];
        return sum + (codeData?.baseReimbursement || 0);
      }, 0);
    }

    return total;
  }

  private static generateCCMJustification(assessment: SDOHAssessment): string {
    const factors = [];

    if (assessment.housingInstability) factors.push('housing instability');
    if (assessment.foodInsecurity) factors.push('food insecurity');
    if (assessment.transportationBarriers) factors.push('transportation barriers');
    if (assessment.socialIsolation) factors.push('social isolation');
    if (assessment.financialInsecurity) factors.push('financial insecurity');

    if (factors.length === 0) return 'Standard care coordination for chronic conditions';

    return `Complex care management justified by multiple SDOH factors: ${factors.join(', ')}. Complexity score: ${assessment.overallComplexityScore}`;
  }

  private static getRequiredDocumentation(tier: string): string[] {
    const base = [
      'Patient consent for CCM services',
      'Comprehensive care plan',
      'Patient access to care team 24/7',
      'Electronic health record system'
    ];

    if (tier === 'complex') {
      base.push(
        'SDOH assessment documentation',
        'Complex care coordination notes',
        'Multiple chronic condition documentation',
        'Care team communication logs'
      );
    }

    return base;
  }

  private static assessAuditReadiness(suggestion: EnhancedCodingSuggestion, encounter: any) {
    const missingElements = [];
    const recommendations = [];
    let score = 100;

    // Check documentation completeness
    if (!encounter.clinical_notes || encounter.clinical_notes.length === 0) {
      missingElements.push('Clinical documentation');
      score -= 20;
      recommendations.push('Add clinical notes documenting patient encounter');
    }

    // Check SDOH documentation
    if (suggestion.sdohAssessment.overallComplexityScore > 0) {
      const sdohFactors = [
        suggestion.sdohAssessment.housingInstability,
        suggestion.sdohAssessment.foodInsecurity,
        suggestion.sdohAssessment.transportationBarriers,
        suggestion.sdohAssessment.socialIsolation,
        suggestion.sdohAssessment.financialInsecurity
      ].filter(factor => factor !== null);

      if (sdohFactors.length > 0 && !sdohFactors.every(factor => factor?.documented)) {
        missingElements.push('SDOH factor documentation');
        score -= 15;
        recommendations.push('Ensure all identified SDOH factors are properly documented in clinical notes');
      }
    }

    // Check CCM requirements
    if (suggestion.ccmRecommendation.eligible) {
      const requiredDocs = suggestion.ccmRecommendation.requiredDocumentation;
      const missingCCMDocs = requiredDocs.filter(doc =>
        !this.checkDocumentationExists(doc, encounter)
      );

      if (missingCCMDocs.length > 0) {
        missingElements.push('CCM documentation requirements');
        score -= missingCCMDocs.length * 5;
        recommendations.push(`Complete CCM documentation: ${missingCCMDocs.join(', ')}`);
      }
    }

    return {
      score: Math.max(score, 0),
      missingElements,
      recommendations
    };
  }

  private static checkDocumentationExists(requirement: string, encounter: any): boolean {
    // Check for required documentation based on requirement type
    if (!encounter) return false;

    const requirementLower = requirement.toLowerCase();

    // Check for patient consent
    if (requirementLower.includes('consent')) {
      return !!(encounter.patient_consent || encounter.ccm_consent_obtained);
    }

    // Check for care plan
    if (requirementLower.includes('care plan')) {
      return !!(encounter.care_plan || encounter.care_plan_updated);
    }

    // Check for patient access
    if (requirementLower.includes('patient access') || requirementLower.includes('24/7')) {
      return !!(encounter.patient_access_provided || encounter.after_hours_access);
    }

    // Check for EHR system
    if (requirementLower.includes('electronic health record') || requirementLower.includes('ehr')) {
      return true; // Assume EHR exists if we're in the system
    }

    // Check for SDOH assessment
    if (requirementLower.includes('sdoh')) {
      return !!(encounter.sdoh_assessment || encounter.social_history);
    }

    // Check for care coordination notes
    if (requirementLower.includes('care coordination') || requirementLower.includes('communication log')) {
      return !!(encounter.care_coordination_notes || encounter.clinical_notes);
    }

    // Check for chronic condition documentation
    if (requirementLower.includes('chronic condition')) {
      return !!(encounter.diagnoses && encounter.diagnoses.length > 0);
    }

    // Default: check for any clinical documentation
    return !!(encounter.clinical_notes || encounter.documentation);
  }

  private static determineCCMCodes(billableMinutes: number, patientId: string): string[] {
    const codes = [];

    if (billableMinutes >= 60) {
      codes.push('99487'); // Complex CCM first 60 minutes

      const additionalMinutes = billableMinutes - 60;
      const additional30MinBlocks = Math.floor(additionalMinutes / 30);

      for (let i = 0; i < additional30MinBlocks; i++) {
        codes.push('99489'); // Each additional 30 minutes
      }
    } else if (billableMinutes >= 20) {
      codes.push('99490'); // Basic CCM first 20 minutes

      const additionalMinutes = billableMinutes - 20;
      const additional20MinBlocks = Math.floor(additionalMinutes / 20);

      for (let i = 0; i < additional20MinBlocks; i++) {
        codes.push('99491'); // Each additional 20 minutes
      }
    }

    return codes;
  }

  private static checkCCMCompliance(
    activities: CCMActivity[],
    billableMinutes: number
  ): { isCompliant: boolean; complianceNotes: string[] } {
    const notes = [];
    let isCompliant = true;

    // Check minimum time requirement
    if (billableMinutes < 20) {
      notes.push('Insufficient billable time for CCM (minimum 20 minutes required)');
      isCompliant = false;
    }

    // Check activity types
    const requiredTypes: CCMActivity['type'][] = ['assessment', 'care_coordination'];
    const providedTypes = Array.from(new Set(activities.map(a => a.type)));

    const missingTypes = requiredTypes.filter(type => !providedTypes.includes(type));
    if (missingTypes.length > 0) {
      notes.push(`Missing required activity types: ${missingTypes.join(', ')}`);
      isCompliant = false;
    }

    // Check documentation quality
    const poorlyDocumented = activities.filter(a => !a.description || a.description.length < 10);
    if (poorlyDocumented.length > 0) {
      notes.push(`${poorlyDocumented.length} activities need better documentation`);
    }

    return { isCompliant, complianceNotes: notes };
  }

  private static validateSDOHCoding(
    suggestion: EnhancedCodingSuggestion,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const sdohCodes = suggestion.medicalCodes.icd10.filter(code => code.category === 'sdoh');

    sdohCodes.forEach(code => {
      if (!code.rationale || code.rationale.length < 20) {
        warnings.push({
          code: 'SDOH_DOCUMENTATION',
          field: `icd10.${code.code}`,
          message: 'SDOH codes require detailed documentation',
          recommendation: 'Add specific documentation explaining the social determinant and its impact on health'
        });
      }
    });
  }

  private static validateCCMRequirements(
    suggestion: EnhancedCodingSuggestion,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    auditFlags: AuditFlag[]
  ): void {
    const ccmCodes = suggestion.procedureCodes.cpt.filter(code =>
      ['99490', '99491', '99487', '99489'].includes(code.code)
    );

    if (ccmCodes.length > 0 && !suggestion.ccmRecommendation.eligible) {
      errors.push({
        code: 'CCM_INELIGIBLE',
        field: 'ccmRecommendation',
        message: 'CCM codes suggested but patient not eligible',
        severity: 'error'
      });
    }

    ccmCodes.forEach(code => {
      if (code.code === '99487' && suggestion.ccmRecommendation.tier !== 'complex') {
        warnings.push({
          code: 'COMPLEX_CCM_JUSTIFICATION',
          field: `cpt.${code.code}`,
          message: 'Complex CCM requires additional justification',
          recommendation: 'Ensure multiple chronic conditions and SDOH factors are documented'
        });
      }
    });
  }

  private static validateDocumentationCompleteness(
    suggestion: EnhancedCodingSuggestion,
    warnings: ValidationWarning[],
    auditFlags: AuditFlag[]
  ): void {
    if (suggestion.auditReadiness.score < 80) {
      auditFlags.push({
        type: 'documentation',
        risk: 'medium',
        description: 'Documentation completeness below recommended threshold',
        remediation: 'Complete missing documentation elements before claim submission'
      });
    }
  }

  private static validateCodeCombinations(
    suggestion: EnhancedCodingSuggestion,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const cptCodes = suggestion.procedureCodes.cpt.map(c => c.code);

    // Check for conflicting CCM codes
    if (cptCodes.includes('99490') && cptCodes.includes('99487')) {
      errors.push({
        code: 'CONFLICTING_CCM_CODES',
        field: 'cpt',
        message: 'Cannot bill both basic and complex CCM for the same period',
        severity: 'error'
      });
    }
  }

  private static assessSeverity(value: string): 'mild' | 'moderate' | 'severe' {
    // Simplified severity assessment - would be more sophisticated in production
    const severityMap: Record<string, 'mild' | 'moderate' | 'severe'> = {
      'homeless': 'severe',
      'inadequate': 'moderate',
      'unstable': 'moderate',
      'crowded': 'mild'
    };

    return severityMap[value] || 'mild';
  }

  private static getZCodeWeight(zCode: string): number {
    const weights: Record<string, number> = {
      'Z59.0': 3, // Homelessness
      'Z59.1': 2, // Inadequate housing
      'Z59.3': 2, // Food insecurity
      'Z59.8': 2, // Transportation
      'Z60.2': 1, // Social isolation
      'Z59.6': 2  // Financial insecurity
    };

    return weights[zCode] || 1;
  }
}

export default SDOHBillingService;