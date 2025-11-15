/**
 * Phone Number Validation using libphonenumber-js
 * Validates phone numbers before calling Twilio (cost savings + better UX)
 * HIPAA § 164.312(c)(1) - Integrity controls
 */

import { parsePhoneNumber, isValidPhoneNumber, CountryCode } from 'libphonenumber-js';

/**
 * List of allowed country codes for phone numbers
 * Expand this list as you support more regions
 */
const ALLOWED_COUNTRIES: CountryCode[] = [
  'US', // United States
  'CA', // Canada
  'GB', // United Kingdom
  'AU', // Australia
  // Add more as needed
];

export interface PhoneValidationResult {
  isValid: boolean;
  e164: string; // Normalized E.164 format (+1234567890)
  country?: string;
  nationalNumber?: string;
  error?: string;
}

/**
 * Validate and normalize a phone number
 *
 * @param phone - Phone number in any format
 * @param defaultCountry - Default country code if not specified (default: 'US')
 * @returns Validation result with normalized E.164 format
 *
 * @example
 * ```ts
 * const result = validatePhone('(555) 123-4567');
 * // {
 * //   isValid: true,
 * //   e164: '+15551234567',
 * //   country: 'US',
 * //   nationalNumber: '5551234567'
 * // }
 *
 * const invalid = validatePhone('123');
 * // {
 * //   isValid: false,
 * //   e164: '',
 * //   error: 'Invalid phone number'
 * // }
 * ```
 */
export function validatePhone(
  phone: string | null | undefined,
  defaultCountry: CountryCode = 'US'
): PhoneValidationResult {
  // Handle empty input
  if (!phone || phone.trim() === '') {
    return {
      isValid: false,
      e164: '',
      error: 'Phone number is required'
    };
  }

  const cleaned = phone.trim();

  try {
    // Quick validation first (faster)
    if (!isValidPhoneNumber(cleaned, defaultCountry)) {
      return {
        isValid: false,
        e164: '',
        error: 'Invalid phone number format'
      };
    }

    // Parse for detailed information
    const phoneNumber = parsePhoneNumber(cleaned, defaultCountry);

    // Check if country is allowed
    if (!ALLOWED_COUNTRIES.includes(phoneNumber.country as CountryCode)) {
      return {
        isValid: false,
        e164: '',
        error: `Phone numbers from ${phoneNumber.country} are not currently supported`
      };
    }

    // Check if it's a mobile number (optional - Twilio works with landlines too)
    // Uncomment if you want to restrict to mobile only:
    // if (phoneNumber.getType() !== 'MOBILE') {
    //   return {
    //     isValid: false,
    //     e164: '',
    //     error: 'Only mobile phone numbers are accepted'
    //   };
    // }

    return {
      isValid: true,
      e164: phoneNumber.number, // E.164 format: +15551234567
      country: phoneNumber.country,
      nationalNumber: phoneNumber.nationalNumber
    };
  } catch (error) {
    return {
      isValid: false,
      e164: '',
      error: 'Invalid phone number format'
    };
  }
}

/**
 * Validate phone number and return E.164 format or throw error
 * Use this when you want to fail fast
 *
 * @param phone - Phone number to validate
 * @param defaultCountry - Default country code
 * @returns E.164 formatted phone number (+15551234567)
 * @throws Error if invalid
 *
 * @example
 * ```ts
 * try {
 *   const e164 = validatePhoneStrict('555-123-4567');
 *   // '+15551234567'
 * } catch (error) {
 *   console.error('Invalid phone:', error.message);
 * }
 * ```
 */
export function validatePhoneStrict(
  phone: string | null | undefined,
  defaultCountry: CountryCode = 'US'
): string {
  const result = validatePhone(phone, defaultCountry);

  if (!result.isValid) {
    throw new Error(result.error || 'Invalid phone number');
  }

  return result.e164;
}

/**
 * Format phone number for display (national format)
 *
 * @param phone - Phone number in any format
 * @param defaultCountry - Default country code
 * @returns Formatted phone number for display
 *
 * @example
 * ```ts
 * formatPhoneForDisplay('+15551234567');
 * // '(555) 123-4567'
 *
 * formatPhoneForDisplay('5551234567');
 * // '(555) 123-4567'
 * ```
 */
export function formatPhoneForDisplay(
  phone: string | null | undefined,
  defaultCountry: CountryCode = 'US'
): string {
  if (!phone) return '';

  try {
    const phoneNumber = parsePhoneNumber(phone, defaultCountry);
    return phoneNumber.formatNational(); // (555) 123-4567
  } catch {
    return phone; // Return original if parsing fails
  }
}

/**
 * Check if phone number is from allowed country
 *
 * @param phone - Phone number to check
 * @returns true if country is allowed
 */
export function isAllowedCountry(phone: string): boolean {
  try {
    const phoneNumber = parsePhoneNumber(phone);
    return ALLOWED_COUNTRIES.includes(phoneNumber.country as CountryCode);
  } catch {
    return false;
  }
}

/**
 * Get country code from phone number
 *
 * @param phone - Phone number
 * @returns Country code (e.g., 'US', 'CA') or null if invalid
 */
export function getPhoneCountry(phone: string): string | null {
  try {
    const phoneNumber = parsePhoneNumber(phone);
    return phoneNumber.country || null;
  } catch {
    return null;
  }
}

/**
 * Normalize phone number to E.164 format (backward compatible)
 * This is the safe version of the old normalizePhone function
 *
 * @param phone - Phone number in any format
 * @returns E.164 formatted number or empty string if invalid
 */
export function normalizePhone(phone: string): string {
  const result = validatePhone(phone);
  return result.isValid ? result.e164 : '';
}

/**
 * Add allowed country codes dynamically
 * Use this if you expand to more regions
 *
 * @param countries - Array of country codes to add
 */
export function addAllowedCountries(countries: CountryCode[]): void {
  for (const country of countries) {
    if (!ALLOWED_COUNTRIES.includes(country)) {
      ALLOWED_COUNTRIES.push(country);
    }
  }
}

/**
 * Get list of currently allowed countries
 */
export function getAllowedCountries(): readonly CountryCode[] {
  return Object.freeze([...ALLOWED_COUNTRIES]);
}
