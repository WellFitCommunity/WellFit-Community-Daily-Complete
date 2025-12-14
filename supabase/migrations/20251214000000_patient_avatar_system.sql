-- Patient Avatar Visualization System
-- Migration: 20251214000000_patient_avatar_system.sql
--
-- Creates tables for patient avatar display preferences and medical device/condition markers
-- Integrates with SmartScribe for auto-population of markers from provider dictation

-- ============================================================================
-- TABLE: patient_avatars
-- Stores per-patient avatar display preferences (skin tone, gender presentation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS patient_avatars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL UNIQUE,
  skin_tone TEXT NOT NULL DEFAULT 'medium' CHECK (skin_tone IN ('light', 'mediumLight', 'medium', 'mediumDark', 'dark')),
  gender_presentation TEXT NOT NULL DEFAULT 'neutral' CHECK (gender_presentation IN ('male', 'female', 'neutral')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE patient_avatars IS 'Per-patient avatar display preferences for the Patient Avatar Visualization System';
COMMENT ON COLUMN patient_avatars.skin_tone IS 'Avatar skin tone: light, mediumLight, medium, mediumDark, dark';
COMMENT ON COLUMN patient_avatars.gender_presentation IS 'Avatar body shape: male, female, or neutral';

-- ============================================================================
-- TABLE: patient_markers
-- Medical devices, conditions, wounds positioned on patient avatar
-- ============================================================================
CREATE TABLE IF NOT EXISTS patient_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,

  -- Marker classification
  category TEXT NOT NULL CHECK (category IN ('critical', 'moderate', 'informational', 'monitoring', 'chronic', 'neurological')),
  marker_type TEXT NOT NULL,
  display_name TEXT NOT NULL,

  -- Positioning
  body_region TEXT NOT NULL,
  position_x DECIMAL(5,2) NOT NULL CHECK (position_x >= 0 AND position_x <= 100),
  position_y DECIMAL(5,2) NOT NULL CHECK (position_y >= 0 AND position_y <= 100),
  body_view TEXT NOT NULL DEFAULT 'front' CHECK (body_view IN ('front', 'back')),

  -- SmartScribe integration
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'smartscribe', 'import')),
  source_transcription_id UUID,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending_confirmation', 'confirmed', 'rejected')),
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),

  -- Extended details stored as JSONB
  details JSONB DEFAULT '{}'::jsonb,

  -- Status flags
  is_active BOOLEAN DEFAULT true,
  requires_attention BOOLEAN DEFAULT false,

  -- Audit fields
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE patient_markers IS 'Medical devices, conditions, and wounds visualized on patient avatar';
COMMENT ON COLUMN patient_markers.category IS 'Color coding: critical(red), moderate(yellow), informational(blue), monitoring(purple), chronic(green), neurological(orange)';
COMMENT ON COLUMN patient_markers.position_x IS 'Horizontal position as percentage (0-100) from left edge';
COMMENT ON COLUMN patient_markers.position_y IS 'Vertical position as percentage (0-100) from top edge';
COMMENT ON COLUMN patient_markers.source IS 'How marker was created: manual, smartscribe (auto-detected), or import';
COMMENT ON COLUMN patient_markers.status IS 'Confirmation status: pending_confirmation, confirmed, or rejected';
COMMENT ON COLUMN patient_markers.details IS 'Extended details: onset_date, insertion_date, care_instructions, complications_watch, severity_stage, icd10_code, medications, notes, etc.';

-- ============================================================================
-- TABLE: patient_marker_history
-- Audit trail for all marker changes (HIPAA compliance)
-- ============================================================================
CREATE TABLE IF NOT EXISTS patient_marker_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marker_id UUID NOT NULL REFERENCES patient_markers(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deactivated', 'reactivated', 'confirmed', 'rejected', 'position_changed')),
  changed_by UUID,
  previous_values JSONB,
  new_values JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE patient_marker_history IS 'Audit trail for patient marker changes (HIPAA compliance)';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Patient lookups
CREATE INDEX IF NOT EXISTS idx_patient_avatars_patient_id ON patient_avatars(patient_id);

-- Marker lookups
CREATE INDEX IF NOT EXISTS idx_patient_markers_patient_id ON patient_markers(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_markers_active ON patient_markers(patient_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_patient_markers_category ON patient_markers(patient_id, category);
CREATE INDEX IF NOT EXISTS idx_patient_markers_pending ON patient_markers(patient_id, status) WHERE status = 'pending_confirmation';
CREATE INDEX IF NOT EXISTS idx_patient_markers_attention ON patient_markers(patient_id, requires_attention) WHERE requires_attention = true;

-- History lookups
CREATE INDEX IF NOT EXISTS idx_patient_marker_history_marker_id ON patient_marker_history(marker_id);
CREATE INDEX IF NOT EXISTS idx_patient_marker_history_created_at ON patient_marker_history(created_at);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at for patient_avatars
CREATE OR REPLACE FUNCTION update_patient_avatars_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_patient_avatars_updated_at ON patient_avatars;
CREATE TRIGGER trg_patient_avatars_updated_at
  BEFORE UPDATE ON patient_avatars
  FOR EACH ROW
  EXECUTE FUNCTION update_patient_avatars_updated_at();

-- Auto-update updated_at for patient_markers
CREATE OR REPLACE FUNCTION update_patient_markers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_patient_markers_updated_at ON patient_markers;
CREATE TRIGGER trg_patient_markers_updated_at
  BEFORE UPDATE ON patient_markers
  FOR EACH ROW
  EXECUTE FUNCTION update_patient_markers_updated_at();

-- Auto-log marker history on changes
CREATE OR REPLACE FUNCTION log_patient_marker_history()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO patient_marker_history (marker_id, action, changed_by, new_values)
    VALUES (NEW.id, 'created', NEW.created_by, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Determine action type
    IF OLD.is_active = true AND NEW.is_active = false THEN
      INSERT INTO patient_marker_history (marker_id, action, changed_by, previous_values, new_values)
      VALUES (NEW.id, 'deactivated', NEW.created_by, to_jsonb(OLD), to_jsonb(NEW));
    ELSIF OLD.is_active = false AND NEW.is_active = true THEN
      INSERT INTO patient_marker_history (marker_id, action, changed_by, previous_values, new_values)
      VALUES (NEW.id, 'reactivated', NEW.created_by, to_jsonb(OLD), to_jsonb(NEW));
    ELSIF OLD.status = 'pending_confirmation' AND NEW.status = 'confirmed' THEN
      INSERT INTO patient_marker_history (marker_id, action, changed_by, previous_values, new_values)
      VALUES (NEW.id, 'confirmed', NEW.created_by, to_jsonb(OLD), to_jsonb(NEW));
    ELSIF OLD.status = 'pending_confirmation' AND NEW.status = 'rejected' THEN
      INSERT INTO patient_marker_history (marker_id, action, changed_by, previous_values, new_values)
      VALUES (NEW.id, 'rejected', NEW.created_by, to_jsonb(OLD), to_jsonb(NEW));
    ELSIF OLD.position_x != NEW.position_x OR OLD.position_y != NEW.position_y THEN
      INSERT INTO patient_marker_history (marker_id, action, changed_by, previous_values, new_values)
      VALUES (NEW.id, 'position_changed', NEW.created_by, to_jsonb(OLD), to_jsonb(NEW));
    ELSE
      INSERT INTO patient_marker_history (marker_id, action, changed_by, previous_values, new_values)
      VALUES (NEW.id, 'updated', NEW.created_by, to_jsonb(OLD), to_jsonb(NEW));
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_patient_marker_history ON patient_markers;
CREATE TRIGGER trg_patient_marker_history
  AFTER INSERT OR UPDATE ON patient_markers
  FOR EACH ROW
  EXECUTE FUNCTION log_patient_marker_history();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE patient_avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_marker_history ENABLE ROW LEVEL SECURITY;

-- Patient avatars: viewable by authenticated users (rely on application-level checks for patient access)
CREATE POLICY "patient_avatars_select" ON patient_avatars
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "patient_avatars_insert" ON patient_avatars
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "patient_avatars_update" ON patient_avatars
  FOR UPDATE TO authenticated
  USING (true);

-- Patient markers: viewable by authenticated users
CREATE POLICY "patient_markers_select" ON patient_markers
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "patient_markers_insert" ON patient_markers
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "patient_markers_update" ON patient_markers
  FOR UPDATE TO authenticated
  USING (true);

-- Marker history: read-only for authenticated users
CREATE POLICY "patient_marker_history_select" ON patient_marker_history
  FOR SELECT TO authenticated
  USING (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get active markers for a patient with pending count
CREATE OR REPLACE FUNCTION get_patient_markers_with_pending_count(p_patient_id UUID)
RETURNS TABLE (
  markers JSONB,
  pending_count BIGINT,
  attention_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'category', m.category,
          'marker_type', m.marker_type,
          'display_name', m.display_name,
          'body_region', m.body_region,
          'position_x', m.position_x,
          'position_y', m.position_y,
          'body_view', m.body_view,
          'source', m.source,
          'status', m.status,
          'confidence_score', m.confidence_score,
          'details', m.details,
          'is_active', m.is_active,
          'requires_attention', m.requires_attention,
          'created_at', m.created_at,
          'updated_at', m.updated_at
        )
        ORDER BY
          CASE m.category
            WHEN 'critical' THEN 1
            WHEN 'neurological' THEN 2
            WHEN 'chronic' THEN 3
            WHEN 'moderate' THEN 4
            WHEN 'monitoring' THEN 5
            WHEN 'informational' THEN 6
          END,
          m.created_at DESC
      ) FILTER (WHERE m.is_active = true AND m.status != 'rejected'),
      '[]'::jsonb
    ) AS markers,
    COUNT(*) FILTER (WHERE m.status = 'pending_confirmation' AND m.is_active = true) AS pending_count,
    COUNT(*) FILTER (WHERE m.requires_attention = true AND m.is_active = true) AS attention_count
  FROM patient_markers m
  WHERE m.patient_id = p_patient_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Confirm a pending marker
CREATE OR REPLACE FUNCTION confirm_patient_marker(p_marker_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated BOOLEAN := false;
BEGIN
  UPDATE patient_markers
  SET
    status = 'confirmed',
    requires_attention = false,
    created_by = p_user_id
  WHERE id = p_marker_id
    AND status = 'pending_confirmation';

  v_updated := FOUND;
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reject a pending marker
CREATE OR REPLACE FUNCTION reject_patient_marker(p_marker_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated BOOLEAN := false;
BEGIN
  UPDATE patient_markers
  SET
    status = 'rejected',
    is_active = false,
    requires_attention = false,
    created_by = p_user_id
  WHERE id = p_marker_id
    AND status = 'pending_confirmation';

  v_updated := FOUND;
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Deactivate a marker (soft delete)
CREATE OR REPLACE FUNCTION deactivate_patient_marker(p_marker_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated BOOLEAN := false;
BEGIN
  UPDATE patient_markers
  SET
    is_active = false,
    requires_attention = false,
    created_by = p_user_id
  WHERE id = p_marker_id
    AND is_active = true;

  v_updated := FOUND;
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get or create patient avatar (upsert)
CREATE OR REPLACE FUNCTION get_or_create_patient_avatar(
  p_patient_id UUID,
  p_skin_tone TEXT DEFAULT 'medium',
  p_gender_presentation TEXT DEFAULT 'neutral'
)
RETURNS patient_avatars AS $$
DECLARE
  v_avatar patient_avatars;
BEGIN
  -- Try to get existing
  SELECT * INTO v_avatar FROM patient_avatars WHERE patient_id = p_patient_id;

  IF v_avatar IS NULL THEN
    INSERT INTO patient_avatars (patient_id, skin_tone, gender_presentation)
    VALUES (p_patient_id, p_skin_tone, p_gender_presentation)
    RETURNING * INTO v_avatar;
  END IF;

  RETURN v_avatar;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON patient_avatars TO authenticated;
GRANT SELECT, INSERT, UPDATE ON patient_markers TO authenticated;
GRANT SELECT ON patient_marker_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_patient_markers_with_pending_count TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_patient_marker TO authenticated;
GRANT EXECUTE ON FUNCTION reject_patient_marker TO authenticated;
GRANT EXECUTE ON FUNCTION deactivate_patient_marker TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_patient_avatar TO authenticated;
