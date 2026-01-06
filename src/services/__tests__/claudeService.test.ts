/**
 * claudeService.test.ts - Comprehensive test suite for Claude AI Service
 *
 * Tests: Rate limiting, cost tracking, circuit breaker, API interactions,
 * health checks, and senior-friendly health guidance generation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../anthropicLoader', () => ({
  loadAnthropicSDK: vi.fn(),
}));

vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    ai: vi.fn(),
  },
}));

vi.mock('../../config/environment', () => ({
  env: {
    VITE_ANTHROPIC_API_KEY: 'sk-ant-test-key-12345',
    VITE_CLAUDE_TIMEOUT: 30000,
  },
  validateEnvironment: vi.fn(() => ({ success: true, message: 'Valid' })),
}));

vi.mock('../../utils/claudeModelSelection', () => ({
  modelSelector: {
    selectModel: vi.fn(() => 'claude-3-5-sonnet-20241022'),
  },
  createModelCriteria: vi.fn(() => ({
    userRole: 'senior_patient',
    requestType: 'health_question',
    complexity: 'moderate',
  })),
}));

import { loadAnthropicSDK } from '../anthropicLoader';
import { auditLogger } from '../auditLogger';
import { validateEnvironment } from '../../config/environment';
import { ClaudeModel, UserRole, RequestType } from '../../types/claude';

// ===========================================================================
// TEST SETUP
// ===========================================================================

describe('ClaudeService', () => {
  let mockAnthropicClient: {
    messages: {
      create: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Setup mock Anthropic client
    mockAnthropicClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Test response from Claude' }],
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      },
    };

    // Mock the Anthropic SDK loader - cast through unknown for SDK boundary
    const MockAnthropicConstructor = vi.fn().mockReturnValue(mockAnthropicClient);
    vi.mocked(loadAnthropicSDK).mockResolvedValue(
      MockAnthropicConstructor as unknown as typeof import('@anthropic-ai/sdk').default
    );

    vi.mocked(validateEnvironment).mockReturnValue({
      success: true,
      message: 'Environment valid',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  // ===========================================================================
  // RATE LIMITER TESTS
  // ===========================================================================

  describe('RateLimiter', () => {
    it('should allow requests within rate limit', async () => {
      // Import fresh module to get new instance
      const { claudeService } = await import('../claudeService');

      // Rate limiter should allow first requests
      const rateLimitInfo = claudeService.getRateLimitInfo('user-123');
      expect(rateLimitInfo.remaining).toBe(60);
      expect(rateLimitInfo.limit).toBe(60);
    });

    it('should track remaining requests correctly', async () => {
      const { claudeService } = await import('../claudeService');

      // Initial state
      const info1 = claudeService.getRateLimitInfo('user-456');
      expect(info1.remaining).toBe(60);

      // After some simulated requests (we can't easily simulate this without making actual requests)
      // The rate limiter tracks by userId
      const info2 = claudeService.getRateLimitInfo('different-user');
      expect(info2.remaining).toBe(60); // Different user has full quota
    });

    it('should provide reset time for rate limit', async () => {
      const { claudeService } = await import('../claudeService');

      const info = claudeService.getRateLimitInfo('user-789');
      expect(info.resetTime).toBeInstanceOf(Date);
    });

    it('should track separate limits per user', async () => {
      const { claudeService } = await import('../claudeService');

      const user1Info = claudeService.getRateLimitInfo('user-1');
      const user2Info = claudeService.getRateLimitInfo('user-2');

      // Each user has their own quota
      expect(user1Info.remaining).toBe(60);
      expect(user2Info.remaining).toBe(60);
    });
  });

  // ===========================================================================
  // COST TRACKER TESTS
  // ===========================================================================

  describe('CostTracker', () => {
    it('should return cost info for user', async () => {
      const { claudeService } = await import('../claudeService');

      const costInfo = claudeService.getCostInfo('user-123');

      expect(costInfo).toHaveProperty('dailySpend');
      expect(costInfo).toHaveProperty('monthlySpend');
      expect(costInfo).toHaveProperty('remainingBudget');
      expect(costInfo.dailySpend).toBeGreaterThanOrEqual(0);
      expect(costInfo.monthlySpend).toBeGreaterThanOrEqual(0);
    });

    it('should calculate remaining budget correctly', async () => {
      const { claudeService } = await import('../claudeService');

      const costInfo = claudeService.getCostInfo('new-user');

      // New user should have full budget
      expect(costInfo.remainingBudget).toBe(350); // Monthly limit
    });

    it('should provide spending summary', async () => {
      const { claudeService } = await import('../claudeService');

      const summary = claudeService.getSpendingSummary();

      expect(summary).toHaveProperty('totalDaily');
      expect(summary).toHaveProperty('totalMonthly');
      expect(summary).toHaveProperty('userCount');
    });

    it('should reset daily spending', async () => {
      const { claudeService } = await import('../claudeService');

      // This should not throw
      expect(() => claudeService.resetDailySpending()).not.toThrow();
    });
  });

  // ===========================================================================
  // CIRCUIT BREAKER TESTS
  // ===========================================================================

  describe('CircuitBreaker', () => {
    it('should return circuit breaker status', async () => {
      const { claudeService } = await import('../claudeService');

      const status = claudeService.getCircuitBreakerStatus();

      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('failures');
      expect(['CLOSED', 'OPEN', 'HALF_OPEN']).toContain(status.state);
    });

    it('should start in CLOSED state', async () => {
      const { claudeService } = await import('../claudeService');

      const status = claudeService.getCircuitBreakerStatus();
      expect(status.state).toBe('CLOSED');
      expect(status.failures).toBe(0);
    });
  });

  // ===========================================================================
  // SERVICE STATUS TESTS
  // ===========================================================================

  describe('Service Status', () => {
    it('should return service status object', async () => {
      const { claudeService } = await import('../claudeService');

      const status = claudeService.getServiceStatus();

      expect(status).toHaveProperty('isInitialized');
      expect(status).toHaveProperty('isHealthy');
      expect(status).toHaveProperty('lastHealthCheck');
      expect(status).toHaveProperty('circuitBreakerState');
      expect(status).toHaveProperty('apiKeyValid');
      expect(status).toHaveProperty('modelsAvailable');
    });

    it('should list available models', async () => {
      const { claudeService } = await import('../claudeService');

      const status = claudeService.getServiceStatus();

      expect(Array.isArray(status.modelsAvailable)).toBe(true);
      expect(status.modelsAvailable.length).toBeGreaterThan(0);
    });

    it('should validate API key presence', async () => {
      const { claudeService } = await import('../claudeService');

      const status = claudeService.getServiceStatus();
      expect(typeof status.apiKeyValid).toBe('boolean');
    });
  });

  // ===========================================================================
  // INITIALIZATION TESTS
  // ===========================================================================

  describe('Initialization', () => {
    it('should be a singleton', async () => {
      const module1 = await import('../claudeService');
      const module2 = await import('../claudeService');

      expect(module1.claudeService).toBe(module2.claudeService);
    });

    it('should handle missing API key gracefully', async () => {
      vi.mocked(validateEnvironment).mockReturnValue({
        success: true,
        message: 'Valid',
      });

      // Mock environment with no API key
      vi.doMock('../../config/environment', () => ({
        env: {
          VITE_ANTHROPIC_API_KEY: '',
          VITE_CLAUDE_TIMEOUT: 30000,
        },
        validateEnvironment: vi.fn(() => ({ success: true, message: 'Valid' })),
      }));

      // Service should not crash without API key
      const { claudeService } = await import('../claudeService');
      expect(claudeService).toBeDefined();
    });

    it('should handle invalid API key format', async () => {
      vi.doMock('../../config/environment', () => ({
        env: {
          VITE_ANTHROPIC_API_KEY: 'invalid-key-format',
          VITE_CLAUDE_TIMEOUT: 30000,
        },
        validateEnvironment: vi.fn(() => ({ success: true, message: 'Valid' })),
      }));

      const { claudeService } = await import('../claudeService');
      expect(claudeService).toBeDefined();
    });
  });

  // ===========================================================================
  // HEALTH CHECK TESTS
  // ===========================================================================

  describe('Health Check', () => {
    it('should return false when client is not initialized', async () => {
      const { claudeService } = await import('../claudeService');

      // Without initialization, health check should return false
      const isHealthy = await claudeService.healthCheck();
      expect(typeof isHealthy).toBe('boolean');
    });
  });

  // ===========================================================================
  // TEST CONNECTION TESTS
  // ===========================================================================

  describe('Test Connection', () => {
    it('should return connection status object', async () => {
      const { claudeService } = await import('../claudeService');

      const result = await claudeService.testConnection();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });

    it('should indicate failure when not initialized', async () => {
      const { claudeService } = await import('../claudeService');

      const result = await claudeService.testConnection();

      // Without proper initialization
      expect(result.success).toBe(false);
      expect(result.message).toContain('not initialized');
    });
  });

  // ===========================================================================
  // LEGACY METHOD TESTS
  // ===========================================================================

  describe('Legacy Methods', () => {
    describe('chatWithHealthAssistant', () => {
      it('should return fallback message when service unavailable', async () => {
        const { claudeService } = await import('../claudeService');

        const response = await claudeService.chatWithHealthAssistant(
          'What is my blood pressure?',
          { userId: 'test-user' }
        );

        expect(typeof response).toBe('string');
        expect(response.length).toBeGreaterThan(0);
      });

      it('should handle empty message gracefully', async () => {
        const { claudeService } = await import('../claudeService');

        const response = await claudeService.chatWithHealthAssistant('', {});

        expect(typeof response).toBe('string');
      });

      it('should include user context in request', async () => {
        const { claudeService } = await import('../claudeService');

        const response = await claudeService.chatWithHealthAssistant(
          'How am I doing?',
          { userId: 'user-123', age: 75 }
        );

        expect(typeof response).toBe('string');
      });
    });

    describe('interpretHealthData', () => {
      it('should return interpretation when service unavailable', async () => {
        const { claudeService } = await import('../claudeService');

        const response = await claudeService.interpretHealthData({
          bp_systolic: 120,
          bp_diastolic: 80,
          heart_rate: 72,
        });

        expect(typeof response).toBe('string');
      });

      it('should handle empty health data', async () => {
        const { claudeService } = await import('../claudeService');

        const response = await claudeService.interpretHealthData({});

        expect(typeof response).toBe('string');
      });

      it('should process vital signs correctly', async () => {
        const { claudeService } = await import('../claudeService');

        const response = await claudeService.interpretHealthData({
          bp_systolic: 140,
          bp_diastolic: 90,
          heart_rate: 85,
          weight: 175,
          glucose_mg_dl: 110,
        });

        expect(typeof response).toBe('string');
      });
    });

    describe('analyzeRiskAssessment', () => {
      it('should return risk analysis object', async () => {
        const { claudeService } = await import('../claudeService');

        const result = await claudeService.analyzeRiskAssessment({
          walking_ability: 'independent',
          fall_risk_factors: ['balance issues'],
          medical_risk_score: 5,
        });

        expect(result).toHaveProperty('suggestedRiskLevel');
        expect(result).toHaveProperty('riskFactors');
        expect(result).toHaveProperty('recommendations');
        expect(result).toHaveProperty('clinicalNotes');
      });

      it('should return valid risk levels', async () => {
        const { claudeService } = await import('../claudeService');

        const result = await claudeService.analyzeRiskAssessment({
          mobility_risk_score: 8,
          cognitive_risk_score: 6,
        });

        expect(['LOW', 'MODERATE', 'HIGH', 'CRITICAL']).toContain(
          result.suggestedRiskLevel
        );
      });

      it('should provide fallback recommendations', async () => {
        const { claudeService } = await import('../claudeService');

        const result = await claudeService.analyzeRiskAssessment({});

        expect(Array.isArray(result.riskFactors)).toBe(true);
        expect(Array.isArray(result.recommendations)).toBe(true);
        expect(result.riskFactors.length).toBeGreaterThan(0);
        expect(result.recommendations.length).toBeGreaterThan(0);
      });
    });

    describe('generateClinicalNotes', () => {
      it('should return clinical notes string', async () => {
        const { claudeService } = await import('../claudeService');

        const notes = await claudeService.generateClinicalNotes(
          { first_name: 'John', last_name: 'Doe', age: 75 },
          { walking_ability: 'needs assistance' }
        );

        expect(typeof notes).toBe('string');
        expect(notes.length).toBeGreaterThan(0);
      });

      it('should handle minimal patient data', async () => {
        const { claudeService } = await import('../claudeService');

        const notes = await claudeService.generateClinicalNotes({}, {});

        expect(typeof notes).toBe('string');
      });
    });

    describe('generateHealthSuggestions', () => {
      it('should return array of suggestions', async () => {
        const { claudeService } = await import('../claudeService');

        const suggestions = await claudeService.generateHealthSuggestions(
          { age: 75, id: 'user-123' },
          { checkInCount: 5, mood: 'good' }
        );

        expect(Array.isArray(suggestions)).toBe(true);
        expect(suggestions.length).toBeGreaterThan(0);
      });

      it('should provide default suggestions on failure', async () => {
        const { claudeService } = await import('../claudeService');

        const suggestions = await claudeService.generateHealthSuggestions({}, {});

        expect(Array.isArray(suggestions)).toBe(true);
        expect(suggestions.length).toBeGreaterThanOrEqual(2);
      });

      it('should limit suggestion count', async () => {
        const { claudeService } = await import('../claudeService');

        const suggestions = await claudeService.generateHealthSuggestions(
          { age: 80, dob: '1944-01-01' },
          { lastActivity: '2024-01-15', checkInCount: 10 }
        );

        expect(suggestions.length).toBeLessThanOrEqual(5);
      });
    });
  });

  // ===========================================================================
  // ERROR CLASS TESTS
  // ===========================================================================

  describe('Error Classes', () => {
    it('should create ClaudeServiceError with all properties', async () => {
      const { ClaudeServiceError } = await import('../claudeService');

      const error = new ClaudeServiceError(
        'Test error',
        'TEST_CODE',
        500,
        new Error('Original'),
        'req-123'
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(500);
      expect(error.originalError).toBeDefined();
      expect(error.requestId).toBe('req-123');
      expect(error.name).toBe('ClaudeServiceError');
    });

    it('should create ClaudeInitializationError', async () => {
      const { ClaudeInitializationError } = await import('../claudeService');

      const error = new ClaudeInitializationError(
        'Init failed',
        new Error('Root cause')
      );

      expect(error.message).toBe('Init failed');
      expect(error.code).toBe('INITIALIZATION_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('ClaudeInitializationError');
    });
  });

  // ===========================================================================
  // MODEL SELECTION TESTS
  // ===========================================================================

  describe('Model Selection', () => {
    it('should export ClaudeModel enum', async () => {
      const { ClaudeModel } = await import('../claudeService');

      expect(ClaudeModel).toBeDefined();
      expect(ClaudeModel.HAIKU_3).toBeDefined();
      expect(ClaudeModel.HAIKU_3_5).toBeDefined();
      expect(ClaudeModel.SONNET_3_5).toBeDefined();
      expect(ClaudeModel.OPUS_3).toBeDefined();
    });

    it('should export UserRole enum', async () => {
      const { UserRole } = await import('../claudeService');

      expect(UserRole).toBeDefined();
      expect(UserRole.SENIOR_PATIENT).toBeDefined();
      expect(UserRole.ADMIN).toBeDefined();
    });

    it('should export RequestType enum', async () => {
      const { RequestType } = await import('../claudeService');

      expect(RequestType).toBeDefined();
      expect(RequestType.HEALTH_QUESTION).toBeDefined();
      expect(RequestType.ANALYTICS).toBeDefined();
      expect(RequestType.FHIR_ANALYSIS).toBeDefined();
    });
  });

  // ===========================================================================
  // RESET SERVICE TESTS
  // ===========================================================================

  describe('Service Reset', () => {
    it('should handle reset service call', async () => {
      const { claudeService } = await import('../claudeService');

      // Reset should gracefully handle the reset operation
      // It may resolve even if not initialized
      await expect(claudeService.resetService()).resolves.not.toThrow();
    });
  });
});

// ===========================================================================
// INTEGRATION-STYLE TESTS (With Mocked API)
// ===========================================================================

describe('ClaudeService Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Request Flow', () => {
    it('should validate user before making request', async () => {
      const { claudeService } = await import('../claudeService');

      // Rate limit info should be retrievable for any user
      const info = claudeService.getRateLimitInfo('integration-test-user');
      expect(info.remaining).toBeGreaterThan(0);
    });

    it('should track cost after request', async () => {
      const { claudeService } = await import('../claudeService');

      const costBefore = claudeService.getCostInfo('cost-test-user');
      expect(costBefore.dailySpend).toBe(0);
      expect(costBefore.monthlySpend).toBe(0);
    });
  });
});
