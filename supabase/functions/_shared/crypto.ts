// Shared crypto utilities for admin PIN hashing
// Uses Web Crypto API to avoid Node.js polyfill issues while maintaining security

const SALT = "wellfit_admin_pin_salt_2025_secure";
const ITERATIONS = 100000; // PBKDF2 iterations for security

/**
 * Hash a PIN using PBKDF2 with SHA-256
 * More secure than simple SHA-256, resistant to rainbow table attacks
 */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();

  // Convert PIN and salt to Uint8Array
  const pinData = encoder.encode(pin);
  const saltData = encoder.encode(SALT);

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
      salt: saltData,
      iterations: ITERATIONS,
      hash: "SHA-256"
    },
    key,
    256 // 256 bits = 32 bytes
  );

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a PIN against a stored hash
 */
export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  try {
    const newHash = await hashPin(pin);
    return newHash === storedHash;
  } catch (error) {
    console.error('PIN verification error:', error);
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