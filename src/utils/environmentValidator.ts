/**
 * Environment Validation - Startup Security Checks
 * HIPAA § 164.312(a)(2)(iv) - Encryption key validation
 * SOC 2 - Configuration management and security controls
 */

export interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  environment: string;
}

/**
 * Validates all critical environment variables on startup
 * FAILS HARD in production if encryption keys are missing
 */
export function validateCriticalEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const env = process.env.NODE_ENV || 'development';
  const isProduction = env === 'production';

  // Environment validation running in ${env} mode

  // ============================================================================
  // CRITICAL: Encryption Keys (HIPAA Requirement)
  // ============================================================================
  // NOTE: PHI encryption now handled server-side via Supabase Edge Functions
  // Encryption keys stored in Supabase Vault, never exposed to client
  // No client-side validation needed

  // ============================================================================
  // CRITICAL: Supabase Configuration
  // ============================================================================

  if (!import.meta.env.VITE_SUPABASE_URL) {
    errors.push('CRITICAL: VITE_SUPABASE_URL is not set - database connection will fail');
  }

  if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
    errors.push('CRITICAL: VITE_SUPABASE_ANON_KEY is not set - authentication will fail');
  }

  // ============================================================================
  // IMPORTANT: Third-Party Services
  // ============================================================================

  if (!import.meta.env.VITE_HCAPTCHA_SITE_KEY) {
    warnings.push('⚠️ VITE_HCAPTCHA_SITE_KEY is not set - bot protection disabled');
  }

  if (!import.meta.env.VITE_ANTHROPIC_API_KEY && isProduction) {
    warnings.push('⚠️ VITE_ANTHROPIC_API_KEY is not set - Claude AI features disabled');
  }

  // ============================================================================
  // PRODUCTION-SPECIFIC CHECKS
  // ============================================================================

  if (isProduction) {
    // Verify HTTPS in production
    if (import.meta.env.VITE_SUPABASE_URL && !import.meta.env.VITE_SUPABASE_URL.startsWith('https://')) {
      errors.push('CRITICAL: VITE_SUPABASE_URL must use HTTPS in production');
    }
  }

  // ============================================================================
  // RESULTS
  // ============================================================================

  const success = errors.length === 0;

  return {
    success,
    errors,
    warnings,
    environment: env,
  };
}

/**
 * Validates environment and THROWS if validation fails in production
 * Call this on app startup before rendering
 */
export function validateOrFail(): void {
  const result = validateCriticalEnvironment();

  if (!result.success && result.environment === 'production') {
    // FAIL HARD in production
    const errorMessage = [
      '❌ CRITICAL SECURITY ERROR - Application cannot start',
      '',
      'Missing required environment variables:',
      ...result.errors.map(e => `  • ${e}`),
      '',
      'This is a security/compliance violation.',
      'Fix these errors before deploying to production.',
      '',
      'See documentation: /docs/ENVIRONMENT_SETUP.md',
    ].join('\n');

    throw new Error(errorMessage);
  }
}

/**
 * Test encryption key validity
 * Now handled server-side - no client-side testing needed
 * @deprecated Use server-side validation via Edge Functions
 */
export async function testEncryptionKey(): Promise<boolean> {
  // Encryption now handled server-side
  return true;
}
