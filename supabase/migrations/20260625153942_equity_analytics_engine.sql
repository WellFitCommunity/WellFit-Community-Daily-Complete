-- Equity & Population-Health Analytics — Engine spine (Session 1)
-- =================================================================
-- Builds REPORT-GENERATED data (counts / %, distributions, cross-tabs) — never raw rows.
--
-- Two objects:
--   1. analytics_query_log  — audit trail of every analytics query (who / what spec / cell counts)
--   2. equity_aggregate()   — the engine. SECURITY DEFINER plpgsql aggregator whose dimension /
--                             measure / filter whitelist lives ENTIRELY in SQL. Because the SELECT
--                             list is assembled only from whitelisted aggregate expressions + GROUP BY,
--                             there is NO code path that can return a raw patient row. Aggregate-only
--                             by construction (safety invariant #1).
--
-- Suppression decision (Maria, 2026-06-25): we do NOT mask small cells. Masking n<11 would hide the
-- exact small / underserved demographic groups that equity analytics exists to surface. Instead every
-- cell carries a `low_n` flag (default threshold 11) and the caller may OPTIONALLY filter small cells
-- (p_min_cell_size) for a given report. The stricter researcher/de-identified tier enforcement lives in
-- the edge function, not here.

-- ----------------------------------------------------------------------------
-- 1. Audit table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_query_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id),
  requested_by    UUID NOT NULL REFERENCES auth.users(id),
  requester_role  TEXT,
  source          TEXT NOT NULL,
  measure         TEXT NOT NULL,
  dimensions      TEXT[] NOT NULL DEFAULT '{}',
  spec            JSONB NOT NULL,
  cell_count      INTEGER NOT NULL DEFAULT 0,
  low_n_cell_count INTEGER NOT NULL DEFAULT 0,
  min_cell_n      INTEGER,
  tier            TEXT NOT NULL DEFAULT 'standard',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_query_log ENABLE ROW LEVEL SECURITY;

-- Admins read their own tenant's analytics audit trail.
DROP POLICY IF EXISTS "analytics_query_log tenant admin read" ON public.analytics_query_log;
CREATE POLICY "analytics_query_log tenant admin read" ON public.analytics_query_log
  FOR SELECT
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

-- Identity-enforced INSERT for authenticated callers (requested_by must be the caller).
-- The edge function uses the service role, which bypasses RLS; this policy protects the
-- table against any direct authenticated insert (cannot spoof requested_by). (adversarial-audit-lessons §4)
DROP POLICY IF EXISTS "analytics_query_log self insert" ON public.analytics_query_log;
CREATE POLICY "analytics_query_log self insert" ON public.analytics_query_log
  FOR INSERT
  WITH CHECK (requested_by = auth.uid() AND tenant_id = get_current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_analytics_query_log_tenant
  ON public.analytics_query_log(tenant_id, created_at DESC);

COMMENT ON TABLE public.analytics_query_log IS
  'Audit trail for the equity-analytics engine: who ran which aggregate spec and the pre/post cell counts.';

-- ----------------------------------------------------------------------------
-- 2. The engine
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.equity_aggregate(
  p_tenant          UUID,
  p_source          TEXT,
  p_dimensions      TEXT[]  DEFAULT '{}',
  p_measure         TEXT    DEFAULT 'member_count',
  p_filters         JSONB   DEFAULT '[]'::jsonb,   -- [{"dimension":"gender","value":"female"}]
  p_time_grain      TEXT    DEFAULT NULL,           -- NULL | 'month' | 'quarter' | 'year'
  p_date_from       DATE    DEFAULT NULL,
  p_date_to         DATE    DEFAULT NULL,
  p_low_n_threshold INTEGER DEFAULT 11,
  p_min_cell_size   INTEGER DEFAULT NULL,           -- optional: drop cells below this n (else return all, flagged)
  p_row_limit       INTEGER DEFAULT 2000
)
RETURNS TABLE(cell JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base            TEXT;     -- base subquery exposing normalized columns
  v_has_ts          BOOLEAN := FALSE;
  v_allowed_dims    TEXT[];
  v_allowed_meas    TEXT[];
  v_measure_expr    TEXT;
  v_dim_key         TEXT;
  v_dim_expr        TEXT;
  v_obj_terms       TEXT[] := '{}';   -- jsonb_build_object key/expr pairs for dimensions
  v_group_terms     TEXT[] := '{}';
  v_filter          JSONB;
  v_filter_vals     TEXT[] := '{}';
  v_filter_idx      INTEGER := 0;
  v_where           TEXT := '';
  v_sql             TEXT;
  v_grain           TEXT;
BEGIN
  -- ---- Source whitelist: normalized base subquery + allowed dims/measures -------------------
  -- Every base exposes: member_id, base_tenant, ts, + demographic columns reachable for grouping.
  IF p_source = 'members' THEN
    v_has_ts := FALSE;
    v_base := $base$(
      SELECT p.user_id AS member_id, p.tenant_id AS base_tenant, NULL::timestamptz AS ts,
             p.dob, p.gender, p.race, p.race_omb_categories, p.ethnicity, p.ethnicity_omb,
             p.zip_code, p.income_range, p.insurance_type, p.primary_insurance,
             p.marital_status, p.living_situation, p.education_level,
             p.food_security, p.transportation_access, p.social_support, p.mobility_level,
             p.lives_alone, p.has_internet, p.has_smartphone,
             sd.preferred_language, sd.requires_interpreter, sd.veteran_status,
             ss.housing_type, ss.social_isolation_risk, ss.financial_stress_level,
             ss.needs_financial_assistance, ss.caregiver_burnout_risk,
             ss.uses_medical_alert_device, ss.has_regular_social_contact,
             NULL::numeric AS bp_systolic, NULL::numeric AS bp_diastolic, NULL::numeric AS heart_rate,
             NULL::numeric AS glucose_mg_dl, NULL::numeric AS readmission_risk_score,
             NULL::text AS risk_category, NULL::text AS sdoh_category, NULL::text AS z_code,
             NULL::text AS detection_risk_level, NULL::numeric AS confidence_score
      FROM profiles p
      LEFT JOIN senior_demographics sd ON sd.user_id = p.user_id
      LEFT JOIN senior_sdoh ss ON ss.user_id = p.user_id
      WHERE p.role IN ('senior','patient') OR p.role_code = 4
    )$base$;
    v_allowed_dims := ARRAY['race_omb','ethnicity_omb','gender','age_band','zcta3','income_range',
      'insurance_type','preferred_language','requires_interpreter','veteran_status','marital_status',
      'living_situation','education_level','food_security','transportation_access','social_support',
      'mobility_level','lives_alone','housing_type','social_isolation_risk','financial_stress_level',
      'needs_financial_assistance','caregiver_burnout_risk','has_internet'];
    v_allowed_meas := ARRAY['member_count','avg_age','pct_lives_alone','pct_requires_interpreter',
      'pct_needs_financial_assistance','pct_has_internet','pct_uses_medical_alert_device',
      'pct_socially_isolated'];

  ELSIF p_source = 'checkins' THEN
    v_has_ts := TRUE;
    v_base := $base$(
      SELECT c.user_id AS member_id, c.tenant_id AS base_tenant, c."timestamp" AS ts,
             p.dob, p.gender, p.race, p.race_omb_categories, p.ethnicity, p.ethnicity_omb,
             p.zip_code, p.income_range, p.insurance_type, p.primary_insurance,
             NULL::text AS marital_status, NULL::text AS living_situation, NULL::text AS education_level,
             p.food_security, p.transportation_access, p.social_support, p.mobility_level,
             p.lives_alone, p.has_internet, p.has_smartphone,
             sd.preferred_language, sd.requires_interpreter, sd.veteran_status,
             NULL::text AS housing_type, NULL::text AS social_isolation_risk, NULL::text AS financial_stress_level,
             NULL::boolean AS needs_financial_assistance, NULL::text AS caregiver_burnout_risk,
             NULL::boolean AS uses_medical_alert_device, NULL::boolean AS has_regular_social_contact,
             c.bp_systolic::numeric, c.bp_diastolic::numeric, c.heart_rate::numeric,
             c.glucose_mg_dl::numeric, NULL::numeric AS readmission_risk_score,
             NULL::text AS risk_category, NULL::text AS sdoh_category, NULL::text AS z_code,
             NULL::text AS detection_risk_level, NULL::numeric AS confidence_score
      FROM check_ins c
      JOIN profiles p ON p.user_id = c.user_id
      LEFT JOIN senior_demographics sd ON sd.user_id = c.user_id
    )$base$;
    v_allowed_dims := ARRAY['race_omb','ethnicity_omb','gender','age_band','zcta3','income_range',
      'insurance_type','preferred_language','veteran_status','food_security','transportation_access'];
    v_allowed_meas := ARRAY['total_checkins','avg_bp_systolic','avg_bp_diastolic','avg_heart_rate','avg_glucose'];

  ELSIF p_source = 'readmission' THEN
    v_has_ts := TRUE;
    v_base := $base$(
      SELECT r.patient_id AS member_id, r.tenant_id AS base_tenant, r.created_at AS ts,
             p.dob, p.gender, p.race, p.race_omb_categories, p.ethnicity, p.ethnicity_omb,
             p.zip_code, p.income_range, p.insurance_type, p.primary_insurance,
             NULL::text AS marital_status, NULL::text AS living_situation, NULL::text AS education_level,
             p.food_security, p.transportation_access, p.social_support, p.mobility_level,
             p.lives_alone, p.has_internet, p.has_smartphone,
             sd.preferred_language, sd.requires_interpreter, sd.veteran_status,
             NULL::text AS housing_type, NULL::text AS social_isolation_risk, NULL::text AS financial_stress_level,
             NULL::boolean AS needs_financial_assistance, NULL::text AS caregiver_burnout_risk,
             NULL::boolean AS uses_medical_alert_device, NULL::boolean AS has_regular_social_contact,
             NULL::numeric AS bp_systolic, NULL::numeric AS bp_diastolic, NULL::numeric AS heart_rate,
             NULL::numeric AS glucose_mg_dl, r.readmission_risk_score::numeric,
             r.risk_category, NULL::text AS sdoh_category, NULL::text AS z_code,
             NULL::text AS detection_risk_level, NULL::numeric AS confidence_score
      FROM readmission_risk_predictions r
      JOIN profiles p ON p.user_id = r.patient_id
      LEFT JOIN senior_demographics sd ON sd.user_id = r.patient_id
    )$base$;
    v_allowed_dims := ARRAY['race_omb','ethnicity_omb','gender','age_band','zcta3','income_range',
      'insurance_type','preferred_language','veteran_status','risk_category'];
    v_allowed_meas := ARRAY['prediction_count','avg_readmission_risk'];

  ELSIF p_source = 'sdoh_detections' THEN
    v_has_ts := TRUE;
    v_base := $base$(
      SELECT d.patient_id AS member_id, d.tenant_id AS base_tenant, d.detected_at AS ts,
             p.dob, p.gender, p.race, p.race_omb_categories, p.ethnicity, p.ethnicity_omb,
             p.zip_code, p.income_range, p.insurance_type, p.primary_insurance,
             NULL::text AS marital_status, NULL::text AS living_situation, NULL::text AS education_level,
             p.food_security, p.transportation_access, p.social_support, p.mobility_level,
             p.lives_alone, p.has_internet, p.has_smartphone,
             sd.preferred_language, sd.requires_interpreter, sd.veteran_status,
             NULL::text AS housing_type, NULL::text AS social_isolation_risk, NULL::text AS financial_stress_level,
             NULL::boolean AS needs_financial_assistance, NULL::text AS caregiver_burnout_risk,
             NULL::boolean AS uses_medical_alert_device, NULL::boolean AS has_regular_social_contact,
             NULL::numeric AS bp_systolic, NULL::numeric AS bp_diastolic, NULL::numeric AS heart_rate,
             NULL::numeric AS glucose_mg_dl, NULL::numeric AS readmission_risk_score,
             NULL::text AS risk_category, d.sdoh_category, d.z_code_mapping AS z_code,
             d.risk_level AS detection_risk_level, d.confidence_score::numeric
      FROM passive_sdoh_detections d
      JOIN profiles p ON p.user_id = d.patient_id
      LEFT JOIN senior_demographics sd ON sd.user_id = d.patient_id
    )$base$;
    v_allowed_dims := ARRAY['race_omb','ethnicity_omb','gender','age_band','zcta3','income_range',
      'insurance_type','preferred_language','veteran_status','sdoh_category','z_code','detection_risk_level'];
    v_allowed_meas := ARRAY['detection_count','avg_confidence'];

  ELSE
    RAISE EXCEPTION 'equity_aggregate: unknown source %', p_source USING ERRCODE = '22023';
  END IF;

  -- ---- Measure whitelist ------------------------------------------------------------------
  IF NOT (p_measure = ANY(v_allowed_meas)) THEN
    RAISE EXCEPTION 'equity_aggregate: measure % not allowed for source %', p_measure, p_source USING ERRCODE = '22023';
  END IF;
  v_measure_expr := CASE p_measure
    WHEN 'member_count'                 THEN 'COUNT(DISTINCT member_id)'
    WHEN 'avg_age'                      THEN 'ROUND(AVG(date_part(''year'', age(dob)))::numeric, 1)'
    WHEN 'pct_lives_alone'              THEN 'ROUND(100.0 * AVG(CASE WHEN lives_alone THEN 1 WHEN lives_alone IS FALSE THEN 0 END), 1)'
    WHEN 'pct_requires_interpreter'     THEN 'ROUND(100.0 * AVG(CASE WHEN requires_interpreter THEN 1 WHEN requires_interpreter IS FALSE THEN 0 END), 1)'
    WHEN 'pct_needs_financial_assistance' THEN 'ROUND(100.0 * AVG(CASE WHEN needs_financial_assistance THEN 1 WHEN needs_financial_assistance IS FALSE THEN 0 END), 1)'
    WHEN 'pct_has_internet'             THEN 'ROUND(100.0 * AVG(CASE WHEN has_internet THEN 1 WHEN has_internet IS FALSE THEN 0 END), 1)'
    WHEN 'pct_uses_medical_alert_device' THEN 'ROUND(100.0 * AVG(CASE WHEN uses_medical_alert_device THEN 1 WHEN uses_medical_alert_device IS FALSE THEN 0 END), 1)'
    WHEN 'pct_socially_isolated'        THEN 'ROUND(100.0 * AVG(CASE WHEN social_isolation_risk IN (''high'',''severe'',''moderate'') THEN 1 WHEN social_isolation_risk IS NOT NULL THEN 0 END), 1)'
    WHEN 'total_checkins'              THEN 'COUNT(*)'
    WHEN 'avg_bp_systolic'             THEN 'ROUND(AVG(bp_systolic), 1)'
    WHEN 'avg_bp_diastolic'            THEN 'ROUND(AVG(bp_diastolic), 1)'
    WHEN 'avg_heart_rate'              THEN 'ROUND(AVG(heart_rate), 1)'
    WHEN 'avg_glucose'                 THEN 'ROUND(AVG(glucose_mg_dl), 1)'
    WHEN 'prediction_count'            THEN 'COUNT(*)'
    WHEN 'avg_readmission_risk'        THEN 'ROUND(AVG(readmission_risk_score)::numeric, 3)'
    WHEN 'detection_count'             THEN 'COUNT(*)'
    WHEN 'avg_confidence'              THEN 'ROUND(AVG(confidence_score)::numeric, 3)'
  END;

  -- ---- Dimensions (validated key -> fixed group expression) -------------------------------
  -- Optional time bucket prepended as a pseudo-dimension when requested and the source has a timestamp.
  IF p_time_grain IS NOT NULL AND v_has_ts THEN
    v_grain := lower(p_time_grain);
    IF NOT (v_grain = ANY(ARRAY['month','quarter','year'])) THEN
      RAISE EXCEPTION 'equity_aggregate: bad time_grain %', p_time_grain USING ERRCODE = '22023';
    END IF;
    v_obj_terms := v_obj_terms || ARRAY[ quote_literal('time_bucket') || ', to_char(date_trunc(' || quote_literal(v_grain) || ', ts), ''YYYY-MM-DD'')' ];
    v_group_terms := v_group_terms || ARRAY[ 'to_char(date_trunc(' || quote_literal(v_grain) || ', ts), ''YYYY-MM-DD'')' ];
  END IF;

  FOREACH v_dim_key IN ARRAY p_dimensions LOOP
    IF NOT (v_dim_key = ANY(v_allowed_dims)) THEN
      RAISE EXCEPTION 'equity_aggregate: dimension % not allowed for source %', v_dim_key, p_source USING ERRCODE = '22023';
    END IF;
    v_dim_expr := public._equity_dim_expr(v_dim_key);
    v_obj_terms := v_obj_terms || ARRAY[ quote_literal(v_dim_key) || ', ' || v_dim_expr ];
    v_group_terms := v_group_terms || ARRAY[ v_dim_expr ];
  END LOOP;

  -- ---- Filters (equality on a whitelisted dimension; values parameterized) -----------------
  v_where := ' WHERE base_tenant = $1 ';
  IF jsonb_typeof(p_filters) = 'array' THEN
    FOR v_filter IN SELECT * FROM jsonb_array_elements(p_filters) LOOP
      v_dim_key := v_filter->>'dimension';
      IF NOT (v_dim_key = ANY(v_allowed_dims)) THEN
        RAISE EXCEPTION 'equity_aggregate: filter dimension % not allowed', v_dim_key USING ERRCODE = '22023';
      END IF;
      v_filter_idx := v_filter_idx + 1;
      v_filter_vals := v_filter_vals || ARRAY[ v_filter->>'value' ];
      v_where := v_where || ' AND ' || public._equity_dim_expr(v_dim_key) || ' = ($2)[' || v_filter_idx || '] ';
    END LOOP;
  END IF;

  -- Date range on the source timestamp.
  IF v_has_ts THEN
    IF p_date_from IS NOT NULL THEN v_where := v_where || ' AND ts >= $3 '; END IF;
    IF p_date_to   IS NOT NULL THEN v_where := v_where || ' AND ts < ($4::date + 1) '; END IF;
  END IF;

  -- ---- Assemble the ONE aggregate query ----------------------------------------------------
  v_sql :=
    'SELECT jsonb_build_object(' ||
      CASE WHEN array_length(v_obj_terms,1) IS NULL THEN '' ELSE array_to_string(v_obj_terms, ', ') || ', ' END ||
      '''value'', ' || v_measure_expr || ', ' ||
      '''cell_n'', COUNT(*), ' ||
      '''low_n'', (COUNT(*) < ' || p_low_n_threshold || ')' ||
    ') AS cell ' ||
    'FROM ' || v_base || ' src ' || v_where ||
    CASE WHEN array_length(v_group_terms,1) IS NULL THEN '' ELSE ' GROUP BY ' || array_to_string(v_group_terms, ', ') END ||
    CASE WHEN p_min_cell_size IS NOT NULL THEN ' HAVING COUNT(*) >= ' || p_min_cell_size ELSE '' END ||
    ' ORDER BY COUNT(*) DESC ' ||
    ' LIMIT ' || GREATEST(1, LEAST(p_row_limit, 5000));

  RETURN QUERY EXECUTE v_sql USING p_tenant, v_filter_vals, p_date_from, p_date_to;
END;
$$;

-- Dimension expression resolver — fixed mapping, no user input ever reaches identifiers.
CREATE OR REPLACE FUNCTION public._equity_dim_expr(p_key TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_key
    -- Free-text categoricals are case/whitespace-normalized so e.g. ''Female''/''female'' merge into
    -- one cell — splitting them would undercount a subgroup, which is exactly the distortion equity
    -- analytics must avoid.
    WHEN 'race_omb'        THEN 'COALESCE(initcap(NULLIF(trim((race_omb_categories)[1]), '''')), initcap(NULLIF(trim(race), '''')), ''Unknown'')'
    WHEN 'ethnicity_omb'   THEN 'COALESCE(initcap(NULLIF(trim(ethnicity_omb), '''')), initcap(NULLIF(trim(ethnicity), '''')), ''Unknown'')'
    WHEN 'gender'          THEN 'COALESCE(initcap(NULLIF(trim(gender), '''')), ''Unknown'')'
    WHEN 'age_band'        THEN 'CASE WHEN dob IS NULL THEN ''Unknown'' WHEN date_part(''year'', age(dob)) < 65 THEN ''<65'' WHEN date_part(''year'', age(dob)) < 75 THEN ''65-74'' WHEN date_part(''year'', age(dob)) < 85 THEN ''75-84'' ELSE ''85+'' END'
    WHEN 'zcta3'           THEN 'COALESCE(NULLIF(LEFT(zip_code, 3), ''''), ''Unknown'')'
    WHEN 'income_range'    THEN 'COALESCE(NULLIF(income_range, ''''), ''Unknown'')'
    WHEN 'insurance_type'  THEN 'COALESCE(NULLIF(insurance_type, ''''), NULLIF(primary_insurance, ''''), ''Unknown'')'
    WHEN 'preferred_language' THEN 'COALESCE(NULLIF(preferred_language, ''''), ''Unknown'')'
    WHEN 'marital_status'  THEN 'COALESCE(NULLIF(marital_status, ''''), ''Unknown'')'
    WHEN 'living_situation' THEN 'COALESCE(NULLIF(living_situation, ''''), ''Unknown'')'
    WHEN 'education_level' THEN 'COALESCE(NULLIF(education_level, ''''), ''Unknown'')'
    WHEN 'food_security'   THEN 'COALESCE(NULLIF(food_security, ''''), ''Unknown'')'
    WHEN 'transportation_access' THEN 'COALESCE(NULLIF(transportation_access, ''''), ''Unknown'')'
    WHEN 'social_support'  THEN 'COALESCE(NULLIF(social_support, ''''), ''Unknown'')'
    WHEN 'mobility_level'  THEN 'COALESCE(NULLIF(mobility_level, ''''), ''Unknown'')'
    WHEN 'housing_type'    THEN 'COALESCE(NULLIF(housing_type, ''''), ''Unknown'')'
    WHEN 'social_isolation_risk' THEN 'COALESCE(NULLIF(social_isolation_risk, ''''), ''Unknown'')'
    WHEN 'financial_stress_level' THEN 'COALESCE(NULLIF(financial_stress_level, ''''), ''Unknown'')'
    WHEN 'caregiver_burnout_risk' THEN 'COALESCE(NULLIF(caregiver_burnout_risk, ''''), ''Unknown'')'
    WHEN 'sdoh_category'   THEN 'COALESCE(NULLIF(sdoh_category, ''''), ''Unknown'')'
    WHEN 'z_code'          THEN 'COALESCE(NULLIF(z_code, ''''), ''Unknown'')'
    WHEN 'detection_risk_level' THEN 'COALESCE(NULLIF(detection_risk_level, ''''), ''Unknown'')'
    WHEN 'risk_category'   THEN 'COALESCE(NULLIF(risk_category, ''''), ''Unknown'')'
    WHEN 'lives_alone'             THEN 'CASE WHEN lives_alone THEN ''Yes'' WHEN lives_alone IS FALSE THEN ''No'' ELSE ''Unknown'' END'
    WHEN 'requires_interpreter'    THEN 'CASE WHEN requires_interpreter THEN ''Yes'' WHEN requires_interpreter IS FALSE THEN ''No'' ELSE ''Unknown'' END'
    WHEN 'veteran_status'          THEN 'CASE WHEN veteran_status THEN ''Yes'' WHEN veteran_status IS FALSE THEN ''No'' ELSE ''Unknown'' END'
    WHEN 'needs_financial_assistance' THEN 'CASE WHEN needs_financial_assistance THEN ''Yes'' WHEN needs_financial_assistance IS FALSE THEN ''No'' ELSE ''Unknown'' END'
    WHEN 'has_internet'            THEN 'CASE WHEN has_internet THEN ''Yes'' WHEN has_internet IS FALSE THEN ''No'' ELSE ''Unknown'' END'
    ELSE NULL
  END;
$$;

-- Lock down execution: only the service role (edge function) calls this. Never anon.
REVOKE ALL ON FUNCTION public.equity_aggregate(UUID, TEXT, TEXT[], TEXT, JSONB, TEXT, DATE, DATE, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.equity_aggregate(UUID, TEXT, TEXT[], TEXT, JSONB, TEXT, DATE, DATE, INTEGER, INTEGER, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public._equity_dim_expr(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._equity_dim_expr(TEXT) FROM anon;

COMMENT ON FUNCTION public.equity_aggregate IS
  'Equity-analytics engine. Emits aggregate report rows (counts / %, distributions, cross-tabs) only — '
  'dimension/measure/filter whitelist is enforced server-side so no raw patient row can be returned. '
  'Tenant-scoped via p_tenant. Small cells are flagged (low_n), never masked (Maria 2026-06-25).';
