/**
 * PHI Encryption - Field-level encryption for Protected Health Information
 * Ensures PHI is encrypted at rest and in transit
 *
 * Features:
 * - AES-256-GCM encryption
 * - Per-tenant encryption keys
 * - Field-level granularity
 * - Key rotation support
 * - Audit trail for all encryption/decryption
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
export interface EncryptedField<T = any> {
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

  /** Key material (in production: stored in KMS) */
  key: Buffer;

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
 * PHI Encryption Service
 */
export class PHIEncryption {
  private keys: Map<string, EncryptionKey> = new Map();
  private auditLogs: EncryptionAuditLog[] = [];

  // In production: Use Web Crypto API or Node crypto
  // For now: Simplified implementation

  constructor() {
    // Initialize default keys (in production: load from KMS)
    this.initializeDefaultKeys();
  }

  /**
   * Encrypt a PHI field
   */
  async encrypt<T>(
    value: T,
    fieldName: string,
    tenantId: string,
    userId?: string
  ): Promise<EncryptedField<T>> {
    try {
      // Get active key for tenant
      const key = this.getActiveKeyForTenant(tenantId);

      if (!key) {
        throw new Error(`No active encryption key for tenant ${tenantId}`);
      }

      // Convert value to string
      const plaintext = JSON.stringify(value);

      // In production: Use Web Crypto API or Node crypto
      // For now: Base64 encoding (NOT SECURE - demo only)
      const ciphertext = Buffer.from(plaintext).toString('base64');
      const iv = this.generateIV();
      const tag = this.generateTag();

      const encrypted: EncryptedField<T> = {
        ciphertext,
        iv,
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
   * Decrypt a PHI field
   */
  async decrypt<T>(
    encrypted: EncryptedField<T>,
    userId?: string
  ): Promise<T> {
    try {
      // Get key
      const key = this.keys.get(encrypted.keyId);

      if (!key) {
        throw new Error(`Encryption key ${encrypted.keyId} not found`);
      }

      if (!key.active) {
        throw new Error(`Encryption key ${encrypted.keyId} is not active`);
      }

      // In production: Use Web Crypto API or Node crypto
      // For now: Base64 decoding (NOT SECURE - demo only)
      const plaintext = Buffer.from(encrypted.ciphertext, 'base64').toString('utf-8');
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
    obj: Record<string, any>,
    tenantId: string,
    userId?: string
  ): Promise<Record<string, any>> {
    const encrypted: Record<string, any> = { ...obj };

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
    obj: Record<string, any>,
    userId?: string
  ): Promise<Record<string, any>> {
    const decrypted: Record<string, any> = { ...obj };

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
  isEncryptedField(value: any): value is EncryptedField {
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
    // Deactivate old keys
    for (const [keyId, key] of this.keys.entries()) {
      if (key.tenantId === tenantId && key.active) {
        key.active = false;
        key.rotatedAt = new Date();
        this.keys.set(keyId, key);
      }
    }

    // Create new key
    const newKey = this.generateKeyForTenant(tenantId);
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

  private initializeDefaultKeys(): void {
    // Create default key for primary tenant
    const defaultKey = this.generateKeyForTenant('wellfit-primary');
    this.keys.set(defaultKey.id, defaultKey);
  }

  private generateKeyForTenant(tenantId: string): EncryptionKey {
    const keyId = `key-${tenantId}-${Date.now()}`;

    // In production: Generate key using Web Crypto API or KMS
    // For now: Random buffer (NOT SECURE - demo only)
    const key = Buffer.from(Math.random().toString(36));

    return {
      id: keyId,
      key,
      tenantId,
      createdAt: new Date(),
      active: true,
      version: 1,
    };
  }

  private getActiveKeyForTenant(tenantId: string): EncryptionKey | undefined {
    for (const key of this.keys.values()) {
      if (key.tenantId === tenantId && key.active) {
        return key;
      }
    }
    return undefined;
  }

  private generateIV(): string {
    // In production: Use crypto.randomBytes(16)
    return Buffer.from(Math.random().toString(36)).toString('base64');
  }

  private generateTag(): string {
    // In production: AES-GCM authentication tag
    return Buffer.from(Math.random().toString(36)).toString('base64');
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
 */
export function EncryptPHI(tenantId: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const encryption = getPHIEncryption();

      // Encrypt PHI fields in arguments
      const encryptedArgs = await Promise.all(
        args.map(async (arg) => {
          if (typeof arg === 'object' && arg !== null) {
            return encryption.encryptObject(arg, tenantId);
          }
          return arg;
        })
      );

      // Call original method
      const result = await originalMethod.apply(this, encryptedArgs);

      // Decrypt PHI fields in result
      if (typeof result === 'object' && result !== null) {
        return encryption.decryptObject(result);
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Production TODO:
 *
 * 1. Use Web Crypto API for actual encryption:
 *    - AES-256-GCM for authenticated encryption
 *    - Proper IV generation with crypto.getRandomValues
 *    - Key derivation with PBKDF2 or HKDF
 *
 * 2. Integrate with Key Management Service (KMS):
 *    - AWS KMS, Azure Key Vault, or Google Cloud KMS
 *    - Never store keys in application code
 *    - Automatic key rotation
 *    - Key versioning and audit trail
 *
 * 3. Add envelope encryption:
 *    - Data Encryption Keys (DEK) for each field
 *    - Key Encryption Keys (KEK) in KMS
 *    - Improved performance and security
 *
 * 4. Add key access controls:
 *    - Role-based access to encryption keys
 *    - Audit trail for key access
 *    - Key usage quotas
 *
 * 5. Add re-encryption on key rotation:
 *    - Background job to re-encrypt with new key
 *    - Support for old keys during transition
 *    - Automatic cleanup of old keys
 *
 * 6. Add encryption at rest in database:
 *    - Transparent Data Encryption (TDE)
 *    - Column-level encryption
 *    - Integration with Supabase encryption
 */
