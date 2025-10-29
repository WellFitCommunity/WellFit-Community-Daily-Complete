// Input Sanitization Utilities - XSS Protection
// Uses DOMPurify to sanitize user input before rendering

import DOMPurify from 'dompurify';

/**
 * Configuration profiles for different sanitization needs
 */
const SANITIZE_CONFIGS: Record<string, any> = {
  // Strictest - removes all HTML, only plain text
  PLAIN_TEXT: {
    ALLOWED_TAGS: [] as string[],
    ALLOWED_ATTR: [] as string[],
    KEEP_CONTENT: true
  },

  // Basic formatting - allows simple text formatting
  BASIC_FORMAT: {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br', 'p'] as string[],
    ALLOWED_ATTR: [] as string[],
    KEEP_CONTENT: true
  },

  // Rich text - allows more HTML for notes and documentation
  RICH_TEXT: {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'u', 'br', 'p', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre'
    ] as string[],
    ALLOWED_ATTR: ['class'] as string[],
    KEEP_CONTENT: true
  },

  // Links allowed - for content that may contain URLs
  WITH_LINKS: {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'u', 'br', 'p', 'a'
    ] as string[],
    ALLOWED_ATTR: ['href', 'target', 'rel'] as string[],
    KEEP_CONTENT: true,
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i
  }
};

/**
 * Sanitize user input to prevent XSS attacks
 *
 * @param dirty - The potentially unsafe string
 * @param level - Sanitization level ('plain' | 'basic' | 'rich' | 'links')
 * @returns Sanitized safe string
 *
 * @example
 * ```ts
 * const userInput = '<script>alert("xss")</script>Hello';
 * const safe = sanitize(userInput, 'plain'); // Returns: "Hello"
 * ```
 */
export function sanitize(
  dirty: string | null | undefined,
  level: 'plain' | 'basic' | 'rich' | 'links' = 'plain'
): string {
  if (!dirty) return '';

  const configMap = {
    plain: SANITIZE_CONFIGS.PLAIN_TEXT,
    basic: SANITIZE_CONFIGS.BASIC_FORMAT,
    rich: SANITIZE_CONFIGS.RICH_TEXT,
    links: SANITIZE_CONFIGS.WITH_LINKS
  };

  const config = configMap[level];
  return DOMPurify.sanitize(dirty, config) as unknown as string;
}

/**
 * Sanitize object properties recursively
 * Useful for sanitizing entire form data or API responses
 *
 * @param obj - Object to sanitize
 * @param level - Sanitization level
 * @param keys - Optional array of keys to sanitize (default: all string values)
 * @returns Sanitized object
 *
 * @example
 * ```ts
 * const formData = {
 *   name: '<script>XSS</script>John',
 *   notes: 'Patient seems <strong>well</strong>'
 * };
 * const safe = sanitizeObject(formData, 'basic');
 * // { name: 'John', notes: 'Patient seems <strong>well</strong>' }
 * ```
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  level: 'plain' | 'basic' | 'rich' | 'links' = 'plain',
  keys?: string[]
): T {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = { ...obj };

  for (const key in sanitized) {
    // If keys array provided, only sanitize specified keys
    if (keys && !keys.includes(key)) continue;

    const value = sanitized[key];

    if (typeof value === 'string') {
      sanitized[key] = sanitize(value, level) as T[Extract<keyof T, string>];
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item: any) =>
        typeof item === 'string' ? sanitize(item, level) : item
      ) as T[Extract<keyof T, string>];
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, level, keys) as T[Extract<keyof T, string>];
    }
  }

  return sanitized;
}

/**
 * Validate and sanitize email addresses
 *
 * @param email - Email to validate
 * @returns Sanitized email or empty string if invalid
 */
export function sanitizeEmail(email: string | null | undefined): string {
  if (!email) return '';

  // Basic email validation regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  const trimmed = email.trim().toLowerCase();

  if (!emailRegex.test(trimmed)) {

    return '';
  }

  return trimmed;
}

/**
 * Sanitize phone numbers to E.164 format
 *
 * @param phone - Phone number to sanitize
 * @returns Sanitized phone number with only digits and +
 */
export function sanitizePhone(phone: string | null | undefined): string {
  if (!phone) return '';

  // Remove all non-digit characters except +
  let clean = phone.replace(/[^\d+]/g, '');

  // Ensure only one + at the start
  if (clean.startsWith('+')) {
    clean = '+' + clean.substring(1).replace(/\+/g, '');
  } else {
    clean = clean.replace(/\+/g, '');
  }

  return clean;
}

/**
 * Sanitize file names to prevent path traversal attacks
 *
 * @param filename - File name to sanitize
 * @returns Safe filename
 */
export function sanitizeFileName(filename: string | null | undefined): string {
  if (!filename || filename.trim() === '') return 'unnamed';

  // Remove path separators and null bytes
  let safe = filename.replace(/[/\\:\0]/g, '');

  // Remove leading dots to prevent hidden files
  safe = safe.replace(/^\.+/, '');

  // Limit length
  if (safe.length > 255) {
    const ext = safe.substring(safe.lastIndexOf('.'));
    safe = safe.substring(0, 255 - ext.length) + ext;
  }

  return safe.length > 0 ? safe : 'unnamed';
}

/**
 * Sanitize SQL-like strings to prevent SQL injection
 * NOTE: This is NOT a substitute for parameterized queries!
 * Only use as defense-in-depth for display purposes
 *
 * @param input - Input that might be used in SQL context
 * @returns Escaped string
 */
export function sanitizeForSQL(input: string | null | undefined): string {
  if (!input) return '';

  // Escape single quotes by doubling them (standard SQL escaping)
  return input.replace(/'/g, "''");
}

/**
 * Sanitize URLs to prevent javascript: and data: schemes
 *
 * @param url - URL to sanitize
 * @returns Safe URL or empty string if dangerous
 */
export function sanitizeURL(url: string | null | undefined): string {
  if (!url) return '';

  const trimmed = url.trim().toLowerCase();

  // Block dangerous protocols
  // eslint-disable-next-line no-script-url
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
  for (const protocol of dangerousProtocols) {
    if (trimmed.startsWith(protocol)) {

      return '';
    }
  }

  // Only allow http, https, mailto, tel
  if (!trimmed.match(/^(https?|mailto|tel):/)) {
    // Relative URLs are OK
    if (!trimmed.startsWith('/') && !trimmed.startsWith('#')) {

      return '';
    }
  }

  return url.trim();
}

/**
 * React hook for sanitizing form inputs on change
 *
 * @param level - Sanitization level
 * @returns Object with sanitize function
 *
 * @example
 * ```tsx
 * const { sanitizeInput } = useSanitize('basic');
 *
 * <input
 *   value={value}
 *   onChange={(e) => setValue(sanitizeInput(e.target.value))}
 * />
 * ```
 */
export function useSanitize(level: 'plain' | 'basic' | 'rich' | 'links' = 'plain') {
  const sanitizeInput = (value: string): string => sanitize(value, level);

  return {
    sanitize: sanitizeInput,
    sanitizeObject: <T extends Record<string, any>>(obj: T, keys?: string[]) =>
      sanitizeObject(obj, level, keys)
  };
}

/**
 * Sanitize clinical notes and documentation
 * Allows basic formatting but strict XSS protection
 */
export const sanitizeClinicalNotes = (notes: string | null | undefined): string =>
  sanitize(notes, 'basic');

/**
 * Sanitize patient names and personal info
 * Strictest - plain text only
 */
export const sanitizePersonalInfo = (info: string | null | undefined): string =>
  sanitize(info, 'plain');

/**
 * Sanitize diagnosis and medical codes
 * Alphanumeric and basic punctuation only
 */
export function sanitizeMedicalCode(code: string | null | undefined): string {
  if (!code) return '';

  // Allow only alphanumeric, dots, and hyphens
  return code.replace(/[^a-zA-Z0-9.-]/g, '').toUpperCase();
}

const SanitizeUtils = {
  sanitize,
  sanitizeObject,
  sanitizeEmail,
  sanitizePhone,
  sanitizeFileName,
  sanitizeForSQL,
  sanitizeURL,
  sanitizeClinicalNotes,
  sanitizePersonalInfo,
  sanitizeMedicalCode,
  useSanitize
};

export default SanitizeUtils;
