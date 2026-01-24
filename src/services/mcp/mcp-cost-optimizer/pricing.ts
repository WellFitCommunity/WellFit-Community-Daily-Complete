// MCP Cost Optimizer - Pricing Calculator
// Based on Claude pricing (as of 2025-01-15)

/**
 * Pricing per million tokens (MTok) for each Claude model
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20250929': {
    input: 1.00,   // $1.00 per MTok
    output: 5.00,  // $5.00 per MTok
  },
  'claude-sonnet-4-5-20250929': {
    input: 3.00,   // $3.00 per MTok
    output: 15.00, // $15.00 per MTok
  },
  'claude-opus-4-5-20250929': {
    input: 15.00,  // $15.00 per MTok
    output: 75.00, // $75.00 per MTok
  },
};

/**
 * Default pricing (falls back to Sonnet pricing)
 */
const DEFAULT_PRICING = MODEL_PRICING['claude-sonnet-4-5-20250929'];

/**
 * Calculate the cost for an API call
 *
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param model - The model used
 * @returns Cost in USD
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string
): number {
  const pricing = MODEL_PRICING[model] || DEFAULT_PRICING;

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}

/**
 * Get pricing for a specific model
 */
export function getModelPricing(model: string): { input: number; output: number } {
  return MODEL_PRICING[model] || DEFAULT_PRICING;
}

/**
 * Estimate cost for a prompt (rough estimate based on character count)
 * Assumes ~4 characters per token
 */
export function estimateCost(
  promptLength: number,
  expectedOutputLength: number,
  model: string
): number {
  const inputTokens = Math.ceil(promptLength / 4);
  const outputTokens = Math.ceil(expectedOutputLength / 4);
  return calculateCost(inputTokens, outputTokens, model);
}
