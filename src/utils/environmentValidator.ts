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

  console.log(`🔍 Running environment validation (${env} mode)...`);

  // ============================================================================
  // CRITICAL: Encryption Keys (HIPAA Requirement)
  // ============================================================================

  const phiKey = process.env.REACT_APP_PHI_ENCRYPTION_KEY;
  if (!phiKey) {
    const message = 'REACT_APP_PHI_ENCRYPTION_KEY is not set - PHI encryption will fail';
    if (isProduction) {
      errors.push(`CRITICAL: ${message}`);
    } else {
      warnings.push(`⚠️ ${message} (using temporary key in development)`);
    }
  } else if (phiKey.length < 32) {
    const message = 'REACT_APP_PHI_ENCRYPTION_KEY is too short (minimum 32 characters for AES-256)';
    if (isProduction) {
      errors.push(`CRITICAL: ${message}`);
    } else {
      warnings.push(`⚠️ ${message}`);
    }
  }

  // ============================================================================
  // CRITICAL: Supabase Configuration
  // ============================================================================

  if (!process.env.REACT_APP_SUPABASE_URL) {
    errors.push('CRITICAL: REACT_APP_SUPABASE_URL is not set - database connection will fail');
  }

  if (!process.env.REACT_APP_SUPABASE_ANON_KEY) {
    errors.push('CRITICAL: REACT_APP_SUPABASE_ANON_KEY is not set - authentication will fail');
  }

  // ============================================================================
  // IMPORTANT: Third-Party Services
  // ============================================================================

  if (!process.env.REACT_APP_HCAPTCHA_SITE_KEY) {
    warnings.push('⚠️ REACT_APP_HCAPTCHA_SITE_KEY is not set - bot protection disabled');
  }

  if (!process.env.REACT_APP_ANTHROPIC_API_KEY && isProduction) {
    warnings.push('⚠️ REACT_APP_ANTHROPIC_API_KEY is not set - Claude AI features disabled');
  }

  // ============================================================================
  // PRODUCTION-SPECIFIC CHECKS
  // ============================================================================

  if (isProduction) {
    // Verify we're not using default/example keys
    if (phiKey && (phiKey.includes('EXAMPLE') || phiKey.includes('CHANGE_ME'))) {
      errors.push('CRITICAL: PHI_ENCRYPTION_KEY appears to be a default/example value');
    }

    // Verify HTTPS in production
    if (process.env.REACT_APP_SUPABASE_URL && !process.env.REACT_APP_SUPABASE_URL.startsWith('https://')) {
      errors.push('CRITICAL: REACT_APP_SUPABASE_URL must use HTTPS in production');
    }
  }

  // ============================================================================
  // RESULTS
  // ============================================================================

  const success = errors.length === 0;

  if (success) {
    console.log('✅ Environment validation passed');
    if (warnings.length > 0) {
      console.warn(`⚠️ ${warnings.length} warning(s):`, warnings);
    }
  } else {
    console.error('❌ Environment validation FAILED');
    console.error(`${errors.length} critical error(s):`, errors);
    if (warnings.length > 0) {
      console.warn(`${warnings.length} warning(s):`, warnings);
    }
  }

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

    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  if (!result.success && result.environment !== 'production') {
    // In development, warn but don't fail
    console.warn('⚠️ Environment validation failed (non-production mode - allowing startup)');
    console.warn('Errors:', result.errors);
    console.warn('Fix these before deploying to production!');
  }
}

/**
 * Test encryption key validity
 * Returns true if encryption works correctly
 */
export async function testEncryptionKey(): Promise<boolean> {
  try {
    const testData = 'PHI_ENCRYPTION_TEST_' + Date.now();

    // Try to import the key
    const keyMaterial = process.env.REACT_APP_PHI_ENCRYPTION_KEY;
    if (!keyMaterial) return false;

    // Convert to bytes
    const keyBytes = Uint8Array.from(atob(keyMaterial), c => c.charCodeAt(0));

    // Try to import as crypto key
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    // Try a test encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      encoder.encode(testData)
    );

    return true;
  } catch (error) {
    console.error('❌ Encryption key test failed:', error);
    return false;
  }
}
