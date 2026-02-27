/**
 * MCP JWKS Verifier — Local JWT Verification for MCP Auth
 *
 * Verifies JWTs locally using the Supabase JWKS endpoint instead of
 * making a network round-trip to auth.getUser() on every MCP tool call.
 *
 * P1-1: Reduces 100-300ms latency per request and removes availability
 * dependency on the Supabase Auth service.
 *
 * Falls back to auth.getUser() if JWKS verification fails (graceful degradation).
 *
 * @module mcpJwksVerifier
 */

import { jwtVerify, createRemoteJWKSet } from "https://deno.land/x/jose@v5.2.0/index.ts";
import { SUPABASE_URL } from "./env.ts";
import type { EdgeFunctionLogger } from "./auditLogger.ts";

/** Result of a successful local JWT verification */
export interface JWKSVerifyResult {
  userId: string;
  email?: string;
  role?: string;
}

// Module-level JWKS key set cache — initialized once, reused across requests.
// jose's createRemoteJWKSet handles JWKS caching and rotation internally.
let jwksKeySet: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS(): ReturnType<typeof createRemoteJWKSet> {
  if (!jwksKeySet) {
    if (!SUPABASE_URL) {
      throw new Error("SUPABASE_URL required for JWKS verification");
    }
    jwksKeySet = createRemoteJWKSet(
      new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
    );
  }
  return jwksKeySet;
}

/**
 * Verify a JWT locally using the Supabase JWKS endpoint.
 *
 * This avoids a network round-trip to auth.getUser() for every request.
 * Returns null if verification fails (caller should fall back to auth.getUser).
 *
 * @param token - The JWT Bearer token to verify
 * @param logger - Logger instance for debug output
 * @returns Verified user identity or null if verification fails
 */
export async function verifyJWTLocally(
  token: string,
  logger: EdgeFunctionLogger
): Promise<JWKSVerifyResult | null> {
  try {
    const jwks = getJWKS();
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `${SUPABASE_URL}/auth/v1`
    });

    // sub claim is required — it's the user ID
    if (!payload.sub) {
      logger.debug("JWKS_VERIFY_MISSING_SUB", {
        hasPayload: true,
        claims: Object.keys(payload)
      });
      return null;
    }

    return {
      userId: payload.sub,
      email: payload.email as string | undefined,
      role: payload.role as string | undefined
    };
  } catch (err: unknown) {
    logger.debug("JWKS_VERIFICATION_FAILED", {
      error: err instanceof Error ? err.message : String(err)
    });
    return null;
  }
}
