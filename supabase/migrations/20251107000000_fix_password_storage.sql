-- Rename password_hash to password_plaintext for clarity
-- This is temporary storage (24h max) for pending verification
-- Service-role only, never exposed to clients
ALTER TABLE public.pending_registrations 
  RENAME COLUMN password_hash TO password_plaintext;

COMMENT ON COLUMN public.pending_registrations.password_plaintext IS 
  'Temporary plaintext password storage pending phone verification. Expires in 24h. Service-role only.';
