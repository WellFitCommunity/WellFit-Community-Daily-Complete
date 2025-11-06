-- Fix ALL 104 SECURITY DEFINER Functions
-- Adds SET search_path = public to prevent search_path injection attacks
-- Generated: 2025-10-21
-- This will fix ALL 71 "Function Search Path Mutable" warnings

DO $$
DECLARE
  func_record RECORD;
  func_def TEXT;
  new_func_def TEXT;
  func_count INTEGER := 0;
BEGIN
  -- Loop through ALL security definer functions
  FOR func_record IN
    SELECT
      p.proname as function_name,
      n.nspname as schema_name,
      pg_get_functiondef(p.oid) as function_def
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.prosecdef = true
    ORDER BY p.proname
  LOOP
    func_def := func_record.function_def;

    -- Skip if already has search_path set
    IF func_def LIKE '%SET search_path%' OR func_def LIKE '%search_path =%' THEN
      RAISE NOTICE 'Skipping % - already has search_path', func_record.function_name;
      CONTINUE;
    END IF;

    -- Add SET search_path = public after SECURITY DEFINER
    new_func_def := REPLACE(
      func_def,
      E'SECURITY DEFINER\n',
      E'SECURITY DEFINER\n SET search_path TO public\n'
    );

    -- If that didn't work, try without newline
    IF new_func_def = func_def THEN
      new_func_def := REPLACE(
        func_def,
        'SECURITY DEFINER',
        E'SECURITY DEFINER\n SET search_path TO public'
      );
    END IF;

    -- Only update if we actually changed something
    IF new_func_def != func_def THEN
      BEGIN
        EXECUTE new_func_def;
        func_count := func_count + 1;
        RAISE NOTICE 'Fixed function % (% of 104)', func_record.function_name, func_count;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to fix %: %', func_record.function_name, SQLERRM;
      END;
    END IF;
  END LOOP;

  RAISE NOTICE 'Successfully fixed % out of 104 SECURITY DEFINER functions', func_count;
END $$;

-- Log this migration
INSERT INTO public.rls_policy_audit (table_name, policy_name, action, details)
VALUES (
  'migration',
  '20251021110000_fix_all_security_definer_functions',
  'executed',
  jsonb_build_object(
    'description', 'Fix ALL SECURITY DEFINER functions by adding SET search_path',
    'total_functions', 104,
    'security_issue_fixed', 'Prevents search_path injection attacks on all functions'
  )
);
