-- AI System Recording Infrastructure
-- Records system behavior from inside for AI analysis

-- Session recordings table
CREATE TABLE IF NOT EXISTS session_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Timeline
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,

  -- Statistics
  snapshot_count INTEGER DEFAULT 0,

  -- AI Analysis
  ai_summary JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System snapshots table (detailed recording data)
CREATE TABLE IF NOT EXISTS system_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES session_recordings(session_id) ON DELETE CASCADE,

  -- Snapshot data
  snapshots JSONB NOT NULL,

  -- When recorded
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_session_recordings_user ON session_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_session_recordings_start_time ON session_recordings(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_session_recordings_session_id ON session_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_system_recordings_session ON system_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_system_recordings_recorded_at ON system_recordings(recorded_at DESC);

-- AI analysis results table
CREATE TABLE IF NOT EXISTS ai_recording_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES session_recordings(session_id) ON DELETE CASCADE,

  -- Analysis type
  analysis_type TEXT NOT NULL CHECK (analysis_type IN (
    'user_journey_analysis',
    'anomaly_detection',
    'performance_optimization',
    'security_review',
    'ux_improvement',
    'error_pattern_detection'
  )),

  -- AI insights
  insights JSONB NOT NULL,
  confidence_score NUMERIC CHECK (confidence_score BETWEEN 0 AND 1),

  -- Recommendations
  recommendations TEXT[],
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  -- Processing
  analyzed_by TEXT, -- 'claude-3.5-sonnet', 'gpt-4', etc.
  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_session ON ai_recording_analysis(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_type ON ai_recording_analysis(analysis_type);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_priority ON ai_recording_analysis(priority);

-- Enable RLS
ALTER TABLE session_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recording_analysis ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Admins can view all recordings
CREATE POLICY "Admins can view all session recordings"
  ON session_recordings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- System can create recordings
CREATE POLICY "System can create session recordings"
  ON session_recordings FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- System can update recordings
CREATE POLICY "System can update session recordings"
  ON session_recordings FOR UPDATE
  TO authenticated
  USING (TRUE);

-- Admins can view system recordings
CREATE POLICY "Admins can view system recordings"
  ON system_recordings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- System can create system recordings
CREATE POLICY "System can create system recordings"
  ON system_recordings FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- Admins can view AI analysis
CREATE POLICY "Admins can view ai analysis"
  ON ai_recording_analysis FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- System can create AI analysis
CREATE POLICY "System can create ai analysis"
  ON ai_recording_analysis FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- Function to analyze session with AI
CREATE OR REPLACE FUNCTION analyze_session_with_ai(
  p_session_id TEXT,
  p_analysis_type TEXT DEFAULT 'user_journey_analysis'
)
RETURNS JSONB AS $$
DECLARE
  v_recording RECORD;
  v_snapshots JSONB;
  v_analysis JSONB;
BEGIN
  -- Get session recording
  SELECT * INTO v_recording
  FROM session_recordings
  WHERE session_id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Session not found');
  END IF;

  -- Get all snapshots
  SELECT jsonb_agg(snapshots) INTO v_snapshots
  FROM system_recordings
  WHERE session_id = p_session_id
  ORDER BY recorded_at;

  -- Prepare analysis result (in production, call Claude API here)
  v_analysis := jsonb_build_object(
    'session_id', p_session_id,
    'analysis_type', p_analysis_type,
    'total_snapshots', (SELECT COUNT(*) FROM system_recordings WHERE session_id = p_session_id),
    'user_goal', v_recording.ai_summary->>'user_goal',
    'success', v_recording.ai_summary->>'success',
    'pain_points', v_recording.ai_summary->'pain_points',
    'optimizations', v_recording.ai_summary->'optimizations',
    'security_concerns', v_recording.ai_summary->'security_concerns',
    'timestamp', NOW()
  );

  -- Store analysis result
  INSERT INTO ai_recording_analysis (
    session_id,
    analysis_type,
    insights,
    confidence_score,
    recommendations,
    priority,
    analyzed_by
  ) VALUES (
    p_session_id,
    p_analysis_type,
    v_analysis,
    0.85,
    ARRAY['Review session for optimization opportunities'],
    'medium',
    'internal-analyzer'
  );

  RETURN v_analysis;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get session insights
CREATE OR REPLACE FUNCTION get_session_insights(
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  total_sessions BIGINT,
  total_errors BIGINT,
  avg_session_duration NUMERIC,
  most_common_goal TEXT,
  top_pain_points TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT sr.session_id)::BIGINT as total_sessions,
    SUM(
      CASE
        WHEN sr.ai_summary->>'success' = 'false' THEN 1
        ELSE 0
      END
    )::BIGINT as total_errors,
    AVG(
      EXTRACT(EPOCH FROM (sr.end_time - sr.start_time))
    )::NUMERIC as avg_session_duration,
    MODE() WITHIN GROUP (ORDER BY sr.ai_summary->>'user_goal') as most_common_goal,
    ARRAY_AGG(DISTINCT pp) FILTER (WHERE pp IS NOT NULL) as top_pain_points
  FROM session_recordings sr
  CROSS JOIN LATERAL jsonb_array_elements_text(sr.ai_summary->'pain_points') pp
  WHERE sr.start_time > NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get real-time recording status
CREATE OR REPLACE FUNCTION get_active_recordings()
RETURNS TABLE (
  session_id TEXT,
  user_id UUID,
  start_time TIMESTAMP WITH TIME ZONE,
  duration_seconds NUMERIC,
  snapshot_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sr.session_id,
    sr.user_id,
    sr.start_time,
    EXTRACT(EPOCH FROM (NOW() - sr.start_time))::NUMERIC as duration_seconds,
    sr.snapshot_count
  FROM session_recordings sr
  WHERE sr.end_time IS NULL
  ORDER BY sr.start_time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for recording dashboard
CREATE OR REPLACE VIEW recording_dashboard AS
SELECT
  DATE(sr.start_time) as recording_date,
  COUNT(DISTINCT sr.session_id) as session_count,
  AVG(sr.snapshot_count) as avg_snapshots_per_session,
  SUM(
    CASE
      WHEN sr.ai_summary->>'success' = 'true' THEN 1
      ELSE 0
    END
  ) as successful_sessions,
  SUM(
    CASE
      WHEN sr.ai_summary->>'success' = 'false' THEN 1
      ELSE 0
    END
  ) as failed_sessions,
  AVG(
    EXTRACT(EPOCH FROM (sr.end_time - sr.start_time))
  ) as avg_duration_seconds
FROM session_recordings sr
WHERE sr.start_time > NOW() - INTERVAL '30 days'
GROUP BY DATE(sr.start_time)
ORDER BY recording_date DESC;

GRANT SELECT ON recording_dashboard TO authenticated;

COMMENT ON TABLE session_recordings IS 'AI-powered session recordings for system behavior analysis';
COMMENT ON TABLE system_recordings IS 'Detailed snapshots of system state and user interactions';
COMMENT ON TABLE ai_recording_analysis IS 'AI analysis results for recorded sessions';
COMMENT ON FUNCTION analyze_session_with_ai IS 'Analyze a recorded session using AI';
COMMENT ON FUNCTION get_session_insights IS 'Get insights from recorded sessions over time period';
