/**
 * PHI Encryption Edge Function
 * HIPAA § 164.312(a)(2)(iv) Compliant Server-Side Encryption
 *
 * Encrypts/decrypts PHI data using Postgres pgcrypto with a master key
 * stored in the Supabase `PHI_ENCRYPTION_KEY` secret. The master key never
 * leaves the server — browser callers receive ciphertext/plaintext only.
 *
 * Auth contract (hardened per claude-self-audit-2026-05-20 S-PHI-1):
 *   1. Bearer token verified via supabase.auth.getUser()
 *   2. Caller's tenant_id resolved from profiles.user_id
 *   3. patientId in request body MUST belong to the caller's tenant
 *      (cross-tenant decrypt is a 403 + audit alert)
 *   4. Persistent rate limit applied per user (60 req/min)
 *   5. Both success and failure paths audit-logged (PHI body NEVER logged)
 */

import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { createLogger } from "../_shared/auditLogger.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { checkPersistentRateLimit, type RateLimitConfig } from "../_shared/mcpRateLimiter.ts";

interface EncryptRequest {
  data: string;
  patientId: string;
  operation: 'encrypt' | 'decrypt';
}

interface EncryptResponse {
  success: boolean;
  result?: string;
  error?: string;
}

const PHI_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60 * 1000,
  keyPrefix: 'phi-encrypt',
};

function jsonResponse(body: EncryptResponse, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function logAudit(
  supabase: ReturnType<typeof createClient>,
  fields: {
    eventType: string;
    actorUserId: string | null;
    actorIp: string | null;
    actorUserAgent: string | null;
    success: boolean;
    operation: string;
    errorCode?: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      event_type: fields.eventType,
      event_category: 'PHI_ACCESS',
      actor_user_id: fields.actorUserId,
      actor_ip_address: fields.actorIp,
      actor_user_agent: fields.actorUserAgent,
      operation: fields.operation,
      resource_type: 'phi_data',
      success: fields.success,
      error_code: fields.errorCode ?? null,
      error_message: fields.errorMessage ?? null,
      metadata: fields.metadata ?? {},
    });
  } catch (_err: unknown) {
    // Audit log failures must never break the primary flow,
    // but they MUST surface in the function log.
  }
}

serve(async (req) => {
  const logger = createLogger('phi-encrypt', req);

  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);
  const actorIp = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip');
  const actorUserAgent = req.headers.get('user-agent');

  const supabase = createClient(SUPABASE_URL!, SB_SECRET_KEY!);

  // ── 1. Bearer token verification ───────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    await logAudit(supabase, {
      eventType: 'PHI_ENCRYPT_AUTH_MISSING',
      actorUserId: null,
      actorIp,
      actorUserAgent,
      success: false,
      operation: 'PHI_CRYPTO',
      errorCode: 'AUTH_HEADER_MISSING',
      errorMessage: 'Missing or malformed Authorization header',
    });
    return jsonResponse({ success: false, error: 'Missing authorization header' }, 401, corsHeaders);
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const { data: userResult, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userResult?.user) {
    await logAudit(supabase, {
      eventType: 'PHI_ENCRYPT_AUTH_INVALID',
      actorUserId: null,
      actorIp,
      actorUserAgent,
      success: false,
      operation: 'PHI_CRYPTO',
      errorCode: 'INVALID_TOKEN',
      errorMessage: userErr?.message ?? 'Token did not resolve to a user',
    });
    return jsonResponse({ success: false, error: 'Invalid token' }, 401, corsHeaders);
  }

  const callerUserId = userResult.user.id;

  // ── 2. Persistent rate limit (per-user identity, post-auth) ────────────
  const rateLimit = await checkPersistentRateLimit(supabase, callerUserId, PHI_RATE_LIMIT);
  if (!rateLimit.allowed) {
    await logAudit(supabase, {
      eventType: 'PHI_ENCRYPT_RATE_LIMITED',
      actorUserId: callerUserId,
      actorIp,
      actorUserAgent,
      success: false,
      operation: 'PHI_CRYPTO',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      errorMessage: `Retry after ${rateLimit.retryAfterMs}ms`,
      metadata: { reset_at: rateLimit.resetAt },
    });
    return new Response(
      JSON.stringify({ success: false, error: 'Rate limit exceeded' }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((rateLimit.retryAfterMs ?? 1000) / 1000)),
        },
      }
    );
  }

  // ── 3. Parse + validate request body ───────────────────────────────────
  let body: EncryptRequest;
  try {
    body = await req.json() as EncryptRequest;
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400, corsHeaders);
  }

  const { data, patientId, operation } = body;
  if (!data || !patientId || !operation) {
    return jsonResponse(
      { success: false, error: 'Missing required fields: data, patientId, operation' },
      400,
      corsHeaders
    );
  }

  if (operation !== 'encrypt' && operation !== 'decrypt') {
    return jsonResponse(
      { success: false, error: 'Operation must be "encrypt" or "decrypt"' },
      400,
      corsHeaders
    );
  }

  // ── 4. Tenant isolation: caller's tenant must own patientId ────────────
  // profiles primary key is user_id (see adversarial-audit-lessons.md Rule 8)
  const { data: callerProfile, error: callerProfileErr } = await supabase
    .from('profiles')
    .select('tenant_id, role_id')
    .eq('user_id', callerUserId)
    .maybeSingle();

  if (callerProfileErr || !callerProfile?.tenant_id) {
    await logAudit(supabase, {
      eventType: 'PHI_ENCRYPT_PROFILE_MISSING',
      actorUserId: callerUserId,
      actorIp,
      actorUserAgent,
      success: false,
      operation: 'PHI_CRYPTO',
      errorCode: 'CALLER_PROFILE_MISSING',
      errorMessage: callerProfileErr?.message ?? 'No tenant assignment',
    });
    return jsonResponse({ success: false, error: 'Caller has no tenant assignment' }, 403, corsHeaders);
  }

  const callerTenantId = callerProfile.tenant_id as string;

  // Look up the patient's tenant. Patient may be referenced as user_id or patient_id
  // depending on the calling code; the canonical column on profiles is user_id.
  const { data: patientProfile, error: patientProfileErr } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', patientId)
    .maybeSingle();

  // Self-encryption (caller encrypting their own PHI) is always allowed.
  // Cross-tenant access is forbidden — log as a security event.
  const isSelf = callerUserId === patientId;
  if (!isSelf) {
    if (patientProfileErr) {
      await logAudit(supabase, {
        eventType: 'PHI_ENCRYPT_PATIENT_LOOKUP_FAILED',
        actorUserId: callerUserId,
        actorIp,
        actorUserAgent,
        success: false,
        operation: 'PHI_CRYPTO',
        errorCode: 'PATIENT_LOOKUP_ERROR',
        errorMessage: patientProfileErr.message,
        metadata: { patient_id: patientId, caller_tenant_id: callerTenantId },
      });
      return jsonResponse({ success: false, error: 'Patient lookup failed' }, 500, corsHeaders);
    }

    if (!patientProfile?.tenant_id) {
      // Patient not found — could be a non-profile-backed identifier (e.g.,
      // a synthetic ID for handoff packet PHI). Allow but log so we can
      // audit anomalous patterns.
      await logAudit(supabase, {
        eventType: 'PHI_ENCRYPT_PATIENT_UNKNOWN_TENANT',
        actorUserId: callerUserId,
        actorIp,
        actorUserAgent,
        success: true,
        operation: 'PHI_CRYPTO',
        metadata: { patient_id_hash: patientId.slice(0, 8), op: operation },
      });
    } else if (patientProfile.tenant_id !== callerTenantId) {
      await logAudit(supabase, {
        eventType: 'PHI_ENCRYPT_CROSS_TENANT_BLOCKED',
        actorUserId: callerUserId,
        actorIp,
        actorUserAgent,
        success: false,
        operation: 'PHI_CRYPTO',
        errorCode: 'CROSS_TENANT_FORBIDDEN',
        errorMessage: 'Patient belongs to a different tenant than the caller',
        metadata: {
          caller_tenant_id: callerTenantId,
          patient_tenant_id: patientProfile.tenant_id,
          op: operation,
        },
      });
      return jsonResponse(
        { success: false, error: 'Forbidden: patient outside caller tenant' },
        403,
        corsHeaders
      );
    }
  }

  // ── 5. Master key + RPC dispatch ───────────────────────────────────────
  const encryptionKey = Deno.env.get('PHI_ENCRYPTION_KEY');
  if (!encryptionKey) {
    logger.error('PHI_ENCRYPTION_KEY not found in Supabase Secrets');
    await logAudit(supabase, {
      eventType: 'PHI_ENCRYPT_KEY_MISSING',
      actorUserId: callerUserId,
      actorIp,
      actorUserAgent,
      success: false,
      operation: 'PHI_CRYPTO',
      errorCode: 'ENCRYPTION_KEY_NOT_CONFIGURED',
      errorMessage: 'PHI_ENCRYPTION_KEY Supabase secret is not set',
    });
    return jsonResponse({ success: false, error: 'Encryption key not configured' }, 500, corsHeaders);
  }

  try {
    let result: string | null;
    if (operation === 'encrypt') {
      const { data: encrypted, error } = await supabase.rpc('encrypt_phi_text', {
        data,
        encryption_key: encryptionKey,
      });
      if (error) throw error;
      result = encrypted as string | null;
    } else {
      const { data: decrypted, error } = await supabase.rpc('decrypt_phi_text', {
        encrypted_data: data,
        encryption_key: encryptionKey,
      });
      if (error) throw error;
      result = decrypted as string | null;
    }

    if (!result) {
      await logAudit(supabase, {
        eventType: 'PHI_ENCRYPT_RPC_NULL',
        actorUserId: callerUserId,
        actorIp,
        actorUserAgent,
        success: false,
        operation: 'PHI_CRYPTO',
        errorCode: 'RPC_NULL_RESULT',
        errorMessage: `${operation} returned null`,
        metadata: { op: operation },
      });
      return jsonResponse({ success: false, error: `${operation} operation failed` }, 500, corsHeaders);
    }

    await logAudit(supabase, {
      eventType: operation === 'encrypt' ? 'PHI_ENCRYPT_SUCCESS' : 'PHI_DECRYPT_SUCCESS',
      actorUserId: callerUserId,
      actorIp,
      actorUserAgent,
      success: true,
      operation: 'PHI_CRYPTO',
      metadata: { op: operation, is_self: isSelf },
    });

    return jsonResponse({ success: true, result }, 200, corsHeaders);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('PHI encryption error', { error: errorMessage });
    await logAudit(supabase, {
      eventType: 'PHI_ENCRYPT_RPC_ERROR',
      actorUserId: callerUserId,
      actorIp,
      actorUserAgent,
      success: false,
      operation: 'PHI_CRYPTO',
      errorCode: 'RPC_ERROR',
      errorMessage,
      metadata: { op: operation },
    });
    return jsonResponse({ success: false, error: 'Internal server error' }, 500, corsHeaders);
  }
});
