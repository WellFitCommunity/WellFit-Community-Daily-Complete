-- Migration Feedback Tables for NPS Survey
-- Part of the Intelligent Migration Engine

-- Migration Feedback - stores detailed survey responses
-- Note: batch_id is nullable and without FK until migration_batch is verified
CREATE TABLE IF NOT EXISTS migration_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID,
  organization_id UUID NOT NULL,
  nps_score INTEGER NOT NULL CHECK (nps_score >= 0 AND nps_score <= 10),
  what_worked_well TEXT,
  what_needs_improvement TEXT,
  additional_comments TEXT,
  user_id UUID REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration Quick Ratings - stores in-process thumbs up/down feedback
CREATE TABLE IF NOT EXISTS migration_quick_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID,
  organization_id UUID NOT NULL,
  rating_type VARCHAR(20) NOT NULL CHECK (rating_type IN ('thumbs_up', 'thumbs_down')),
  context_type VARCHAR(50) NOT NULL,
  context_id TEXT,
  comment TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_migration_feedback_batch_id ON migration_feedback(batch_id);
CREATE INDEX IF NOT EXISTS idx_migration_feedback_org_id ON migration_feedback(organization_id);
CREATE INDEX IF NOT EXISTS idx_migration_feedback_nps ON migration_feedback(nps_score);
CREATE INDEX IF NOT EXISTS idx_migration_quick_ratings_batch_id ON migration_quick_ratings(batch_id);
CREATE INDEX IF NOT EXISTS idx_migration_quick_ratings_org_id ON migration_quick_ratings(organization_id);
CREATE INDEX IF NOT EXISTS idx_migration_quick_ratings_type ON migration_quick_ratings(rating_type);

-- RLS Policies
ALTER TABLE migration_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_quick_ratings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS migration_feedback_select ON migration_feedback;
DROP POLICY IF EXISTS migration_feedback_insert ON migration_feedback;
DROP POLICY IF EXISTS migration_quick_ratings_select ON migration_quick_ratings;
DROP POLICY IF EXISTS migration_quick_ratings_insert ON migration_quick_ratings;

-- Create RLS policies
CREATE POLICY migration_feedback_select ON migration_feedback
  FOR SELECT USING (
    organization_id IN (
      SELECT COALESCE(
        (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()),
        organization_id
      )
    )
  );

CREATE POLICY migration_feedback_insert ON migration_feedback
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT COALESCE(
        (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()),
        organization_id
      )
    )
  );

CREATE POLICY migration_quick_ratings_select ON migration_quick_ratings
  FOR SELECT USING (
    organization_id IN (
      SELECT COALESCE(
        (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()),
        organization_id
      )
    )
  );

CREATE POLICY migration_quick_ratings_insert ON migration_quick_ratings
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT COALESCE(
        (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()),
        organization_id
      )
    )
  );

-- Function to submit feedback
CREATE OR REPLACE FUNCTION submit_migration_feedback(
  p_batch_id UUID,
  p_organization_id UUID,
  p_nps_score INTEGER,
  p_what_worked_well TEXT DEFAULT NULL,
  p_what_needs_improvement TEXT DEFAULT NULL,
  p_additional_comments TEXT DEFAULT NULL
) RETURNS UUID AS $func$
DECLARE
  v_feedback_id UUID;
BEGIN
  INSERT INTO migration_feedback (
    batch_id,
    organization_id,
    nps_score,
    what_worked_well,
    what_needs_improvement,
    additional_comments,
    user_id
  ) VALUES (
    p_batch_id,
    p_organization_id,
    p_nps_score,
    p_what_worked_well,
    p_what_needs_improvement,
    p_additional_comments,
    auth.uid()
  )
  RETURNING id INTO v_feedback_id;

  RETURN v_feedback_id;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get NPS analytics for an organization
CREATE OR REPLACE FUNCTION get_migration_nps_analytics(
  p_organization_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '90 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE (
  total_responses BIGINT,
  promoters BIGINT,
  passives BIGINT,
  detractors BIGINT,
  nps_score NUMERIC,
  avg_score NUMERIC
) AS $func$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_responses,
    COUNT(*) FILTER (WHERE mf.nps_score >= 9)::BIGINT as promoters,
    COUNT(*) FILTER (WHERE mf.nps_score >= 7 AND mf.nps_score <= 8)::BIGINT as passives,
    COUNT(*) FILTER (WHERE mf.nps_score <= 6)::BIGINT as detractors,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND(
          (COUNT(*) FILTER (WHERE mf.nps_score >= 9)::NUMERIC / COUNT(*) * 100) -
          (COUNT(*) FILTER (WHERE mf.nps_score <= 6)::NUMERIC / COUNT(*) * 100),
          1
        )
      ELSE 0
    END as nps_score,
    ROUND(AVG(mf.nps_score), 1) as avg_score
  FROM migration_feedback mf
  WHERE mf.organization_id = p_organization_id
    AND mf.submitted_at BETWEEN p_start_date AND p_end_date;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, INSERT ON migration_feedback TO authenticated;
GRANT SELECT, INSERT ON migration_quick_ratings TO authenticated;
GRANT EXECUTE ON FUNCTION submit_migration_feedback TO authenticated;
GRANT EXECUTE ON FUNCTION get_migration_nps_analytics TO authenticated;

-- Add updated_at trigger (if trigger function exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS migration_feedback_updated_at ON migration_feedback;
    CREATE TRIGGER migration_feedback_updated_at
      BEFORE UPDATE ON migration_feedback
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

COMMENT ON TABLE migration_feedback IS 'Stores NPS survey responses for migration batches';
COMMENT ON TABLE migration_quick_ratings IS 'Stores quick thumbs up/down feedback during migration process';
