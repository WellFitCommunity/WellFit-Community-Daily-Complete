#!/usr/bin/env bash
# =============================================================================
# issue-kiosk-device-token.sh — provision (or re-key) a CHW kiosk device
#
# The public kiosk (/kiosk/check-in) authenticates as a DEVICE: the chw-kiosk
# edge function validates a long random token against the SHA-256 hash stored
# on chw_kiosk_devices (migration 20260723238000). Plaintext tokens are never
# stored anywhere — this script generates one, stores ONLY its hash, and
# prints the plaintext ONCE. Paste it into the kiosk's one-time provisioning
# screen (KioskCheckIn setup step stores it in that device's localStorage).
#
# Usage:
#   bash scripts/issue-kiosk-device-token.sh <kiosk_id> "<location name>" [tenant_uuid]
#
#   kiosk_id     e.g. kiosk-library-002 (unique; re-running ROTATES the token)
#   location     e.g. "Main Street Public Library"
#   tenant_uuid  defaults to WF-0001 (2b902657-6a20-4435-a78a-576f397517ca)
#
# Requires: psql + openssl, and SUPABASE_DB_URL in .env (repo root).
# Re-keying an existing kiosk immediately invalidates its old token.
# =============================================================================
set -euo pipefail

KIOSK_ID="${1:?usage: issue-kiosk-device-token.sh <kiosk_id> \"<location name>\" [tenant_uuid]}"
LOCATION="${2:?location name required}"
TENANT="${3:-2b902657-6a20-4435-a78a-576f397517ca}"

if ! [[ "$KIOSK_ID" =~ ^[a-z0-9-]{4,64}$ ]]; then
  echo "kiosk_id must be 4-64 chars of [a-z0-9-]" >&2
  exit 1
fi

DB=$(grep -m1 '^SUPABASE_DB_URL' "$(dirname "$0")/../.env" | cut -d= -f2- | tr -d '"')
if [ -z "$DB" ]; then
  echo "SUPABASE_DB_URL not found in .env" >&2
  exit 1
fi

TOKEN=$(openssl rand -hex 32)
HASH=$(printf %s "$TOKEN" | sha256sum | cut -d' ' -f1)

psql "$DB" -v ON_ERROR_STOP=1 -q \
  -v kiosk_id="$KIOSK_ID" -v location="$LOCATION" -v tenant="$TENANT" -v hash="$HASH" <<'SQL'
INSERT INTO public.chw_kiosk_devices (kiosk_id, location_name, tenant_id, is_active, device_token_hash, token_issued_at)
VALUES (:'kiosk_id', :'location', :'tenant'::uuid, true, :'hash', now())
ON CONFLICT (kiosk_id) DO UPDATE
  SET device_token_hash = EXCLUDED.device_token_hash,
      token_issued_at   = EXCLUDED.token_issued_at,
      is_active         = true,
      updated_at        = now();
SQL

echo ""
echo "Kiosk '$KIOSK_ID' provisioned for tenant $TENANT."
echo ""
echo "  DEVICE TOKEN (shown ONCE — enter it on the kiosk's setup screen now):"
echo ""
echo "  $TOKEN"
echo ""
echo "Only the SHA-256 hash was stored. Losing the token means re-running this"
echo "script to rotate it."
