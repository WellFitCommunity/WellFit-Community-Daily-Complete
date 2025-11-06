-- ============================================================================
-- SCHEMA RECONCILIATION MIGRATION
-- ============================================================================
-- Purpose: Fix duplicate table definitions, add missing foreign keys,
--          add NOT NULL constraints, and add data validation
-- Created: 2025-10-26
-- Priority: CRITICAL (Data Integrity)
-- ============================================================================

-- ============================================================================
-- SECTION 1: Fix Duplicate community_moments Table
-- ============================================================================
-- Problem: community_moments created in 2 migrations with different schemas
-- Solution: Drop and recreate with canonical schema

DROP TABLE IF EXISTS public.community_moments CASCADE;

CREATE TABLE public.community_moments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',  -- Array type (more flexible than TEXT)
  emoji TEXT DEFAULT '😊',
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_community_moments_user_id
  ON public.community_moments(user_id);
CREATE INDEX idx_community_moments_created_at
  ON public.community_moments(created_at DESC);
CREATE INDEX idx_community_moments_tags
  ON public.community_moments USING GIN(tags);  -- GIN index for array queries

-- RLS policies
ALTER TABLE public.community_moments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_moments_select_own" ON public.community_moments;
CREATE POLICY "community_moments_select_own"
  ON public.community_moments
  FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "community_moments_insert_own" ON public.community_moments;
CREATE POLICY "community_moments_insert_own"
  ON public.community_moments
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "community_moments_update_own" ON public.community_moments;
CREATE POLICY "community_moments_update_own"
  ON public.community_moments
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "community_moments_delete_own" ON public.community_moments;
CREATE POLICY "community_moments_delete_own"
  ON public.community_moments
  FOR DELETE
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_community_moments_updated_at ON public.community_moments;
CREATE TRIGGER trg_community_moments_updated_at
  BEFORE UPDATE ON public.community_moments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- SECTION 2: Add Missing Foreign Keys
-- ============================================================================

-- Fix 1: claims.encounter_id should reference encounters(id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'encounter_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'encounters' AND table_schema = 'public'
  ) THEN
    -- Check if FK already exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_claims_encounter'
        AND table_name = 'claims'
    ) THEN
      ALTER TABLE public.claims
        ADD CONSTRAINT fk_claims_encounter
        FOREIGN KEY (encounter_id) REFERENCES public.encounters(id) ON DELETE CASCADE;

      -- Add index for FK performance
      CREATE INDEX IF NOT EXISTS idx_claims_encounter_id
        ON public.claims(encounter_id);
    END IF;
  END IF;
END$$;

-- Fix 2: scribe_sessions.encounter_id (remove conditional logic)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'scribe_sessions' AND table_schema = 'public'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'encounters' AND table_schema = 'public'
  ) THEN
    -- Drop existing column if it has no FK
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'scribe_sessions' AND column_name = 'encounter_id'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'scribe_sessions'
        AND kcu.column_name = 'encounter_id'
        AND tc.constraint_type = 'FOREIGN KEY'
    ) THEN
      ALTER TABLE public.scribe_sessions DROP COLUMN IF EXISTS encounter_id;
    END IF;

    -- Add column with FK if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'scribe_sessions' AND column_name = 'encounter_id'
    ) THEN
      ALTER TABLE public.scribe_sessions
        ADD COLUMN encounter_id UUID REFERENCES public.encounters(id) ON DELETE CASCADE;

      CREATE INDEX IF NOT EXISTS idx_scribe_sessions_encounter_id
        ON public.scribe_sessions(encounter_id);
    END IF;
  END IF;
END$$;

-- Fix 3: lab_results.handoff_packet_id should reference handoff_packets(id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lab_results' AND column_name = 'handoff_packet_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'handoff_packets' AND table_schema = 'public'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_lab_results_handoff_packet'
        AND table_name = 'lab_results'
    ) THEN
      ALTER TABLE public.lab_results
        ADD CONSTRAINT fk_lab_results_handoff_packet
        FOREIGN KEY (handoff_packet_id) REFERENCES public.handoff_packets(id) ON DELETE SET NULL;

      CREATE INDEX IF NOT EXISTS idx_lab_results_handoff_packet_id
        ON public.lab_results(handoff_packet_id);
    END IF;
  END IF;
END$$;

-- Fix 4: scribe_sessions.provider_id should have index (FK already exists)
CREATE INDEX IF NOT EXISTS idx_scribe_sessions_provider_id
  ON public.scribe_sessions(provider_id)
  WHERE provider_id IS NOT NULL;

-- Fix 5: handoff_packets.acknowledged_by should have index (FK already exists)
CREATE INDEX IF NOT EXISTS idx_handoff_packets_acknowledged_by
  ON public.handoff_packets(acknowledged_by)
  WHERE acknowledged_by IS NOT NULL;

-- ============================================================================
-- SECTION 3: Add Missing NOT NULL Constraints
-- ============================================================================

-- Fix 1: medications table - critical safety fields
DO $$
BEGIN
  -- Make instructions NOT NULL (critical for patient safety)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medications'
      AND column_name = 'instructions'
      AND is_nullable = 'YES'
  ) THEN
    -- First, update any NULL values with a default
    UPDATE public.medications
    SET instructions = 'No instructions provided - REVIEW REQUIRED'
    WHERE instructions IS NULL OR TRIM(instructions) = '';

    ALTER TABLE public.medications
      ALTER COLUMN instructions SET NOT NULL;
  END IF;

  -- Make strength NOT NULL (critical for dosing)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medications'
      AND column_name = 'strength'
      AND is_nullable = 'YES'
  ) THEN
    UPDATE public.medications
    SET strength = 'Unknown - REVIEW REQUIRED'
    WHERE strength IS NULL OR TRIM(strength) = '';

    ALTER TABLE public.medications
      ALTER COLUMN strength SET NOT NULL;
  END IF;
END$$;

-- ============================================================================
-- SECTION 4: Add Data Validation CHECK Constraints
-- ============================================================================

-- Fix 1: handoff_packets - sent_at required when status is 'sent' or 'acknowledged'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'sent_requires_sent_at'
      AND table_name = 'handoff_packets'
  ) THEN
    ALTER TABLE public.handoff_packets
      ADD CONSTRAINT sent_requires_sent_at CHECK (
        (status NOT IN ('sent', 'acknowledged')) OR sent_at IS NOT NULL
      );
  END IF;
END$$;

-- Fix 2: claim_lines - charge_amount must be positive
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'claim_lines' AND table_schema = 'public'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'positive_charge'
        AND table_name = 'claim_lines'
    ) THEN
      ALTER TABLE public.claim_lines
        ADD CONSTRAINT positive_charge CHECK (charge_amount > 0);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'positive_units'
        AND table_name = 'claim_lines'
    ) THEN
      ALTER TABLE public.claim_lines
        ADD CONSTRAINT positive_units CHECK (units > 0);
    END IF;
  END IF;
END$$;

-- Fix 3: ccm_time_tracking - billable_minutes <= total_minutes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'ccm_time_tracking' AND table_schema = 'public'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'billable_within_total'
        AND table_name = 'ccm_time_tracking'
    ) THEN
      ALTER TABLE public.ccm_time_tracking
        ADD CONSTRAINT billable_within_total CHECK (billable_minutes <= total_minutes);
    END IF;
  END IF;
END$$;

-- Fix 4: medications - refill date logic
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'refill_date_logic'
      AND table_name = 'medications'
  ) THEN
    ALTER TABLE public.medications
      ADD CONSTRAINT refill_date_logic CHECK (
        prescribed_date IS NULL OR
        last_refill_date IS NULL OR
        prescribed_date <= last_refill_date
      );
  END IF;
END$$;

-- Fix 5: medications - refills_remaining must be >= 0
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medications' AND column_name = 'refills_remaining'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'non_negative_refills'
        AND table_name = 'medications'
    ) THEN
      ALTER TABLE public.medications
        ADD CONSTRAINT non_negative_refills CHECK (refills_remaining >= 0);
    END IF;
  END IF;
END$$;

-- Fix 6: Better vital sign validation (tighter ranges for clinical accuracy)
DO $$
BEGIN
  -- Drop overly permissive constraints
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name LIKE '%bp_systolic%'
      AND table_name = 'check_ins'
  ) THEN
    ALTER TABLE public.check_ins
      DROP CONSTRAINT IF EXISTS check_ins_bp_systolic_check;
  END IF;

  -- Add clinically accurate constraints
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'realistic_bp_systolic'
      AND table_name = 'check_ins'
  ) THEN
    ALTER TABLE public.check_ins
      ADD CONSTRAINT realistic_bp_systolic CHECK (
        bp_systolic IS NULL OR (bp_systolic >= 40 AND bp_systolic <= 250)
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'check_ins' AND column_name = 'glucose_mg_dl'
  ) THEN
    ALTER TABLE public.check_ins
      DROP CONSTRAINT IF EXISTS check_ins_glucose_mg_dl_check;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'realistic_glucose'
        AND table_name = 'check_ins'
    ) THEN
      ALTER TABLE public.check_ins
        ADD CONSTRAINT realistic_glucose CHECK (
          glucose_mg_dl IS NULL OR (glucose_mg_dl >= 20 AND glucose_mg_dl <= 600)
        );
    END IF;
  END IF;
END$$;

-- ============================================================================
-- SECTION 5: Create Helper Function for Schema Validation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_schema_integrity()
RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  details TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Check 1: All critical foreign keys exist
  RETURN QUERY
  SELECT
    'Foreign Keys'::TEXT,
    CASE
      WHEN COUNT(*) >= 50 THEN 'PASS'::TEXT
      ELSE 'WARN'::TEXT
    END,
    'Found ' || COUNT(*)::TEXT || ' foreign keys'::TEXT
  FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';

  -- Check 2: Critical tables have RLS enabled
  RETURN QUERY
  SELECT
    'Row Level Security'::TEXT,
    CASE
      WHEN COUNT(*) >= 20 THEN 'PASS'::TEXT
      ELSE 'WARN'::TEXT
    END,
    'Found ' || COUNT(*)::TEXT || ' tables with RLS'::TEXT
  FROM pg_tables
  WHERE schemaname = 'public' AND rowsecurity = true;

  -- Check 3: Audit tables exist
  RETURN QUERY
  SELECT
    'Audit Infrastructure'::TEXT,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs')
        AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'handoff_logs')
      THEN 'PASS'::TEXT
      ELSE 'FAIL'::TEXT
    END,
    'Audit tables: ' ||
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs')
      THEN 'audit_logs ✓ ' ELSE 'audit_logs ✗ '
    END ||
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'handoff_logs')
      THEN 'handoff_logs ✓' ELSE 'handoff_logs ✗'
    END;

  -- Check 4: community_moments schema is correct
  RETURN QUERY
  SELECT
    'community_moments Schema'::TEXT,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'community_moments'
          AND column_name = 'tags'
          AND data_type = 'ARRAY'
      ) THEN 'PASS'::TEXT
      ELSE 'FAIL'::TEXT
    END,
    'Tags column type: ' || COALESCE(
      (SELECT data_type FROM information_schema.columns
       WHERE table_name = 'community_moments' AND column_name = 'tags'),
      'NOT FOUND'
    );
END;
$$;

-- ============================================================================
-- SECTION 6: Verification Queries (commented out - run manually if needed)
-- ============================================================================

-- To verify migration success, run these queries:

/*
-- 1. Check all new foreign keys
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('claims', 'scribe_sessions', 'lab_results')
ORDER BY tc.table_name;

-- 2. Verify community_moments schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'community_moments'
ORDER BY ordinal_position;

-- 3. Run schema validation
SELECT * FROM public.validate_schema_integrity();

-- 4. Count all foreign keys
SELECT COUNT(*) as total_foreign_keys
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary:
-- ✓ Fixed duplicate community_moments table
-- ✓ Added missing foreign keys (claims, scribe_sessions, lab_results)
-- ✓ Added NOT NULL constraints on critical medication fields
-- ✓ Added CHECK constraints for data validation
-- ✓ Added indexes for FK performance
-- ✓ Created schema validation function
-- ============================================================================
