/**
 * Token Authentication - JWT-based scoped access control
 * Implements fine-grained permissions with short-lived tokens
 *
 * Security Features:
 * - 2-5 minute TTL tokens (minimizes blast radius)
 * - Fine-grained scopes (fhir.read:Observation, ehr.write:Note, etc.)
 * - JTI replay protection with Redis/in-memory store
 * - Per-call token minting (least privilege)
 * - Memory-only storage (never localStorage)
 * - Automatic token refresh at 80% TTL
 */

import { DetectedIssue, HealingAction } from './types';

/**
 * Token scope format: {domain}.{action}:{resource}
 * Examples:
 * - fhir.read:Observation
 * - ehr.write:Note
 * - files.read:tenant
 * - database.query:patients
 * - api.call:external
 */
export type TokenScope = string;

export interface TokenClaims {
  /** JWT ID - unique identifier for replay protection */
  jti: string;

  /** Subject - what is being acted upon */
  sub: string;

  /** Issuer - Guardian Agent */
  iss: string;

  /** Issued at timestamp */
  iat: number;

  /** Expiration timestamp (2-5 minutes from iat) */
  exp: number;

  /** Fine-grained scopes */
  scopes: TokenScope[];

  /** Tenant ID for multi-tenant isolation */
  tenant?: string;

  /** Session ID for audit trail */
  sessionId?: string;

  /** User ID if action is on behalf of user */
  userId?: string;

  /** Action context for audit */
  actionContext: {
    issueId: string;
    strategy: string;
    severity: string;
  };
}

export interface TokenValidationResult {
  valid: boolean;
  expired?: boolean;
  replayed?: boolean;
  insufficientScopes?: boolean;
  requiredScopes?: TokenScope[];
  errorMessage?: string;
}

/**
 * JTI Store - Prevents token replay attacks
 * Uses in-memory store with automatic expiration
 */
class JTIStore {
  private usedTokens: Map<string, number> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired JTIs every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Mark a JTI as used
   */
  markUsed(jti: string, expiresAt: number): void {
    this.usedTokens.set(jti, expiresAt);
  }

  /**
   * Check if JTI has been used (replay attack)
   */
  hasBeenUsed(jti: string): boolean {
    return this.usedTokens.has(jti);
  }

  /**
   * Cleanup expired JTIs
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [jti, expiresAt] of this.usedTokens.entries()) {
      if (expiresAt < now) {
        this.usedTokens.delete(jti);
      }
    }
  }

  /**
   * Destroy store (cleanup)
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.usedTokens.clear();
  }
}

/**
 * Token Authenticator - Mints and validates JWT tokens
 */
export class TokenAuthenticator {
  private jtiStore: JTIStore;
  private tokenCache: Map<string, TokenClaims> = new Map();
  private issuer = 'guardian-agent';

  // Token TTL: 2-5 minutes (configurable)
  private readonly TOKEN_TTL_MS = 3 * 60 * 1000; // 3 minutes default
  private readonly TOKEN_REFRESH_THRESHOLD = 0.8; // Refresh at 80% TTL

  constructor() {
    this.jtiStore = new JTIStore();
  }

  /**
   * Mint a new token for a specific action
   * Per-call, least-privilege, short-lived
   */
  mintToken(params: {
    action: HealingAction;
    issue: DetectedIssue;
    requiredScopes: TokenScope[];
    tenant?: string;
    userId?: string;
    sessionId?: string;
  }): string {
    const now = Date.now();
    const jti = this.generateJTI();

    const claims: TokenClaims = {
      jti,
      sub: params.action.id,
      iss: this.issuer,
      iat: now,
      exp: now + this.TOKEN_TTL_MS,
      scopes: params.requiredScopes,
      tenant: params.tenant,
      sessionId: params.sessionId,
      userId: params.userId,
      actionContext: {
        issueId: params.issue.id,
        strategy: params.action.strategy,
        severity: params.issue.severity,
      },
    };

    // Store in memory cache (never localStorage!)
    const cacheKey = this.getCacheKey(params.action.id, params.issue.id);
    this.tokenCache.set(cacheKey, claims);

    // In production, this would be a signed JWT
    // For now, return base64-encoded claims
    return this.encodeToken(claims);
  }

  /**
   * Validate a token and check scopes
   */
  validateToken(
    token: string,
    requiredScopes: TokenScope[]
  ): TokenValidationResult {
    try {
      const claims = this.decodeToken(token);

      // Check expiration
      if (claims.exp < Date.now()) {
        return {
          valid: false,
          expired: true,
          errorMessage: 'Token has expired',
        };
      }

      // Check replay attack (JTI should not be reused)
      if (this.jtiStore.hasBeenUsed(claims.jti)) {
        return {
          valid: false,
          replayed: true,
          errorMessage: 'Token has already been used (replay attack detected)',
        };
      }

      // Mark JTI as used
      this.jtiStore.markUsed(claims.jti, claims.exp);

      // Check scopes
      const hasAllScopes = requiredScopes.every((scope) =>
        claims.scopes.includes(scope)
      );

      if (!hasAllScopes) {
        const missingScopes = requiredScopes.filter(
          (scope) => !claims.scopes.includes(scope)
        );
        return {
          valid: false,
          insufficientScopes: true,
          requiredScopes: missingScopes,
          errorMessage: `Insufficient scopes. Missing: ${missingScopes.join(', ')}`,
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        errorMessage: `Token validation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Check if token needs refresh (at 80% of TTL)
   */
  needsRefresh(token: string): boolean {
    try {
      const claims = this.decodeToken(token);
      const now = Date.now();
      const age = now - claims.iat;
      const ttl = claims.exp - claims.iat;
      return age >= ttl * this.TOKEN_REFRESH_THRESHOLD;
    } catch {
      return true; // If can't decode, needs refresh
    }
  }

  /**
   * Refresh a token (mint new one with same scopes)
   */
  refreshToken(oldToken: string): string | null {
    try {
      const oldClaims = this.decodeToken(oldToken);

      // Mint new token with same scopes
      const newClaims: TokenClaims = {
        ...oldClaims,
        jti: this.generateJTI(),
        iat: Date.now(),
        exp: Date.now() + this.TOKEN_TTL_MS,
      };

      return this.encodeToken(newClaims);
    } catch {
      return null;
    }
  }

  /**
   * Get cached token for action (if still valid)
   */
  getCachedToken(actionId: string, issueId: string): string | null {
    const cacheKey = this.getCacheKey(actionId, issueId);
    const claims = this.tokenCache.get(cacheKey);

    if (!claims) return null;

    // Check if expired
    if (claims.exp < Date.now()) {
      this.tokenCache.delete(cacheKey);
      return null;
    }

    return this.encodeToken(claims);
  }

  /**
   * Determine required scopes for a healing action
   */
  static determineScopesForAction(action: HealingAction): TokenScope[] {
    const scopes: TokenScope[] = [];

    // Base scope for the action type
    scopes.push(`guardian.heal:${action.strategy}`);

    // Add scopes based on steps
    for (const step of action.steps) {
      if (step.action === 'retry' || step.action === 'validate') {
        scopes.push(`api.read:${step.target}`);
      } else if (step.action === 'update' || step.action === 'patch') {
        scopes.push(`api.write:${step.target}`);
      } else if (step.action === 'delete' || step.action === 'clear') {
        scopes.push(`api.delete:${step.target}`);
      } else if (step.action === 'query' || step.action === 'fetch') {
        scopes.push(`database.query:${step.target}`);
      }
    }

    // Strategy-specific scopes
    switch (action.strategy) {
      case 'retry_with_backoff':
        scopes.push('api.retry:endpoint');
        break;
      case 'circuit_breaker':
        scopes.push('circuit.control:breaker');
        break;
      case 'fallback_to_cache':
        scopes.push('cache.read:fallback');
        break;
      case 'state_rollback':
        scopes.push('state.write:rollback');
        break;
      case 'resource_cleanup':
        scopes.push('memory.write:cleanup');
        break;
      case 'security_lockdown':
        scopes.push('security.write:lockdown');
        break;
      case 'data_reconciliation':
        scopes.push('database.write:reconcile');
        break;
      case 'auto_patch':
        scopes.push('code.write:patch');
        break;
    }

    // Remove duplicates
    return Array.from(new Set(scopes));
  }

  // Private helper methods

  private generateJTI(): string {
    return `jti-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCacheKey(actionId: string, issueId: string): string {
    return `${actionId}:${issueId}`;
  }

  private encodeToken(claims: TokenClaims): string {
    // In production: Use jose or jsonwebtoken library to sign with RS256
    // For now: Base64 encoding (this is NOT production-ready)
    const json = JSON.stringify(claims);
    return Buffer.from(json).toString('base64');
  }

  private decodeToken(token: string): TokenClaims {
    // In production: Verify signature with JWKS
    // For now: Base64 decoding
    const json = Buffer.from(token, 'base64').toString('utf-8');
    return JSON.parse(json) as TokenClaims;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.jtiStore.destroy();
    this.tokenCache.clear();
  }
}

/**
 * Token Manager - High-level token operations
 */
export class TokenManager {
  private authenticator: TokenAuthenticator;

  constructor() {
    this.authenticator = new TokenAuthenticator();
  }

  /**
   * Get token for action (with automatic caching and refresh)
   */
  async getTokenForAction(params: {
    action: HealingAction;
    issue: DetectedIssue;
    tenant?: string;
    userId?: string;
    sessionId?: string;
  }): Promise<string> {
    // Check cache first
    const cached = this.authenticator.getCachedToken(
      params.action.id,
      params.issue.id
    );

    if (cached && !this.authenticator.needsRefresh(cached)) {
      return cached;
    }

    // Refresh if needed
    if (cached && this.authenticator.needsRefresh(cached)) {
      const refreshed = this.authenticator.refreshToken(cached);
      if (refreshed) return refreshed;
    }

    // Mint new token
    const requiredScopes = TokenAuthenticator.determineScopesForAction(
      params.action
    );

    return this.authenticator.mintToken({
      action: params.action,
      issue: params.issue,
      requiredScopes,
      tenant: params.tenant,
      userId: params.userId,
      sessionId: params.sessionId,
    });
  }

  /**
   * Validate token with required scopes
   */
  validateToken(token: string, requiredScopes: TokenScope[]): TokenValidationResult {
    return this.authenticator.validateToken(token, requiredScopes);
  }

  /**
   * Extract claims from token (for audit logging)
   */
  getTokenClaims(token: string): TokenClaims | null {
    try {
      return this.authenticator['decodeToken'](token);
    } catch {
      return null;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.authenticator.destroy();
  }
}

/**
 * Production TODO:
 *
 * 1. Replace base64 encoding with actual JWT signing:
 *    - Use 'jose' or 'jsonwebtoken' library
 *    - Sign with RS256 (asymmetric keys)
 *    - Store private key in secure vault (AWS KMS, Azure Key Vault)
 *    - Expose public JWKS endpoint for validation
 *
 * 2. Replace in-memory JTI store with Redis:
 *    - Use Redis with TTL for automatic expiration
 *    - Ensures JTI replay protection across instances
 *    - Add Redis connection pooling
 *
 * 3. Add token revocation:
 *    - Revocation list in Redis
 *    - Check revocation before validation
 *    - Admin API to revoke tokens
 *
 * 4. Add rate limiting per scope:
 *    - Track API calls per scope
 *    - Prevent abuse of high-privilege scopes
 *    - Sliding window rate limiter
 *
 * 5. Add audit logging:
 *    - Log every token mint
 *    - Log every validation attempt
 *    - Log every scope check failure
 *    - Integration with AuditLogger
 */
