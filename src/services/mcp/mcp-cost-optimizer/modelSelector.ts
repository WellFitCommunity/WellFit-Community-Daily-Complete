// MCP Cost Optimizer - Model Selector
// Intelligent routing to optimal Claude model

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
    return 'claude-sonnet-4-5-20250929';
  }

  const isSimpleTask =
    complexity === 'simple' || SIMPLE_TASK_PATTERNS.some((pattern) => pattern.test(task));

  return isSimpleTask ? 'claude-haiku-4-5-20250929' : 'claude-sonnet-4-5-20250929';
}

/**
 * Model identifiers for reference
 */
export const MODELS = {
  HAIKU: 'claude-haiku-4-5-20250929',
  SONNET: 'claude-sonnet-4-5-20250929',
  OPUS: 'claude-opus-4-5-20250929',
} as const;
