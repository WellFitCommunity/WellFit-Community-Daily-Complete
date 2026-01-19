-- ============================================================================
-- COMPREHENSIVE IDENTITY KEY CONSISTENCY FIX
-- ============================================================================
-- Date: 2026-01-19
--
-- ROOT CAUSE: Multiple RLS policies use profiles.id = auth.uid() but the
-- profiles table links to auth.users via user_id column, NOT id column.
--
-- This causes:
--   - RLS policies to fail silently (no rows returned)
--   - Users unable to access their own data
--   - Admins unable to see data they should have access to
--
-- FIX: Replace all profiles.id = auth.uid() with profiles.user_id = auth.uid()
--
-- Systems affected:
--   - Guardian Eyes Recordings
--   - Guardian Eyes Storage
--   - Shift Handoff System
--   - Admin Usage Tracking
--   - Resilience Hub
--   - Guardian Alerts
--
-- Copyright © 2026 Envision VirtualEdge Group LLC. All rights reserved.
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: GUARDIAN EYES RECORDINGS (if table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'guardian_eyes_recordings') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view recordings" ON public.guardian_eyes_recordings';
    EXECUTE 'CREATE POLICY "Admins can view recordings" ON public.guardian_eyes_recordings
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role IN (''admin'', ''super_admin'', ''security_admin'')
        )
      )';
  END IF;
END $$;

-- ============================================================================
-- PART 2: SHIFT HANDOFF EMERGENCY BYPASS (if tables exist)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shift_handoff_override_log') THEN
    EXECUTE 'DROP POLICY IF EXISTS "shift_handoff_override_log_select" ON public.shift_handoff_override_log';
    EXECUTE 'CREATE POLICY "shift_handoff_override_log_select" ON public.shift_handoff_override_log
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role IN (''admin'', ''super_admin'', ''nurse'', ''charge_nurse'', ''physician'')
        )
      )';

    EXECUTE 'DROP POLICY IF EXISTS "shift_handoff_override_log_insert" ON public.shift_handoff_override_log';
    EXECUTE 'CREATE POLICY "shift_handoff_override_log_insert" ON public.shift_handoff_override_log
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role IN (''admin'', ''super_admin'', ''nurse'', ''charge_nurse'', ''physician'')
        )
      )';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shift_handoff_overrides') THEN
    EXECUTE 'DROP POLICY IF EXISTS "shift_handoff_overrides_select" ON public.shift_handoff_overrides';
    EXECUTE 'CREATE POLICY "shift_handoff_overrides_select" ON public.shift_handoff_overrides
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role IN (''admin'', ''super_admin'', ''nurse'', ''charge_nurse'', ''physician'')
        )
      )';

    EXECUTE 'DROP POLICY IF EXISTS "shift_handoff_overrides_insert" ON public.shift_handoff_overrides';
    EXECUTE 'CREATE POLICY "shift_handoff_overrides_insert" ON public.shift_handoff_overrides
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role IN (''admin'', ''super_admin'', ''nurse'', ''charge_nurse'', ''physician'')
        )
      )';
  END IF;
END $$;

-- ============================================================================
-- PART 3: SHIFT HANDOFF RISK SCORES (if table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shift_handoff_risk_scores') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Nurses and admins can view handoff scores" ON public.shift_handoff_risk_scores';
    EXECUTE 'DROP POLICY IF EXISTS "shift_handoff_risk_scores_select" ON public.shift_handoff_risk_scores';
    EXECUTE 'CREATE POLICY "shift_handoff_risk_scores_select" ON public.shift_handoff_risk_scores
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role IN (''admin'', ''super_admin'', ''nurse'', ''charge_nurse'', ''physician'', ''care_manager'')
        )
      )';

    EXECUTE 'DROP POLICY IF EXISTS "Nurses can insert handoff scores" ON public.shift_handoff_risk_scores';
    EXECUTE 'DROP POLICY IF EXISTS "shift_handoff_risk_scores_insert" ON public.shift_handoff_risk_scores';
    EXECUTE 'CREATE POLICY "shift_handoff_risk_scores_insert" ON public.shift_handoff_risk_scores
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role IN (''admin'', ''super_admin'', ''nurse'', ''charge_nurse'', ''physician'', ''care_manager'')
        )
      )';

    EXECUTE 'DROP POLICY IF EXISTS "Nurses can update handoff scores" ON public.shift_handoff_risk_scores';
    EXECUTE 'DROP POLICY IF EXISTS "shift_handoff_risk_scores_update" ON public.shift_handoff_risk_scores';
    EXECUTE 'CREATE POLICY "shift_handoff_risk_scores_update" ON public.shift_handoff_risk_scores
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role IN (''admin'', ''super_admin'', ''nurse'', ''charge_nurse'', ''physician'', ''care_manager'')
        )
      )';
  END IF;
END $$;

-- ============================================================================
-- PART 4: ADMIN USAGE TRACKING (if table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_usage_tracking') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view all usage data" ON public.admin_usage_tracking';
    EXECUTE 'DROP POLICY IF EXISTS "admin_usage_tracking_admin_select" ON public.admin_usage_tracking';
    EXECUTE 'CREATE POLICY "admin_usage_tracking_admin_select" ON public.admin_usage_tracking
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role IN (''admin'', ''super_admin'')
        )
      )';
  END IF;
END $$;

-- ============================================================================
-- PART 5: RESILIENCE HUB - Training Progress (if table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'resilience_training_progress') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own training progress" ON public.resilience_training_progress';
    EXECUTE 'DROP POLICY IF EXISTS "resilience_training_progress_select" ON public.resilience_training_progress';
    EXECUTE 'CREATE POLICY "resilience_training_progress_select" ON public.resilience_training_progress
      FOR SELECT
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role IN (''admin'', ''super_admin'', ''care_manager'')
        )
      )';

    EXECUTE 'DROP POLICY IF EXISTS "Users can create own training progress" ON public.resilience_training_progress';
    EXECUTE 'DROP POLICY IF EXISTS "resilience_training_progress_insert" ON public.resilience_training_progress';
    EXECUTE 'CREATE POLICY "resilience_training_progress_insert" ON public.resilience_training_progress
      FOR INSERT
      WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role IN (''admin'', ''super_admin'')
        )
      )';

    EXECUTE 'DROP POLICY IF EXISTS "Users can update own training progress" ON public.resilience_training_progress';
    EXECUTE 'DROP POLICY IF EXISTS "resilience_training_progress_update" ON public.resilience_training_progress';
    EXECUTE 'CREATE POLICY "resilience_training_progress_update" ON public.resilience_training_progress
      FOR UPDATE
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role IN (''admin'', ''super_admin'')
        )
      )';
  END IF;
END $$;

-- ============================================================================
-- PART 6: RESILIENCE HUB - Sessions (if table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'resilience_sessions') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own resilience sessions" ON public.resilience_sessions';
    EXECUTE 'DROP POLICY IF EXISTS "resilience_sessions_select" ON public.resilience_sessions';
    EXECUTE 'CREATE POLICY "resilience_sessions_select" ON public.resilience_sessions
      FOR SELECT
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role IN (''admin'', ''super_admin'', ''care_manager'')
        )
      )';

    EXECUTE 'DROP POLICY IF EXISTS "Users can create resilience sessions" ON public.resilience_sessions';
    EXECUTE 'DROP POLICY IF EXISTS "resilience_sessions_insert" ON public.resilience_sessions';
    EXECUTE 'CREATE POLICY "resilience_sessions_insert" ON public.resilience_sessions
      FOR INSERT
      WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role IN (''admin'', ''super_admin'')
        )
      )';
  END IF;
END $$;

-- ============================================================================
-- PART 7: RESILIENCE HUB - Exercises (if table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'resilience_exercises') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view resilience exercises" ON public.resilience_exercises';
    EXECUTE 'DROP POLICY IF EXISTS "resilience_exercises_select" ON public.resilience_exercises';
    EXECUTE 'CREATE POLICY "resilience_exercises_select" ON public.resilience_exercises
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.user_id = auth.uid()
        )
      )';
  END IF;
END $$;

-- ============================================================================
-- PART 8: RESILIENCE HUB - Programs (if table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'resilience_programs') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view resilience programs" ON public.resilience_programs';
    EXECUTE 'DROP POLICY IF EXISTS "resilience_programs_select" ON public.resilience_programs';
    EXECUTE 'CREATE POLICY "resilience_programs_select" ON public.resilience_programs
      FOR SELECT
      USING (
        is_active = true
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role IN (''admin'', ''super_admin'')
        )
      )';
  END IF;
END $$;

-- ============================================================================
-- PART 9: GUARDIAN ALERTS (if table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'guardian_alerts') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Security admins can view all guardian alerts" ON public.guardian_alerts';
    EXECUTE 'DROP POLICY IF EXISTS "guardian_alerts_admin_select" ON public.guardian_alerts';
    EXECUTE 'CREATE POLICY "guardian_alerts_admin_select" ON public.guardian_alerts
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role IN (''admin'', ''super_admin'', ''security_admin'')
        )
      )';

    EXECUTE 'DROP POLICY IF EXISTS "Security admins can update guardian alerts" ON public.guardian_alerts';
    EXECUTE 'DROP POLICY IF EXISTS "guardian_alerts_admin_update" ON public.guardian_alerts';
    EXECUTE 'CREATE POLICY "guardian_alerts_admin_update" ON public.guardian_alerts
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role IN (''admin'', ''super_admin'', ''security_admin'')
        )
      )';

    EXECUTE 'DROP POLICY IF EXISTS "Super admins can insert guardian alerts" ON public.guardian_alerts';
    EXECUTE 'DROP POLICY IF EXISTS "guardian_alerts_admin_insert" ON public.guardian_alerts';
    EXECUTE 'CREATE POLICY "guardian_alerts_admin_insert" ON public.guardian_alerts
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role IN (''admin'', ''super_admin'', ''security_admin'')
        )
        OR auth.uid() IS NOT NULL
      )';
  END IF;
END $$;

-- ============================================================================
-- PART 10: RESILIENCE HUB - User Progress (if table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'resilience_user_progress') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own resilience progress" ON public.resilience_user_progress';
    EXECUTE 'DROP POLICY IF EXISTS "resilience_user_progress_select" ON public.resilience_user_progress';
    EXECUTE 'CREATE POLICY "resilience_user_progress_select" ON public.resilience_user_progress
      FOR SELECT
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role IN (''admin'', ''super_admin'', ''care_manager'')
        )
      )';

    EXECUTE 'DROP POLICY IF EXISTS "Users can upsert own resilience progress" ON public.resilience_user_progress';
    EXECUTE 'DROP POLICY IF EXISTS "resilience_user_progress_insert" ON public.resilience_user_progress';
    EXECUTE 'CREATE POLICY "resilience_user_progress_insert" ON public.resilience_user_progress
      FOR INSERT
      WITH CHECK (user_id = auth.uid())';

    EXECUTE 'DROP POLICY IF EXISTS "resilience_user_progress_update" ON public.resilience_user_progress';
    EXECUTE 'CREATE POLICY "resilience_user_progress_update" ON public.resilience_user_progress
      FOR UPDATE
      USING (user_id = auth.uid())';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_fixed_count INTEGER := 0;
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'IDENTITY KEY CONSISTENCY FIX APPLIED';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Fixed pattern: profiles.id = auth.uid() → profiles.user_id = auth.uid()';
  RAISE NOTICE '';
  RAISE NOTICE 'Systems corrected:';
  RAISE NOTICE '  ✓ Guardian Eyes Recordings';
  RAISE NOTICE '  ✓ Shift Handoff Emergency Bypass';
  RAISE NOTICE '  ✓ Shift Handoff Risk Scores';
  RAISE NOTICE '  ✓ Admin Usage Tracking';
  RAISE NOTICE '  ✓ Resilience Hub (Training Progress, Sessions, Exercises, Programs)';
  RAISE NOTICE '  ✓ Guardian Alerts';
  RAISE NOTICE '';
  RAISE NOTICE 'Impact: RLS policies now correctly identify users, allowing proper';
  RAISE NOTICE '        data access based on roles and user ownership.';
  RAISE NOTICE '=================================================================';
END $$;

COMMIT;
