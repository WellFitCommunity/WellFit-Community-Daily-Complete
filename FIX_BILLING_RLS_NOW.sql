-- ============================================================================
-- IMMEDIATE FIX for Billing 403 Errors
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================================

-- Step 1: Fix is_admin() function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE user_id = auth.uid();

  RETURN user_role IN ('admin', 'super_admin');
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Step 2: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- Step 3: Fix billing_providers policies
ALTER TABLE public.billing_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_providers_admin_all" ON public.billing_providers;
DROP POLICY IF EXISTS "billing_providers_read_all" ON public.billing_providers;
DROP POLICY IF EXISTS "billing_providers_select_all" ON public.billing_providers;
DROP POLICY IF EXISTS "billing_providers_admin_full" ON public.billing_providers;
DROP POLICY IF EXISTS "billing_providers_authenticated_select" ON public.billing_providers;

-- Allow ALL authenticated users to READ providers
CREATE POLICY "billing_providers_select"
ON public.billing_providers
FOR SELECT
TO authenticated
USING (true);

-- Allow admins to manage
CREATE POLICY "billing_providers_admin"
ON public.billing_providers
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

GRANT SELECT ON public.billing_providers TO authenticated;

-- Step 4: Fix claims policies
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "claims_admin_all" ON public.claims;
DROP POLICY IF EXISTS "claims_user_read_own" ON public.claims;
DROP POLICY IF EXISTS "claims_admin_full_access" ON public.claims;
DROP POLICY IF EXISTS "claims_creator_select_own" ON public.claims;
DROP POLICY IF EXISTS "claims_creator_insert_own" ON public.claims;
DROP POLICY IF EXISTS "claims_admin_full" ON public.claims;
DROP POLICY IF EXISTS "claims_creator_select" ON public.claims;
DROP POLICY IF EXISTS "claims_creator_insert" ON public.claims;

-- Admin full access
CREATE POLICY "claims_admin"
ON public.claims
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Users can read their own
CREATE POLICY "claims_select_own"
ON public.claims
FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- Users can create their own
CREATE POLICY "claims_insert_own"
ON public.claims
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

GRANT SELECT, INSERT ON public.claims TO authenticated;

-- Step 5: Verify
SELECT
  'billing_providers' as table_name,
  policyname,
  cmd as operation,
  CASE
    WHEN qual LIKE '%is_admin%' THEN 'Admin only'
    WHEN qual = 'true' THEN 'All users'
    ELSE 'Conditional'
  END as access
FROM pg_policies
WHERE tablename = 'billing_providers'
UNION ALL
SELECT
  'claims' as table_name,
  policyname,
  cmd as operation,
  CASE
    WHEN qual LIKE '%is_admin%' THEN 'Admin only'
    WHEN qual LIKE '%created_by%' THEN 'Own records'
    ELSE 'Other'
  END as access
FROM pg_policies
WHERE tablename = 'claims'
ORDER BY table_name, policyname;
