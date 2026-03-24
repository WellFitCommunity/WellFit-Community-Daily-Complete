-- Fix passkey system security issues:
-- 1. Add SET search_path = public to SECURITY DEFINER function (Supabase security advisor requirement)
-- 2. Add tenant_id to passkey_credentials for multi-tenant isolation

-- P2-1: Fix SECURITY DEFINER function missing search_path
ALTER FUNCTION cleanup_expired_passkey_challenges() SET search_path = public;

-- P2-2: Add tenant_id to passkey_credentials
-- Every multi-tenant table requires tenant_id — passkeys are not an exception.
ALTER TABLE public.passkey_credentials
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Backfill tenant_id from profiles table for existing credentials
UPDATE public.passkey_credentials pc
SET tenant_id = p.tenant_id
FROM public.profiles p
WHERE pc.user_id = p.user_id
  AND pc.tenant_id IS NULL;

-- Now make it NOT NULL (after backfill)
-- Only if all rows have been backfilled; if any remain NULL, this will fail safely
ALTER TABLE public.passkey_credentials
  ALTER COLUMN tenant_id SET NOT NULL;

-- Add index for tenant isolation queries
CREATE INDEX IF NOT EXISTS idx_passkey_credentials_tenant_id
  ON public.passkey_credentials(tenant_id);

-- Update RLS policy to include tenant isolation
-- Drop existing policy first if it exists
DROP POLICY IF EXISTS "Users can manage own passkeys" ON public.passkey_credentials;

-- Create new policy with tenant + user isolation
CREATE POLICY "Users can manage own passkeys" ON public.passkey_credentials
  FOR ALL
  USING (user_id = auth.uid() AND tenant_id = get_current_tenant_id())
  WITH CHECK (user_id = auth.uid() AND tenant_id = get_current_tenant_id());

-- Add comment explaining the tenant isolation requirement
COMMENT ON COLUMN public.passkey_credentials.tenant_id IS 'Tenant isolation — every multi-tenant table requires tenant_id for RLS';
