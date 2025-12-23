/**
 * Add missing RPC functions that are called by frontend services
 *
 * These functions are referenced in TypeScript code but were never created
 * in database migrations, causing runtime errors.
 *
 * Functions added:
 * 1. get_ai_skill_config - Returns AI skill configuration for a tenant
 * 2. log_security_event - Logs security events to security_events table
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

-- ============================================================================
-- FUNCTION: get_ai_skill_config
-- ============================================================================
-- Returns the AI skill configuration for a given tenant.
-- Used by AI services to check which skills are enabled per tenant.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_ai_skill_config(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_config JSONB;
BEGIN
  -- Input validation
  IF p_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get the config for this tenant
  SELECT jsonb_build_object(
    'id', id,
    'tenant_id', tenant_id,
    'billing_suggester_enabled', COALESCE(billing_suggester_enabled, false),
    'readmission_predictor_enabled', COALESCE(readmission_predictor_enabled, false),
    'cultural_health_coach_enabled', COALESCE(cultural_health_coach_enabled, false),
    'welfare_check_dispatcher_enabled', COALESCE(welfare_check_dispatcher_enabled, false),
    'emergency_intelligence_enabled', COALESCE(emergency_intelligence_enabled, false),
    'created_at', created_at,
    'updated_at', updated_at
  ) INTO v_config
  FROM ai_skill_config
  WHERE tenant_id = p_tenant_id;

  -- If no config exists, return defaults
  IF v_config IS NULL THEN
    RETURN jsonb_build_object(
      'tenant_id', p_tenant_id,
      'billing_suggester_enabled', false,
      'readmission_predictor_enabled', false,
      'cultural_health_coach_enabled', false,
      'welfare_check_dispatcher_enabled', false,
      'emergency_intelligence_enabled', false
    );
  END IF;

  RETURN v_config;
END;
$$;

-- Grant execute to authenticated users and service role
GRANT EXECUTE ON FUNCTION get_ai_skill_config(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ai_skill_config(UUID) TO service_role;

COMMENT ON FUNCTION get_ai_skill_config IS
  'Returns AI skill configuration for a tenant. Returns default disabled config if tenant has no config.';


-- ============================================================================
-- FUNCTION: log_security_event
-- ============================================================================
-- Logs a security event to the security_events table.
-- Used by security services throughout the application.
-- ============================================================================

CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type TEXT,
  p_severity TEXT,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
  v_user_id UUID;
  v_tenant_id UUID;
BEGIN
  -- Get current user if authenticated
  v_user_id := auth.uid();

  -- Try to get tenant_id from user's profile
  IF v_user_id IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant_id
    FROM profiles
    WHERE user_id = v_user_id
    LIMIT 1;
  END IF;

  -- Validate severity
  IF p_severity NOT IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') THEN
    p_severity := 'MEDIUM';
  END IF;

  -- Insert the security event
  INSERT INTO security_events (
    event_type,
    severity,
    description,
    metadata,
    actor_user_id,
    user_id,
    tenant_id,
    detection_method,
    detected_by
  ) VALUES (
    p_event_type,
    p_severity,
    p_description,
    COALESCE(p_metadata, '{}'::JSONB),
    v_user_id,
    v_user_id,
    v_tenant_id,
    'automated',
    'system'
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- Grant execute to authenticated users and service role
GRANT EXECUTE ON FUNCTION log_security_event(TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION log_security_event(TEXT, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION log_security_event(TEXT, TEXT, TEXT, JSONB) TO anon;

COMMENT ON FUNCTION log_security_event IS
  'Logs a security event. Returns the event ID. Automatically captures user and tenant context.';
