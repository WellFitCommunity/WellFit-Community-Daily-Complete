-- =============================================================================
-- documentation_templates: richer field metadata (T-4)
-- =============================================================================
-- Tracker: Claude self-audit Session 5, T-4
--
-- Problem: required_fields / optional_fields stored as {name: type} object,
--   dropping label, placeholder, options, required metadata that admins enter
--   in TemplateMaker.tsx. Round-tripping the data through Save -> Load loses
--   everything except (name, type) and auto-regenerates label from snake_case.
--
-- Fix:
--   1. Introduce a `field_schema_version` column (default 1 for legacy rows).
--      Version 1 = {name: type}.
--      Version 2 = [{name, type, label, placeholder, options, required}, ...].
--   2. Convert any existing v1 object-shaped rows in place to v2 array shape
--      and bump their field_schema_version to 2. We use jsonb_object_keys
--      to walk the keys and reconstruct the new array. Existing labels are
--      derived from name (snake_case -> Title Case) — same fallback the UI
--      previously used.
--   3. Old clients (pre-T-4) can detect v2 via field_schema_version and
--      refuse to render, avoiding the array-vs-object type confusion.
--
-- Backward compatibility:
--   This migration is one-way at the data shape level (object -> array). The
--   field_schema_version sentinel exists specifically to let older code
--   detect v2 rows and skip them instead of crashing on `Object.entries(...)`.
--
-- Notes:
--   - Per "RUN WHAT YOU CREATE" (supabase.md §1), applied via Supabase MCP
--     after this file lands.
--   - As of writing, documentation_templates has 0 rows in production, so
--     the conversion is essentially a no-op — but it is written to be
--     idempotent and safe to run against populated tables.
-- =============================================================================

-- 1) Add schema-version column (default 1 = legacy {name: type} shape)
ALTER TABLE public.documentation_templates
  ADD COLUMN IF NOT EXISTS field_schema_version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.documentation_templates.field_schema_version IS
  'Schema version for required_fields/optional_fields JSONB. v1 = {name: type} object (legacy). v2 = [{name, type, label, placeholder, options, required}] array (T-4).';

-- 2) Helper: convert a v1 {name: type} object into a v2 array with the
--    fallback label derivation TemplateMaker previously used in JS:
--      label = name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
--
-- We approximate Title Case in SQL via initcap() on the underscore-replaced
-- name. (initcap upper-cases the first letter of every space-delimited word.)
CREATE OR REPLACE FUNCTION public._documentation_templates_object_to_array(
  fields JSONB,
  is_required_block BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  k TEXT;
  v TEXT;
  out_array JSONB := '[]'::jsonb;
BEGIN
  IF fields IS NULL OR jsonb_typeof(fields) <> 'object' THEN
    -- Already an array, or null/garbage — return as-is (caller decides).
    RETURN COALESCE(fields, '[]'::jsonb);
  END IF;

  FOR k, v IN SELECT key, value #>> '{}' FROM jsonb_each(fields) LOOP
    out_array := out_array || jsonb_build_array(
      jsonb_build_object(
        'name', k,
        'type', v,
        'label', initcap(replace(k, '_', ' ')),
        'placeholder', NULL,
        'options', NULL,
        'required', is_required_block
      )
    );
  END LOOP;

  RETURN out_array;
END;
$$;

-- 3) Convert any existing v1 rows in place
UPDATE public.documentation_templates
SET
  required_fields = public._documentation_templates_object_to_array(required_fields, TRUE),
  optional_fields = public._documentation_templates_object_to_array(optional_fields, FALSE),
  field_schema_version = 2
WHERE field_schema_version = 1
  AND (
    jsonb_typeof(required_fields) = 'object'
    OR jsonb_typeof(optional_fields) = 'object'
  );

-- 4) Drop the helper — it is one-shot, not part of the runtime surface.
DROP FUNCTION IF EXISTS public._documentation_templates_object_to_array(JSONB, BOOLEAN);

-- 5) Update column comments to reflect new shape expectations
COMMENT ON COLUMN public.documentation_templates.required_fields IS
  'v2 (field_schema_version=2): JSON array of [{name, type, label, placeholder, options, required}]. v1 (legacy): JSON object {field_name: field_type}.';

COMMENT ON COLUMN public.documentation_templates.optional_fields IS
  'v2 (field_schema_version=2): JSON array of [{name, type, label, placeholder, options, required}]. v1 (legacy): JSON object {field_name: field_type}.';
