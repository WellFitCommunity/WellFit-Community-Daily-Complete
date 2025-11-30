-- ============================================================================
-- FACILITIES TABLE AND FACILITY_ID COLUMNS
-- ============================================================================
-- Purpose: Enable multi-facility tracking within a tenant (e.g., Methodist
-- Hospital System with 10 hospitals and 30 clinics)
--
-- Design:
--   - Facilities belong to a tenant (tenant_id FK)
--   - Patient records follow the patient across all facilities in the tenant
--   - RLS remains at tenant level (no facility-level isolation)
--   - facility_id is for attribution/reporting, not access control
--
-- Date: 2025-11-30
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CREATE FACILITIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Basic Info
  name TEXT NOT NULL,
  facility_code TEXT,  -- Internal code like "METH-SL" for Methodist Sugar Land
  facility_type TEXT NOT NULL DEFAULT 'clinic'
    CHECK (facility_type IN ('hospital', 'clinic', 'urgent_care', 'emergency', 'rehabilitation', 'nursing_facility', 'home_health', 'telehealth', 'other')),

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  county TEXT,
  country TEXT DEFAULT 'US',

  -- Contact
  phone TEXT,
  fax TEXT,
  email TEXT,

  -- Billing/Compliance Identifiers
  npi TEXT,  -- National Provider Identifier (10 digits)
  tax_id TEXT,  -- EIN for billing
  taxonomy_code TEXT,  -- Healthcare Provider Taxonomy Code
  clia_number TEXT,  -- For labs
  medicare_provider_number TEXT,
  medicaid_provider_number TEXT,

  -- CMS Place of Service code (used in claims)
  place_of_service_code TEXT DEFAULT '11',  -- 11=Office, 21=Inpatient Hospital, 22=Outpatient Hospital, etc.

  -- Operational
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_primary BOOLEAN DEFAULT false,  -- Primary facility for the tenant
  timezone TEXT DEFAULT 'America/Chicago',

  -- Capacity (optional, for reporting)
  bed_count INTEGER,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_facilities_tenant ON public.facilities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_facilities_type ON public.facilities(facility_type);
CREATE INDEX IF NOT EXISTS idx_facilities_active ON public.facilities(is_active) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_facilities_code_tenant ON public.facilities(tenant_id, facility_code) WHERE facility_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_facilities_npi ON public.facilities(npi) WHERE npi IS NOT NULL;

-- Updated at trigger
DROP TRIGGER IF EXISTS trg_facilities_updated_at ON public.facilities;
CREATE TRIGGER trg_facilities_updated_at
  BEFORE UPDATE ON public.facilities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS - Tenant-scoped (facilities visible to all users in the tenant)
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "facilities_tenant_read" ON public.facilities;
CREATE POLICY "facilities_tenant_read" ON public.facilities
  FOR SELECT USING (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "facilities_admin_write" ON public.facilities;
CREATE POLICY "facilities_admin_write" ON public.facilities
  FOR ALL USING (
    tenant_id = public.get_current_tenant_id()
    AND (public.is_admin(auth.uid()) OR public.is_super_admin())
  )
  WITH CHECK (
    tenant_id = public.get_current_tenant_id()
    AND (public.is_admin(auth.uid()) OR public.is_super_admin())
  );

COMMENT ON TABLE public.facilities IS 'Healthcare facilities (hospitals, clinics) belonging to a tenant organization';
COMMENT ON COLUMN public.facilities.place_of_service_code IS 'CMS Place of Service code used in X12 837 claims';

-- ============================================================================
-- 2. ADD FACILITY_ID TO ENCOUNTERS
-- ============================================================================

ALTER TABLE public.encounters
  ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_encounters_facility ON public.encounters(facility_id);

COMMENT ON COLUMN public.encounters.facility_id IS 'Facility where the encounter occurred';

-- ============================================================================
-- 3. ADD FACILITY_ID TO CHECK_INS
-- ============================================================================

ALTER TABLE public.check_ins
  ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_check_ins_facility ON public.check_ins(facility_id);

COMMENT ON COLUMN public.check_ins.facility_id IS 'Facility where the check-in occurred (if in-person)';

-- ============================================================================
-- 4. ADD FACILITY_ID TO CLAIMS
-- ============================================================================

ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_claims_facility ON public.claims(facility_id);

COMMENT ON COLUMN public.claims.facility_id IS 'Service location facility for billing';

-- ============================================================================
-- 5. ADD FACILITY_ID TO BILLING_PROVIDERS
-- ============================================================================

ALTER TABLE public.billing_providers
  ADD COLUMN IF NOT EXISTS primary_facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.billing_providers.primary_facility_id IS 'Primary facility where this provider practices';

-- ============================================================================
-- 6. ADD FACILITY_ID TO PROFILES (for staff assignment)
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS primary_facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_facility ON public.profiles(primary_facility_id);

COMMENT ON COLUMN public.profiles.primary_facility_id IS 'Primary facility where this staff member works (NULL for patients)';

-- ============================================================================
-- 7. ADD FACILITY_ID TO FHIR_ENCOUNTERS
-- ============================================================================

-- Check if fhir_encounters exists before altering
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fhir_encounters') THEN
    ALTER TABLE public.fhir_encounters
      ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_fhir_encounters_facility ON public.fhir_encounters(facility_id);
  END IF;
END $$;

-- ============================================================================
-- 8. ADD FACILITY_ID TO PREHOSPITAL_HANDOFFS
-- ============================================================================

-- Check if prehospital_handoffs exists before altering
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prehospital_handoffs') THEN
    -- Destination facility
    ALTER TABLE public.prehospital_handoffs
      ADD COLUMN IF NOT EXISTS destination_facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_prehospital_handoffs_facility ON public.prehospital_handoffs(destination_facility_id);
  END IF;
END $$;

-- ============================================================================
-- 9. HELPER FUNCTIONS
-- ============================================================================

-- Get facilities for current tenant
CREATE OR REPLACE FUNCTION public.get_tenant_facilities()
RETURNS SETOF public.facilities
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT * FROM public.facilities
  WHERE tenant_id = public.get_current_tenant_id()
  AND is_active = true
  ORDER BY is_primary DESC, name ASC;
$$;

COMMENT ON FUNCTION public.get_tenant_facilities IS 'Returns all active facilities for the current user''s tenant';

-- Get facility by ID (with tenant check)
CREATE OR REPLACE FUNCTION public.get_facility(p_facility_id UUID)
RETURNS public.facilities
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT * FROM public.facilities
  WHERE id = p_facility_id
  AND tenant_id = public.get_current_tenant_id();
$$;

COMMENT ON FUNCTION public.get_facility IS 'Returns a facility by ID if it belongs to the current tenant';

-- ============================================================================
-- 10. SEED DEFAULT FACILITY FOR EXISTING TENANTS (Optional)
-- ============================================================================
-- This creates a "Main Campus" facility for each tenant that doesn't have one
-- Uncomment if you want to auto-create default facilities

-- INSERT INTO public.facilities (tenant_id, name, facility_type, is_primary)
-- SELECT t.id, t.name || ' - Main Campus', 'clinic', true
-- FROM public.tenants t
-- WHERE NOT EXISTS (
--   SELECT 1 FROM public.facilities f WHERE f.tenant_id = t.id
-- );

COMMIT;
