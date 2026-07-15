-- Fix: admin_usage_tracking inserts 403 since ~2026-01-02.
-- The client (userBehaviorTracking.ts) omits tenant_id; the tenant-isolation
-- policy's implicit WITH CHECK (tenant_id = get_current_tenant_id() AND is_tenant_admin())
-- rejects NULL tenant_id rows. Self-populate tenant_id at the DB so callers
-- never have to send it.

-- 1. Default tenant_id from the caller's JWT-resolved tenant
ALTER TABLE public.admin_usage_tracking
  ALTER COLUMN tenant_id SET DEFAULT get_current_tenant_id();

-- 2. Backfill the pre-policy rows (154 NULL-tenant rows as of 2026-07-15)
--    from each row's owning profile. Rows whose user has no profile stay NULL
--    (still readable via the admin_select policy).
UPDATE public.admin_usage_tracking aut
SET tenant_id = p.tenant_id
FROM public.profiles p
WHERE aut.tenant_id IS NULL
  AND p.user_id = aut.user_id;

-- 3. anon has no business writing usage telemetry (RLS already blocks it;
--    this removes the unnecessary grant surface)
REVOKE INSERT ON public.admin_usage_tracking FROM anon;
