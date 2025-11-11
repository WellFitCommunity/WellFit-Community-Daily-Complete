-- SDOH Passive Detection System
-- Stores automatically detected SDOH indicators from free-text analysis
-- Complements structured SDOH assessments with passive monitoring

-- ============================================================================
-- ENSURE PROFILES TABLE HAS REQUIRED CONSTRAINTS
-- ============================================================================

-- Ensure profiles.id has a unique constraint (needed for foreign key references)
DO $$
BEGIN
  -- Check if profiles.id already has a unique constraint or primary key
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'profiles'::regclass
    AND a.attname = 'id'
    AND c.contype IN ('p', 'u')  -- primary key or unique
  ) THEN
    -- Add unique constraint if it doesn't exist
    ALTER TABLE profiles ADD CONSTRAINT profiles_id_unique UNIQUE (id);
    RAISE NOTICE 'Added UNIQUE constraint on profiles.id';
  ELSE
    RAISE NOTICE 'profiles.id already has a unique constraint';
  END IF;
END$$;

-- ============================================================================
-- ENSURE HELPER FUNCTIONS EXIST
-- ============================================================================

-- Create get_current_tenant_id if it doesn't exist
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN COALESCE(
    current_setting('app.current_tenant_id', true)::uuid,
    (SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create update_updated_at_column if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CREATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS sdoh_passive_detections (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant isolation
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Patient reference (profiles with role='patient')
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Detection metadata
  category TEXT NOT NULL, -- SDOH category (housing, food-security, etc.)
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  matched_keywords TEXT[] NOT NULL, -- Keywords that triggered detection
  context_snippet TEXT NOT NULL, -- Excerpt from source text
  risk_level TEXT NOT NULL CHECK (risk_level IN ('none', 'low', 'moderate', 'high', 'critical', 'unknown')),
  suggested_z_code TEXT NOT NULL, -- ICD-10 Z-code for billing

  -- Source tracking
  source_type TEXT NOT NULL CHECK (source_type IN (
    'clinical_note',
    'community_post',
    'patient_message',
    'check_in_comment',
    'telehealth_transcript',
    'scribe_note'
  )),
  source_id UUID NOT NULL, -- ID of the source document

  -- Review workflow
  reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID, -- References users but nullable for flexibility
  review_notes TEXT,

  -- Timestamps
  detected_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Multi-tenant isolation
CREATE INDEX IF NOT EXISTS idx_sdoh_passive_detections_tenant_id
ON sdoh_passive_detections(tenant_id);

-- Patient lookup
CREATE INDEX IF NOT EXISTS idx_sdoh_passive_detections_patient_id
ON sdoh_passive_detections(patient_id);

-- Unreviewed detections (for clinical workflow)
CREATE INDEX IF NOT EXISTS idx_sdoh_passive_detections_unreviewed
ON sdoh_passive_detections(patient_id, reviewed)
WHERE reviewed = FALSE;

-- Category analysis
CREATE INDEX IF NOT EXISTS idx_sdoh_passive_detections_category
ON sdoh_passive_detections(category, risk_level);

-- Source tracking
CREATE INDEX IF NOT EXISTS idx_sdoh_passive_detections_source
ON sdoh_passive_detections(source_type, source_id);

-- Detection date range queries
CREATE INDEX IF NOT EXISTS idx_sdoh_passive_detections_detected_at
ON sdoh_passive_detections(detected_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE sdoh_passive_detections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS tenant_isolation_select ON sdoh_passive_detections;
DROP POLICY IF EXISTS tenant_isolation_insert ON sdoh_passive_detections;
DROP POLICY IF EXISTS tenant_isolation_update ON sdoh_passive_detections;
DROP POLICY IF EXISTS tenant_isolation_delete ON sdoh_passive_detections;

-- Policy: Users can only access detections from their tenant
CREATE POLICY tenant_isolation_select ON sdoh_passive_detections
  FOR SELECT
  USING (tenant_id = get_current_tenant_id());

-- Policy: Users can only insert detections for their tenant
CREATE POLICY tenant_isolation_insert ON sdoh_passive_detections
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant_id());

-- Policy: Users can only update detections from their tenant
CREATE POLICY tenant_isolation_update ON sdoh_passive_detections
  FOR UPDATE
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

-- Policy: Users can only delete detections from their tenant
CREATE POLICY tenant_isolation_delete ON sdoh_passive_detections
  FOR DELETE
  USING (tenant_id = get_current_tenant_id());

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-populate tenant_id from patient
CREATE OR REPLACE FUNCTION set_sdoh_detection_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Get tenant_id from profile (patient is a profile with role='patient')
  SELECT tenant_id INTO NEW.tenant_id
  FROM profiles
  WHERE id = NEW.patient_id;

  -- Ensure tenant_id was found
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'Cannot determine tenant_id for patient_id %', NEW.patient_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_sdoh_detection_tenant_id ON sdoh_passive_detections;
CREATE TRIGGER trg_set_sdoh_detection_tenant_id
  BEFORE INSERT ON sdoh_passive_detections
  FOR EACH ROW
  EXECUTE FUNCTION set_sdoh_detection_tenant_id();

-- Auto-update updated_at timestamp
DROP TRIGGER IF EXISTS trg_sdoh_passive_detections_updated_at ON sdoh_passive_detections;
CREATE TRIGGER trg_sdoh_passive_detections_updated_at
  BEFORE UPDATE ON sdoh_passive_detections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

/**
 * Get detection summary for a patient
 * Returns counts by category and review status
 */
CREATE OR REPLACE FUNCTION get_sdoh_detection_summary(p_patient_id UUID)
RETURNS TABLE (
  category TEXT,
  total_count BIGINT,
  unreviewed_count BIGINT,
  high_risk_count BIGINT,
  avg_confidence NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.category,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE NOT d.reviewed) as unreviewed_count,
    COUNT(*) FILTER (WHERE d.risk_level IN ('high', 'critical')) as high_risk_count,
    ROUND(AVG(d.confidence), 1) as avg_confidence
  FROM sdoh_passive_detections d
  WHERE d.patient_id = p_patient_id
    AND d.tenant_id = get_current_tenant_id()
  GROUP BY d.category
  ORDER BY unreviewed_count DESC, high_risk_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Get high-priority unreviewed detections across all patients
 * For care team dashboard
 */
CREATE OR REPLACE FUNCTION get_high_priority_sdoh_detections()
RETURNS TABLE (
  patient_id UUID,
  patient_name TEXT,
  category TEXT,
  risk_level TEXT,
  confidence INTEGER,
  context_snippet TEXT,
  detected_at TIMESTAMPTZ,
  detection_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.patient_id,
    COALESCE(p.full_name, p.email) as patient_name,
    d.category,
    d.risk_level,
    d.confidence,
    d.context_snippet,
    d.detected_at,
    d.id as detection_id
  FROM sdoh_passive_detections d
  INNER JOIN profiles p ON d.patient_id = p.id AND p.role = 'patient'
  WHERE d.tenant_id = get_current_tenant_id()
    AND d.reviewed = FALSE
    AND d.risk_level IN ('high', 'critical')
  ORDER BY
    CASE d.risk_level
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      ELSE 3
    END,
    d.detected_at DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE sdoh_passive_detections IS
'Stores SDOH indicators automatically detected from free-text analysis. Complements structured assessments with passive monitoring.';

COMMENT ON COLUMN sdoh_passive_detections.category IS
'SDOH category (housing, food-security, transportation, etc.)';

COMMENT ON COLUMN sdoh_passive_detections.confidence IS
'Detection confidence score 0-100 based on keyword matches and context';

COMMENT ON COLUMN sdoh_passive_detections.matched_keywords IS
'Array of keywords that triggered this detection';

COMMENT ON COLUMN sdoh_passive_detections.context_snippet IS
'Excerpt from source text showing where detection occurred';

COMMENT ON COLUMN sdoh_passive_detections.source_type IS
'Type of text source (clinical_note, community_post, patient_message, etc.)';

COMMENT ON COLUMN sdoh_passive_detections.source_id IS
'UUID of the source document (note_id, post_id, etc.)';

COMMENT ON COLUMN sdoh_passive_detections.reviewed IS
'Whether a clinician has reviewed this detection';

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON sdoh_passive_detections TO authenticated;

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION get_sdoh_detection_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_high_priority_sdoh_detections TO authenticated;
