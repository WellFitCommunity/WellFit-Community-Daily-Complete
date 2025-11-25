// ============================================================================
// Model Fallback Service
// ============================================================================
// Provides resilient AI model access with automatic fallback when primary
// models are unavailable. Supports Claude (primary) and OpenAI (fallback).
//
// HIPAA Compliance: All PHI must be de-identified before calling these models.
// ============================================================================

import { createLogger } from './auditLogger.ts';

const logger = createLogger('model-fallback');

// ============================================================================
// TYPES
// ============================================================================

export interface ModelConfig {
  provider: 'anthropic' | 'openai';
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
// MODEL CONFIGURATIONS
// ============================================================================

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || '';
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || '';

const MODEL_CONFIGS: ModelConfig[] = [
  // Primary: Claude Sonnet 4.5 (best for medical coding)
  {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    apiKey: ANTHROPIC_API_KEY,
    endpoint: 'https://api.anthropic.com/v1/messages',
    maxTokens: 4096,
    costPerInputToken: 0.003 / 1000,
    costPerOutputToken: 0.015 / 1000,
  },
  // Fallback 1: Claude Haiku (faster, cheaper)
  {
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    apiKey: ANTHROPIC_API_KEY,
    endpoint: 'https://api.anthropic.com/v1/messages',
    maxTokens: 4096,
    costPerInputToken: 0.001 / 1000,
    costPerOutputToken: 0.005 / 1000,
  },
  // Fallback 2: OpenAI GPT-4o (different provider for true redundancy)
  {
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: OPENAI_API_KEY,
    endpoint: 'https://api.openai.com/v1/chat/completions',
    maxTokens: 4096,
    costPerInputToken: 0.005 / 1000,
    costPerOutputToken: 0.015 / 1000,
  },
  // Fallback 3: OpenAI GPT-4o-mini (last resort, cheaper)
  {
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKey: OPENAI_API_KEY,
    endpoint: 'https://api.openai.com/v1/chat/completions',
    maxTokens: 4096,
    costPerInputToken: 0.00015 / 1000,
    costPerOutputToken: 0.0006 / 1000,
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
    throw new Error('No AI models configured with valid API keys');
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

        const response = await callModel(modelConfig, request, finalConfig.timeoutMs);

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
 * Call a specific model
 */
async function callModel(
  config: ModelConfig,
  request: ModelRequest,
  timeoutMs: number
): Promise<Omit<ModelResponse, 'wasFallback' | 'attemptedModels' | 'responseTimeMs'>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (config.provider === 'anthropic') {
      return await callAnthropic(config, request, controller.signal);
    } else if (config.provider === 'openai') {
      return await callOpenAI(config, request, controller.signal);
    } else {
      throw new Error(`Unsupported provider: ${config.provider}`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Call Anthropic Claude API
 */
async function callAnthropic(
  config: ModelConfig,
  request: ModelRequest,
  signal: AbortSignal
): Promise<Omit<ModelResponse, 'wasFallback' | 'attemptedModels' | 'responseTimeMs'>> {
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
    signal,
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
}

/**
 * Call OpenAI API
 */
async function callOpenAI(
  config: ModelConfig,
  request: ModelRequest,
  signal: AbortSignal
): Promise<Omit<ModelResponse, 'wasFallback' | 'attemptedModels' | 'responseTimeMs'>> {
  const messages: Array<{ role: string; content: string }> = [];

  if (request.systemPrompt) {
    messages.push({ role: 'system', content: request.systemPrompt });
  }

  messages.push({ role: 'user', content: request.prompt });

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: request.maxTokens || config.maxTokens,
    messages,
  };

  if (request.temperature !== undefined) {
    body.temperature = request.temperature;
  }

  if (request.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;
  const text = data.choices?.[0]?.message?.content || '';

  return {
    text,
    model: config.model,
    provider: config.provider,
    inputTokens,
    outputTokens,
    cost: (inputTokens * config.costPerInputToken) + (outputTokens * config.costPerOutputToken),
  };
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
      // Simple health check with minimal tokens
      await callModel(
        config,
        { prompt: 'Say "ok"', maxTokens: 5 },
        5000 // 5 second timeout for health check
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
  // Remove markdown code blocks if present
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Try to find JSON object or array
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
