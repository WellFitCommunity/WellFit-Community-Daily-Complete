/**
 * MCP Auth Gate - Enterprise Authorization for Admin-Tier MCP Servers
 *
 * Provides caller identity verification for MCP servers that require
 * admin-level access. The anon JWT alone is NOT sufficient for admin operations.
 *
 * Security Model:
 * - Tier A (external_api): No auth required, public APIs
 * - Tier B (user_scoped): ANON JWT + RLS is sufficient
 * - Tier C (admin): Requires EITHER:
 *   - Valid user JWT + admin role verification, OR
 *   - Valid X-MCP-KEY with appropriate scope
 *
 * This module implements the Tier C auth gate with dual auth paths:
 * 1. User JWT - For interactive user sessions
 * 2. X-MCP-KEY - For machine-to-machine integrations (Claude Desktop, CI/CD, etc.)
 *
 * @module mcpAuthGate
 */

import { createClient, SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SB_SECRET_KEY } from "./env.ts";
import { createLogger, EdgeFunctionLogger } from "./auditLogger.ts";

// Crypto for key hashing
const encoder = new TextEncoder();

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
  /** Auth method: 'user_jwt' or 'mcp_key' */
  authMethod: "user_jwt" | "mcp_key";
  /** For MCP key auth: the key ID and name */
  mcpKeyId?: string;
  mcpKeyName?: string;
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
  /** Required MCP key scope (e.g., 'mcp:admin', 'mcp:fhir') */
  requiredScope?: string;
}

/** MCP Key validation result from database */
interface MCPKeyValidationResult {
  valid: boolean;
  key_id: string | null;
  key_name: string | null;
  scopes: string[] | null;
  tenant_id: string | null;
  error_reason: string | null;
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
 * Extract X-MCP-KEY header value
 */
function extractMCPKey(req: Request): string | null {
  return req.headers.get("x-mcp-key") || null;
}

/**
 * Compute SHA-256 hash of a string (for key validation)
 */
async function sha256Hash(input: string): Promise<string> {
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Validate an MCP key against the database
 */
async function validateMCPKey(
  key: string,
  requiredScope: string | undefined,
  logger: EdgeFunctionLogger,
  requestId: string,
  serverName: string,
  toolName?: string
): Promise<{ valid: boolean; keyId?: string; keyName?: string; scopes?: string[]; tenantId?: string | null; error?: string }> {
  try {
    // Extract prefix (first 12 chars) and compute hash
    const prefix = key.substring(0, 12);
    const hash = await sha256Hash(key);

    const adminClient = getAdminClient();

    // Call the validation function
    const { data, error } = await adminClient.rpc("validate_mcp_key", {
      p_key_prefix: prefix,
      p_key_hash: hash,
      p_required_scope: requiredScope || null
    });

    if (error) {
      logger.error("MCP_KEY_VALIDATION_DB_ERROR", {
        requestId,
        error: error.message,
        server: serverName
      });
      return { valid: false, error: "Key validation failed" };
    }

    // Result is an array with one row
    const result = (data as MCPKeyValidationResult[])?.[0];
    if (!result) {
      return { valid: false, error: "Key validation failed" };
    }

    if (!result.valid) {
      // Log the audit entry for failed validation
      await adminClient.from("mcp_key_audit_log").insert({
        key_id: result.key_id,
        key_prefix: prefix,
        request_id: requestId,
        server_name: serverName,
        tool_name: toolName,
        outcome: result.error_reason === "scope_mismatch" ? "scope_mismatch" :
                 result.error_reason === "key_expired" ? "expired" :
                 result.error_reason === "key_revoked" ? "revoked" : "denied",
        error_message: result.error_reason
      });

      logger.security("MCP_KEY_VALIDATION_FAILED", {
        requestId,
        keyPrefix: prefix,
        reason: result.error_reason,
        server: serverName,
        tool: toolName
      });

      return {
        valid: false,
        keyId: result.key_id ?? undefined,
        error: result.error_reason === "key_not_found" ? "Invalid MCP key" :
               result.error_reason === "key_revoked" ? "MCP key has been revoked" :
               result.error_reason === "key_expired" ? "MCP key has expired" :
               result.error_reason === "scope_mismatch" ? `MCP key lacks required scope: ${requiredScope}` :
               "Key validation failed"
      };
    }

    // Log successful validation
    await adminClient.from("mcp_key_audit_log").insert({
      key_id: result.key_id,
      key_prefix: prefix,
      request_id: requestId,
      server_name: serverName,
      tool_name: toolName,
      outcome: "success"
    });

    return {
      valid: true,
      keyId: result.key_id ?? undefined,
      keyName: result.key_name ?? undefined,
      scopes: result.scopes ?? undefined,
      tenantId: result.tenant_id
    };
  } catch (err) {
    logger.error("MCP_KEY_VALIDATION_ERROR", {
      requestId,
      error: err instanceof Error ? err.message : String(err),
      server: serverName
    });
    return { valid: false, error: "Key validation error" };
  }
}

/**
 * Verify admin access for MCP server operations
 *
 * This is the main auth gate for Tier C (admin) MCP servers.
 * It supports TWO authentication methods:
 *
 * 1. X-MCP-KEY header (machine-to-machine) - Validated against mcp_keys table
 * 2. Bearer token (user session) - Validated against Supabase Auth + profiles
 *
 * The X-MCP-KEY method is checked first for machine-to-machine integrations
 * (Claude Desktop, CI/CD pipelines, etc.). If not present, falls back to
 * Bearer token authentication.
 *
 * @param req - The incoming request
 * @param options - Auth gate options
 * @returns AuthGateResult with caller identity or error
 *
 * @example
 * const authResult = await verifyAdminAccess(req, {
 *   serverName: "mcp-prior-auth-server",
 *   toolName: "create_prior_auth",
 *   requiredScope: "mcp:admin"  // For X-MCP-KEY validation
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

  // =====================================================
  // AUTH PATH 1: X-MCP-KEY (Machine-to-Machine)
  // =====================================================
  const mcpKey = extractMCPKey(req);
  if (mcpKey) {
    // Validate MCP key format (must start with mcp_)
    if (!mcpKey.startsWith("mcp_")) {
      logger.security("MCP_KEY_INVALID_FORMAT", {
        requestId,
        reason: "invalid_prefix",
        server: options.serverName,
        tool: options.toolName
      });
      return {
        authorized: false,
        error: "Invalid MCP key format",
        statusCode: 401
      };
    }

    // Validate key against database
    const keyResult = await validateMCPKey(
      mcpKey,
      options.requiredScope,
      logger,
      requestId,
      options.serverName,
      options.toolName
    );

    if (!keyResult.valid) {
      return {
        authorized: false,
        error: keyResult.error || "MCP key validation failed",
        statusCode: keyResult.error?.includes("lacks required scope") ? 403 : 401
      };
    }

    // Success with MCP key - build caller identity
    const caller: CallerIdentity = {
      userId: `mcp-key:${keyResult.keyId}`,
      email: undefined,
      role: "mcp_service",  // Special role for MCP key auth
      tenantId: keyResult.tenantId ?? null,
      requestId,
      authenticatedAt: new Date().toISOString(),
      authMethod: "mcp_key",
      mcpKeyId: keyResult.keyId,
      mcpKeyName: keyResult.keyName
    };

    logger.security("MCP_AUTH_GATE_SUCCESS_KEY", {
      requestId,
      keyId: keyResult.keyId,
      keyName: keyResult.keyName,
      scopes: keyResult.scopes,
      tenantId: keyResult.tenantId,
      server: options.serverName,
      tool: options.toolName
    });

    return {
      authorized: true,
      caller,
      statusCode: 200
    };
  }

  // =====================================================
  // AUTH PATH 2: Bearer Token (User Session)
  // =====================================================

  // Step 1: Extract token
  const token = extractBearerToken(req);
  if (!token) {
    logger.security("MCP_AUTH_GATE_FAILED", {
      requestId,
      reason: "missing_auth",
      server: options.serverName,
      tool: options.toolName
    });
    return {
      authorized: false,
      error: "Missing authentication. Provide X-MCP-KEY header or Authorization Bearer token.",
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
      error: "Admin operations require authenticated user token or X-MCP-KEY, not anon key",
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
    authenticatedAt: new Date().toISOString(),
    authMethod: "user_jwt"
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
