/**
 * Offline Encryption Service
 *
 * Integrates PHI encryption with offline storage for HIPAA-compliant
 * client-side data protection.
 *
 * Features:
 * - AES-256-GCM encryption for all PHI fields before IndexedDB storage
 * - Per-tenant encryption keys
 * - Encryption key derivation from user authentication
 * - Secure key storage in memory (never persisted unencrypted)
 * - Automatic encryption/decryption of PHI fields
 */

import { getPHIEncryption, type EncryptedField, PHI_FIELDS } from '../../guardian-agent/PHIEncryption';
import { auditLogger } from '../../auditLogger';
import type {
  // EnterpriseOfflineRecord - base type for records
  OfflineFieldVisit,
  OfflineAssessment,
  OfflinePhoto,
  // OfflineAlert - type available for encryption
  // OfflineAuditEntry - type available for encryption
} from './types';

/**
 * PHI field names specific to offline healthcare records
 */
const OFFLINE_PHI_FIELDS = [
  ...PHI_FIELDS,
  'notes',
  'findings',
  'recommendations',
  'encryptedData',
  'encryptedName',
  'clinicalNotes',
  'assessmentDetails',
  'woundDescription',
  'patientResponse',
  'medicationList',
  'allergyList',
  'vitalReadings',
];

/**
 * Configuration for offline encryption
 */
export interface OfflineEncryptionConfig {
  /** Tenant ID for key isolation */
  tenantId: string;

  /** User ID for audit trail */
  userId: string;

  /** Device ID for tracking */
  deviceId: string;

  /** Whether to encrypt all fields or just PHI */
  encryptAllFields?: boolean;
}

/**
 * Result of encryption operation
 */
export interface EncryptionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  encryptedFields?: string[];
}

/**
 * Offline Encryption Service
 * Handles all client-side encryption for offline healthcare data
 */
export class OfflineEncryptionService {
  private config: OfflineEncryptionConfig;
  private encryption = getPHIEncryption();
  private initialized = false;

  constructor(config: OfflineEncryptionConfig) {
    this.config = config;
  }

  /**
   * Initialize the encryption service
   * Must be called before any encryption/decryption operations
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure PHI encryption is ready
      // The getPHIEncryption() singleton handles its own initialization
      this.initialized = true;

      await auditLogger.info('OFFLINE_ENCRYPTION_INITIALIZED', {
        tenantId: this.config.tenantId,
        deviceId: this.config.deviceId,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await auditLogger.error('OFFLINE_ENCRYPTION_INIT_FAILED', errorMessage, {
        tenantId: this.config.tenantId,
      });
      throw err;
    }
  }

  /**
   * Encrypt a field visit record before storage
   */
  async encryptFieldVisit(
    visit: Omit<OfflineFieldVisit, 'encrypted' | 'encryptionKeyId'>
  ): Promise<EncryptionResult<OfflineFieldVisit>> {
    try {
      await this.ensureInitialized();

      const encryptedFields: string[] = [];

      // Encrypt patient name if present
      let encryptedPatient = { ...visit.patient };
      if (visit.patient.encryptedName && typeof visit.patient.encryptedName === 'string') {
        encryptedPatient = {
          ...visit.patient,
          encryptedName: await this.encryption.encrypt(
            visit.patient.encryptedName,
            'patientName',
            this.config.tenantId,
            this.config.userId
          ),
        };
        encryptedFields.push('patient.encryptedName');
      }

      // Encrypt notes if present
      let encryptedNotes = visit.notes;
      if (visit.notes && typeof visit.notes === 'string') {
        encryptedNotes = await this.encryption.encrypt(
          visit.notes,
          'clinicalNotes',
          this.config.tenantId,
          this.config.userId
        );
        encryptedFields.push('notes');
      }

      const encryptedVisit: OfflineFieldVisit = {
        ...visit,
        patient: encryptedPatient,
        notes: encryptedNotes,
        encrypted: true,
        encryptionKeyId: this.getActiveKeyId(),
      };

      await this.logEncryptionOperation('encrypt', 'field_visit', visit.id, encryptedFields);

      return {
        success: true,
        data: encryptedVisit,
        encryptedFields,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await auditLogger.error('FIELD_VISIT_ENCRYPTION_FAILED', errorMessage, {
        visitId: visit.id,
        tenantId: this.config.tenantId,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Decrypt a field visit record for display
   */
  async decryptFieldVisit(
    visit: OfflineFieldVisit
  ): Promise<EncryptionResult<OfflineFieldVisit>> {
    try {
      await this.ensureInitialized();

      if (!visit.encrypted) {
        return { success: true, data: visit };
      }

      const decryptedFields: string[] = [];

      // Decrypt patient name if encrypted
      let decryptedPatient = { ...visit.patient };
      if (visit.patient.encryptedName && this.isEncryptedField(visit.patient.encryptedName)) {
        const decryptedName = await this.encryption.decrypt<string>(
          visit.patient.encryptedName,
          this.config.userId
        );
        decryptedPatient = {
          ...visit.patient,
          encryptedName: decryptedName as unknown as EncryptedField<string>,
        };
        decryptedFields.push('patient.encryptedName');
      }

      // Decrypt notes if encrypted
      let decryptedNotes = visit.notes;
      if (visit.notes && this.isEncryptedField(visit.notes)) {
        decryptedNotes = await this.encryption.decrypt<string>(
          visit.notes,
          this.config.userId
        ) as unknown as EncryptedField<string>;
        decryptedFields.push('notes');
      }

      const decryptedVisit: OfflineFieldVisit = {
        ...visit,
        patient: decryptedPatient,
        notes: decryptedNotes,
      };

      await this.logEncryptionOperation('decrypt', 'field_visit', visit.id, decryptedFields);

      return {
        success: true,
        data: decryptedVisit,
        encryptedFields: decryptedFields,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await auditLogger.error('FIELD_VISIT_DECRYPTION_FAILED', errorMessage, {
        visitId: visit.id,
        tenantId: this.config.tenantId,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Encrypt an assessment record before storage
   */
  async encryptAssessment(
    assessment: Omit<OfflineAssessment, 'encrypted' | 'encryptionKeyId'>
  ): Promise<EncryptionResult<OfflineAssessment>> {
    try {
      await this.ensureInitialized();

      const encryptedFields: string[] = [];

      // Encrypt findings (always required for assessments)
      const encryptedFindings = await this.encryption.encrypt(
        assessment.findings,
        'assessmentFindings',
        this.config.tenantId,
        this.config.userId
      );
      encryptedFields.push('findings');

      // Encrypt recommendations if present
      let encryptedRecommendations = assessment.recommendations;
      if (assessment.recommendations && typeof assessment.recommendations === 'string') {
        encryptedRecommendations = await this.encryption.encrypt(
          assessment.recommendations,
          'recommendations',
          this.config.tenantId,
          this.config.userId
        );
        encryptedFields.push('recommendations');
      }

      const encryptedAssessment: OfflineAssessment = {
        ...assessment,
        findings: encryptedFindings,
        recommendations: encryptedRecommendations,
        encrypted: true,
        encryptionKeyId: this.getActiveKeyId(),
      };

      await this.logEncryptionOperation('encrypt', 'assessment', assessment.id, encryptedFields);

      return {
        success: true,
        data: encryptedAssessment,
        encryptedFields,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await auditLogger.error('ASSESSMENT_ENCRYPTION_FAILED', errorMessage, {
        assessmentId: assessment.id,
        tenantId: this.config.tenantId,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Decrypt an assessment record for display
   */
  async decryptAssessment(
    assessment: OfflineAssessment
  ): Promise<EncryptionResult<OfflineAssessment>> {
    try {
      await this.ensureInitialized();

      if (!assessment.encrypted) {
        return { success: true, data: assessment };
      }

      const decryptedFields: string[] = [];

      // Decrypt findings
      const decryptedFindings = await this.encryption.decrypt<Record<string, unknown>>(
        assessment.findings,
        this.config.userId
      );
      decryptedFields.push('findings');

      // Decrypt recommendations if encrypted
      let decryptedRecommendations = assessment.recommendations;
      if (assessment.recommendations && this.isEncryptedField(assessment.recommendations)) {
        decryptedRecommendations = await this.encryption.decrypt<string>(
          assessment.recommendations,
          this.config.userId
        ) as unknown as EncryptedField<string>;
        decryptedFields.push('recommendations');
      }

      const decryptedAssessment: OfflineAssessment = {
        ...assessment,
        findings: decryptedFindings as unknown as EncryptedField<Record<string, unknown>>,
        recommendations: decryptedRecommendations,
      };

      await this.logEncryptionOperation('decrypt', 'assessment', assessment.id, decryptedFields);

      return {
        success: true,
        data: decryptedAssessment,
        encryptedFields: decryptedFields,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await auditLogger.error('ASSESSMENT_DECRYPTION_FAILED', errorMessage, {
        assessmentId: assessment.id,
        tenantId: this.config.tenantId,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Encrypt a photo record before storage
   */
  async encryptPhoto(
    photo: Omit<OfflinePhoto, 'encrypted' | 'encryptionKeyId'>
  ): Promise<EncryptionResult<OfflinePhoto>> {
    try {
      await this.ensureInitialized();

      const encryptedFields: string[] = [];

      // Encrypt photo data (critical - contains PHI)
      const encryptedData = await this.encryption.encrypt(
        photo.encryptedData,
        'medicalPhoto',
        this.config.tenantId,
        this.config.userId
      );
      encryptedFields.push('encryptedData');

      // Encrypt thumbnail if present
      let encryptedThumbnail = photo.thumbnail;
      if (photo.thumbnail) {
        encryptedThumbnail = await this.encryption.encrypt(
          photo.thumbnail,
          'thumbnail',
          this.config.tenantId,
          this.config.userId
        );
        encryptedFields.push('thumbnail');
      }

      const encryptedPhoto: OfflinePhoto = {
        ...photo,
        encryptedData,
        thumbnail: encryptedThumbnail,
        encrypted: true,
        encryptionKeyId: this.getActiveKeyId(),
      };

      await this.logEncryptionOperation('encrypt', 'photo', photo.id, encryptedFields);

      return {
        success: true,
        data: encryptedPhoto,
        encryptedFields,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await auditLogger.error('PHOTO_ENCRYPTION_FAILED', errorMessage, {
        photoId: photo.id,
        tenantId: this.config.tenantId,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Decrypt a photo record for display
   */
  async decryptPhoto(photo: OfflinePhoto): Promise<EncryptionResult<OfflinePhoto>> {
    try {
      await this.ensureInitialized();

      if (!photo.encrypted) {
        return { success: true, data: photo };
      }

      const decryptedFields: string[] = [];

      // Decrypt photo data
      const decryptedData = await this.encryption.decrypt<string>(
        photo.encryptedData,
        this.config.userId
      );
      decryptedFields.push('encryptedData');

      // Decrypt thumbnail if encrypted
      let decryptedThumbnail = photo.thumbnail;
      if (photo.thumbnail && this.isEncryptedField(photo.thumbnail)) {
        decryptedThumbnail = await this.encryption.decrypt<string>(
          photo.thumbnail,
          this.config.userId
        ) as unknown as EncryptedField<string>;
        decryptedFields.push('thumbnail');
      }

      const decryptedPhoto: OfflinePhoto = {
        ...photo,
        encryptedData: decryptedData as unknown as EncryptedField<string>,
        thumbnail: decryptedThumbnail,
      };

      await this.logEncryptionOperation('decrypt', 'photo', photo.id, decryptedFields);

      return {
        success: true,
        data: decryptedPhoto,
        encryptedFields: decryptedFields,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await auditLogger.error('PHOTO_DECRYPTION_FAILED', errorMessage, {
        photoId: photo.id,
        tenantId: this.config.tenantId,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if a value is an encrypted field
   */
  isEncryptedField(value: unknown): value is EncryptedField<unknown> {
    return this.encryption.isEncryptedField(value);
  }

  /**
   * Check if a field name is a PHI field
   */
  isPHIField(fieldName: string): boolean {
    const normalized = fieldName.toLowerCase();
    return OFFLINE_PHI_FIELDS.some((phi) => normalized.includes(phi.toLowerCase()));
  }

  /**
   * Get the active encryption key ID
   */
  private getActiveKeyId(): string {
    // The PHI encryption service manages keys internally
    // We use the tenant ID as the key identifier
    return `key-${this.config.tenantId}`;
  }

  /**
   * Ensure the service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Log encryption/decryption operation for audit trail
   */
  private async logEncryptionOperation(
    operation: 'encrypt' | 'decrypt',
    resourceType: string,
    resourceId: string,
    fields: string[]
  ): Promise<void> {
    await auditLogger.info(`OFFLINE_${operation.toUpperCase()}_SUCCESS`, {
      resourceType,
      resourceId,
      fieldCount: fields.length,
      fields,
      tenantId: this.config.tenantId,
      deviceId: this.config.deviceId,
    });
  }
}

/**
 * Create a singleton encryption service for offline data
 */
let offlineEncryptionInstance: OfflineEncryptionService | null = null;

/**
 * Get or create the offline encryption service instance
 */
export function getOfflineEncryption(config: OfflineEncryptionConfig): OfflineEncryptionService {
  if (!offlineEncryptionInstance ||
      offlineEncryptionInstance['config'].tenantId !== config.tenantId) {
    offlineEncryptionInstance = new OfflineEncryptionService(config);
  }
  return offlineEncryptionInstance;
}

/**
 * Generate a unique device ID for this browser/device
 * Stored in localStorage for consistency
 */
export function getOrCreateDeviceId(): string {
  const DEVICE_ID_KEY = 'wellfit_device_id';

  if (typeof localStorage === 'undefined') {
    // Fallback for non-browser environments
    return `device-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  let deviceId = localStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    // Generate a new device ID using crypto if available
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      deviceId = `device-${crypto.randomUUID()}`;
    } else {
      deviceId = `device-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    }
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  return deviceId;
}
