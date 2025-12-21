-- Patient Avatar System Database Tables
-- Creates tables for avatar preferences, markers, and history

-- ============================================================================
-- PATIENT AVATARS TABLE
-- Stores avatar display preferences (skin tone, gender presentation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS patient_avatars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skin_tone TEXT NOT NULL DEFAULT 'medium' CHECK (skin_tone IN ('light', 'mediumLight', 'medium', 'mediumDark', 'dark')),
  gender_presentation TEXT NOT NULL DEFAULT 'neutral' CHECK (gender_presentation IN ('male', 'female', 'neutral')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(patient_id)
);

-- Index for fast lookup by patient
CREATE INDEX idx_patient_avatars_patient_id ON patient_avatars(patient_id);

-- ============================================================================
-- PATIENT MARKERS TABLE
-- Stores markers (devices, conditions, wounds) on the avatar
-- ============================================================================

CREATE TABLE IF NOT EXISTS patient_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Classification
  category TEXT NOT NULL CHECK (category IN ('critical', 'moderate', 'informational', 'monitoring', 'chronic', 'neurological')),
  marker_type TEXT NOT NULL,
  display_name TEXT NOT NULL,

  -- Positioning
  body_region TEXT NOT NULL,
  position_x NUMERIC NOT NULL CHECK (position_x >= 0 AND position_x <= 100),
  position_y NUMERIC NOT NULL CHECK (position_y >= 0 AND position_y <= 100),
  body_view TEXT NOT NULL DEFAULT 'front' CHECK (body_view IN ('front', 'back')),

  -- SmartScribe integration
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'smartscribe', 'import')),
  source_transcription_id UUID,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending_confirmation', 'confirmed', 'rejected')),
  confidence_score NUMERIC CHECK (confidence_score >= 0 AND confidence_score <= 1),

  -- Extended details (JSONB)
  details JSONB NOT NULL DEFAULT '{}',

  -- Status flags
  is_active BOOLEAN NOT NULL DEFAULT true,
  requires_attention BOOLEAN NOT NULL DEFAULT false,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_patient_markers_patient_id ON patient_markers(patient_id);
CREATE INDEX idx_patient_markers_active ON patient_markers(patient_id, is_active) WHERE is_active = true;
CREATE INDEX idx_patient_markers_pending ON patient_markers(patient_id, status) WHERE status = 'pending_confirmation';
CREATE INDEX idx_patient_markers_category ON patient_markers(category);

-- ============================================================================
-- PATIENT MARKER HISTORY TABLE
-- Audit trail for marker changes
-- ============================================================================

CREATE TABLE IF NOT EXISTS patient_marker_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marker_id UUID NOT NULL REFERENCES patient_markers(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deactivated', 'reactivated', 'confirmed', 'rejected', 'position_changed')),
  changed_by UUID REFERENCES auth.users(id),
  previous_values JSONB,
  new_values JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for looking up history by marker
CREATE INDEX idx_patient_marker_history_marker_id ON patient_marker_history(marker_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE patient_avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_marker_history ENABLE ROW LEVEL SECURITY;

-- Patient Avatars Policies
CREATE POLICY "Users can view own avatar" ON patient_avatars
  FOR SELECT TO authenticated
  USING (patient_id = auth.uid());

CREATE POLICY "Users can insert own avatar" ON patient_avatars
  FOR INSERT TO authenticated
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Users can update own avatar" ON patient_avatars
  FOR UPDATE TO authenticated
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Clinical staff can view all avatars" ON patient_avatars
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND (p.is_admin = true OR p.role IN ('nurse', 'physician', 'care_coordinator', 'clinical_staff'))
    )
  );

-- Patient Markers Policies
CREATE POLICY "Users can view own markers" ON patient_markers
  FOR SELECT TO authenticated
  USING (patient_id = auth.uid());

CREATE POLICY "Clinical staff can view all markers" ON patient_markers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND (p.is_admin = true OR p.role IN ('nurse', 'physician', 'care_coordinator', 'clinical_staff'))
    )
  );

CREATE POLICY "Clinical staff can insert markers" ON patient_markers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND (p.is_admin = true OR p.role IN ('nurse', 'physician', 'care_coordinator', 'clinical_staff'))
    )
  );

CREATE POLICY "Clinical staff can update markers" ON patient_markers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND (p.is_admin = true OR p.role IN ('nurse', 'physician', 'care_coordinator', 'clinical_staff'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND (p.is_admin = true OR p.role IN ('nurse', 'physician', 'care_coordinator', 'clinical_staff'))
    )
  );

-- Marker History Policies
CREATE POLICY "Users can view own marker history" ON patient_marker_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM patient_markers pm
      WHERE pm.id = marker_id AND pm.patient_id = auth.uid()
    )
  );

CREATE POLICY "Clinical staff can view all marker history" ON patient_marker_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND (p.is_admin = true OR p.role IN ('nurse', 'physician', 'care_coordinator', 'clinical_staff'))
    )
  );

CREATE POLICY "Clinical staff can insert marker history" ON patient_marker_history
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND (p.is_admin = true OR p.role IN ('nurse', 'physician', 'care_coordinator', 'clinical_staff'))
    )
  );

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_patient_avatar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patient_avatars_updated_at
  BEFORE UPDATE ON patient_avatars
  FOR EACH ROW EXECUTE FUNCTION update_patient_avatar_updated_at();

CREATE TRIGGER patient_markers_updated_at
  BEFORE UPDATE ON patient_markers
  FOR EACH ROW EXECUTE FUNCTION update_patient_avatar_updated_at();

-- ============================================================================
-- TRIGGER TO AUTO-CREATE HISTORY ON MARKER CHANGES
-- ============================================================================

CREATE OR REPLACE FUNCTION log_marker_history()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO patient_marker_history (marker_id, action, changed_by, new_values)
    VALUES (NEW.id, 'created', NEW.created_by, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Determine action based on what changed
    DECLARE
      v_action TEXT := 'updated';
    BEGIN
      IF OLD.is_active = true AND NEW.is_active = false THEN
        v_action := 'deactivated';
      ELSIF OLD.is_active = false AND NEW.is_active = true THEN
        v_action := 'reactivated';
      ELSIF OLD.status = 'pending_confirmation' AND NEW.status = 'confirmed' THEN
        v_action := 'confirmed';
      ELSIF OLD.status = 'pending_confirmation' AND NEW.status = 'rejected' THEN
        v_action := 'rejected';
      ELSIF OLD.position_x != NEW.position_x OR OLD.position_y != NEW.position_y OR OLD.body_view != NEW.body_view THEN
        v_action := 'position_changed';
      END IF;

      INSERT INTO patient_marker_history (marker_id, action, changed_by, previous_values, new_values)
      VALUES (NEW.id, v_action, auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    END;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER patient_markers_history_trigger
  AFTER INSERT OR UPDATE ON patient_markers
  FOR EACH ROW EXECUTE FUNCTION log_marker_history();

-- ============================================================================
-- HELPER FUNCTION: GET MARKERS WITH COUNTS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_patient_markers_with_counts(p_patient_id UUID)
RETURNS TABLE(
  markers JSONB,
  pending_count BIGINT,
  attention_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', pm.id,
        'patient_id', pm.patient_id,
        'category', pm.category,
        'marker_type', pm.marker_type,
        'display_name', pm.display_name,
        'body_region', pm.body_region,
        'position_x', pm.position_x,
        'position_y', pm.position_y,
        'body_view', pm.body_view,
        'source', pm.source,
        'source_transcription_id', pm.source_transcription_id,
        'status', pm.status,
        'confidence_score', pm.confidence_score,
        'details', pm.details,
        'is_active', pm.is_active,
        'requires_attention', pm.requires_attention,
        'created_by', pm.created_by,
        'created_at', pm.created_at,
        'updated_at', pm.updated_at
      ) ORDER BY pm.created_at DESC
    ) FILTER (WHERE pm.is_active = true), '[]'::jsonb) as markers,
    COUNT(*) FILTER (WHERE pm.is_active = true AND pm.status = 'pending_confirmation') as pending_count,
    COUNT(*) FILTER (WHERE pm.is_active = true AND pm.requires_attention = true) as attention_count
  FROM patient_markers pm
  WHERE pm.patient_id = p_patient_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_patient_markers_with_counts(UUID) TO authenticated;

-- ============================================================================
-- ADDITIONAL RPC FUNCTIONS FOR SERVICE LAYER
-- ============================================================================

-- Get or create patient avatar
CREATE OR REPLACE FUNCTION get_or_create_patient_avatar(
  p_patient_id UUID,
  p_skin_tone TEXT DEFAULT 'medium',
  p_gender_presentation TEXT DEFAULT 'neutral'
)
RETURNS patient_avatars AS $$
DECLARE
  v_avatar patient_avatars;
BEGIN
  SELECT * INTO v_avatar FROM patient_avatars WHERE patient_id = p_patient_id;

  IF v_avatar IS NULL THEN
    INSERT INTO patient_avatars (patient_id, skin_tone, gender_presentation)
    VALUES (p_patient_id, p_skin_tone, p_gender_presentation)
    RETURNING * INTO v_avatar;
  END IF;

  RETURN v_avatar;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Wrapper for service layer (matches expected function name)
CREATE OR REPLACE FUNCTION get_patient_markers_with_pending_count(p_patient_id UUID)
RETURNS TABLE(
  markers JSONB,
  pending_count BIGINT,
  attention_count BIGINT
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM get_patient_markers_with_counts(p_patient_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Confirm a pending marker
CREATE OR REPLACE FUNCTION confirm_patient_marker(
  p_marker_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE patient_markers
  SET status = 'confirmed', requires_attention = false
  WHERE id = p_marker_id AND status = 'pending_confirmation';
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reject a pending marker
CREATE OR REPLACE FUNCTION reject_patient_marker(
  p_marker_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE patient_markers
  SET status = 'rejected', is_active = false, requires_attention = false
  WHERE id = p_marker_id AND status = 'pending_confirmation';
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Deactivate a marker (soft delete)
CREATE OR REPLACE FUNCTION deactivate_patient_marker(
  p_marker_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE patient_markers
  SET is_active = false, requires_attention = false
  WHERE id = p_marker_id AND is_active = true;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON patient_avatars TO authenticated;
GRANT SELECT, INSERT, UPDATE ON patient_markers TO authenticated;
GRANT SELECT, INSERT ON patient_marker_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_patient_avatar(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_patient_markers_with_pending_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_patient_marker(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_patient_marker(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION deactivate_patient_marker(UUID, UUID) TO authenticated;
