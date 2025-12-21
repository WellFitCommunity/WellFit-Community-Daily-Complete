/**
 * FHIR Security Service
 *
 * Purpose: Centralized security layer for all FHIR operations
 * Provides: Error sanitization, input validation, audit logging, rate limiting
 * SOC 2 Controls: CC6.6, CC6.8, CC7.2, CC7.3
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SecurityContext {
  userId?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedInput?: any;
}

export interface AuditLogParams {
  eventType: string;
  eventCategory: string;
  resourceType?: string;
  resourceId?: string;
  targetUserId?: string;
  operation?: string;
  metadata?: Record<string, any>;
  success: boolean;
  errorMessage?: string;
}

// ============================================================================
// ERROR SANITIZATION
// ============================================================================

/**
 * Sanitize error messages to prevent PHI leakage
 */
export class ErrorSanitizer {
  private static PHI_PATTERNS = [
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, // Email
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // Phone
    /\b\d{10,}\b/g, // MRN or long numbers
    /\b(?:DOB|Birth|Birthday):\s*\S+/gi, // DOB
    /\b(?:patient|user)_id["']?\s*[:=]\s*["']?[a-f0-9-]{36}/gi, // UUIDs
  ];

  private static GENERIC_ERRORS: Record<string, string> = {
    // Database errors
    '23505': 'Duplicate record exists',
    '23503': 'Referenced record not found',
    '23502': 'Required field missing',
    '42P01': 'Resource not found',

    // Auth errors
    'PGRST301': 'Authentication required',
    'PGRST116': 'Permission denied',

    // Network errors
    'ECONNREFUSED': 'Service temporarily unavailable',
    'ETIMEDOUT': 'Request timeout',
    'ENOTFOUND': 'Service not found',
  };

  /**
   * Sanitize error message to remove PHI
   */
  static sanitize(error: any): string {
    let message: string;

    // Extract error message
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    } else if (error?.message) {
      message = error.message;
    } else {
      message = 'An error occurred';
    }

    // Remove PHI patterns
    this.PHI_PATTERNS.forEach(pattern => {
      message = message.replace(pattern, '[REDACTED]');
    });

    // Replace technical errors with user-friendly messages
    for (const [code, genericMessage] of Object.entries(this.GENERIC_ERRORS)) {
      if (message.includes(code)) {
        return genericMessage;
      }
    }

    // Remove stack traces
    message = message.split('\n')[0];

    // Limit length
    if (message.length > 200) {
      message = message.substring(0, 200) + '...';
    }

    return message;
  }

  /**
   * Create safe error object for client
   */
  static createSafeError(error: any, userMessage?: string): {
    message: string;
    code?: string;
    timestamp: string;
  } {
    return {
      message: userMessage || this.sanitize(error),
      code: error?.code || 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Log error with full details (server-side only, not sent to client)
   */
  static async logError(error: any, context: Record<string, any> = {}): Promise<void> {
    try {
      await supabase.rpc('log_security_event', {
        p_event_type: 'SYSTEM_ERROR',
        p_severity: 'MEDIUM',
        p_description: this.sanitize(error),
        p_metadata: {
          error_type: error?.constructor?.name || 'Unknown',
          error_code: error?.code || null,
          ...context,
        },
      });
    } catch (logError) {
      // Never let logging break the app

    }
  }
}

// ============================================================================
// INPUT VALIDATION
// ============================================================================

export class FHIRValidator {
  /**
   * Validate FHIR Patient resource
   */
  static validatePatient(patient: any): ValidationResult {
    const errors: string[] = [];

    if (!patient) {
      errors.push('Patient resource is required');
      return { isValid: false, errors };
    }

    if (patient.resourceType !== 'Patient') {
      errors.push('Resource must be of type Patient');
    }

    if (!patient.id && !patient.identifier) {
      errors.push('Patient must have either id or identifier');
    }

    // Validate name
    if (patient.name && Array.isArray(patient.name)) {
      patient.name.forEach((name: any, index: number) => {
        if (!name.family && !name.given) {
          errors.push(`Name[${index}] must have family or given name`);
        }
      });
    }

    // Validate birthDate format (YYYY-MM-DD)
    if (patient.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(patient.birthDate)) {
      errors.push('birthDate must be in YYYY-MM-DD format');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedInput: errors.length === 0 ? patient : undefined,
    };
  }

  /**
   * Validate FHIR Observation resource
   */
  static validateObservation(observation: any): ValidationResult {
    const errors: string[] = [];

    if (!observation) {
      errors.push('Observation resource is required');
      return { isValid: false, errors };
    }

    if (observation.resourceType !== 'Observation') {
      errors.push('Resource must be of type Observation');
    }

    if (!observation.status) {
      errors.push('Observation must have status');
    }

    if (!observation.code) {
      errors.push('Observation must have code');
    }

    if (!observation.subject) {
      errors.push('Observation must have subject (patient reference)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedInput: errors.length === 0 ? observation : undefined,
    };
  }

  /**
   * Validate FHIR Bundle
   */
  static validateBundle(bundle: any): ValidationResult {
    const errors: string[] = [];

    if (!bundle) {
      errors.push('Bundle is required');
      return { isValid: false, errors };
    }

    if (bundle.resourceType !== 'Bundle') {
      errors.push('Resource must be of type Bundle');
    }

    if (!bundle.type) {
      errors.push('Bundle must have type');
    }

    if (!bundle.entry || !Array.isArray(bundle.entry)) {
      errors.push('Bundle must have entry array');
    }

    // Validate each entry
    if (bundle.entry) {
      bundle.entry.forEach((entry: any, index: number) => {
        if (!entry.resource) {
          errors.push(`Entry[${index}] must have resource`);
        }
        if (!entry.resource?.resourceType) {
          errors.push(`Entry[${index}].resource must have resourceType`);
        }
      });
    }

    // Size limit (prevent DoS)
    const bundleSize = JSON.stringify(bundle).length;
    if (bundleSize > 10 * 1024 * 1024) { // 10MB
      errors.push('Bundle size exceeds 10MB limit');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedInput: errors.length === 0 ? bundle : undefined,
    };
  }

  /**
   * Generic input sanitization
   */
  static sanitizeInput<T>(input: T): T {
    if (typeof input === 'string') {
      // Remove potential SQL injection
      return input
        .replace(/[;<>]/g, '')
        .trim()
        .substring(0, 1000) as any; // Limit length
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item)) as any;
    }

    if (input && typeof input === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }

    return input;
  }
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

export class AuditLogger {
  /**
   * Log audit event
   */
  static async log(params: AuditLogParams): Promise<void> {
    try {
      const { data, error } = await supabase.rpc('log_audit_event', {
        p_event_type: params.eventType,
        p_event_category: params.eventCategory,
        p_resource_type: params.resourceType || null,
        p_resource_id: params.resourceId || null,
        p_target_user_id: params.targetUserId || null,
        p_operation: params.operation || null,
        p_metadata: params.metadata || {},
        p_success: params.success,
        p_error_message: params.errorMessage ? ErrorSanitizer.sanitize(params.errorMessage) : null,
      });

      if (error) {

      }
    } catch (error) {

    }
  }

  /**
   * Log PHI access
   */
  static async logPHIAccess(
    resourceType: string,
    resourceId: string,
    operation: 'READ' | 'WRITE' | 'UPDATE' | 'DELETE' | 'EXPORT',
    targetUserId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      eventType: `PHI_${operation}`,
      eventCategory: 'PHI_ACCESS',
      resourceType,
      resourceId,
      targetUserId,
      operation,
      metadata,
      success: true,
    });
  }

  /**
   * Log FHIR operation
   */
  static async logFHIROperation(
    operation: string,
    resourceType: string,
    success: boolean,
    metadata?: Record<string, any>,
    errorMessage?: string
  ): Promise<void> {
    await this.log({
      eventType: operation,
      eventCategory: 'FHIR_SYNC',
      resourceType,
      operation,
      metadata,
      success,
      errorMessage,
    });
  }
}

// ============================================================================
// RATE LIMITING
// ============================================================================

export class RateLimiter {
  /**
   * Check rate limit
   */
  static async check(
    limitType: 'FHIR_SYNC' | 'FHIR_EXPORT' | 'API_CALL' | 'DATA_QUERY',
    threshold: number = 100,
    windowMinutes: number = 60
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('check_rate_limit', {
        p_limit_type: limitType,
        p_threshold: threshold,
        p_window_minutes: windowMinutes,
      });

      if (error) {

        return true; // Fail open (allow request)
      }

      return data === true;
    } catch (error) {

      return true; // Fail open
    }
  }

  /**
   * Enforce rate limit (throw error if exceeded)
   */
  static async enforce(
    limitType: 'FHIR_SYNC' | 'FHIR_EXPORT' | 'API_CALL' | 'DATA_QUERY',
    threshold: number = 100,
    windowMinutes: number = 60
  ): Promise<void> {
    const allowed = await this.check(limitType, threshold, windowMinutes);

    if (!allowed) {
      // Log security event
      await supabase.rpc('log_security_event', {
        p_event_type: 'RATE_LIMIT_EXCEEDED',
        p_severity: 'MEDIUM',
        p_description: `Rate limit exceeded for ${limitType}`,
        p_metadata: {
          limit_type: limitType,
          threshold,
          window_minutes: windowMinutes,
        },
      });

      throw new Error(`Rate limit exceeded. Maximum ${threshold} requests per ${windowMinutes} minutes.`);
    }
  }
}

// ============================================================================
// SECURE FHIR OPERATIONS WRAPPER
// ============================================================================

export class SecureFHIROperations {
  /**
   * Securely import FHIR data with validation and audit logging
   */
  static async importFHIRData(
    userId: string,
    fhirData: any,
    connectionId: string
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Rate limiting
      await RateLimiter.enforce('FHIR_SYNC', 50, 60);

      // Validate input
      if (fhirData.patient) {
        const validation = FHIRValidator.validatePatient(fhirData.patient);
        if (!validation.isValid) {
          errors.push(...validation.errors);
        }
      }

      if (fhirData.observations) {
        fhirData.observations.forEach((obs: any) => {
          const validation = FHIRValidator.validateObservation(obs.resource);
          if (!validation.isValid) {
            errors.push(...validation.errors);
          }
        });
      }

      if (errors.length > 0) {
        await auditLogger.clinical('FHIR_IMPORT_FAILED', false, {
          resource_type: 'FHIR_BUNDLE',
          connection_id: connectionId,
          error_count: errors.length,
          error_message: errors.join(', ')
        });
        return { success: false, errors };
      }

      // Log PHI access
      await auditLogger.phi('WRITE', connectionId, {
        resource_type: 'FHIR_BUNDLE',
        user_id: userId,
        resources_count: Object.keys(fhirData).length
      });

      // Sanitize input
      const sanitizedData = FHIRValidator.sanitizeInput(fhirData);

      // Import data (actual implementation in fhirInteroperabilityIntegrator.ts)
      // This is just a security wrapper

      await auditLogger.clinical('FHIR_IMPORT_COMPLETED', true, {
        resource_type: 'FHIR_BUNDLE',
        connection_id: connectionId,
        user_id: userId
      });

      return { success: true, errors: [] };
    } catch (error) {
      const sanitizedError = ErrorSanitizer.sanitize(error);
      await ErrorSanitizer.logError(error, { user_id: userId, connection_id: connectionId });
      return { success: false, errors: [sanitizedError] };
    }
  }

  /**
   * Securely export FHIR data with audit logging
   */
  static async exportFHIRData(
    userId: string,
    options?: Record<string, any>
  ): Promise<{ bundle: any; error?: string }> {
    try {
      // Rate limiting (stricter for exports)
      await RateLimiter.enforce('FHIR_EXPORT', 10, 60);

      // Log PHI export
      await auditLogger.phi('EXPORT', userId, {
        resource_type: 'FHIR_BUNDLE',
        user_id: userId,
        ...options
      });

      // Check for mass export (security concern)
      if (options?.includeAllPatients) {
        await supabase.rpc('log_security_event', {
          p_event_type: 'MASS_DATA_EXPORT',
          p_severity: 'HIGH',
          p_description: 'Mass FHIR data export attempted',
          p_metadata: { user_id: userId, options },
          p_requires_investigation: true,
        });
      }

      // Actual export implementation would go here
      // This is just a security wrapper

      await auditLogger.clinical('FHIR_EXPORT_COMPLETED', true, {
        resource_type: 'FHIR_BUNDLE',
        user_id: userId
      });

      return { bundle: {} }; // Placeholder
    } catch (error) {
      const sanitizedError = ErrorSanitizer.sanitize(error);
      await ErrorSanitizer.logError(error, { user_id: userId });
      await auditLogger.clinical('FHIR_EXPORT_FAILED', false, {
        resource_type: 'FHIR_BUNDLE',
        user_id: userId,
        error_message: sanitizedError
      });
      return { bundle: {}, error: sanitizedError };
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ErrorSanitizer,
  FHIRValidator,
  AuditLogger,
  RateLimiter,
  SecureFHIROperations,
};
