// ============================================================================
// Model Fallback Service
// ============================================================================
// Provides resilient AI model access with automatic fallback when primary
// models are unavailable. Claude-only — Sonnet (primary) → Haiku (fallback).
//
// HIPAA Compliance: All PHI must be de-identified before calling these models.
// ============================================================================

import { createLogger } from './auditLogger.ts';
import { HAIKU_MODEL, SONNET_MODEL, OPUS_MODEL } from './models.ts';

const logger = createLogger('model-fallback');

// ============================================================================
// TYPES
// ============================================================================

export interface ModelConfig {
  provider: 'anthropic';
  model: string;
  apiKey: string;
  endpoint: string;
  maxTokens: number;
  costPerInputToken: number;
  costPerOutputToken: number;
}

export interface ModelResponse {
  text: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  responseTimeMs: number;
  wasFallback: boolean;
  attemptedModels: string[];
}

export interface ModelRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

export interface FallbackConfig {
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  enableFallback: boolean;
}

// ============================================================================
// MODEL CONFIGURATIONS — Claude only
// ============================================================================

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || '';

const MODEL_CONFIGS: ModelConfig[] = [
  // Primary: Claude Opus (complex clinical reasoning, multi-step decisions)
  {
    provider: 'anthropic',
    model: OPUS_MODEL,
    apiKey: ANTHROPIC_API_KEY,
    endpoint: 'https://api.anthropic.com/v1/messages',
    maxTokens: 4096,
    costPerInputToken: 15.0 / 1_000_000,
    costPerOutputToken: 75.0 / 1_000_000,
  },
  // Fallback 1: Claude Sonnet (accurate, cost-effective)
  {
    provider: 'anthropic',
    model: SONNET_MODEL,
    apiKey: ANTHROPIC_API_KEY,
    endpoint: 'https://api.anthropic.com/v1/messages',
    maxTokens: 4096,
    costPerInputToken: 3.0 / 1_000_000,
    costPerOutputToken: 15.0 / 1_000_000,
  },
  // Fallback 2: Claude Haiku (fast, cheapest — last resort)
  {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    apiKey: ANTHROPIC_API_KEY,
    endpoint: 'https://api.anthropic.com/v1/messages',
    maxTokens: 4096,
    costPerInputToken: 0.8 / 1_000_000,
    costPerOutputToken: 4.0 / 1_000_000,
  },
];

const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  maxRetries: 2,
  retryDelayMs: 1000,
  timeoutMs: 30000,
  enableFallback: true,
};

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Call AI model with automatic fallback
 */
export async function callModelWithFallback(
  request: ModelRequest,
  config: Partial<FallbackConfig> = {}
): Promise<ModelResponse> {
  const finalConfig = { ...DEFAULT_FALLBACK_CONFIG, ...config };
  const attemptedModels: string[] = [];
  const startTime = Date.now();

  // Filter to only models with valid API keys
  const availableModels = MODEL_CONFIGS.filter(m => m.apiKey && m.apiKey.length > 0);

  if (availableModels.length === 0) {
    throw new Error('No AI models configured — ANTHROPIC_API_KEY is required');
  }

  let lastError: Error | null = null;

  for (let i = 0; i < availableModels.length; i++) {
    const modelConfig = availableModels[i];
    attemptedModels.push(`${modelConfig.provider}/${modelConfig.model}`);

    // Skip fallback models if fallback is disabled (except for first model)
    if (i > 0 && !finalConfig.enableFallback) {
      break;
    }

    for (let retry = 0; retry <= finalConfig.maxRetries; retry++) {
      try {
        logger.info('Attempting model call', {
          provider: modelConfig.provider,
          model: modelConfig.model,
          attempt: retry + 1,
          isFallback: i > 0
        });

        const response = await callAnthropic(modelConfig, request, finalConfig.timeoutMs);

        logger.info('Model call successful', {
          provider: modelConfig.provider,
          model: modelConfig.model,
          responseTimeMs: Date.now() - startTime,
          wasFallback: i > 0
        });

        return {
          ...response,
          wasFallback: i > 0,
          attemptedModels,
          responseTimeMs: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        logger.warn('Model call failed', {
          provider: modelConfig.provider,
          model: modelConfig.model,
          attempt: retry + 1,
          error: lastError.message,
          willRetry: retry < finalConfig.maxRetries,
          willFallback: i < availableModels.length - 1
        });

        // Wait before retry (exponential backoff)
        if (retry < finalConfig.maxRetries) {
          await sleep(finalConfig.retryDelayMs * Math.pow(2, retry));
        }
      }
    }
  }

  // All models failed
  logger.error('All model attempts failed', {
    attemptedModels,
    lastError: lastError?.message,
    totalTimeMs: Date.now() - startTime
  });

  throw new Error(`All AI models failed. Last error: ${lastError?.message}`);
}

/**
 * Call Anthropic Claude API
 */
async function callAnthropic(
  config: ModelConfig,
  request: ModelRequest,
  timeoutMs: number
): Promise<Omit<ModelResponse, 'wasFallback' | 'attemptedModels' | 'responseTimeMs'>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const messages = [
      { role: 'user', content: request.prompt }
    ];

    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: request.maxTokens || config.maxTokens,
      messages,
    };

    if (request.systemPrompt) {
      body.system = request.systemPrompt;
    }

    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }

    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;
    const text = data.content?.[0]?.text || '';

    return {
      text,
      model: config.model,
      provider: config.provider,
      inputTokens,
      outputTokens,
      cost: (inputTokens * config.costPerInputToken) + (outputTokens * config.costPerOutputToken),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// HEALTH CHECK & MONITORING
// ============================================================================

export interface ModelHealth {
  provider: string;
  model: string;
  available: boolean;
  latencyMs?: number;
  error?: string;
}

/**
 * Check health of all configured models
 */
export async function checkModelHealth(): Promise<ModelHealth[]> {
  const results: ModelHealth[] = [];

  for (const config of MODEL_CONFIGS) {
    if (!config.apiKey) {
      results.push({
        provider: config.provider,
        model: config.model,
        available: false,
        error: 'No API key configured',
      });
      continue;
    }

    const startTime = Date.now();

    try {
      await callAnthropic(
        config,
        { prompt: 'Say "ok"', maxTokens: 5 },
        5000
      );

      results.push({
        provider: config.provider,
        model: config.model,
        available: true,
        latencyMs: Date.now() - startTime,
      });
    } catch (error) {
      results.push({
        provider: config.provider,
        model: config.model,
        available: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

/**
 * Get model status summary
 */
export function getModelStatus(): {
  primaryAvailable: boolean;
  fallbacksAvailable: number;
  totalModels: number;
} {
  const availableModels = MODEL_CONFIGS.filter(m => m.apiKey && m.apiKey.length > 0);

  return {
    primaryAvailable: availableModels.length > 0 && !!availableModels[0].apiKey,
    fallbacksAvailable: Math.max(0, availableModels.length - 1),
    totalModels: availableModels.length,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract JSON from model response (handles markdown code blocks)
 */
export function extractJSON(text: string): unknown {
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  return JSON.parse(cleaned);
}

/**
 * Validate that response contains expected JSON structure
 */
export function validateResponseStructure(
  data: unknown,
  requiredFields: string[]
): { valid: boolean; missingFields: string[] } {
  if (typeof data !== 'object' || data === null) {
    return { valid: false, missingFields: requiredFields };
  }

  const missingFields = requiredFields.filter(
    field => !(field in (data as Record<string, unknown>))
  );

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}
