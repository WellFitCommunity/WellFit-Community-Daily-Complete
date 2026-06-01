/**
 * Claude call engine — the gated request core extracted from ClaudeService
 * (CLAUDE.md Commandment #12). Owns no state of its own: it's handed the
 * service's RateLimiter / CostTracker / CircuitBreaker and an `ensureInitialized`
 * callback, and enforces init + rate limit + budget + circuit breaker around
 * each edge-function call, records spend, and returns text or structured output.
 */

import { auditLogger } from '../auditLogger';
import { modelSelector } from '../../utils/claudeModelSelection';
import {
  UserRole,
  ClaudeModel,
  RequestType,
  ClaudeRequestContext,
  ClaudeResponse,
} from '../../types/claude';
import { callEdgeFunction, type EdgeFunctionResponse, type ClaudeTool } from './transport';
import { ClaudeServiceError } from './errors';
import type { RateLimiter } from './rateLimiter';
import type { CostTracker } from './costTracker';
import type { CircuitBreaker } from './circuitBreaker';

type Criteria = { userRole: UserRole; requestType: RequestType; complexity: 'simple' | 'moderate' | 'complex' };

export class ClaudeCallEngine {
  constructor(
    private rateLimiter: RateLimiter,
    private costTracker: CostTracker,
    private circuitBreaker: CircuitBreaker,
    private ensureInitialized: () => void
  ) {}

  /**
   * Shared gated call: init + rate limit + budget + circuit breaker, records
   * spend, returns the raw edge-function response. `opts.tools`/`opts.toolChoice`
   * force structured output (tool_use).
   */
  private async executeGatedCall(
    prompt: string,
    context: ClaudeRequestContext,
    criteria: Criteria,
    opts?: { tools?: ClaudeTool[]; toolChoice?: { type: 'tool'; name: string } }
  ): Promise<{ response: EdgeFunctionResponse; model: ClaudeModel; actualCost: number; responseTime: number }> {
    this.ensureInitialized();

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

    const model = modelSelector.selectModel({ ...criteria, budgetTier: 'standard' });

    const maxTokens = criteria.complexity === 'simple' ? 1000 :
                     criteria.complexity === 'moderate' ? 2000 : 4000;

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
        return await callEdgeFunction([{ role: 'user', content: prompt }], model, maxTokens, undefined, opts);
      });

      const responseTime = Date.now() - startTime;
      const actualCost = this.costTracker.calculateCost(
        model,
        response.usage.input_tokens,
        response.usage.output_tokens
      );
      this.costTracker.recordSpending(context.userId, actualCost);

      return { response, model, actualCost, responseTime };
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

  /** Text response. */
  async generateResponse(prompt: string, context: ClaudeRequestContext, criteria: Criteria): Promise<ClaudeResponse> {
    const { response, model, actualCost, responseTime } = await this.executeGatedCall(prompt, context, criteria);
    const responseContent = response.content[0]?.type === 'text' ? response.content[0].text : '';
    return {
      content: responseContent || '',
      model,
      tokenUsage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
      cost: actualCost,
      responseTime,
      requestId: context.requestId,
    };
  }

  /**
   * Structured response via forced tool_use (Rule #16). Returns the tool's
   * `input` object (caller validates) or null if Claude emitted no tool_use
   * block — callers MUST treat null as low-confidence, not a default.
   */
  async generateStructuredResponse(
    prompt: string,
    context: ClaudeRequestContext,
    criteria: Criteria,
    tool: ClaudeTool
  ): Promise<unknown> {
    const { response } = await this.executeGatedCall(prompt, context, criteria, {
      tools: [tool],
      toolChoice: { type: 'tool', name: tool.name },
    });
    const toolBlock = response.content.find((b) => b.type === 'tool_use');
    return toolBlock?.input ?? null;
  }
}
