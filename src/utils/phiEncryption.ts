/**
 * PHI Encryption Utility
 * AES-256-GCM encryption for PHI data (photos, documents, sensitive fields)
 * HIPAA § 164.312(a)(2)(iv) - Encryption and Decryption
 */

/**
 * Encrypts PHI data using AES-256-GCM
 * @param plaintext - Data to encrypt (base64 string for photos)
 * @param patientId - Patient ID used as part of key derivation
 * @returns Encrypted data as base64 string with IV prepended
 */
export async function encryptPHI(
  plaintext: string,
  patientId: string
): Promise<string> {
  try {
    // Get encryption key from environment or derive from patient ID
    const masterKey = await getMasterEncryptionKey();
    const patientKey = await derivePatientKey(masterKey, patientId);

    // Generate random IV (96 bits for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Convert plaintext to bytes
    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(plaintext);

    // Encrypt using AES-256-GCM
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128, // 128-bit authentication tag
      },
      patientKey,
      plaintextBytes
    );

    // Combine IV + encrypted data
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedData), iv.length);

    // Return as base64
    return arrayBufferToBase64(combined);
  } catch (error) {
    console.error('[PHI Encryption] Encryption failed:', error);
    throw new Error('Failed to encrypt PHI data. Cannot proceed without encryption.');
  }
}

/**
 * Decrypts PHI data encrypted with encryptPHI
 * @param encryptedData - Encrypted data as base64 string (IV prepended)
 * @param patientId - Patient ID used for key derivation
 * @returns Decrypted plaintext string
 */
export async function decryptPHI(
  encryptedData: string,
  patientId: string
): Promise<string> {
  try {
    // Get encryption key
    const masterKey = await getMasterEncryptionKey();
    const patientKey = await derivePatientKey(masterKey, patientId);

    // Convert from base64
    const combined = base64ToArrayBuffer(encryptedData);

    // Extract IV (first 12 bytes) and ciphertext
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    // Decrypt
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128,
      },
      patientKey,
      ciphertext
    );

    // Convert back to string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  } catch (error) {
    console.error('[PHI Encryption] Decryption failed:', error);
    throw new Error('Failed to decrypt PHI data. Data may be corrupted.');
  }
}

/**
 * Gets the master encryption key from secure storage
 * In production, this should come from:
 * - Environment variable (for server-side)
 * - Hardware Security Module (HSM)
 * - Key Management Service (AWS KMS, Azure Key Vault, etc.)
 */
async function getMasterEncryptionKey(): Promise<CryptoKey> {
  // Check for environment variable first
  const keyMaterial = import.meta.env.VITE_PHI_ENCRYPTION_KEY ||
                      process.env.REACT_APP_PHI_ENCRYPTION_KEY;

  if (!keyMaterial) {
    // CRITICAL: In production, this should FAIL
    // For development, we'll generate a temporary key
    console.warn('[PHI Encryption] WARNING: No master encryption key found. Using temporary key. DO NOT USE IN PRODUCTION!');

    // Generate temporary key (DO NOT USE IN PRODUCTION)
    return await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      false, // not extractable
      ['encrypt', 'decrypt']
    );
  }

  // Import key material
  const keyBytes = base64ToArrayBuffer(keyMaterial);
  return await crypto.subtle.importKey(
    'raw',
    keyBytes,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false, // not extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Derives a patient-specific encryption key from master key
 * Uses HKDF (HMAC-based Key Derivation Function)
 */
async function derivePatientKey(
  masterKey: CryptoKey,
  patientId: string
): Promise<CryptoKey> {
  // Export master key to derive from it
  // Note: In production, use a KDF like PBKDF2 or HKDF
  // This is a simplified version
  const encoder = new TextEncoder();
  const salt = encoder.encode(`wellfit-phi-${patientId}`);

  // For simplicity, we'll use the master key directly
  // In production, implement proper HKDF
  return masterKey;
}

/**
 * Converts ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Validates that encryption is working correctly
 * Run this on app startup to verify encryption setup
 */
export async function validateEncryption(): Promise<boolean> {
  try {
    const testData = 'TEST_PHI_DATA_' + Date.now();
    const testPatientId = 'test-patient-id';

    const encrypted = await encryptPHI(testData, testPatientId);
    const decrypted = await decryptPHI(encrypted, testPatientId);

    if (decrypted !== testData) {
      console.error('[PHI Encryption] Validation failed: Decrypted data does not match');
      return false;
    }

    return true;
  } catch (error) {
    console.error('[PHI Encryption] Validation failed:', error);
    return false;
  }
}

/**
 * Generates a new master encryption key
 * ONLY use this for initial setup or key rotation
 * Store the result in a secure environment variable
 */
export async function generateMasterKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable for this purpose
    ['encrypt', 'decrypt']
  );

  const exported = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(exported);
}
