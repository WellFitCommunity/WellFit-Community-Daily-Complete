// src/utils/secureStorage.ts
// HIPAA-compliant client-side encryption for browser sessionStorage.
// Uses Web Crypto API AES-GCM with a random per-session key held in memory only.
//
// Threat model: protect data-at-rest in browser sessionStorage against XSS
// (an attacker reading DOM/storage cannot get the key — the key is in-memory
// only, not persisted anywhere).
//
// HIPAA § 164.312(a)(2)(iv): encryption of PHI at rest. PHI written to
// sessionStorage MUST be encrypted. The master key remains server-side
// (see `supabase/functions/phi-encrypt/index.ts`) — this module is for
// browser-only ephemeral storage encryption, NOT for at-rest PHI in the DB.
//
// Behaviour note: because the key is regenerated each page load, encrypted
// items written before a reload become unrecoverable. sessionStorage is
// already scoped to the tab/session, so this is acceptable for its intended
// use (temporary UI/session state, not durable PHI).

import { auditLogger } from '../services/auditLogger';

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits — recommended for AES-GCM

interface EncryptedData {
  ciphertext: string; // Base64-encoded
  iv: string;         // Base64-encoded initialization vector
  version: number;    // Encryption version for future upgrades
}

// Module-level cache of the per-session CryptoKey. Generated once on first
// access, held in memory only. Never persisted, never extractable.
let cachedKey: CryptoKey | null = null;
let keyPromise: Promise<CryptoKey> | null = null;

/**
 * Get or generate the per-session encryption key.
 * Random AES-256 key, non-extractable, in-memory only.
 */
function getEncryptionKey(): Promise<CryptoKey> {
  if (cachedKey) return Promise.resolve(cachedKey);
  if (keyPromise) return keyPromise;

  keyPromise = crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    false, // non-extractable — cannot be exported, even by the page itself
    ['encrypt', 'decrypt'],
  ).then((key) => {
    cachedKey = key;
    return key;
  }).catch(async (err: unknown) => {
    keyPromise = null;
    await auditLogger.error(
      'ENCRYPTION_KEY_INIT_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { module: 'secureStorage' },
    );
    throw new Error('Encryption key initialization failed');
  });

  return keyPromise;
}

async function encrypt(plaintext: string): Promise<EncryptedData> {
  try {
    const key = await getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const enc = new TextEncoder();

    const ciphertext = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      enc.encode(plaintext),
    );

    return {
      ciphertext: arrayBufferToBase64(ciphertext),
      iv: arrayBufferToBase64(iv),
      version: 2, // bumped from v1 (PBKDF2/env-derived) to v2 (random session key)
    };
  } catch (err: unknown) {
    await auditLogger.error(
      'ENCRYPTION_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { module: 'secureStorage' },
    );
    throw new Error('Encryption failed');
  }
}

async function decrypt(encryptedData: EncryptedData): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const iv = new Uint8Array(base64ToArrayBuffer(encryptedData.iv));
    const ciphertext = new Uint8Array(base64ToArrayBuffer(encryptedData.ciphertext));

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      ciphertext,
    );

    return new TextDecoder().decode(decrypted);
  } catch (err: unknown) {
    await auditLogger.error(
      'DECRYPTION_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { module: 'secureStorage' },
    );
    throw new Error('Decryption failed — data may be corrupted or written by a previous session');
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

type SecureStorageValue = string | number | boolean | null | Record<string, unknown> | unknown[];

export const secureStorage = {
  async setItem(key: string, value: SecureStorageValue): Promise<void> {
    try {
      const plaintext = typeof value === 'string' ? value : JSON.stringify(value);
      const encrypted = await encrypt(plaintext);
      sessionStorage.setItem(key, JSON.stringify(encrypted));
    } catch (err: unknown) {
      await auditLogger.error(
        'SECURE_STORAGE_SET_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { key, module: 'secureStorage' },
      );
      throw err;
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      const stored = sessionStorage.getItem(key);
      if (!stored) return null;

      const encrypted: EncryptedData = JSON.parse(stored);

      if (!encrypted.ciphertext || !encrypted.iv) {
        await auditLogger.warn('SECURE_STORAGE_INVALID_DATA', { key, module: 'secureStorage' });
        return null;
      }

      return await decrypt(encrypted);
    } catch (err: unknown) {
      await auditLogger.error(
        'SECURE_STORAGE_GET_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { key, module: 'secureStorage' },
      );
      return null;
    }
  },

  removeItem(key: string): void {
    sessionStorage.removeItem(key);
  },

  clear(): void {
    sessionStorage.clear();
  },

  hasItem(key: string): boolean {
    return sessionStorage.getItem(key) !== null;
  },
};

/**
 * Synchronous secure storage (for compatibility with existing code).
 * Uses in-memory cache to avoid async at every call site.
 */
class SyncSecureStorage {
  private cache: Map<string, string> = new Map();
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Pre-load all encrypted items into memory. Items that were encrypted
    // under a previous session's key will fail to decrypt and are silently
    // dropped (sessionStorage entries from prior pageloads can't survive
    // the random key rotation — by design).
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        try {
          const value = await secureStorage.getItem(key);
          if (value !== null) {
            this.cache.set(key, value);
          }
        } catch (err: unknown) {
          auditLogger.error(
            'SYNC_STORAGE_LOAD_FAILED',
            err instanceof Error ? err : new Error(String(err)),
            { key, module: 'syncSecureStorage' },
          ).catch(() => {});
        }
      }
    }

    this.initialized = true;
  }

  setItem(key: string, value: string): void {
    this.cache.set(key, value);
    secureStorage.setItem(key, value).catch((err) => {
      auditLogger.error(
        'SYNC_STORAGE_PERSIST_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { key, module: 'syncSecureStorage' },
      ).catch(() => {});
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

export async function initializeSecureStorage(): Promise<void> {
  try {
    const testData = 'secure-storage-test';
    const encrypted = await encrypt(testData);
    const decrypted = await decrypt(encrypted);

    if (decrypted !== testData) {
      throw new Error('Encryption self-test failed');
    }

    await syncSecureStorage.initialize();
    await auditLogger.info('SECURE_STORAGE_INITIALIZED', { module: 'secureStorage' });
  } catch (err: unknown) {
    await auditLogger.error(
      'SECURE_STORAGE_INIT_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { module: 'secureStorage' },
    );
    throw err;
  }
}

// Export for testing
export const __testing__ = {
  encrypt,
  decrypt,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  resetKeyForTests: () => {
    cachedKey = null;
    keyPromise = null;
  },
};
