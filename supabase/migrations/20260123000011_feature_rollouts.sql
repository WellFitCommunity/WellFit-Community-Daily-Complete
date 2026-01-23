-- Feature Rollouts and Beta Programs
-- Purpose: Gradual percentage-based feature rollout system
-- Features: Percentage targeting, user segments, beta programs

-- ============================================================================
-- 1. FEATURE ROLLOUTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS feature_rollouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),  -- NULL for global rollouts

  -- Feature identification
  feature_key TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  description TEXT,

  -- Rollout configuration
  rollout_percentage INTEGER NOT NULL DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  is_enabled BOOLEAN DEFAULT FALSE,

  -- Targeting
  target_roles TEXT[] DEFAULT '{}',         -- Empty = all roles
  target_user_ids UUID[] DEFAULT '{}',      -- Specific users always included
  excluded_user_ids UUID[] DEFAULT '{}',    -- Specific users always excluded

  -- Environment
  environments TEXT[] DEFAULT ARRAY['production'],  -- production, staging, development

  -- Scheduling
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,

  -- Gradual rollout schedule
  rollout_schedule JSONB DEFAULT '[]',  -- Array of {date, percentage} for scheduled increases

  -- Metrics
  impression_count INTEGER DEFAULT 0,
  enabled_count INTEGER DEFAULT 0,
  disabled_count INTEGER DEFAULT 0,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, feature_key)
);

-- ============================================================================
-- 2. BETA PROGRAMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS beta_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),

  -- Program info
  program_name TEXT NOT NULL,
  program_key TEXT NOT NULL,
  description TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),

  -- Capacity
  max_participants INTEGER,
  current_participants INTEGER DEFAULT 0,

  -- Timing
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,

  -- Features included
  feature_keys TEXT[] DEFAULT '{}',

  -- Requirements
  min_account_age_days INTEGER DEFAULT 0,
  required_roles TEXT[] DEFAULT '{}',
  required_modules TEXT[] DEFAULT '{}',

  -- Terms
  terms_and_conditions TEXT,
  requires_agreement BOOLEAN DEFAULT FALSE,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, program_key)
);

-- ============================================================================
-- 3. BETA PROGRAM ENROLLMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS beta_program_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beta_program_id UUID NOT NULL REFERENCES beta_programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'removed', 'completed')),

  -- Agreement
  agreed_to_terms BOOLEAN DEFAULT FALSE,
  agreed_at TIMESTAMPTZ,

  -- Feedback
  feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
  feedback_text TEXT,
  feedback_submitted_at TIMESTAMPTZ,

  -- Timing
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(beta_program_id, user_id)
);

-- ============================================================================
-- 4. FEATURE ROLLOUT HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS feature_rollout_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_rollout_id UUID NOT NULL REFERENCES feature_rollouts(id) ON DELETE CASCADE,

  -- Change
  change_type TEXT NOT NULL CHECK (change_type IN ('create', 'percentage', 'enable', 'disable', 'targeting', 'schedule')),
  old_value JSONB,
  new_value JSONB,

  -- Who
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT
);

-- ============================================================================
-- 5. USER FEATURE FLAGS CACHE
-- ============================================================================

-- Cached results of feature flag evaluations for performance
CREATE TABLE IF NOT EXISTS user_feature_flags_cache (
  user_id UUID NOT NULL REFERENCES auth.users(id),
  feature_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL,
  reason TEXT,  -- 'percentage', 'targeted', 'excluded', 'beta', 'disabled'
  evaluated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes',

  PRIMARY KEY (user_id, feature_key)
);

-- ============================================================================
-- 6. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_feature_rollouts_tenant ON feature_rollouts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_feature_rollouts_key ON feature_rollouts(feature_key);
CREATE INDEX IF NOT EXISTS idx_feature_rollouts_enabled ON feature_rollouts(is_enabled) WHERE is_enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_beta_programs_tenant ON beta_programs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_beta_programs_status ON beta_programs(status);
CREATE INDEX IF NOT EXISTS idx_beta_programs_key ON beta_programs(program_key);

CREATE INDEX IF NOT EXISTS idx_beta_enrollments_program ON beta_program_enrollments(beta_program_id);
CREATE INDEX IF NOT EXISTS idx_beta_enrollments_user ON beta_program_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_enrollments_status ON beta_program_enrollments(status);

CREATE INDEX IF NOT EXISTS idx_user_flags_cache_expires ON user_feature_flags_cache(expires_at);

-- ============================================================================
-- 7. FUNCTIONS
-- ============================================================================

-- Evaluate feature flag for a user
CREATE OR REPLACE FUNCTION evaluate_feature_flag(
  p_user_id UUID,
  p_feature_key TEXT,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_rollout RECORD;
  v_user_hash BIGINT;
  v_is_enabled BOOLEAN := FALSE;
  v_reason TEXT := 'no_rollout';
  v_cached RECORD;
  v_user_role TEXT;
  v_in_beta BOOLEAN := FALSE;
BEGIN
  -- Check cache first
  SELECT * INTO v_cached
  FROM user_feature_flags_cache
  WHERE user_id = p_user_id
    AND feature_key = p_feature_key
    AND expires_at > NOW();

  IF FOUND THEN
    RETURN jsonb_build_object(
      'enabled', v_cached.is_enabled,
      'reason', v_cached.reason,
      'cached', TRUE
    );
  END IF;

  -- Get user's role
  SELECT role INTO v_user_role
  FROM profiles
  WHERE user_id = p_user_id;

  -- Check if user is in a beta program with this feature
  SELECT TRUE INTO v_in_beta
  FROM beta_program_enrollments bpe
  JOIN beta_programs bp ON bp.id = bpe.beta_program_id
  WHERE bpe.user_id = p_user_id
    AND bpe.status = 'approved'
    AND bp.status = 'active'
    AND p_feature_key = ANY(bp.feature_keys)
    AND (p_tenant_id IS NULL OR bp.tenant_id = p_tenant_id OR bp.tenant_id IS NULL)
  LIMIT 1;

  IF v_in_beta THEN
    v_is_enabled := TRUE;
    v_reason := 'beta_program';
  ELSE
    -- Get the feature rollout
    SELECT * INTO v_rollout
    FROM feature_rollouts
    WHERE feature_key = p_feature_key
      AND (tenant_id = p_tenant_id OR tenant_id IS NULL)
      AND is_enabled = TRUE
      AND (start_date IS NULL OR start_date <= NOW())
      AND (end_date IS NULL OR end_date > NOW())
    ORDER BY
      CASE WHEN tenant_id IS NOT NULL THEN 0 ELSE 1 END  -- Prefer tenant-specific
    LIMIT 1;

    IF FOUND THEN
      -- Check if user is excluded
      IF p_user_id = ANY(v_rollout.excluded_user_ids) THEN
        v_is_enabled := FALSE;
        v_reason := 'excluded';
      -- Check if user is specifically targeted
      ELSIF p_user_id = ANY(v_rollout.target_user_ids) THEN
        v_is_enabled := TRUE;
        v_reason := 'targeted';
      -- Check role targeting
      ELSIF array_length(v_rollout.target_roles, 1) > 0 AND NOT (v_user_role = ANY(v_rollout.target_roles)) THEN
        v_is_enabled := FALSE;
        v_reason := 'role_not_targeted';
      -- Check percentage rollout
      ELSIF v_rollout.rollout_percentage = 100 THEN
        v_is_enabled := TRUE;
        v_reason := 'full_rollout';
      ELSIF v_rollout.rollout_percentage = 0 THEN
        v_is_enabled := FALSE;
        v_reason := 'zero_percentage';
      ELSE
        -- Hash user ID for consistent percentage assignment
        v_user_hash := abs(hashtext(p_user_id::TEXT || p_feature_key)) % 100;
        v_is_enabled := v_user_hash < v_rollout.rollout_percentage;
        v_reason := CASE WHEN v_is_enabled THEN 'percentage_in' ELSE 'percentage_out' END;
      END IF;

      -- Update metrics
      UPDATE feature_rollouts
      SET
        impression_count = impression_count + 1,
        enabled_count = CASE WHEN v_is_enabled THEN enabled_count + 1 ELSE enabled_count END,
        disabled_count = CASE WHEN NOT v_is_enabled THEN disabled_count + 1 ELSE disabled_count END
      WHERE id = v_rollout.id;
    END IF;
  END IF;

  -- Cache the result
  INSERT INTO user_feature_flags_cache (user_id, feature_key, is_enabled, reason)
  VALUES (p_user_id, p_feature_key, v_is_enabled, v_reason)
  ON CONFLICT (user_id, feature_key) DO UPDATE
  SET is_enabled = v_is_enabled, reason = v_reason, evaluated_at = NOW(), expires_at = NOW() + INTERVAL '5 minutes';

  RETURN jsonb_build_object(
    'enabled', v_is_enabled,
    'reason', v_reason,
    'cached', FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all feature flags for a user
CREATE OR REPLACE FUNCTION get_user_feature_flags(
  p_user_id UUID,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
  feature_key TEXT,
  is_enabled BOOLEAN,
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fr.feature_key,
    (evaluate_feature_flag(p_user_id, fr.feature_key, p_tenant_id)->>'enabled')::BOOLEAN,
    evaluate_feature_flag(p_user_id, fr.feature_key, p_tenant_id)->>'reason'
  FROM feature_rollouts fr
  WHERE fr.is_enabled = TRUE
    AND (fr.tenant_id = p_tenant_id OR fr.tenant_id IS NULL)
    AND (fr.start_date IS NULL OR fr.start_date <= NOW())
    AND (fr.end_date IS NULL OR fr.end_date > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or update feature rollout
CREATE OR REPLACE FUNCTION upsert_feature_rollout(
  p_feature_key TEXT,
  p_feature_name TEXT,
  p_rollout_percentage INTEGER DEFAULT 0,
  p_is_enabled BOOLEAN DEFAULT FALSE,
  p_tenant_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_target_roles TEXT[] DEFAULT '{}',
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_user_id UUID;
  v_old_percentage INTEGER;
BEGIN
  v_user_id := auth.uid();

  -- Get existing percentage for history
  SELECT rollout_percentage INTO v_old_percentage
  FROM feature_rollouts
  WHERE feature_key = p_feature_key
    AND (tenant_id = p_tenant_id OR (p_tenant_id IS NULL AND tenant_id IS NULL));

  INSERT INTO feature_rollouts (
    tenant_id,
    feature_key,
    feature_name,
    description,
    rollout_percentage,
    is_enabled,
    target_roles,
    start_date,
    end_date,
    created_by
  ) VALUES (
    p_tenant_id,
    p_feature_key,
    p_feature_name,
    p_description,
    p_rollout_percentage,
    p_is_enabled,
    p_target_roles,
    p_start_date,
    p_end_date,
    v_user_id
  )
  ON CONFLICT (tenant_id, feature_key) DO UPDATE SET
    feature_name = EXCLUDED.feature_name,
    description = EXCLUDED.description,
    rollout_percentage = EXCLUDED.rollout_percentage,
    is_enabled = EXCLUDED.is_enabled,
    target_roles = EXCLUDED.target_roles,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    updated_at = NOW()
  RETURNING id INTO v_id;

  -- Log history if percentage changed
  IF v_old_percentage IS DISTINCT FROM p_rollout_percentage THEN
    INSERT INTO feature_rollout_history (feature_rollout_id, change_type, old_value, new_value, changed_by)
    VALUES (v_id, 'percentage', to_jsonb(v_old_percentage), to_jsonb(p_rollout_percentage), v_user_id);
  END IF;

  -- Invalidate cache for this feature
  DELETE FROM user_feature_flags_cache WHERE feature_key = p_feature_key;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enroll user in beta program
CREATE OR REPLACE FUNCTION enroll_in_beta_program(
  p_program_id UUID,
  p_user_id UUID,
  p_agreed_to_terms BOOLEAN DEFAULT FALSE
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_program RECORD;
BEGIN
  -- Get program details
  SELECT * INTO v_program FROM beta_programs WHERE id = p_program_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Beta program not found';
  END IF;

  IF v_program.status != 'active' THEN
    RAISE EXCEPTION 'Beta program is not active';
  END IF;

  IF v_program.max_participants IS NOT NULL AND v_program.current_participants >= v_program.max_participants THEN
    RAISE EXCEPTION 'Beta program is at capacity';
  END IF;

  IF v_program.requires_agreement AND NOT p_agreed_to_terms THEN
    RAISE EXCEPTION 'Must agree to terms and conditions';
  END IF;

  INSERT INTO beta_program_enrollments (
    beta_program_id,
    user_id,
    agreed_to_terms,
    agreed_at,
    status
  ) VALUES (
    p_program_id,
    p_user_id,
    p_agreed_to_terms,
    CASE WHEN p_agreed_to_terms THEN NOW() ELSE NULL END,
    'pending'
  )
  RETURNING id INTO v_id;

  -- Update participant count
  UPDATE beta_programs
  SET current_participants = current_participants + 1
  WHERE id = p_program_id;

  -- Invalidate feature caches for features in this program
  DELETE FROM user_feature_flags_cache
  WHERE user_id = p_user_id
    AND feature_key = ANY(v_program.feature_keys);

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Approve beta enrollment
CREATE OR REPLACE FUNCTION approve_beta_enrollment(
  p_enrollment_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_enrollment RECORD;
  v_program RECORD;
BEGIN
  SELECT * INTO v_enrollment FROM beta_program_enrollments WHERE id = p_enrollment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment not found';
  END IF;

  SELECT * INTO v_program FROM beta_programs WHERE id = v_enrollment.beta_program_id;

  UPDATE beta_program_enrollments
  SET status = 'approved',
      approved_at = NOW(),
      approved_by = auth.uid()
  WHERE id = p_enrollment_id;

  -- Invalidate feature caches
  DELETE FROM user_feature_flags_cache
  WHERE user_id = v_enrollment.user_id
    AND feature_key = ANY(v_program.feature_keys);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_feature_flags_cache()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM user_feature_flags_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE feature_rollouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_program_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_rollout_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feature_flags_cache ENABLE ROW LEVEL SECURITY;

-- Feature rollouts - admins can manage
CREATE POLICY "Admins manage feature rollouts"
  ON feature_rollouts FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  );

-- Everyone can read active rollouts for evaluation
CREATE POLICY "Users read active feature rollouts"
  ON feature_rollouts FOR SELECT TO authenticated
  USING (is_enabled = TRUE);

-- Beta programs - admins manage
CREATE POLICY "Admins manage beta programs"
  ON beta_programs FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  );

-- Users can view active beta programs
CREATE POLICY "Users view active beta programs"
  ON beta_programs FOR SELECT TO authenticated
  USING (status = 'active');

-- Users manage their own enrollments
CREATE POLICY "Users manage own beta enrollments"
  ON beta_program_enrollments FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- Admins manage all enrollments
CREATE POLICY "Admins manage all beta enrollments"
  ON beta_program_enrollments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  );

-- History - admins only
CREATE POLICY "Admins view rollout history"
  ON feature_rollout_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  );

-- Cache - users see own, system manages
CREATE POLICY "Users view own flag cache"
  ON user_feature_flags_cache FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System manages flag cache"
  ON user_feature_flags_cache FOR ALL TO authenticated
  WITH CHECK (TRUE);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE feature_rollouts IS 'Percentage-based feature rollout configuration';
COMMENT ON TABLE beta_programs IS 'Beta program definitions for early access features';
COMMENT ON TABLE beta_program_enrollments IS 'User enrollments in beta programs';
COMMENT ON TABLE feature_rollout_history IS 'Audit history of rollout changes';
COMMENT ON TABLE user_feature_flags_cache IS 'Cache of feature flag evaluations per user';
COMMENT ON FUNCTION evaluate_feature_flag IS 'Evaluate a feature flag for a specific user';
COMMENT ON FUNCTION get_user_feature_flags IS 'Get all feature flags for a user';
COMMENT ON FUNCTION upsert_feature_rollout IS 'Create or update a feature rollout';
COMMENT ON FUNCTION enroll_in_beta_program IS 'Enroll a user in a beta program';
