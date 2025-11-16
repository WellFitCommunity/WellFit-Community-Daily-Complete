-- Create PHI decrypted views
-- Issue: Code references check_ins_decrypted and risk_assessments_decrypted views that don't exist
-- Current status: Data is not yet encrypted, so these are simple pass-through views
-- Future: When encryption is implemented, these views will use decrypt_phi_text() function

-- Drop views if they exist
DROP VIEW IF EXISTS check_ins_decrypted;
DROP VIEW IF EXISTS risk_assessments_decrypted;

-- Create check_ins_decrypted view
-- Currently pass-through since data not encrypted
-- When encryption is added, this will use: decrypt_phi_text(encrypted_column) AS column_name
CREATE VIEW check_ins_decrypted AS
SELECT
  id,
  user_id,
  timestamp,
  label,
  notes,
  is_emergency,
  emotional_state,
  heart_rate,
  pulse_oximeter,
  bp_systolic,
  bp_diastolic,
  glucose_mg_dl,
  created_at,
  reviewed_at,
  reviewed_by_name
FROM check_ins;

-- Create risk_assessments_decrypted view
-- Maps to ai_risk_assessments table (risk_assessments table in _SKIP_ migration)
-- Currently pass-through since data not encrypted
CREATE VIEW risk_assessments_decrypted AS
SELECT
  id,
  patient_id,
  risk_level,
  risk_score,
  risk_factors,
  recommendations,
  priority,
  trend_direction,
  assessed_at,
  assessment_version,
  assessed_at AS created_at -- Add created_at alias for compatibility
FROM ai_risk_assessments;

-- Grant permissions
GRANT SELECT ON check_ins_decrypted TO authenticated;
GRANT SELECT ON check_ins_decrypted TO anon;
GRANT SELECT ON risk_assessments_decrypted TO authenticated;
GRANT SELECT ON risk_assessments_decrypted TO anon;

-- Add comments
COMMENT ON VIEW check_ins_decrypted IS
  'Decrypted view of check_ins table. Currently pass-through pending encryption implementation.';
COMMENT ON VIEW risk_assessments_decrypted IS
  'Decrypted view of ai_risk_assessments table. Currently pass-through pending encryption implementation.';

-- Note: When PHI encryption is fully implemented, update these views to:
-- SELECT decrypt_phi_text(encrypted_notes) AS notes, ...
