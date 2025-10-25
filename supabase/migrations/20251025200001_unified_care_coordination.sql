-- ============================================================================
-- UNIFIED CARE COORDINATION LAYER
-- ============================================================================
-- Purpose: Provide holistic view of patient care across all systems
--          Link NeuroSuite, PT, Mental Health care plans
--          Enable interdisciplinary care team collaboration
-- Author: Healthcare Integration System
-- Date: 2025-10-25
-- ============================================================================

-- ============================================================================
-- 1. UNIFIED PATIENT CARE SUMMARY VIEW
-- ============================================================================
-- One-stop view of all active care for a patient

CREATE OR REPLACE VIEW v_unified_patient_care_summary AS
SELECT
  p.user_id as patient_id,
  p.first_name,
  p.last_name,
  p.mrn,
  p.room_number,

  -- NeuroSuite Care
  (SELECT COUNT(*) FROM neuro_stroke_assessments WHERE patient_id = p.user_id) as stroke_assessments_count,
  (SELECT nihss_total_score FROM neuro_stroke_assessments
   WHERE patient_id = p.user_id
   ORDER BY assessment_date DESC LIMIT 1) as latest_nihss_score,
  (SELECT COUNT(*) FROM neuro_cognitive_assessments WHERE patient_id = p.user_id) as cognitive_assessments_count,
  (SELECT moca_total_score FROM neuro_cognitive_assessments
   WHERE patient_id = p.user_id AND assessment_tool = 'MoCA'
   ORDER BY assessment_date DESC LIMIT 1) as latest_moca_score,
  (SELECT COUNT(*) FROM neuro_care_plans WHERE patient_id = p.user_id AND status = 'active') as active_neuro_care_plans,

  -- PT Care
  (SELECT COUNT(*) FROM pt_treatment_plans WHERE patient_id = p.user_id AND status = 'active') as active_pt_plans,
  (SELECT visits_used || '/' || total_visits_authorized FROM pt_treatment_plans
   WHERE patient_id = p.user_id AND status = 'active'
   ORDER BY start_date DESC LIMIT 1) as pt_visit_utilization,
  (SELECT COUNT(*) FROM pt_treatment_sessions WHERE patient_id = p.user_id) as total_pt_sessions,
  (SELECT session_date FROM pt_treatment_sessions
   WHERE patient_id = p.user_id
   ORDER BY session_date DESC LIMIT 1) as last_pt_session_date,

  -- Mental Health Care
  (SELECT COUNT(*) FROM mental_health_service_requests WHERE patient_id = p.user_id AND status = 'active') as active_mh_requests,
  (SELECT risk_level FROM mental_health_risk_assessments
   WHERE patient_id = p.user_id
   ORDER BY effective_datetime DESC LIMIT 1) as latest_suicide_risk_level,
  (SELECT COUNT(*) FROM mental_health_therapy_sessions WHERE patient_id = p.user_id) as total_mh_sessions,
  (SELECT COUNT(*) FROM mental_health_safety_plans WHERE patient_id = p.user_id AND status = 'current') as active_safety_plans,

  -- Cross-System Referrals
  (SELECT COUNT(*) FROM cross_system_referrals WHERE patient_id = p.user_id AND status = 'pending') as pending_referrals,
  (SELECT COUNT(*) FROM cross_system_referrals WHERE patient_id = p.user_id AND discharge_dependent = true AND status != 'completed') as discharge_blocking_referrals,

  -- Discharge Readiness
  CASE
    WHEN EXISTS (
      SELECT 1 FROM mental_health_discharge_checklist
      WHERE patient_id = p.user_id AND all_requirements_met = false
    ) THEN false
    WHEN EXISTS (
      SELECT 1 FROM cross_system_referrals
      WHERE patient_id = p.user_id AND discharge_dependent = true AND status != 'completed'
    ) THEN false
    ELSE true
  END as discharge_ready,

  -- Last Updated
  GREATEST(
    COALESCE((SELECT MAX(assessment_date) FROM neuro_stroke_assessments WHERE patient_id = p.user_id), '1970-01-01'::timestamptz),
    COALESCE((SELECT MAX(session_date) FROM pt_treatment_sessions WHERE patient_id = p.user_id), '1970-01-01'::timestamptz),
    COALESCE((SELECT MAX(effective_datetime) FROM mental_health_risk_assessments WHERE patient_id = p.user_id), '1970-01-01'::timestamptz)
  ) as last_clinical_activity

FROM profiles p
WHERE EXISTS (
  SELECT 1 FROM neuro_stroke_assessments WHERE patient_id = p.user_id
  UNION
  SELECT 1 FROM pt_treatment_plans WHERE patient_id = p.user_id
  UNION
  SELECT 1 FROM mental_health_service_requests WHERE patient_id = p.user_id
);

GRANT SELECT ON v_unified_patient_care_summary TO authenticated;

COMMENT ON VIEW v_unified_patient_care_summary IS 'Unified view of patient care across NeuroSuite, PT, and Mental Health systems';

-- ============================================================================
-- 2. INTERDISCIPLINARY CARE TEAM TABLE
-- ============================================================================
-- Links all providers caring for a patient across disciplines

CREATE TABLE IF NOT EXISTS interdisciplinary_care_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Patient
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,

  -- Team Lead
  team_lead_id UUID REFERENCES profiles(user_id),
  team_lead_discipline TEXT,

  -- Team Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',
    'inactive',
    'discharged'
  )),

  -- Team Formation
  team_formed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  team_dissolved_date DATE,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_care_teams_patient ON interdisciplinary_care_teams(patient_id);
CREATE INDEX idx_care_teams_status ON interdisciplinary_care_teams(status);

-- ============================================================================
-- 3. CARE TEAM MEMBERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS care_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Team
  care_team_id UUID NOT NULL REFERENCES interdisciplinary_care_teams(id) ON DELETE CASCADE,

  -- Provider
  provider_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  discipline TEXT NOT NULL CHECK (discipline IN (
    'neurology',
    'physical_therapy',
    'occupational_therapy',
    'speech_therapy',
    'mental_health',
    'social_work',
    'case_management',
    'nursing',
    'pharmacy',
    'primary_care'
  )),
  role_on_team TEXT, -- 'primary', 'consulting', 'supportive'

  -- Active Period
  joined_date DATE NOT NULL DEFAULT CURRENT_DATE,
  left_date DATE,
  is_active BOOLEAN DEFAULT true,

  -- Responsibilities
  primary_responsibility TEXT[],
  care_plan_access BOOLEAN DEFAULT true,

  -- Communication Preferences
  notify_on_updates BOOLEAN DEFAULT true,
  notification_method TEXT CHECK (notification_method IN ('email', 'sms', 'in_app', 'all')),

  -- Metadata
  added_by UUID REFERENCES auth.users(id),

  CONSTRAINT unique_provider_per_team UNIQUE(care_team_id, provider_id)
);

CREATE INDEX idx_care_team_members_team ON care_team_members(care_team_id);
CREATE INDEX idx_care_team_members_provider ON care_team_members(provider_id);
CREATE INDEX idx_care_team_members_active ON care_team_members(is_active) WHERE is_active = true;

-- ============================================================================
-- 4. UNIFIED CARE PLAN LINKS TABLE
-- ============================================================================
-- Links all care plans for a patient

CREATE TABLE IF NOT EXISTS unified_care_plan_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Patient
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  care_team_id UUID REFERENCES interdisciplinary_care_teams(id) ON DELETE SET NULL,

  -- Care Plan References
  neuro_care_plan_id UUID REFERENCES neuro_care_plans(id) ON DELETE SET NULL,
  pt_treatment_plan_id UUID REFERENCES pt_treatment_plans(id) ON DELETE SET NULL,
  fhir_care_plan_id UUID REFERENCES fhir_care_plans(id) ON DELETE SET NULL,
  mental_health_service_request_id UUID REFERENCES mental_health_service_requests(id) ON DELETE SET NULL,

  -- Unified Goals
  unified_goals JSONB,
  -- Example: {
  --   "functional": "Independent ambulation with walker",
  --   "psychological": "Adjustment to stroke with coping strategies",
  --   "neurological": "Prevention of recurrent stroke"
  -- }

  -- Discharge Planning
  target_discharge_date DATE,
  discharge_destination TEXT,
  discharge_blockers TEXT[],

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),

  -- Metadata
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_unified_care_plan_patient ON unified_care_plan_links(patient_id);
CREATE INDEX idx_unified_care_plan_status ON unified_care_plan_links(status);

-- ============================================================================
-- 5. CARE COORDINATION NOTES TABLE
-- ============================================================================
-- Team communication and coordination notes

CREATE TABLE IF NOT EXISTS care_coordination_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Patient & Team
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  care_team_id UUID REFERENCES interdisciplinary_care_teams(id) ON DELETE SET NULL,

  -- Author
  author_id UUID NOT NULL REFERENCES profiles(user_id),
  author_discipline TEXT NOT NULL,

  -- Note Type
  note_type TEXT NOT NULL CHECK (note_type IN (
    'team_update',
    'goal_progress',
    'barrier_identified',
    'discharge_planning',
    'family_meeting',
    'interdisciplinary_conference',
    'urgent_communication'
  )),

  -- Content
  subject TEXT NOT NULL,
  note_body TEXT NOT NULL,
  priority TEXT DEFAULT 'routine' CHECK (priority IN ('routine', 'important', 'urgent')),

  -- Tags & Categories
  tags TEXT[],
  systems_involved TEXT[], -- Which systems this note relates to

  -- Visibility
  visible_to_patient BOOLEAN DEFAULT false,
  visible_to_family BOOLEAN DEFAULT false,

  -- Follow-up
  requires_response BOOLEAN DEFAULT false,
  response_deadline DATE,
  responses JSONB, -- Array of responses from team members

  -- Metadata
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_care_notes_patient ON care_coordination_notes(patient_id);
CREATE INDEX idx_care_notes_team ON care_coordination_notes(care_team_id);
CREATE INDEX idx_care_notes_author ON care_coordination_notes(author_id);
CREATE INDEX idx_care_notes_type ON care_coordination_notes(note_type);
CREATE INDEX idx_care_notes_priority ON care_coordination_notes(priority) WHERE requires_response = true;

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function: Auto-create care team when first care plan is created
CREATE OR REPLACE FUNCTION auto_create_care_team_for_patient(
  p_patient_id UUID,
  p_initial_provider_id UUID,
  p_discipline TEXT
) RETURNS UUID AS $$
DECLARE
  v_team_id UUID;
BEGIN
  -- Check if team already exists
  SELECT id INTO v_team_id
  FROM interdisciplinary_care_teams
  WHERE patient_id = p_patient_id
    AND status = 'active';

  -- If no team exists, create one
  IF v_team_id IS NULL THEN
    INSERT INTO interdisciplinary_care_teams (
      patient_id,
      team_lead_id,
      team_lead_discipline,
      status,
      created_by
    ) VALUES (
      p_patient_id,
      p_initial_provider_id,
      p_discipline,
      'active',
      p_initial_provider_id
    ) RETURNING id INTO v_team_id;

    -- Add initial provider as team member
    INSERT INTO care_team_members (
      care_team_id,
      provider_id,
      discipline,
      role_on_team,
      added_by
    ) VALUES (
      v_team_id,
      p_initial_provider_id,
      p_discipline,
      'primary',
      p_initial_provider_id
    );
  END IF;

  RETURN v_team_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Get care team for patient
CREATE OR REPLACE FUNCTION get_patient_care_team(p_patient_id UUID)
RETURNS TABLE (
  member_id UUID,
  provider_id UUID,
  provider_name TEXT,
  discipline TEXT,
  role_on_team TEXT,
  joined_date DATE,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ctm.id,
    ctm.provider_id,
    p.first_name || ' ' || p.last_name,
    ctm.discipline,
    ctm.role_on_team,
    ctm.joined_date,
    ctm.is_active
  FROM interdisciplinary_care_teams ict
  JOIN care_team_members ctm ON ict.id = ctm.care_team_id
  JOIN profiles p ON ctm.provider_id = p.user_id
  WHERE ict.patient_id = p_patient_id
    AND ict.status = 'active'
  ORDER BY
    CASE ctm.role_on_team
      WHEN 'primary' THEN 1
      WHEN 'consulting' THEN 2
      ELSE 3
    END,
    ctm.joined_date;
END;
$$ LANGUAGE plpgsql;

-- Function: Add provider to care team
CREATE OR REPLACE FUNCTION add_provider_to_care_team(
  p_patient_id UUID,
  p_provider_id UUID,
  p_discipline TEXT,
  p_added_by UUID
) RETURNS UUID AS $$
DECLARE
  v_team_id UUID;
  v_member_id UUID;
BEGIN
  -- Get active team for patient
  SELECT id INTO v_team_id
  FROM interdisciplinary_care_teams
  WHERE patient_id = p_patient_id
    AND status = 'active'
  LIMIT 1;

  -- If no team, create one
  IF v_team_id IS NULL THEN
    v_team_id := auto_create_care_team_for_patient(p_patient_id, p_provider_id, p_discipline);
  ELSE
    -- Add provider to existing team (if not already member)
    INSERT INTO care_team_members (
      care_team_id,
      provider_id,
      discipline,
      role_on_team,
      added_by
    ) VALUES (
      v_team_id,
      p_provider_id,
      p_discipline,
      'consulting',
      p_added_by
    )
    ON CONFLICT (care_team_id, provider_id) DO UPDATE
    SET
      is_active = true,
      left_date = NULL
    RETURNING id INTO v_member_id;
  END IF;

  RETURN COALESCE(v_member_id, v_team_id);
END;
$$ LANGUAGE plpgsql;

-- Function: Get unified discharge readiness status
CREATE OR REPLACE FUNCTION get_discharge_readiness(p_patient_id UUID)
RETURNS TABLE (
  ready_for_discharge BOOLEAN,
  blocking_factors TEXT[],
  neuro_status TEXT,
  pt_status TEXT,
  mh_status TEXT,
  pending_referrals INTEGER
) AS $$
DECLARE
  v_ready BOOLEAN := true;
  v_blockers TEXT[] := ARRAY[]::TEXT[];
  v_neuro TEXT := 'N/A';
  v_pt TEXT := 'N/A';
  v_mh TEXT := 'N/A';
  v_referrals INTEGER := 0;
BEGIN
  -- Check Mental Health discharge requirements
  IF EXISTS (
    SELECT 1 FROM mental_health_discharge_checklist
    WHERE patient_id = p_patient_id
      AND all_requirements_met = false
      AND (override_granted IS NULL OR override_granted = false)
  ) THEN
    v_ready := false;
    v_blockers := array_append(v_blockers, 'Mental Health discharge requirements not met');
    v_mh := 'BLOCKED';
  ELSE
    v_mh := 'CLEARED';
  END IF;

  -- Check for pending discharge-dependent referrals
  SELECT COUNT(*) INTO v_referrals
  FROM cross_system_referrals
  WHERE patient_id = p_patient_id
    AND discharge_dependent = true
    AND status NOT IN ('completed', 'cancelled');

  IF v_referrals > 0 THEN
    v_ready := false;
    v_blockers := array_append(v_blockers, v_referrals || ' discharge-dependent referrals pending');
  END IF;

  -- Check PT visit utilization
  IF EXISTS (
    SELECT 1 FROM pt_treatment_plans
    WHERE patient_id = p_patient_id
      AND status = 'active'
      AND visits_used < 3 -- Minimum 3 PT visits
  ) THEN
    v_ready := false;
    v_blockers := array_append(v_blockers, 'PT minimum visit requirement not met');
    v_pt := 'IN PROGRESS';
  ELSIF EXISTS (
    SELECT 1 FROM pt_treatment_plans
    WHERE patient_id = p_patient_id
      AND status = 'active'
  ) THEN
    v_pt := 'ACTIVE';
  ELSE
    v_pt := 'COMPLETED';
  END IF;

  -- Check Neuro care plans
  IF EXISTS (
    SELECT 1 FROM neuro_care_plans
    WHERE patient_id = p_patient_id
      AND status = 'active'
  ) THEN
    v_neuro := 'ACTIVE';
  ELSE
    v_neuro := 'COMPLETED';
  END IF;

  RETURN QUERY SELECT v_ready, v_blockers, v_neuro, v_pt, v_mh, v_referrals;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. TRIGGERS
-- ============================================================================

CREATE TRIGGER update_care_teams_updated_at
  BEFORE UPDATE ON interdisciplinary_care_teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_care_team_members_updated_at
  BEFORE UPDATE ON care_team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_care_notes_updated_at
  BEFORE UPDATE ON care_coordination_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE interdisciplinary_care_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE unified_care_plan_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_coordination_notes ENABLE ROW LEVEL SECURITY;

-- Care teams: Healthcare providers can view
CREATE POLICY "Healthcare providers can view care teams"
  ON interdisciplinary_care_teams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 3, 5, 6, 7, 9, 10, 99, 100, 101, 102, 103, 104, 105)
    )
  );

CREATE POLICY "Healthcare providers can manage care teams"
  ON interdisciplinary_care_teams FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 3, 5, 6, 7, 9, 10, 99, 100, 101, 102, 103, 104, 105)
    )
  );

-- Similar policies for other tables
CREATE POLICY "Healthcare providers can view team members"
  ON care_team_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 3, 5, 6, 7, 9, 10, 99, 100, 101, 102, 103, 104, 105)
    )
  );

CREATE POLICY "Healthcare providers can manage team members"
  ON care_team_members FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 3, 5, 6, 7, 9, 10, 99, 100, 101, 102, 103, 104, 105)
    )
  );

CREATE POLICY "Healthcare providers can view care plan links"
  ON unified_care_plan_links FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 3, 5, 6, 7, 9, 10, 99, 100, 101, 102, 103, 104, 105)
    )
  );

CREATE POLICY "Healthcare providers can manage care plan links"
  ON unified_care_plan_links FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 3, 5, 6, 7, 9, 10, 99, 100, 101, 102, 103, 104, 105)
    )
  );

CREATE POLICY "Team members can view coordination notes"
  ON care_coordination_notes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 3, 5, 6, 7, 9, 10, 99, 100, 101, 102, 103, 104, 105)
    )
  );

CREATE POLICY "Team members can create coordination notes"
  ON care_coordination_notes FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 3, 5, 6, 7, 9, 10, 99, 100, 101, 102, 103, 104, 105)
    )
  );

CREATE POLICY "Authors can update their notes"
  ON care_coordination_notes FOR UPDATE TO authenticated
  USING (author_id = auth.uid());

-- ============================================================================
-- 9. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON interdisciplinary_care_teams TO authenticated;
GRANT SELECT, INSERT, UPDATE ON care_team_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON unified_care_plan_links TO authenticated;
GRANT SELECT, INSERT, UPDATE ON care_coordination_notes TO authenticated;

-- ============================================================================
-- 10. COMMENTS
-- ============================================================================

COMMENT ON TABLE interdisciplinary_care_teams IS 'Tracks care teams for patients across all disciplines';
COMMENT ON TABLE care_team_members IS 'Individual providers on interdisciplinary care teams';
COMMENT ON TABLE unified_care_plan_links IS 'Links all care plans for a patient across systems';
COMMENT ON TABLE care_coordination_notes IS 'Team communication and coordination notes';
COMMENT ON VIEW v_unified_patient_care_summary IS 'Complete care summary across all systems for a patient';
COMMENT ON FUNCTION get_discharge_readiness IS 'Evaluates discharge readiness across all systems';
