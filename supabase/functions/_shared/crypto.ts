// Shared crypto utilities for admin PIN hashing and password hashing
// Uses Web Crypto API to avoid Node.js polyfill issues while maintaining security

const SALT = "wellfit_admin_pin_salt_2025_secure";
const PASSWORD_SALT = "wellfit_password_salt_2025_secure_v1";
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
 * Hash a password using PBKDF2 with SHA-256
 * More secure than bcrypt for Edge Functions (no Workers required)
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();

  // Convert password and salt to Uint8Array
  const passwordData = encoder.encode(password);
  const saltData = encoder.encode(PASSWORD_SALT);

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
 * Verify a password against a stored hash
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const newHash = await hashPassword(password);
    return newHash === storedHash;
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