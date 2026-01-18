// src/utils/offlineCrypto.ts - WebCrypto encryption for offline PHI storage
// HIPAA-compliant encryption using AES-GCM for data at rest

/**
 * Offline PHI Encryption Module
 *
 * Uses WebCrypto API with AES-256-GCM for encrypting PHI stored in IndexedDB.
 * Key derivation uses PBKDF2 with a user-specific salt.
 *
 * Security properties:
 * - AES-256-GCM provides authenticated encryption
 * - PBKDF2 with 100,000 iterations for key derivation
 * - Unique IV per encryption operation
 * - Keys are never persisted - derived fresh each session
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for GCM
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;

// In-memory key cache (never persisted)
let cachedKey: CryptoKey | null = null;
let cachedUserId: string | null = null;

/**
 * Generate a cryptographically secure random salt
 */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Generate a cryptographically secure IV
 */
function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

/**
 * Derive an encryption key from user credentials using PBKDF2
 * The key is derived from userId + a device fingerprint for binding
 */
async function deriveKey(userId: string, salt: Uint8Array): Promise<CryptoKey> {
  // Create key material from userId + device info
  const deviceFingerprint = getDeviceFingerprint();
  const keyMaterial = new TextEncoder().encode(`${userId}:${deviceFingerprint}`);

  // Import as raw key material
  const baseKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false, // not extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Get a device fingerprint for key binding
 * This makes keys device-specific (data can't be decrypted on another device)
 */
function getDeviceFingerprint(): string {
  // Combine multiple device characteristics
  const components = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset().toString(),
    screen.width.toString(),
    screen.height.toString(),
    screen.colorDepth.toString()
  ];

  // Simple hash of components
  return components.join('|');
}

/**
 * Get or create encryption key for a user
 * Keys are cached in memory for the session
 */
async function getKey(userId: string): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  // Check if we have a cached key for this user
  if (cachedKey && cachedUserId === userId) {
    // Retrieve stored salt
    const storedSalt = localStorage.getItem(`offline_salt_${userId}`);
    if (storedSalt) {
      return {
        key: cachedKey,
        salt: Uint8Array.from(atob(storedSalt), c => c.charCodeAt(0))
      };
    }
  }

  // Check for existing salt or generate new one
  let salt: Uint8Array;
  const storedSalt = localStorage.getItem(`offline_salt_${userId}`);

  if (storedSalt) {
    salt = Uint8Array.from(atob(storedSalt), c => c.charCodeAt(0));
  } else {
    salt = generateSalt();
    localStorage.setItem(`offline_salt_${userId}`, btoa(String.fromCharCode(...salt)));
  }

  // Derive and cache key
  cachedKey = await deriveKey(userId, salt);
  cachedUserId = userId;

  return { key: cachedKey, salt };
}

/**
 * Encrypt sensitive data for offline storage
 * Returns base64-encoded ciphertext with IV prepended
 */
export async function encryptForOfflineStorage(
  userId: string,
  data: Record<string, unknown>
): Promise<string> {
  const { key } = await getKey(userId);
  const iv = generateIV();

  // Serialize data to JSON
  const plaintext = new TextEncoder().encode(JSON.stringify(data));

  // Encrypt with AES-GCM
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: iv.buffer as ArrayBuffer },
    key,
    plaintext
  );

  // Combine IV + ciphertext and encode as base64
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data from offline storage
 * Expects base64-encoded ciphertext with IV prepended
 */
export async function decryptFromOfflineStorage(
  userId: string,
  encryptedData: string
): Promise<Record<string, unknown>> {
  const { key } = await getKey(userId);

  // Decode from base64
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

  // Extract IV and ciphertext
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  // Decrypt with AES-GCM
  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext.buffer as ArrayBuffer
  );

  // Parse JSON
  const decoded = new TextDecoder().decode(plaintext);
  return JSON.parse(decoded) as Record<string, unknown>;
}

/**
 * Encrypt a measurement object for offline storage
 */
export async function encryptMeasurement(
  userId: string,
  measurement: { heartRate: number; spo2: number; timestamp: number }
): Promise<string> {
  return encryptForOfflineStorage(userId, measurement);
}

/**
 * Decrypt a measurement object from offline storage
 */
export async function decryptMeasurement(
  userId: string,
  encryptedData: string
): Promise<{ heartRate: number; spo2: number; timestamp: number }> {
  const data = await decryptFromOfflineStorage(userId, encryptedData);
  return {
    heartRate: data.heartRate as number,
    spo2: data.spo2 as number,
    timestamp: data.timestamp as number
  };
}

/**
 * Clear cached encryption key (call on logout)
 */
export function clearEncryptionCache(): void {
  cachedKey = null;
  cachedUserId = null;
}

/**
 * Remove encryption salt for a user (call when wiping user data)
 */
export function removeUserEncryptionData(userId: string): void {
  localStorage.removeItem(`offline_salt_${userId}`);
  if (cachedUserId === userId) {
    clearEncryptionCache();
  }
}

/**
 * Check if WebCrypto is available
 */
export function isEncryptionAvailable(): boolean {
  return typeof crypto !== 'undefined' &&
         typeof crypto.subtle !== 'undefined' &&
         typeof crypto.getRandomValues === 'function';
}
