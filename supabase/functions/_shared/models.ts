/**
 * Canonical AI Model Version Constants (Edge Functions)
 *
 * Single source of truth for model IDs used across all edge functions.
 * These MUST match the versions pinned in the `ai_skills` database table
 * and in src/constants/aiModels.ts (service layer mirror).
 *
 * When Anthropic releases new model versions:
 * 1. Update the constants here
 * 2. Update src/constants/aiModels.ts (service layer mirror)
 * 3. Update ai_skills.model in a migration
 * 4. Run full test suite to verify
 *
 * Copyright © 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

/** Fast tier — UI personalization, quick responses, low-cost operations */
export const HAIKU_MODEL = 'claude-haiku-4-5-20250929';

/** Accurate tier — clinical analysis, billing, medical coding, risk assessment */
export const SONNET_MODEL = 'claude-sonnet-4-5-20250929';

/** Complex tier — reserved for multi-step reasoning, research, complex clinical decisions */
export const OPUS_MODEL = 'claude-opus-4-5-20251101';

/**
 * Model pricing (USD per token) — P3-4: Centralized pricing.
 *
 * Pricing is maintained here as single source of truth. When Anthropic
 * publishes new pricing, update this map. For database-driven pricing,
 * query `ai_model_registry` and merge with these defaults.
 *
 * Rates as of 2026-02 (per million tokens):
 *   Haiku 4.5:  $0.80 input / $4.00 output
 *   Sonnet 4.5: $3.00 input / $15.00 output
 *   Opus 4.5:   $15.00 input / $75.00 output
 */
export interface ModelPricing {
  input: number;   // USD per token (not per million)
  output: number;  // USD per token
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  [HAIKU_MODEL]:  { input: 0.8 / 1_000_000,  output: 4.0 / 1_000_000 },
  [SONNET_MODEL]: { input: 3.0 / 1_000_000,  output: 15.0 / 1_000_000 },
  [OPUS_MODEL]:   { input: 15.0 / 1_000_000, output: 75.0 / 1_000_000 },
};

/** Default pricing (Sonnet) for unknown models */
const DEFAULT_PRICING: ModelPricing = MODEL_PRICING[SONNET_MODEL];

/**
 * Calculate cost for a Claude API call.
 *
 * @param model - Model ID string
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Cost in USD
 */
export function calculateModelCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const rates = MODEL_PRICING[model] || DEFAULT_PRICING;
  return (inputTokens * rates.input) + (outputTokens * rates.output);
}
