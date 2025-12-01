// Shared crypto utilities for admin PIN hashing and password hashing
// Uses Web Crypto API to avoid Node.js polyfill issues while maintaining security
//
// SECURITY: Uses cryptographically random salt per hash (16 bytes)
// Returns format: base64(salt):base64(hash) or base64(salt):hex(hash)
//
// CLIENT-SIDE HASHING:
// The client sends PINs pre-hashed with SHA-256 (prefixed with 'sha256:')
// This prevents plaintext PINs from appearing in logs, dev tools, or memory dumps
// The server applies PBKDF2 to the client hash for storage security

const ITERATIONS = 100000; // PBKDF2 iterations for security (OWASP recommended minimum)
const SALT_LENGTH = 16; // 16 bytes = 128 bits

/**
 * Check if a PIN value is already client-hashed
 * Client sends PINs prefixed with 'sha256:' followed by 64 hex characters
 */
export function isClientHashedPin(value: string): boolean {
  return value.startsWith('sha256:') && value.length === 71; // 'sha256:' + 64 hex chars
}

/**
 * Extract the hash value from a client-hashed PIN
 */
export function extractClientHash(value: string): string {
  if (!isClientHashedPin(value)) {
    throw new Error('Invalid client-hashed PIN format');
  }
  return value.slice(7); // Remove 'sha256:' prefix
}

/**
 * Hash a PIN using PBKDF2 with SHA-256 and random salt
 * Returns format: base64(salt):base64(hash)
 * SECURE: Generates unique random salt per PIN
 */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();

  // Generate cryptographically random 16-byte salt
  const salt = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(salt);

  // Convert PIN to Uint8Array
  const pinData = encoder.encode(pin);

  // Import the PIN as a key for PBKDF2
  const key = await crypto.subtle.importKey(
    "raw",
    pinData,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  // Derive a 256-bit hash using PBKDF2
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: ITERATIONS,
      hash: "SHA-256"
    },
    key,
    256 // 256 bits = 32 bytes
  );

  // Convert to base64 for storage
  const hashArray = new Uint8Array(hashBuffer);
  const saltBase64 = btoa(String.fromCharCode(...salt));
  const hashBase64 = btoa(String.fromCharCode(...hashArray));

  // Return format: salt:hash (both base64 encoded)
  return `${saltBase64}:${hashBase64}`;
}

/**
 * Verify a PIN against a stored hash
 * Expects storedHash format: base64(salt):base64(hash)
 */
export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  try {
    // Split stored hash into salt and hash
    const [saltBase64, expectedHashBase64] = storedHash.split(":");
    if (!saltBase64 || !expectedHashBase64) {
      console.error('Invalid hash format - missing salt or hash');
      return false;
    }

    // Decode salt from base64
    const saltBytes = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));

    // Convert PIN to bytes
    const encoder = new TextEncoder();
    const pinBytes = encoder.encode(pin);

    // Import PIN as key material
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      pinBytes,
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );

    // Derive hash with same salt
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: saltBytes,
        iterations: ITERATIONS,
        hash: "SHA-256"
      },
      keyMaterial,
      256
    );

    // Compare hashes
    const hashArray = new Uint8Array(hashBuffer);
    const computedHashBase64 = btoa(String.fromCharCode(...hashArray));

    return computedHashBase64 === expectedHashBase64;
  } catch (error) {
    console.error('PIN verification error:', error);
    return false;
  }
}

/**
 * Hash a password using PBKDF2 with SHA-256 and random salt
 * Returns format: base64(salt):base64(hash)
 * SECURE: Generates unique random salt per password
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();

  // Generate cryptographically random 16-byte salt
  const salt = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(salt);

  // Convert password to Uint8Array
  const passwordData = encoder.encode(password);

  // Import the password as a key for PBKDF2
  const key = await crypto.subtle.importKey(
    "raw",
    passwordData,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  // Derive a 256-bit hash using PBKDF2
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: ITERATIONS,
      hash: "SHA-256"
    },
    key,
    256 // 256 bits = 32 bytes
  );

  // Convert to base64 for storage
  const hashArray = new Uint8Array(hashBuffer);
  const saltBase64 = btoa(String.fromCharCode(...salt));
  const hashBase64 = btoa(String.fromCharCode(...hashArray));

  // Return format: salt:hash (both base64 encoded)
  return `${saltBase64}:${hashBase64}`;
}

/**
 * Verify a password against a stored hash
 * Expects storedHash format: base64(salt):base64(hash)
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    // Split stored hash into salt and hash
    const [saltBase64, expectedHashBase64] = storedHash.split(":");
    if (!saltBase64 || !expectedHashBase64) {
      console.error('Invalid hash format - missing salt or hash');
      return false;
    }

    // Decode salt from base64
    const saltBytes = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));

    // Convert password to bytes
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      passwordBytes,
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );

    // Derive hash with same salt
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: saltBytes,
        iterations: ITERATIONS,
        hash: "SHA-256"
      },
      keyMaterial,
      256
    );

    // Compare hashes
    const hashArray = new Uint8Array(hashBuffer);
    const computedHashBase64 = btoa(String.fromCharCode(...hashArray));

    return computedHashBase64 === expectedHashBase64;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

/**
 * Generate a secure random token for admin sessions
 */
export function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// TOTP (Time-based One-Time Password) - RFC 6238
// ============================================================================

const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30; // seconds
const TOTP_SECRET_LENGTH = 20; // 20 bytes = 160 bits (standard)

// Base32 alphabet (RFC 4648)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encode bytes to base32 (RFC 4648)
 */
function base32Encode(buffer: Uint8Array): string {
  let result = '';
  let bits = 0;
  let value = 0;

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      bits -= 5;
      result += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
  }

  // Handle remaining bits
  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }

  return result;
}

/**
 * Decode base32 to bytes (RFC 4648)
 */
function base32Decode(encoded: string): Uint8Array {
  // Remove spaces and convert to uppercase
  const input = encoded.replace(/\s+/g, '').toUpperCase();
  const result: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of input) {
    if (char === '=') continue; // Ignore padding

    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid base32 character: ${char}`);
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      result.push((value >>> bits) & 0xff);
    }
  }

  return new Uint8Array(result);
}

/**
 * Generate a cryptographically secure TOTP secret
 * Returns base32-encoded secret suitable for authenticator apps
 */
export function generateTotpSecret(): string {
  const bytes = new Uint8Array(TOTP_SECRET_LENGTH);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

/**
 * Generate a TOTP URI for QR code scanning
 * Format: otpauth://totp/{issuer}:{account}?secret={secret}&issuer={issuer}&algorithm=SHA1&digits=6&period=30
 */
export function generateTotpUri(
  secret: string,
  accountName: string,
  issuer: string = 'Envision'
): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  const encodedSecret = encodeURIComponent(secret);

  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${encodedSecret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}

/**
 * Generate HMAC-SHA1 using Web Crypto API
 */
async function hmacSha1(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(signature);
}

/**
 * Generate a TOTP code for the current time window
 */
async function generateTotpCode(secret: string, timeStep: number): Promise<string> {
  // Decode base32 secret
  const keyBytes = base32Decode(secret);

  // Convert time step to 8-byte buffer (big-endian)
  const timeBuffer = new ArrayBuffer(8);
  const timeView = new DataView(timeBuffer);
  timeView.setBigUint64(0, BigInt(timeStep), false); // big-endian

  // Calculate HMAC-SHA1
  const hmac = await hmacSha1(keyBytes, new Uint8Array(timeBuffer));

  // Dynamic truncation (RFC 4226)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % Math.pow(10, TOTP_DIGITS);

  return code.toString().padStart(TOTP_DIGITS, '0');
}

/**
 * Verify a TOTP code against the secret
 * Allows for 1 time step drift in either direction (90 second window)
 */
export async function verifyTotpCode(
  secret: string,
  code: string,
  allowedDrift: number = 1
): Promise<boolean> {
  // Normalize code (remove spaces, ensure 6 digits)
  const normalizedCode = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalizedCode)) {
    return false;
  }

  const currentTimeStep = Math.floor(Date.now() / 1000 / TOTP_PERIOD);

  // Check current time step and allowed drift windows
  for (let i = -allowedDrift; i <= allowedDrift; i++) {
    const expectedCode = await generateTotpCode(secret, currentTimeStep + i);
    if (expectedCode === normalizedCode) {
      return true;
    }
  }

  return false;
}

/**
 * Generate 10 backup codes for TOTP recovery
 * Format: XXXX-XXXX (8 alphanumeric characters)
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  const HEX_CHARS = '0123456789ABCDEF';

  for (let i = 0; i < count; i++) {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);

    // Convert to 8 hex characters
    let code = '';
    for (const byte of bytes) {
      code += HEX_CHARS[byte >> 4];
      code += HEX_CHARS[byte & 0x0f];
    }

    // Format as XXXX-XXXX
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }

  return codes;
}

/**
 * Hash a backup code using SHA-256 for secure storage
 */
export async function hashBackupCode(code: string): Promise<string> {
  // Normalize: uppercase, remove dashes
  const normalized = code.toUpperCase().replace(/-/g, '');
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a backup code against a hashed value
 */
export async function verifyBackupCode(code: string, hashedCode: string): Promise<boolean> {
  const hash = await hashBackupCode(code);
  return hash === hashedCode;
}