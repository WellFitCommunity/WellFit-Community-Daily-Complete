-- Drop the phone_verifications table as it's no longer needed
-- after removing the old phone+PIN authentication system.

DROP TABLE IF EXISTS public.phone_verifications;

-- Additional notes:
-- - If there were any related sequences, functions, or triggers
--   specifically tied *only* to this table and not used elsewhere,
--   they could also be dropped here.
-- - RLS policies specifically on phone_verifications are dropped with the table.
-- - If there were foreign key constraints from other tables pointing to phone_verifications,
--   those would need to be handled (e.g., by first dropping the FK constraint).
--   This migration assumes phone_verifications is standalone for this purpose.

SELECT 'Migration 20250703000000_drop_phone_verifications_table.sql: phone_verifications table dropped (if it existed).';
