// Lazy loader for Anthropic SDK - reduces initial bundle by ~400KB
import type Anthropic from '@anthropic-ai/sdk';

type AnthropicConstructor = typeof Anthropic;
let AnthropicSDK: AnthropicConstructor | null = null;

export async function loadAnthropicSDK() {
  if (AnthropicSDK) {
    return AnthropicSDK;
  }

  const module = await import('@anthropic-ai/sdk');
  AnthropicSDK = module.default;
  return AnthropicSDK;
}

export function isAnthropicLoaded(): boolean {
  return AnthropicSDK !== null;
}
