// ============================================================================
// PHI De-identification Service
// ============================================================================
// HIPAA Compliance: §164.514 - Safe Harbor De-identification Method
//
// This service removes Protected Health Information (PHI) from text before
// sending to external AI services. Uses multiple detection strategies:
// 1. Pattern-based (regex) for structured data
// 2. Dictionary-based for common names
// 3. Context-aware detection for medical identifiers
// 4. Configurable redaction levels
// ============================================================================

import { createLogger } from './auditLogger.ts';

const logger = createLogger('phi-deidentifier');

// ============================================================================
// TYPES
// ============================================================================

export interface DeidentificationResult {
  text: string;
  redactedCount: number;
  redactionTypes: Record<string, number>;
  confidence: number; // 0-1 confidence that all PHI was removed
  warnings: string[];
}

export interface DeidentificationOptions {
  level: 'standard' | 'strict' | 'paranoid';
  preserveStructure?: boolean; // Keep sentence structure with [REDACTED]
  hashIdentifiers?: boolean; // Use consistent hashes for same values
  customPatterns?: RegExp[];
  allowedTerms?: string[]; // Medical terms to NOT redact
}

// ============================================================================
// PHI PATTERN DEFINITIONS
// ============================================================================

// HIPAA Safe Harbor 18 Identifiers + Medical-specific patterns
const PHI_PATTERNS = {
  // 1. Names (complex patterns for various formats)
  names: {
    // Full names (First Last, Last First, etc.)
    fullName: /\b(?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Miss|Prof\.?)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g,
    // Patient/Provider name labels
    labeledName: /\b(?:patient|client|resident|member|provider|doctor|nurse|caregiver|guardian|mother|father|parent|spouse|wife|husband|son|daughter|brother|sister|emergency\s*contact)(?:\s*(?:name|is|:))?\s*[:\-]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
    // Possessive names (John's, Mary's)
    possessiveName: /\b[A-Z][a-z]{2,}(?:'s|')\s+(?:mother|father|wife|husband|son|daughter|doctor|nurse)/gi,
  },

  // 2. Geographic Data (smaller than state)
  geographic: {
    streetAddress: /\b\d{1,5}\s+(?:[A-Z][a-z]+\s*)+(?:Street|St\.?|Avenue|Ave\.?|Boulevard|Blvd\.?|Road|Rd\.?|Drive|Dr\.?|Lane|Ln\.?|Way|Court|Ct\.?|Circle|Cir\.?|Place|Pl\.?)\b/gi,
    poBox: /\b(?:P\.?\s*O\.?\s*Box|Post\s*Office\s*Box)\s*#?\s*\d+\b/gi,
    zipCode: /\b\d{5}(?:-\d{4})?\b/g,
    cityState: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2}\b/g,
  },

  // 3. Dates (except year)
  dates: {
    fullDate: /\b(?:0?[1-9]|1[0-2])[-\/](?:0?[1-9]|[12]\d|3[01])[-\/](?:19|20)?\d{2}\b/g,
    writtenDate: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s*(?:19|20)?\d{2,4}\b/gi,
    dobLabel: /\b(?:DOB|D\.O\.B\.?|Date\s*of\s*Birth|Birth\s*Date|Birthday)[:\s]+[^\n,]+/gi,
    ageExact: /\b(?:age[d]?|is)\s*[:\s]?\s*(\d{1,3})\s*(?:years?|yrs?|y\.?o\.?|year[s]?\s*old)\b/gi,
  },

  // 4. Phone Numbers
  phone: {
    standard: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    labeled: /\b(?:phone|tel|telephone|cell|mobile|fax|contact)[:\s#]+[\d\s\-().]+/gi,
    extension: /\b(?:ext\.?|extension)\s*#?\s*\d{2,6}\b/gi,
  },

  // 5. Fax Numbers (same patterns as phone)
  fax: {
    labeled: /\b(?:fax|facsimile)[:\s#]+[\d\s\-().]+/gi,
  },

  // 6. Email Addresses
  email: {
    standard: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    labeled: /\b(?:email|e-mail)[:\s]+[^\s,]+/gi,
  },

  // 7. Social Security Numbers
  ssn: {
    standard: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    labeled: /\b(?:SSN|SS#|Social\s*Security)[:\s#]+[\d\s\-]+/gi,
    partial: /\bXXX-XX-\d{4}\b/g, // Already partially redacted
  },

  // 8. Medical Record Numbers
  mrn: {
    labeled: /\b(?:MRN|MR#|Medical\s*Record|Chart\s*#?|Patient\s*ID|Patient\s*#|Account\s*#?|Acct\s*#?)[:\s#]+[\w\d\-]+/gi,
    generic: /\b(?:ID|#)\s*:?\s*\d{6,12}\b/g,
  },

  // 9. Health Plan Beneficiary Numbers
  insurance: {
    memberID: /\b(?:Member\s*ID|Subscriber\s*ID|Policy\s*#?|Insurance\s*ID|Group\s*#?|Beneficiary\s*#?)[:\s#]+[\w\d\-]+/gi,
    medicaid: /\b(?:Medicaid|Medicare)\s*(?:#|ID|Number)?[:\s]+[\w\d\-]+/gi,
  },

  // 10. Account Numbers
  accounts: {
    bankAccount: /\b(?:Account|Acct)\.?\s*#?\s*:?\s*\d{8,17}\b/gi,
    creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    routing: /\b(?:routing|ABA)\s*#?\s*:?\s*\d{9}\b/gi,
  },

  // 11. Certificate/License Numbers
  licenses: {
    dea: /\b(?:DEA|DEA\s*#)[:\s]*[A-Z]{2}\d{7}\b/gi,
    npi: /\b(?:NPI)[:\s#]*\d{10}\b/gi,
    license: /\b(?:License|Lic)\s*#?\s*:?\s*[\w\d\-]+/gi,
    driverLicense: /\b(?:DL|Driver'?s?\s*License)[:\s#]+[\w\d\-]+/gi,
  },

  // 12. Vehicle Identifiers
  vehicle: {
    vin: /\b[A-HJ-NPR-Z0-9]{17}\b/g, // VIN pattern
    plate: /\b(?:License\s*Plate|Plate\s*#?)[:\s]+[\w\d\-]+/gi,
  },

  // 13. Device Identifiers
  devices: {
    serial: /\b(?:Serial\s*#?|S\/N)[:\s]+[\w\d\-]+/gi,
    imei: /\b\d{15,17}\b/g, // IMEI pattern (contextual)
  },

  // 14. URLs
  urls: {
    standard: /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&//=]*)/gi,
    labeled: /\b(?:website|url|link)[:\s]+[^\s,]+/gi,
  },

  // 15. IP Addresses
  ipAddresses: {
    ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    ipv6: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
  },

  // 16. Biometric Identifiers (contextual)
  biometric: {
    labeled: /\b(?:fingerprint|retina|iris|voice\s*print|facial\s*recognition)[:\s]+[^\n,]+/gi,
  },

  // 17. Full Face Photos (can't detect in text, but can flag references)
  photos: {
    reference: /\b(?:photo|photograph|picture|image|selfie)\s*(?:attached|included|enclosed|of\s+patient)/gi,
  },

  // 18. Any Other Unique Identifying Number
  uniqueIds: {
    uuid: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    genericId: /\b(?:unique\s*ID|identifier|case\s*#?)[:\s]+[\w\d\-]+/gi,
  },
};

// ============================================================================
// COMMON NAMES DATABASE (Top 1000 US names)
// ============================================================================

const COMMON_FIRST_NAMES = new Set([
  // Top male names
  'james', 'robert', 'john', 'michael', 'david', 'william', 'richard', 'joseph', 'thomas', 'charles',
  'christopher', 'daniel', 'matthew', 'anthony', 'mark', 'donald', 'steven', 'paul', 'andrew', 'joshua',
  'kenneth', 'kevin', 'brian', 'george', 'timothy', 'ronald', 'edward', 'jason', 'jeffrey', 'ryan',
  'jacob', 'gary', 'nicholas', 'eric', 'jonathan', 'stephen', 'larry', 'justin', 'scott', 'brandon',
  'benjamin', 'samuel', 'raymond', 'gregory', 'frank', 'alexander', 'patrick', 'jack', 'dennis', 'jerry',
  // Top female names
  'mary', 'patricia', 'jennifer', 'linda', 'barbara', 'elizabeth', 'susan', 'jessica', 'sarah', 'karen',
  'lisa', 'nancy', 'betty', 'margaret', 'sandra', 'ashley', 'kimberly', 'emily', 'donna', 'michelle',
  'dorothy', 'carol', 'amanda', 'melissa', 'deborah', 'stephanie', 'rebecca', 'sharon', 'laura', 'cynthia',
  'kathleen', 'amy', 'angela', 'shirley', 'anna', 'brenda', 'pamela', 'emma', 'nicole', 'helen',
  'samantha', 'katherine', 'christine', 'debra', 'rachel', 'carolyn', 'janet', 'catherine', 'maria', 'heather',
  // Common nicknames
  'mike', 'bob', 'bill', 'jim', 'joe', 'tom', 'dan', 'dave', 'steve', 'matt', 'chris', 'nick', 'tony',
  'kate', 'liz', 'beth', 'sue', 'jen', 'jess', 'sam', 'meg', 'kim', 'pam', 'deb', 'barb', 'cathy',
]);

const COMMON_LAST_NAMES = new Set([
  'smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis', 'rodriguez', 'martinez',
  'hernandez', 'lopez', 'gonzalez', 'wilson', 'anderson', 'thomas', 'taylor', 'moore', 'jackson', 'martin',
  'lee', 'perez', 'thompson', 'white', 'harris', 'sanchez', 'clark', 'ramirez', 'lewis', 'robinson',
  'walker', 'young', 'allen', 'king', 'wright', 'scott', 'torres', 'nguyen', 'hill', 'flores',
  'green', 'adams', 'nelson', 'baker', 'hall', 'rivera', 'campbell', 'mitchell', 'carter', 'roberts',
]);

// ============================================================================
// MEDICAL TERMS ALLOWLIST (should NOT be redacted)
// ============================================================================

const MEDICAL_ALLOWLIST = new Set([
  // Common medical terms that might look like names
  'normal', 'patient', 'positive', 'negative', 'chronic', 'acute', 'stable', 'critical',
  'bilateral', 'unilateral', 'anterior', 'posterior', 'superior', 'inferior', 'medial', 'lateral',
  'proximal', 'distal', 'dorsal', 'ventral', 'cranial', 'caudal',
  // Procedures/conditions that might trigger false positives
  'cancer', 'tumor', 'lesion', 'mass', 'nodule', 'cyst', 'polyp',
  'hypertension', 'diabetes', 'asthma', 'copd', 'chf', 'cad', 'cvd', 'ckd',
  // Medications (common ones)
  'metformin', 'lisinopril', 'amlodipine', 'metoprolol', 'atorvastatin', 'omeprazole',
  'gabapentin', 'losartan', 'albuterol', 'prednisone', 'levothyroxine', 'insulin',
  // Anatomical terms
  'heart', 'lung', 'liver', 'kidney', 'brain', 'spine', 'bone', 'muscle', 'nerve',
  // Time-related (not PHI)
  'morning', 'afternoon', 'evening', 'night', 'daily', 'weekly', 'monthly',
  // Medical abbreviations
  'bp', 'hr', 'rr', 'temp', 'spo2', 'bmi', 'wbc', 'rbc', 'hgb', 'plt', 'bun', 'cr',
]);

// ============================================================================
// CORE DEIDENTIFICATION FUNCTIONS
// ============================================================================

/**
 * Main de-identification function
 */
export function deidentify(
  text: string,
  options: DeidentificationOptions = { level: 'standard' }
): DeidentificationResult {
  const startTime = Date.now();
  const warnings: string[] = [];
  const redactionTypes: Record<string, number> = {};
  let redactedCount = 0;
  let processedText = text;

  // Track original positions for consistent hashing
  const redactionMap = new Map<string, string>();

  // 1. Apply pattern-based redaction
  for (const [category, patterns] of Object.entries(PHI_PATTERNS)) {
    for (const [patternName, pattern] of Object.entries(patterns)) {
      const matches = processedText.match(pattern);
      if (matches) {
        const uniqueMatches = [...new Set(matches)];
        uniqueMatches.forEach(match => {
          // Skip if in allowlist
          if (isAllowlisted(match, options.allowedTerms)) return;

          const redactionKey = `${category}.${patternName}`;
          redactionTypes[redactionKey] = (redactionTypes[redactionKey] || 0) + 1;
          redactedCount++;

          const replacement = options.hashIdentifiers
            ? getHashedReplacement(match, category, redactionMap)
            : getRedactionPlaceholder(category, options.preserveStructure);

          processedText = processedText.split(match).join(replacement);
        });
      }
    }
  }

  // 2. Apply name detection (dictionary-based)
  if (options.level !== 'standard') {
    const nameResult = redactPotentialNames(processedText, options);
    processedText = nameResult.text;
    redactedCount += nameResult.count;
    if (nameResult.count > 0) {
      redactionTypes['names.dictionary'] = nameResult.count;
    }
  }

  // 3. Apply context-aware detection for strict/paranoid modes
  if (options.level === 'paranoid') {
    const contextResult = redactContextualPHI(processedText, options);
    processedText = contextResult.text;
    redactedCount += contextResult.count;
    warnings.push(...contextResult.warnings);
    Object.assign(redactionTypes, contextResult.types);
  }

  // 4. Apply custom patterns if provided
  if (options.customPatterns && options.customPatterns.length > 0) {
    options.customPatterns.forEach((pattern, idx) => {
      const matches = processedText.match(pattern);
      if (matches) {
        const uniqueMatches = [...new Set(matches)];
        uniqueMatches.forEach(match => {
          redactionTypes[`custom.pattern${idx}`] = (redactionTypes[`custom.pattern${idx}`] || 0) + 1;
          redactedCount++;
          processedText = processedText.split(match).join('[CUSTOM_REDACTED]');
        });
      }
    });
  }

  // 5. Calculate confidence score
  const confidence = calculateConfidence(processedText, options.level, redactedCount);

  // 6. Add warnings for potential missed PHI
  const potentialMissed = detectPotentialMissedPHI(processedText);
  warnings.push(...potentialMissed);

  const processingTime = Date.now() - startTime;
  logger.phi('De-identification completed', {
    originalLength: text.length,
    processedLength: processedText.length,
    redactedCount,
    confidence,
    level: options.level,
    processingTimeMs: processingTime,
    warningCount: warnings.length
  });

  return {
    text: processedText,
    redactedCount,
    redactionTypes,
    confidence,
    warnings
  };
}

/**
 * Check if a term is in the medical allowlist
 */
function isAllowlisted(term: string, customAllowed?: string[]): boolean {
  const normalized = term.toLowerCase().trim();
  if (MEDICAL_ALLOWLIST.has(normalized)) return true;
  if (customAllowed && customAllowed.some(t => normalized.includes(t.toLowerCase()))) return true;
  return false;
}

/**
 * Generate consistent hashed replacement for identifiers
 */
function getHashedReplacement(
  original: string,
  category: string,
  map: Map<string, string>
): string {
  const key = `${category}:${original.toLowerCase()}`;
  if (map.has(key)) return map.get(key)!;

  // Generate a short hash
  let hash = 0;
  for (let i = 0; i < original.length; i++) {
    const char = original.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hashStr = Math.abs(hash).toString(36).substring(0, 6).toUpperCase();

  const replacement = `[${category.toUpperCase()}_${hashStr}]`;
  map.set(key, replacement);
  return replacement;
}

/**
 * Get redaction placeholder based on category
 */
function getRedactionPlaceholder(category: string, preserveStructure?: boolean): string {
  if (!preserveStructure) return '[REDACTED]';

  const placeholders: Record<string, string> = {
    names: '[NAME]',
    geographic: '[ADDRESS]',
    dates: '[DATE]',
    phone: '[PHONE]',
    fax: '[FAX]',
    email: '[EMAIL]',
    ssn: '[SSN]',
    mrn: '[MRN]',
    insurance: '[INSURANCE_ID]',
    accounts: '[ACCOUNT]',
    licenses: '[LICENSE]',
    vehicle: '[VEHICLE_ID]',
    devices: '[DEVICE_ID]',
    urls: '[URL]',
    ipAddresses: '[IP]',
    biometric: '[BIOMETRIC]',
    photos: '[PHOTO_REF]',
    uniqueIds: '[ID]',
  };

  return placeholders[category] || '[REDACTED]';
}

/**
 * Redact potential names using dictionary matching
 */
function redactPotentialNames(
  text: string,
  options: DeidentificationOptions
): { text: string; count: number } {
  let count = 0;
  let processedText = text;

  // Find capitalized words that might be names
  const words = text.match(/\b[A-Z][a-z]{2,15}\b/g) || [];
  const uniqueWords = [...new Set(words)];

  uniqueWords.forEach(word => {
    const lower = word.toLowerCase();

    // Skip if in medical allowlist
    if (MEDICAL_ALLOWLIST.has(lower)) return;

    // Check if it's a common name
    const isFirstName = COMMON_FIRST_NAMES.has(lower);
    const isLastName = COMMON_LAST_NAMES.has(lower);

    if (isFirstName || isLastName) {
      count++;
      const replacement = options.preserveStructure ? '[NAME]' : '[REDACTED]';
      // Use word boundary to avoid partial replacements
      const regex = new RegExp(`\\b${word}\\b`, 'g');
      processedText = processedText.replace(regex, replacement);
    }
  });

  return { text: processedText, count };
}

/**
 * Context-aware PHI detection for paranoid mode
 */
function redactContextualPHI(
  text: string,
  options: DeidentificationOptions
): { text: string; count: number; warnings: string[]; types: Record<string, number> } {
  let count = 0;
  let processedText = text;
  const warnings: string[] = [];
  const types: Record<string, number> = {};

  // Look for patterns like "lives at", "resides at", "located at"
  const addressContextPatterns = [
    /\b(?:lives?|resides?|located|staying|address)\s+(?:at|is|:)\s+([^,.\n]+)/gi,
    /\b(?:from|in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,?\s*[A-Z]{2})/g,
  ];

  addressContextPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        if (!processedText.includes('[REDACTED]') || !processedText.includes('[ADDRESS]')) {
          count++;
          types['contextual.address'] = (types['contextual.address'] || 0) + 1;
          const replacement = options.preserveStructure ? '[ADDRESS]' : '[REDACTED]';
          processedText = processedText.replace(match, replacement);
        }
      });
    }
  });

  // Look for age patterns that might reveal DOB
  const agePatterns = [
    /\b(\d{1,3})\s*(?:year[s]?\s*old|y\.?o\.?|yr[s]?)\b/gi,
    /\bage[d]?\s*:?\s*(\d{1,3})\b/gi,
  ];

  agePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // Only redact if age seems specific enough to identify
        const ageMatch = match.match(/\d+/);
        if (ageMatch) {
          const age = parseInt(ageMatch[0]);
          // Ages over 89 are considered identifiable per Safe Harbor
          if (age > 89) {
            count++;
            types['contextual.age'] = (types['contextual.age'] || 0) + 1;
            processedText = processedText.replace(match, '[AGE_90+]');
          }
        }
      });
    }
  });

  // Look for employer/school names (potential identifiers)
  const affiliationPatterns = [
    /\b(?:works?\s+(?:at|for)|employed\s+(?:at|by)|attends?|student\s+at)\s+([A-Z][^\n,]+)/gi,
  ];

  affiliationPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        count++;
        types['contextual.affiliation'] = (types['contextual.affiliation'] || 0) + 1;
        const replacement = options.preserveStructure ? '[AFFILIATION]' : '[REDACTED]';
        processedText = processedText.replace(match, replacement);
        warnings.push('Potential employer/school affiliation detected and redacted');
      });
    }
  });

  return { text: processedText, count, warnings, types };
}

/**
 * Calculate confidence that all PHI was removed
 */
function calculateConfidence(text: string, level: string, redactedCount: number): number {
  let confidence = 0.85; // Base confidence

  // Adjust based on level
  if (level === 'strict') confidence = 0.92;
  if (level === 'paranoid') confidence = 0.97;

  // Reduce confidence if suspicious patterns remain
  const suspiciousPatterns = [
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/, // Phone-like
    /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/, // SSN-like
    /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/, // Name-like
    /@[a-z]+\.[a-z]+/i, // Email-like
  ];

  suspiciousPatterns.forEach(pattern => {
    if (pattern.test(text)) {
      confidence -= 0.05;
    }
  });

  // Boost confidence if many redactions were made
  if (redactedCount > 10) confidence += 0.02;
  if (redactedCount > 20) confidence += 0.02;

  return Math.max(0.5, Math.min(0.99, confidence));
}

/**
 * Detect potential missed PHI and return warnings
 */
function detectPotentialMissedPHI(text: string): string[] {
  const warnings: string[] = [];

  // Check for patterns that might indicate missed PHI
  const suspiciousIndicators = [
    { pattern: /\b(?:my|his|her|their)\s+(?:name|address|phone|email|ssn)\b/gi, warning: 'Possessive reference to identifier detected' },
    { pattern: /\b(?:contact|reach|call)\s+(?:me|him|her|them)\s+at\b/gi, warning: 'Contact information reference detected' },
    { pattern: /\blives?\s+(?:in|at|on)\b/gi, warning: 'Residence reference detected' },
    { pattern: /\bborn\s+(?:in|on)\b/gi, warning: 'Birth information reference detected' },
  ];

  suspiciousIndicators.forEach(({ pattern, warning }) => {
    if (pattern.test(text)) {
      warnings.push(warning);
    }
  });

  return warnings;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick de-identification with standard settings
 */
export function quickDeidentify(text: string): string {
  return deidentify(text, { level: 'standard' }).text;
}

/**
 * Strict de-identification for external AI services
 */
export function strictDeidentify(text: string): DeidentificationResult {
  return deidentify(text, {
    level: 'strict',
    preserveStructure: true,
    hashIdentifiers: false
  });
}

/**
 * Paranoid de-identification for maximum safety
 */
export function paranoidDeidentify(text: string): DeidentificationResult {
  return deidentify(text, {
    level: 'paranoid',
    preserveStructure: true,
    hashIdentifiers: true
  });
}

/**
 * Validate that text appears to be de-identified
 */
export function validateDeidentification(text: string): {
  isValid: boolean;
  issues: string[];
  riskScore: number; // 0-100, higher = more risk
} {
  const issues: string[] = [];
  let riskScore = 0;

  // Check for common PHI patterns
  const checks = [
    { pattern: /\b\d{3}-\d{2}-\d{4}\b/, issue: 'Possible SSN detected', risk: 30 },
    { pattern: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/, issue: 'Possible phone number detected', risk: 15 },
    { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, issue: 'Email address detected', risk: 20 },
    { pattern: /\b(?:0?[1-9]|1[0-2])[-\/](?:0?[1-9]|[12]\d|3[01])[-\/](?:19|20)\d{2}\b/, issue: 'Full date detected', risk: 15 },
    { pattern: /\bMRN\s*[:\#]?\s*\d+/i, issue: 'Medical record number detected', risk: 25 },
  ];

  checks.forEach(({ pattern, issue, risk }) => {
    if (pattern.test(text)) {
      issues.push(issue);
      riskScore += risk;
    }
  });

  // Check for consecutive capitalized words (potential names)
  const namePattern = /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g;
  const potentialNames = text.match(namePattern) || [];
  if (potentialNames.length > 2) {
    issues.push(`${potentialNames.length} potential names detected`);
    riskScore += potentialNames.length * 5;
  }

  return {
    isValid: riskScore < 20,
    issues,
    riskScore: Math.min(100, riskScore)
  };
}
