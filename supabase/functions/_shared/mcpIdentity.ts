/**
 * MCP Identity Extraction — Tenant ID from Caller, Not Tool Args
 *
 * Extracts caller identity (including tenant_id) from the request authentication,
 * rather than trusting user-supplied tool arguments. This prevents cross-tenant
 * data access via crafted tool calls.
 *
 * Created as a separate module because mcpAuthGate.ts is at 596 lines (near 600-line limit).
 *
 * @module mcpIdentity
 */

import {
  verifyAdminAccess,
  type CallerIdentity,
  type AuthGateResult,
} from "./mcpAuthGate.ts";
import { createLogger, type EdgeFunctionLogger } from "./auditLogger.ts";

/**
 * All MCP-relevant roles — used to extract identity without role enforcement.
 * Role enforcement is handled separately by the auth gate at the tool level.
 */
const ALL_MCP_ROLES = [
  "admin",
  "super_admin",
  "security_admin",
  "nurse",
  "charge_nurse",
  "physician",
  "care_manager",
  "member",
  "caregiver",
  "staff",
  "mcp_service",
] as const;

export interface IdentityExtractionOptions {
  serverName: string;
  toolName?: string;
  logger?: EdgeFunctionLogger;
}

/**
 * Extract caller identity from request authentication without role enforcement.
 *
 * Returns the caller's identity (userId, tenantId, role, etc.) if authenticated,
 * or null if authentication fails. Does NOT enforce any particular role — that
 * should be done by the server's auth gate.
 *
 * @param req - The incoming HTTP request
 * @param options - Server name and optional logger
 * @returns CallerIdentity or null if unauthenticated
 */
export async function extractCallerIdentity(
  req: Request,
  options: IdentityExtractionOptions
): Promise<CallerIdentity | null> {
  const logger = options.logger || createLogger(options.serverName);

  const result: AuthGateResult = await verifyAdminAccess(req, {
    serverName: options.serverName,
    toolName: options.toolName,
    allowedRoles: ALL_MCP_ROLES,
    logger,
  });

  return result.authorized && result.caller ? result.caller : null;
}

/**
 * Resolve the effective tenant_id for a tool call.
 *
 * Priority:
 * 1. Caller's identity tenant_id (from JWT or MCP key) — authoritative
 * 2. Tool args tenant_id — fallback for MCP key auth without tenant binding
 *
 * If both exist and differ, logs a TENANT_MISMATCH_REJECTED security event
 * and uses the identity's tenant (the safe choice).
 *
 * @param caller - The authenticated caller identity (or null)
 * @param argsTenantId - The tenant_id from tool arguments
 * @param logger - Logger instance
 * @param requestId - Request correlation ID
 * @returns The resolved tenant_id, or undefined if neither source has one
 */
export function resolveTenantId(
  caller: CallerIdentity | null,
  argsTenantId: string | undefined,
  logger: EdgeFunctionLogger,
  requestId: string
): string | undefined {
  const identityTenantId = caller?.tenantId ?? undefined;

  // Case 1: Identity has a tenant — always use it
  if (identityTenantId) {
    if (argsTenantId && argsTenantId !== identityTenantId) {
      logger.security("TENANT_MISMATCH_REJECTED", {
        requestId,
        identityTenantId,
        argsTenantId,
        userId: caller?.userId,
        authMethod: caller?.authMethod,
        resolution: "using_identity_tenant",
      });
    }
    return identityTenantId;
  }

  // Case 2: No identity tenant (e.g., MCP key without tenant binding)
  // Fall back to args, but log a warning
  if (argsTenantId) {
    logger.warn("TENANT_FROM_ARGS_FALLBACK", {
      requestId,
      argsTenantId,
      userId: caller?.userId,
      authMethod: caller?.authMethod,
      reason: "identity_has_no_tenant",
    });
    return argsTenantId;
  }

  // Case 3: No tenant from either source
  return undefined;
}
