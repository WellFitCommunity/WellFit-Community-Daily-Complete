-- Add demographics_step column for tracking wizard progress
-- demographics_complete already exists

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS demographics_step INTEGER DEFAULT NULL;

COMMENT ON COLUMN profiles.demographics_step IS 'Current step in demographics wizard (for resuming partial completion)';
