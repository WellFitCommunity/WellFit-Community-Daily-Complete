-- Migration: Add Building Location and Emergency Access Fields
-- Description: Enhances law enforcement emergency response info with detailed building location
--              and emergency access information for safer, more efficient welfare checks
-- Date: 2025-11-11

-- Add building location columns
ALTER TABLE law_enforcement_response_info
  ADD COLUMN IF NOT EXISTS floor_number TEXT,
  ADD COLUMN IF NOT EXISTS building_quadrant TEXT,
  ADD COLUMN IF NOT EXISTS elevator_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS elevator_access_code TEXT,
  ADD COLUMN IF NOT EXISTS building_type TEXT,
  ADD COLUMN IF NOT EXISTS stairs_to_unit INTEGER;

-- Add emergency access columns
ALTER TABLE law_enforcement_response_info
  ADD COLUMN IF NOT EXISTS parking_instructions TEXT,
  ADD COLUMN IF NOT EXISTS gated_community_code TEXT,
  ADD COLUMN IF NOT EXISTS lobby_access_instructions TEXT,
  ADD COLUMN IF NOT EXISTS best_entrance TEXT,
  ADD COLUMN IF NOT EXISTS intercom_instructions TEXT;

-- Add comments for documentation
COMMENT ON COLUMN law_enforcement_response_info.floor_number IS 'Floor number or level (e.g., Ground, 3, Basement, Top Floor)';
COMMENT ON COLUMN law_enforcement_response_info.building_quadrant IS 'Building section/quadrant (e.g., Northeast corner, Right side facing street)';
COMMENT ON COLUMN law_enforcement_response_info.elevator_required IS 'Indicates if elevator is required to reach unit';
COMMENT ON COLUMN law_enforcement_response_info.elevator_access_code IS 'Code or key required for elevator access';
COMMENT ON COLUMN law_enforcement_response_info.building_type IS 'Type of residence (e.g., Single Family Home, Apartment, Condo, Assisted Living)';
COMMENT ON COLUMN law_enforcement_response_info.stairs_to_unit IS 'Number of stairs to reach unit';
COMMENT ON COLUMN law_enforcement_response_info.parking_instructions IS 'Where emergency vehicles should park (e.g., Visitor parking Lot B, Street parking only)';
COMMENT ON COLUMN law_enforcement_response_info.gated_community_code IS 'Gate access code for gated communities';
COMMENT ON COLUMN law_enforcement_response_info.lobby_access_instructions IS 'Instructions for accessing building lobby (hours, codes, buzzer)';
COMMENT ON COLUMN law_enforcement_response_info.best_entrance IS 'Recommended entrance for emergency response (e.g., Front, Side, Rear)';
COMMENT ON COLUMN law_enforcement_response_info.intercom_instructions IS 'How to use intercom/buzzer system to gain entry';

-- Create index for building type queries (useful for filtering by residence type)
CREATE INDEX IF NOT EXISTS idx_law_enforcement_building_type
  ON law_enforcement_response_info(building_type)
  WHERE building_type IS NOT NULL;

-- Create index for elevator required (critical for emergency response planning)
CREATE INDEX IF NOT EXISTS idx_law_enforcement_elevator_required
  ON law_enforcement_response_info(elevator_required)
  WHERE elevator_required = true;

-- Update the get_welfare_check_info function to include building location information
CREATE OR REPLACE FUNCTION get_welfare_check_info(p_patient_id UUID)
RETURNS TABLE (
  patient_id UUID,
  patient_name TEXT,
  patient_age INTEGER,
  patient_phone TEXT,
  patient_address TEXT,
  building_location TEXT,
  floor_number TEXT,
  elevator_required BOOLEAN,
  parking_instructions TEXT,
  mobility_status TEXT,
  medical_equipment TEXT[],
  communication_needs TEXT,
  access_instructions TEXT,
  pets TEXT,
  response_priority TEXT,
  special_instructions TEXT,
  emergency_contacts JSONB,
  neighbor_info JSONB,
  fall_risk BOOLEAN,
  cognitive_impairment BOOLEAN,
  oxygen_dependent BOOLEAN,
  last_check_in_time TIMESTAMP WITH TIME ZONE,
  hours_since_check_in NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mobility TEXT := '';
  v_communication TEXT := '';
  v_access TEXT := '';
  v_building_location TEXT := '';
BEGIN
  -- Build mobility status text
  SELECT INTO v_mobility
    CASE
      WHEN leri.bed_bound THEN 'Bed-bound'
      WHEN leri.wheelchair_bound THEN 'Wheelchair user'
      WHEN leri.walker_required THEN 'Walker required'
      WHEN leri.cane_required THEN 'Cane required'
      ELSE 'Ambulatory'
    END ||
    COALESCE(' - ' || leri.mobility_notes, '')
  FROM law_enforcement_response_info leri
  WHERE leri.patient_id = p_patient_id;

  -- Build communication needs text
  SELECT INTO v_communication
    STRING_AGG(comm_need, '; ')
  FROM (
    SELECT unnest(ARRAY[
      CASE WHEN leri.hearing_impaired THEN 'Hearing impaired' || COALESCE(': ' || leri.hearing_impaired_notes, '') END,
      CASE WHEN leri.vision_impaired THEN 'Vision impaired' || COALESCE(': ' || leri.vision_impaired_notes, '') END,
      CASE WHEN leri.cognitive_impairment THEN 'Cognitive impairment (' || COALESCE(leri.cognitive_impairment_type, 'unspecified') || ')' || COALESCE(': ' || leri.cognitive_impairment_notes, '') END,
      CASE WHEN leri.non_verbal THEN 'Non-verbal' END,
      CASE WHEN leri.language_barrier IS NOT NULL THEN 'Language barrier: ' || leri.language_barrier END
    ]) AS comm_need
    FROM law_enforcement_response_info leri
    WHERE leri.patient_id = p_patient_id
  ) sub
  WHERE comm_need IS NOT NULL;

  -- Build access instructions text
  SELECT INTO v_access
    STRING_AGG(access_info, E'\n')
  FROM (
    SELECT unnest(ARRAY[
      CASE WHEN leri.door_code IS NOT NULL THEN 'Door code: ' || leri.door_code END,
      CASE WHEN leri.key_location IS NOT NULL THEN 'Key location: ' || leri.key_location END,
      CASE WHEN leri.access_instructions IS NOT NULL THEN leri.access_instructions END,
      CASE WHEN leri.door_opens_inward THEN 'WARNING: Door opens inward (check for person fallen against door)' END,
      CASE WHEN leri.security_system THEN 'Security system present' || COALESCE(' (code: ' || leri.security_system_code || ')', '') END,
      CASE WHEN leri.gated_community_code IS NOT NULL THEN 'Gate code: ' || leri.gated_community_code END,
      CASE WHEN leri.lobby_access_instructions IS NOT NULL THEN 'Lobby access: ' || leri.lobby_access_instructions END,
      CASE WHEN leri.intercom_instructions IS NOT NULL THEN 'Intercom: ' || leri.intercom_instructions END,
      CASE WHEN leri.best_entrance IS NOT NULL THEN 'Best entrance: ' || leri.best_entrance END
    ]) AS access_info
    FROM law_enforcement_response_info leri
    WHERE leri.patient_id = p_patient_id
  ) sub
  WHERE access_info IS NOT NULL;

  -- Build building location text
  SELECT INTO v_building_location
    STRING_AGG(location_info, E'\n')
  FROM (
    SELECT unnest(ARRAY[
      CASE WHEN leri.building_type IS NOT NULL THEN 'Building type: ' || leri.building_type END,
      CASE WHEN leri.floor_number IS NOT NULL THEN 'Floor: ' || leri.floor_number END,
      CASE WHEN leri.building_quadrant IS NOT NULL THEN 'Location: ' || leri.building_quadrant END,
      CASE WHEN leri.elevator_required THEN 'ELEVATOR REQUIRED' || COALESCE(' (code: ' || leri.elevator_access_code || ')', '') END,
      CASE WHEN leri.stairs_to_unit IS NOT NULL AND leri.stairs_to_unit > 0 THEN 'Stairs to unit: ' || leri.stairs_to_unit::TEXT END,
      CASE WHEN leri.parking_instructions IS NOT NULL THEN 'Parking: ' || leri.parking_instructions END
    ]) AS location_info
    FROM law_enforcement_response_info leri
    WHERE leri.patient_id = p_patient_id
  ) sub
  WHERE location_info IS NOT NULL;

  -- Return complete welfare check info
  RETURN QUERY
  SELECT
    p.id,
    (p.first_name || ' ' || p.last_name)::TEXT,
    EXTRACT(YEAR FROM AGE(p.date_of_birth))::INTEGER,
    COALESCE(p.phone, '')::TEXT,
    COALESCE(p.address, '')::TEXT,
    COALESCE(v_building_location, 'Not specified')::TEXT,
    leri.floor_number,
    COALESCE(leri.elevator_required, false),
    leri.parking_instructions,
    COALESCE(v_mobility, 'Not specified')::TEXT,
    COALESCE(leri.medical_equipment, ARRAY[]::TEXT[]),
    COALESCE(v_communication, 'No special communication needs')::TEXT,
    COALESCE(v_access, 'No access information provided')::TEXT,
    leri.pets_in_home,
    leri.response_priority::TEXT,
    leri.special_instructions,
    -- Emergency contacts (from profiles table)
    jsonb_build_array(
      jsonb_build_object(
        'name', COALESCE(p.caregiver_first_name || ' ' || p.caregiver_last_name, ''),
        'relationship', COALESCE(p.caregiver_relationship, ''),
        'phone', COALESCE(p.caregiver_phone, ''),
        'email', '',
        'isPrimary', true
      )
    ),
    -- Neighbor info
    CASE
      WHEN leri.neighbor_name IS NOT NULL THEN
        jsonb_build_object(
          'name', leri.neighbor_name,
          'address', COALESCE(leri.neighbor_address, ''),
          'phone', COALESCE(leri.neighbor_phone, '')
        )
      ELSE NULL
    END,
    leri.fall_risk_high,
    leri.cognitive_impairment,
    leri.oxygen_dependent,
    -- Check-in status (if check_ins table exists)
    (
      SELECT MAX(ci.check_in_time)
      FROM check_ins ci
      WHERE ci.user_id = p_patient_id
      AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'check_ins')
    ),
    (
      SELECT EXTRACT(EPOCH FROM (NOW() - MAX(ci.check_in_time))) / 3600
      FROM check_ins ci
      WHERE ci.user_id = p_patient_id
      AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'check_ins')
    )
  FROM profiles p
  LEFT JOIN law_enforcement_response_info leri ON leri.patient_id = p.id
  WHERE p.id = p_patient_id;
END;
$$;

-- Add helpful comment to function
COMMENT ON FUNCTION get_welfare_check_info IS 'Returns complete welfare check information including building location and emergency access details for constable dispatch';
