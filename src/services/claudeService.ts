// Enhanced Claude AI Service for WellFit Community - Production Ready Implementation
import Anthropic from '@anthropic-ai/sdk';
import { env, validateEnvironment } from '../config/environment';
import {
  UserRole,
  ClaudeModel,
  RequestType,
  ClaudeRequestContext,
  ClaudeResponse,
  ClaudeError,
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
    public originalError?: any,
    public requestId?: string
  ) {
    super(message);
    this.name = 'ClaudeServiceError';
  }
}

export class ClaudeInitializationError extends ClaudeServiceError {
  constructor(message: string, originalError?: any) {
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
  private readonly dailyLimit: number = 50; // $50 daily limit per user
  private readonly monthlyLimit: number = 500; // $500 monthly limit per user

  private readonly modelCosts = {
    [ClaudeModel.HAIKU_3]: { input: 0.00025, output: 0.00125 },
    [ClaudeModel.SONNET_3_5]: { input: 0.003, output: 0.015 },
    [ClaudeModel.SONNET_4]: { input: 0.003, output: 0.015 }
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
      console.warn(`⚠️ Budget Alert: User ${userId} has used ${percentUsed.toFixed(1)}% of their monthly Claude budget`);
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
    console.log('✅ Daily Claude spending counters reset');
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
        console.log('🔄 Circuit breaker attempting reset...');
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
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    return !!(this.lastFailureTime &&
           (Date.now() - this.lastFailureTime.getTime()) > this.timeout);
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      console.log('✅ Circuit breaker reset - service restored');
    }
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(error: any): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      console.error('🚨 Circuit breaker opened due to repeated failures:', error);
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

// Main Claude Service Class - Production Ready
class ClaudeService {
  private static instance: ClaudeService | null = null;
  private client: Anthropic | null = null;
  private rateLimiter: RateLimiter;
  private costTracker: CostTracker;
  private circuitBreaker: CircuitBreaker;
  private isInitialized = false;
  private lastHealthCheck?: Date;
  private defaultModel: ClaudeModel = ClaudeModel.SONNET_3_5;

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
   * Initialize Claude service with comprehensive error handling
   */
  public async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Claude service...');

      // Validate environment configuration
      const envValidation = validateEnvironment();
      if (!envValidation.success) {
        throw new ClaudeInitializationError(
          `Environment validation failed: ${envValidation.message}`
        );
      }

      // Validate API key format
      if (!env.REACT_APP_ANTHROPIC_API_KEY) {
        throw new ClaudeInitializationError(
          'ANTHROPIC_API_KEY is required but not provided'
        );
      }

      if (!env.REACT_APP_ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
        throw new ClaudeInitializationError(
          'Invalid ANTHROPIC_API_KEY format. Must start with "sk-ant-"'
        );
      }

      // Initialize Anthropic client
      this.client = new Anthropic({
        apiKey: env.REACT_APP_ANTHROPIC_API_KEY,
        timeout: env.REACT_APP_CLAUDE_TIMEOUT,
        dangerouslyAllowBrowser: true, // Required for client-side usage
        maxRetries: 3
      });

      // Test the connection with a minimal request
      const healthCheckResult = await this.healthCheck();
      if (healthCheckResult !== true) {
        throw new ClaudeInitializationError(
          'Failed to connect to Claude API during health check'
        );
      }

      this.isInitialized = true;
      console.log('✅ Claude service initialized successfully');
      console.log(`📊 Default model: ${this.defaultModel}`);
      console.log(`🔒 API key valid: ${env.REACT_APP_ANTHROPIC_API_KEY.substring(0, 10)}...`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
      console.error('❌ Claude service initialization failed:', errorMessage);

      // Reset state on failure
      this.isInitialized = false;
      this.client = null;

      throw new ClaudeInitializationError(
        `Failed to initialize Claude service: ${errorMessage}`,
        error
      );
    }
  }

  /**
   * Comprehensive health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) {
        console.warn('⚠️ Health check failed: No client initialized');
        return false;
      }

      const response = await this.client.messages.create({
        model: ClaudeModel.HAIKU_3, // Use fastest model for health check
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Hello' }]
      });

      this.lastHealthCheck = new Date();
      const isHealthy = response.content.length > 0 && response.content[0]?.type === 'text';

      if (isHealthy) {
        console.log('✅ Claude health check passed');
      } else {
        console.warn('⚠️ Claude health check returned unexpected response');
      }

      return isHealthy;
    } catch (error) {
      console.error('❌ Claude health check failed:', error);
      return false;
    }
  }

  /**
   * Check if service is available for requests
   */
  private isAvailable(): boolean {
    return this.isInitialized && this.client !== null;
  }

  /**
   * Ensure service is properly initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.client) {
      throw new ClaudeServiceError(
        'Claude service not initialized. Call initialize() first.',
        'NOT_INITIALIZED',
        500
      );
    }
  }

  /**
   * Test connection method for debugging
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.isAvailable()) {
      return {
        success: false,
        message: "Claude AI client not initialized. Check API key configuration."
      };
    }

    try {
      const response = await this.client!.messages.create({
        model: this.defaultModel,
        max_tokens: 50,
        messages: [{
          role: 'user',
          content: 'Hello, please respond with "Claude AI is working properly"'
        }]
      });

      const content = response.content[0]?.type === 'text' ? response.content[0].text : '';

      return {
        success: true,
        message: `✅ Claude AI connected successfully. Response: ${content}`
      };

    } catch (error: any) {
      console.error('Claude connection test failed:', error);
      return {
        success: false,
        message: `❌ Claude AI connection failed: ${error.message || 'Unknown error'}`
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
    fhirData: any,
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
  async chatWithHealthAssistant(message: string, userContext?: any): Promise<string> {
    if (!this.isAvailable()) {
      return "I'm sorry, the AI assistant is currently unavailable. Please try again later.";
    }

    try {
      const context: ClaudeRequestContext = {
        userId: userContext?.userId || 'anonymous',
        userRole: UserRole.SENIOR_PATIENT,
        requestId: `chat-${Date.now()}`,
        timestamp: new Date(),
        requestType: RequestType.HEALTH_QUESTION
      };

      const response = await this.generateSeniorHealthGuidance(message, context);
      return response.content;

    } catch (error) {
      console.error('Claude chat error:', error);
      return "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.";
    }
  }

  async interpretHealthData(healthData: any): Promise<string> {
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

    } catch (error) {
      console.error('Claude health interpretation error:', error);
      return "I'm having trouble reading your health data right now. Please try again later.";
    }
  }

  async analyzeRiskAssessment(assessmentData: any): Promise<{
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

    } catch (error) {
      console.error('Claude risk analysis error:', error);
      return {
        suggestedRiskLevel: 'MODERATE',
        riskFactors: ['AI analysis failed'],
        recommendations: ['Manual clinical review required'],
        clinicalNotes: 'Automated analysis unavailable - please review manually'
      };
    }
  }

  async generateClinicalNotes(patientData: any, assessmentData: any): Promise<string> {
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

    } catch (error) {
      console.error('Claude clinical notes error:', error);
      return "Clinical notes generation failed. Please document assessment manually.";
    }
  }

  async generateHealthSuggestions(userProfile: any, recentActivity: any): Promise<string[]> {
    if (!this.isAvailable()) {
      return ["Keep up your daily check-ins!", "Stay hydrated throughout the day.", "Take a short walk if you feel up to it."];
    }

    try {
      const context: ClaudeRequestContext = {
        userId: userProfile?.id || 'suggestions-user',
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

    } catch (error) {
      console.error('Claude suggestions error:', error);
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
        return await this.client!.messages.create({
          model,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
          metadata: {
            user_id: context.userId
          }
        });
      });

      const responseTime = Date.now() - startTime;
      const actualCost = this.costTracker.calculateCost(
        model,
        response.usage.input_tokens,
        response.usage.output_tokens
      );

      // Record spending
      this.costTracker.recordSpending(context.userId, actualCost);

      // Log successful request
      console.log(`✅ Claude request completed: ${context.requestType} | Model: ${model} | Cost: $${actualCost.toFixed(4)} | Time: ${responseTime}ms`);

      return {
        content: response.content[0]?.type === 'text' ? response.content[0].text : '',
        model,
        tokenUsage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens
        },
        cost: actualCost,
        responseTime,
        requestId: context.requestId
      };

    } catch (error) {
      console.error('❌ Claude API request failed:', {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        model,
        userId: context.userId
      });

      throw new ClaudeServiceError(
        'Failed to generate response from Claude API',
        'API_REQUEST_FAILED',
        500,
        error,
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

  private createFHIRAnalysisPrompt(fhirData: any, analysisType: string): string {
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

  private convertLegacyHealthData(healthData: any): HealthDataContext | undefined {
    if (!healthData) return undefined;

    return {
      patientId: 'legacy-patient',
      demographics: {
        age: 75,
        gender: 'unknown'
      },
      currentConditions: [],
      medications: [],
      recentVitals: {
        bloodPressure: healthData.bp_systolic && healthData.bp_diastolic ?
          `${healthData.bp_systolic}/${healthData.bp_diastolic}` : undefined,
        heartRate: healthData.heart_rate,
        weight: healthData.weight,
        bloodSugar: healthData.blood_sugar || healthData.glucose_mg_dl,
        lastUpdated: new Date().toISOString()
      }
    };
  }

  private formatUserContextForClaude(userProfile: any, recentActivity: any): string {
    const parts = [];

    if (userProfile?.age || userProfile?.dob) {
      const age = userProfile.age || (userProfile.dob ? new Date().getFullYear() - new Date(userProfile.dob).getFullYear() : null);
      if (age) parts.push(`Age: ${age}`);
    }

    if (recentActivity?.checkInCount) {
      parts.push(`Recent check-ins: ${recentActivity.checkInCount}`);
    }

    if (recentActivity?.lastActivity) {
      parts.push(`Last activity: ${recentActivity.lastActivity}`);
    }

    if (recentActivity?.mood) {
      parts.push(`Recent mood: ${recentActivity.mood}`);
    }

    return parts.length > 0 ? parts.join(', ') : 'Limited user information available';
  }

  private formatAssessmentForClaude(assessmentData: any): string {
    const parts = [];

    if (assessmentData.walking_ability) parts.push(`Walking: ${assessmentData.walking_ability}`);
    if (assessmentData.stair_climbing) parts.push(`Stairs: ${assessmentData.stair_climbing}`);
    if (assessmentData.sitting_ability) parts.push(`Sitting: ${assessmentData.sitting_ability}`);
    if (assessmentData.standing_ability) parts.push(`Standing: ${assessmentData.standing_ability}`);
    if (assessmentData.toilet_transfer) parts.push(`Toilet transfer: ${assessmentData.toilet_transfer}`);
    if (assessmentData.bathing_ability) parts.push(`Bathing: ${assessmentData.bathing_ability}`);
    if (assessmentData.meal_preparation) parts.push(`Meals: ${assessmentData.meal_preparation}`);
    if (assessmentData.medication_management) parts.push(`Medications: ${assessmentData.medication_management}`);

    if (assessmentData.fall_risk_factors?.length > 0) {
      parts.push(`Fall risks: ${assessmentData.fall_risk_factors.join(', ')}`);
    }

    if (assessmentData.medical_risk_score) parts.push(`Medical risk: ${assessmentData.medical_risk_score}/10`);
    if (assessmentData.mobility_risk_score) parts.push(`Mobility risk: ${assessmentData.mobility_risk_score}/10`);
    if (assessmentData.cognitive_risk_score) parts.push(`Cognitive risk: ${assessmentData.cognitive_risk_score}/10`);
    if (assessmentData.social_risk_score) parts.push(`Social risk: ${assessmentData.social_risk_score}/10`);

    return parts.length > 0 ? parts.join('; ') : 'Limited assessment data available';
  }

  private formatClinicalContextForClaude(patientData: any, assessmentData: any): string {
    const parts = [];

    if (patientData?.first_name && patientData?.last_name) {
      parts.push(`Patient: ${patientData.first_name} ${patientData.last_name}`);
    }

    if (patientData?.age || patientData?.dob) {
      const age = patientData.age || (patientData.dob ? new Date().getFullYear() - new Date(patientData.dob).getFullYear() : null);
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
    let clinicalNotes = analysis;

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
      isHealthy: this.client !== null,
      lastHealthCheck: this.lastHealthCheck || new Date(0),
      circuitBreakerState: this.circuitBreaker.getState(),
      apiKeyValid: !!env.REACT_APP_ANTHROPIC_API_KEY,
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
    console.log('🔄 Resetting Claude service...');
    this.isInitialized = false;
    this.client = null;
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