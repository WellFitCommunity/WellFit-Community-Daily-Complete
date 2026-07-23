/**
 * Guardian tool-signing PUBLIC key (ES256 / ECDSA P-256 JWK).
 *
 * Provisioning (Maria's one-time local step — see the tracker, Session 2):
 *   node scripts/guardian-generate-signing-key.mjs
 * prints the PRIVATE JWK to stdout (store in password manager + the
 * GUARDIAN_SIGNING_KEY GitHub Actions secret — NEVER in this repo) and
 * rewrites this file with the matching public JWK.
 *
 * `null` = signing not yet provisioned: the registry stays in warn-only mode
 * and reports unsigned tools without rejecting them. Once a key is committed
 * here AND VITE_GUARDIAN_REQUIRE_SIGNATURES=enforce is set, unsigned or
 * tampered tools are REJECTED at registration.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

export interface GuardianSigningPublicKey {
  keyId: string;
  jwk: JsonWebKey;
}

export const GUARDIAN_SIGNING_PUBLIC_KEY: GuardianSigningPublicKey | null = null;
