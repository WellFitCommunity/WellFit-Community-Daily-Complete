-- Disaster Recovery Drill Tracking System
-- Implements comprehensive drill execution, tracking, and compliance reporting
-- Originally from _SKIP_20251023120000_disaster_recovery_drills.sql

-- ============================================================================
-- 1. DRILL EXECUTION TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS disaster_recovery_drills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Drill metadata
  drill_name TEXT NOT NULL,
  drill_type TEXT NOT NULL CHECK (drill_type IN (
    'weekly_automated',
    'monthly_simulation',
    'quarterly_tabletop',
    'annual_full_scale',
    'ad_hoc'
  )),
  drill_scenario TEXT NOT NULL CHECK (drill_scenario IN (
    'database_loss',
    'security_breach',
    'infrastructure_failure',
    'ransomware_attack',
    'natural_disaster',
    'insider_threat',
    'multi_region_outage',
    'supply_chain_attack'
  )),

  -- Scheduling
  scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_start TIMESTAMP WITH TIME ZONE,
  actual_end TIMESTAMP WITH TIME ZONE,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled',
    'in_progress',
    'completed',
    'failed',
    'cancelled'
  )),

  -- Performance metrics
  rto_target_minutes INTEGER DEFAULT 240, -- 4 hours
  rto_actual_minutes INTEGER,
  rto_met BOOLEAN,

  rpo_target_minutes INTEGER DEFAULT 15,
  rpo_actual_minutes INTEGER,
  rpo_met BOOLEAN,

  -- Data integrity
  data_loss_detected BOOLEAN DEFAULT FALSE,
  data_loss_amount TEXT,
  data_integrity_score NUMERIC(5,2), -- 0-100%

  -- Team performance
  team_assembly_time_minutes INTEGER,
  team_assembly_target_minutes INTEGER DEFAULT 30,
  team_response_score NUMERIC(5,2), -- 0-100%

  -- Communication
  communication_effectiveness_score NUMERIC(5,2), -- 0-100%
  stakeholder_updates_sent INTEGER DEFAULT 0,

  -- Success criteria
  all_services_restored BOOLEAN DEFAULT FALSE,
  security_scan_passed BOOLEAN,
  performance_benchmarks_met BOOLEAN,

  -- Overall results
  drill_passed BOOLEAN,
  overall_score NUMERIC(5,2), -- 0-100%

  -- Documentation
  incident_commander UUID REFERENCES auth.users(id),
  participants UUID[] DEFAULT '{}',
  lessons_learned TEXT,
  improvement_recommendations TEXT,
  drill_report_url TEXT,

  -- Compliance
  compliance_requirements_met BOOLEAN DEFAULT FALSE,
  soc2_compliant BOOLEAN DEFAULT FALSE,
  hipaa_compliant BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_drills_type ON disaster_recovery_drills(drill_type);
CREATE INDEX IF NOT EXISTS idx_drills_status ON disaster_recovery_drills(status);
CREATE INDEX IF NOT EXISTS idx_drills_scheduled_start ON disaster_recovery_drills(scheduled_start DESC);
CREATE INDEX IF NOT EXISTS idx_drills_scenario ON disaster_recovery_drills(drill_scenario);

-- ============================================================================
-- 2. DRILL CHECKPOINTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS drill_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id UUID NOT NULL REFERENCES disaster_recovery_drills(id) ON DELETE CASCADE,

  -- Checkpoint details
  checkpoint_name TEXT NOT NULL,
  checkpoint_order INTEGER NOT NULL,
  description TEXT,

  -- Timing
  target_duration_minutes INTEGER,
  actual_start TIMESTAMP WITH TIME ZONE,
  actual_end TIMESTAMP WITH TIME ZONE,
  actual_duration_minutes INTEGER,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'in_progress',
    'completed',
    'failed',
    'skipped'
  )),

  -- Results
  success BOOLEAN,
  notes TEXT,
  blockers TEXT,

  -- Verification
  verified_by UUID REFERENCES auth.users(id),
  verification_method TEXT,
  evidence_url TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_drill_id ON drill_checkpoints(drill_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_order ON drill_checkpoints(drill_id, checkpoint_order);

-- ============================================================================
-- 3. DRILL PARTICIPANTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS drill_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id UUID NOT NULL REFERENCES disaster_recovery_drills(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Role in drill
  role TEXT NOT NULL CHECK (role IN (
    'incident_commander',
    'database_lead',
    'security_lead',
    'communications_lead',
    'technical_team',
    'observer',
    'facilitator'
  )),

  -- Participation
  notified_at TIMESTAMP WITH TIME ZONE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  joined_at TIMESTAMP WITH TIME ZONE,
  response_time_minutes INTEGER,

  -- Performance
  individual_score NUMERIC(5,2), -- 0-100%
  feedback TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(drill_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_drill ON drill_participants(drill_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON drill_participants(user_id);

-- ============================================================================
-- 4. DRILL METRICS LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS drill_metrics_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id UUID NOT NULL REFERENCES disaster_recovery_drills(id) ON DELETE CASCADE,

  -- Metric details
  metric_name TEXT NOT NULL,
  metric_category TEXT NOT NULL CHECK (metric_category IN (
    'timing',
    'data_integrity',
    'performance',
    'security',
    'compliance',
    'communication',
    'team'
  )),

  -- Values
  target_value NUMERIC,
  actual_value NUMERIC,
  unit TEXT, -- 'minutes', 'percentage', 'count', etc.
  passed BOOLEAN,

  -- Context
  measured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  measured_by UUID REFERENCES auth.users(id),
  notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_drill ON drill_metrics_log(drill_id);
CREATE INDEX IF NOT EXISTS idx_metrics_category ON drill_metrics_log(metric_category);

-- ============================================================================
-- 5. FUNCTIONS
-- ============================================================================

-- Function to create a new drill
CREATE OR REPLACE FUNCTION schedule_disaster_recovery_drill(
  p_drill_name TEXT,
  p_drill_type TEXT,
  p_drill_scenario TEXT,
  p_scheduled_start TIMESTAMP WITH TIME ZONE,
  p_incident_commander UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_drill_id UUID;
BEGIN
  -- Create drill
  INSERT INTO disaster_recovery_drills (
    drill_name,
    drill_type,
    drill_scenario,
    scheduled_start,
    incident_commander,
    created_by,
    status
  ) VALUES (
    p_drill_name,
    p_drill_type,
    p_drill_scenario,
    p_scheduled_start,
    COALESCE(p_incident_commander, auth.uid()),
    auth.uid(),
    'scheduled'
  )
  RETURNING id INTO v_drill_id;

  -- Log security event
  INSERT INTO security_events (
    event_type,
    severity,
    description,
    metadata,
    actor_user_id
  ) VALUES (
    'drill_scheduled',
    'LOW',
    format('Disaster recovery drill scheduled: %s', p_drill_name),
    jsonb_build_object(
      'drill_id', v_drill_id,
      'drill_type', p_drill_type,
      'drill_scenario', p_drill_scenario,
      'scheduled_start', p_scheduled_start
    ),
    auth.uid()
  );

  RETURN v_drill_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to start a drill
CREATE OR REPLACE FUNCTION start_disaster_recovery_drill(
  p_drill_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Update drill status
  UPDATE disaster_recovery_drills
  SET
    status = 'in_progress',
    actual_start = NOW(),
    updated_at = NOW()
  WHERE id = p_drill_id
    AND status = 'scheduled';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Drill not found or already started';
  END IF;

  -- Log event
  INSERT INTO security_events (
    event_type,
    severity,
    description,
    metadata,
    actor_user_id
  ) VALUES (
    'drill_started',
    'LOW',
    'Disaster recovery drill started',
    jsonb_build_object('drill_id', p_drill_id, 'started_at', NOW()),
    auth.uid()
  );

  v_result := jsonb_build_object(
    'drill_id', p_drill_id,
    'status', 'in_progress',
    'started_at', NOW(),
    'message', 'Drill started successfully'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete a drill
CREATE OR REPLACE FUNCTION complete_disaster_recovery_drill(
  p_drill_id UUID,
  p_drill_passed BOOLEAN,
  p_lessons_learned TEXT DEFAULT NULL,
  p_recommendations TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_drill RECORD;
  v_duration_minutes INTEGER;
  v_overall_score NUMERIC;
  v_result JSONB;
BEGIN
  -- Get drill details
  SELECT * INTO v_drill
  FROM disaster_recovery_drills
  WHERE id = p_drill_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Drill not found';
  END IF;

  -- Calculate duration
  v_duration_minutes := EXTRACT(EPOCH FROM (NOW() - v_drill.actual_start)) / 60;

  -- Calculate overall score (weighted average)
  v_overall_score := (
    COALESCE(v_drill.data_integrity_score, 0) * 0.3 +
    COALESCE(v_drill.team_response_score, 0) * 0.2 +
    COALESCE(v_drill.communication_effectiveness_score, 0) * 0.2 +
    CASE WHEN v_drill.rto_met THEN 100 ELSE 50 END * 0.15 +
    CASE WHEN v_drill.rpo_met THEN 100 ELSE 50 END * 0.15
  );

  -- Update drill
  UPDATE disaster_recovery_drills
  SET
    status = 'completed',
    actual_end = NOW(),
    drill_passed = p_drill_passed,
    overall_score = v_overall_score,
    lessons_learned = p_lessons_learned,
    improvement_recommendations = p_recommendations,
    compliance_requirements_met = (
      v_drill.rto_met AND
      v_drill.rpo_met AND
      v_drill.all_services_restored AND
      v_drill.data_integrity_score >= 95
    ),
    soc2_compliant = (v_overall_score >= 90),
    hipaa_compliant = (v_drill.data_integrity_score >= 99),
    updated_at = NOW()
  WHERE id = p_drill_id;

  -- Log completion
  INSERT INTO security_events (
    event_type,
    severity,
    description,
    metadata,
    actor_user_id
  ) VALUES (
    'drill_completed',
    'LOW',
    format('Disaster recovery drill completed: %s', CASE WHEN p_drill_passed THEN 'PASSED' ELSE 'FAILED' END),
    jsonb_build_object(
      'drill_id', p_drill_id,
      'passed', p_drill_passed,
      'overall_score', v_overall_score,
      'duration_minutes', v_duration_minutes
    ),
    auth.uid()
  );

  v_result := jsonb_build_object(
    'drill_id', p_drill_id,
    'status', 'completed',
    'passed', p_drill_passed,
    'overall_score', v_overall_score,
    'duration_minutes', v_duration_minutes,
    'message', CASE WHEN p_drill_passed THEN 'Drill completed successfully' ELSE 'Drill completed with issues' END
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get drill compliance status
CREATE OR REPLACE FUNCTION get_drill_compliance_status()
RETURNS JSONB AS $$
DECLARE
  v_last_weekly TIMESTAMP WITH TIME ZONE;
  v_last_monthly TIMESTAMP WITH TIME ZONE;
  v_last_quarterly TIMESTAMP WITH TIME ZONE;
  v_drills_30d INTEGER;
  v_drills_passed_30d INTEGER;
  v_pass_rate NUMERIC;
  v_avg_score NUMERIC;
  v_compliance_status TEXT;
  v_issues TEXT[];
  v_result JSONB;
BEGIN
  -- Get last drill dates
  SELECT MAX(actual_start) INTO v_last_weekly
  FROM disaster_recovery_drills
  WHERE drill_type = 'weekly_automated'
    AND status = 'completed';

  SELECT MAX(actual_start) INTO v_last_monthly
  FROM disaster_recovery_drills
  WHERE drill_type = 'monthly_simulation'
    AND status = 'completed';

  SELECT MAX(actual_start) INTO v_last_quarterly
  FROM disaster_recovery_drills
  WHERE drill_type = 'quarterly_tabletop'
    AND status = 'completed';

  -- Get 30-day statistics
  SELECT
    COUNT(*),
    COUNT(CASE WHEN drill_passed THEN 1 END),
    AVG(overall_score)
  INTO v_drills_30d, v_drills_passed_30d, v_avg_score
  FROM disaster_recovery_drills
  WHERE actual_start > NOW() - INTERVAL '30 days'
    AND status = 'completed';

  -- Calculate pass rate
  IF v_drills_30d > 0 THEN
    v_pass_rate := ROUND(100.0 * v_drills_passed_30d / v_drills_30d, 2);
  ELSE
    v_pass_rate := 0;
  END IF;

  -- Check compliance issues
  v_issues := ARRAY[]::TEXT[];

  IF v_last_weekly IS NULL OR v_last_weekly < NOW() - INTERVAL '7 days' THEN
    v_issues := array_append(v_issues, 'No weekly drill in last 7 days');
  END IF;

  IF v_last_monthly IS NULL OR v_last_monthly < NOW() - INTERVAL '35 days' THEN
    v_issues := array_append(v_issues, 'No monthly drill in last 35 days');
  END IF;

  IF v_last_quarterly IS NULL OR v_last_quarterly < NOW() - INTERVAL '95 days' THEN
    v_issues := array_append(v_issues, 'No quarterly drill in last 95 days');
  END IF;

  IF v_pass_rate < 90 THEN
    v_issues := array_append(v_issues, format('Drill pass rate (%s%%) below target (90%%)', v_pass_rate));
  END IF;

  IF v_avg_score < 85 THEN
    v_issues := array_append(v_issues, format('Average drill score (%s) below target (85)', v_avg_score));
  END IF;

  -- Determine status
  IF array_length(v_issues, 1) IS NULL THEN
    v_compliance_status := 'COMPLIANT';
  ELSIF array_length(v_issues, 1) <= 1 THEN
    v_compliance_status := 'WARNING';
  ELSE
    v_compliance_status := 'NON_COMPLIANT';
  END IF;

  -- Build result
  v_result := jsonb_build_object(
    'compliance_status', v_compliance_status,
    'last_weekly_drill', v_last_weekly,
    'last_monthly_drill', v_last_monthly,
    'last_quarterly_drill', v_last_quarterly,
    'drills_30d', v_drills_30d,
    'drills_passed_30d', v_drills_passed_30d,
    'pass_rate', v_pass_rate,
    'avg_score', ROUND(v_avg_score, 2),
    'issues', v_issues,
    'targets', jsonb_build_object(
      'weekly_frequency', 'Every 7 days',
      'monthly_frequency', 'Every 30 days',
      'quarterly_frequency', 'Every 90 days',
      'pass_rate_target', '90%',
      'avg_score_target', '85'
    )
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW drill_compliance_dashboard AS
SELECT
  DATE_TRUNC('month', scheduled_start) as month,
  drill_type,
  COUNT(*) as total_drills,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_drills,
  COUNT(CASE WHEN drill_passed THEN 1 END) as passed_drills,
  ROUND(AVG(overall_score), 2) as avg_score,
  ROUND(AVG(rto_actual_minutes), 2) as avg_rto_minutes,
  COUNT(CASE WHEN rto_met THEN 1 END) as rto_met_count,
  COUNT(CASE WHEN rpo_met THEN 1 END) as rpo_met_count,
  ROUND(100.0 * COUNT(CASE WHEN drill_passed THEN 1 END) / NULLIF(COUNT(CASE WHEN status = 'completed' THEN 1 END), 0), 2) as pass_rate
FROM disaster_recovery_drills
WHERE scheduled_start > NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', scheduled_start), drill_type
ORDER BY month DESC, drill_type;

-- ============================================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE disaster_recovery_drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE drill_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE drill_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE drill_metrics_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all drills
CREATE POLICY "Admins can view all drills"
  ON disaster_recovery_drills FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Admins can insert/update drills
CREATE POLICY "Admins can manage drills"
  ON disaster_recovery_drills FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Similar policies for related tables
CREATE POLICY "Admins can manage checkpoints"
  ON drill_checkpoints FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Participants can view their drills"
  ON drill_participants FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage participants"
  ON drill_participants FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage metrics"
  ON drill_metrics_log FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- 8. GRANTS
-- ============================================================================

GRANT SELECT ON drill_compliance_dashboard TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE disaster_recovery_drills IS 'Tracks disaster recovery drill execution and results for SOC2/HIPAA compliance';
COMMENT ON TABLE drill_checkpoints IS 'Detailed checkpoints for each drill with timing and success tracking';
COMMENT ON TABLE drill_participants IS 'Tracks team participation and performance in drills';
COMMENT ON TABLE drill_metrics_log IS 'Detailed metrics collected during drill execution';
COMMENT ON FUNCTION schedule_disaster_recovery_drill IS 'Schedules a new disaster recovery drill';
COMMENT ON FUNCTION start_disaster_recovery_drill IS 'Starts an in-progress drill';
COMMENT ON FUNCTION complete_disaster_recovery_drill IS 'Completes a drill and calculates scores';
COMMENT ON FUNCTION get_drill_compliance_status IS 'Returns compliance status for disaster recovery drills';
COMMENT ON VIEW drill_compliance_dashboard IS 'Monthly drill compliance metrics for reporting';
