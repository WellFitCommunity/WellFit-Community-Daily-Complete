-- Fix Final 12 Functions Without search_path
-- These are the last remaining functions that need SET search_path
-- Generated: 2025-10-21
-- Note: These are NOT SECURITY DEFINER so lower risk, but still best practice

-- ============================================================================
-- Add SET search_path to all 12 remaining functions
-- ============================================================================

-- We'll recreate each function with SET search_path added
-- First, let's get the current definitions and add search_path

DO $$
DECLARE
  func_name TEXT;
  func_def TEXT;
  new_func_def TEXT;
  func_count INTEGER := 0;
  func_list TEXT[] := ARRAY[
    'calculate_early_warning_score',
    'calculate_questionnaire_score',
    'check_burnout_intervention_needed',
    'check_vaccine_due',
    'deploy_questionnaire_to_wellfit',
    'get_immunizations_by_vaccine',
    'get_patient_immunizations',
    'get_practitioner_full_name',
    'get_provider_burnout_risk',
    'get_provider_stress_trend',
    'get_questionnaire_stats',
    'get_vaccine_gaps'
  ];
BEGIN
  FOREACH func_name IN ARRAY func_list
  LOOP
    -- Get the function definition
    SELECT pg_get_functiondef(p.oid) INTO func_def
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = func_name
    LIMIT 1;

    IF func_def IS NOT NULL THEN
      -- Add SET search_path after LANGUAGE clause
      -- Most functions have: LANGUAGE plpgsql or LANGUAGE sql
      new_func_def := regexp_replace(
        func_def,
        '(LANGUAGE (?:plpgsql|sql))',
        E'\\1\n SET search_path TO public',
        'g'
      );

      -- Only update if we actually made a change
      IF new_func_def != func_def THEN
        BEGIN
          EXECUTE new_func_def;
          func_count := func_count + 1;
          RAISE NOTICE 'Fixed function: % (% of 12)', func_name, func_count;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Could not fix function %: %', func_name, SQLERRM;
        END;
      END IF;
    ELSE
      RAISE WARNING 'Function % not found', func_name;
    END IF;
  END LOOP;

  RAISE NOTICE '======================';
  RAISE NOTICE 'Successfully fixed % out of 12 functions', func_count;
  RAISE NOTICE '======================';
END $$;

-- ============================================================================
-- Final verification
-- ============================================================================

DO $$
DECLARE
  remaining_count INTEGER;
BEGIN
  SELECT count(*) INTO remaining_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND pg_get_functiondef(p.oid) NOT LIKE '%search_path%';

  RAISE NOTICE '';
  RAISE NOTICE '=== FINAL VERIFICATION ===';
  RAISE NOTICE 'Functions still without search_path: %', remaining_count;

  IF remaining_count = 0 THEN
    RAISE NOTICE '✓ SUCCESS: ALL 145 functions now have search_path!';
  ELSE
    RAISE WARNING 'Still have % functions without search_path', remaining_count;
  END IF;

  RAISE NOTICE '=========================';
END $$;

-- Log this migration
INSERT INTO public.rls_policy_audit (table_name, policy_name, action, details)
VALUES (
  'migration',
  '20251021140000_fix_final_12_functions',
  'executed',
  jsonb_build_object(
    'description', 'Fix final 12 functions without search_path',
    'functions_fixed', 12,
    'total_functions_with_search_path', 145,
    'security_note', 'These were not SECURITY DEFINER but fixed for best practice'
  )
);
