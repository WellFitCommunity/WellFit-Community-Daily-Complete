-- CHW kiosk device tokens (Maria approved 2026-07-23: edge-function proxy model)
--
-- The public kiosk (/kiosk/check-in) authenticates as a DEVICE, not a user:
-- each registered kiosk holds a long random token whose SHA-256 hash lives
-- here. The chw-kiosk edge function validates the presented token against
-- this hash (service-role read), then performs patient lookup / visit
-- creation / PHI audit server-side, tenant-scoped to the device's tenant.
-- Plaintext tokens are never stored — issue at registration, show once.
--
-- Live-verified before writing (Rule 18): chw_kiosk_devices exists in prod;
-- device_token_hash does not (REST probe 42703, 2026-07-23).

ALTER TABLE public.chw_kiosk_devices
  ADD COLUMN IF NOT EXISTS device_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS token_issued_at TIMESTAMPTZ;

COMMENT ON COLUMN public.chw_kiosk_devices.device_token_hash IS
  'SHA-256 hex of the kiosk device token. Validated by the chw-kiosk edge function; plaintext is never stored.';
COMMENT ON COLUMN public.chw_kiosk_devices.token_issued_at IS
  'When the current device token was issued (rotation bookkeeping).';

-- Token hashes are service-role-only. No client code selects this table
-- (grepped 2026-07-23), so revoke the broad table grant outright — a
-- column-level REVOKE would be ineffective against the table-level SELECT
-- granted in 20251226000000, and the "Anyone can view active kiosk devices"
-- policy would otherwise expose the hash to any authenticated user.
REVOKE SELECT, INSERT, UPDATE ON public.chw_kiosk_devices FROM anon, authenticated;
