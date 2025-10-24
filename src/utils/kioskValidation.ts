/**
 * Kiosk Input Validation Utilities
 * Prevents injection attacks and validates patient identifiers
 * HIPAA Compliance: Input sanitization for security
 */

/**
 * Validates and sanitizes name input
 * Allows: Letters, spaces, hyphens, apostrophes
 * Blocks: SQL injection, XSS, special chars
 */
export function validateName(name: string): { valid: boolean; sanitized: string; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, sanitized: '', error: 'Name is required' };
  }

  const trimmed = name.trim();

  if (trimmed.length < 2) {
    return { valid: false, sanitized: trimmed, error: 'Name must be at least 2 characters' };
  }

  if (trimmed.length > 50) {
    return { valid: false, sanitized: trimmed.slice(0, 50), error: 'Name too long' };
  }

  // Allow only letters, spaces, hyphens, apostrophes, and accented characters
  const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]+$/;
  if (!nameRegex.test(trimmed)) {
    return { valid: false, sanitized: trimmed, error: 'Name contains invalid characters' };
  }

  // Block common SQL injection patterns
  const sqlPattern = /(union|select|insert|update|delete|drop|create|alter|exec|script)/i;
  if (sqlPattern.test(trimmed)) {
    return { valid: false, sanitized: '', error: 'Invalid input detected' };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Validates Date of Birth
 * Must be in YYYY-MM-DD format
 * Must be between 1900 and today
 * Patient must be at least 1 day old and less than 120 years old
 */
export function validateDOB(dob: string): { valid: boolean; error?: string } {
  if (!dob || typeof dob !== 'string') {
    return { valid: false, error: 'Date of birth is required' };
  }

  // Check format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dob)) {
    return { valid: false, error: 'Invalid date format' };
  }

  const dobDate = new Date(dob);
  const today = new Date();
  const minDate = new Date('1900-01-01');

  if (isNaN(dobDate.getTime())) {
    return { valid: false, error: 'Invalid date' };
  }

  if (dobDate > today) {
    return { valid: false, error: 'Date of birth cannot be in the future' };
  }

  if (dobDate < minDate) {
    return { valid: false, error: 'Date of birth too far in the past' };
  }

  // Check if person is less than 120 years old
  const age = (today.getTime() - dobDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (age > 120) {
    return { valid: false, error: 'Invalid date of birth' };
  }

  return { valid: true };
}

/**
 * Validates last 4 digits of SSN
 * Must be exactly 4 digits
 * Blocks: Common test SSNs (0000, 1111, etc.)
 */
export function validateSSNLast4(ssn: string): { valid: boolean; sanitized: string; error?: string } {
  if (!ssn || typeof ssn !== 'string') {
    return { valid: false, sanitized: '', error: 'Last 4 of SSN is required' };
  }

  const trimmed = ssn.trim();

  // Must be exactly 4 digits
  const ssnRegex = /^\d{4}$/;
  if (!ssnRegex.test(trimmed)) {
    return { valid: false, sanitized: trimmed, error: 'Last 4 of SSN must be exactly 4 digits' };
  }

  // Block obviously fake SSNs
  const fakePatterns = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999'];
  if (fakePatterns.includes(trimmed)) {
    return { valid: false, sanitized: trimmed, error: 'Invalid SSN' };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Validates PIN (if provided)
 * Must be 4-6 digits
 * Blocks: Common PINs (1234, 0000, etc.)
 */
export function validatePIN(pin: string): { valid: boolean; sanitized: string; error?: string } {
  if (!pin || typeof pin !== 'string') {
    // PIN is optional
    return { valid: true, sanitized: '' };
  }

  const trimmed = pin.trim();

  if (trimmed.length === 0) {
    // Empty PIN is OK (optional field)
    return { valid: true, sanitized: '' };
  }

  // Must be 4-6 digits
  const pinRegex = /^\d{4,6}$/;
  if (!pinRegex.test(trimmed)) {
    return { valid: false, sanitized: trimmed, error: 'PIN must be 4-6 digits' };
  }

  // Block common weak PINs
  const weakPins = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '0123'];
  if (weakPins.includes(trimmed.slice(0, 4))) {
    return { valid: false, sanitized: trimmed, error: 'PIN too common' };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Sanitizes kiosk ID to prevent injection
 */
export function sanitizeKioskId(kioskId: string): string {
  if (!kioskId || typeof kioskId !== 'string') {
    return 'unknown-kiosk';
  }

  // Allow only alphanumeric, hyphens, underscores
  return kioskId.replace(/[^a-zA-Z0-9\-_]/g, '').slice(0, 50);
}

/**
 * Sanitizes location name
 */
export function sanitizeLocationName(location: string): string {
  if (!location || typeof location !== 'string') {
    return 'Unknown Location';
  }

  // Allow letters, numbers, spaces, common punctuation
  const sanitized = location.replace(/[^a-zA-Z0-9\s,.\-()&]/g, '').trim();
  return sanitized.slice(0, 100);
}

/**
 * Rate limiting for failed attempts
 * Helps prevent brute force attacks
 */
export class RateLimiter {
  private attempts: Map<string, { count: number; firstAttempt: number }> = new Map();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts: number = 5, windowMs: number = 300000) { // 5 attempts per 5 minutes
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  /**
   * Check if identifier has exceeded rate limit
   */
  isRateLimited(identifier: string): boolean {
    const now = Date.now();
    const record = this.attempts.get(identifier);

    if (!record) {
      return false;
    }

    // Check if window has expired
    if (now - record.firstAttempt > this.windowMs) {
      this.attempts.delete(identifier);
      return false;
    }

    return record.count >= this.maxAttempts;
  }

  /**
   * Record a failed attempt
   */
  recordAttempt(identifier: string): void {
    const now = Date.now();
    const record = this.attempts.get(identifier);

    if (!record || now - record.firstAttempt > this.windowMs) {
      this.attempts.set(identifier, { count: 1, firstAttempt: now });
    } else {
      record.count++;
    }
  }

  /**
   * Clear attempts for identifier (on successful login)
   */
  clearAttempts(identifier: string): void {
    this.attempts.delete(identifier);
  }

  /**
   * Clean up old entries (call periodically)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.attempts.entries()) {
      if (now - record.firstAttempt > this.windowMs) {
        this.attempts.delete(key);
      }
    }
  }
}
