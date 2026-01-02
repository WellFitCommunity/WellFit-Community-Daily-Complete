-- Fix invalidate_patient_summary_cache trigger function
-- The function was referencing NEW.user_id which doesn't exist on the encounters table
-- (encounters has patient_id, not user_id)

CREATE OR REPLACE FUNCTION public.invalidate_patient_summary_cache()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
DECLARE
  v_patient_id text;
BEGIN
  -- Handle different table schemas:
  -- Some tables use 'user_id' (profiles, check_ins, medications)
  -- Some tables use 'patient_id' (encounters, fhir_* tables)

  -- Try to get patient identifier from the record
  -- Use patient_id if available, otherwise fall back to user_id, then id
  BEGIN
    -- First try patient_id (encounters, fhir tables)
    IF TG_OP = 'DELETE' THEN
      v_patient_id := OLD.patient_id::text;
    ELSE
      v_patient_id := NEW.patient_id::text;
    END IF;
  EXCEPTION WHEN undefined_column THEN
    BEGIN
      -- Fall back to user_id (profiles, medications, check_ins)
      IF TG_OP = 'DELETE' THEN
        v_patient_id := OLD.user_id::text;
      ELSE
        v_patient_id := NEW.user_id::text;
      END IF;
    EXCEPTION WHEN undefined_column THEN
      -- Last resort: use id
      IF TG_OP = 'DELETE' THEN
        v_patient_id := OLD.id::text;
      ELSE
        v_patient_id := NEW.id::text;
      END IF;
    END;
  END;

  -- Delete cached queries related to this patient
  IF v_patient_id IS NOT NULL THEN
    DELETE FROM query_result_cache
    WHERE cache_namespace = 'patient_lookup'
      AND result_data->>'patient_id' = v_patient_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Add comment explaining the fix
COMMENT ON FUNCTION public.invalidate_patient_summary_cache() IS
'Cache invalidation trigger that works with both user_id and patient_id columns.
Fixed in 20260102000000 to handle encounters table which uses patient_id.';

DO $$
BEGIN
  RAISE NOTICE '✅ Fixed invalidate_patient_summary_cache trigger';
  RAISE NOTICE '   Now handles both user_id and patient_id columns';
END $$;
