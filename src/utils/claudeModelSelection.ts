// Model selection logic for WellFit Community Claude integration
import { UserRole, ClaudeModel, RequestType, ModelSelectionCriteria } from '../types/claude';

export interface ModelSelectionStrategy {
  selectModel(criteria: ModelSelectionCriteria): ClaudeModel;
  estimateCost(model: ClaudeModel, inputText: string, expectedOutputTokens?: number): number;
}

// Cost per 1K tokens for each model (input, output)
const MODEL_COSTS = {
  [ClaudeModel.HAIKU_3]: { input: 0.00025, output: 0.00125 }, // Legacy
  [ClaudeModel.HAIKU_3_5]: { input: 0.0001, output: 0.0005 }, // CURRENT: Ultra-fast UI/personalization
  [ClaudeModel.SONNET_3_5]: { input: 0.003, output: 0.015 }, // CURRENT: Revenue-critical billing
  [ClaudeModel.OPUS_3]: { input: 0.015, output: 0.075 }, // Legacy Opus
  [ClaudeModel.OPUS_4_5]: { input: 0.015, output: 0.075 } // LATEST: Opus 4.5 premium
} as const;

// Model capabilities and characteristics
const _MODEL_CHARACTERISTICS = {
  [ClaudeModel.HAIKU_3]: {
    speed: 'fastest',
    cost: 'lowest',
    capability: 'basic',
    bestFor: ['simple_questions', 'basic_health_guidance']
  },
  [ClaudeModel.HAIKU_3_5]: {
    speed: 'ultra_fast',
    cost: 'ultra_low',
    capability: 'intelligent',
    bestFor: ['ui_personalization', 'pattern_recognition', 'dashboard_intelligence', 'quick_responses', 'nurse_scribe', 'admin_panel']
  },
  [ClaudeModel.SONNET_3_5]: {
    speed: 'fast',
    cost: 'moderate',
    capability: 'advanced',
    bestFor: ['health_analysis', 'complex_questions', 'care_recommendations', 'senior_interactions', 'clinical_analysis', 'fhir_processing', 'risk_assessment', 'medical_research', 'complex_coding', 'autonomous_agents', 'medical_coding']
  },
  [ClaudeModel.OPUS_3]: {
    speed: 'medium',
    cost: 'premium',
    capability: 'maximum',
    bestFor: ['complex_research', 'advanced_reasoning', 'critical_clinical_decisions']
  }
} as const;

export class WellFitModelSelector implements ModelSelectionStrategy {
  /**
   * Select the most appropriate Claude model based on user role, request type, and complexity
   */
  selectModel(criteria: ModelSelectionCriteria): ClaudeModel {
    const { userRole, requestType, complexity, budgetTier } = criteria;

    // Admin users get access to most capable models for clinical decisions
    if (userRole === UserRole.ADMIN) {
      return this.selectAdminModel(requestType, complexity);
    }

    // Healthcare providers get balanced capability/cost for clinical work
    if (userRole === UserRole.HEALTHCARE_PROVIDER) {
      return this.selectProviderModel(requestType, complexity, budgetTier);
    }

    // Senior patients and caregivers get cost-effective, fast models
    if (userRole === UserRole.SENIOR_PATIENT || userRole === UserRole.CAREGIVER) {
      return this.selectPatientModel(requestType, complexity);
    }

    // Default fallback
    return ClaudeModel.SONNET_3_5;
  }

  /**
   * Admin model selection - uses Sonnet 4.5 for advanced admin and nurse scribe functionality
   */
  private selectAdminModel(requestType: RequestType, complexity: 'simple' | 'moderate' | 'complex'): ClaudeModel {
    switch (requestType) {
      case RequestType.ANALYTICS:
      case RequestType.FHIR_ANALYSIS:
      case RequestType.RISK_ASSESSMENT:
        return ClaudeModel.SONNET_3_5; // Latest model for best admin/nurse analytics

      case RequestType.CLINICAL_NOTES:
        return complexity === 'complex' ? ClaudeModel.SONNET_3_5 : ClaudeModel.SONNET_3_5;

      case RequestType.HEALTH_INSIGHTS:
        return ClaudeModel.SONNET_3_5; // Good balance for general insights

      default:
        return ClaudeModel.SONNET_3_5; // Default to latest for admin panel
    }
  }

  /**
   * Healthcare provider model selection - balances capability with cost considerations
   */
  private selectProviderModel(
    requestType: RequestType,
    complexity: 'simple' | 'moderate' | 'complex',
    budgetTier: 'standard' | 'premium'
  ): ClaudeModel {
    const _usePremium = budgetTier === 'premium';

    switch (requestType) {
      case RequestType.RISK_ASSESSMENT:
      case RequestType.FHIR_ANALYSIS:
        return ClaudeModel.SONNET_3_5; // SONNET_4 is alias for SONNET_3_5

      case RequestType.CLINICAL_NOTES:
        return ClaudeModel.SONNET_3_5; // Simplified since SONNET_4 == SONNET_3_5

      case RequestType.ANALYTICS:
        return ClaudeModel.SONNET_3_5; // Simplified since SONNET_4 == SONNET_3_5

      case RequestType.HEALTH_QUESTION:
      case RequestType.MEDICATION_GUIDANCE:
        return complexity === 'complex' ? ClaudeModel.SONNET_3_5 : ClaudeModel.HAIKU_3;

      default:
        return ClaudeModel.SONNET_3_5;
    }
  }

  /**
   * Patient/Caregiver model selection - uses Sonnet 3.5 for excellent senior experience
   */
  private selectPatientModel(requestType: RequestType, _complexity: 'simple' | 'moderate' | 'complex'): ClaudeModel {
    switch (requestType) {
      case RequestType.HEALTH_QUESTION:
      case RequestType.MEDICATION_GUIDANCE:
        // Seniors love Sonnet 3.5 - great balance of quality and cost
        return ClaudeModel.SONNET_3_5;

      case RequestType.HEALTH_INSIGHTS:
        // Sonnet 3.5 provides excellent health interpretations seniors appreciate
        return ClaudeModel.SONNET_3_5;

      // Patients shouldn't have direct access to clinical analysis tools
      case RequestType.ANALYTICS:
      case RequestType.FHIR_ANALYSIS:
      case RequestType.RISK_ASSESSMENT:
      case RequestType.CLINICAL_NOTES:
      default:
        return ClaudeModel.SONNET_3_5; // Default to Sonnet 3.5 for senior-facing
    }
  }

  /**
   * Estimate cost for a request based on input text and expected output
   */
  estimateCost(model: ClaudeModel, inputText: string, expectedOutputTokens: number = 1000): number {
    const costs = MODEL_COSTS[model];
    const inputTokens = Math.ceil(inputText.length / 4); // Rough estimation: 4 chars per token

    return (inputTokens / 1000 * costs.input) + (expectedOutputTokens / 1000 * costs.output);
  }

  /**
   * Get model recommendations for a specific use case
   */
  getModelRecommendations(userRole: UserRole): Array<{
    model: ClaudeModel;
    recommendedFor: string[];
    costTier: 'low' | 'medium' | 'high';
    speed: 'fast' | 'medium' | 'slow';
  }> {
    const baseRecommendations: Array<{
      model: ClaudeModel;
      recommendedFor: string[];
      costTier: 'low' | 'medium' | 'high';
      speed: 'fast' | 'medium' | 'slow';
    }> = [
      {
        model: ClaudeModel.HAIKU_3,
        recommendedFor: ['Simple health questions', 'Basic medication info', 'Quick responses'],
        costTier: 'low',
        speed: 'fast'
      },
      {
        model: ClaudeModel.SONNET_3_5,
        recommendedFor: ['Health analysis', 'Complex questions', 'Care recommendations'],
        costTier: 'medium',
        speed: 'medium'
      }
    ];

    // Only show advanced models for admin and healthcare providers
    if (userRole === UserRole.ADMIN || userRole === UserRole.HEALTHCARE_PROVIDER) {
      baseRecommendations.push({
        model: ClaudeModel.SONNET_3_5,
        recommendedFor: ['Nurse scribe', 'Admin panel', 'Medical coding', 'Complex analytics', 'Autonomous agents'],
        costTier: 'medium',
        speed: 'fast'
      });
    }

    return baseRecommendations;
  }

  /**
   * Determine request complexity based on content analysis
   */
  analyzeRequestComplexity(content: string, requestType: RequestType): 'simple' | 'moderate' | 'complex' {
    const wordCount = content.split(/\s+/).length;
    const hasMultipleQuestions = (content.match(/\?/g) || []).length > 1;
    const hasMedicalTerms = /\b(diagnosis|medication|symptom|treatment|condition|chronic|acute)\b/i.test(content);
    const hasMultipleDataPoints = requestType === RequestType.FHIR_ANALYSIS ||
                                 requestType === RequestType.ANALYTICS ||
                                 requestType === RequestType.RISK_ASSESSMENT;

    // Complex criteria
    if (hasMultipleDataPoints ||
        (wordCount > 100 && hasMedicalTerms)) {
      return 'complex';
    }

    // Simple criteria
    if (wordCount < 20 && !hasMultipleQuestions && !hasMedicalTerms) {
      return 'simple';
    }

    // Default to moderate
    return 'moderate';
  }
}

// Export singleton instance
export const modelSelector = new WellFitModelSelector();

// Helper function to create model selection criteria
export function createModelCriteria(
  userRole: UserRole,
  requestType: RequestType,
  content: string,
  budgetTier: 'standard' | 'premium' = 'standard'
): ModelSelectionCriteria {
  const _complexity = modelSelector.analyzeRequestComplexity(content, requestType);

  return {
    userRole,
    requestType,
    complexity: _complexity,
    budgetTier
  };
}
