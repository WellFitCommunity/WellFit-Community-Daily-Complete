/**
 * INPUT VALIDATION SERVICE
 *
 * HIPAA-compliant input validation and sanitization
 * Prevents: SQL injection, XSS, enumeration attacks, invalid geolocation
 *
 * Compliance: HIPAA §164.312(a)(1) - Access Control
 *
 * @module InputValidator
 */

import { auditLogger } from './auditLogger';

export class InputValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: any,
    public validationRule: string
  ) {
    super(message);
    this.name = 'InputValidationError';
  }
}

export class InputValidator {
  /**
   * Validate latitude (must be between -90 and 90)
   */
  static validateLatitude(lat: number, fieldName: string = 'latitude'): number {
    if (typeof lat !== 'number' || isNaN(lat)) {
      throw new InputValidationError(
        `${fieldName} must be a valid number`,
        fieldName,
        lat,
        'type_check'
      );
    }

    if (lat < -90 || lat > 90) {
      throw new InputValidationError(
        `${fieldName} must be between -90 and 90`,
        fieldName,
        lat,
        'range_check'
      );
    }

    return lat;
  }

  /**
   * Validate longitude (must be between -180 and 180)
   */
  static validateLongitude(lon: number, fieldName: string = 'longitude'): number {
    if (typeof lon !== 'number' || isNaN(lon)) {
      throw new InputValidationError(
        `${fieldName} must be a valid number`,
        fieldName,
        lon,
        'type_check'
      );
    }

    if (lon < -180 || lon > 180) {
      throw new InputValidationError(
        `${fieldName} must be between -180 and 180`,
        fieldName,
        lon,
        'range_check'
      );
    }

    return lon;
  }

  /**
   * Sanitize text input (remove HTML, script tags, SQL injection attempts)
   */
  static sanitizeText(input: string, maxLength: number = 1000): string {
    if (typeof input !== 'string') {
      throw new InputValidationError(
        'Input must be a string',
        'text_input',
        input,
        'type_check'
      );
    }

    // Remove HTML tags
    let sanitized = input.replace(/<[^>]*>/g, '');

    // Remove script content
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove potential SQL injection patterns
    sanitized = sanitized.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi, '');

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    // Enforce max length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
  }

  /**
   * Validate UUID format
   */
  static validateUUID(uuid: string, fieldName: string = 'uuid'): string {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(uuid)) {
      throw new InputValidationError(
        `${fieldName} must be a valid UUID`,
        fieldName,
        uuid,
        'format_check'
      );
    }

    return uuid;
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string, fieldName: string = 'email'): string {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!emailRegex.test(email)) {
      throw new InputValidationError(
        `${fieldName} must be a valid email address`,
        fieldName,
        email,
        'format_check'
      );
    }

    // Additional length check
    if (email.length > 254) {
      throw new InputValidationError(
        `${fieldName} exceeds maximum length`,
        fieldName,
        email,
        'length_check'
      );
    }

    return email.toLowerCase();
  }

  /**
   * Validate IP address format (IPv4 or IPv6)
   */
  static validateIPAddress(ip: string, fieldName: string = 'ip_address'): string {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::1|::)$/;

    if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
      throw new InputValidationError(
        `${fieldName} must be a valid IP address`,
        fieldName,
        ip,
        'format_check'
      );
    }

    return ip;
  }

  /**
   * Validate consent type
   */
  static validateConsentType(
    type: string,
    fieldName: string = 'consent_type'
  ): string {
    const validTypes = [
      'photo',
      'privacy',
      'treatment',
      'research',
      'marketing',
      'data_sharing',
      'telehealth',
      'ai_assisted_care',
      'third_party_integration',
      'wearable_data_collection',
    ];

    if (!validTypes.includes(type)) {
      throw new InputValidationError(
        `${fieldName} must be one of: ${validTypes.join(', ')}`,
        fieldName,
        type,
        'enum_check'
      );
    }

    return type;
  }

  /**
   * Validate anomaly type
   */
  static validateAnomalyType(
    type: string,
    fieldName: string = 'anomaly_type'
  ): string {
    const validTypes = [
      'impossible_travel',
      'unusual_access_time',
      'excessive_phi_access',
      'peer_group_deviation',
      'rapid_consecutive_access',
      'unauthorized_location',
    ];

    if (!validTypes.includes(type)) {
      throw new InputValidationError(
        `${fieldName} must be one of: ${validTypes.join(', ')}`,
        fieldName,
        type,
        'enum_check'
      );
    }

    return type;
  }

  /**
   * Validate risk level
   */
  static validateRiskLevel(
    level: string,
    fieldName: string = 'risk_level'
  ): string {
    const validLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

    if (!validLevels.includes(level)) {
      throw new InputValidationError(
        `${fieldName} must be one of: ${validLevels.join(', ')}`,
        fieldName,
        level,
        'enum_check'
      );
    }

    return level;
  }

  /**
   * Validate score (must be between 0 and 1)
   */
  static validateScore(
    score: number,
    fieldName: string = 'score'
  ): number {
    if (typeof score !== 'number' || isNaN(score)) {
      throw new InputValidationError(
        `${fieldName} must be a valid number`,
        fieldName,
        score,
        'type_check'
      );
    }

    if (score < 0 || score > 1) {
      throw new InputValidationError(
        `${fieldName} must be between 0 and 1`,
        fieldName,
        score,
        'range_check'
      );
    }

    return score;
  }

  /**
   * Validate positive integer
   */
  static validatePositiveInteger(
    value: number,
    fieldName: string = 'value'
  ): number {
    if (!Number.isInteger(value) || value < 0) {
      throw new InputValidationError(
        `${fieldName} must be a positive integer`,
        fieldName,
        value,
        'type_check'
      );
    }

    return value;
  }

  /**
   * Validate date range (must be in the past or within reasonable future)
   */
  static validateDateRange(
    date: Date,
    fieldName: string = 'date',
    maxFutureDays: number = 365
  ): Date {
    const now = new Date();
    const maxFuture = new Date();
    maxFuture.setDate(maxFuture.getDate() + maxFutureDays);

    if (date > maxFuture) {
      throw new InputValidationError(
        `${fieldName} cannot be more than ${maxFutureDays} days in the future`,
        fieldName,
        date,
        'range_check'
      );
    }

    return date;
  }

  /**
   * Validate pagination parameters
   */
  static validatePagination(params: {
    limit?: number;
    offset?: number;
  }): { limit: number; offset: number } {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new InputValidationError(
        'Limit must be an integer between 1 and 1000',
        'limit',
        limit,
        'range_check'
      );
    }

    if (!Number.isInteger(offset) || offset < 0) {
      throw new InputValidationError(
        'Offset must be a non-negative integer',
        'offset',
        offset,
        'range_check'
      );
    }

    return { limit, offset };
  }

  /**
   * Log validation failure for security monitoring
   */
  static async logValidationFailure(error: InputValidationError, userId?: string): Promise<void> {
    await auditLogger.error('INPUT_VALIDATION_FAILURE', error, {
      field: error.field,
      validation_rule: error.validationRule,
      user_id: userId,
      value_type: typeof error.value,
    });
  }

  /**
   * Validate and sanitize consent notes/withdrawal reasons
   */
  static validateConsentNotes(notes: string): string {
    // Sanitize and limit length
    const sanitized = this.sanitizeText(notes, 5000);

    // Ensure minimum length if provided
    if (sanitized.length > 0 && sanitized.length < 3) {
      throw new InputValidationError(
        'Notes must be at least 3 characters if provided',
        'notes',
        notes,
        'length_check'
      );
    }

    return sanitized;
  }

  /**
   * Validate file path for signature storage
   */
  static validateFilePath(filePath: string, userId: string): string {
    // Must start with user ID
    if (!filePath.startsWith(userId)) {
      throw new InputValidationError(
        'File path must start with user ID',
        'file_path',
        filePath,
        'authorization_check'
      );
    }

    // Must be PNG format
    if (!filePath.endsWith('.png')) {
      throw new InputValidationError(
        'File must be PNG format',
        'file_path',
        filePath,
        'format_check'
      );
    }

    // No directory traversal
    if (filePath.includes('..') || filePath.includes('//')) {
      throw new InputValidationError(
        'File path contains invalid characters',
        'file_path',
        filePath,
        'security_check'
      );
    }

    // Max length
    if (filePath.length > 500) {
      throw new InputValidationError(
        'File path exceeds maximum length',
        'file_path',
        filePath,
        'length_check'
      );
    }

    return filePath;
  }
}

export const inputValidator = InputValidator;
