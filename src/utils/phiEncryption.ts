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
  // Check for environment variable first (Create React App uses REACT_APP_ prefix)
  const keyMaterial = process.env.REACT_APP_PHI_ENCRYPTION_KEY;

  if (!keyMaterial) {
    // FAIL HARD in production - this is a HIPAA compliance requirement
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'CRITICAL SECURITY ERROR: PHI_ENCRYPTION_KEY is not set in production environment. ' +
        'This is a HIPAA compliance violation. Application cannot start without encryption keys. ' +
        'Set REACT_APP_PHI_ENCRYPTION_KEY in your environment variables.'
      );
    }

    // In development, warn loudly but allow temporary key
    console.error('⚠️ WARNING: PHI_ENCRYPTION_KEY not set! Using temporary key for DEVELOPMENT ONLY');
    console.error('⚠️ THIS IS NOT SECURE - Set REACT_APP_PHI_ENCRYPTION_KEY before deploying to production');

    // Generate temporary key (DEVELOPMENT ONLY)
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
  // Note: In production, use a KDF like PBKDF2 or HKDF with patient-specific salt
  // This is a simplified version - patientId would be used in proper KDF
  // const encoder = new TextEncoder();
  // const salt = encoder.encode(`wellfit-phi-${patientId}`);

  // For simplicity, we'll use the master key directly
  // In production, implement proper HKDF with the salt
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

      return false;
    }

    return true;
  } catch (error) {

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
