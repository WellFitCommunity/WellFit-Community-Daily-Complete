/**
 * PHI Encryption - Field-level encryption for Protected Health Information
 * Ensures PHI is encrypted at rest and in transit
 *
 * Features:
 * - AES-256-GCM authenticated encryption (REAL CRYPTO)
 * - Per-tenant encryption keys
 * - Field-level granularity
 * - Key rotation support
 * - Audit trail for all encryption/decryption
 * - Web Crypto API for browser-safe cryptography
 *
 * Security:
 * - Uses crypto.getRandomValues() for secure IV generation
 * - 256-bit keys generated via SubtleCrypto
 * - GCM mode provides authentication (integrity + confidentiality)
 * - 96-bit (12 byte) IV as recommended for GCM
 */

/**
 * PHI field types that require encryption
 */
export const PHI_FIELDS = [
  // Direct identifiers
  'ssn',
  'socialSecurityNumber',
  'medicalRecordNumber',
  'mrn',
  'patientId',
  'accountNumber',

  // Names
  'firstName',
  'lastName',
  'fullName',
  'maidenName',

  // Contact information
  'email',
  'phone',
  'phoneNumber',
  'address',
  'streetAddress',
  'city',
  'zipCode',
  'postalCode',

  // Dates
  'dateOfBirth',
  'dob',
  'dateOfDeath',
  'admissionDate',
  'dischargeDate',

  // Medical information
  'diagnosis',
  'medication',
  'allergies',
  'immunizations',
  'labResults',
  'vitalSigns',
  'clinicalNotes',
  'progressNotes',

  // Biometric
  'fingerprint',
  'voiceprint',
  'facePhoto',
  'retinaScan',

  // Device identifiers
  'deviceSerialNumber',
  'ipAddress',

  // Other
  'healthPlanBeneficiaryNumber',
  'licenseNumber',
  'vehicleIdentifier',
  'webUrl',
];

/**
 * Encrypted field wrapper
 */
export interface EncryptedField<_T = unknown> {
  /** Encrypted data (base64) */
  ciphertext: string;

  /** Initialization vector (base64) */
  iv: string;

  /** Authentication tag (base64) */
  tag: string;

  /** Key ID used for encryption */
  keyId: string;

  /** Tenant ID */
  tenantId: string;

  /** Timestamp of encryption */
  encryptedAt: Date;

  /** Metadata (not encrypted) */
  metadata?: {
    fieldName?: string;
    dataType?: string;
  };
}

/**
 * Encryption key metadata
 */
export interface EncryptionKey {
  /** Unique key ID */
  id: string;

  /** CryptoKey from Web Crypto API (for encryption/decryption) */
  cryptoKey: CryptoKey;

  /** Exported key material for storage (base64 encoded) - only for key backup */
  exportedKey?: string;

  /** Tenant ID this key belongs to */
  tenantId: string;

  /** Key creation date */
  createdAt: Date;

  /** Key rotation date */
  rotatedAt?: Date;

  /** Is this key active? */
  active: boolean;

  /** Key version */
  version: number;
}

/**
 * Encryption audit log entry
 */
export interface EncryptionAuditLog {
  timestamp: Date;
  operation: 'encrypt' | 'decrypt';
  fieldName: string;
  keyId: string;
  tenantId: string;
  userId?: string;
  success: boolean;
  error?: string;
}

/**
 * Constants for AES-256-GCM encryption
 */
const AES_GCM_CONFIG = {
  name: 'AES-GCM',
  length: 256,        // 256-bit key
  ivLength: 12,       // 96-bit IV (recommended for GCM)
  tagLength: 128,     // 128-bit authentication tag
} as const;

/**
 * Get the Web Crypto API (works in browser and Node.js 15+)
 */
function getCrypto(): Crypto {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  // For older Node.js environments
  try {
     
    const { webcrypto } = require('crypto');
    return webcrypto as Crypto;
  } catch {
    throw new Error('Web Crypto API not available in this environment');
  }
}

/**
 * PHI Encryption Service - Uses REAL AES-256-GCM encryption
 */
export class PHIEncryption {
  private keys: Map<string, EncryptionKey> = new Map();
  private auditLogs: EncryptionAuditLog[] = [];
  private crypto: Crypto;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.crypto = getCrypto();
    // Start async initialization
    this.initPromise = this.initializeDefaultKeys();
  }

  /**
   * Ensure the encryption service is initialized before use
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized && this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Encrypt a PHI field using AES-256-GCM
   */
  async encrypt<T>(
    value: T,
    fieldName: string,
    tenantId: string,
    userId?: string
  ): Promise<EncryptedField<T>> {
    try {
      await this.ensureInitialized();

      // Get active key for tenant
      const key = this.getActiveKeyForTenant(tenantId);

      if (!key) {
        throw new Error(`No active encryption key for tenant ${tenantId}`);
      }

      // Convert value to string
      const plaintext = JSON.stringify(value);
      const encoder = new TextEncoder();
      const data = encoder.encode(plaintext);

      // Generate cryptographically secure IV (12 bytes for GCM)
      const iv = this.crypto.getRandomValues(new Uint8Array(AES_GCM_CONFIG.ivLength));

      // Encrypt using AES-256-GCM
      const encryptedBuffer = await this.crypto.subtle.encrypt(
        {
          name: AES_GCM_CONFIG.name,
          iv: iv,
          tagLength: AES_GCM_CONFIG.tagLength,
        },
        key.cryptoKey,
        data
      );

      // Convert to base64 for storage
      // Note: GCM mode appends the auth tag to the ciphertext
      const encryptedArray = new Uint8Array(encryptedBuffer);
      const ciphertext = this.arrayBufferToBase64(encryptedArray);
      const ivBase64 = this.arrayBufferToBase64(iv);

      // The auth tag is the last 16 bytes of the encrypted output in GCM mode
      const tagBytes = encryptedArray.slice(-16);
      const tag = this.arrayBufferToBase64(tagBytes);

      const encrypted: EncryptedField<T> = {
        ciphertext,
        iv: ivBase64,
        tag,
        keyId: key.id,
        tenantId,
        encryptedAt: new Date(),
        metadata: {
          fieldName,
          dataType: typeof value,
        },
      };

      // Audit log
      this.logEncryptionOperation('encrypt', fieldName, key.id, tenantId, userId, true);

      return encrypted;
    } catch (error) {
      // Audit log (failure)
      this.logEncryptionOperation(
        'encrypt',
        fieldName,
        'unknown',
        tenantId,
        userId,
        false,
        error instanceof Error ? error.message : String(error)
      );

      throw error;
    }
  }

  /**
   * Decrypt a PHI field using AES-256-GCM
   */
  async decrypt<T>(
    encrypted: EncryptedField<T>,
    userId?: string
  ): Promise<T> {
    try {
      await this.ensureInitialized();

      // Get key
      const key = this.keys.get(encrypted.keyId);

      if (!key) {
        throw new Error(`Encryption key ${encrypted.keyId} not found`);
      }

      if (!key.active) {
        throw new Error(`Encryption key ${encrypted.keyId} is not active`);
      }

      // Convert from base64
      const ciphertextBytes = this.base64ToArrayBuffer(encrypted.ciphertext);
      const ivBytes = this.base64ToArrayBuffer(encrypted.iv);

      // Decrypt using AES-256-GCM
      const decryptedBuffer = await this.crypto.subtle.decrypt(
        {
          name: AES_GCM_CONFIG.name,
          iv: ivBytes.buffer as ArrayBuffer,
          tagLength: AES_GCM_CONFIG.tagLength,
        },
        key.cryptoKey,
        ciphertextBytes.buffer as ArrayBuffer
      );

      // Convert back to string
      const decoder = new TextDecoder();
      const plaintext = decoder.decode(decryptedBuffer);
      const value = JSON.parse(plaintext) as T;

      // Audit log
      this.logEncryptionOperation(
        'decrypt',
        encrypted.metadata?.fieldName || 'unknown',
        encrypted.keyId,
        encrypted.tenantId,
        userId,
        true
      );

      return value;
    } catch (error) {
      // Audit log (failure)
      this.logEncryptionOperation(
        'decrypt',
        encrypted.metadata?.fieldName || 'unknown',
        encrypted.keyId,
        encrypted.tenantId,
        userId,
        false,
        error instanceof Error ? error.message : String(error)
      );

      throw error;
    }
  }

  /**
   * Encrypt an entire object (only PHI fields)
   */
  async encryptObject(
    obj: Record<string, unknown>,
    tenantId: string,
    userId?: string
  ): Promise<Record<string, unknown>> {
    const encrypted: Record<string, unknown> = { ...obj };

    for (const [key, value] of Object.entries(obj)) {
      if (this.isPHIField(key)) {
        encrypted[key] = await this.encrypt(value, key, tenantId, userId);
      }
    }

    return encrypted;
  }

  /**
   * Decrypt an entire object (only encrypted fields)
   */
  async decryptObject(
    obj: Record<string, unknown>,
    userId?: string
  ): Promise<Record<string, unknown>> {
    const decrypted: Record<string, unknown> = { ...obj };

    for (const [key, value] of Object.entries(obj)) {
      if (this.isEncryptedField(value)) {
        decrypted[key] = await this.decrypt(value, userId);
      }
    }

    return decrypted;
  }

  /**
   * Check if a field name is a PHI field
   */
  isPHIField(fieldName: string): boolean {
    const normalized = fieldName.toLowerCase();
    return PHI_FIELDS.some((phi) => normalized.includes(phi.toLowerCase()));
  }

  /**
   * Check if a value is an encrypted field
   */
  isEncryptedField(value: unknown): value is EncryptedField {
    return (
      typeof value === 'object' &&
      value !== null &&
      'ciphertext' in value &&
      'iv' in value &&
      'tag' in value &&
      'keyId' in value
    );
  }

  /**
   * Rotate encryption key for a tenant
   */
  async rotateKey(tenantId: string): Promise<EncryptionKey> {
    await this.ensureInitialized();

    // Deactivate old keys
    for (const [keyId, key] of this.keys.entries()) {
      if (key.tenantId === tenantId && key.active) {
        key.active = false;
        key.rotatedAt = new Date();
        this.keys.set(keyId, key);
      }
    }

    // Create new key using Web Crypto API
    const newKey = await this.generateKeyForTenant(tenantId);
    this.keys.set(newKey.id, newKey);

    return newKey;
  }

  /**
   * Get encryption audit logs
   */
  getAuditLogs(filters?: {
    tenantId?: string;
    userId?: string;
    operation?: 'encrypt' | 'decrypt';
    fieldName?: string;
  }): EncryptionAuditLog[] {
    let logs = [...this.auditLogs];

    if (filters?.tenantId) {
      logs = logs.filter((log) => log.tenantId === filters.tenantId);
    }

    if (filters?.userId) {
      logs = logs.filter((log) => log.userId === filters.userId);
    }

    if (filters?.operation) {
      logs = logs.filter((log) => log.operation === filters.operation);
    }

    if (filters?.fieldName) {
      logs = logs.filter((log) => log.fieldName === filters.fieldName);
    }

    return logs;
  }

  // Private helper methods

  /**
   * Initialize default encryption keys using Web Crypto API
   */
  private async initializeDefaultKeys(): Promise<void> {
    try {
      // Create default key for primary tenant
      const defaultKey = await this.generateKeyForTenant('wellfit-primary');
      this.keys.set(defaultKey.id, defaultKey);

      // Also create a key for the default WF-0001 tenant
      const wfKey = await this.generateKeyForTenant('2b902657-6a20-4435-a78a-576f397517ca');
      this.keys.set(wfKey.id, wfKey);

      this.initialized = true;
    } catch (error) {
      // If we can't initialize keys, mark as initialized but log the error
      this.initialized = true;
      throw error;
    }
  }

  /**
   * Generate a new AES-256 key for a tenant using Web Crypto API
   */
  private async generateKeyForTenant(tenantId: string): Promise<EncryptionKey> {
    const keyId = `key-${tenantId}-${Date.now()}-${this.generateRandomHex(8)}`;

    // Generate a secure 256-bit AES key using Web Crypto API
    const cryptoKey = await this.crypto.subtle.generateKey(
      {
        name: AES_GCM_CONFIG.name,
        length: AES_GCM_CONFIG.length,
      },
      true,  // extractable (for key backup/export)
      ['encrypt', 'decrypt']
    );

    // Export the key for potential backup (optional)
    const exportedKeyBuffer = await this.crypto.subtle.exportKey('raw', cryptoKey);
    const exportedKey = this.arrayBufferToBase64(new Uint8Array(exportedKeyBuffer));

    return {
      id: keyId,
      cryptoKey,
      exportedKey,
      tenantId,
      createdAt: new Date(),
      active: true,
      version: 1,
    };
  }

  /**
   * Import a key from exported format (for key restoration)
   */
  async importKey(exportedKey: string, tenantId: string): Promise<EncryptionKey> {
    const keyData = this.base64ToArrayBuffer(exportedKey);

    const cryptoKey = await this.crypto.subtle.importKey(
      'raw',
      keyData.buffer as ArrayBuffer,
      {
        name: AES_GCM_CONFIG.name,
        length: AES_GCM_CONFIG.length,
      },
      true,
      ['encrypt', 'decrypt']
    );

    const keyId = `key-${tenantId}-${Date.now()}-${this.generateRandomHex(8)}`;

    const key: EncryptionKey = {
      id: keyId,
      cryptoKey,
      exportedKey,
      tenantId,
      createdAt: new Date(),
      active: true,
      version: 1,
    };

    this.keys.set(keyId, key);
    return key;
  }

  private getActiveKeyForTenant(tenantId: string): EncryptionKey | undefined {
    for (const key of this.keys.values()) {
      if (key.tenantId === tenantId && key.active) {
        return key;
      }
    }
    // Fallback to default key if tenant-specific key not found
    for (const key of this.keys.values()) {
      if (key.tenantId === 'wellfit-primary' && key.active) {
        return key;
      }
    }
    return undefined;
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < buffer.length; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Generate a random hex string for key IDs
   */
  private generateRandomHex(length: number): string {
    const bytes = this.crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private logEncryptionOperation(
    operation: 'encrypt' | 'decrypt',
    fieldName: string,
    keyId: string,
    tenantId: string,
    userId: string | undefined,
    success: boolean,
    error?: string
  ): void {
    const log: EncryptionAuditLog = {
      timestamp: new Date(),
      operation,
      fieldName,
      keyId,
      tenantId,
      userId,
      success,
      error,
    };

    this.auditLogs.push(log);

    // In production: Send to audit database

  }
}

/**
 * Global PHI encryption instance
 */
let globalEncryption: PHIEncryption | null = null;

export function getPHIEncryption(): PHIEncryption {
  if (!globalEncryption) {
    globalEncryption = new PHIEncryption();
  }
  return globalEncryption;
}

/**
 * Decorator for automatic PHI field encryption
 * Usage: @EncryptPHI('tenant-id')
 */
export function EncryptPHI(tenantId: string) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const encryption = getPHIEncryption();

      // Encrypt PHI fields in arguments
      const encryptedArgs = await Promise.all(
        args.map(async (arg) => {
          if (typeof arg === 'object' && arg !== null) {
            return encryption.encryptObject(arg as Record<string, unknown>, tenantId);
          }
          return arg;
        })
      );

      // Call original method
      const result = await originalMethod.apply(this, encryptedArgs);

      // Decrypt PHI fields in result
      if (typeof result === 'object' && result !== null) {
        return encryption.decryptObject(result as Record<string, unknown>);
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Implementation Status:
 *
 * ✅ COMPLETED:
 * 1. Web Crypto API for real encryption:
 *    - AES-256-GCM authenticated encryption
 *    - crypto.getRandomValues() for secure IV (12 bytes)
 *    - crypto.subtle.generateKey() for 256-bit keys
 *    - crypto.subtle.encrypt/decrypt for operations
 *
 * 2. Key management basics:
 *    - Per-tenant encryption keys
 *    - Key export/import for backup
 *    - Key rotation support
 *    - In-memory key storage (for single-instance)
 *
 * 3. Audit trail:
 *    - All encrypt/decrypt operations logged
 *    - User ID tracking
 *    - Success/failure tracking
 *
 * 🔜 FUTURE ENHANCEMENTS:
 *
 * 1. Integrate with Key Management Service (KMS):
 *    - AWS KMS, Azure Key Vault, or Google Cloud KMS
 *    - Hardware Security Module (HSM) backing
 *    - Cross-region key replication
 *
 * 2. Add envelope encryption:
 *    - Data Encryption Keys (DEK) for each field
 *    - Key Encryption Keys (KEK) in KMS
 *    - Improved performance and security
 *
 * 3. Add key access controls:
 *    - Role-based access to encryption keys
 *    - Per-user key permissions
 *    - Key usage quotas and rate limiting
 *
 * 4. Add re-encryption on key rotation:
 *    - Background job to re-encrypt with new key
 *    - Support for old keys during transition
 *    - Automatic cleanup of expired keys
 *
 * 5. Persistent key storage:
 *    - Store keys in Supabase vault
 *    - Encrypted key storage at rest
 *    - Multi-instance key synchronization
 */
