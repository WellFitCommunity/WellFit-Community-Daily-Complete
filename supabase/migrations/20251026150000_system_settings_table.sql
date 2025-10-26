-- ============================================================================
-- SYSTEM SETTINGS TABLE - For API Keys and Configuration
-- ============================================================================
-- Purpose: Store clearinghouse credentials and other system-wide settings
-- Security: Encrypted at rest, RLS for admin-only access
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  encrypted BOOLEAN DEFAULT FALSE,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON public.system_settings(key);

-- RLS - Admin only
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_settings_admin_only" ON public.system_settings;
CREATE POLICY "system_settings_admin_only"
  ON public.system_settings
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER trg_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Insert default settings (without actual credentials)
INSERT INTO public.system_settings (key, value, description) VALUES
  ('clearinghouse_provider', 'waystar', 'Clearinghouse provider: waystar, change_healthcare, or availity'),
  ('clearinghouse_api_url', '', 'Clearinghouse API endpoint URL'),
  ('clearinghouse_client_id', '', 'OAuth Client ID from clearinghouse'),
  ('clearinghouse_client_secret', '', 'OAuth Client Secret (encrypted)'),
  ('clearinghouse_submitter_id', '', 'NPI or assigned submitter ID')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary:
-- ✓ Created system_settings table for API credentials
-- ✓ Admin-only RLS policy
-- ✓ Encrypted at rest (Supabase native encryption)
-- ✓ Pre-populated with clearinghouse setting keys
--
-- Usage: Admin UI (ClearinghouseConfigPanel) writes to this table
-- ============================================================================
