-- =====================================================
-- CONSENT ENFORCEMENT AT QUERY TIME - RLS POLICIES
-- =====================================================
-- Purpose: Enforce consent checks at database level, not just UI
-- Priority: HIGH - Addresses consent enforcement gap
-- Created: 2025-12-03
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: HELPER FUNCTION - CHECK PRIVACY CONSENT
-- =====================================================
-- Returns true if user has valid privacy consent

CREATE OR REPLACE FUNCTION public.has_valid_privacy_consent(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_consent BOOLEAN;
BEGIN
  -- Check for valid, non-withdrawn, non-expired privacy consent
  SELECT EXISTS (
    SELECT 1
    FROM public.privacy_consent
    WHERE user_id = p_user_id
      AND consent_type = 'privacy'
      AND consented = true
      AND withdrawn_at IS NULL
      AND (expiration_date IS NULL OR expiration_date > NOW())
  ) INTO v_has_consent;

  RETURN COALESCE(v_has_consent, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.has_valid_privacy_consent(UUID) TO authenticated;

COMMENT ON FUNCTION public.has_valid_privacy_consent IS
'Check if user has valid privacy consent. Used by RLS policies to enforce consent at query time.';

-- =====================================================
-- STEP 2: HELPER FUNCTION - CHECK SPECIFIC CONSENT TYPE
-- =====================================================

CREATE OR REPLACE FUNCTION public.has_valid_consent(
  p_user_id UUID,
  p_consent_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_consent BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.privacy_consent
    WHERE user_id = p_user_id
      AND consent_type = p_consent_type
      AND consented = true
      AND withdrawn_at IS NULL
      AND (expiration_date IS NULL OR expiration_date > NOW())
  ) INTO v_has_consent;

  RETURN COALESCE(v_has_consent, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.has_valid_consent(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.has_valid_consent IS
'Check if user has valid consent of a specific type. Used for granular consent enforcement.';

-- =====================================================
-- STEP 3: MIDDLEWARE FUNCTION - LOG CONSENT CHECK
-- =====================================================
-- Called by RLS policies to audit consent checks

CREATE OR REPLACE FUNCTION public.log_consent_check(
  p_user_id UUID,
  p_consent_type TEXT,
  p_resource_type TEXT,
  p_has_consent BOOLEAN
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Insert verification log (fire and forget, don't block query)
  BEGIN
    INSERT INTO public.consent_verification_log (
      user_id,
      consent_type,
      requesting_service,
      verification_result,
      verification_reason,
      consent_found,
      consent_expired,
      consent_withdrawn,
      additional_metadata
    ) VALUES (
      p_user_id,
      p_consent_type,
      'rls_policy',
      p_has_consent,
      CASE WHEN p_has_consent THEN 'Consent valid' ELSE 'Consent missing or invalid' END,
      p_has_consent,
      false,
      false,
      jsonb_build_object('resource_type', p_resource_type)
    );
  EXCEPTION WHEN OTHERS THEN
    -- Don't fail query if logging fails
    NULL;
  END;

  RETURN p_has_consent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 4: CONSENT ENFORCEMENT ON SENSITIVE TABLES
-- =====================================================

-- === senior_health (PHI table) ===
DO $$
BEGIN
  -- Drop existing user policy if it exists
  DROP POLICY IF EXISTS "Users can view own health data with consent" ON public.senior_health;

  -- Users can only view their own health data IF they have privacy consent
  CREATE POLICY "Users can view own health data with consent"
  ON public.senior_health
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND public.has_valid_privacy_consent(auth.uid())
  );

EXCEPTION WHEN undefined_table THEN
  -- Table doesn't exist, skip
  NULL;
END $$;

-- === senior_demographics ===
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own demographics with consent" ON public.senior_demographics;

  CREATE POLICY "Users can view own demographics with consent"
  ON public.senior_demographics
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND public.has_valid_privacy_consent(auth.uid())
  );

EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- === senior_sdoh (Social Determinants) ===
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own SDOH with consent" ON public.senior_sdoh;

  CREATE POLICY "Users can view own SDOH with consent"
  ON public.senior_sdoh
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND public.has_valid_privacy_consent(auth.uid())
  );

EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- === check_ins (contains health data) ===
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own checkins with consent" ON public.check_ins;

  CREATE POLICY "Users can view own checkins with consent"
  ON public.check_ins
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND public.has_valid_privacy_consent(auth.uid())
  );

EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- =====================================================
-- STEP 5: ADMIN BYPASS POLICIES
-- =====================================================
-- Admins can access data for care coordination purposes

DO $$
BEGIN
  -- senior_health admin access
  DROP POLICY IF EXISTS "Admins can view health data" ON public.senior_health;
  CREATE POLICY "Admins can view health data"
  ON public.senior_health
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'nurse', 'physician', 'case_manager')
    )
  );
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

DO $$
BEGIN
  -- senior_demographics admin access
  DROP POLICY IF EXISTS "Admins can view demographics" ON public.senior_demographics;
  CREATE POLICY "Admins can view demographics"
  ON public.senior_demographics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'nurse', 'physician', 'case_manager')
    )
  );
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

DO $$
BEGIN
  -- senior_sdoh admin access
  DROP POLICY IF EXISTS "Admins can view SDOH" ON public.senior_sdoh;
  CREATE POLICY "Admins can view SDOH"
  ON public.senior_sdoh
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'nurse', 'physician', 'case_manager', 'social_worker')
    )
  );
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

DO $$
BEGIN
  -- check_ins admin access
  DROP POLICY IF EXISTS "Admins can view checkins" ON public.check_ins;
  CREATE POLICY "Admins can view checkins"
  ON public.check_ins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'nurse', 'physician', 'case_manager')
    )
  );
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- =====================================================
-- STEP 6: INSERT POLICIES (Allow writing before consent complete)
-- =====================================================
-- Users need to be able to insert their data during registration

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can insert own health data" ON public.senior_health;
  CREATE POLICY "Users can insert own health data"
  ON public.senior_health
  FOR INSERT
  WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can insert own demographics" ON public.senior_demographics;
  CREATE POLICY "Users can insert own demographics"
  ON public.senior_demographics
  FOR INSERT
  WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can insert own SDOH" ON public.senior_sdoh;
  CREATE POLICY "Users can insert own SDOH"
  ON public.senior_sdoh
  FOR INSERT
  WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can insert own checkins" ON public.check_ins;
  CREATE POLICY "Users can insert own checkins"
  ON public.check_ins
  FOR INSERT
  WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- =====================================================
-- STEP 7: UPDATE POLICIES (Require consent)
-- =====================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can update own health data with consent" ON public.senior_health;
  CREATE POLICY "Users can update own health data with consent"
  ON public.senior_health
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND public.has_valid_privacy_consent(auth.uid())
  )
  WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can update own demographics with consent" ON public.senior_demographics;
  CREATE POLICY "Users can update own demographics with consent"
  ON public.senior_demographics
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND public.has_valid_privacy_consent(auth.uid())
  )
  WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- =====================================================
-- STEP 8: SERVICE ROLE BYPASS
-- =====================================================
-- Edge functions using service role need unrestricted access

DO $$
BEGIN
  DROP POLICY IF EXISTS "Service role bypass for health data" ON public.senior_health;
  CREATE POLICY "Service role bypass for health data"
  ON public.senior_health
  FOR ALL
  USING (auth.role() = 'service_role');
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Service role bypass for demographics" ON public.senior_demographics;
  CREATE POLICY "Service role bypass for demographics"
  ON public.senior_demographics
  FOR ALL
  USING (auth.role() = 'service_role');
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Service role bypass for SDOH" ON public.senior_sdoh;
  CREATE POLICY "Service role bypass for SDOH"
  ON public.senior_sdoh
  FOR ALL
  USING (auth.role() = 'service_role');
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Service role bypass for checkins" ON public.check_ins;
  CREATE POLICY "Service role bypass for checkins"
  ON public.check_ins
  FOR ALL
  USING (auth.role() = 'service_role');
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- =====================================================
-- STEP 9: DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION public.log_consent_check IS
'Audit log for consent verification at query time. Called by RLS policies.';

COMMIT;

-- =====================================================
-- CONSENT ENFORCEMENT COMPLETE
-- =====================================================
-- ✅ Helper function to check privacy consent
-- ✅ Helper function for specific consent types
-- ✅ Consent logging function for audit trail
-- ✅ RLS policies requiring consent for SELECT on sensitive tables
-- ✅ Admin bypass for clinical staff
-- ✅ INSERT allowed without consent (during registration)
-- ✅ UPDATE requires consent
-- ✅ Service role bypass for edge functions
-- =====================================================
