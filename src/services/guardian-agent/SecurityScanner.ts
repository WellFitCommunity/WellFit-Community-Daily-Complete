/**
 * Security Scanner - Proactive security vulnerability detection
 */

import { DetectedIssue, ErrorContext, SeverityLevel } from './types';

interface SecurityVulnerability {
  type: 'xss' | 'sql_injection' | 'phi_exposure' | 'auth_bypass' | 'csrf' | 'insecure_storage' | 'code_injection';
  severity: SeverityLevel;
  description: string;
  location: string;
  evidence: string;
  remediation: string;
}

export class SecurityScanner {
  private scanHistory: SecurityVulnerability[] = [];
  private whitelistedPatterns: Set<string> = new Set();

  /**
   * Scans code for security vulnerabilities
   */
  async scanCode(code: string, filePath: string): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // XSS Detection
    vulnerabilities.push(...this.detectXSS(code, filePath));

    // SQL Injection Detection
    vulnerabilities.push(...this.detectSQLInjection(code, filePath));

    // PHI Exposure Detection
    vulnerabilities.push(...this.detectPHIExposure(code, filePath));

    // Authentication Issues
    vulnerabilities.push(...this.detectAuthIssues(code, filePath));

    // Insecure Storage
    vulnerabilities.push(...this.detectInsecureStorage(code, filePath));

    // Code Injection
    vulnerabilities.push(...this.detectCodeInjection(code, filePath));

    // Store scan results
    this.scanHistory.push(...vulnerabilities);

    return vulnerabilities;
  }

  /**
   * Scans runtime data for PHI exposure
   */
  async scanForPHI(data: any, context: ErrorContext): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    const dataString = JSON.stringify(data, null, 2);

    // SSN Pattern
    if (/\b\d{3}-\d{2}-\d{4}\b/.test(dataString)) {
      vulnerabilities.push({
        type: 'phi_exposure',
        severity: 'critical',
        description: 'Social Security Number detected in data',
        location: context.component || 'unknown',
        evidence: 'SSN pattern match',
        remediation: 'Mask SSN before logging or displaying'
      });
    }

    // Medical Record Number Pattern
    if (/\b(MRN|Medical Record Number):\s*\d+/i.test(dataString)) {
      vulnerabilities.push({
        type: 'phi_exposure',
        severity: 'critical',
        description: 'Medical Record Number detected in data',
        location: context.component || 'unknown',
        evidence: 'MRN pattern match',
        remediation: 'Remove PHI from logs and error messages'
      });
    }

    // Diagnosis codes
    if (/\b(ICD-10|diagnosis):/i.test(dataString)) {
      vulnerabilities.push({
        type: 'phi_exposure',
        severity: 'high',
        description: 'Diagnosis information detected in data',
        location: context.component || 'unknown',
        evidence: 'Diagnosis pattern match',
        remediation: 'Ensure PHI is properly encrypted and access-controlled'
      });
    }

    // Medication information
    if (/\b(medication|prescription|drug):/i.test(dataString)) {
      vulnerabilities.push({
        type: 'phi_exposure',
        severity: 'high',
        description: 'Medication information detected in data',
        location: context.component || 'unknown',
        evidence: 'Medication pattern match',
        remediation: 'Implement proper PHI handling protocols'
      });
    }

    return vulnerabilities;
  }

  /**
   * Scans API requests for security issues
   */
  async scanAPIRequest(
    endpoint: string,
    method: string,
    headers: Record<string, string>,
    body: any
  ): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Check for missing authentication
    if (!headers['Authorization'] && !headers['authorization']) {
      vulnerabilities.push({
        type: 'auth_bypass',
        severity: 'critical',
        description: 'API request missing authentication header',
        location: endpoint,
        evidence: 'No Authorization header present',
        remediation: 'Add authentication token to all API requests'
      });
    }

    // Check for sensitive data in GET requests
    if (method === 'GET' && body) {
      vulnerabilities.push({
        type: 'insecure_storage',
        severity: 'medium',
        description: 'Sensitive data in GET request',
        location: endpoint,
        evidence: 'Body data in GET request',
        remediation: 'Use POST for requests with sensitive data'
      });
    }

    // Check for PHI in URL
    if (this.containsPHI(endpoint)) {
      vulnerabilities.push({
        type: 'phi_exposure',
        severity: 'critical',
        description: 'PHI detected in URL',
        location: endpoint,
        evidence: 'PHI pattern in URL',
        remediation: 'Use encrypted identifiers instead of PHI in URLs'
      });
    }

    return vulnerabilities;
  }

  /**
   * Auto-fixes security vulnerabilities where possible
   */
  async autoFix(vulnerability: SecurityVulnerability, code: string): Promise<string | null> {
    switch (vulnerability.type) {
      case 'xss':
        return this.fixXSS(code);

      case 'sql_injection':
        return this.fixSQLInjection(code);

      case 'insecure_storage':
        return this.fixInsecureStorage(code);

      case 'phi_exposure':
        return this.fixPHIExposure(code);

      default:
        return null; // Cannot auto-fix
    }
  }

  // Detection Methods
  private detectXSS(code: string, filePath: string): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Detect dangerouslySetInnerHTML without sanitization
    const dangerousHTMLRegex = /dangerouslySetInnerHTML\s*=\s*\{\s*\{?\s*__html:\s*([^}]+)\s*\}?\s*\}/g;
    let match;

    while ((match = dangerousHTMLRegex.exec(code)) !== null) {
      const htmlSource = match[1];

      // Check if DOMPurify or similar sanitization is used
      if (!htmlSource.includes('DOMPurify') && !htmlSource.includes('sanitize')) {
        vulnerabilities.push({
          type: 'xss',
          severity: 'critical',
          description: 'Unsanitized HTML injection via dangerouslySetInnerHTML',
          location: `${filePath}:${this.getLineNumber(code, match.index)}`,
          evidence: match[0],
          remediation: 'Use DOMPurify.sanitize() before setting HTML'
        });
      }
    }

    // Detect eval() usage
    if (code.includes('eval(')) {
      vulnerabilities.push({
        type: 'code_injection',
        severity: 'critical',
        description: 'Use of eval() detected - potential code injection',
        location: filePath,
        evidence: 'eval() usage',
        remediation: 'Remove eval() and use safer alternatives'
      });
    }

    return vulnerabilities;
  }

  private detectSQLInjection(code: string, filePath: string): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Detect string concatenation in SQL queries
    const sqlConcatRegex = /sql\s*=\s*['"`].*\$\{|sql\s*\+\s*['"`]/gi;
    let match;

    while ((match = sqlConcatRegex.exec(code)) !== null) {
      vulnerabilities.push({
        type: 'sql_injection',
        severity: 'critical',
        description: 'SQL query using string concatenation',
        location: `${filePath}:${this.getLineNumber(code, match.index)}`,
        evidence: match[0],
        remediation: 'Use parameterized queries or prepared statements'
      });
    }

    // Detect .query() or .execute() with template literals
    const queryTemplateRegex = /\.(query|execute)\s*\(\s*`[^`]*\$\{/g;

    while ((match = queryTemplateRegex.exec(code)) !== null) {
      vulnerabilities.push({
        type: 'sql_injection',
        severity: 'critical',
        description: 'SQL query using template literals with interpolation',
        location: `${filePath}:${this.getLineNumber(code, match.index)}`,
        evidence: match[0],
        remediation: 'Use parameterized queries with placeholders'
      });
    }

    return vulnerabilities;
  }

  private detectPHIExposure(code: string, filePath: string): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Detect console.log with potential PHI
    const consoleLogRegex = /console\.(log|error|warn|info)\s*\([^)]*\b(patient|diagnosis|medication|ssn|medical|phi)\b[^)]*\)/gi;
    let match;

    while ((match = consoleLogRegex.exec(code)) !== null) {
      vulnerabilities.push({
        type: 'phi_exposure',
        severity: 'high',
        description: 'Potential PHI logged to console',
        location: `${filePath}:${this.getLineNumber(code, match.index)}`,
        evidence: match[0],
        remediation: 'Remove PHI from logs or mask sensitive fields'
      });
    }

    // Detect error messages with patient data
    const errorWithPHIRegex = /throw new Error\([^)]*\b(patient|diagnosis|medication|ssn)\b[^)]*\)/gi;

    while ((match = errorWithPHIRegex.exec(code)) !== null) {
      vulnerabilities.push({
        type: 'phi_exposure',
        severity: 'high',
        description: 'Potential PHI in error message',
        location: `${filePath}:${this.getLineNumber(code, match.index)}`,
        evidence: match[0],
        remediation: 'Use generic error messages without PHI'
      });
    }

    return vulnerabilities;
  }

  private detectAuthIssues(code: string, filePath: string): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Detect hardcoded credentials
    const credentialRegex = /(password|secret|apikey|api_key)\s*=\s*['"][^'"]+['"]/gi;
    let match;

    while ((match = credentialRegex.exec(code)) !== null) {
      vulnerabilities.push({
        type: 'insecure_storage',
        severity: 'critical',
        description: 'Hardcoded credentials detected',
        location: `${filePath}:${this.getLineNumber(code, match.index)}`,
        evidence: match[0].replace(/['"][^'"]+['"]/, '"***"'),
        remediation: 'Use environment variables for credentials'
      });
    }

    // Detect token in localStorage without encryption
    if (code.includes('localStorage.setItem') && code.includes('token')) {
      const localStorageRegex = /localStorage\.setItem\([^)]*token[^)]*\)/gi;

      while ((match = localStorageRegex.exec(code)) !== null) {
        vulnerabilities.push({
          type: 'insecure_storage',
          severity: 'high',
          description: 'Authentication token stored in localStorage',
          location: `${filePath}:${this.getLineNumber(code, match.index)}`,
          evidence: match[0],
          remediation: 'Use httpOnly cookies or secure session storage'
        });
      }
    }

    return vulnerabilities;
  }

  private detectInsecureStorage(code: string, filePath: string): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Detect sensitive data in localStorage
    const sensitivePatterns = ['patient', 'medical', 'diagnosis', 'ssn', 'phi'];

    for (const pattern of sensitivePatterns) {
      const regex = new RegExp(`localStorage\\.setItem\\([^)]*${pattern}[^)]*\\)`, 'gi');
      let match;

      while ((match = regex.exec(code)) !== null) {
        vulnerabilities.push({
          type: 'insecure_storage',
          severity: 'high',
          description: 'Sensitive data stored in localStorage',
          location: `${filePath}:${this.getLineNumber(code, match.index)}`,
          evidence: match[0],
          remediation: 'Encrypt sensitive data or use secure backend storage'
        });
      }
    }

    return vulnerabilities;
  }

  private detectCodeInjection(code: string, filePath: string): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Detect Function constructor with user input
    if (code.includes('new Function(') || code.includes('Function(')) {
      vulnerabilities.push({
        type: 'code_injection',
        severity: 'critical',
        description: 'Function constructor usage detected',
        location: filePath,
        evidence: 'new Function() or Function()',
        remediation: 'Avoid dynamic code execution'
      });
    }

    // Detect setTimeout/setInterval with strings
    const timerStringRegex = /(setTimeout|setInterval)\s*\(\s*['"`]/g;
    let match;

    while ((match = timerStringRegex.exec(code)) !== null) {
      vulnerabilities.push({
        type: 'code_injection',
        severity: 'high',
        description: 'Timer function with string code',
        location: `${filePath}:${this.getLineNumber(code, match.index)}`,
        evidence: match[0],
        remediation: 'Use function references instead of strings'
      });
    }

    return vulnerabilities;
  }

  // Auto-fix Methods
  private fixXSS(code: string): string {
    // Add DOMPurify import if not present
    if (!code.includes('DOMPurify')) {
      code = "import DOMPurify from 'dompurify';\n" + code;
    }

    // Wrap dangerouslySetInnerHTML with DOMPurify
    code = code.replace(
      /dangerouslySetInnerHTML\s*=\s*\{\s*\{?\s*__html:\s*([^}]+)\s*\}?\s*\}/g,
      'dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize($1) }}'
    );

    return code;
  }

  private fixSQLInjection(code: string): string {
    // Add comment suggesting parameterized query
    code = code.replace(
      /sql\s*=\s*['"`].*\$\{/g,
      '// TODO: Convert to parameterized query\n$&'
    );

    return code;
  }

  private fixInsecureStorage(code: string): string {
    // Add encryption wrapper for localStorage
    code = code.replace(
      /localStorage\.setItem\(/g,
      'secureStorage.setItem(' // Assumes secureStorage helper exists
    );

    return code;
  }

  private fixPHIExposure(code: string): string {
    // Comment out console.logs with PHI
    code = code.replace(
      /console\.(log|error|warn|info)\s*\([^)]*\b(patient|diagnosis|medication|ssn|medical|phi)\b[^)]*\)/gi,
      '// REMOVED: $&'
    );

    return code;
  }

  // Helper Methods
  private getLineNumber(code: string, index: number): number {
    return code.substring(0, index).split('\n').length;
  }

  private containsPHI(text: string): boolean {
    const phiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\bMRN\d+/i, // Medical Record Number
      /\bpatient[_-]?id/i
    ];

    return phiPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Gets scan statistics
   */
  getStatistics() {
    const total = this.scanHistory.length;
    const byType = this.scanHistory.reduce((acc, v) => {
      acc[v.type] = (acc[v.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const bySeverity = this.scanHistory.reduce((acc, v) => {
      acc[v.severity] = (acc[v.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      byType,
      bySeverity,
      recent: this.scanHistory.slice(-10)
    };
  }
}
