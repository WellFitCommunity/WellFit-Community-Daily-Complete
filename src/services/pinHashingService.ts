/**
 * PIN Hashing Service
 *
 * HIPAA Compliance: § 164.312(a)(2)(iv) - Encryption and Decryption
 *
 * This service provides client-side PIN hashing before transmission to prevent
 * plaintext PINs from appearing in:
 * - Network request bodies (visible in dev tools, proxies)
 * - Server access logs
 * - Memory dumps
 *
 * Security Architecture:
 * 1. Client hashes PIN using SHA-256 before transmission
 * 2. Server receives hashed value, never sees plaintext
 * 3. Server applies PBKDF2 to the client hash for storage
 *
 * This provides defense-in-depth: even if TLS is compromised, the actual PIN
 * is protected by the client-side hash.
 */

import { supabase } from '../lib/supabaseClient';

/**
 * Hash a PIN locally using Web Crypto API SHA-256
 * This is a "pre-hash" before transmission - NOT for storage
 *
 * The server will apply additional PBKDF2 hashing with salt for storage security.
 *
 * @param pin - The plaintext PIN (4-8 digits for admin, 4 digits for caregiver)
 * @returns A SHA-256 hash hex string prefixed with 'sha256:' to indicate format
 */
export async function hashPinForTransmission(pin: string): Promise<string> {
  // Validate PIN format (numbers only, 4-8 digits for admin)
  if (!/^\d{4,8}$/.test(pin)) {
    throw new Error('PIN must be 4-8 digits');
  }

  const encoder = new TextEncoder();
  // Add a domain separator to prevent cross-context attacks
  const data = encoder.encode(`wellfit-admin-pin-v1:${pin}`);

  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Prefix to indicate this is a client-hashed value
  return `sha256:${hashHex}`;
}

/**
 * Hash a PIN for admin verification
 * Combines client-side hashing with optional tenant code
 *
 * @param pin - The plaintext PIN or TenantCode-PIN format
 * @returns Object containing the hashed PIN and any tenant code
 */
export async function prepareAdminPinForVerification(pin: string): Promise<{
  hashedPin: string;
  tenantCode: string | null;
  format: 'pin_only' | 'tenant_code_pin';
}> {
  // Check for TenantCode-PIN format (e.g., "MH-6702-1234")
  const tenantCodePinPattern = /^([A-Z]{1,4})-([0-9]{4,6})-([0-9]{4,8})$/;
  const match = pin.match(tenantCodePinPattern);

  if (match) {
    // TenantCode-PIN format
    const tenantCode = `${match[1]}-${match[2]}`; // e.g., "MH-6702"
    const numericPin = match[3]; // e.g., "1234"
    const hashedPin = await hashPinForTransmission(numericPin);

    return {
      hashedPin,
      tenantCode,
      format: 'tenant_code_pin'
    };
  }

  // Simple numeric PIN
  if (!/^\d{4,8}$/.test(pin)) {
    throw new Error('PIN must be 4-8 digits or TENANTCODE-PIN format');
  }

  const hashedPin = await hashPinForTransmission(pin);
  return {
    hashedPin,
    tenantCode: null,
    format: 'pin_only'
  };
}

/**
 * Hash a PIN for storage (during PIN setup)
 * Uses the hash-pin edge function for consistent PBKDF2 hashing
 *
 * @param pin - The plaintext PIN
 * @returns The PBKDF2 hash for storage
 */
export async function hashPinForStorage(pin: string): Promise<string> {
  // First hash locally
  const clientHash = await hashPinForTransmission(pin);

  // Then send to hash-pin edge function for PBKDF2 processing
  const { data, error } = await supabase.functions.invoke('hash-pin', {
    body: { pin: clientHash }
  });

  if (error) {
    throw new Error(`Failed to hash PIN: ${error.message}`);
  }

  return data.hashed;
}

/**
 * Check if a PIN value is already client-hashed
 */
export function isClientHashedPin(value: string): boolean {
  return value.startsWith('sha256:') && value.length === 71; // 'sha256:' + 64 hex chars
}
