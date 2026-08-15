/**
 * publicHealthGate.ts — Wave-0 shared gates (external-audit remediation S3)
 *
 * Two gates that were missing alongside requireUser / requirePatientAccess /
 * mcpAuthGate:
 *
 * 1. `isInternalServiceCaller(req)` — MACHINE/INTEGRATION IDENTITY.
 *    True only for server-to-server callers presenting the platform secret
 *    (Bearer == SB_SECRET_KEY) or the internal webhook secret
 *    (x-internal-secret == INTERNAL_SECRET). This is the canonical version of
 *    the check emergency-alert-dispatch does inline (S2) — later waves (A-4
 *    hl7-receive, A-6 orchestrator sweep) adopt this instead of hand-rolling.
 *
 * 2. `requirePublicHealthIntegrationAccess(req, requestedTenantId)` — the A-2
 *    boundary for the public-health submitter trio (ecr-submit,
 *    immunization-registry-submit, syndromic-surveillance-submit):
 *    verify JWT → resolve profile → derive tenant from the CALLER's profile →
 *    authorize a public-health-capable role → reject client tenant mismatch.
 *    The body's tenantId is honored only for super_admin and for verified
 *    internal service callers (cron/integration pipelines, which have no
 *    profile row).
 *
 * Throws `Response` objects (401/403/400) in the established _shared/auth.ts
 * style so callers can re-emit them with their own CORS headers.
 */

import { requireUser, requireRole, supabaseAdmin } from './auth.ts';

/**
 * Roles allowed to push data to public-health registries. Mirrors the S2
 * clinical sets: reporting is performed by clinical staff and admins — never
 * seniors/patients/caregivers.
 */
export const PUBLIC_HEALTH_ROLES = [
  'admin', 'super_admin', 'physician', 'doctor', 'nurse',
  'nurse_practitioner', 'physician_assistant', 'clinical_supervisor',
  'department_head', 'case_manager',
];

export interface PublicHealthCaller {
  kind: 'service' | 'user';
  /** auth.users.id for user callers; null for machine callers */
  callerId: string | null;
  /** roles.name for user callers; 'service' for machine callers */
  role: string;
  /** The tenant every downstream query MUST be scoped to */
  tenantId: string;
}

/** Machine/integration identity — platform secret or internal webhook secret. */
export function isInternalServiceCaller(req: Request): boolean {
  const secretKey = Deno.env.get('SB_SECRET_KEY') ??
    Deno.env.get('SB_SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const internalSecret = Deno.env.get('INTERNAL_SECRET') ?? '';
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return (
    (!!secretKey && bearer === secretKey) ||
    (!!internalSecret && (req.headers.get('x-internal-secret') || '') === internalSecret)
  );
}

const deny = (status: number, error: string): Response =>
  new Response(JSON.stringify({ success: false, error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * A-2 shared boundary. Returns the authorized caller with the tenant that all
 * downstream queries must be scoped to. Throws Response(401/403/400).
 */
export async function requirePublicHealthIntegrationAccess(
  req: Request,
  requestedTenantId: string | undefined,
): Promise<PublicHealthCaller> {
  // Machine callers (cron / integration pipelines) have no profile — the
  // requested tenant is their operating scope and is required.
  if (isInternalServiceCaller(req)) {
    if (!requestedTenantId) {
      throw deny(400, 'tenantId is required for service callers');
    }
    return { kind: 'service', callerId: null, role: 'service', tenantId: requestedTenantId };
  }

  // User callers: verified JWT (401) + public-health role (403).
  const user = await requireUser(req);
  const role = await requireRole(user.id, PUBLIC_HEALTH_ROLES);

  // Tenant comes from the CALLER's profile, never from the body.
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data?.tenant_id) {
    throw deny(403, 'Caller tenant could not be resolved');
  }
  const callerTenant = data.tenant_id as string;

  if (role !== 'super_admin' && requestedTenantId && requestedTenantId !== callerTenant) {
    throw deny(403, 'Forbidden: tenant mismatch');
  }

  const tenantId = role === 'super_admin' && requestedTenantId ? requestedTenantId : callerTenant;
  return { kind: 'user', callerId: user.id, role, tenantId };
}
