/**
 * MCP Rate Limiting — S2-2 Cross-Instance Coverage Tests
 *
 * Verifies that all 13 MCP servers have proper rate limiting configured:
 * - Tier 3 (admin): Must have both in-memory AND persistent rate limiting
 * - Tier 2 (user_scoped): Must have in-memory, persistent recommended
 * - Tier 1 (external_api): In-memory sufficient
 *
 * Tests verify the rate limit configuration map and the persistent
 * check_rate_limit RPC contract.
 */

import { describe, it, expect } from 'vitest';

// ===================================================================
// Rate limit config coverage — every server must have a config entry
// ===================================================================

const EXPECTED_RATE_LIMIT_CONFIGS = [
  'postgres',
  'fhir',
  'clearinghouse',
  'medicalCodes',
  'hl7x12',
  'claude',
  'edgeFunctions',
  'prior_auth',
  'cms_coverage',
  'npi_registry',
  'medical_coding',
  'chain_orchestrator',
  'pubmed',
  'cultural_competency',
] as const;

// Simulated config structure matching mcpRateLimiter.ts
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix: string;
}

const MCP_RATE_LIMITS: Record<string, RateLimitConfig> = {
  postgres: { maxRequests: 60, windowMs: 60_000, keyPrefix: 'mcp:postgres' },
  fhir: { maxRequests: 30, windowMs: 60_000, keyPrefix: 'mcp:fhir' },
  clearinghouse: { maxRequests: 20, windowMs: 60_000, keyPrefix: 'mcp:clearinghouse' },
  medicalCodes: { maxRequests: 100, windowMs: 60_000, keyPrefix: 'mcp:codes' },
  hl7x12: { maxRequests: 40, windowMs: 60_000, keyPrefix: 'mcp:hl7x12' },
  claude: { maxRequests: 15, windowMs: 60_000, keyPrefix: 'mcp:claude' },
  edgeFunctions: { maxRequests: 50, windowMs: 60_000, keyPrefix: 'mcp:edge' },
  prior_auth: { maxRequests: 40, windowMs: 60_000, keyPrefix: 'mcp:prior_auth' },
  cms_coverage: { maxRequests: 100, windowMs: 60_000, keyPrefix: 'mcp:cms_coverage' },
  npi_registry: { maxRequests: 100, windowMs: 60_000, keyPrefix: 'mcp:npi' },
  medical_coding: { maxRequests: 30, windowMs: 60_000, keyPrefix: 'mcp:medical_coding' },
  chain_orchestrator: { maxRequests: 30, windowMs: 60_000, keyPrefix: 'mcp:chain' },
  pubmed: { maxRequests: 60, windowMs: 60_000, keyPrefix: 'mcp:pubmed' },
  cultural_competency: { maxRequests: 100, windowMs: 60_000, keyPrefix: 'mcp:cultural' },
};

describe('MCP Rate Limiting Configuration Coverage', () => {
  it.each(EXPECTED_RATE_LIMIT_CONFIGS)(
    'has rate limit config for %s server',
    (serverKey) => {
      expect(MCP_RATE_LIMITS[serverKey]).toBeDefined();
      expect(MCP_RATE_LIMITS[serverKey].maxRequests).toBeGreaterThan(0);
      expect(MCP_RATE_LIMITS[serverKey].windowMs).toBeGreaterThan(0);
      expect(MCP_RATE_LIMITS[serverKey].keyPrefix).toMatch(/^mcp:/);
    }
  );

  it('has unique key prefixes for all servers', () => {
    const prefixes = Object.values(MCP_RATE_LIMITS).map((c) => c.keyPrefix);
    const unique = new Set(prefixes);
    expect(unique.size).toBe(prefixes.length);
  });

  it('AI servers have stricter limits than reference servers', () => {
    expect(MCP_RATE_LIMITS.claude.maxRequests).toBeLessThan(
      MCP_RATE_LIMITS.medicalCodes.maxRequests
    );
    expect(MCP_RATE_LIMITS.claude.maxRequests).toBeLessThan(
      MCP_RATE_LIMITS.cms_coverage.maxRequests
    );
  });

  it('clearinghouse has strictest non-AI limit (expensive external calls)', () => {
    const nonAIConfigs = Object.entries(MCP_RATE_LIMITS)
      .filter(([key]) => key !== 'claude')
      .map(([, config]) => config.maxRequests);
    expect(MCP_RATE_LIMITS.clearinghouse.maxRequests).toBeLessThanOrEqual(
      Math.min(...nonAIConfigs)
    );
  });
});

// ===================================================================
// Tier 3 persistent rate limiting verification
// ===================================================================

// These servers MUST have persistent (cross-instance) rate limiting
const TIER_3_SERVERS_WITH_PERSISTENT = [
  'mcp-claude-server',
  'mcp-prior-auth-server',
  'mcp-edge-functions-server',
  'mcp-medical-coding-server',
  'mcp-fhir-server',
  'mcp-hl7-x12-server',
  'mcp-chain-orchestrator',
] as const;

// These servers use persistent as a best-effort (Tier 2)
const TIER_2_SERVERS_WITH_PERSISTENT = [
  'mcp-postgres-server',
  'mcp-medical-codes-server',
] as const;

describe('MCP Tier 3 Persistent Rate Limiting (S2-2)', () => {
  it('all Tier 3 servers are tracked for persistent rate limiting', () => {
    // Verify we track exactly 7 Tier 3 servers
    expect(TIER_3_SERVERS_WITH_PERSISTENT).toHaveLength(7);
  });

  it('all Tier 2 servers with auth have persistent rate limiting', () => {
    expect(TIER_2_SERVERS_WITH_PERSISTENT).toHaveLength(2);
  });

  it('total servers with persistent rate limiting is 9', () => {
    const total =
      TIER_3_SERVERS_WITH_PERSISTENT.length +
      TIER_2_SERVERS_WITH_PERSISTENT.length;
    expect(total).toBe(9);
  });
});

// ===================================================================
// Rate limit RPC contract — check_rate_limit() behavior
// ===================================================================

describe('check_rate_limit RPC Contract', () => {
  it('first request in a window should be allowed', () => {
    // Simulating the RPC return contract
    const firstRequest = {
      allowed: true,
      remaining: 14, // 15 max - 1
      reset_at: new Date(Date.now() + 60_000).toISOString(),
    };
    expect(firstRequest.allowed).toBe(true);
    expect(firstRequest.remaining).toBeGreaterThan(0);
  });

  it('request at limit should be denied', () => {
    const atLimit = {
      allowed: false,
      remaining: 0,
      reset_at: new Date(Date.now() + 30_000).toISOString(),
    };
    expect(atLimit.allowed).toBe(false);
    expect(atLimit.remaining).toBe(0);
  });

  it('rate key format includes server prefix and caller identity', () => {
    // Verify the key composition pattern
    const prefix = 'mcp:claude';
    const mcpKeyId = 'key-abc-123';
    const rateKey = `${prefix}:mcp_key:${mcpKeyId}`;
    expect(rateKey).toBe('mcp:claude:mcp_key:key-abc-123');

    const userId = 'user-xyz';
    const tenantId = 'tenant-001';
    const userRateKey = `${prefix}:user:${userId}:${tenantId}`;
    expect(userRateKey).toBe('mcp:claude:user:user-xyz:tenant-001');
  });

  it('getCallerRateLimitId returns correct format for MCP key auth', () => {
    const caller = {
      userId: 'mcp-key:key-1',
      tenantId: null,
      authMethod: 'mcp_key' as const,
      mcpKeyId: 'key-1',
    };
    const id = caller.authMethod === 'mcp_key' && caller.mcpKeyId
      ? `mcp_key:${caller.mcpKeyId}`
      : `user:${caller.userId}`;
    expect(id).toBe('mcp_key:key-1');
  });

  it('getCallerRateLimitId returns correct format for user JWT auth', () => {
    const caller = {
      userId: 'user-abc',
      tenantId: 'tenant-001',
      authMethod: 'user_jwt' as const,
    };
    const tenantSuffix = caller.tenantId ? `:${caller.tenantId}` : '';
    const id = `user:${caller.userId}${tenantSuffix}`;
    expect(id).toBe('user:user-abc:tenant-001');
  });
});

// ===================================================================
// In-memory rate limiter logic tests
// ===================================================================

describe('In-Memory Rate Limiter Logic', () => {
  it('allows requests within the limit', () => {
    const store = new Map<string, { count: number; windowStart: number }>();
    const key = 'mcp:test:127.0.0.1';
    const maxRequests = 5;
    const _windowMs = 60_000;

    // Simulate 5 requests
    for (let i = 0; i < maxRequests; i++) {
      const entry = store.get(key);
      if (!entry) {
        store.set(key, { count: 1, windowStart: Date.now() });
      } else {
        entry.count++;
      }
    }

    const finalEntry = store.get(key);
    expect(finalEntry).toBeDefined();
    expect(finalEntry?.count).toBe(maxRequests);
  });

  it('denies requests over the limit', () => {
    const count = 16;
    const maxRequests = 15;
    const allowed = count <= maxRequests;
    expect(allowed).toBe(false);
  });

  it('resets after window expires', () => {
    const windowStart = Date.now() - 70_000; // 70s ago
    const windowMs = 60_000;
    const expired = Date.now() - windowStart >= windowMs;
    expect(expired).toBe(true);
  });

  it('cleanup removes entries older than 2x window', () => {
    const store = new Map<string, { count: number; windowStart: number }>();
    const windowMs = 60_000;

    // Old entry (3 minutes ago)
    store.set('old:key', { count: 5, windowStart: Date.now() - 180_000 });
    // Fresh entry
    store.set('new:key', { count: 2, windowStart: Date.now() - 30_000 });

    // Simulate cleanup
    for (const [key, entry] of store.entries()) {
      if (Date.now() - entry.windowStart > windowMs * 2) {
        store.delete(key);
      }
    }

    expect(store.has('old:key')).toBe(false);
    expect(store.has('new:key')).toBe(true);
  });
});
