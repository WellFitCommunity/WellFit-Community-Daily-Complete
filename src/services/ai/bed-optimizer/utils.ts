// Bed Optimizer - Utility Functions
// JSON parsing and shared helpers

/**
 * Parse JSON object from AI response string
 */
export function parseJSON(response: string): Record<string, unknown> {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {};
  }
}

/**
 * Parse JSON array from AI response string
 */
export function parseJSONArray<T = Record<string, unknown>>(response: string): T[] {
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]) as T[];
  } catch {
    return [];
  }
}
