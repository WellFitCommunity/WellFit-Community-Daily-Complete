-- =====================================================
-- Fix Database Schema Errors
-- Date: 2026-01-30
-- Purpose: Fix log_phi_access RPC and add missing FK
-- =====================================================

-- 1. Fix log_phi_access function to use correct audit_logs columns
CREATE OR REPLACE FUNCTION public.log_phi_access(
  p_resource_type text,
  p_resource_id uuid,
  p_action text DEFAULT 'VIEW'::text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    actor_user_id,
    operation,
    resource_type,
    resource_id,
    event_type,
    event_category,
    metadata,
    success,
    timestamp
  ) VALUES (
    auth.uid(),
    'PHI_ACCESS_' || UPPER(p_action),
    p_resource_type,
    p_resource_id::text,
    'PHI_ACCESS',
    'security',
    p_metadata || jsonb_build_object(
      'access_type', p_action,
      'access_timestamp', NOW(),
      'ip_address', current_setting('request.headers', true)::json->>'x-forwarded-for'
    ),
    true,
    NOW()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$function$;

-- 2. Add FK from community_moments.user_id to profiles.user_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'community_moments_user_id_fkey'
    AND table_name = 'community_moments'
  ) THEN
    ALTER TABLE community_moments
    ADD CONSTRAINT community_moments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  -- FK may fail if orphaned records exist, log and continue
  RAISE NOTICE 'Could not add FK community_moments_user_id_fkey: %', SQLERRM;
END $$;

-- 3. Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.log_phi_access(text, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_phi_access(text, uuid, text, jsonb) TO service_role;
