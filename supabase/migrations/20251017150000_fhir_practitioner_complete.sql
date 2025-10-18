-- ============================================================================
-- FHIR R4 Practitioner Resource - Complete Implementation
-- Implements US Core Practitioner Profile with Role-Based Access
-- ============================================================================
-- A Practitioner is a person who is directly or indirectly involved in the
-- provisioning of healthcare. US Core requires: identifier (NPI), name, active.
--
-- ROLE CODE SYSTEM (based on existing system):
-- 1 = Admin
-- 2 = Super Admin
-- 3 = Staff (general)
-- 4 = Senior (patient)
-- 5 = Doctor/Physician
-- 6 = Nurse Practitioner
-- 7 = Registered Nurse (RN)
-- 8 = Licensed Practical Nurse (LPN)
-- 9 = Care Manager
-- 10 = Social Worker
-- 11 = Pharmacist
-- 12 = Lab Technician
-- 13 = Physical Therapist
-- 14 = Occupational Therapist
-- 15 = Dietitian/Nutritionist
-- 16 = Case Manager
-- 17 = Physician Assistant
-- 18 = Caregiver
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. EXPAND USER_ROLES CONSTRAINT TO INCLUDE HEALTHCARE ROLES
-- ============================================================================
-- Current state: user_roles has (user_id, role TEXT, created_at)
-- with CHECK constraint: role IN ('admin', 'super_admin')
-- We're expanding to include healthcare provider roles while preserving existing data

-- Update user_roles constraint to include all healthcare roles
ALTER TABLE public.user_roles
DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_role_check
CHECK (role IN (
  'admin', 'super_admin', 'staff', 'senior',
  'doctor', 'nurse_practitioner', 'registered_nurse', 'licensed_practical_nurse',
  'care_manager', 'social_worker', 'pharmacist', 'lab_tech',
  'physical_therapist', 'occupational_therapist', 'dietitian',
  'case_manager', 'physician_assistant', 'caregiver'
));

-- ============================================================================
-- 2. CREATE FHIR PRACTITIONERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fhir_practitioners (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to auth.users (one user can be a practitioner)
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- External System Integration
  external_id TEXT,
  external_system TEXT,

  -- FHIR Meta
  version_id TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),

  -- Required US Core Fields
  active BOOLEAN NOT NULL DEFAULT true,

  -- Identifiers (NPI is REQUIRED for US Core)
  npi TEXT UNIQUE, -- National Provider Identifier (10 digits)
  state_license_number TEXT,
  dea_number TEXT, -- Drug Enforcement Administration number
  taxonomy_code TEXT, -- Healthcare Provider Taxonomy Code

  -- Name (REQUIRED for US Core)
  family_name TEXT NOT NULL, -- Last name
  given_names TEXT[] NOT NULL, -- First, middle names
  prefix TEXT[], -- Dr., Mr., Ms., Prof.
  suffix TEXT[], -- MD, PhD, RN, BSN, etc.

  -- Demographics
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'unknown')),
  birth_date DATE,

  -- Contact Information
  telecom JSONB, -- [{system: 'phone', value: '555-1234', use: 'work', rank: 1}]
  email TEXT,
  phone TEXT,

  -- Addresses (JSONB array of FHIR Address resources)
  addresses JSONB, -- [{use: 'work', line: ['123 Main St'], city: 'Boston', state: 'MA', postalCode: '02101'}]

  -- Photo
  photo_url TEXT,

  -- Qualifications (degrees, licenses, certifications)
  -- JSONB array: [{identifier: {value: 'MD'}, code: {text: 'Doctor of Medicine'}, issuer: 'Harvard Medical School', period: {start: '2010-05-15'}}]
  qualifications JSONB,

  -- Specialties and Practice Areas
  specialties TEXT[], -- ['Family Medicine', 'Geriatrics', 'Internal Medicine']
  specialty_codes TEXT[], -- SNOMED CT or NUCC codes

  -- Languages Spoken
  communication_languages TEXT[], -- ['en', 'es', 'fr']

  -- Biography/About
  bio TEXT,

  -- Availability/Schedule
  availability_hours JSONB, -- {monday: {start: '09:00', end: '17:00'}, ...}

  -- Audit Fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT fhir_practitioner_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT npi_format CHECK (npi IS NULL OR npi ~ '^\d{10}$'), -- NPI must be 10 digits
  CONSTRAINT email_format CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- ============================================================================
-- 3. CREATE PRACTITIONER ROLES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fhir_practitioner_roles (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  practitioner_id UUID NOT NULL REFERENCES fhir_practitioners(id) ON DELETE CASCADE,
  organization_id UUID, -- Future: Reference to Organization resource
  location_id UUID, -- Future: Reference to Location resource

  -- Active Status
  active BOOLEAN NOT NULL DEFAULT true,

  -- Role/Position
  code TEXT[] NOT NULL, -- ['doctor', 'researcher', 'educator']
  code_display TEXT[], -- Display names for codes

  -- Specialty when in this role
  specialty TEXT[],
  specialty_display TEXT[],

  -- Period this role is valid
  period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_end TIMESTAMPTZ,

  -- Contact in this role (may differ from practitioner contact)
  telecom JSONB, -- [{system: 'phone', value: '555-5678', use: 'work'}]

  -- Availability in this role
  available_time JSONB, -- FHIR AvailableTime structure
  not_available JSONB, -- FHIR NotAvailable structure

  -- Endpoint (electronic communication)
  endpoint_references TEXT[], -- References to Endpoint resources

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fhir_practitioner_role_practitioner_fk FOREIGN KEY (practitioner_id) REFERENCES fhir_practitioners(id) ON DELETE CASCADE
);

-- ============================================================================
-- 4. INDEXES for Performance
-- ============================================================================

-- Practitioners
CREATE INDEX IF NOT EXISTS idx_practitioners_user_id ON fhir_practitioners(user_id);
CREATE INDEX IF NOT EXISTS idx_practitioners_npi ON fhir_practitioners(npi) WHERE npi IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_practitioners_active ON fhir_practitioners(active);
CREATE INDEX IF NOT EXISTS idx_practitioners_specialties ON fhir_practitioners USING GIN(specialties);
CREATE INDEX IF NOT EXISTS idx_practitioners_languages ON fhir_practitioners USING GIN(communication_languages);
CREATE INDEX IF NOT EXISTS idx_practitioners_family_name ON fhir_practitioners(family_name);
CREATE INDEX IF NOT EXISTS idx_practitioners_email ON fhir_practitioners(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_practitioners_updated_at ON fhir_practitioners(updated_at);

-- Practitioner Roles
CREATE INDEX IF NOT EXISTS idx_practitioner_roles_practitioner ON fhir_practitioner_roles(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_practitioner_roles_active ON fhir_practitioner_roles(active);
CREATE INDEX IF NOT EXISTS idx_practitioner_roles_code ON fhir_practitioner_roles USING GIN(code);
CREATE INDEX IF NOT EXISTS idx_practitioner_roles_specialty ON fhir_practitioner_roles USING GIN(specialty);

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE fhir_practitioners ENABLE ROW LEVEL SECURITY;
ALTER TABLE fhir_practitioner_roles ENABLE ROW LEVEL SECURITY;

-- Anyone can view active practitioners (public directory)
CREATE POLICY practitioners_public_read ON fhir_practitioners
  FOR SELECT
  USING (active = true);

-- Practitioners can view and update their own profile
CREATE POLICY practitioners_self_manage ON fhir_practitioners
  FOR ALL
  USING (user_id = auth.uid());

-- Staff and admins can view all practitioners
CREATE POLICY practitioners_staff_read ON fhir_practitioners
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'staff', 'care_manager')
    )
  );

-- Admins and care managers can create/update practitioners
CREATE POLICY practitioners_admin_write ON fhir_practitioners
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'care_manager')
    )
  );

CREATE POLICY practitioners_admin_update ON fhir_practitioners
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'care_manager')
    )
  );

-- Only super admins can delete practitioners
CREATE POLICY practitioners_super_admin_delete ON fhir_practitioners
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Practitioner Roles RLS (similar policies)
CREATE POLICY practitioner_roles_read ON fhir_practitioner_roles
  FOR SELECT
  USING (
    active = true OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'staff', 'care_manager')
    )
  );

CREATE POLICY practitioner_roles_admin_manage ON fhir_practitioner_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'care_manager')
    )
  );

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Generate full name from name parts
CREATE OR REPLACE FUNCTION get_practitioner_full_name(
  p_prefix TEXT[],
  p_given_names TEXT[],
  p_family_name TEXT,
  p_suffix TEXT[]
)
RETURNS TEXT AS $$
BEGIN
  RETURN TRIM(
    COALESCE(array_to_string(p_prefix, ' ') || ' ', '') ||
    array_to_string(p_given_names, ' ') || ' ' ||
    p_family_name ||
    COALESCE(' ' || array_to_string(p_suffix, ', '), '')
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get practitioner by NPI
CREATE OR REPLACE FUNCTION get_practitioner_by_npi(p_npi TEXT)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  npi TEXT,
  specialties TEXT[],
  active BOOLEAN,
  email TEXT,
  phone TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    get_practitioner_full_name(p.prefix, p.given_names, p.family_name, p.suffix) as full_name,
    p.npi,
    p.specialties,
    p.active,
    p.email,
    p.phone
  FROM fhir_practitioners p
  WHERE p.npi = p_npi AND p.active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get practitioners by specialty
CREATE OR REPLACE FUNCTION get_practitioners_by_specialty(p_specialty TEXT)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  specialties TEXT[],
  email TEXT,
  phone TEXT,
  photo_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    get_practitioner_full_name(p.prefix, p.given_names, p.family_name, p.suffix) as full_name,
    p.specialties,
    p.email,
    p.phone,
    p.photo_url
  FROM fhir_practitioners p
  WHERE p.active = true
    AND p_specialty = ANY(p.specialties)
  ORDER BY get_practitioner_full_name(p.prefix, p.given_names, p.family_name, p.suffix);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all active practitioners
CREATE OR REPLACE FUNCTION get_active_practitioners()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  specialties TEXT[],
  email TEXT,
  phone TEXT,
  npi TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    get_practitioner_full_name(p.prefix, p.given_names, p.family_name, p.suffix) as full_name,
    p.specialties,
    p.email,
    p.phone,
    p.npi
  FROM fhir_practitioners p
  WHERE p.active = true
  ORDER BY get_practitioner_full_name(p.prefix, p.given_names, p.family_name, p.suffix);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Search practitioners (by name, specialty, or NPI)
CREATE OR REPLACE FUNCTION search_practitioners(p_search_term TEXT)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  specialties TEXT[],
  npi TEXT,
  email TEXT,
  photo_url TEXT
) AS $$
DECLARE
  v_full_name TEXT;
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    get_practitioner_full_name(p.prefix, p.given_names, p.family_name, p.suffix) as full_name,
    p.specialties,
    p.npi,
    p.email,
    p.photo_url
  FROM fhir_practitioners p
  WHERE p.active = true
    AND (
      get_practitioner_full_name(p.prefix, p.given_names, p.family_name, p.suffix) ILIKE '%' || p_search_term || '%'
      OR p.family_name ILIKE '%' || p_search_term || '%'
      OR p.npi = p_search_term
      OR EXISTS (
        SELECT 1 FROM unnest(p.specialties) s
        WHERE s ILIKE '%' || p_search_term || '%'
      )
    )
  ORDER BY get_practitioner_full_name(p.prefix, p.given_names, p.family_name, p.suffix)
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get practitioner's current roles
CREATE OR REPLACE FUNCTION get_practitioner_roles(p_practitioner_id UUID)
RETURNS TABLE (
  id UUID,
  code TEXT[],
  code_display TEXT[],
  specialty TEXT[],
  active BOOLEAN,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id,
    pr.code,
    pr.code_display,
    pr.specialty,
    pr.active,
    pr.period_start,
    pr.period_end
  FROM fhir_practitioner_roles pr
  WHERE pr.practitioner_id = p_practitioner_id
    AND pr.active = true
    AND (pr.period_end IS NULL OR pr.period_end >= NOW())
  ORDER BY pr.period_start DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. TRIGGERS for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_practitioner_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS practitioner_updated_at_trigger ON fhir_practitioners;
CREATE TRIGGER practitioner_updated_at_trigger
  BEFORE UPDATE ON fhir_practitioners
  FOR EACH ROW
  EXECUTE FUNCTION update_practitioner_updated_at();

DROP TRIGGER IF EXISTS practitioner_role_updated_at_trigger ON fhir_practitioner_roles;
CREATE TRIGGER practitioner_role_updated_at_trigger
  BEFORE UPDATE ON fhir_practitioner_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_practitioner_updated_at();

-- ============================================================================
-- 8. COMMENTS
-- ============================================================================

COMMENT ON TABLE fhir_practitioners IS 'FHIR R4 Practitioner resource - healthcare providers';
COMMENT ON COLUMN fhir_practitioners.npi IS 'National Provider Identifier (10 digits, required for US Core)';
COMMENT ON COLUMN fhir_practitioners.active IS 'Whether practitioner is currently practicing';
COMMENT ON COLUMN fhir_practitioners.qualifications IS 'JSONB array of degrees, licenses, certifications';
COMMENT ON COLUMN fhir_practitioners.specialties IS 'Array of specialty names (e.g., Family Medicine, Geriatrics)';

COMMENT ON TABLE fhir_practitioner_roles IS 'Links practitioners to organizations, locations, and roles';
COMMENT ON COLUMN fhir_practitioner_roles.code IS 'Role type (doctor, researcher, educator, etc.)';

COMMIT;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
