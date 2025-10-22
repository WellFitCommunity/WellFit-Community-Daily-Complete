// src/utils/passwordValidator.ts
// SOC2 CC6.2: Client-side password validation helpers

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
}

const COMMON_PASSWORDS = [
  'password', 'Password1', 'Password123', '12345678', 'qwerty',
  'abc123', 'password1', 'admin123', 'welcome1', 'letmein',
  '1234567890', 'password123', 'admin', 'user', 'guest'
];

/**
 * Validate password against SOC2 complexity requirements
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 * - Not a common password
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  // Handle null/undefined input
  if (!password) {
    return {
      isValid: false,
      errors: ['Password is required'],
      strength: 'weak',
    };
  }

  // Check minimum length
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Check maximum length
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }

  // Check for uppercase
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check for lowercase
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check for number
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Check for special character
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*...)');
  }

  // Check against common passwords
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
    errors.push('This password is too common. Please choose a more secure password');
  }

  // Calculate strength
  const strength = calculatePasswordStrength(password);

  return {
    isValid: errors.length === 0,
    errors,
    strength,
  };
}

/**
 * Calculate password strength score
 */
function calculatePasswordStrength(password: string): 'weak' | 'medium' | 'strong' | 'very-strong' {
  let score = 0;

  // Length score
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Character variety score
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;

  // Patterns (negative score)
  if (/(.)\1{2,}/.test(password)) score -= 1; // Repeating characters
  if (/^[0-9]+$/.test(password)) score -= 2; // Numbers only
  if (/^[a-zA-Z]+$/.test(password)) score -= 1; // Letters only

  // Determine strength
  if (score <= 3) return 'weak';
  if (score <= 5) return 'medium';
  if (score <= 7) return 'strong';
  return 'very-strong';
}

/**
 * Get password strength color for UI
 */
export function getPasswordStrengthColor(strength: string): string {
  switch (strength) {
    case 'weak':
      return '#ef4444'; // red
    case 'medium':
      return '#f59e0b'; // amber
    case 'strong':
      return '#10b981'; // green
    case 'very-strong':
      return '#059669'; // dark green
    default:
      return '#6b7280'; // gray
  }
}

/**
 * Format password requirements for display
 */
export function getPasswordRequirements(): string[] {
  return [
    'At least 8 characters long',
    'At least one uppercase letter (A-Z)',
    'At least one lowercase letter (a-z)',
    'At least one number (0-9)',
    'At least one special character (!@#$%^&*...)',
    'Not a commonly used password',
  ];
}
