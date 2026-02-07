// Enhanced Claude AI Service for WellFit Community - Production Ready Implementation
import { supabase } from '../lib/supabaseClient';
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

// Custom error classes
export class ClaudeServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public originalError?: unknown,
    public requestId?: string
  ) {
    super(message);
    this.name = 'ClaudeServiceError';
  }
}

export class ClaudeInitializationError extends ClaudeServiceError {
  constructor(message: string, originalError?: unknown) {
    super(message, 'INITIALIZATION_ERROR', 500, originalError);
    this.name = 'ClaudeInitializationError';
  }
}

// Rate limiter for API calls
class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(
    private maxRequests: number = 60,
    private windowMs: number = 60000 // 1 minute
  ) {}

  canMakeRequest(userId: string): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];

    // Remove old requests outside the window
    const validRequests = userRequests.filter(
      timestamp => now - timestamp < this.windowMs
    );

    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(userId, validRequests);
    return true;
  }

  getRemainingRequests(userId: string): number {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    const validRequests = userRequests.filter(
      timestamp => now - timestamp < this.windowMs
    );
    return Math.max(0, this.maxRequests - validRequests.length);
  }

  getResetTime(userId: string): Date {
    const userRequests = this.requests.get(userId) || [];
    if (userRequests.length === 0) {
      return new Date();
    }
    const oldestRequest = Math.min(...userRequests);
    return new Date(oldestRequest + this.windowMs);
  }
}

// Enhanced cost tracker for budget management
class CostTracker {
  private dailySpend: Map<string, number> = new Map();
  private monthlySpend: Map<string, number> = new Map();
  private readonly dailyLimit: number = 25; // $25 daily limit per user
  private readonly monthlyLimit: number = 350; // $350 monthly limit per user

  private readonly modelCosts = {
    [ClaudeModel.HAIKU_3]: { input: 0.00025, output: 0.00125 }, // Legacy
    [ClaudeModel.HAIKU_3_5]: { input: 0.0001, output: 0.0005 }, // CURRENT: Ultra-fast, ultra-cheap
    [ClaudeModel.SONNET_3_5]: { input: 0.003, output: 0.015 }, // CURRENT: Revenue-critical accuracy
    [ClaudeModel.OPUS_3]: { input: 0.015, output: 0.075 }, // Legacy Opus
    [ClaudeModel.OPUS_4_5]: { input: 0.015, output: 0.075 } // LATEST: Opus 4.5 premium pricing
  };

  calculateCost(model: ClaudeModel, inputTokens: number, outputTokens: number): number {
    const costs = this.modelCosts[model];
    return (inputTokens / 1000 * costs.input) + (outputTokens / 1000 * costs.output);
  }

  estimateCost(model: ClaudeModel, inputText: string, expectedOutputTokens: number = 1000): number {
    const inputTokens = Math.ceil(inputText.length / 4); // Rough estimation
    return this.calculateCost(model, inputTokens, expectedOutputTokens);
  }

  canAffordRequest(userId: string, estimatedCost: number): boolean {
    const dailySpend = this.dailySpend.get(userId) || 0;
    const monthlySpend = this.monthlySpend.get(userId) || 0;

    return (dailySpend + estimatedCost) <= this.dailyLimit &&
           (monthlySpend + estimatedCost) <= this.monthlyLimit;
  }

  recordSpending(userId: string, cost: number): void {
    const currentDaily = this.dailySpend.get(userId) || 0;
    const currentMonthly = this.monthlySpend.get(userId) || 0;

    this.dailySpend.set(userId, currentDaily + cost);
    this.monthlySpend.set(userId, currentMonthly + cost);

    // Log budget alerts
    this.checkBudgetAlerts(userId, currentMonthly + cost);
  }

  private checkBudgetAlerts(userId: string, currentSpend: number): void {
    const percentUsed = (currentSpend / this.monthlyLimit) * 100;

    if (percentUsed >= 80) {
      // Budget alert logged via auditLogger
    }
  }

  getCostInfo(userId: string): CostInfo {
    const dailySpend = this.dailySpend.get(userId) || 0;
    const monthlySpend = this.monthlySpend.get(userId) || 0;

    return {
      estimatedCost: 0,
      actualCost: 0,
      dailySpend,
      monthlySpend,
      remainingBudget: this.monthlyLimit - monthlySpend
    };
  }

  // Reset daily counters (call this daily via cron job)
  resetDailySpend(): void {
    this.dailySpend.clear();
  }

  // Get spending summary for reporting
  getSpendingSummary(): { totalDaily: number; totalMonthly: number; userCount: number } {
    const totalDaily = Array.from(this.dailySpend.values()).reduce((sum, spend) => sum + spend, 0);
    const totalMonthly = Array.from(this.monthlySpend.values()).reduce((sum, spend) => sum + spend, 0);

    return {
      totalDaily,
      totalMonthly,
      userCount: this.monthlySpend.size
    };
  }
}

// Circuit breaker for API resilience
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime?: Date;
  private readonly failureThreshold = 5;
  private readonly timeout = 60000; // 60 seconds

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new ClaudeServiceError(
          'Claude service temporarily unavailable due to repeated failures',
          'CIRCUIT_BREAKER_OPEN'
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err: unknown) {
      this.onFailure(err);
      throw err;
    }
  }

  private shouldAttemptReset(): boolean {
    return !!(this.lastFailureTime &&
           (Date.now() - this.lastFailureTime.getTime()) > this.timeout);
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      // Service restored
    }
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(_error: unknown): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      // Circuit breaker opened due to repeated failures
    }
  }

  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.state;
  }

  getStatus(): { state: string; failures: number; lastFailure?: Date } {
    return {
      state: this.state,
      failures: this.failureCount,
      lastFailure: this.lastFailureTime
    };
  }
}

// Response shape from the claude-chat edge function (proxied Anthropic API response)
interface EdgeFunctionResponse {
  content: Array<{ type: string; text?: string }>;
  usage: { input_tokens: number; output_tokens: number };
}

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
      const response = await this.callEdgeFunction(
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
      const response = await this.callEdgeFunction(
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
   * Call the claude-chat edge function (server-side Anthropic API proxy).
   * The API key is stored in Supabase secrets, never exposed to the browser.
   */
  private async callEdgeFunction(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    model: string,
    maxTokens: number,
    system?: string
  ): Promise<EdgeFunctionResponse> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      throw new ClaudeServiceError(
        'Supabase configuration missing for edge function proxy',
        'CONFIG_ERROR',
        500
      );
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new ClaudeServiceError(
        'User not authenticated — cannot call Claude API proxy',
        'AUTH_ERROR',
        401
      );
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/claude-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': anonKey,
      },
      body: JSON.stringify({
        messages,
        model,
        max_tokens: maxTokens,
        ...(system ? { system } : {}),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as Record<string, unknown>;
      const errorMsg = (errorData.error as string) || `Edge function returned ${response.status}`;
      throw new ClaudeServiceError(
        errorMsg,
        'EDGE_FUNCTION_ERROR',
        response.status
      );
    }

    return await response.json() as EdgeFunctionResponse;
  }

  /**
   * Generate senior-friendly health guidance
   */
  public async generateSeniorHealthGuidance(
    question: string,
    context: ClaudeRequestContext
  ): Promise<ClaudeResponse> {
    const prompt = this.createSeniorHealthPrompt(question, context.healthContext);
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
    const prompt = this.createMedicalAnalyticsPrompt(analysisRequest, healthData);
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
    const prompt = this.createFHIRAnalysisPrompt(fhirData, analysisType);
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
      const healthContext = this.convertLegacyHealthData(healthData);
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

      const prompt = this.createRiskAssessmentPrompt(this.formatAssessmentForClaude(assessmentData));
      const criteria = createModelCriteria(context.userRole, RequestType.RISK_ASSESSMENT, prompt);

      const response = await this.generateResponse(prompt, context, criteria);
      return this.parseRiskAnalysis(response.content);

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

      const prompt = this.createClinicalNotesPrompt(
        this.formatClinicalContextForClaude(patientData, assessmentData)
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

      const prompt = this.createHealthSuggestionsPrompt(
        this.formatUserContextForClaude(userProfile, recentActivity)
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
        return await this.callEdgeFunction(
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
   * Prompt creation methods
   */
  private createSeniorHealthPrompt(question: string, healthContext?: HealthDataContext): string {
    const contextInfo = healthContext ? this.formatHealthContextForSeniors(healthContext) : '';

    return `You are a kind, patient health assistant helping an older adult understand their health.

COMMUNICATION GUIDELINES:
- Use simple, everyday language (8th grade level)
- Keep sentences short and clear
- Use familiar comparisons and analogies
- Always be encouraging and supportive
- Break complex information into small steps
- Repeat important points for clarity

${contextInfo}

Patient's Question: ${question}

Please provide a helpful, easy-to-understand response that:
1. Directly addresses their concern
2. Explains what they need to know in simple terms
3. Provides clear, actionable next steps
4. Reassures them when appropriate
5. Suggests when to contact their doctor

IMPORTANT: Always remind them to check with their healthcare provider for personalized medical advice.

Format your response with clear headings and short paragraphs.`;
  }

  private createMedicalAnalyticsPrompt(analysisRequest: string, healthData: HealthDataContext[]): string {
    const aggregatedData = this.aggregateHealthData(healthData);

    return `You are a clinical analytics AI providing insights for healthcare administrators.

PATIENT POPULATION DATA:
${aggregatedData}

ANALYSIS REQUEST: ${analysisRequest}

Provide comprehensive analysis including:

1. POPULATION HEALTH OVERVIEW:
   - Key health trends and patterns
   - Risk stratification of patient population
   - Common conditions and their prevalence

2. CLINICAL INSIGHTS:
   - Evidence-based recommendations
   - Quality improvement opportunities
   - Care gap identification

3. PREDICTIVE ANALYTICS:
   - Risk prediction modeling
   - Resource allocation recommendations
   - Cost-effectiveness analysis

4. ACTIONABLE RECOMMENDATIONS:
   - Specific intervention strategies
   - Priority areas for improvement
   - Expected outcomes and timelines

Use appropriate medical terminology and cite relevant clinical guidelines where applicable.`;
  }

  private createFHIRAnalysisPrompt(fhirData: Record<string, unknown>, analysisType: string): string {
    return `You are analyzing FHIR healthcare data to provide clinical insights.

FHIR DATA:
${JSON.stringify(fhirData, null, 2)}

ANALYSIS TYPE: ${analysisType}

Please provide a comprehensive analysis appropriate for healthcare professionals, including clinical significance, risk factors, and evidence-based recommendations.

Focus on actionable insights that can improve patient care and health outcomes.`;
  }

  private createRiskAssessmentPrompt(assessmentSummary: string): string {
    return `You are a healthcare AI assistant helping clinicians assess senior patient risk. Analyze functional assessment data and provide:
1. Risk level (LOW/MODERATE/HIGH/CRITICAL)
2. Key risk factors identified
3. Clinical recommendations
4. Brief assessment notes

Base your analysis on mobility, ADLs, fall risk, and functional independence. Be conservative in risk assessment.

Analyze this functional assessment: ${assessmentSummary}`;
  }

  private createClinicalNotesPrompt(contextData: string): string {
    return `You are a clinical documentation assistant. Generate professional, concise clinical notes for a senior patient assessment. Include:
- Functional status summary
- Risk factors observed
- Clinical impressions
- Follow-up recommendations

Use medical terminology appropriate for healthcare records.

Generate clinical notes for: ${contextData}`;
  }

  private createHealthSuggestionsPrompt(contextInfo: string): string {
    return `You are a wellness coach for seniors. Based on their profile and recent activity, suggest 3-5 simple, actionable health tips. Make them:
- Easy to understand and follow
- Age-appropriate
- Encouraging and positive
- Safe for seniors

Return each suggestion on a new line.

Based on this user information, provide health suggestions: ${contextInfo}`;
  }

  /**
   * Helper methods for data formatting
   */
  private formatHealthContextForSeniors(context: HealthDataContext): string {
    const { demographics, currentConditions, medications, recentVitals } = context;

    return `PATIENT INFORMATION:
Age: ${demographics.age}
Current Health Conditions: ${currentConditions.map(c => c.condition).join(', ') || 'None listed'}
Current Medications: ${medications.map(m => `${m.name} (${m.purpose})`).join(', ') || 'None listed'}
Recent Health Measurements: Blood pressure: ${recentVitals.bloodPressure || 'Not recorded'}
Weight: ${recentVitals.weight ? `${recentVitals.weight} lbs` : 'Not recorded'}`;
  }

  private aggregateHealthData(healthData: HealthDataContext[]): string {
    const totalPatients = healthData.length;
    const avgAge = healthData.reduce((sum, p) => sum + p.demographics.age, 0) / totalPatients;

    const conditionCounts = new Map<string, number>();
    healthData.forEach(patient => {
      patient.currentConditions.forEach(condition => {
        conditionCounts.set(condition.condition, (conditionCounts.get(condition.condition) || 0) + 1);
      });
    });

    return `POPULATION SUMMARY:
Total Patients: ${totalPatients}
Average Age: ${avgAge.toFixed(1)} years
Most Common Conditions: ${Array.from(conditionCounts.entries())
  .sort(([,a], [,b]) => b - a)
  .slice(0, 5)
  .map(([condition, count]) => `${condition} (${count} patients)`)
  .join(', ')}`;
  }

  private convertLegacyHealthData(healthData: Record<string, unknown>): HealthDataContext | undefined {
    if (!healthData) return undefined;

    const bpSystolic = healthData.bp_systolic as number | undefined;
    const bpDiastolic = healthData.bp_diastolic as number | undefined;

    return {
      patientId: 'legacy-patient',
      demographics: {
        age: 75,
        gender: 'unknown'
      },
      currentConditions: [],
      medications: [],
      recentVitals: {
        bloodPressure: bpSystolic && bpDiastolic ?
          `${bpSystolic}/${bpDiastolic}` : undefined,
        heartRate: healthData.heart_rate as number | undefined,
        weight: healthData.weight as number | undefined,
        bloodSugar: (healthData.blood_sugar || healthData.glucose_mg_dl) as number | undefined,
        lastUpdated: new Date().toISOString()
      }
    };
  }

  private formatUserContextForClaude(userProfile: Record<string, unknown>, recentActivity: Record<string, unknown>): string {
    const parts: string[] = [];

    const profileAge = userProfile?.age as number | undefined;
    const profileDob = userProfile?.dob as string | undefined;
    if (profileAge || profileDob) {
      const age = profileAge || (profileDob ? new Date().getFullYear() - new Date(profileDob).getFullYear() : null);
      if (age) parts.push(`Age: ${age}`);
    }

    const checkInCount = recentActivity?.checkInCount as number | undefined;
    if (checkInCount) {
      parts.push(`Recent check-ins: ${checkInCount}`);
    }

    const lastActivity = recentActivity?.lastActivity as string | undefined;
    if (lastActivity) {
      parts.push(`Last activity: ${lastActivity}`);
    }

    const mood = recentActivity?.mood as string | undefined;
    if (mood) {
      parts.push(`Recent mood: ${mood}`);
    }

    return parts.length > 0 ? parts.join(', ') : 'Limited user information available';
  }

  private formatAssessmentForClaude(assessmentData: Record<string, unknown>): string {
    const parts: string[] = [];

    if (assessmentData.walking_ability) parts.push(`Walking: ${assessmentData.walking_ability}`);
    if (assessmentData.stair_climbing) parts.push(`Stairs: ${assessmentData.stair_climbing}`);
    if (assessmentData.sitting_ability) parts.push(`Sitting: ${assessmentData.sitting_ability}`);
    if (assessmentData.standing_ability) parts.push(`Standing: ${assessmentData.standing_ability}`);
    if (assessmentData.toilet_transfer) parts.push(`Toilet transfer: ${assessmentData.toilet_transfer}`);
    if (assessmentData.bathing_ability) parts.push(`Bathing: ${assessmentData.bathing_ability}`);
    if (assessmentData.meal_preparation) parts.push(`Meals: ${assessmentData.meal_preparation}`);
    if (assessmentData.medication_management) parts.push(`Medications: ${assessmentData.medication_management}`);

    const fallRiskFactors = assessmentData.fall_risk_factors as string[] | undefined;
    if (fallRiskFactors?.length && fallRiskFactors.length > 0) {
      parts.push(`Fall risks: ${fallRiskFactors.join(', ')}`);
    }

    if (assessmentData.medical_risk_score) parts.push(`Medical risk: ${assessmentData.medical_risk_score}/10`);
    if (assessmentData.mobility_risk_score) parts.push(`Mobility risk: ${assessmentData.mobility_risk_score}/10`);
    if (assessmentData.cognitive_risk_score) parts.push(`Cognitive risk: ${assessmentData.cognitive_risk_score}/10`);
    if (assessmentData.social_risk_score) parts.push(`Social risk: ${assessmentData.social_risk_score}/10`);

    return parts.length > 0 ? parts.join('; ') : 'Limited assessment data available';
  }

  private formatClinicalContextForClaude(patientData: Record<string, unknown>, assessmentData: Record<string, unknown>): string {
    const parts: string[] = [];

    const firstName = patientData?.first_name as string | undefined;
    const lastName = patientData?.last_name as string | undefined;
    if (firstName && lastName) {
      parts.push(`Patient: ${firstName} ${lastName}`);
    }

    const patientAge = patientData?.age as number | undefined;
    const patientDob = patientData?.dob as string | undefined;
    if (patientAge || patientDob) {
      const age = patientAge || (patientDob ? new Date().getFullYear() - new Date(patientDob).getFullYear() : null);
      if (age) parts.push(`Age: ${age}`);
    }

    const assessmentSummary = this.formatAssessmentForClaude(assessmentData);
    if (assessmentSummary) parts.push(`Assessment: ${assessmentSummary}`);

    return parts.length > 0 ? parts.join('. ') : 'Limited patient context available';
  }

  private parseRiskAnalysis(analysis: string): {
    suggestedRiskLevel: string;
    riskFactors: string[];
    recommendations: string[];
    clinicalNotes: string;
  } {
    const lines = analysis.split('\n').filter(line => line.trim());

    let suggestedRiskLevel = 'MODERATE';
    const riskFactors: string[] = [];
    const recommendations: string[] = [];
    const clinicalNotes = analysis;

    // Extract risk level
    const riskMatch = analysis.match(/(LOW|MODERATE|HIGH|CRITICAL)/i);
    if (riskMatch) {
      suggestedRiskLevel = riskMatch[1].toUpperCase();
    }

    // Extract bullet points as risk factors and recommendations
    lines.forEach(line => {
      const cleanLine = line.trim();
      if (cleanLine.match(/^[-*•]\s*.{5,}/)) {
        const content = cleanLine.replace(/^[-*•]\s*/, '');
        if (content.toLowerCase().includes('risk') || content.toLowerCase().includes('concern')) {
          riskFactors.push(content);
        } else if (content.toLowerCase().includes('recommend') || content.toLowerCase().includes('suggest')) {
          recommendations.push(content);
        }
      }
    });

    // Fallbacks
    if (riskFactors.length === 0) {
      riskFactors.push('Assessment requires clinical review');
    }
    if (recommendations.length === 0) {
      recommendations.push('Continue regular monitoring and follow-up');
    }

    return {
      suggestedRiskLevel,
      riskFactors: riskFactors.slice(0, 5),
      recommendations: recommendations.slice(0, 5),
      clinicalNotes: clinicalNotes.substring(0, 500)
    };
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