// MCP Cost Optimizer - Model Selector
// Intelligent routing to optimal Claude model

import { HAIKU_MODEL, SONNET_MODEL, OPUS_MODEL } from '../../../constants/aiModels';

/**
 * Task patterns that can use Haiku (60% cheaper)
 */
const SIMPLE_TASK_PATTERNS = [
  /summarize/i,
  /extract/i,
  /classify/i,
  /translate/i,
  /dashboard/i,
  /personalization/i,
  /greeting/i,
  /simple/i,
];

/**
 * Select the optimal Claude model based on task complexity
 *
 * @param task - The task/prompt text
 * @param complexity - Explicitly specified complexity
 * @param preferHaiku - Whether to prefer Haiku for simple tasks
 * @returns The selected model identifier
 */
export function selectOptimalModel(
  task: string,
  complexity: 'simple' | 'medium' | 'complex',
  preferHaiku: boolean
): string {
  if (!preferHaiku) {
    return SONNET_MODEL;
  }

  const isSimpleTask =
    complexity === 'simple' || SIMPLE_TASK_PATTERNS.some((pattern) => pattern.test(task));

  return isSimpleTask ? HAIKU_MODEL : SONNET_MODEL;
}

/**
 * Model identifiers for reference
 */
export const MODELS = {
  HAIKU: HAIKU_MODEL,
  SONNET: SONNET_MODEL,
  OPUS: OPUS_MODEL,
} as const;
