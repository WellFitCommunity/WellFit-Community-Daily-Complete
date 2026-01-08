/**
 * Additional setup for security and penetration testing
 *
 * This file is loaded for security test suites to provide
 * additional utilities and configurations specific to security testing.
 */

// ============================================
// OWASP Top 10 Test Utilities
// ============================================

/**
 * Test for Broken Access Control (OWASP #1)
 */
export function testAccessControl(
  userRole: string,
  allowedRoles: string[],
  action: () => unknown
): void {
  if (!allowedRoles.includes(userRole)) {
    expect(action).toThrow(/unauthorized|forbidden|access denied/i);
  } else {
    expect(action).not.toThrow();
  }
}

/**
 * Test for Cryptographic Failures (OWASP #2)
 */
export function testEncryptionStrength(algorithm: string): boolean {
  const weakAlgorithms = ['md5', 'sha1', 'des', 'rc4'];
  const strongAlgorithms = ['aes-256', 'sha256', 'sha512', 'bcrypt', 'argon2'];

  if (weakAlgorithms.includes(algorithm.toLowerCase())) {
    return false; // Weak encryption
  }

  return strongAlgorithms.some((strong) =>
    algorithm.toLowerCase().includes(strong)
  );
}

/**
 * Test for Injection vulnerabilities (OWASP #3)
 */
export function testInjectionVulnerability(
  input: string,
  sanitizedOutput: string
): boolean {
  // Check for common injection patterns
  const injectionPatterns = [
    /<script/i,
    /javascript:/i,
    /onerror=/i,
    /onclick=/i,
    /'; DROP/i,
    /UNION SELECT/i,
    /\$ne:/i,
    /\|\|/,
    /&&/,
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(input) && pattern.test(sanitizedOutput)) {
      return true; // Vulnerable - injection not sanitized
    }
  }

  return false; // Safe - injection patterns removed
}

/**
 * Test for Insecure Design (OWASP #4)
 */
export function testRateLimitImplementation(
  attempts: number,
  timeWindow: number,
  maxAttempts: number
): boolean {
  return attempts <= maxAttempts;
}

/**
 * Test for Security Misconfiguration (OWASP #5)
 */
export function testSecurityHeaders(headers: Record<string, string>): {
  passed: boolean;
  missing: string[];
  warnings: string[];
} {
  const requiredHeaders = [
    'Content-Security-Policy',
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Strict-Transport-Security',
  ];

  const recommendedHeaders = [
    'Referrer-Policy',
    'Permissions-Policy',
    'X-XSS-Protection',
  ];

  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required headers
  for (const header of requiredHeaders) {
    if (!headers[header]) {
      missing.push(header);
    }
  }

  // Check recommended headers
  for (const header of recommendedHeaders) {
    if (!headers[header]) {
      warnings.push(`Recommended header missing: ${header}`);
    }
  }

  // Check for insecure values
  if (headers['X-Frame-Options'] === 'ALLOW') {
    warnings.push('X-Frame-Options should be DENY or SAMEORIGIN');
  }

  if (headers['Content-Security-Policy']?.includes("'unsafe-inline'")) {
    warnings.push('CSP contains unsafe-inline directive');
  }

  return {
    passed: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Test for Vulnerable and Outdated Components (OWASP #6)
 */
export function testDependencyVersions(
  dependencies: Record<string, string>
): { vulnerable: string[]; outdated: string[] } {
  const vulnerable: string[] = [];
  const outdated: string[] = [];

  // Check for known vulnerable versions
  const knownVulnerabilities: Record<string, string[]> = {
    'lodash': ['<4.17.21'],
    'moment': ['<2.29.4'],
    'axios': ['<0.21.2'],
  };

  for (const [pkg, version] of Object.entries(dependencies)) {
    if (knownVulnerabilities[pkg]) {
      vulnerable.push(`${pkg}@${version}`);
    }
  }

  return { vulnerable, outdated };
}

/**
 * Test for Identification and Authentication Failures (OWASP #7)
 */
export function testAuthenticationSecurity(config: {
  passwordMinLength: number;
  mfaEnabled: boolean;
  sessionTimeout: number;
  lockoutThreshold: number;
}): { passed: boolean; issues: string[] } {
  const issues: string[] = [];

  if (config.passwordMinLength < 12) {
    issues.push('Password minimum length should be at least 12 characters');
  }

  if (!config.mfaEnabled) {
    issues.push('Multi-factor authentication should be enabled');
  }

  if (config.sessionTimeout > 3600000) {
    // 1 hour
    issues.push('Session timeout is too long (max 1 hour recommended)');
  }

  if (config.lockoutThreshold > 5) {
    issues.push('Account lockout threshold is too high (max 5 attempts)');
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

/**
 * Test for Software and Data Integrity Failures (OWASP #8)
 */
export function testIntegrityChecks(config: {
  usesSubresourceIntegrity: boolean;
  validatesCertificates: boolean;
  checksSignatures: boolean;
}): { passed: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!config.usesSubresourceIntegrity) {
    issues.push('Subresource Integrity (SRI) not implemented');
  }

  if (!config.validatesCertificates) {
    issues.push('Certificate validation not enabled');
  }

  if (!config.checksSignatures) {
    issues.push('Code signature verification not implemented');
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

/**
 * Test for Security Logging and Monitoring Failures (OWASP #9)
 */
export function testLoggingAndMonitoring(config: {
  logsSecurityEvents: boolean;
  hasAlertingSystem: boolean;
  retentionPeriod: number; // in days
  masksSensitiveData: boolean;
}): { passed: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!config.logsSecurityEvents) {
    issues.push('Security events are not being logged');
  }

  if (!config.hasAlertingSystem) {
    issues.push('No alerting system configured for security events');
  }

  if (config.retentionPeriod < 90) {
    issues.push('Log retention period should be at least 90 days');
  }

  if (!config.masksSensitiveData) {
    issues.push('Sensitive data is not being masked in logs');
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

/**
 * Test for Server-Side Request Forgery (OWASP #10)
 */
export function testSSRFProtection(url: string): {
  safe: boolean;
  reason?: string;
} {
  // Check for private IP ranges
  const privateIPPatterns = [
    /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/,
    /^127\./,
    /^169\.254\./,
    /^::1$/,
    /^fe80:/,
    /^fc00:/,
    /^fd00:/,
  ];

  // Check for localhost
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    return { safe: false, reason: 'Localhost access detected' };
  }

  // Extract hostname
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Check against private IP patterns
    for (const pattern of privateIPPatterns) {
      if (pattern.test(hostname)) {
        return {
          safe: false,
          reason: 'Private IP range access detected',
        };
      }
    }

    // Check for metadata endpoints (AWS, GCP, Azure)
    const metadataEndpoints = [
      '169.254.169.254',
      'metadata.google.internal',
      'metadata.azure.com',
    ];

    if (metadataEndpoints.some((endpoint) => hostname.includes(endpoint))) {
      return {
        safe: false,
        reason: 'Cloud metadata endpoint access detected',
      };
    }

    return { safe: true };
  } catch (error) {
    return { safe: false, reason: 'Invalid URL format' };
  }
}

// ============================================
// Penetration Testing Utilities
// ============================================

/**
 * Brute force attack simulation
 */
export async function simulateBruteForce(
  loginFn: (username: string, password: string) => Promise<boolean>,
  username: string,
  maxAttempts: number = 100
): Promise<{ blocked: boolean; attempts: number }> {
  const commonPasswords = [
    'password',
    '123456',
    '12345678',
    'qwerty',
    'abc123',
    'monkey',
    '1234567',
    'letmein',
    'trustno1',
    'dragon',
  ];

  let attempts = 0;
  let blocked = false;

  for (const password of commonPasswords) {
    if (attempts >= maxAttempts) break;

    try {
      await loginFn(username, password);
      attempts++;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('rate limit') || errorMessage.includes('locked')) {
        blocked = true;
        break;
      }
      attempts++;
    }
  }

  return { blocked, attempts };
}

/**
 * Session hijacking test
 */
export function testSessionSecurity(sessionToken: string): {
  secure: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check token length
  if (sessionToken.length < 32) {
    issues.push('Session token is too short (minimum 32 characters)');
  }

  // Check for predictable patterns
  if (/^\d+$/.test(sessionToken)) {
    issues.push('Session token appears to be sequential');
  }

  // Check entropy
  const uniqueChars = new Set(sessionToken.split('')).size;
  if (uniqueChars < 16) {
    issues.push('Session token has low entropy');
  }

  return {
    secure: issues.length === 0,
    issues,
  };
}

/**
 * CSRF protection test
 */
export function testCSRFProtection(config: {
  hasCSRFToken: boolean;
  tokenInHeader: boolean;
  sameSiteCookie: boolean;
}): { protected: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!config.hasCSRFToken) {
    issues.push('No CSRF token present');
  }

  if (!config.tokenInHeader) {
    issues.push('CSRF token should be in custom header');
  }

  if (!config.sameSiteCookie) {
    issues.push('SameSite cookie attribute not set');
  }

  return {
    protected: issues.length === 0,
    issues,
  };
}

// Export all utilities
export default {
  testAccessControl,
  testEncryptionStrength,
  testInjectionVulnerability,
  testRateLimitImplementation,
  testSecurityHeaders,
  testDependencyVersions,
  testAuthenticationSecurity,
  testIntegrityChecks,
  testLoggingAndMonitoring,
  testSSRFProtection,
  simulateBruteForce,
  testSessionSecurity,
  testCSRFProtection,
};
