-- Enable pgcrypto extension for PHI encryption (HIPAA § 164.312(a)(2)(iv))
-- This extension provides cryptographic functions including AES-256 encryption

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Verify extension is enabled
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    RAISE EXCEPTION 'pgcrypto extension failed to install';
  END IF;
END
$$;
