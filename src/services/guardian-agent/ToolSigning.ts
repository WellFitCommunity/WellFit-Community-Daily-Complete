/**
 * ToolSigning — ES256 signatures over Guardian tool checksums (Session 2).
 *
 * Threat model: a dynamically registered or tampered tool (the parked
 * "marketplace" surface, or a compromised bundle mutating an executor) must
 * not be accepted by the ToolRegistry. Every first-party tool's checksum is
 * signed offline with a private key that never ships to the browser; the
 * registry verifies with the committed public key before accepting.
 *
 * Modes:
 *   'off'     — no public key provisioned (guardianSigningKey.ts is null):
 *               verification reports unsigned tools but registration proceeds.
 *   'warn'    — key provisioned, VITE_GUARDIAN_REQUIRE_SIGNATURES != 'enforce':
 *               invalid/unsigned tools log a loud warning + security alert but register.
 *   'enforce' — key provisioned + flag set: invalid/unsigned tools are REJECTED.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { auditLogger } from '../auditLogger';
import { GUARDIAN_SIGNING_PUBLIC_KEY } from './guardianSigningKey';
import toolSignatures from './guardianToolSignatures.json';

export interface ToolSignatureRecord {
  /** base64url ES256 signature over the tool checksum string */
  signature: string;
  keyId: string;
  signedAt: string;
}

export type SigningMode = 'off' | 'warn' | 'enforce';

export interface SignatureVerdict {
  valid: boolean;
  mode: SigningMode;
  reason?: string;
}

const SIGNATURE_MAP = toolSignatures as Record<string, ToolSignatureRecord>;

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function getSigningMode(): SigningMode {
  if (!GUARDIAN_SIGNING_PUBLIC_KEY) return 'off';
  // Direct property access — Vite statically replaces import.meta.env.* at
  // build time; indirect access would silently read undefined in prod bundles.
  const flag = import.meta.env?.VITE_GUARDIAN_REQUIRE_SIGNATURES;
  return flag === 'enforce' ? 'enforce' : 'warn';
}

let cachedKey: CryptoKey | null = null;

async function importPublicKey(): Promise<CryptoKey | null> {
  if (!GUARDIAN_SIGNING_PUBLIC_KEY) return null;
  if (cachedKey) return cachedKey;
  cachedKey = await crypto.subtle.importKey(
    'jwk',
    GUARDIAN_SIGNING_PUBLIC_KEY.jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );
  return cachedKey;
}

/**
 * Look up the signature record for a tool (metadata-carried record wins over
 * the committed signature map).
 */
export function getSignatureRecord(
  toolId: string,
  metadataSignature?: ToolSignatureRecord
): ToolSignatureRecord | undefined {
  return metadataSignature ?? SIGNATURE_MAP[toolId];
}

/**
 * Verify a tool's ES256 signature over its checksum.
 * Never throws — returns a verdict the registry acts on per mode.
 */
export async function verifyToolSignature(
  toolId: string,
  checksum: string,
  metadataSignature?: ToolSignatureRecord
): Promise<SignatureVerdict> {
  const mode = getSigningMode();
  if (mode === 'off') {
    return { valid: false, mode, reason: 'signing key not provisioned' };
  }

  const record = getSignatureRecord(toolId, metadataSignature);
  if (!record) {
    return { valid: false, mode, reason: `no signature on file for tool ${toolId}` };
  }
  if (GUARDIAN_SIGNING_PUBLIC_KEY && record.keyId !== GUARDIAN_SIGNING_PUBLIC_KEY.keyId) {
    return { valid: false, mode, reason: `signature keyId ${record.keyId} does not match the provisioned key` };
  }

  try {
    const key = await importPublicKey();
    if (!key) return { valid: false, mode, reason: 'public key import failed' };

    const sigBytes = base64UrlToBytes(record.signature);
    const data = new TextEncoder().encode(checksum);
    // BufferSource boundary casts — lib types Uint8Array<ArrayBufferLike> are
    // not accepted by the WebCrypto typings though they are BufferSource at
    // runtime (same class as the admin-totp fix, 6f61c381).
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      sigBytes as BufferSource,
      data as BufferSource
    );
    return ok
      ? { valid: true, mode }
      : { valid: false, mode, reason: 'signature does not match checksum (tampered or re-signed needed)' };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('GUARDIAN_TOOL_SIGNATURE_VERIFY_ERROR', error, { toolId });
    return { valid: false, mode, reason: `verification error: ${error.message}` };
  }
}
