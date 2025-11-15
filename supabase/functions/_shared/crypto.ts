// Shared crypto utilities for admin PIN hashing and password hashing
// Uses Web Crypto API to avoid Node.js polyfill issues while maintaining security
//
// SECURITY: Uses cryptographically random salt per hash (16 bytes)
// Returns format: base64(salt):base64(hash) or base64(salt):hex(hash)

const ITERATIONS = 100000; // PBKDF2 iterations for security (OWASP recommended minimum)
const SALT_LENGTH = 16; // 16 bytes = 128 bits

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