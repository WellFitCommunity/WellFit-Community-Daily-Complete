-- Enable MFA Enforcement for SOC2 Compliance
-- Priority 1: Multi-Factor Authentication

-- Create MFA enrollment tracking table
CREATE TABLE IF NOT EXISTS mfa_enrollment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_method TEXT, -- 'totp', 'sms', 'email'
  enrollment_date TIMESTAMP WITH TIME ZONE,
  last_verified TIMESTAMP WITH TIME ZONE,
  grace_period_ends TIMESTAMP WITH TIME ZONE,
  enforcement_status TEXT DEFAULT 'pending' CHECK (enforcement_status IN ('pending', 'grace_period', 'enforced', 'exempt')),
  exemption_reason TEXT,
  exemption_approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_mfa_enrollment_user_id ON mfa_enrollment(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_enrollment_status ON mfa_enrollment(enforcement_status);

-- Enable RLS
ALTER TABLE mfa_enrollment ENABLE ROW LEVEL SECURITY;

-- Admin can view all MFA enrollments
CREATE POLICY "Admins can view all MFA enrollments"
  ON mfa_enrollment FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Users can view their own MFA status
CREATE POLICY "Users can view own MFA status"
  ON mfa_enrollment FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admin can manage MFA enrollments
CREATE POLICY "Admins can manage MFA enrollments"
  ON mfa_enrollment FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Function to check if user needs MFA
CREATE OR REPLACE FUNCTION check_mfa_required(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_mfa_enabled BOOLEAN;
  v_enforcement_status TEXT;
BEGIN
  -- Get user's role
  SELECT role INTO v_role
  FROM profiles
  WHERE user_id = p_user_id;

  -- Admin, physician, nurse, and billing roles MUST have MFA
  IF v_role IN ('admin', 'super_admin', 'physician', 'nurse', 'billing', 'case_manager') THEN
    -- Check if MFA is enabled
    SELECT mfa_enabled, enforcement_status INTO v_mfa_enabled, v_enforcement_status
    FROM mfa_enrollment
    WHERE user_id = p_user_id;

    -- If no enrollment record, create one with grace period
    IF NOT FOUND THEN
      INSERT INTO mfa_enrollment (
        user_id,
        role,
        mfa_enabled,
        enforcement_status,
        grace_period_ends
      ) VALUES (
        p_user_id,
        v_role,
        FALSE,
        'grace_period',
        NOW() + INTERVAL '7 days'
      );
      RETURN FALSE; -- Not required yet (in grace period)
    END IF;

    -- Check if in grace period
    IF v_enforcement_status = 'grace_period' THEN
      -- Check if grace period has expired
      IF EXISTS (
        SELECT 1 FROM mfa_enrollment
        WHERE user_id = p_user_id
          AND grace_period_ends < NOW()
      ) THEN
        -- Update to enforced
        UPDATE mfa_enrollment
        SET enforcement_status = 'enforced',
            updated_at = NOW()
        WHERE user_id = p_user_id;
        RETURN TRUE;
      ELSE
        RETURN FALSE; -- Still in grace period
      END IF;
    END IF;

    -- If enforced and not enabled, MFA is required
    IF v_enforcement_status = 'enforced' AND NOT v_mfa_enabled THEN
      RETURN TRUE;
    END IF;

    -- If exempt, MFA not required
    IF v_enforcement_status = 'exempt' THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- For other roles, MFA is optional but recommended
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log MFA verification
CREATE OR REPLACE FUNCTION log_mfa_verification(
  p_user_id UUID,
  p_success BOOLEAN,
  p_method TEXT DEFAULT 'totp'
) RETURNS VOID AS $$
BEGIN
  -- Update last verified timestamp if successful
  IF p_success THEN
    UPDATE mfa_enrollment
    SET last_verified = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  -- Log the verification attempt
  INSERT INTO security_events (
    event_type,
    user_id,
    severity,
    description,
    metadata
  ) VALUES (
    CASE WHEN p_success THEN 'mfa_verification_success' ELSE 'mfa_verification_failure' END,
    p_user_id,
    CASE WHEN p_success THEN 'info' ELSE 'warning' END,
    CASE WHEN p_success
      THEN 'MFA verification successful'
      ELSE 'MFA verification failed'
    END,
    jsonb_build_object(
      'method', p_method,
      'timestamp', NOW()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to grant MFA exemption (requires super admin)
CREATE OR REPLACE FUNCTION grant_mfa_exemption(
  p_user_id UUID,
  p_reason TEXT
) RETURNS VOID AS $$
DECLARE
  v_admin_id UUID;
  v_admin_role TEXT;
BEGIN
  v_admin_id := auth.uid();

  -- Verify requester is super admin
  SELECT role INTO v_admin_role
  FROM profiles
  WHERE user_id = v_admin_id;

  IF v_admin_role != 'super_admin' THEN
    RAISE EXCEPTION 'Only super admins can grant MFA exemptions';
  END IF;

  -- Update or insert exemption
  INSERT INTO mfa_enrollment (
    user_id,
    role,
    mfa_enabled,
    enforcement_status,
    exemption_reason,
    exemption_approved_by
  )
  SELECT
    p_user_id,
    p.role,
    FALSE,
    'exempt',
    p_reason,
    v_admin_id
  FROM profiles p
  WHERE p.user_id = p_user_id
  ON CONFLICT (user_id) DO UPDATE
  SET enforcement_status = 'exempt',
      exemption_reason = EXCLUDED.exemption_reason,
      exemption_approved_by = EXCLUDED.exemption_approved_by,
      updated_at = NOW();

  -- Log the exemption
  INSERT INTO security_events (
    event_type,
    user_id,
    severity,
    description,
    metadata
  ) VALUES (
    'mfa_exemption_granted',
    p_user_id,
    'warning',
    'MFA exemption granted',
    jsonb_build_object(
      'reason', p_reason,
      'approved_by', v_admin_id,
      'timestamp', NOW()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add unique constraint to prevent duplicate enrollments
CREATE UNIQUE INDEX IF NOT EXISTS idx_mfa_enrollment_user_unique
  ON mfa_enrollment(user_id);

-- Create view for MFA compliance reporting
CREATE OR REPLACE VIEW mfa_compliance_report AS
SELECT
  p.role,
  COUNT(*) as total_users,
  COUNT(CASE WHEN m.mfa_enabled THEN 1 END) as mfa_enabled_count,
  COUNT(CASE WHEN m.enforcement_status = 'enforced' AND NOT m.mfa_enabled THEN 1 END) as non_compliant_count,
  COUNT(CASE WHEN m.enforcement_status = 'grace_period' THEN 1 END) as grace_period_count,
  COUNT(CASE WHEN m.enforcement_status = 'exempt' THEN 1 END) as exempt_count,
  ROUND(
    100.0 * COUNT(CASE WHEN m.mfa_enabled THEN 1 END) / NULLIF(COUNT(*), 0),
    2
  ) as compliance_percentage
FROM profiles p
LEFT JOIN mfa_enrollment m ON m.user_id = p.user_id
WHERE p.role IN ('admin', 'super_admin', 'physician', 'nurse', 'billing', 'case_manager')
  AND p.disabled_at IS NULL
GROUP BY p.role
ORDER BY compliance_percentage DESC;

-- Grant access to compliance view
GRANT SELECT ON mfa_compliance_report TO authenticated;

-- Initialize MFA enrollment for all existing admin/clinical users
INSERT INTO mfa_enrollment (
  user_id,
  role,
  mfa_enabled,
  enforcement_status,
  grace_period_ends
)
SELECT
  p.user_id,
  p.role,
  FALSE, -- Assume not enabled yet
  'grace_period',
  NOW() + INTERVAL '7 days'
FROM profiles p
WHERE p.role IN ('admin', 'super_admin', 'physician', 'nurse', 'billing', 'case_manager')
  AND p.disabled_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM mfa_enrollment m
    WHERE m.user_id = p.user_id
  );

-- Create function to get MFA setup instructions for user
CREATE OR REPLACE FUNCTION get_mfa_setup_instructions(p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB AS $$
DECLARE
  v_enrollment RECORD;
  v_result JSONB;
BEGIN
  SELECT * INTO v_enrollment
  FROM mfa_enrollment
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'required', FALSE,
      'message', 'MFA is not required for your role'
    );
  END IF;

  v_result := jsonb_build_object(
    'required', v_enrollment.enforcement_status IN ('enforced', 'grace_period'),
    'status', v_enrollment.enforcement_status,
    'mfa_enabled', v_enrollment.mfa_enabled,
    'grace_period_ends', v_enrollment.grace_period_ends,
    'last_verified', v_enrollment.last_verified,
    'instructions', jsonb_build_object(
      'step1', 'Install Google Authenticator or Authy on your mobile device',
      'step2', 'Go to Settings → Security → Enable MFA',
      'step3', 'Scan the QR code with your authenticator app',
      'step4', 'Enter the 6-digit code to verify',
      'step5', 'Save backup codes in a secure location'
    )
  );

  IF v_enrollment.enforcement_status = 'grace_period' THEN
    v_result := v_result || jsonb_build_object(
      'warning', format(
        'You have until %s to enable MFA. After this date, you will not be able to access the system without MFA.',
        v_enrollment.grace_period_ends::TEXT
      )
    );
  END IF;

  IF v_enrollment.enforcement_status = 'enforced' AND NOT v_enrollment.mfa_enabled THEN
    v_result := v_result || jsonb_build_object(
      'error', 'MFA is required for your role. You must enable MFA to continue using the system.'
    );
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE mfa_enrollment IS 'Tracks MFA enrollment and enforcement status for SOC2 compliance';
COMMENT ON FUNCTION check_mfa_required IS 'Checks if user is required to have MFA enabled based on role and enforcement status';
COMMENT ON FUNCTION log_mfa_verification IS 'Logs MFA verification attempts for audit trail';
COMMENT ON FUNCTION grant_mfa_exemption IS 'Grants MFA exemption with approval tracking (super admin only)';
COMMENT ON VIEW mfa_compliance_report IS 'Real-time MFA compliance reporting by role for SOC2 audits';
