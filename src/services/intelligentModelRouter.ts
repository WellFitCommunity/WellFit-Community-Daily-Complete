/**
 * Intelligent Model Router
 *
 * Routes Claude API requests to the optimal model based on use case:
 * - Haiku 4.5: Fast, cheap - UI personalization, pattern recognition, dashboard intelligence
 * - Sonnet 4.5: Accurate, premium - Billing, revenue, medical coding (money-critical)
 * - Opus 4.1: Reserved for complex reasoning (future use)
 */

import { ClaudeModel, RequestType } from '../types/claude';

export interface ModelRoutingDecision {
  model: ClaudeModel;
  reason: string;
  estimatedCostPerRequest: number;
  expectedResponseTime: 'subsecond' | 'fast' | 'moderate';
}

export class IntelligentModelRouter {
  /**
   * Route request to optimal Claude model based on request type
   */
  static routeRequest(requestType: RequestType): ModelRoutingDecision {
    // UI/UX and personalization → Haiku 4.5 (fast + cheap)
    if (this.isPersonalizationRequest(requestType)) {
      return {
        model: ClaudeModel.HAIKU_4_5,
        reason: 'Fast pattern recognition and UI intelligence - Haiku 4.5 optimized for speed',
        estimatedCostPerRequest: 0.0001, // ~$0.0001 per request
        expectedResponseTime: 'subsecond'
      };
    }

    // Revenue-critical operations → Sonnet 4.5 (accuracy matters)
    if (this.isRevenueCriticalRequest(requestType)) {
      return {
        model: ClaudeModel.SONNET_4_5,
        reason: 'Accuracy-critical billing/revenue - Sonnet 4.5 for maximum precision',
        estimatedCostPerRequest: 0.005, // ~$0.005 per request
        expectedResponseTime: 'fast'
      };
    }

    // Clinical/FHIR analysis → Sonnet 4.5 (medical accuracy important)
    if (this.isClinicalRequest(requestType)) {
      return {
        model: ClaudeModel.SONNET_4_5,
        reason: 'Clinical decision support requires high accuracy - Sonnet 4.5',
        estimatedCostPerRequest: 0.005,
        expectedResponseTime: 'fast'
      };
    }

    // Default: Haiku 4.5 for general use
    return {
      model: ClaudeModel.HAIKU_4_5,
      reason: 'General purpose request - Haiku 4.5 for speed and cost efficiency',
      estimatedCostPerRequest: 0.0001,
      expectedResponseTime: 'subsecond'
    };
  }

  /**
   * Check if request is personalization/UI related (use Haiku 4.5)
   */
  private static isPersonalizationRequest(requestType: RequestType): boolean {
    return [
      RequestType.UI_PERSONALIZATION,
      RequestType.USAGE_PATTERN_ANALYSIS,
      RequestType.DASHBOARD_PREDICTION,
      RequestType.ANALYTICS, // General analytics (not revenue)
    ].includes(requestType);
  }

  /**
   * Check if request is revenue-critical (use Sonnet 4.5)
   */
  private static isRevenueCriticalRequest(requestType: RequestType): boolean {
    return [
      RequestType.MEDICAL_BILLING,
      RequestType.REVENUE_OPTIMIZATION,
      RequestType.CLAIMS_PROCESSING,
      RequestType.CPT_ICD_CODING,
    ].includes(requestType);
  }

  /**
   * Check if request is clinical/medical (use Sonnet 4.5)
   */
  private static isClinicalRequest(requestType: RequestType): boolean {
    return [
      RequestType.FHIR_ANALYSIS,
      RequestType.RISK_ASSESSMENT,
      RequestType.CLINICAL_NOTES,
      RequestType.MEDICATION_GUIDANCE,
      RequestType.HEALTH_INSIGHTS,
    ].includes(requestType);
  }

  /**
   * Get cost estimate for daily usage
   */
  static estimateDailyCost(
    personalizationRequests: number,
    billingRequests: number,
    clinicalRequests: number
  ): {
    haikuCost: number;
    sonnetCost: number;
    totalCost: number;
    breakdown: string;
  } {
    const haikuCost = personalizationRequests * 0.0001;
    const sonnetCost = (billingRequests + clinicalRequests) * 0.005;
    const totalCost = haikuCost + sonnetCost;

    return {
      haikuCost,
      sonnetCost,
      totalCost,
      breakdown: `Haiku 4.5: ${personalizationRequests} requests = $${haikuCost.toFixed(4)} | Sonnet 4.5: ${billingRequests + clinicalRequests} requests = $${sonnetCost.toFixed(4)} | Total: $${totalCost.toFixed(4)}/day`
    };
  }

  /**
   * Log routing decision for monitoring
   */
  static logRoutingDecision(requestType: RequestType, decision: ModelRoutingDecision) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Model Router] ${requestType} → ${decision.model}`);
      console.log(`  Reason: ${decision.reason}`);
      console.log(`  Cost: $${decision.estimatedCostPerRequest.toFixed(4)} | Speed: ${decision.expectedResponseTime}`);
    }
  }
}

// Export convenience function
export function getOptimalModel(requestType: RequestType): ClaudeModel {
  const decision = IntelligentModelRouter.routeRequest(requestType);
  IntelligentModelRouter.logRoutingDecision(requestType, decision);
  return decision.model;
}
