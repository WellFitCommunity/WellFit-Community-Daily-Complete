/**
 * MCP Key Resolver — Unit Tests
 *
 * Tests per-server scoped key resolution for chain orchestrator:
 * - Known servers resolve to scoped key env vars
 * - Scoped keys use X-MCP-KEY header
 * - Hard failure when no scoped key configured (no service role fallback)
 * - Unknown servers throw error (no silent fallback)
 * - Auth method tracking (scoped vs service_role)
 */

// ============================================================
// Replicate resolver logic for testability
// (Same logic as mcpKeyResolver.ts — kept in sync)
// ============================================================

const MCP_KEY_ENV_MAP: Record<string, string> = {
  "mcp-claude-server": "MCP_KEY_CLAUDE",
  "mcp-fhir-server": "MCP_KEY_FHIR",
  "mcp-hl7-x12-server": "MCP_KEY_HL7_X12",
  "mcp-clearinghouse-server": "MCP_KEY_CLEARINGHOUSE",
  "mcp-prior-auth-server": "MCP_KEY_PRIOR_AUTH",
  "mcp-npi-registry-server": "MCP_KEY_NPI_REGISTRY",
  "mcp-cms-coverage-server": "MCP_KEY_CMS_COVERAGE",
  "mcp-postgres-server": "MCP_KEY_POSTGRES",
  "mcp-edge-functions-server": "MCP_KEY_EDGE_FUNCTIONS",
  "mcp-medical-codes-server": "MCP_KEY_MEDICAL_CODES",
  "mcp-pubmed-server": "MCP_KEY_PUBMED",
  "mcp-cultural-competency-server": "MCP_KEY_CULTURAL_COMPETENCY",
  "mcp-medical-coding-server": "MCP_KEY_MEDICAL_CODING",
};

interface MCPAuthHeaders {
  headers: Record<string, string>;
  usedScopedKey: boolean;
}

function resolveMCPAuth(
  serverName: string,
  envLookup: (key: string) => string | undefined,
  fallbackKey: string,
  anonKey: string
): MCPAuthHeaders {
  const envVarName = MCP_KEY_ENV_MAP[serverName];
  const mcpKey = envVarName ? envLookup(envVarName) : undefined;

  if (mcpKey) {
    return {
      headers: {
        "X-MCP-KEY": mcpKey,
        apikey: anonKey || fallbackKey,
      },
      usedScopedKey: true,
    };
  }

  // SECURITY: Never fall back to service role key.
  const envName = envVarName || `MCP_KEY_${serverName.replace(/^mcp-|-server$/g, '').replace(/-/g, '_').toUpperCase()}`;
  throw new Error(
    `MCP scoped key not configured for "${serverName}". ` +
    `Set the ${envName} environment variable in Supabase secrets. ` +
    `Chain execution cannot proceed without a scoped key.`
  );
}

function hasKnownServer(serverName: string): boolean {
  return serverName in MCP_KEY_ENV_MAP;
}

// ============================================================
// Tests
// ============================================================

describe('MCP Key Resolver', () => {
  const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-service-role';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon';
  const SCOPED_KEY = 'mcp_bbf40dae020e65f4fb11d715a84e1083';

  describe('resolveMCPAuth', () => {
    it('should use scoped MCP key when available', () => {
      const envLookup = (key: string) =>
        key === 'MCP_KEY_FHIR' ? SCOPED_KEY : undefined;

      const result = resolveMCPAuth('mcp-fhir-server', envLookup, SERVICE_ROLE_KEY, ANON_KEY);

      expect(result.usedScopedKey).toBe(true);
      expect(result.headers['X-MCP-KEY']).toBe(SCOPED_KEY);
      expect(result.headers['apikey']).toBe(ANON_KEY);
      expect(result.headers['Authorization']).toBeUndefined();
    });

    it('should throw error when no scoped key is set (never fall back to service role)', () => {
      const envLookup = () => undefined;

      expect(() =>
        resolveMCPAuth('mcp-fhir-server', envLookup, SERVICE_ROLE_KEY, ANON_KEY)
      ).toThrow('MCP scoped key not configured for "mcp-fhir-server"');
    });

    it('should throw error for unknown server names', () => {
      const envLookup = () => 'mcp_some_key';

      expect(() =>
        resolveMCPAuth('unknown-server', envLookup, SERVICE_ROLE_KEY, ANON_KEY)
      ).toThrow('MCP scoped key not configured for "unknown-server"');
    });

    it('should resolve all 13 known MCP servers to env var names', () => {
      const expectedMappings: Record<string, string> = {
        "mcp-claude-server": "MCP_KEY_CLAUDE",
        "mcp-fhir-server": "MCP_KEY_FHIR",
        "mcp-hl7-x12-server": "MCP_KEY_HL7_X12",
        "mcp-clearinghouse-server": "MCP_KEY_CLEARINGHOUSE",
        "mcp-prior-auth-server": "MCP_KEY_PRIOR_AUTH",
        "mcp-npi-registry-server": "MCP_KEY_NPI_REGISTRY",
        "mcp-cms-coverage-server": "MCP_KEY_CMS_COVERAGE",
        "mcp-postgres-server": "MCP_KEY_POSTGRES",
        "mcp-edge-functions-server": "MCP_KEY_EDGE_FUNCTIONS",
        "mcp-medical-codes-server": "MCP_KEY_MEDICAL_CODES",
        "mcp-pubmed-server": "MCP_KEY_PUBMED",
        "mcp-cultural-competency-server": "MCP_KEY_CULTURAL_COMPETENCY",
        "mcp-medical-coding-server": "MCP_KEY_MEDICAL_CODING",
      };

      for (const [server, envVar] of Object.entries(expectedMappings)) {
        const testKey = `mcp_test_${envVar.toLowerCase()}`;
        const envLookup = (key: string) =>
          key === envVar ? testKey : undefined;

        const result = resolveMCPAuth(server, envLookup, SERVICE_ROLE_KEY, ANON_KEY);
        expect(result.usedScopedKey).toBe(true);
        expect(result.headers['X-MCP-KEY']).toBe(testKey);
      }
    });

    it('should use anon key as apikey when scoped key is used', () => {
      const envLookup = (key: string) =>
        key === 'MCP_KEY_CLAUDE' ? SCOPED_KEY : undefined;

      const result = resolveMCPAuth('mcp-claude-server', envLookup, SERVICE_ROLE_KEY, ANON_KEY);

      expect(result.headers['apikey']).toBe(ANON_KEY);
    });

    it('should fall back apikey to service role key when anon key is empty', () => {
      const envLookup = (key: string) =>
        key === 'MCP_KEY_FHIR' ? SCOPED_KEY : undefined;

      const result = resolveMCPAuth('mcp-fhir-server', envLookup, SERVICE_ROLE_KEY, '');

      expect(result.headers['apikey']).toBe(SERVICE_ROLE_KEY);
    });
  });

  describe('hasKnownServer', () => {
    it('should return true for all 13 known servers', () => {
      const knownServers = [
        'mcp-claude-server', 'mcp-fhir-server', 'mcp-hl7-x12-server',
        'mcp-clearinghouse-server', 'mcp-prior-auth-server',
        'mcp-npi-registry-server', 'mcp-cms-coverage-server',
        'mcp-postgres-server', 'mcp-edge-functions-server',
        'mcp-medical-codes-server', 'mcp-pubmed-server',
        'mcp-cultural-competency-server', 'mcp-medical-coding-server',
      ];

      for (const server of knownServers) {
        expect(hasKnownServer(server)).toBe(true);
      }
    });

    it('should return false for unknown server names', () => {
      expect(hasKnownServer('unknown-server')).toBe(false);
      expect(hasKnownServer('mcp-chain-orchestrator')).toBe(false);
      expect(hasKnownServer('')).toBe(false);
    });
  });

  describe('Security properties', () => {
    it('should never include service role key in X-MCP-KEY header (throws instead)', () => {
      const envLookup = () => undefined;

      // Without a scoped key, the resolver throws — it never puts the service role key anywhere
      expect(() =>
        resolveMCPAuth('mcp-fhir-server', envLookup, SERVICE_ROLE_KEY, ANON_KEY)
      ).toThrow('MCP scoped key not configured');
    });

    it('should never include scoped key in Authorization header', () => {
      const envLookup = (key: string) =>
        key === 'MCP_KEY_FHIR' ? SCOPED_KEY : undefined;

      const result = resolveMCPAuth('mcp-fhir-server', envLookup, SERVICE_ROLE_KEY, ANON_KEY);

      expect(result.headers['Authorization']).toBeUndefined();
    });

    it('should track auth method for audit logging', () => {
      const withKey = resolveMCPAuth(
        'mcp-fhir-server',
        (k) => k === 'MCP_KEY_FHIR' ? SCOPED_KEY : undefined,
        SERVICE_ROLE_KEY,
        ANON_KEY
      );
      expect(withKey.usedScopedKey).toBe(true);

      // Without a scoped key, resolver throws (never returns usedScopedKey: false)
      expect(() =>
        resolveMCPAuth('mcp-fhir-server', () => undefined, SERVICE_ROLE_KEY, ANON_KEY)
      ).toThrow('MCP scoped key not configured');
    });
  });
});
