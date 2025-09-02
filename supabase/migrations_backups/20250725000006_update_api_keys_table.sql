-- Update the api_keys table for secure hash storage and additional tracking fields

-- Add api_key_hash column if it doesn't exist
ALTER TABLE public.api_keys
ADD COLUMN IF NOT EXISTS api_key_hash TEXT;

-- Populate api_key_hash from existing api_key if necessary (ONE-TIME MIGRATION)
-- This assumes existing keys were plaintext. If they were already hashes, skip this.
-- After this, the original api_key column should be dropped.
-- Example: UPDATE public.api_keys SET api_key_hash = encode(sha256(api_key::bytea), 'hex') WHERE api_key IS NOT NULL AND api_key_hash IS NULL;
-- IMPORTANT: This is a placeholder for a hashing strategy if plaintext keys existed.
-- Since new keys are generated with hash by the function, this might only apply to legacy keys.
-- For a fresh setup, this UPDATE is not needed.

-- Add a unique constraint to api_key_hash if desired, to prevent duplicate hashes (and thus keys)
-- Note: hash collisions are theoretically possible but extremely rare for SHA256.
-- A unique constraint might be overkill unless an exact key needs to be unique.
-- ALTER TABLE public.api_keys
-- ADD CONSTRAINT IF NOT EXISTS unique_api_key_hash UNIQUE (api_key_hash);

-- Drop the old plaintext api_key column if it exists
ALTER TABLE public.api_keys
DROP COLUMN IF EXISTS api_key;

-- Add created_by column to track who generated the key
-- Assuming it references auth.users.id. Adjust if it references profiles.id
ALTER TABLE public.api_keys
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add usage_count column
ALTER TABLE public.api_keys
ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0 NOT NULL;

-- Add last_used column
ALTER TABLE public.api_keys
ADD COLUMN IF NOT EXISTS last_used TIMESTAMPTZ;

-- Ensure 'active' column has a default if it doesn't
ALTER TABLE public.api_keys
ALTER COLUMN active SET DEFAULT TRUE;

-- Add any necessary indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_created_by ON public.api_keys(created_by);
CREATE INDEX IF NOT EXISTS idx_api_keys_org_name ON public.api_keys(org_name); -- If queried by org_name often

COMMENT ON COLUMN public.api_keys.api_key_hash IS 'SHA-256 hash of the API key.';
COMMENT ON COLUMN public.api_keys.created_by IS 'User ID of the admin who generated the key.';
COMMENT ON COLUMN public.api_keys.usage_count IS 'How many times the API key has been used.';
COMMENT ON COLUMN public.api_keys.last_used IS 'Timestamp of the last time the API key was used.';
