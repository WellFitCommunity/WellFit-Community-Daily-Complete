/**
 * Claude service error classes
 *
 * Extracted from claudeService.ts (CLAUDE.md Commandment #12).
 */

export class ClaudeServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public originalError?: unknown,
    public requestId?: string
  ) {
    super(message);
    this.name = 'ClaudeServiceError';
  }
}

export class ClaudeInitializationError extends ClaudeServiceError {
  constructor(message: string, originalError?: unknown) {
    super(message, 'INITIALIZATION_ERROR', 500, originalError);
    this.name = 'ClaudeInitializationError';
  }
}
