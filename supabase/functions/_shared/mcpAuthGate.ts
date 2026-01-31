/**
 * MCP Auth Gate - Enterprise Authorization for Admin-Tier MCP Servers
 *
 * Provides caller identity verification for MCP servers that require
 * admin-level access. The anon JWT alone is NOT sufficient for admin operations.
 *
 * Security Model:
 * - Tier A (external_api): No auth required, public APIs
 * - Tier B (user_scoped): ANON JWT + RLS is sufficient
 * - Tier C (admin): Requires valid user JWT + admin role verification
 *
 * This module implements the Tier C auth gate.
 *
 * @module mcpAuthGate
 */

import { createClient, SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SB_SECRET_KEY } from "./env.ts";
import { createLogger, EdgeFunctionLogger } from "./auditLogger.ts";

// Admin roles allowed for MCP admin operations
const ADMIN_ROLES = ["admin", "super_admin", "security_admin"] as const;
type AdminRole = typeof ADMIN_ROLES[number];

// Extended roles for clinical operations
const CLINICAL_ADMIN_ROLES = [
  ...ADMIN_ROLES,
  "nurse",
  "charge_nurse",
  "physician",
  "care_manager"
] as const;
type ClinicalRole = typeof CLINICAL_ADMIN_ROLES[number];

export interface CallerIdentity {
  userId: string;
  email: string | undefined;
  role: string;
  tenantId: string | null;
  requestId: string;
  authenticatedAt: string;
}

export interface AuthGateResult {
  authorized: boolean;
  caller?: CallerIdentity;
  error?: string;
  statusCode: number;
}

export interface AuthGateOptions {
  /** Server name for logging */
  serverName: string;
  /** Tool being called (for audit) */
  toolName?: string;
  /** Required roles (default: admin roles only) */
  allowedRoles?: readonly string[];
  /** Logger instance */
  logger?: EdgeFunctionLogger;
}

// Lazy-init admin client
let _adminClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient {
  if (!_adminClient) {
    if (!SUPABASE_URL || !SB_SECRET_KEY) {
      throw new Error("Missing SUPABASE_URL or SB_SECRET_KEY for auth gate");
    }
    _adminClient = createClient(SUPABASE_URL, SB_SECRET_KEY, {
      auth: { persistSession: false }
    });
  }
  return _adminClient;
}

/**
 * Extract request correlation ID from headers or generate one
 */
export function getRequestId(req: Request): string {
  return (
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    crypto.randomUUID()
  );
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return auth.slice(7).trim();
}

/**
 * Check if a token is the anon key (not a user JWT)
 * Anon keys are JWTs with role="anon" in the payload
 */
function isAnonKey(token: string): boolean {
  try {
    // Decode payload without verification (just to check role claim)
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    const payload = JSON.parse(atob(parts[1]));
    return payload.role === "anon";
  } catch {
    return false;
  }
}

/**
 * Verify admin access for MCP server operations
 *
 * This is the main auth gate for Tier C (admin) MCP servers.
 * It verifies:
 * 1. A valid Bearer token is present (not the anon key)
 * 2. The token represents a valid authenticated user
 * 3. The user has an admin role in the profiles table
 *
 * @param req - The incoming request
 * @param options - Auth gate options
 * @returns AuthGateResult with caller identity or error
 *
 * @example
 * const authResult = await verifyAdminAccess(req, {
 *   serverName: "mcp-prior-auth-server",
 *   toolName: "create_prior_auth"
 * });
 * if (!authResult.authorized) {
 *   return new Response(JSON.stringify({ error: authResult.error }), {
 *     status: authResult.statusCode
 *   });
 * }
 * // Use authResult.caller for audit logging
 */
export async function verifyAdminAccess(
  req: Request,
  options: AuthGateOptions
): Promise<AuthGateResult> {
  const requestId = getRequestId(req);
  const logger = options.logger || createLogger(options.serverName, req);
  const allowedRoles = options.allowedRoles || ADMIN_ROLES;

  // Step 1: Extract token
  const token = extractBearerToken(req);
  if (!token) {
    logger.security("MCP_AUTH_GATE_FAILED", {
      requestId,
      reason: "missing_bearer_token",
      server: options.serverName,
      tool: options.toolName
    });
    return {
      authorized: false,
      error: "Missing Authorization header with Bearer token",
      statusCode: 401
    };
  }

  // Step 2: Reject anon key (not sufficient for admin operations)
  if (isAnonKey(token)) {
    logger.security("MCP_AUTH_GATE_REJECTED_ANON", {
      requestId,
      reason: "anon_key_insufficient",
      server: options.serverName,
      tool: options.toolName
    });
    return {
      authorized: false,
      error: "Admin operations require authenticated user token, not anon key",
      statusCode: 403
    };
  }

  // Step 3: Verify token with Supabase Auth
  let user: User;
  try {
    const adminClient = getAdminClient();
    const { data, error } = await adminClient.auth.getUser(token);

    if (error || !data?.user) {
      logger.security("MCP_AUTH_GATE_INVALID_TOKEN", {
        requestId,
        reason: "token_verification_failed",
        error: error?.message,
        server: options.serverName,
        tool: options.toolName
      });
      return {
        authorized: false,
        error: "Invalid or expired authentication token",
        statusCode: 401
      };
    }
    user = data.user;
  } catch (err) {
    logger.error("MCP_AUTH_GATE_ERROR", {
      requestId,
      error: err instanceof Error ? err.message : String(err),
      server: options.serverName
    });
    return {
      authorized: false,
      error: "Authentication service error",
      statusCode: 500
    };
  }

  // Step 4: Look up user role from profiles table
  let roleName: string | null = null;
  let tenantId: string | null = null;
  try {
    const adminClient = getAdminClient();
    const { data: profile, error } = await adminClient
      .from("profiles")
      .select("role_id, tenant_id, roles:role_id ( id, name )")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      logger.error("MCP_AUTH_GATE_PROFILE_ERROR", {
        requestId,
        userId: user.id,
        error: error.message,
        server: options.serverName
      });
      return {
        authorized: false,
        error: "Failed to verify user role",
        statusCode: 500
      };
    }

    // Handle joined roles table result (returns array from join)
    const rolesArray = profile?.roles as unknown as Array<{ id: string; name: string }> | null;
    const rolesData = Array.isArray(rolesArray) ? rolesArray[0] : null;
    roleName = rolesData?.name ?? null;
    tenantId = profile?.tenant_id ?? null;
  } catch (err) {
    logger.error("MCP_AUTH_GATE_ROLE_ERROR", {
      requestId,
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
      server: options.serverName
    });
    return {
      authorized: false,
      error: "Role verification error",
      statusCode: 500
    };
  }

  // Step 5: Check if role is in allowed list
  if (!roleName || !allowedRoles.includes(roleName)) {
    logger.security("MCP_AUTH_GATE_INSUFFICIENT_ROLE", {
      requestId,
      userId: user.id,
      role: roleName,
      requiredRoles: [...allowedRoles],
      server: options.serverName,
      tool: options.toolName
    });
    return {
      authorized: false,
      error: `Insufficient privileges. Required role: ${allowedRoles.join(" or ")}`,
      statusCode: 403
    };
  }

  // Success - build caller identity
  const caller: CallerIdentity = {
    userId: user.id,
    email: user.email,
    role: roleName,
    tenantId,
    requestId,
    authenticatedAt: new Date().toISOString()
  };

  logger.security("MCP_AUTH_GATE_SUCCESS", {
    requestId,
    userId: user.id,
    role: roleName,
    tenantId,
    server: options.serverName,
    tool: options.toolName
  });

  return {
    authorized: true,
    caller,
    statusCode: 200
  };
}

/**
 * Verify clinical access (broader role set for healthcare operations)
 *
 * Same as verifyAdminAccess but allows clinical roles in addition to admin roles.
 */
export async function verifyClinicalAccess(
  req: Request,
  options: Omit<AuthGateOptions, "allowedRoles">
): Promise<AuthGateResult> {
  return verifyAdminAccess(req, {
    ...options,
    allowedRoles: CLINICAL_ADMIN_ROLES
  });
}

/**
 * Create a 403 Forbidden JSON-RPC response for MCP
 */
export function createForbiddenResponse(
  error: string,
  requestId: string,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: error,
        data: { requestId }
      },
      id: null
    }),
    {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}

/**
 * Create a 401 Unauthorized JSON-RPC response for MCP
 */
export function createUnauthorizedResponse(
  error: string,
  requestId: string,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: error,
        data: { requestId }
      },
      id: null
    }),
    {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}

export { ADMIN_ROLES, CLINICAL_ADMIN_ROLES };
export type { AdminRole, ClinicalRole };
