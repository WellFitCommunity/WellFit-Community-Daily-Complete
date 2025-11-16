-- Reduce MFA Grace Period from 7 days to 48 hours
-- Security Enhancement: Tighter MFA enforcement window
-- Date: 2025-10-31

-- Update the check_mfa_required function to use 48 hours instead of 7 days
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

    -- If no enrollment record, create one with grace period (CHANGED: 48 hours instead of 7 days)
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
        NOW() + INTERVAL '48 hours'  -- CHANGED from '7 days'
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

-- Update existing users in grace period to have 48-hour window from now
-- This gives them a fresh 48-hour window starting today
UPDATE mfa_enrollment
SET grace_period_ends = NOW() + INTERVAL '48 hours',
    updated_at = NOW()
WHERE enforcement_status = 'grace_period'
  AND mfa_enabled = FALSE
  AND grace_period_ends > NOW();  -- Only update those still in grace period

-- Log this security policy change
INSERT INTO security_events (
  event_type,
  severity,
  description,
  metadata
) VALUES (
  'mfa_policy_updated',
  'LOW',
  'MFA grace period reduced from 7 days to 48 hours',
  jsonb_build_object(
    'previous_grace_period', '7 days',
    'new_grace_period', '48 hours',
    'reason', 'Enhanced security compliance',
    'updated_at', NOW()
  )
);

COMMENT ON FUNCTION check_mfa_required IS 'Checks if user is required to have MFA enabled. Grace period is 48 hours for new users in privileged roles.';
