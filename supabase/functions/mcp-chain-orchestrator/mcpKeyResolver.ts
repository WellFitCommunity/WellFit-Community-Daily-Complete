// ============================================================
// MCP Key Resolution — Per-Server Scoped Keys
//
// Maps chain step server names to scoped MCP keys.
// Falls back to service role key for graceful migration.
// ============================================================

import { SB_SECRET_KEY, SB_ANON_KEY } from "../_shared/env.ts";

/** Map edge function name → env var holding the scoped MCP key */
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

export interface MCPAuthHeaders {
  headers: Record<string, string>;
  usedScopedKey: boolean;
}

/**
 * Resolve auth headers for an outbound MCP server call.
 *
 * Prefers scoped MCP key (X-MCP-KEY header) over service role key.
 * Falls back to service role key if no scoped key is configured
 * (graceful migration — existing deployments continue working).
 */
export function resolveMCPAuth(serverName: string): MCPAuthHeaders {
  const envVarName = MCP_KEY_ENV_MAP[serverName];
  const denoGlobal = (globalThis as unknown as {
    Deno?: { env: { get: (k: string) => string | undefined } };
  }).Deno;
  const mcpKey = envVarName
    ? denoGlobal?.env?.get?.(envVarName)
    : undefined;

  if (mcpKey) {
    return {
      headers: {
        "X-MCP-KEY": mcpKey,
        apikey: SB_ANON_KEY || SB_SECRET_KEY,
      },
      usedScopedKey: true,
    };
  }

  // SECURITY: Never fall back to service role key.
  // A missing scoped key means the server is not configured for chain use.
  // Failing hard prevents privilege escalation via chain orchestrator.
  const envName = envVarName || `MCP_KEY_${serverName.replace(/^mcp-|-server$/g, '').replace(/-/g, '_').toUpperCase()}`;
  throw new Error(
    `MCP scoped key not configured for "${serverName}". ` +
    `Set the ${envName} environment variable in Supabase secrets. ` +
    `Chain execution cannot proceed without a scoped key.`
  );
}

/** Check if a server name has a known MCP key env var mapping */
export function hasKnownServer(serverName: string): boolean {
  return serverName in MCP_KEY_ENV_MAP;
}
