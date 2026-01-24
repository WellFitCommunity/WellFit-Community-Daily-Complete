// MCP Cost Optimizer - Prompt Cache
// In-memory caching for prompt responses

import type { CacheEntry } from './types';

/**
 * PromptCache - Manages caching of AI prompt responses
 *
 * Features:
 * - Deterministic key generation for cache hits
 * - TTL-based expiration
 * - Automatic cleanup of old entries (max 1000)
 */
export class PromptCache {
  private cache: Map<string, CacheEntry> = new Map();

  /**
   * Generate a deterministic cache key from prompt and context
   */
  generateKey(prompt: string, context: Record<string, unknown> = {}): string {
    const combined = JSON.stringify({ prompt, context: this.normalizeContext(context) });
    return this.simpleHash(combined);
  }

  /**
   * Normalize context by removing user-specific fields for better cache hits
   */
  private normalizeContext(context: Record<string, unknown>): Record<string, unknown> {
    const normalized = { ...context };
    delete normalized.timestamp;
    delete normalized.request_id;
    delete normalized.user_id;
    return normalized;
  }

  /**
   * Generate a simple hash from a string
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Get a cached entry if it exists and hasn't expired
   */
  get(key: string, maxAge: number): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = (Date.now() - entry.timestamp) / 1000;
    if (age > maxAge) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  /**
   * Store an entry in the cache
   */
  set(key: string, entry: CacheEntry): void {
    this.cache.set(key, entry);

    // Clean old entries (keep max 1000)
    if (this.cache.size > 1000) {
      const oldestKeys = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, 100)
        .map(([key]) => key);

      oldestKeys.forEach((key) => this.cache.delete(key));
    }
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }
}
