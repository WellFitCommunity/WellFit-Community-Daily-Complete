-- Update NUCC taxonomy record count after expansion from 24 to 206 codes
UPDATE reference_data_versions
SET record_count = 206,
    loaded_at = now(),
    notes = 'NUCC provider taxonomy codes. Updated ~annually. 206 codes covering physicians, nursing, therapy, behavioral health, pharmacy, dental, vision, EMS, labs, organizations, and managed care.'
WHERE data_source = 'nucc_taxonomy';
