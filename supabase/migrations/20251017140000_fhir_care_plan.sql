-- ============================================================================
-- FHIR R4 CarePlan Resource
-- Implements US Core CarePlan Profile
-- ============================================================================
-- A CarePlan describes the intention of how one or more practitioners plan
-- to deliver care for a particular patient, group or community for a period
-- of time. It includes goals, activities, and participant information.
--
-- US Core Requirements:
-- - status (required)
-- - intent (required)
-- - category (required) - e.g., assess-plan
-- - subject/patient (required)
-- - text narrative (must support)
-- ============================================================================

-- Drop existing table if needed (for clean reinstall)
-- DROP TABLE IF EXISTS fhir_care_plans CASCADE;

CREATE TABLE IF NOT EXISTS fhir_care_plans (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- External System Integration
  external_id TEXT,
  external_system TEXT,

  -- FHIR Meta
  version_id TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),

  -- Required Fields (US Core)
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN (
    'draft',
    'active',
    'on-hold',
    'revoked',
    'completed',
    'entered-in-error',
    'unknown'
  )),
  intent TEXT NOT NULL CHECK (intent IN (
    'proposal',
    'plan',
    'order',
    'option'
  )),
  category TEXT[] NOT NULL, -- e.g., ['assess-plan'], ['careteam']
  category_display TEXT[],

  -- Title and Description
  title TEXT,
  description TEXT,

  -- Subject (usually same as patient, but can be group)
  subject_reference TEXT,
  subject_display TEXT,

  -- Period (when plan is in effect)
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,

  -- Created Date
  created TIMESTAMPTZ DEFAULT NOW(),
  author_reference TEXT, -- Practitioner/Organization who created plan
  author_display TEXT,

  -- Care Team
  care_team_reference TEXT,
  care_team_display TEXT,

  -- Addresses (conditions this plan addresses)
  addresses_condition_references TEXT[], -- References to conditions
  addresses_condition_displays TEXT[],

  -- Supporting Info
  supporting_info_references TEXT[],
  supporting_info_displays TEXT[],

  -- Goals
  goal_references TEXT[], -- References to Goal resources
  goal_displays TEXT[],

  -- Activities (stored as JSONB for flexibility)
  -- Each activity can have: detail, outcomeReference, progress, reference
  activities JSONB DEFAULT '[]'::jsonb,

  -- Notes
  note TEXT,

  -- Audit Fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT fhir_care_plan_patient_fk FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_care_plans_patient ON fhir_care_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_status ON fhir_care_plans(status);
CREATE INDEX IF NOT EXISTS idx_care_plans_intent ON fhir_care_plans(intent);
CREATE INDEX IF NOT EXISTS idx_care_plans_category ON fhir_care_plans USING GIN(category);
CREATE INDEX IF NOT EXISTS idx_care_plans_period_start ON fhir_care_plans(period_start);
CREATE INDEX IF NOT EXISTS idx_care_plans_period_end ON fhir_care_plans(period_end);
CREATE INDEX IF NOT EXISTS idx_care_plans_created ON fhir_care_plans(created);
CREATE INDEX IF NOT EXISTS idx_care_plans_external ON fhir_care_plans(external_id, external_system);
CREATE INDEX IF NOT EXISTS idx_care_plans_activities ON fhir_care_plans USING GIN(activities);
CREATE INDEX IF NOT EXISTS idx_care_plans_updated_at ON fhir_care_plans(updated_at);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE fhir_care_plans ENABLE ROW LEVEL SECURITY;

-- Patients can view their own care plans
CREATE POLICY care_plans_patient_select ON fhir_care_plans
  FOR SELECT
  USING (
    patient_id = auth.uid()
  );

-- Staff (doctors, nurses, care managers) can view all care plans
CREATE POLICY care_plans_staff_select ON fhir_care_plans
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'doctor', 'nurse', 'care_manager', 'staff')
    )
  );

-- Staff can create care plans
CREATE POLICY care_plans_staff_insert ON fhir_care_plans
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'doctor', 'nurse', 'care_manager')
    )
  );

-- Staff can update care plans
CREATE POLICY care_plans_staff_update ON fhir_care_plans
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'doctor', 'nurse', 'care_manager')
    )
  );

-- Only admins can delete care plans
CREATE POLICY care_plans_admin_delete ON fhir_care_plans
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get active care plans for a patient
CREATE OR REPLACE FUNCTION get_active_care_plans(p_patient_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  status TEXT,
  intent TEXT,
  category TEXT[],
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  description TEXT,
  author_display TEXT,
  care_team_display TEXT,
  created TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.id,
    cp.title,
    cp.status,
    cp.intent,
    cp.category,
    cp.period_start,
    cp.period_end,
    cp.description,
    cp.author_display,
    cp.care_team_display,
    cp.created
  FROM fhir_care_plans cp
  WHERE cp.patient_id = p_patient_id
    AND cp.status IN ('active', 'on-hold')
  ORDER BY cp.created DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get care plans by status
CREATE OR REPLACE FUNCTION get_care_plans_by_status(
  p_patient_id UUID,
  p_status TEXT
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  status TEXT,
  intent TEXT,
  category TEXT[],
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  description TEXT,
  activities JSONB,
  created TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.id,
    cp.title,
    cp.status,
    cp.intent,
    cp.category,
    cp.period_start,
    cp.period_end,
    cp.description,
    cp.activities,
    cp.created
  FROM fhir_care_plans cp
  WHERE cp.patient_id = p_patient_id
    AND cp.status = p_status
  ORDER BY cp.created DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get care plans by category
CREATE OR REPLACE FUNCTION get_care_plans_by_category(
  p_patient_id UUID,
  p_category TEXT
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  status TEXT,
  intent TEXT,
  category TEXT[],
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  description TEXT,
  created TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.id,
    cp.title,
    cp.status,
    cp.intent,
    cp.category,
    cp.period_start,
    cp.period_end,
    cp.description,
    cp.created
  FROM fhir_care_plans cp
  WHERE cp.patient_id = p_patient_id
    AND p_category = ANY(cp.category)
  ORDER BY cp.created DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current care plan (most recent active)
CREATE OR REPLACE FUNCTION get_current_care_plan(p_patient_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  status TEXT,
  intent TEXT,
  category TEXT[],
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  description TEXT,
  activities JSONB,
  goal_displays TEXT[],
  addresses_condition_displays TEXT[],
  author_display TEXT,
  care_team_display TEXT,
  note TEXT,
  created TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.id,
    cp.title,
    cp.status,
    cp.intent,
    cp.category,
    cp.period_start,
    cp.period_end,
    cp.description,
    cp.activities,
    cp.goal_displays,
    cp.addresses_condition_displays,
    cp.author_display,
    cp.care_team_display,
    cp.note,
    cp.created
  FROM fhir_care_plans cp
  WHERE cp.patient_id = p_patient_id
    AND cp.status = 'active'
    AND (cp.period_end IS NULL OR cp.period_end >= NOW())
  ORDER BY cp.created DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get care plan activities summary
CREATE OR REPLACE FUNCTION get_care_plan_activities_summary(p_care_plan_id UUID)
RETURNS TABLE (
  total_activities INTEGER,
  completed_activities INTEGER,
  in_progress_activities INTEGER,
  not_started_activities INTEGER,
  cancelled_activities INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM jsonb_array_elements(activities))::INTEGER as total_activities,
    (SELECT COUNT(*) FROM jsonb_array_elements(activities) WHERE (value->>'status') = 'completed')::INTEGER as completed_activities,
    (SELECT COUNT(*) FROM jsonb_array_elements(activities) WHERE (value->>'status') = 'in-progress')::INTEGER as in_progress_activities,
    (SELECT COUNT(*) FROM jsonb_array_elements(activities) WHERE (value->>'status') = 'not-started')::INTEGER as not_started_activities,
    (SELECT COUNT(*) FROM jsonb_array_elements(activities) WHERE (value->>'status') = 'cancelled')::INTEGER as cancelled_activities
  FROM fhir_care_plans
  WHERE id = p_care_plan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_care_plan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS care_plan_updated_at_trigger ON fhir_care_plans;
CREATE TRIGGER care_plan_updated_at_trigger
  BEFORE UPDATE ON fhir_care_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_care_plan_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE fhir_care_plans IS 'FHIR R4 CarePlan resource - describes care delivery plan for patient';
COMMENT ON COLUMN fhir_care_plans.status IS 'draft | active | on-hold | revoked | completed | entered-in-error | unknown';
COMMENT ON COLUMN fhir_care_plans.intent IS 'proposal | plan | order | option';
COMMENT ON COLUMN fhir_care_plans.category IS 'FHIR categories - e.g., assess-plan, careteam';
COMMENT ON COLUMN fhir_care_plans.activities IS 'JSONB array of care plan activities with status, detail, and outcome';
COMMENT ON COLUMN fhir_care_plans.goal_references IS 'References to Goal resources this plan addresses';
COMMENT ON COLUMN fhir_care_plans.addresses_condition_references IS 'Conditions/problems this plan addresses';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
