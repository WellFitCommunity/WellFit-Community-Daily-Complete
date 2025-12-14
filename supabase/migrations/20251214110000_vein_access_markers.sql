-- Vein Access & Phlebotomy Markers
-- Adds ICD-10 mappings for conditions that affect IV access

-- Insert vein access related condition mappings
INSERT INTO condition_marker_mappings (
  icd10_pattern, marker_type, marker_category, marker_display_name,
  body_region, position_x, position_y, body_view, is_status_badge, priority
)
VALUES
  -- Chemotherapy - often causes scarred veins
  ('Z51.1%', 'scarred_vein', 'moderate', 'Scarred Vein (Chemo)', 'left_arm', 20, 48, 'front', false, 60),
  ('Z92.21', 'scarred_vein', 'moderate', 'Scarred Vein (Chemo History)', 'left_arm', 20, 48, 'front', false, 60),

  -- Dialysis - AV fistula/graft considerations
  ('Z99.2', 'avoid_access', 'critical', 'Avoid Arm (Dialysis)', 'left_arm', 15, 40, 'front', false, 95),
  ('Z49.%', 'avoid_access', 'critical', 'Avoid Access Site (Dialysis)', 'left_arm', 15, 40, 'front', false, 95),

  -- Mastectomy/Lymphedema - avoid affected arm
  ('Z90.1%', 'avoid_access', 'critical', 'Avoid Arm (Mastectomy)', 'left_arm', 15, 40, 'front', false, 95),
  ('I89.0', 'avoid_access', 'critical', 'Avoid Arm (Lymphedema)', 'left_arm', 15, 40, 'front', false, 95),
  ('I97.2', 'avoid_access', 'critical', 'Avoid Arm (Post-Mastectomy Lymphedema)', 'left_arm', 15, 40, 'front', false, 90),

  -- Peripheral vascular disease - fragile veins
  ('I73.9', 'fragile_veins', 'moderate', 'Fragile Veins (PVD)', 'left_arm', 20, 44, 'front', false, 50),
  ('I70.2%', 'fragile_veins', 'moderate', 'Fragile Veins (Atherosclerosis)', 'left_arm', 20, 44, 'front', false, 50),

  -- IV Drug Use History - scarred veins
  ('F11.%', 'scarred_vein', 'moderate', 'Scarred Vein (Check for Track Marks)', 'left_arm', 20, 48, 'front', false, 60),
  ('F19.%', 'scarred_vein', 'moderate', 'Scarred Vein (IV History Possible)', 'left_arm', 20, 48, 'front', false, 60),

  -- Coagulation disorders - bleeding risk affects IV approach
  ('D68.%', 'small_gauge_needle', 'moderate', 'Small Gauge Needle (Coagulation)', 'left_arm', 18, 47, 'front', false, 45),
  ('D69.%', 'small_gauge_needle', 'moderate', 'Small Gauge Needle (Bleeding Risk)', 'left_arm', 18, 47, 'front', false, 45),

  -- Chronic steroid use - fragile skin/veins
  ('E24.%', 'fragile_veins', 'moderate', 'Fragile Veins (Cushings)', 'left_arm', 20, 44, 'front', false, 50),

  -- Obesity - may need ultrasound
  ('E66.%', 'ultrasound_guided', 'critical', 'Ultrasound Guided (Consider for Obesity)', 'left_arm', 18, 43, 'front', false, 80),

  -- Edema - veins hard to find
  ('R60.%', 'vein_finder', 'moderate', 'Vein Finder Recommended (Edema)', 'left_arm', 18, 45, 'front', false, 40),
  ('I50.%', 'vein_finder', 'moderate', 'Vein Finder Recommended (CHF Edema)', 'left_arm', 18, 45, 'front', false, 40),

  -- Difficult IV Access status badge (for hard sticks)
  ('Z53.09', 'difficult_iv_access', 'critical', 'Difficult IV Access', 'badge_area', 95, 90, 'front', true, 120)

ON CONFLICT DO NOTHING;

-- Add a comment explaining this migration
COMMENT ON TABLE condition_marker_mappings IS
'Maps ICD-10 diagnosis codes to patient avatar markers for auto-population.
Includes vein access markers for phlebotomy preparation (added 2025-12-14).';
