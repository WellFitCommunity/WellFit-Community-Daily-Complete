/**
 * Circuit breaker for Claude API resilience
 *
 * Extracted from claudeService.ts (CLAUDE.md Commandment #12). Behavior unchanged.
 */

import { ClaudeServiceError } from './errors';

export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime?: Date;
  private readonly failureThreshold = 5;
  private readonly timeout = 60000; // 60 seconds

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new ClaudeServiceError(
          'Claude service temporarily unavailable due to repeated failures',
          'CIRCUIT_BREAKER_OPEN'
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err: unknown) {
      this.onFailure(err);
      throw err;
    }
  }

  private shouldAttemptReset(): boolean {
    return !!(this.lastFailureTime &&
           (Date.now() - this.lastFailureTime.getTime()) > this.timeout);
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      // Service restored
    }
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(_error: unknown): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      // Circuit breaker opened due to repeated failures
    }
  }

  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.state;
  }

  getStatus(): { state: string; failures: number; lastFailure?: Date } {
    return {
      state: this.state,
      failures: this.failureCount,
      lastFailure: this.lastFailureTime
    };
  }
}
