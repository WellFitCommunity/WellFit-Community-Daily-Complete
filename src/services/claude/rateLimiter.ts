/**
 * Per-user sliding-window rate limiter for Claude API calls
 *
 * Extracted from claudeService.ts (CLAUDE.md Commandment #12). Behavior unchanged.
 */

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(
    private maxRequests: number = 60,
    private windowMs: number = 60000 // 1 minute
  ) {}

  canMakeRequest(userId: string): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];

    // Remove old requests outside the window
    const validRequests = userRequests.filter(
      timestamp => now - timestamp < this.windowMs
    );

    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(userId, validRequests);
    return true;
  }

  getRemainingRequests(userId: string): number {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    const validRequests = userRequests.filter(
      timestamp => now - timestamp < this.windowMs
    );
    return Math.max(0, this.maxRequests - validRequests.length);
  }

  getResetTime(userId: string): Date {
    const userRequests = this.requests.get(userId) || [];
    if (userRequests.length === 0) {
      return new Date();
    }
    const oldestRequest = userRequests.reduce((min, ts) => Math.min(min, ts), Infinity);
    return new Date(oldestRequest + this.windowMs);
  }
}
