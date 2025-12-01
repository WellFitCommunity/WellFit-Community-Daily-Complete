-- ============================================================================
-- CLOCK_OUT TENANT VALIDATION: Add tenant check as defense in depth
-- ============================================================================
-- The previous fix validated user_id, but adding tenant validation provides
-- an additional security layer to ensure callers can only affect entries
-- within their own tenant.
-- ============================================================================

CREATE OR REPLACE FUNCTION clock_out(
  p_entry_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  total_minutes INTEGER,
  total_hours NUMERIC,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clock_in_time TIMESTAMPTZ;
  v_entry_user_id UUID;
  v_entry_tenant_id UUID;
  v_caller_tenant_id UUID;
  v_total_minutes INTEGER;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- =========================================================================
  -- SECURITY: Validate caller identity
  -- =========================================================================
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 0.00::NUMERIC, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  -- Get caller's tenant for validation
  SELECT tenant_id INTO v_caller_tenant_id
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_caller_tenant_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 0.00::NUMERIC, 'User profile not found'::TEXT;
    RETURN;
  END IF;

  -- Get entry details and verify ownership + tenant
  SELECT clock_in_time, user_id, tenant_id
  INTO v_clock_in_time, v_entry_user_id, v_entry_tenant_id
  FROM time_clock_entries
  WHERE id = p_entry_id AND status = 'clocked_in';

  IF v_clock_in_time IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 0.00::NUMERIC, 'Entry not found or already clocked out'::TEXT;
    RETURN;
  END IF;

  -- SECURITY: Verify the entry belongs to the caller
  IF v_entry_user_id != auth.uid() THEN
    RETURN QUERY SELECT FALSE, 0, 0.00::NUMERIC, 'Cannot clock out another user''s entry'::TEXT;
    RETURN;
  END IF;

  -- SECURITY: Verify the entry is in the caller's tenant (defense in depth)
  IF v_entry_tenant_id != v_caller_tenant_id THEN
    RETURN QUERY SELECT FALSE, 0, 0.00::NUMERIC, 'Entry not in your tenant'::TEXT;
    RETURN;
  END IF;

  -- Calculate minutes
  v_total_minutes := EXTRACT(EPOCH FROM (v_now - v_clock_in_time)) / 60;

  -- Update the entry
  UPDATE time_clock_entries
  SET
    clock_out_time = v_now,
    total_minutes = v_total_minutes,
    status = 'clocked_out',
    notes = COALESCE(p_notes, notes)
  WHERE id = p_entry_id
    AND user_id = auth.uid()  -- Extra safety in WHERE clause
    AND tenant_id = v_caller_tenant_id;  -- Extra safety in WHERE clause

  RETURN QUERY SELECT
    TRUE,
    v_total_minutes,
    ROUND(v_total_minutes / 60.0, 2)::NUMERIC,
    'Clocked out successfully! You worked ' ||
      FLOOR(v_total_minutes / 60) || ' hours and ' ||
      (v_total_minutes % 60) || ' minutes today.'::TEXT;
END;
$$;
