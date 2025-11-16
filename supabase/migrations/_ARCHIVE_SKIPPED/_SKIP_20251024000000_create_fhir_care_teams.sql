-- =====================================================================
-- FHIR CareTeam Resource Implementation
-- =====================================================================
-- Implements FHIR R4 CareTeam resource for care coordination
-- Supports US Core CareTeam Profile
-- Tracks provider teams, patient support circles, care coordinators
--
-- Standard: FHIR R4 (http://hl7.org/fhir/R4/careteam.html)
-- Profile: US Core CareTeam (http://hl7.org/fhir/us/core/StructureDefinition/us-core-careteam)
-- =====================================================================

-- Drop existing tables if they exist (idempotent migration)
DROP TABLE IF EXISTS fhir_care_team_members CASCADE;
DROP TABLE IF EXISTS fhir_care_teams CASCADE;

-- =====================================================================
-- Main CareTeam Table
-- =====================================================================
CREATE TABLE fhir_care_teams (
  -- Core FHIR Resource Fields
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Status: draft | active | suspended | inactive | entered-in-error
  status TEXT NOT NULL DEFAULT 'active',
  CHECK (status IN ('draft', 'active', 'suspended', 'inactive', 'entered-in-error')),

  -- Name of the care team
  name TEXT,

  -- Reference to the patient (subject of care)
  patient_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,

  -- Period when the team is active
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,

  -- Category: care coordination, episode of care, longitudinal care coordination, etc.
  -- CodeableConcept from http://loinc.org
  category TEXT[] DEFAULT ARRAY['care-coordination'],

  -- Encounter context (optional)
  encounter_reference TEXT,
  encounter_display TEXT,

  -- Managing organization (optional)
  managing_organization_reference TEXT,
  managing_organization_display TEXT,

  -- Telecom contact information (JSON array)
  telecom JSONB, -- [{system: 'phone', value: '555-1234', use: 'work'}]

  -- Notes and additional information
  note TEXT,

  -- Reason for the care team
  reason_code TEXT[], -- SNOMED CT codes
  reason_display TEXT[], -- Human-readable reasons

  -- SOC 2 Compliance: Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(user_id),
  updated_by UUID REFERENCES profiles(user_id),

  -- Soft delete support
  deleted_at TIMESTAMPTZ,

  -- FHIR version tracking
  version_id INTEGER NOT NULL DEFAULT 1,

  -- Index for fast patient lookups
  CONSTRAINT valid_period CHECK (period_end IS NULL OR period_start <= period_end)
);

-- Indexes for performance
CREATE INDEX idx_fhir_care_teams_patient ON fhir_care_teams(patient_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_fhir_care_teams_status ON fhir_care_teams(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_fhir_care_teams_period ON fhir_care_teams(period_start, period_end) WHERE deleted_at IS NULL;
CREATE INDEX idx_fhir_care_teams_category ON fhir_care_teams USING GIN(category);

-- =====================================================================
-- CareTeam Members/Participants Table
-- =====================================================================
CREATE TABLE fhir_care_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to parent care team
  care_team_id UUID NOT NULL REFERENCES fhir_care_teams(id) ON DELETE CASCADE,

  -- Role of the participant (CodeableConcept)
  -- http://hl7.org/fhir/ValueSet/participant-role
  role_code TEXT, -- e.g., 'primary-care-physician', 'nurse', 'social-worker'
  role_display TEXT, -- e.g., 'Primary Care Physician'
  role_system TEXT DEFAULT 'http://snomed.info/sct',

  -- Reference to the member
  -- Can be Practitioner, PractitionerRole, RelatedPerson, Patient, Organization, CareTeam
  member_reference TEXT NOT NULL, -- e.g., 'Practitioner/123' or 'Patient/456'
  member_display TEXT NOT NULL, -- Human-readable name
  member_type TEXT, -- 'Practitioner', 'Patient', 'RelatedPerson', etc.

  -- Local reference to user if member is in our system
  member_user_id UUID REFERENCES profiles(user_id),

  -- Organization affiliation (optional)
  on_behalf_of_reference TEXT,
  on_behalf_of_display TEXT,

  -- Period when this member is part of the team
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,

  -- Is this person the primary contact for coordination?
  is_primary_contact BOOLEAN DEFAULT FALSE,

  -- Contact information (if different from member's profile)
  telecom JSONB, -- [{system: 'phone', value: '555-5678'}]

  -- Order/priority of this member in the team
  sequence INTEGER,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_member_period CHECK (period_end IS NULL OR period_start <= period_end)
);

-- Indexes for fast lookups
CREATE INDEX idx_fhir_care_team_members_team ON fhir_care_team_members(care_team_id);
CREATE INDEX idx_fhir_care_team_members_role ON fhir_care_team_members(role_code);
CREATE INDEX idx_fhir_care_team_members_user ON fhir_care_team_members(member_user_id) WHERE member_user_id IS NOT NULL;
CREATE INDEX idx_fhir_care_team_members_primary ON fhir_care_team_members(care_team_id, is_primary_contact) WHERE is_primary_contact = TRUE;

-- =====================================================================
-- Triggers for Updated Timestamp
-- =====================================================================
CREATE OR REPLACE FUNCTION update_fhir_care_team_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.version_id = OLD.version_id + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fhir_care_teams_timestamp
  BEFORE UPDATE ON fhir_care_teams
  FOR EACH ROW
  EXECUTE FUNCTION update_fhir_care_team_timestamp();

CREATE TRIGGER update_fhir_care_team_members_timestamp
  BEFORE UPDATE ON fhir_care_team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- Row Level Security (RLS) Policies
-- =====================================================================
ALTER TABLE fhir_care_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE fhir_care_team_members ENABLE ROW LEVEL SECURITY;

-- Patients can view their own care teams
CREATE POLICY fhir_care_teams_patient_view ON fhir_care_teams
  FOR SELECT
  USING (
    patient_id = auth.uid()
    AND deleted_at IS NULL
  );

-- Care team members can view teams they're part of
CREATE POLICY fhir_care_teams_member_view ON fhir_care_teams
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fhir_care_team_members m
      WHERE m.care_team_id = id
        AND m.member_user_id = auth.uid()
        AND (m.period_end IS NULL OR m.period_end > now())
    )
    AND deleted_at IS NULL
  );

-- Admin and care coordinators can view all care teams
CREATE POLICY fhir_care_teams_admin_all ON fhir_care_teams
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON p.role_code = r.id
      WHERE p.user_id = auth.uid()
        AND r.name IN ('admin', 'super_admin', 'staff', 'contractor_nurse')
    )
  );

-- Members policies (inherit from parent care team)
CREATE POLICY fhir_care_team_members_view ON fhir_care_team_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fhir_care_teams ct
      WHERE ct.id = care_team_id
        AND (
          ct.patient_id = auth.uid()
          OR member_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles p
            JOIN roles r ON p.role_code = r.id
            WHERE p.user_id = auth.uid()
              AND r.name IN ('admin', 'super_admin', 'staff', 'contractor_nurse')
          )
        )
    )
  );

CREATE POLICY fhir_care_team_members_admin_all ON fhir_care_team_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON p.role_code = r.id
      WHERE p.user_id = auth.uid()
        AND r.name IN ('admin', 'super_admin', 'staff', 'contractor_nurse')
    )
  );

-- =====================================================================
-- Helper Functions
-- =====================================================================

-- Get active care team for a patient
CREATE OR REPLACE FUNCTION get_active_care_team(p_patient_id UUID)
RETURNS TABLE (
  team_id UUID,
  team_name TEXT,
  team_status TEXT,
  member_count BIGINT,
  primary_contact TEXT,
  created_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ct.id,
    ct.name,
    ct.status,
    COUNT(DISTINCT m.id) as member_count,
    MAX(CASE WHEN m.is_primary_contact THEN m.member_display END) as primary_contact,
    ct.created_at
  FROM fhir_care_teams ct
  LEFT JOIN fhir_care_team_members m ON ct.id = m.care_team_id
  WHERE ct.patient_id = p_patient_id
    AND ct.status = 'active'
    AND ct.deleted_at IS NULL
    AND (ct.period_end IS NULL OR ct.period_end > now())
  GROUP BY ct.id, ct.name, ct.status, ct.created_at
  ORDER BY ct.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get team members with roles
CREATE OR REPLACE FUNCTION get_care_team_members(p_team_id UUID)
RETURNS TABLE (
  member_id UUID,
  member_name TEXT,
  member_type TEXT,
  role TEXT,
  is_primary BOOLEAN,
  contact_info JSONB,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.member_display,
    m.member_type,
    m.role_display,
    m.is_primary_contact,
    m.telecom,
    m.period_start,
    m.period_end
  FROM fhir_care_team_members m
  WHERE m.care_team_id = p_team_id
    AND (m.period_end IS NULL OR m.period_end > now())
  ORDER BY
    m.is_primary_contact DESC,
    m.sequence NULLS LAST,
    m.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get patient's care team summary for dashboard
CREATE OR REPLACE FUNCTION get_patient_care_team_summary(p_patient_id UUID)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'active_teams', COUNT(*) FILTER (WHERE status = 'active'),
    'total_members', SUM((SELECT COUNT(*) FROM fhir_care_team_members m WHERE m.care_team_id = ct.id)),
    'primary_physician', (
      SELECT m.member_display
      FROM fhir_care_team_members m
      WHERE m.care_team_id = ct.id
        AND m.role_code IN ('primary-care-physician', 'physician')
        AND m.is_primary_contact = TRUE
      LIMIT 1
    ),
    'care_coordinator', (
      SELECT m.member_display
      FROM fhir_care_team_members m
      WHERE m.care_team_id = ct.id
        AND m.role_code = 'care-coordinator'
      LIMIT 1
    )
  ) INTO v_result
  FROM fhir_care_teams ct
  WHERE ct.patient_id = p_patient_id
    AND ct.deleted_at IS NULL
    AND (ct.period_end IS NULL OR ct.period_end > now());

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- Grants
-- =====================================================================
GRANT SELECT ON fhir_care_teams TO authenticated;
GRANT SELECT ON fhir_care_team_members TO authenticated;
GRANT ALL ON fhir_care_teams TO service_role;
GRANT ALL ON fhir_care_team_members TO service_role;

GRANT EXECUTE ON FUNCTION get_active_care_team(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_care_team_members(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_patient_care_team_summary(UUID) TO authenticated;

-- =====================================================================
-- Sample Data (for testing - comment out in production)
-- =====================================================================
COMMENT ON TABLE fhir_care_teams IS 'FHIR R4 CareTeam resources - care coordination teams for patients';
COMMENT ON TABLE fhir_care_team_members IS 'Members/participants of care teams with roles and contact info';
COMMENT ON COLUMN fhir_care_teams.status IS 'draft | active | suspended | inactive | entered-in-error';
COMMENT ON COLUMN fhir_care_teams.category IS 'Type of team: care-coordination, episode, longitudinal, etc.';
COMMENT ON COLUMN fhir_care_team_members.role_code IS 'SNOMED CT role code: primary-care-physician, nurse, social-worker, etc.';
COMMENT ON COLUMN fhir_care_team_members.is_primary_contact IS 'Primary point of contact for care coordination';

-- Migration complete
