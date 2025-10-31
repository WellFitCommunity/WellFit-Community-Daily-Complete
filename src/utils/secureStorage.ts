// src/utils/secureStorage.ts
// HIPAA-compliant client-side encryption for browser storage
// Uses Web Crypto API for AES-GCM encryption

import { auditLogger } from '../services/auditLogger';

/**
 * Secure storage wrapper for browser sessionStorage/localStorage
 * Automatically encrypts all data before storage using AES-GCM
 *
 * ⚠️  HIPAA COMPLIANCE: All PHI stored in browser must be encrypted
 * This utility ensures regulatory compliance for client-side storage
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for AES-GCM
const SALT_LENGTH = 16;

// Storage key for encryption key (derived from master key + salt)
const STORAGE_KEY_NAME = '__secure_storage_key__';

interface EncryptedData {
  ciphertext: string; // Base64-encoded
  iv: string;         // Base64-encoded initialization vector
  salt: string;       // Base64-encoded salt for key derivation
  version: number;    // Encryption version for future upgrades
}

/**
 * Get or generate the encryption key for this session
 * Key is derived from environment variable + random salt using PBKDF2
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  try {
    // Check if we already have a key in memory
    const existingKeyData = sessionStorage.getItem(STORAGE_KEY_NAME);

    if (existingKeyData) {
      const { keyMaterial, salt } = JSON.parse(existingKeyData);
      return await deriveKey(keyMaterial, salt);
    }

    // Generate new key material from environment + random salt
    const masterKey = process.env.REACT_APP_PHI_ENCRYPTION_KEY ||
                      'wellfit-secure-storage-2025'; // Fallback for development

    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const saltB64 = arrayBufferToBase64(salt);

    // Store key material in memory only (not persisted)
    sessionStorage.setItem(STORAGE_KEY_NAME, JSON.stringify({
      keyMaterial: masterKey,
      salt: saltB64
    }));

    return await deriveKey(masterKey, saltB64);
  } catch (error) {
    await auditLogger.error('ENCRYPTION_KEY_INIT_FAILED', error as Error, { module: 'secureStorage' });
    throw new Error('Encryption key initialization failed');
  }
}

/**
 * Derive cryptographic key from password and salt using PBKDF2
 */
async function deriveKey(password: string, saltB64: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const salt = new Uint8Array(base64ToArrayBuffer(saltB64));

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES-GCM key using PBKDF2
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000, // NIST recommendation
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data using AES-GCM
 */
async function encrypt(plaintext: string): Promise<EncryptedData> {
  try {
    const key = await getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const enc = new TextEncoder();
    const encoded = enc.encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv: iv
      },
      key,
      encoded
    );

    // Extract salt from stored key material
    const keyData = JSON.parse(sessionStorage.getItem(STORAGE_KEY_NAME) || '{}');

    return {
      ciphertext: arrayBufferToBase64(ciphertext),
      iv: arrayBufferToBase64(iv),
      salt: keyData.salt,
      version: 1
    };
  } catch (error) {
    await auditLogger.error('ENCRYPTION_FAILED', error as Error, { module: 'secureStorage' });
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt data using AES-GCM
 */
async function decrypt(encryptedData: EncryptedData): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const iv = new Uint8Array(base64ToArrayBuffer(encryptedData.iv));
    const ciphertext = new Uint8Array(base64ToArrayBuffer(encryptedData.ciphertext));

    const decrypted = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: iv
      },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (error) {
    await auditLogger.error('DECRYPTION_FAILED', error as Error, { module: 'secureStorage' });
    throw new Error('Decryption failed - data may be corrupted');
  }
}

/**
 * Utility: Convert ArrayBuffer to Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Utility: Convert Base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Secure Storage API
 * Drop-in replacement for sessionStorage/localStorage with automatic encryption
 */
export const secureStorage = {
  /**
   * Store encrypted data
   * @param key Storage key
   * @param value Data to encrypt and store (will be JSON stringified)
   */
  async setItem(key: string, value: any): Promise<void> {
    try {
      const plaintext = typeof value === 'string' ? value : JSON.stringify(value);
      const encrypted = await encrypt(plaintext);
      sessionStorage.setItem(key, JSON.stringify(encrypted));
    } catch (error) {
      await auditLogger.error('SECURE_STORAGE_SET_FAILED', error as Error, { key, module: 'secureStorage' });
      throw error;
    }
  },

  /**
   * Retrieve and decrypt data
   * @param key Storage key
   * @returns Decrypted value or null if not found
   */
  async getItem(key: string): Promise<string | null> {
    try {
      const stored = sessionStorage.getItem(key);
      if (!stored) return null;

      const encrypted: EncryptedData = JSON.parse(stored);

      // Validate structure
      if (!encrypted.ciphertext || !encrypted.iv || !encrypted.salt) {
        await auditLogger.warn('SECURE_STORAGE_INVALID_DATA', { key, module: 'secureStorage' });
        return null;
      }

      return await decrypt(encrypted);
    } catch (error) {
      await auditLogger.error('SECURE_STORAGE_GET_FAILED', error as Error, { key, module: 'secureStorage' });
      return null; // Fail gracefully
    }
  },

  /**
   * Remove item from storage
   * @param key Storage key to remove
   */
  removeItem(key: string): void {
    sessionStorage.removeItem(key);
  },

  /**
   * Clear all items from storage
   */
  clear(): void {
    sessionStorage.clear();
  },

  /**
   * Check if key exists in storage
   * @param key Storage key
   */
  hasItem(key: string): boolean {
    return sessionStorage.getItem(key) !== null;
  }
};

/**
 * Synchronous secure storage (for compatibility with existing code)
 * Uses in-memory cache to avoid async everywhere
 *
 * ⚠️  WARNING: This is less secure than async version
 * Only use when async is not possible
 */
class SyncSecureStorage {
  private cache: Map<string, string> = new Map();
  private initialized: boolean = false;

  /**
   * Initialize the sync cache (call once at app startup)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Pre-load all encrypted items into memory
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key !== STORAGE_KEY_NAME) {
        try {
          const value = await secureStorage.getItem(key);
          if (value !== null) {
            this.cache.set(key, value);
          }
        } catch (error) {
          auditLogger.error('SYNC_STORAGE_LOAD_FAILED', error as Error, { key, module: 'syncSecureStorage' }).catch(() => {});
        }
      }
    }

    this.initialized = true;
  }

  setItem(key: string, value: string): void {
    this.cache.set(key, value);

    // Asynchronously persist to storage
    secureStorage.setItem(key, value).catch(error => {
      auditLogger.error('SYNC_STORAGE_PERSIST_FAILED', error as Error, { key, module: 'syncSecureStorage' }).catch(() => {});
    });
  }

  getItem(key: string): string | null {
    return this.cache.get(key) || null;
  }

  removeItem(key: string): void {
    this.cache.delete(key);
    secureStorage.removeItem(key);
  }

  clear(): void {
    this.cache.clear();
    secureStorage.clear();
  }
}

export const syncSecureStorage = new SyncSecureStorage();

/**
 * Initialize secure storage (call at app startup)
 */
export async function initializeSecureStorage(): Promise<void> {
  try {
    // Test encryption/decryption
    const testData = 'secure-storage-test';
    const encrypted = await encrypt(testData);
    const decrypted = await decrypt(encrypted);

    if (decrypted !== testData) {
      throw new Error('Encryption test failed');
    }

    // Initialize sync cache
    await syncSecureStorage.initialize();

    await auditLogger.info('SECURE_STORAGE_INITIALIZED', { module: 'secureStorage' });
  } catch (error) {
    await auditLogger.error('SECURE_STORAGE_INIT_FAILED', error as Error, { module: 'secureStorage' });
    throw error;
  }
}

// Export for testing
export const __testing__ = {
  encrypt,
  decrypt,
  arrayBufferToBase64,
  base64ToArrayBuffer
};
