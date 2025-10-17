-- US Core Extensions for Patient Resource
-- Adds race, ethnicity, and birthsex extensions required for US Core compliance

BEGIN;

-- ============================================================================
-- ADD US CORE EXTENSION COLUMNS TO PROFILES TABLE
-- ============================================================================

-- US Core Race Extension
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS us_core_race_code TEXT,
ADD COLUMN IF NOT EXISTS us_core_race_display TEXT,
ADD COLUMN IF NOT EXISTS us_core_race_text TEXT;

-- US Core Ethnicity Extension
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS us_core_ethnicity_code TEXT,
ADD COLUMN IF NOT EXISTS us_core_ethnicity_display TEXT,
ADD COLUMN IF NOT EXISTS us_core_ethnicity_text TEXT;

-- US Core Birth Sex Extension
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS us_core_birthsex TEXT CHECK (us_core_birthsex IN ('F', 'M', 'UNK'));

-- Preferred Language (for communication)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en',
ADD COLUMN IF NOT EXISTS interpreter_required BOOLEAN DEFAULT false;

-- Multiple Identifiers (MRN, SSN, Insurance ID)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS identifiers JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.us_core_race_code IS 'CDC Race Codes (http://hl7.org/fhir/us/core/ValueSet/omb-race-category)';
COMMENT ON COLUMN public.profiles.us_core_ethnicity_code IS 'CDC Ethnicity Codes (http://hl7.org/fhir/us/core/ValueSet/omb-ethnicity-category)';
COMMENT ON COLUMN public.profiles.us_core_birthsex IS 'Birth sex: F (Female), M (Male), UNK (Unknown)';
COMMENT ON COLUMN public.profiles.identifiers IS 'Array of identifiers: [{system: "MRN", value: "12345"}, {system: "SSN", value: "xxx-xx-1234"}]';

-- ============================================================================
-- INDEXES FOR EXTENSION FIELDS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_race ON public.profiles(us_core_race_code) WHERE us_core_race_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_ethnicity ON public.profiles(us_core_ethnicity_code) WHERE us_core_ethnicity_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_birthsex ON public.profiles(us_core_birthsex) WHERE us_core_birthsex IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_language ON public.profiles(preferred_language) WHERE preferred_language IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_identifiers ON public.profiles USING GIN(identifiers) WHERE identifiers IS NOT NULL;

-- ============================================================================
-- HELPER FUNCTIONS FOR US CORE COMPLIANCE
-- ============================================================================

-- Get patient identifier by system
CREATE OR REPLACE FUNCTION public.get_patient_identifier(
  patient_id_param UUID,
  system_param TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  identifier_value TEXT;
BEGIN
  SELECT jsonb_path_query_first(identifiers, ('$[*] ? (@.system == "' || system_param || '").value')::jsonpath)::text
  INTO identifier_value
  FROM public.profiles
  WHERE id = patient_id_param;

  RETURN identifier_value;
END;
$$;

-- Add patient identifier
CREATE OR REPLACE FUNCTION public.add_patient_identifier(
  patient_id_param UUID,
  system_param TEXT,
  value_param TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET identifiers = identifiers || jsonb_build_array(
    jsonb_build_object(
      'system', system_param,
      'value', value_param,
      'added_at', to_jsonb(NOW())
    )
  )
  WHERE id = patient_id_param;

  RETURN FOUND;
END;
$$;

-- Get US Core race display
CREATE OR REPLACE FUNCTION public.get_race_display(race_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE race_code
    WHEN '1002-5' THEN 'American Indian or Alaska Native'
    WHEN '2028-9' THEN 'Asian'
    WHEN '2054-5' THEN 'Black or African American'
    WHEN '2076-8' THEN 'Native Hawaiian or Other Pacific Islander'
    WHEN '2106-3' THEN 'White'
    WHEN '2131-1' THEN 'Other Race'
    WHEN 'UNK' THEN 'Unknown'
    WHEN 'ASKU' THEN 'Asked but unknown'
    ELSE 'Not specified'
  END;
END;
$$;

-- Get US Core ethnicity display
CREATE OR REPLACE FUNCTION public.get_ethnicity_display(ethnicity_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE ethnicity_code
    WHEN '2135-2' THEN 'Hispanic or Latino'
    WHEN '2186-5' THEN 'Not Hispanic or Latino'
    WHEN 'UNK' THEN 'Unknown'
    WHEN 'ASKU' THEN 'Asked but unknown'
    ELSE 'Not specified'
  END;
END;
$$;

-- ============================================================================
-- VALIDATION FUNCTIONS
-- ============================================================================

-- Check if patient has required US Core fields
CREATE OR REPLACE FUNCTION public.check_us_core_compliance(patient_id_param UUID)
RETURNS TABLE (
  is_compliant BOOLEAN,
  missing_fields TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  missing TEXT[] := ARRAY[]::TEXT[];
  profile RECORD;
BEGIN
  SELECT * INTO profile
  FROM public.profiles
  WHERE id = patient_id_param;

  -- Required for US Core: name, gender, birthdate
  IF profile.full_name IS NULL OR profile.full_name = '' THEN
    missing := array_append(missing, 'name');
  END IF;

  IF profile.date_of_birth IS NULL THEN
    missing := array_append(missing, 'birthdate');
  END IF;

  -- Race and ethnicity are required for US Core
  IF profile.us_core_race_code IS NULL THEN
    missing := array_append(missing, 'race');
  END IF;

  IF profile.us_core_ethnicity_code IS NULL THEN
    missing := array_append(missing, 'ethnicity');
  END IF;

  RETURN QUERY SELECT (array_length(missing, 1) IS NULL OR array_length(missing, 1) = 0), missing;
END;
$$;

COMMIT;

-- migrate:down
BEGIN;

DROP FUNCTION IF EXISTS public.check_us_core_compliance(UUID);
DROP FUNCTION IF EXISTS public.get_ethnicity_display(TEXT);
DROP FUNCTION IF EXISTS public.get_race_display(TEXT);
DROP FUNCTION IF EXISTS public.add_patient_identifier(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_patient_identifier(UUID, TEXT);

ALTER TABLE public.profiles
DROP COLUMN IF EXISTS us_core_race_code,
DROP COLUMN IF EXISTS us_core_race_display,
DROP COLUMN IF EXISTS us_core_race_text,
DROP COLUMN IF EXISTS us_core_ethnicity_code,
DROP COLUMN IF EXISTS us_core_ethnicity_display,
DROP COLUMN IF EXISTS us_core_ethnicity_text,
DROP COLUMN IF EXISTS us_core_birthsex,
DROP COLUMN IF EXISTS preferred_language,
DROP COLUMN IF EXISTS interpreter_required,
DROP COLUMN IF EXISTS identifiers;

COMMIT;
