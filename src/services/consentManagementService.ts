/**
 * CONSENT MANAGEMENT SERVICE - INTEGRATED
 *
 * Works with the existing privacy_consent table (extended with advanced features)
 * Zero duplication - integrates with existing UI and workflows
 *
 * Compliance: 21st Century Cures Act, HIPAA §164.508
 *
 * @module ConsentManagementService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';

// =====================================================
// TYPES & INTERFACES
// =====================================================

export type ConsentType =
  | 'photo'
  | 'privacy'
  | 'treatment'
  | 'research'
  | 'marketing'
  | 'data_sharing'
  | 'telehealth'
  | 'ai_assisted_care'
  | 'third_party_integration'
  | 'wearable_data_collection';

export type ConsentMethod =
  | 'electronic_signature'
  | 'verbal_recorded'
  | 'written_paper'
  | 'implicit_registration'
  | 'mobile_app';

export type AlertType =
  | 'expiring_soon_30d'
  | 'expiring_soon_7d'
  | 'expired'
  | 'requires_reauthorization';

export interface SharingPermissions {
  share_with_providers?: boolean;
  share_with_family?: boolean;
  share_with_researchers?: boolean;
  allowed_third_parties?: string[];
  data_types_allowed?: string[];
  data_types_restricted?: string[];
  [key: string]: boolean | string | string[] | undefined;
}

export interface Consent {
  id: number; // BIGINT from privacy_consent table
  user_id: string;
  consent_type: ConsentType;
  consented: boolean;
  first_name?: string;
  last_name?: string;
  file_path?: string; // Signature image path
  signed_at?: string;
  consented_at: string;
  consent_method?: ConsentMethod;
  effective_date?: string;
  expiration_date?: string;
  withdrawn_at?: string;
  withdrawal_reason?: string;
  sharing_permissions: SharingPermissions;
  witness_id?: string;
  audit_trail: Array<{ action: string; timestamp: string; user_id?: string; details?: string }>;
  ip_address?: string;
  user_agent?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface ConsentVerificationResult {
  has_consent: boolean;
  consent_id?: number;
  expires_at?: string;
  is_expired: boolean;
  sharing_permissions?: SharingPermissions;
  verification_reason?: string;
}

export interface ConsentVerificationLog {
  id: string;
  consent_id?: number;
  user_id: string;
  consent_type: ConsentType;
  requesting_user_id?: string;
  requesting_service?: string;
  verification_result: boolean;
  verification_reason?: string;
  consent_found: boolean;
  consent_expired: boolean;
  consent_withdrawn: boolean;
  additional_metadata: Record<string, unknown>;
  verified_at: string;
}

export interface ExpiringConsent {
  user_id: string;
  consent_id: number;
  consent_type: ConsentType;
  expiration_date: string;
  days_until_expiration: number;
  user_email: string;
  user_name: string;
}

export interface GrantConsentParams {
  userId: string;
  consentType: ConsentType;
  consentMethod?: ConsentMethod;
  firstName?: string;
  lastName?: string;
  filePath?: string; // Signature file path
  sharingPermissions?: SharingPermissions;
  expirationMonths?: number;
  witnessId?: string;
  notes?: string;
}

export interface WithdrawConsentParams {
  consentId: number;
  withdrawalReason?: string;
}

// =====================================================
// CONSENT MANAGEMENT SERVICE CLASS
// =====================================================

export class ConsentManagementService {
  /**
   * Get all consents for a user
   */
  async getUserConsents(userId: string): Promise<Consent[]> {
    try {
      const { data, error } = await supabase
        .from('privacy_consent')
        .select('*')
        .eq('user_id', userId)
        .order('consented_at', { ascending: false });

      if (error) {
        await auditLogger.error('USER_CONSENT_FETCH_FAILED', error, {
          operation: 'getUserConsents',
          user_id: userId
        });
        throw new Error(`Failed to fetch user consents: ${error.message}`);
      }

      await auditLogger.phi('CONSENT_RECORDS_ACCESSED', userId, {
        count: data.length,
        operation: 'getUserConsents'
      });

      return data as Consent[];
    } catch (error) {
      await auditLogger.error('USER_CONSENT_FETCH_ERROR', error as Error, {
        operation: 'getUserConsents',
        user_id: userId
      });
      throw error;
    }
  }

  /**
   * Get active (non-withdrawn, non-expired) consents for a user
   */
  async getActiveUserConsents(userId: string): Promise<Consent[]> {
    try {
      const { data, error } = await supabase
        .from('privacy_consent')
        .select('*')
        .eq('user_id', userId)
        .eq('consented', true)
        .is('withdrawn_at', null)
        .or(`expiration_date.is.null,expiration_date.gt.${new Date().toISOString()}`)
        .order('effective_date', { ascending: false });

      if (error) {
        await auditLogger.error('ACTIVE_CONSENT_FETCH_FAILED', error, {
          operation: 'getActiveUserConsents',
          user_id: userId
        });
        throw new Error(`Failed to fetch active user consents: ${error.message}`);
      }

      await auditLogger.phi('ACTIVE_CONSENTS_ACCESSED', userId, {
        count: data.length,
        operation: 'getActiveUserConsents'
      });

      return data as Consent[];
    } catch (error) {
      await auditLogger.error('ACTIVE_CONSENT_FETCH_ERROR', error as Error, {
        operation: 'getActiveUserConsents',
        user_id: userId
      });
      throw error;
    }
  }

  /**
   * Grant consent for a user
   */
  async grantConsent(params: GrantConsentParams): Promise<Consent> {
    const {
      userId,
      consentType,
      consentMethod = 'electronic_signature',
      firstName,
      lastName,
      filePath,
      sharingPermissions = {
        share_with_providers: true,
        share_with_family: false,
        share_with_researchers: false,
        allowed_third_parties: [],
        data_types_allowed: [],
        data_types_restricted: []
      },
      expirationMonths,
      witnessId,
      notes
    } = params;

    try {
      // Calculate expiration date if provided
      let expirationDate: Date | undefined;
      if (expirationMonths) {
        expirationDate = new Date();
        expirationDate.setMonth(expirationDate.getMonth() + expirationMonths);
      }

      // Get IP and user agent
      const ipAddress = await this.getClientIpAddress();
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;

      // Create consent record
      const consentData = {
        user_id: userId,
        consent_type: consentType,
        consented: true,
        first_name: firstName,
        last_name: lastName,
        file_path: filePath,
        consent_method: consentMethod,
        consented_at: new Date().toISOString(),
        effective_date: new Date().toISOString(),
        expiration_date: expirationDate?.toISOString(),
        sharing_permissions: sharingPermissions,
        ip_address: ipAddress,
        user_agent: userAgent,
        witness_id: witnessId,
        notes: notes,
        audit_trail: [
          {
            action: 'granted',
            timestamp: new Date().toISOString(),
            method: consentMethod
          }
        ]
      };

      const { data, error } = await supabase
        .from('privacy_consent')
        .insert(consentData)
        .select()
        .single();

      if (error) {
        await auditLogger.error('CONSENT_GRANT_FAILED', error, {
          operation: 'grantConsent',
          user_id: userId,
          consent_type: consentType
        });
        throw new Error(`Failed to grant consent: ${error.message}`);
      }

      // Log the consent grant
      await auditLogger.clinical('CONSENT_GRANTED', true, {
        user_id: userId,
        consent_id: data.id,
        consent_type: consentType,
        consent_method: consentMethod,
        expiration_months: expirationMonths,
        witnessed: !!witnessId
      });

      await this.logConsentVerification({
        userId,
        consentType,
        verificationResult: true,
        verificationReason: 'Consent granted by user',
        consentFound: true,
        consentExpired: false,
        consentWithdrawn: false
      });

      return data as Consent;
    } catch (error) {
      await auditLogger.error('CONSENT_GRANT_ERROR', error as Error, {
        operation: 'grantConsent',
        user_id: userId,
        consent_type: consentType
      });
      throw error;
    }
  }

  /**
   * Check if user has valid consent for a specific type
   */
  async checkUserConsent(
    userId: string,
    consentType: ConsentType,
    requestingService?: string
  ): Promise<ConsentVerificationResult> {
    try {
      // Call database function for consent check
      const { data, error } = await supabase.rpc('check_user_consent', {
        p_user_id: userId,
        p_consent_type: consentType
      });

      if (error) {
        await auditLogger.error('CONSENT_CHECK_FAILED', error, {
          operation: 'checkUserConsent',
          user_id: userId,
          consent_type: consentType,
          requesting_service: requestingService
        });
        throw new Error(`Failed to check user consent: ${error.message}`);
      }

      const result = data && data.length > 0 ? data[0] : null;

      const verificationResult: ConsentVerificationResult = {
        has_consent: result?.has_consent || false,
        consent_id: result?.consent_id,
        expires_at: result?.expires_at,
        is_expired: result?.is_expired || false,
        sharing_permissions: result?.sharing_permissions,
        verification_reason: requestingService
      };

      // Log the consent verification
      await auditLogger.phi('CONSENT_VERIFIED', userId, {
        consent_type: consentType,
        has_consent: verificationResult.has_consent,
        is_expired: verificationResult.is_expired,
        requesting_service: requestingService,
        operation: 'checkUserConsent'
      });

      await this.logConsentVerification({
        userId,
        consentType,
        requestingService,
        verificationResult: verificationResult.has_consent,
        verificationReason: requestingService ? `Consent check for ${requestingService}` : 'Consent verification',
        consentFound: result !== null,
        consentExpired: verificationResult.is_expired,
        consentWithdrawn: false
      });

      return verificationResult;
    } catch (error) {
      await auditLogger.error('CONSENT_CHECK_ERROR', error as Error, {
        operation: 'checkUserConsent',
        user_id: userId,
        consent_type: consentType,
        requesting_service: requestingService
      });
      throw error;
    }
  }

  /**
   * Withdraw user consent
   */
  async withdrawConsent(params: WithdrawConsentParams): Promise<boolean> {
    const { consentId, withdrawalReason } = params;

    try {
      const { data, error } = await supabase.rpc('withdraw_consent', {
        p_consent_id: consentId,
        p_withdrawal_reason: withdrawalReason
      });

      if (error) {
        await auditLogger.error('CONSENT_WITHDRAWAL_FAILED', error, {
          operation: 'withdrawConsent',
          consent_id: consentId,
          withdrawal_reason: withdrawalReason
        });
        throw new Error(`Failed to withdraw consent: ${error.message}`);
      }

      await auditLogger.clinical('CONSENT_WITHDRAWN', true, {
        consent_id: consentId,
        withdrawal_reason: withdrawalReason,
        operation: 'withdrawConsent'
      });

      return data as boolean;
    } catch (error) {
      await auditLogger.error('CONSENT_WITHDRAWAL_ERROR', error as Error, {
        operation: 'withdrawConsent',
        consent_id: consentId
      });
      throw error;
    }
  }

  /**
   * Update consent sharing permissions
   */
  async updateSharingPermissions(
    consentId: number,
    sharingPermissions: SharingPermissions
  ): Promise<Consent> {
    try {
      // Get existing consent
      const { data: existingConsent, error: fetchError } = await supabase
        .from('privacy_consent')
        .select('*')
        .eq('id', consentId)
        .single();

      if (fetchError) {
        await auditLogger.error('CONSENT_FETCH_FOR_UPDATE_FAILED', fetchError, {
          operation: 'updateSharingPermissions',
          consent_id: consentId
        });
        throw new Error(`Failed to fetch consent: ${fetchError.message}`);
      }

      // Update audit trail
      const updatedAuditTrail = [
        ...(existingConsent.audit_trail || []),
        {
          action: 'permissions_updated',
          timestamp: new Date().toISOString(),
          old_permissions: existingConsent.sharing_permissions,
          new_permissions: sharingPermissions
        }
      ];

      // Update consent
      const { data, error } = await supabase
        .from('privacy_consent')
        .update({
          sharing_permissions: sharingPermissions,
          audit_trail: updatedAuditTrail,
          updated_at: new Date().toISOString()
        })
        .eq('id', consentId)
        .select()
        .single();

      if (error) {
        await auditLogger.error('SHARING_PERMISSIONS_UPDATE_FAILED', error, {
          operation: 'updateSharingPermissions',
          consent_id: consentId
        });
        throw new Error(`Failed to update sharing permissions: ${error.message}`);
      }

      await auditLogger.clinical('SHARING_PERMISSIONS_UPDATED', true, {
        consent_id: consentId,
        user_id: existingConsent.user_id,
        consent_type: existingConsent.consent_type,
        old_permissions: existingConsent.sharing_permissions,
        new_permissions: sharingPermissions,
        operation: 'updateSharingPermissions'
      });

      return data as Consent;
    } catch (error) {
      await auditLogger.error('SHARING_PERMISSIONS_UPDATE_ERROR', error as Error, {
        operation: 'updateSharingPermissions',
        consent_id: consentId
      });
      throw error;
    }
  }

  /**
   * Get expiring consents (for automated notifications)
   */
  async getExpiringConsents(daysUntilExpiration: number = 30): Promise<ExpiringConsent[]> {
    try {
      const { data, error } = await supabase.rpc('get_expiring_consents', {
        p_days_until_expiration: daysUntilExpiration
      });

      if (error) {
        await auditLogger.error('EXPIRING_CONSENTS_FETCH_FAILED', error, {
          operation: 'getExpiringConsents',
          days_until_expiration: daysUntilExpiration
        });
        throw new Error(`Failed to fetch expiring consents: ${error.message}`);
      }

      await auditLogger.info('EXPIRING_CONSENTS_RETRIEVED', {
        count: data.length,
        days_until_expiration: daysUntilExpiration,
        operation: 'getExpiringConsents'
      });

      return data as ExpiringConsent[];
    } catch (error) {
      await auditLogger.error('EXPIRING_CONSENTS_FETCH_ERROR', error as Error, {
        operation: 'getExpiringConsents',
        days_until_expiration: daysUntilExpiration
      });
      throw error;
    }
  }

  /**
   * Create consent expiration alert
   */
  async createExpirationAlert(
    userId: string,
    consentId: number,
    alertType: AlertType
  ): Promise<void> {
    try {
      const { error } = await supabase.from('consent_expiration_alerts').insert({
        user_id: userId,
        consent_id: consentId,
        alert_type: alertType,
        notification_sent: false
      });

      if (error) {
        await auditLogger.error('EXPIRATION_ALERT_CREATE_FAILED', error, {
          operation: 'createExpirationAlert',
          user_id: userId,
          consent_id: consentId,
          alert_type: alertType
        });
        throw new Error(`Failed to create expiration alert: ${error.message}`);
      }

      await auditLogger.info('EXPIRATION_ALERT_CREATED', {
        user_id: userId,
        consent_id: consentId,
        alert_type: alertType,
        operation: 'createExpirationAlert'
      });
    } catch (error) {
      await auditLogger.error('EXPIRATION_ALERT_CREATE_ERROR', error as Error, {
        operation: 'createExpirationAlert',
        user_id: userId,
        consent_id: consentId
      });
      throw error;
    }
  }

  /**
   * Mark expiration alert as sent
   */
  async markAlertAsSent(
    alertId: string,
    notificationMethod: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('consent_expiration_alerts')
        .update({
          notification_sent: true,
          notification_method: notificationMethod,
          notification_sent_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) {
        await auditLogger.error('ALERT_MARK_SENT_FAILED', error, {
          operation: 'markAlertAsSent',
          alert_id: alertId,
          notification_method: notificationMethod
        });
        throw new Error(`Failed to mark alert as sent: ${error.message}`);
      }

      await auditLogger.info('ALERT_MARKED_AS_SENT', {
        alert_id: alertId,
        notification_method: notificationMethod,
        operation: 'markAlertAsSent'
      });
    } catch (error) {
      await auditLogger.error('ALERT_MARK_SENT_ERROR', error as Error, {
        operation: 'markAlertAsSent',
        alert_id: alertId
      });
      throw error;
    }
  }

  /**
   * Record patient response to expiration alert
   */
  async recordAlertResponse(
    alertId: string,
    patientAction: 'renewed' | 'withdrew' | 'ignored'
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('consent_expiration_alerts')
        .update({
          patient_responded: true,
          patient_response_at: new Date().toISOString(),
          patient_action: patientAction
        })
        .eq('id', alertId);

      if (error) {
        await auditLogger.error('ALERT_RESPONSE_RECORD_FAILED', error, {
          operation: 'recordAlertResponse',
          alert_id: alertId,
          patient_action: patientAction
        });
        throw new Error(`Failed to record alert response: ${error.message}`);
      }

      await auditLogger.info('ALERT_RESPONSE_RECORDED', {
        alert_id: alertId,
        patient_action: patientAction,
        operation: 'recordAlertResponse'
      });
    } catch (error) {
      await auditLogger.error('ALERT_RESPONSE_RECORD_ERROR', error as Error, {
        operation: 'recordAlertResponse',
        alert_id: alertId
      });
      throw error;
    }
  }

  /**
   * Get consent verification history for a user
   */
  async getConsentVerificationHistory(
    userId: string,
    limit: number = 100
  ): Promise<ConsentVerificationLog[]> {
    try {
      const { data, error } = await supabase
        .from('consent_verification_log')
        .select('*')
        .eq('user_id', userId)
        .order('verified_at', { ascending: false })
        .limit(limit);

      if (error) {
        await auditLogger.error('VERIFICATION_HISTORY_FETCH_FAILED', error, {
          operation: 'getConsentVerificationHistory',
          user_id: userId,
          limit
        });
        throw new Error(`Failed to fetch verification history: ${error.message}`);
      }

      await auditLogger.phi('VERIFICATION_HISTORY_ACCESSED', userId, {
        count: data.length,
        limit,
        operation: 'getConsentVerificationHistory'
      });

      return data as ConsentVerificationLog[];
    } catch (error) {
      await auditLogger.error('VERIFICATION_HISTORY_FETCH_ERROR', error as Error, {
        operation: 'getConsentVerificationHistory',
        user_id: userId
      });
      throw error;
    }
  }

  // =====================================================
  // PRIVATE HELPER METHODS
  // =====================================================

  /**
   * Log consent verification to audit table
   */
  private async logConsentVerification(params: {
    userId: string;
    consentType: ConsentType;
    requestingService?: string;
    verificationResult: boolean;
    verificationReason?: string;
    consentFound: boolean;
    consentExpired: boolean;
    consentWithdrawn: boolean;
    additionalMetadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const { data: session } = await supabase.auth.getSession();
      const requestingUserId = session?.session?.user?.id;

      const logData = {
        user_id: params.userId,
        consent_type: params.consentType,
        requesting_user_id: requestingUserId,
        requesting_service: params.requestingService,
        verification_result: params.verificationResult,
        verification_reason: params.verificationReason,
        consent_found: params.consentFound,
        consent_expired: params.consentExpired,
        consent_withdrawn: params.consentWithdrawn,
        additional_metadata: params.additionalMetadata || {}
      };

      const { error } = await supabase
        .from('consent_verification_log')
        .insert(logData);

      if (error) {
        await auditLogger.error('CONSENT_VERIFICATION_LOG_FAILED', error, {
          operation: 'logConsentVerification',
          user_id: params.userId,
          consent_type: params.consentType
        });
      }
    } catch (error) {
      await auditLogger.error('CONSENT_VERIFICATION_LOG_ERROR', error as Error, {
        operation: 'logConsentVerification',
        user_id: params.userId
      });
    }
  }

  /**
   * Get client IP address (best effort)
   */
  private async getClientIpAddress(): Promise<string | undefined> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      return undefined;
    }
  }
}

// =====================================================
// SINGLETON EXPORT
// =====================================================

export const consentManagementService = new ConsentManagementService();
