-- ============================================================================
-- USE SUPABASE VAULT FOR CLEARINGHOUSE SECRETS
-- ============================================================================
-- Purpose: Store API keys securely in Supabase Vault (not custom table)
-- Security: Vault-encrypted secrets, never visible in queries
-- ============================================================================

-- Drop the custom system_settings table (we'll use Vault instead)
DROP TABLE IF EXISTS public.system_settings CASCADE;

-- ============================================================================
-- VAULT SECRETS (Stored via Supabase Dashboard or SQL)
-- ============================================================================
-- To store secrets in Vault, use:
-- SELECT vault.create_secret('clearinghouse_client_id', 'your-client-id', 'Clearinghouse OAuth Client ID');
-- SELECT vault.create_secret('clearinghouse_client_secret', 'your-secret-key', 'Clearinghouse OAuth Client Secret');
-- SELECT vault.create_secret('clearinghouse_submitter_id', 'your-npi', 'NPI or Submitter ID');

-- ============================================================================
-- CONFIGURATION TABLE (Non-Secret Settings Only)
-- ============================================================================
-- Store non-secret configuration (provider name, API URL)
CREATE TABLE IF NOT EXISTS public.clearinghouse_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('waystar', 'change_healthcare', 'availity')),
  api_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active config at a time
CREATE UNIQUE INDEX idx_clearinghouse_config_active
  ON public.clearinghouse_config(is_active)
  WHERE is_active = TRUE;

-- RLS - Admin only
ALTER TABLE public.clearinghouse_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clearinghouse_config_admin_only" ON public.clearinghouse_config;
CREATE POLICY "clearinghouse_config_admin_only"
  ON public.clearinghouse_config
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER trg_clearinghouse_config_updated_at
  BEFORE UPDATE ON public.clearinghouse_config
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- FUNCTION TO GET CLEARINGHOUSE CREDENTIALS (From Vault)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_clearinghouse_credentials()
RETURNS TABLE (
  provider TEXT,
  api_url TEXT,
  client_id TEXT,
  client_secret TEXT,
  submitter_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config RECORD;
  v_client_id TEXT;
  v_client_secret TEXT;
  v_submitter_id TEXT;
BEGIN
  -- Only admins can call this
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  -- Get config (provider, URL)
  SELECT * INTO v_config
  FROM public.clearinghouse_config
  WHERE is_active = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Get secrets from Vault
  SELECT decrypted_secret INTO v_client_id
  FROM vault.decrypted_secrets
  WHERE name = 'clearinghouse_client_id'
  LIMIT 1;

  SELECT decrypted_secret INTO v_client_secret
  FROM vault.decrypted_secrets
  WHERE name = 'clearinghouse_client_secret'
  LIMIT 1;

  SELECT decrypted_secret INTO v_submitter_id
  FROM vault.decrypted_secrets
  WHERE name = 'clearinghouse_submitter_id'
  LIMIT 1;

  -- Return combined config + secrets
  RETURN QUERY
  SELECT
    v_config.provider,
    v_config.api_url,
    v_client_id,
    v_client_secret,
    v_submitter_id;
END;
$$;

-- ============================================================================
-- FUNCTION TO UPDATE CLEARINGHOUSE CONFIG
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_clearinghouse_config(
  p_provider TEXT,
  p_api_url TEXT,
  p_client_id TEXT,
  p_client_secret TEXT,
  p_submitter_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only admins can call this
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  -- Update or insert config (non-secret)
  INSERT INTO public.clearinghouse_config (provider, api_url, is_active, updated_by)
  VALUES (p_provider, p_api_url, TRUE, auth.uid())
  ON CONFLICT ((is_active)) WHERE is_active = TRUE
  DO UPDATE SET
    provider = p_provider,
    api_url = p_api_url,
    updated_by = auth.uid(),
    updated_at = NOW();

  -- Update or insert secrets in Vault
  -- Note: This uses Vault's upsert functionality
  PERFORM vault.create_secret(p_client_id, 'clearinghouse_client_id', 'Clearinghouse OAuth Client ID');
  PERFORM vault.create_secret(p_client_secret, 'clearinghouse_client_secret', 'Clearinghouse OAuth Client Secret');
  PERFORM vault.create_secret(p_submitter_id, 'clearinghouse_submitter_id', 'NPI or Submitter ID');
END;
$$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary:
-- ✓ Removed custom system_settings table
-- ✓ Created clearinghouse_config for non-secret settings (provider, URL)
-- ✓ Secrets stored in Supabase Vault (client_id, client_secret, submitter_id)
-- ✓ get_clearinghouse_credentials() function retrieves config + secrets
-- ✓ update_clearinghouse_config() function saves config + secrets
-- ✓ Admin-only access with RLS
--
-- Usage:
-- 1. Admin enters credentials in UI
-- 2. UI calls update_clearinghouse_config() function
-- 3. Function saves provider/URL in table, secrets in Vault
-- 4. Application calls get_clearinghouse_credentials() to retrieve
-- ============================================================================
