-- =====================================================
-- Fix FHIR Conditions RPC Functions
-- Date: 2025-12-22
-- Purpose: Fix column name mismatches and missing functions
-- =====================================================

-- ============================================
-- 1. DROP old get_active_conditions function (has wrong return type)
-- ============================================
DROP FUNCTION IF EXISTS public.get_active_conditions(uuid);

-- ============================================
-- 2. CREATE get_active_conditions function
-- Column names fixed: display->code_display, onset_date_time->onset_datetime, severity->severity_code
-- Parameter name: patient_id_param matches what service expects
-- ============================================
CREATE OR REPLACE FUNCTION public.get_active_conditions(patient_id_param uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  patient_id uuid,
  code text,
  code_display text,
  clinical_status text,
  verification_status text,
  category text[],
  severity_code text,
  onset_datetime timestamptz,
  recorded_date timestamptz,
  note text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fc.id,
    fc.patient_id,
    fc.code,
    fc.code_display,
    fc.clinical_status,
    fc.verification_status,
    fc.category,
    fc.severity_code,
    fc.onset_datetime,
    fc.recorded_date,
    fc.note
  FROM public.fhir_conditions fc
  WHERE (patient_id_param IS NULL OR fc.patient_id = patient_id_param)
    AND fc.clinical_status IN ('active', 'recurrence', 'relapse')
  ORDER BY fc.onset_datetime DESC NULLS LAST;
END;
$$;

-- ============================================
-- 3. CREATE get_problem_list function
-- Returns conditions with category = 'problem-list-item'
-- ============================================
CREATE OR REPLACE FUNCTION public.get_problem_list(patient_id_param uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  patient_id uuid,
  code text,
  code_display text,
  clinical_status text,
  verification_status text,
  category text[],
  severity_code text,
  onset_datetime timestamptz,
  recorded_date timestamptz,
  note text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fc.id,
    fc.patient_id,
    fc.code,
    fc.code_display,
    fc.clinical_status,
    fc.verification_status,
    fc.category,
    fc.severity_code,
    fc.onset_datetime,
    fc.recorded_date,
    fc.note
  FROM public.fhir_conditions fc
  WHERE (patient_id_param IS NULL OR fc.patient_id = patient_id_param)
    AND 'problem-list-item' = ANY(fc.category)
  ORDER BY fc.onset_datetime DESC NULLS LAST;
END;
$$;

-- ============================================
-- 4. CREATE get_encounter_diagnoses function
-- Returns conditions linked to a specific encounter
-- ============================================
CREATE OR REPLACE FUNCTION public.get_encounter_diagnoses(encounter_id_param uuid)
RETURNS TABLE(
  id uuid,
  patient_id uuid,
  code text,
  code_display text,
  clinical_status text,
  verification_status text,
  category text[],
  severity_code text,
  onset_datetime timestamptz,
  recorded_date timestamptz,
  note text,
  is_primary boolean,
  rank integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fc.id,
    fc.patient_id,
    fc.code,
    fc.code_display,
    fc.clinical_status,
    fc.verification_status,
    fc.category,
    fc.severity_code,
    fc.onset_datetime,
    fc.recorded_date,
    fc.note,
    fc.is_primary,
    fc.rank
  FROM public.fhir_conditions fc
  WHERE fc.encounter_id = encounter_id_param
    AND 'encounter-diagnosis' = ANY(fc.category)
  ORDER BY fc.is_primary DESC NULLS LAST, fc.rank ASC NULLS LAST;
END;
$$;

-- ============================================
-- 5. CREATE get_chronic_conditions function
-- Returns long-term/chronic conditions
-- ============================================
CREATE OR REPLACE FUNCTION public.get_chronic_conditions(patient_id_param uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  patient_id uuid,
  code text,
  code_display text,
  clinical_status text,
  verification_status text,
  category text[],
  severity_code text,
  onset_datetime timestamptz,
  recorded_date timestamptz,
  note text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fc.id,
    fc.patient_id,
    fc.code,
    fc.code_display,
    fc.clinical_status,
    fc.verification_status,
    fc.category,
    fc.severity_code,
    fc.onset_datetime,
    fc.recorded_date,
    fc.note
  FROM public.fhir_conditions fc
  WHERE (patient_id_param IS NULL OR fc.patient_id = patient_id_param)
    AND (
      'chronic' = ANY(fc.category)
      OR fc.clinical_status IN ('active', 'recurrence')
      AND fc.onset_datetime < NOW() - INTERVAL '6 months'
    )
  ORDER BY fc.onset_datetime DESC NULLS LAST;
END;
$$;

-- ============================================
-- 6. GRANT EXECUTE permissions
-- ============================================
GRANT EXECUTE ON FUNCTION public.get_active_conditions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_problem_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_encounter_diagnoses(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chronic_conditions(uuid) TO authenticated;

-- ============================================
-- 7. Allow patients to insert their own conditions
-- ============================================
DROP POLICY IF EXISTS "fhir_conditions_insert_own" ON public.fhir_conditions;
CREATE POLICY "fhir_conditions_insert_own" ON public.fhir_conditions
  FOR INSERT TO authenticated
  WITH CHECK (patient_id = auth.uid());

-- ============================================
-- 8. Allow patients to update their own conditions
-- ============================================
DROP POLICY IF EXISTS "fhir_conditions_update_own" ON public.fhir_conditions;
CREATE POLICY "fhir_conditions_update_own" ON public.fhir_conditions
  FOR UPDATE TO authenticated
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());
