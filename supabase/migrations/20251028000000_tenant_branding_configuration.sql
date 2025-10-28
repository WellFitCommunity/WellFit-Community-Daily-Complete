-- Tenant Branding Configuration System
-- Allows each tenant to have custom branding (logo, colors, app name, etc.)
-- This replaces hardcoded branding in branding.config.ts

-- ============================================================================
-- 1. Add branding columns to existing tenants table
-- ============================================================================

-- Add branding configuration columns to tenants table
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS app_name TEXT DEFAULT 'WellFit Community';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#003865';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#8cc63f';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS accent_color TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS text_color TEXT DEFAULT '#ffffff';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS gradient TEXT DEFAULT 'linear-gradient(to bottom right, #003865, #8cc63f)';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS contact_info TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS custom_footer TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS favicon_url TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS subdomain TEXT UNIQUE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS custom_css JSONB DEFAULT '{}';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS theme_settings JSONB DEFAULT '{}';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add comment explaining table purpose
COMMENT ON TABLE public.tenants IS 'Multi-tenant branding configuration - each tenant can have custom logo, colors, and theme';

-- Add comments on branding columns
COMMENT ON COLUMN public.tenants.app_name IS 'Tenant-specific application name (e.g., "WellFit Houston")';
COMMENT ON COLUMN public.tenants.logo_url IS 'URL to tenant logo (stored in Supabase Storage or CDN)';
COMMENT ON COLUMN public.tenants.primary_color IS 'Primary brand color (hex code)';
COMMENT ON COLUMN public.tenants.secondary_color IS 'Secondary brand color (hex code)';
COMMENT ON COLUMN public.tenants.accent_color IS 'Accent color for highlights (hex code)';
COMMENT ON COLUMN public.tenants.gradient IS 'CSS gradient string for headers/backgrounds';
COMMENT ON COLUMN public.tenants.custom_css IS 'Additional CSS overrides in JSON format';
COMMENT ON COLUMN public.tenants.theme_settings IS 'Advanced theme settings (fonts, spacing, etc.)';

-- ============================================================================
-- 2. Update existing tenants with their current hardcoded branding
-- ============================================================================

-- Update WellFit (primary tenant)
UPDATE public.tenants
SET
  app_name = 'WellFit Community',
  logo_url = '/android-chrome-512x512.png',
  primary_color = '#003865',
  secondary_color = '#8cc63f',
  text_color = '#ffffff',
  gradient = 'linear-gradient(to bottom right, #003865, #8cc63f)',
  contact_info = 'WellFit Community',
  subdomain = 'www',
  updated_at = NOW()
WHERE name = 'WellFit';

-- Update WellFit Houston
UPDATE public.tenants
SET
  app_name = 'WellFit Houston',
  logo_url = '/logos/houston-logo.png',
  primary_color = '#C8102E',
  secondary_color = '#FFDC00',
  text_color = '#ffffff',
  gradient = 'linear-gradient(to bottom right, #C8102E, #FFDC00)',
  contact_info = 'Houston Senior Services',
  custom_footer = '© 2025 WellFit Houston. Powered by Houston Senior Services.',
  subdomain = 'houston',
  updated_at = NOW()
WHERE name = 'WellFit Houston';

-- Update WellFit Miami
UPDATE public.tenants
SET
  app_name = 'WellFit Miami',
  logo_url = '/logos/miami-logo.png',
  primary_color = '#00B4A6',
  secondary_color = '#FF6B35',
  text_color = '#ffffff',
  gradient = 'linear-gradient(to bottom right, #00B4A6, #FF6B35)',
  contact_info = 'Miami Healthcare Network',
  custom_footer = '© 2025 WellFit Miami. Powered by Miami Healthcare Network.',
  subdomain = 'miami',
  updated_at = NOW()
WHERE name = 'WellFit Miami';

-- Update WellFit Phoenix
UPDATE public.tenants
SET
  app_name = 'WellFit Phoenix',
  logo_url = '/logos/phoenix-logo.png',
  primary_color = '#D2691E',
  secondary_color = '#8B4513',
  text_color = '#ffffff',
  gradient = 'linear-gradient(to bottom right, #D2691E, #8B4513)',
  contact_info = 'Phoenix Wellness Center',
  custom_footer = '© 2025 WellFit Phoenix. Powered by Phoenix Wellness Center.',
  subdomain = 'phoenix',
  updated_at = NOW()
WHERE name = 'WellFit Pheonix'; -- Note: Typo in original data

-- ============================================================================
-- 3. Create function to get tenant branding by subdomain
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_tenant_branding_by_subdomain(p_subdomain TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  app_name TEXT,
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  accent_color TEXT,
  text_color TEXT,
  gradient TEXT,
  contact_info TEXT,
  custom_footer TEXT,
  favicon_url TEXT,
  custom_css JSONB,
  theme_settings JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.app_name,
    t.logo_url,
    t.primary_color,
    t.secondary_color,
    t.accent_color,
    t.text_color,
    t.gradient,
    t.contact_info,
    t.custom_footer,
    t.favicon_url,
    t.custom_css,
    t.theme_settings
  FROM public.tenants t
  WHERE t.subdomain = p_subdomain
    AND t.is_active = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_tenant_branding_by_subdomain IS 'Retrieve tenant branding configuration by subdomain (used by frontend)';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_tenant_branding_by_subdomain TO authenticated, anon;

-- ============================================================================
-- 4. Create function to get all active tenants
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_all_active_tenants()
RETURNS TABLE (
  id UUID,
  name TEXT,
  subdomain TEXT,
  app_name TEXT,
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.subdomain,
    t.app_name,
    t.logo_url,
    t.primary_color,
    t.secondary_color,
    t.is_active
  FROM public.tenants t
  WHERE t.is_active = true
  ORDER BY t.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_all_active_tenants IS 'List all active tenants (for admin tenant switcher)';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_all_active_tenants TO authenticated;

-- ============================================================================
-- 5. Create audit table for branding changes
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_branding_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id),
  change_type TEXT NOT NULL, -- 'UPDATE', 'LOGO_UPLOAD', 'THEME_CHANGE'
  old_values JSONB,
  new_values JSONB,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_branding_audit_tenant ON public.tenant_branding_audit(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_branding_audit_changed_by ON public.tenant_branding_audit(changed_by);
CREATE INDEX IF NOT EXISTS idx_tenant_branding_audit_created_at ON public.tenant_branding_audit(created_at DESC);

-- Enable RLS on audit table
ALTER TABLE public.tenant_branding_audit ENABLE ROW LEVEL SECURITY;

-- Admin can view all audit logs
CREATE POLICY "tenant_branding_audit_admin_select"
  ON public.tenant_branding_audit
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- System can insert audit logs
CREATE POLICY "tenant_branding_audit_system_insert"
  ON public.tenant_branding_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- 6. Create trigger to audit branding changes
-- ============================================================================

CREATE OR REPLACE FUNCTION public.audit_tenant_branding_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only audit if branding-related columns changed
  IF (OLD.app_name IS DISTINCT FROM NEW.app_name)
     OR (OLD.logo_url IS DISTINCT FROM NEW.logo_url)
     OR (OLD.primary_color IS DISTINCT FROM NEW.primary_color)
     OR (OLD.secondary_color IS DISTINCT FROM NEW.secondary_color)
     OR (OLD.gradient IS DISTINCT FROM NEW.gradient)
     OR (OLD.custom_css IS DISTINCT FROM NEW.custom_css)
     OR (OLD.theme_settings IS DISTINCT FROM NEW.theme_settings)
  THEN
    INSERT INTO public.tenant_branding_audit (
      tenant_id,
      changed_by,
      change_type,
      old_values,
      new_values
    ) VALUES (
      NEW.id,
      auth.uid(),
      'UPDATE',
      jsonb_build_object(
        'app_name', OLD.app_name,
        'logo_url', OLD.logo_url,
        'primary_color', OLD.primary_color,
        'secondary_color', OLD.secondary_color,
        'gradient', OLD.gradient
      ),
      jsonb_build_object(
        'app_name', NEW.app_name,
        'logo_url', NEW.logo_url,
        'primary_color', NEW.primary_color,
        'secondary_color', NEW.secondary_color,
        'gradient', NEW.gradient
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to tenants table
DROP TRIGGER IF EXISTS trg_audit_tenant_branding ON public.tenants;
CREATE TRIGGER trg_audit_tenant_branding
  AFTER UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_tenant_branding_changes();

-- ============================================================================
-- 7. Update existing RLS policies to allow branding reads
-- ============================================================================

-- Allow anonymous users to read tenant branding (for login pages)
DROP POLICY IF EXISTS "tenants_branding_public_read" ON public.tenants;
CREATE POLICY "tenants_branding_public_read"
  ON public.tenants
  FOR SELECT
  TO anon
  USING (is_active = true);

-- ============================================================================
-- 8. Create storage bucket for tenant logos
-- ============================================================================

-- Note: This must be run manually in Supabase Dashboard or via Supabase CLI
-- Creating storage buckets via SQL migrations is not directly supported

-- Manual step: Create bucket named "tenant-logos" with public read access
-- Dashboard > Storage > Create Bucket:
--   - Name: tenant-logos
--   - Public: true (for logo visibility)
--   - File size limit: 5MB
--   - Allowed MIME types: image/png, image/jpeg, image/svg+xml

-- RLS policy for tenant logo uploads (admins only)
-- This would be created in the Supabase Dashboard under Storage > Policies

COMMENT ON TABLE public.tenants IS '
Multi-tenant branding configuration system.

Each tenant (WellFit Houston, Miami, Phoenix) can have:
- Custom app name and logo
- Brand colors (primary, secondary, accent)
- Custom gradients for headers
- Custom footer text
- Advanced theme settings (fonts, spacing)

Branding is loaded dynamically based on subdomain or tenant_id.
Logo files are stored in Supabase Storage bucket: tenant-logos
';

-- ============================================================================
-- 9. Grant permissions
-- ============================================================================

-- Authenticated users can read all tenant branding
GRANT SELECT ON TABLE public.tenants TO authenticated, anon;

-- Only admins can modify tenant branding
-- (Already enforced by existing RLS policies on tenants table)

-- ============================================================================
-- 10. Add updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_tenant_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON public.tenants;
CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tenant_timestamp();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify migration
SELECT
  name,
  subdomain,
  app_name,
  primary_color,
  secondary_color,
  is_active
FROM public.tenants
ORDER BY name;
