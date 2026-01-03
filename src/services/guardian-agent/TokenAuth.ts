/**
 * Token Authentication - JWT-based scoped access control
 * Implements fine-grained permissions with short-lived tokens
 *
 * Security Features:
 * - RS256 asymmetric key signing (production-ready)
 * - 2-5 minute TTL tokens (minimizes blast radius)
 * - Fine-grained scopes (fhir.read:Observation, ehr.write:Note, etc.)
 * - JTI replay protection with automatic expiration
 * - Token revocation support
 * - Per-call token minting (least privilege)
 * - Memory-only storage (never localStorage)
 * - Automatic token refresh at 80% TTL
 * - Audit logging integration
 */

import * as jose from 'jose';
import type { JWK } from 'jose';
import { DetectedIssue, HealingAction } from './types';
import { auditLogger } from '../auditLogger';

/**
 * Key type for jose library (CryptoKey or KeyObject)
 * jose 5.x exports CryptoKey and KeyObject separately
 */
type JoseKeyLike = CryptoKey | jose.KeyObject;

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
  revoked?: boolean;
  insufficientScopes?: boolean;
  requiredScopes?: TokenScope[];
  errorMessage?: string;
  claims?: TokenClaims;
}

/**
 * Key Manager - Handles RS256 key pair generation and storage
 * In production, keys should be stored in AWS KMS, Azure Key Vault, or HashiCorp Vault
 */
class KeyManager {
  private privateKey: JoseKeyLike | null = null;
  private publicKey: JoseKeyLike | null = null;
  private keyId: string = 'guardian-agent-key-1';
  private initialized: boolean = false;

  /**
   * Initialize keys - generates new pair or loads from environment
   *
   * NOTE: In production, token minting should occur server-side (Edge Functions).
   * Client-side key generation is for development/testing only.
   * JWT private keys should NEVER be exposed to browser environments.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Check for environment-provided keys (Vite client-side)
    // SECURITY: Private keys should only be used server-side in production
    const envPrivateKey = import.meta.env.VITE_GUARDIAN_JWT_PRIVATE_KEY;
    const envPublicKey = import.meta.env.VITE_GUARDIAN_JWT_PUBLIC_KEY;

    if (envPrivateKey && envPublicKey) {
      try {
        this.privateKey = await jose.importPKCS8(envPrivateKey, 'RS256');
        this.publicKey = await jose.importSPKI(envPublicKey, 'RS256');
        this.keyId = import.meta.env.VITE_GUARDIAN_JWT_KEY_ID || this.keyId;
        this.initialized = true;
        await auditLogger.info('TOKEN_AUTH_KEYS_LOADED', {
          keyId: this.keyId,
          source: 'environment',
        });
        return;
      } catch (err: unknown) {
        await auditLogger.warn('TOKEN_AUTH_KEY_LOAD_FAILED', {
          error: err instanceof Error ? err.message : String(err),
          fallback: 'generating new keys',
        });
      }
    }

    // Generate new key pair (development/fallback)
    const { publicKey, privateKey } = await jose.generateKeyPair('RS256', {
      modulusLength: 2048,
    });

    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.keyId = `guardian-agent-key-${Date.now()}`;
    this.initialized = true;

    await auditLogger.info('TOKEN_AUTH_KEYS_GENERATED', {
      keyId: this.keyId,
      algorithm: 'RS256',
      modulusLength: 2048,
    });
  }

  async getPrivateKey(): Promise<JoseKeyLike> {
    await this.initialize();
    if (!this.privateKey) throw new Error('Private key not initialized');
    return this.privateKey;
  }

  async getPublicKey(): Promise<JoseKeyLike> {
    await this.initialize();
    if (!this.publicKey) throw new Error('Public key not initialized');
    return this.publicKey;
  }

  getKeyId(): string {
    return this.keyId;
  }

  /**
   * Export public key as JWK for JWKS endpoint
   */
  async exportPublicJWK(): Promise<JWK> {
    const publicKey = await this.getPublicKey();
    const jwk = await jose.exportJWK(publicKey);
    return {
      ...jwk,
      kid: this.keyId,
      alg: 'RS256',
      use: 'sig',
    };
  }
}

/**
 * JTI Store - Prevents token replay attacks
 * Uses in-memory store with automatic expiration
 * NOTE: For horizontal scaling, replace with Redis
 */
class JTIStore {
  private usedTokens: Map<string, number> = new Map();
  private revokedTokens: Set<string> = new Set();
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
   * Revoke a token by JTI
   */
  revoke(jti: string): void {
    this.revokedTokens.add(jti);
  }

  /**
   * Check if token is revoked
   */
  isRevoked(jti: string): boolean {
    return this.revokedTokens.has(jti);
  }

  /**
   * Revoke all tokens for a session
   */
  revokeSession(_sessionId: string, activeJtis: string[]): void {
    for (const jti of activeJtis) {
      this.revokedTokens.add(jti);
    }
  }

  /**
   * Cleanup expired JTIs
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [jti, expiresAt] of this.usedTokens.entries()) {
      if (expiresAt < now) {
        this.usedTokens.delete(jti);
        // Also remove from revoked if expired
        this.revokedTokens.delete(jti);
      }
    }
  }

  /**
   * Get stats for monitoring
   */
  getStats(): { usedCount: number; revokedCount: number } {
    return {
      usedCount: this.usedTokens.size,
      revokedCount: this.revokedTokens.size,
    };
  }

  /**
   * Destroy store (cleanup)
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.usedTokens.clear();
    this.revokedTokens.clear();
  }
}

/**
 * Token Authenticator - Mints and validates JWT tokens with RS256
 */
export class TokenAuthenticator {
  private keyManager: KeyManager;
  private jtiStore: JTIStore;
  private tokenCache: Map<string, { token: string; claims: TokenClaims }> = new Map();
  private sessionTokens: Map<string, Set<string>> = new Map(); // sessionId -> Set of JTIs
  private issuer = 'guardian-agent';

  // Token TTL: 2-5 minutes (configurable)
  private readonly TOKEN_TTL_MS = 3 * 60 * 1000; // 3 minutes default
  private readonly TOKEN_REFRESH_THRESHOLD = 0.8; // Refresh at 80% TTL

  constructor() {
    this.keyManager = new KeyManager();
    this.jtiStore = new JTIStore();
  }

  /**
   * Mint a new token for a specific action
   * Per-call, least-privilege, short-lived
   */
  async mintToken(params: {
    action: HealingAction;
    issue: DetectedIssue;
    requiredScopes: TokenScope[];
    tenant?: string;
    userId?: string;
    sessionId?: string;
  }): Promise<string> {
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

    // Sign token with RS256
    const privateKey = await this.keyManager.getPrivateKey();
    const token = await new jose.SignJWT({
      scopes: claims.scopes,
      tenant: claims.tenant,
      sessionId: claims.sessionId,
      userId: claims.userId,
      actionContext: claims.actionContext,
    })
      .setProtectedHeader({ alg: 'RS256', kid: this.keyManager.getKeyId() })
      .setJti(jti)
      .setSubject(claims.sub)
      .setIssuer(this.issuer)
      .setIssuedAt(Math.floor(now / 1000))
      .setExpirationTime(Math.floor(claims.exp / 1000))
      .sign(privateKey);

    // Store in memory cache (never localStorage)
    const cacheKey = this.getCacheKey(params.action.id, params.issue.id);
    this.tokenCache.set(cacheKey, { token, claims });

    // Track token by session for bulk revocation
    if (params.sessionId) {
      if (!this.sessionTokens.has(params.sessionId)) {
        this.sessionTokens.set(params.sessionId, new Set());
      }
      const sessionSet = this.sessionTokens.get(params.sessionId);
      if (sessionSet) {
        sessionSet.add(jti);
      }
    }

    // Audit log
    await auditLogger.info('TOKEN_MINTED', {
      jti,
      subject: claims.sub,
      scopes: claims.scopes,
      tenant: claims.tenant,
      sessionId: claims.sessionId,
      expiresAt: new Date(claims.exp).toISOString(),
    });

    return token;
  }

  /**
   * Validate a token and check scopes
   */
  async validateToken(
    token: string,
    requiredScopes: TokenScope[]
  ): Promise<TokenValidationResult> {
    try {
      const publicKey = await this.keyManager.getPublicKey();

      // Verify signature and decode
      const { payload } = await jose.jwtVerify(token, publicKey, {
        issuer: this.issuer,
      });

      const jti = payload.jti as string;
      const exp = (payload.exp as number) * 1000; // Convert to ms

      // Check revocation
      if (this.jtiStore.isRevoked(jti)) {
        await auditLogger.warn('TOKEN_VALIDATION_REVOKED', { jti });
        return {
          valid: false,
          revoked: true,
          errorMessage: 'Token has been revoked',
        };
      }

      // Check replay attack (JTI should not be reused)
      if (this.jtiStore.hasBeenUsed(jti)) {
        await auditLogger.warn('TOKEN_REPLAY_DETECTED', { jti });
        return {
          valid: false,
          replayed: true,
          errorMessage: 'Token has already been used (replay attack detected)',
        };
      }

      // Mark JTI as used
      this.jtiStore.markUsed(jti, exp);

      // Extract scopes from payload
      const tokenScopes = (payload.scopes as TokenScope[]) || [];

      // Check scopes
      const hasAllScopes = requiredScopes.every((scope) =>
        tokenScopes.includes(scope)
      );

      if (!hasAllScopes) {
        const missingScopes = requiredScopes.filter(
          (scope) => !tokenScopes.includes(scope)
        );
        await auditLogger.warn('TOKEN_INSUFFICIENT_SCOPES', {
          jti,
          required: requiredScopes,
          missing: missingScopes,
        });
        return {
          valid: false,
          insufficientScopes: true,
          requiredScopes: missingScopes,
          errorMessage: `Insufficient scopes. Missing: ${missingScopes.join(', ')}`,
        };
      }

      // Build claims from payload
      const claims: TokenClaims = {
        jti,
        sub: payload.sub as string,
        iss: payload.iss as string,
        iat: (payload.iat as number) * 1000,
        exp,
        scopes: tokenScopes,
        tenant: payload.tenant as string | undefined,
        sessionId: payload.sessionId as string | undefined,
        userId: payload.userId as string | undefined,
        actionContext: payload.actionContext as TokenClaims['actionContext'],
      };

      await auditLogger.debug('TOKEN_VALIDATED', { jti, scopes: tokenScopes });

      return { valid: true, claims };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Check for specific jose errors
      if (err instanceof jose.errors.JWTExpired) {
        await auditLogger.debug('TOKEN_EXPIRED', { error: errorMessage });
        return {
          valid: false,
          expired: true,
          errorMessage: 'Token has expired',
        };
      }

      await auditLogger.warn('TOKEN_VALIDATION_FAILED', { error: errorMessage });
      return {
        valid: false,
        errorMessage: `Token validation failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Revoke a specific token
   */
  async revokeToken(jti: string): Promise<void> {
    this.jtiStore.revoke(jti);
    await auditLogger.info('TOKEN_REVOKED', { jti });
  }

  /**
   * Revoke all tokens for a session
   */
  async revokeSession(sessionId: string): Promise<number> {
    const jtis = this.sessionTokens.get(sessionId);
    if (!jtis || jtis.size === 0) return 0;

    const jtiArray = Array.from(jtis);
    this.jtiStore.revokeSession(sessionId, jtiArray);
    this.sessionTokens.delete(sessionId);

    await auditLogger.info('SESSION_TOKENS_REVOKED', {
      sessionId,
      count: jtiArray.length,
    });

    return jtiArray.length;
  }

  /**
   * Check if token needs refresh (at 80% of TTL)
   */
  async needsRefresh(token: string): Promise<boolean> {
    try {
      const publicKey = await this.keyManager.getPublicKey();
      const { payload } = await jose.jwtVerify(token, publicKey, {
        issuer: this.issuer,
      });

      const now = Date.now();
      const iat = (payload.iat as number) * 1000;
      const exp = (payload.exp as number) * 1000;
      const age = now - iat;
      const ttl = exp - iat;

      return age >= ttl * this.TOKEN_REFRESH_THRESHOLD;
    } catch {
      return true; // If can't decode, needs refresh
    }
  }

  /**
   * Refresh a token (mint new one with same scopes)
   */
  async refreshToken(oldToken: string): Promise<string | null> {
    try {
      const publicKey = await this.keyManager.getPublicKey();
      const { payload } = await jose.jwtVerify(oldToken, publicKey, {
        issuer: this.issuer,
      });

      // Mint new token with same scopes
      const now = Date.now();
      const jti = this.generateJTI();

      const privateKey = await this.keyManager.getPrivateKey();
      const newToken = await new jose.SignJWT({
        scopes: payload.scopes,
        tenant: payload.tenant,
        sessionId: payload.sessionId,
        userId: payload.userId,
        actionContext: payload.actionContext,
      })
        .setProtectedHeader({ alg: 'RS256', kid: this.keyManager.getKeyId() })
        .setJti(jti)
        .setSubject(payload.sub as string)
        .setIssuer(this.issuer)
        .setIssuedAt(Math.floor(now / 1000))
        .setExpirationTime(Math.floor((now + this.TOKEN_TTL_MS) / 1000))
        .sign(privateKey);

      await auditLogger.debug('TOKEN_REFRESHED', {
        oldJti: payload.jti,
        newJti: jti,
      });

      return newToken;
    } catch {
      return null;
    }
  }

  /**
   * Get cached token for action (if still valid)
   */
  getCachedToken(actionId: string, issueId: string): string | null {
    const cacheKey = this.getCacheKey(actionId, issueId);
    const cached = this.tokenCache.get(cacheKey);

    if (!cached) return null;

    // Check if expired
    if (cached.claims.exp < Date.now()) {
      this.tokenCache.delete(cacheKey);
      return null;
    }

    return cached.token;
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

  /**
   * Get public key as JWK for JWKS endpoint
   */
  async getPublicJWKS(): Promise<{ keys: JWK[] }> {
    const jwk = await this.keyManager.exportPublicJWK();
    return { keys: [jwk] };
  }

  /**
   * Get JTI store stats for monitoring
   */
  getStats(): { usedCount: number; revokedCount: number; cacheSize: number } {
    const jtiStats = this.jtiStore.getStats();
    return {
      ...jtiStats,
      cacheSize: this.tokenCache.size,
    };
  }

  // Private helper methods

  private generateJTI(): string {
    return `jti-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCacheKey(actionId: string, issueId: string): string {
    return `${actionId}:${issueId}`;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.jtiStore.destroy();
    this.tokenCache.clear();
    this.sessionTokens.clear();
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

    if (cached && !(await this.authenticator.needsRefresh(cached))) {
      return cached;
    }

    // Refresh if needed
    if (cached && (await this.authenticator.needsRefresh(cached))) {
      const refreshed = await this.authenticator.refreshToken(cached);
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
  async validateToken(
    token: string,
    requiredScopes: TokenScope[]
  ): Promise<TokenValidationResult> {
    return this.authenticator.validateToken(token, requiredScopes);
  }

  /**
   * Revoke a specific token
   */
  async revokeToken(jti: string): Promise<void> {
    return this.authenticator.revokeToken(jti);
  }

  /**
   * Revoke all tokens for a session
   */
  async revokeSession(sessionId: string): Promise<number> {
    return this.authenticator.revokeSession(sessionId);
  }

  /**
   * Get JWKS for public key distribution
   */
  async getJWKS(): Promise<{ keys: JWK[] }> {
    return this.authenticator.getPublicJWKS();
  }

  /**
   * Get stats for monitoring
   */
  getStats(): { usedCount: number; revokedCount: number; cacheSize: number } {
    return this.authenticator.getStats();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.authenticator.destroy();
  }
}

/**
 * Production Notes:
 *
 * 1. Key Management:
 *    - Set GUARDIAN_JWT_PRIVATE_KEY (PKCS8 PEM format)
 *    - Set GUARDIAN_JWT_PUBLIC_KEY (SPKI PEM format)
 *    - Set GUARDIAN_JWT_KEY_ID for key rotation tracking
 *    - Store private key in AWS KMS, Azure Key Vault, or HashiCorp Vault
 *
 * 2. For Horizontal Scaling:
 *    - Replace JTIStore with Redis implementation
 *    - Use Redis with TTL for automatic JTI expiration
 *    - Add Redis connection pooling
 *
 * 3. JWKS Endpoint:
 *    - Expose getJWKS() via API route for external validation
 *    - Cache JWKS with 10-minute TTL
 *
 * 4. Rate Limiting (future):
 *    - Track API calls per scope using Redis
 *    - Sliding window rate limiter per tenant/user
 */
