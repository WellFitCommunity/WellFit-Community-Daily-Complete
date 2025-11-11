-- Law Enforcement Emergency Response Information System
-- Stores critical emergency response data for senior welfare checks
-- Used by Precinct 3 "Are You OK" program

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

CREATE TABLE IF NOT EXISTS law_enforcement_response_info (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant isolation
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Senior/Patient reference (profiles with role='patient')
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- MOBILITY STATUS
  bed_bound BOOLEAN DEFAULT FALSE,
  wheelchair_bound BOOLEAN DEFAULT FALSE,
  walker_required BOOLEAN DEFAULT FALSE,
  cane_required BOOLEAN DEFAULT FALSE,
  mobility_notes TEXT,

  -- MEDICAL EQUIPMENT (Critical for emergency response)
  oxygen_dependent BOOLEAN DEFAULT FALSE,
  oxygen_tank_location TEXT, -- "bedroom nightstand", "portable with patient"
  dialysis_required BOOLEAN DEFAULT FALSE,
  dialysis_schedule TEXT, -- "MWF 8am-12pm at DaVita Clinic"
  medical_equipment TEXT[], -- ["CPAP", "hospital bed", "hoyer lift", "nebulizer"]

  -- DISABILITY & COMMUNICATION
  hearing_impaired BOOLEAN DEFAULT FALSE,
  hearing_impaired_notes TEXT, -- "knock loudly", "doorbell doesn't work"
  vision_impaired BOOLEAN DEFAULT FALSE,
  vision_impaired_notes TEXT,
  cognitive_impairment BOOLEAN DEFAULT FALSE,
  cognitive_impairment_type TEXT, -- "dementia", "alzheimers", "TBI"
  cognitive_impairment_notes TEXT,
  non_verbal BOOLEAN DEFAULT FALSE,
  language_barrier TEXT, -- "Spanish only", "Vietnamese primary"

  -- EMERGENCY ACCESS INFORMATION
  door_code TEXT, -- Encrypted, for controlled access
  key_location TEXT, -- "neighbor apt 4A", "lockbox code 1234", "under flower pot"
  access_instructions TEXT, -- Detailed instructions for entry
  door_opens_inward BOOLEAN DEFAULT TRUE, -- Important if person has fallen
  security_system BOOLEAN DEFAULT FALSE,
  security_system_code TEXT, -- Encrypted
  pets_in_home TEXT, -- "2 dogs - friendly", "1 cat - hides", "aggressive dog - call animal control first"

  -- FALL RISK & HAZARDS
  fall_risk_high BOOLEAN DEFAULT FALSE,
  fall_history TEXT, -- "3 falls last year", "broke hip 2023"
  home_hazards TEXT, -- "cluttered", "stairs inside", "rugs not secured"

  -- EMERGENCY CONTACTS (In addition to standard emergency contacts)
  neighbor_name TEXT,
  neighbor_address TEXT,
  neighbor_phone TEXT,
  building_manager_name TEXT,
  building_manager_phone TEXT,

  -- RESPONSE PRIORITY
  response_priority TEXT CHECK (response_priority IN ('standard', 'high', 'critical')) DEFAULT 'standard',
  escalation_delay_hours INTEGER DEFAULT 6, -- How many hours before escalating missed check-in
  special_instructions TEXT, -- Free-form instructions for responding officers

  -- MEDICATIONS (High-level for awareness)
  critical_medications TEXT[], -- ["insulin", "blood thinners", "heart medication"]
  medication_location TEXT, -- "kitchen counter", "bedroom dresser"

  -- MEDICAL CONDITIONS (High-level for awareness)
  medical_conditions_summary TEXT, -- "Type 1 diabetes", "Heart failure", "Stroke survivor"

  -- CONSENT & LEGAL
  consent_obtained BOOLEAN DEFAULT FALSE,
  consent_date DATE,
  consent_given_by TEXT, -- "self", "daughter - POA", "guardian"
  hipaa_authorization BOOLEAN DEFAULT FALSE,

  -- TIMESTAMPS & AUDIT
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID, -- Nullable for flexibility
  updated_by UUID, -- Nullable for flexibility
  last_verified_date DATE, -- Last time info was verified as current

  -- UNIQUENESS
  CONSTRAINT unique_patient_emergency_info UNIQUE (tenant_id, patient_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Multi-tenant isolation
CREATE INDEX IF NOT EXISTS idx_law_enforcement_response_tenant_id
ON law_enforcement_response_info(tenant_id);

-- Patient lookup
CREATE INDEX IF NOT EXISTS idx_law_enforcement_response_patient_id
ON law_enforcement_response_info(patient_id);

-- High priority seniors
CREATE INDEX IF NOT EXISTS idx_law_enforcement_response_priority
ON law_enforcement_response_info(tenant_id, response_priority)
WHERE response_priority IN ('high', 'critical');

-- Cognitive impairment (for special handling)
CREATE INDEX IF NOT EXISTS idx_law_enforcement_response_cognitive
ON law_enforcement_response_info(tenant_id, cognitive_impairment)
WHERE cognitive_impairment = TRUE;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE law_enforcement_response_info ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS tenant_isolation_select ON law_enforcement_response_info;
DROP POLICY IF EXISTS tenant_isolation_insert ON law_enforcement_response_info;
DROP POLICY IF EXISTS tenant_isolation_update ON law_enforcement_response_info;
DROP POLICY IF EXISTS tenant_isolation_delete ON law_enforcement_response_info;

-- Policy: Users can only access info from their tenant
CREATE POLICY tenant_isolation_select ON law_enforcement_response_info
  FOR SELECT
  USING (tenant_id = get_current_tenant_id());

-- Policy: Users can only insert info for their tenant
CREATE POLICY tenant_isolation_insert ON law_enforcement_response_info
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant_id());

-- Policy: Users can only update info from their tenant
CREATE POLICY tenant_isolation_update ON law_enforcement_response_info
  FOR UPDATE
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

-- Policy: Users can only delete info from their tenant
CREATE POLICY tenant_isolation_delete ON law_enforcement_response_info
  FOR DELETE
  USING (tenant_id = get_current_tenant_id());

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-populate tenant_id from patient
CREATE OR REPLACE FUNCTION set_law_enforcement_info_tenant_id()
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

DROP TRIGGER IF EXISTS trg_set_law_enforcement_info_tenant_id ON law_enforcement_response_info;
CREATE TRIGGER trg_set_law_enforcement_info_tenant_id
  BEFORE INSERT ON law_enforcement_response_info
  FOR EACH ROW
  EXECUTE FUNCTION set_law_enforcement_info_tenant_id();

-- Auto-update updated_at timestamp
DROP TRIGGER IF EXISTS trg_law_enforcement_info_updated_at ON law_enforcement_response_info;
CREATE TRIGGER trg_law_enforcement_info_updated_at
  BEFORE UPDATE ON law_enforcement_response_info
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-set updated_by on updates
CREATE OR REPLACE FUNCTION set_law_enforcement_info_updated_by()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_law_enforcement_info_updated_by ON law_enforcement_response_info;
CREATE TRIGGER trg_set_law_enforcement_info_updated_by
  BEFORE UPDATE ON law_enforcement_response_info
  FOR EACH ROW
  EXECUTE FUNCTION set_law_enforcement_info_updated_by();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

/**
 * Get complete emergency response info for welfare check dispatch
 * Includes patient demographics + emergency response details
 * Note: check_ins table is optional - function works without it
 */
CREATE OR REPLACE FUNCTION get_welfare_check_info(p_patient_id UUID)
RETURNS TABLE (
  -- Patient Info
  patient_id UUID,
  patient_name TEXT,
  patient_age INTEGER,
  patient_phone TEXT,
  patient_address TEXT,

  -- Emergency Response Info
  mobility_status TEXT,
  medical_equipment TEXT[],
  communication_needs TEXT,
  access_instructions TEXT,
  pets TEXT,
  response_priority TEXT,
  special_instructions TEXT,

  -- Emergency Contacts
  emergency_contacts JSONB,
  neighbor_info JSONB,

  -- Risk Factors
  fall_risk BOOLEAN,
  cognitive_impairment BOOLEAN,
  oxygen_dependent BOOLEAN,

  -- Last Check-in (if check_ins table exists)
  last_check_in_time TIMESTAMPTZ,
  hours_since_check_in NUMERIC
) AS $$
DECLARE
  check_ins_exists BOOLEAN;
BEGIN
  -- Check if check_ins table exists
  SELECT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'check_ins'
  ) INTO check_ins_exists;

  IF check_ins_exists THEN
    RETURN QUERY
    SELECT
      p.id as patient_id,
      p.full_name as patient_name,
      EXTRACT(YEAR FROM AGE(p.date_of_birth))::INTEGER as patient_age,
      p.phone as patient_phone,
      p.address as patient_address,

      -- Mobility summary
      CASE
        WHEN ler.bed_bound THEN 'Bed-bound'
        WHEN ler.wheelchair_bound THEN 'Wheelchair user'
        WHEN ler.walker_required THEN 'Walker required'
        WHEN ler.cane_required THEN 'Cane required'
        ELSE 'Ambulatory'
      END as mobility_status,

      ler.medical_equipment,

      -- Communication needs summary
      CONCAT_WS('; ',
        CASE WHEN ler.hearing_impaired THEN 'Hearing impaired - ' || COALESCE(ler.hearing_impaired_notes, 'knock loudly') END,
        CASE WHEN ler.vision_impaired THEN 'Vision impaired' END,
        CASE WHEN ler.cognitive_impairment THEN 'Cognitive impairment - ' || COALESCE(ler.cognitive_impairment_type, 'unspecified') END,
        CASE WHEN ler.non_verbal THEN 'Non-verbal' END,
        CASE WHEN ler.language_barrier IS NOT NULL THEN 'Language: ' || ler.language_barrier END
      ) as communication_needs,

      -- Access instructions
      CONCAT_WS(E'\n',
        CASE WHEN ler.key_location IS NOT NULL THEN 'Key: ' || ler.key_location END,
        CASE WHEN ler.door_code IS NOT NULL THEN 'Door code: ' || ler.door_code END,
        CASE WHEN NOT ler.door_opens_inward THEN 'DOOR OPENS OUTWARD' END,
        ler.access_instructions
      ) as access_instructions,

      ler.pets_in_home as pets,
      ler.response_priority,
      ler.special_instructions,

      -- Emergency contacts (from patients table)
      p.emergency_contacts,

      -- Neighbor info
      CASE WHEN ler.neighbor_name IS NOT NULL THEN
        jsonb_build_object(
          'name', ler.neighbor_name,
          'address', ler.neighbor_address,
          'phone', ler.neighbor_phone
        )
      ELSE NULL END as neighbor_info,

      -- Risk flags
      ler.fall_risk_high,
      ler.cognitive_impairment,
      ler.oxygen_dependent,

      -- Last check-in
      (SELECT created_at FROM check_ins WHERE user_id = p.id ORDER BY created_at DESC LIMIT 1) as last_check_in_time,
      EXTRACT(EPOCH FROM (NOW() - (SELECT created_at FROM check_ins WHERE user_id = p.id ORDER BY created_at DESC LIMIT 1))) / 3600 as hours_since_check_in

    FROM profiles p
    LEFT JOIN law_enforcement_response_info ler ON ler.patient_id = p.id
    WHERE p.id = p_patient_id
      AND p.role = 'patient'
      AND p.tenant_id = get_current_tenant_id();
  ELSE
    -- Return without check-in data if table doesn't exist
    RETURN QUERY
    SELECT
      p.id as patient_id,
      p.full_name as patient_name,
      EXTRACT(YEAR FROM AGE(p.date_of_birth))::INTEGER as patient_age,
      p.phone as patient_phone,
      p.address as patient_address,

      CASE
        WHEN ler.bed_bound THEN 'Bed-bound'
        WHEN ler.wheelchair_bound THEN 'Wheelchair user'
        WHEN ler.walker_required THEN 'Walker required'
        WHEN ler.cane_required THEN 'Cane required'
        ELSE 'Ambulatory'
      END as mobility_status,

      ler.medical_equipment,

      CONCAT_WS('; ',
        CASE WHEN ler.hearing_impaired THEN 'Hearing impaired - ' || COALESCE(ler.hearing_impaired_notes, 'knock loudly') END,
        CASE WHEN ler.vision_impaired THEN 'Vision impaired' END,
        CASE WHEN ler.cognitive_impairment THEN 'Cognitive impairment - ' || COALESCE(ler.cognitive_impairment_type, 'unspecified') END,
        CASE WHEN ler.non_verbal THEN 'Non-verbal' END,
        CASE WHEN ler.language_barrier IS NOT NULL THEN 'Language: ' || ler.language_barrier END
      ) as communication_needs,

      CONCAT_WS(E'\n',
        CASE WHEN ler.key_location IS NOT NULL THEN 'Key: ' || ler.key_location END,
        CASE WHEN ler.door_code IS NOT NULL THEN 'Door code: ' || ler.door_code END,
        CASE WHEN NOT ler.door_opens_inward THEN 'DOOR OPENS OUTWARD' END,
        ler.access_instructions
      ) as access_instructions,

      ler.pets_in_home as pets,
      ler.response_priority,
      ler.special_instructions,
      p.emergency_contacts,

      CASE WHEN ler.neighbor_name IS NOT NULL THEN
        jsonb_build_object(
          'name', ler.neighbor_name,
          'address', ler.neighbor_address,
          'phone', ler.neighbor_phone
        )
      ELSE NULL END as neighbor_info,

      ler.fall_risk_high,
      ler.cognitive_impairment,
      ler.oxygen_dependent,

      NULL::TIMESTAMPTZ as last_check_in_time,
      NULL::NUMERIC as hours_since_check_in

    FROM profiles p
    LEFT JOIN law_enforcement_response_info ler ON ler.patient_id = p.id
    WHERE p.id = p_patient_id
      AND p.role = 'patient'
      AND p.tenant_id = get_current_tenant_id();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Get all seniors with missed check-ins requiring welfare checks
 * Returns list prioritized by urgency
 * Note: Requires check_ins table - returns empty if table doesn't exist
 */
CREATE OR REPLACE FUNCTION get_missed_check_in_alerts()
RETURNS TABLE (
  patient_id UUID,
  patient_name TEXT,
  patient_address TEXT,
  patient_phone TEXT,
  hours_since_check_in NUMERIC,
  response_priority TEXT,
  mobility_status TEXT,
  special_needs TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  urgency_score INTEGER
) AS $$
DECLARE
  check_ins_exists BOOLEAN;
BEGIN
  -- Check if check_ins table exists
  SELECT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'check_ins'
  ) INTO check_ins_exists;

  IF NOT check_ins_exists THEN
    -- Return empty result set if check_ins table doesn't exist
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.address,
    p.phone,
    EXTRACT(EPOCH FROM (NOW() - last_ci.created_at)) / 3600 as hours_since_check_in,
    COALESCE(ler.response_priority, 'standard') as response_priority,
    CASE
      WHEN ler.bed_bound THEN 'Bed-bound'
      WHEN ler.wheelchair_bound THEN 'Wheelchair'
      WHEN ler.walker_required THEN 'Walker'
      ELSE 'Mobile'
    END as mobility_status,
    CONCAT_WS(', ',
      CASE WHEN ler.oxygen_dependent THEN 'Oxygen' END,
      CASE WHEN ler.cognitive_impairment THEN 'Cognitive impairment' END,
      CASE WHEN ler.hearing_impaired THEN 'Hearing impaired' END
    ) as special_needs,
    p.emergency_contacts->0->>'name' as emergency_contact_name,
    p.emergency_contacts->0->>'phone' as emergency_contact_phone,
    -- Urgency calculation
    (
      CASE COALESCE(ler.response_priority, 'standard')
        WHEN 'critical' THEN 100
        WHEN 'high' THEN 50
        ELSE 0
      END +
      CASE WHEN ler.cognitive_impairment THEN 20 ELSE 0 END +
      CASE WHEN ler.oxygen_dependent THEN 20 ELSE 0 END +
      CASE WHEN ler.fall_risk_high THEN 15 ELSE 0 END +
      (EXTRACT(EPOCH FROM (NOW() - last_ci.created_at)) / 3600)::INTEGER
    )::INTEGER as urgency_score
  FROM profiles p
  LEFT JOIN law_enforcement_response_info ler ON ler.patient_id = p.id
  LEFT JOIN LATERAL (
    SELECT created_at
    FROM check_ins
    WHERE user_id = p.id
    ORDER BY created_at DESC
    LIMIT 1
  ) last_ci ON true
  WHERE p.role = 'patient'
    AND p.tenant_id = get_current_tenant_id()
    AND last_ci.created_at IS NOT NULL
    AND (
      -- No check-in today OR
      last_ci.created_at < CURRENT_DATE OR
      -- Exceeded escalation delay
      EXTRACT(EPOCH FROM (NOW() - last_ci.created_at)) / 3600 > COALESCE(ler.escalation_delay_hours, 6)
    )
  ORDER BY urgency_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE law_enforcement_response_info IS
'Emergency response information for law enforcement welfare checks. Contains critical details needed by officers responding to missed senior check-ins.';

COMMENT ON COLUMN law_enforcement_response_info.response_priority IS
'Escalation priority: standard (6+ hours), high (4 hours), critical (2 hours)';

COMMENT ON COLUMN law_enforcement_response_info.escalation_delay_hours IS
'Hours after missed check-in before alerting law enforcement';

COMMENT ON COLUMN law_enforcement_response_info.door_opens_inward IS
'Critical safety info - if person has fallen against door, entry may be blocked';

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON law_enforcement_response_info TO authenticated;

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION get_welfare_check_info TO authenticated;
GRANT EXECUTE ON FUNCTION get_missed_check_in_alerts TO authenticated;
