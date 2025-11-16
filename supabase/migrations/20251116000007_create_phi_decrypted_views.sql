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
SELECT * FROM check_ins;

-- Create risk_assessments_decrypted view
-- Maps to ai_risk_assessments table (risk_assessments table in _SKIP_ migration)
-- Currently pass-through since data not encrypted
-- Create only if ai_risk_assessments table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_risk_assessments') THEN
    EXECUTE 'CREATE VIEW risk_assessments_decrypted AS SELECT * FROM ai_risk_assessments';
  END IF;
END
$$;

-- Grant permissions
GRANT SELECT ON check_ins_decrypted TO authenticated;
GRANT SELECT ON check_ins_decrypted TO anon;

-- Grant on risk_assessments_decrypted only if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_views WHERE schemaname = 'public' AND viewname = 'risk_assessments_decrypted') THEN
    EXECUTE 'GRANT SELECT ON risk_assessments_decrypted TO authenticated';
    EXECUTE 'GRANT SELECT ON risk_assessments_decrypted TO anon';
  END IF;
END
$$;

-- Add comments
COMMENT ON VIEW check_ins_decrypted IS
  'Decrypted view of check_ins table. Currently pass-through pending encryption implementation.';

-- Note: When PHI encryption is fully implemented, update these views to:
-- SELECT decrypt_phi_text(encrypted_notes) AS notes, ...
