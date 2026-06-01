// Enhanced Claude AI Service for WellFit Community - Production Ready Implementation
//
// Decomposed 2026-06-01 (CLAUDE.md Commandment #12, 600-line limit). Cohesive
// concerns now live under ./claude/*:
//   - errors.ts        ClaudeServiceError / ClaudeInitializationError
//   - rateLimiter.ts   per-user sliding-window RateLimiter
//   - costTracker.ts   budget enforcement + cost estimation
//   - circuitBreaker.ts API-resilience circuit breaker
//   - transport.ts     callEdgeFunction (claude-chat proxy) + EdgeFunctionResponse
//   - prompts.ts       prompt builders
//   - formatters.ts    prompt-context formatters + risk-analysis parser
// This file keeps the ClaudeService singleton + its public API unchanged; the
// error classes and Claude types are re-exported below so import paths are stable.
import { auditLogger } from './auditLogger';
import { validateEnvironment } from '../config/environment';
import {
  UserRole,
  ClaudeModel,
  RequestType,
  ClaudeRequestContext,
  ClaudeResponse,
  HealthDataContext,
  ServiceStatus,
  CostInfo
} from '../types/claude';
import { modelSelector, createModelCriteria } from '../utils/claudeModelSelection';
import { ClaudeServiceError, ClaudeInitializationError } from './claude/errors';
import { RateLimiter } from './claude/rateLimiter';
import { CostTracker } from './claude/costTracker';
import { CircuitBreaker } from './claude/circuitBreaker';
import { callEdgeFunction } from './claude/transport';
import {
  createSeniorHealthPrompt,
  createMedicalAnalyticsPrompt,
  createFHIRAnalysisPrompt,
  createRiskAssessmentPrompt,
  createClinicalNotesPrompt,
  createHealthSuggestionsPrompt,
} from './claude/prompts';
import {
  convertLegacyHealthData,
  formatAssessmentForClaude,
  formatClinicalContextForClaude,
  formatUserContextForClaude,
  parseRiskAnalysis,
} from './claude/formatters';

// Re-export error classes (public surface preserved)
export { ClaudeServiceError, ClaudeInitializationError } from './claude/errors';

// Main Claude Service Class - Production Ready
class ClaudeService {
  private static instance: ClaudeService | null = null;
  private rateLimiter: RateLimiter;
  private costTracker: CostTracker;
  private circuitBreaker: CircuitBreaker;
  private isInitialized = false;
  private lastHealthCheck?: Date;
  private defaultModel: ClaudeModel = ClaudeModel.SONNET_3_5; // Using latest model

  private constructor() {
    this.rateLimiter = new RateLimiter();
    this.costTracker = new CostTracker();
    this.circuitBreaker = new CircuitBreaker();
  }

  public static getInstance(): ClaudeService {
    if (!ClaudeService.instance) {
      ClaudeService.instance = new ClaudeService();
    }
    return ClaudeService.instance;
  }

  /**
   * Initialize Claude service — verifies edge function proxy is configured.
   * All Claude API calls route through the claude-chat edge function (server-side).
   * The Anthropic API key is stored in Supabase secrets, never in the browser.
   */
  public async initialize(): Promise<void> {
    try {
      // Validate environment configuration
      const envValidation = validateEnvironment();
      if (!envValidation.success) {
        throw new ClaudeInitializationError(
          `Environment validation failed: ${envValidation.message}`
        );
      }

      // Verify Supabase URL is configured for edge function calls
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        // No Supabase URL — service degrades gracefully
        return;
      }

      this.isInitialized = true;

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown initialization error';
      auditLogger.error('Failed to initialize Claude service', errorMessage);

      this.isInitialized = false;

      throw new ClaudeInitializationError(
        `Failed to initialize Claude service: ${errorMessage}`,
        err
      );
    }
  }

  /**
   * Health check — sends a minimal request through the edge function proxy
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const response = await callEdgeFunction(
        [{ role: 'user', content: 'Hello' }],
        ClaudeModel.HAIKU_3_5,
        50
      );

      this.lastHealthCheck = new Date();
      return response.content.length > 0 && response.content[0]?.type === 'text';
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Health check failed';
      auditLogger.error('Claude health check failed', errorMessage);
      return false;
    }
  }

  /**
   * Check if service is available for requests
   */
  private isAvailable(): boolean {
    return this.isInitialized;
  }

  /**
   * Ensure service is properly initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new ClaudeServiceError(
        'Claude service not initialized. Call initialize() first.',
        'NOT_INITIALIZED',
        500
      );
    }
  }

  /**
   * Test connection method for debugging — routes through edge function proxy
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.isAvailable()) {
      return {
        success: false,
        message: "Claude AI service not initialized. Check Supabase configuration."
      };
    }

    try {
      const response = await callEdgeFunction(
        [{ role: 'user', content: 'Hello, please respond with "Claude AI is working properly"' }],
        this.defaultModel,
        50
      );

      const content = response.content[0]?.type === 'text' ? response.content[0].text : '';

      return {
        success: true,
        message: `Claude AI connected via edge function. Response: ${content}`
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: `Claude AI connection failed: ${errorMessage}`
      };
    }
  }

  /**
   * Generate senior-friendly health guidance
   */
  public async generateSeniorHealthGuidance(
    question: string,
    context: ClaudeRequestContext
  ): Promise<ClaudeResponse> {
    const prompt = createSeniorHealthPrompt(question, context.healthContext);
    const criteria = createModelCriteria(context.userRole, RequestType.HEALTH_QUESTION, question);

    return this.generateResponse(prompt, {
      ...context,
      requestType: RequestType.HEALTH_QUESTION
    }, criteria);
  }

  /**
   * Generate advanced medical analytics for admin users
   */
  public async generateMedicalAnalytics(
    analysisRequest: string,
    healthData: HealthDataContext[],
    context: ClaudeRequestContext
  ): Promise<ClaudeResponse> {
    const prompt = createMedicalAnalyticsPrompt(analysisRequest, healthData);
    const criteria = createModelCriteria(context.userRole, RequestType.ANALYTICS, analysisRequest);

    return this.generateResponse(prompt, {
      ...context,
      requestType: RequestType.ANALYTICS
    }, criteria);
  }

  /**
   * Generate FHIR data insights
   */
  public async analyzeFHIRData(
    fhirData: Record<string, unknown>,
    analysisType: 'summary' | 'risk_assessment' | 'care_gaps',
    context: ClaudeRequestContext
  ): Promise<ClaudeResponse> {
    const prompt = createFHIRAnalysisPrompt(fhirData, analysisType);
    const criteria = createModelCriteria(context.userRole, RequestType.FHIR_ANALYSIS, JSON.stringify(fhirData));

    return this.generateResponse(prompt, {
      ...context,
      requestType: RequestType.FHIR_ANALYSIS
    }, criteria);
  }

  /**
   * Legacy methods for backward compatibility
   */
  async chatWithHealthAssistant(message: string, userContext?: Record<string, unknown>): Promise<string> {
    if (!this.isAvailable()) {
      return "I'm sorry, the AI assistant is currently unavailable. Please try again later.";
    }

    try {
      const userId = (userContext?.userId as string | undefined) || 'anonymous';
      const context: ClaudeRequestContext = {
        userId,
        userRole: UserRole.SENIOR_PATIENT,
        requestId: `chat-${Date.now()}`,
        timestamp: new Date(),
        requestType: RequestType.HEALTH_QUESTION
      };

      const response = await this.generateSeniorHealthGuidance(message, context);
      return response.content;

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Chat request failed';
      auditLogger.error('Chat with health assistant failed', errorMessage);
      return "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.";
    }
  }

  async interpretHealthData(healthData: Record<string, unknown>): Promise<string> {
    if (!this.isAvailable()) {
      return "Health data interpretation is currently unavailable.";
    }

    try {
      const healthContext = convertLegacyHealthData(healthData);
      const context: ClaudeRequestContext = {
        userId: 'health-data-user',
        userRole: UserRole.SENIOR_PATIENT,
        requestId: `health-data-${Date.now()}`,
        timestamp: new Date(),
        requestType: RequestType.HEALTH_INSIGHTS,
        healthContext
      };

      const response = await this.generateSeniorHealthGuidance(
        "Please explain my recent health measurements in simple terms",
        context
      );

      return response.content;

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Health data interpretation failed';
      auditLogger.error('Failed to interpret health data', errorMessage);
      return "I'm having trouble reading your health data right now. Please try again later.";
    }
  }

  async analyzeRiskAssessment(assessmentData: Record<string, unknown>): Promise<{
    suggestedRiskLevel: string;
    riskFactors: string[];
    recommendations: string[];
    clinicalNotes: string;
  }> {
    if (!this.isAvailable()) {
      return {
        suggestedRiskLevel: 'MODERATE',
        riskFactors: ['Assessment needs manual review'],
        recommendations: ['Manual clinical evaluation required'],
        clinicalNotes: 'AI analysis unavailable - please conduct manual assessment'
      };
    }

    try {
      const context: ClaudeRequestContext = {
        userId: 'risk-assessment-user',
        userRole: UserRole.ADMIN,
        requestId: `risk-${Date.now()}`,
        timestamp: new Date(),
        requestType: RequestType.RISK_ASSESSMENT
      };

      const prompt = createRiskAssessmentPrompt(formatAssessmentForClaude(assessmentData));
      const criteria = createModelCriteria(context.userRole, RequestType.RISK_ASSESSMENT, prompt);

      const response = await this.generateResponse(prompt, context, criteria);
      return parseRiskAnalysis(response.content);

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Risk assessment analysis failed';
      auditLogger.error('Failed to analyze risk assessment', errorMessage);
      return {
        suggestedRiskLevel: 'MODERATE',
        riskFactors: ['AI analysis failed'],
        recommendations: ['Manual clinical review required'],
        clinicalNotes: 'Automated analysis unavailable - please review manually'
      };
    }
  }

  async generateClinicalNotes(patientData: Record<string, unknown>, assessmentData: Record<string, unknown>): Promise<string> {
    if (!this.isAvailable()) {
      return "Clinical notes generation unavailable. Please document findings manually.";
    }

    try {
      const context: ClaudeRequestContext = {
        userId: 'clinical-notes-user',
        userRole: UserRole.ADMIN,
        requestId: `clinical-${Date.now()}`,
        timestamp: new Date(),
        requestType: RequestType.CLINICAL_NOTES
      };

      const prompt = createClinicalNotesPrompt(
        formatClinicalContextForClaude(patientData, assessmentData)
      );
      const criteria = createModelCriteria(context.userRole, RequestType.CLINICAL_NOTES, prompt);

      const response = await this.generateResponse(prompt, context, criteria);
      return response.content;

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Clinical notes generation failed';
      auditLogger.error('Failed to generate clinical notes', errorMessage);
      return "Clinical notes generation failed. Please document assessment manually.";
    }
  }

  async generateHealthSuggestions(userProfile: Record<string, unknown>, recentActivity: Record<string, unknown>): Promise<string[]> {
    if (!this.isAvailable()) {
      return ["Keep up your daily check-ins!", "Stay hydrated throughout the day.", "Take a short walk if you feel up to it."];
    }

    try {
      const profileId = userProfile?.id as string | undefined;
      const context: ClaudeRequestContext = {
        userId: profileId || 'suggestions-user',
        userRole: UserRole.SENIOR_PATIENT,
        requestId: `suggestions-${Date.now()}`,
        timestamp: new Date(),
        requestType: RequestType.HEALTH_INSIGHTS
      };

      const prompt = createHealthSuggestionsPrompt(
        formatUserContextForClaude(userProfile, recentActivity)
      );
      const criteria = createModelCriteria(context.userRole, RequestType.HEALTH_INSIGHTS, prompt);

      const response = await this.generateResponse(prompt, context, criteria);
      const suggestions = response.content.split('\n').filter(line => line.trim()).slice(0, 5);

      return suggestions.length > 0 ? suggestions :
        ["Keep up your daily check-ins!", "Stay hydrated throughout the day."];

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Health suggestions generation failed';
      auditLogger.error('Failed to generate health suggestions', errorMessage);
      return ["Keep up your daily check-ins!", "Stay hydrated throughout the day.", "Take a short walk if you feel up to it."];
    }
  }

  /**
   * Main response generation method with comprehensive error handling
   */
  private async generateResponse(
    prompt: string,
    context: ClaudeRequestContext,
    criteria: { userRole: UserRole; requestType: RequestType; complexity: 'simple' | 'moderate' | 'complex' }
  ): Promise<ClaudeResponse> {
    this.ensureInitialized();

    // Rate limiting check
    if (!this.rateLimiter.canMakeRequest(context.userId)) {
      const resetTime = this.rateLimiter.getResetTime(context.userId);
      throw new ClaudeServiceError(
        `Rate limit exceeded. Please try again after ${resetTime.toLocaleTimeString()}.`,
        'RATE_LIMIT_EXCEEDED',
        429,
        undefined,
        context.requestId
      );
    }

    // Select appropriate model
    const model = modelSelector.selectModel({
      ...criteria,
      budgetTier: 'standard'
    });

    const maxTokens = criteria.complexity === 'simple' ? 1000 :
                     criteria.complexity === 'moderate' ? 2000 : 4000;

    // Cost estimation and budget check
    const estimatedCost = this.costTracker.estimateCost(model, prompt, maxTokens);

    if (!this.costTracker.canAffordRequest(context.userId, estimatedCost)) {
      const costInfo = this.costTracker.getCostInfo(context.userId);
      throw new ClaudeServiceError(
        `Budget limit reached. Monthly spend: $${costInfo.monthlySpend.toFixed(2)}/$${(costInfo.monthlySpend + costInfo.remainingBudget).toFixed(2)}`,
        'BUDGET_EXCEEDED',
        402,
        undefined,
        context.requestId
      );
    }

    const startTime = Date.now();

    try {
      const response = await this.circuitBreaker.execute(async () => {
        return await callEdgeFunction(
          [{ role: 'user', content: prompt }],
          model,
          maxTokens
        );
      });

      const responseTime = Date.now() - startTime;
      const actualCost = this.costTracker.calculateCost(
        model,
        response.usage.input_tokens,
        response.usage.output_tokens
      );

      // Record spending
      this.costTracker.recordSpending(context.userId, actualCost);

      // Request completion logged via auditLogger

      const responseContent = response.content[0]?.type === 'text' ? response.content[0].text : '';

      return {
        content: responseContent || '',
        model,
        tokenUsage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens
        },
        cost: actualCost,
        responseTime,
        requestId: context.requestId
      };

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'API request failed';
      auditLogger.error('Failed to generate Claude API response', errorMessage, { requestId: context.requestId });
      throw new ClaudeServiceError(
        'Failed to generate response from Claude API',
        'API_REQUEST_FAILED',
        500,
        err,
        context.requestId
      );
    }
  }

  /**
   * Service status and monitoring methods
   */
  public getServiceStatus(): ServiceStatus {
    return {
      isInitialized: this.isInitialized,
      isHealthy: this.isInitialized,
      lastHealthCheck: this.lastHealthCheck || new Date(0),
      circuitBreakerState: this.circuitBreaker.getState(),
      apiKeyValid: !!import.meta.env.VITE_SUPABASE_URL,
      modelsAvailable: Object.values(ClaudeModel)
    };
  }

  public getCostInfo(userId: string): CostInfo {
    return this.costTracker.getCostInfo(userId);
  }

  public getRateLimitInfo(userId: string): {
    remaining: number;
    resetTime: Date;
    limit: number;
  } {
    return {
      remaining: this.rateLimiter.getRemainingRequests(userId),
      resetTime: this.rateLimiter.getResetTime(userId),
      limit: 60 // maxRequests
    };
  }

  public getCircuitBreakerStatus(): { state: string; failures: number; lastFailure?: Date } {
    return this.circuitBreaker.getStatus();
  }

  public getSpendingSummary(): { totalDaily: number; totalMonthly: number; userCount: number } {
    return this.costTracker.getSpendingSummary();
  }

  /**
   * Administrative methods
   */
  public async resetService(): Promise<void> {
    this.isInitialized = false;
    this.lastHealthCheck = undefined;
    await this.initialize();
  }

  public resetDailySpending(): void {
    this.costTracker.resetDailySpend();
  }
}

// Export singleton instance and types
export const claudeService = ClaudeService.getInstance();
export default claudeService;

// Export types for use in other components
export {
  UserRole,
  ClaudeModel,
  RequestType,
  type ClaudeRequestContext,
  type ClaudeResponse,
  type HealthDataContext,
  type ServiceStatus,
  type CostInfo
} from '../types/claude';
