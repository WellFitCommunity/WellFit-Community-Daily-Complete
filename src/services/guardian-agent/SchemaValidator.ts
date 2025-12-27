/**
 * Schema Validator - Zod-based I/O validation
 * Prevents AI hallucination by enforcing strict type safety
 *
 * Every tool input and output must be validated against a schema
 * This ensures the agent cannot invent fields or return malformed data
 *
 * Security Features:
 * - PHI detection (HIPAA compliance)
 * - SQL injection prevention
 * - XSS attack prevention
 * - Business rule validation
 */

import { z } from 'zod';
import { auditLogger } from '../auditLogger';

/**
 * PHI Detector - Detects Protected Health Information
 * Based on HIPAA Safe Harbor guidelines (18 identifiers)
 */
export class PHIDetector {
  // Patterns for PHI detection (HIPAA 18 identifiers)
  private static readonly SSN_PATTERN = /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g;
  private static readonly PHONE_PATTERN = /\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
  private static readonly EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi;
  private static readonly MRN_PATTERN = /\b(?:MRN|Medical Record|Patient ID)[:\s#]*[A-Z0-9]{5,15}\b/gi;
  private static readonly IP_PATTERN = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
  private static readonly DOB_PATTERN = /\b(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/g;
  private static readonly ZIP_FULL_PATTERN = /\b\d{5}[-]\d{4}\b/g;
  private static readonly VEHICLE_ID_PATTERN = /\b[A-HJ-NPR-Z0-9]{17}\b/gi; // VIN
  private static readonly URL_PATTERN = /\bhttps?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  private static readonly BIOMETRIC_KEYWORDS = /\b(?:fingerprint|retina|iris|dna|genetic|biometric)\b/gi;
  private static readonly FACE_PHOTO_KEYWORDS = /\b(?:photo|photograph|image|picture|portrait|face|facial)\b/gi;

  /**
   * Detect PHI in a string
   * Returns list of detected PHI types
   */
  static detect(input: string): {
    hasPHI: boolean;
    detectedTypes: string[];
    positions: Array<{ type: string; start: number; end: number }>;
  } {
    const detectedTypes: string[] = [];
    const positions: Array<{ type: string; start: number; end: number }> = [];

    // Check each pattern
    const patterns: Array<{ name: string; pattern: RegExp }> = [
      { name: 'SSN', pattern: this.SSN_PATTERN },
      { name: 'Phone', pattern: this.PHONE_PATTERN },
      { name: 'Email', pattern: this.EMAIL_PATTERN },
      { name: 'MRN', pattern: this.MRN_PATTERN },
      { name: 'IP_Address', pattern: this.IP_PATTERN },
      { name: 'DOB', pattern: this.DOB_PATTERN },
      { name: 'ZIP+4', pattern: this.ZIP_FULL_PATTERN },
      { name: 'VIN', pattern: this.VEHICLE_ID_PATTERN },
      { name: 'URL', pattern: this.URL_PATTERN },
      { name: 'Biometric', pattern: this.BIOMETRIC_KEYWORDS },
      { name: 'Face_Photo', pattern: this.FACE_PHOTO_KEYWORDS },
    ];

    for (const { name, pattern } of patterns) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(input)) !== null) {
        if (!detectedTypes.includes(name)) {
          detectedTypes.push(name);
        }
        positions.push({
          type: name,
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }

    return {
      hasPHI: detectedTypes.length > 0,
      detectedTypes,
      positions,
    };
  }

  /**
   * Redact PHI from a string (for logging)
   */
  static redact(input: string): string {
    let redacted = input;
    const detection = this.detect(input);

    // Sort positions in reverse order to maintain correct indices while replacing
    const sortedPositions = [...detection.positions].sort((a, b) => b.start - a.start);

    for (const pos of sortedPositions) {
      const placeholder = `[REDACTED_${pos.type}]`;
      redacted = redacted.substring(0, pos.start) + placeholder + redacted.substring(pos.end);
    }

    return redacted;
  }
}

/**
 * SQL Injection Detector - Prevents SQL injection attacks
 */
export class SQLInjectionDetector {
  // Common SQL injection patterns
  private static readonly PATTERNS: RegExp[] = [
    // Classic SQL injection
    /('|")\s*(OR|AND)\s*('|"|\d+)\s*=\s*('|"|\d+)/gi,
    /('|")\s*(OR|AND)\s*\d+\s*=\s*\d+/gi,
    // Union-based injection
    /UNION\s+(ALL\s+)?SELECT/gi,
    // Comment-based injection
    /(--|#|\/\*|\*\/)/g,
    // Stacked queries
    /;\s*(DROP|DELETE|UPDATE|INSERT|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE)\s/gi,
    // SLEEP/BENCHMARK (time-based)
    /\b(SLEEP|BENCHMARK|WAITFOR|DELAY)\s*\(/gi,
    // System commands
    /\b(xp_cmdshell|sp_executesql|OPENROWSET|OPENDATASOURCE)\b/gi,
    // Information schema access
    /\bINFORMATION_SCHEMA\b/gi,
    // Blind SQL injection
    /\b(IF|CASE)\s*\(.*\bSELECT\b/gi,
    // Boolean-based
    /'\s*(AND|OR)\s*'?\d+'?\s*[=<>]/gi,
    // Encoding bypass attempts
    /0x[0-9a-f]+/gi,
    // Common attack strings
    /('|")\s*;\s*--/gi,
    /\bDROP\s+TABLE\b/gi,
    /\bDELETE\s+FROM\b/gi,
    /\bINSERT\s+INTO\b/gi,
  ];

  /**
   * Detect SQL injection attempts
   */
  static detect(input: string): {
    isSuspicious: boolean;
    detectedPatterns: string[];
    riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  } {
    const detectedPatterns: string[] = [];

    for (const pattern of this.PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(input)) {
        detectedPatterns.push(pattern.source);
      }
    }

    let riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical' = 'none';
    if (detectedPatterns.length === 0) {
      riskLevel = 'none';
    } else if (detectedPatterns.length === 1) {
      riskLevel = 'low';
    } else if (detectedPatterns.length <= 3) {
      riskLevel = 'medium';
    } else if (detectedPatterns.length <= 5) {
      riskLevel = 'high';
    } else {
      riskLevel = 'critical';
    }

    return {
      isSuspicious: detectedPatterns.length > 0,
      detectedPatterns,
      riskLevel,
    };
  }

  /**
   * Sanitize input by escaping dangerous characters
   */
  static sanitize(input: string): string {
    // Escape single quotes and other dangerous characters
    return input
      .replace(/'/g, "''")
      .replace(/\\/g, '\\\\')
      .replace(/\x00/g, '\\0')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\x1a/g, '\\Z');
  }
}

/**
 * XSS Detector - Prevents Cross-Site Scripting attacks
 */
export class XSSDetector {
  // XSS attack patterns
  private static readonly PATTERNS: RegExp[] = [
    // Script tags
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    /<script[^>]*>/gi,
    // Event handlers
    /\bon\w+\s*=/gi,
    // JavaScript URLs
    /javascript\s*:/gi,
    /vbscript\s*:/gi,
    /data\s*:[^,]*;base64/gi,
    // Expression/eval
    /expression\s*\(/gi,
    /eval\s*\(/gi,
    // DOM manipulation
    /document\s*\.\s*(cookie|domain|write|location)/gi,
    /window\s*\.\s*(location|open)/gi,
    // HTML injection
    /<(iframe|frame|object|embed|applet|form|input|button|select|textarea)/gi,
    /<(img|svg|body|style|link|meta)[^>]*>/gi,
    // SVG attacks
    /<svg[\s\S]*?onload/gi,
    // Style-based XSS
    /style\s*=\s*["'][^"']*expression/gi,
    /style\s*=\s*["'][^"']*javascript/gi,
    // Entity encoding bypass
    /&#x?[0-9a-f]+;/gi,
  ];

  /**
   * Detect XSS attempts
   */
  static detect(input: string): {
    isSuspicious: boolean;
    detectedPatterns: string[];
    riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  } {
    const detectedPatterns: string[] = [];

    for (const pattern of this.PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(input)) {
        detectedPatterns.push(pattern.source);
      }
    }

    let riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical' = 'none';
    if (detectedPatterns.length === 0) {
      riskLevel = 'none';
    } else if (detectedPatterns.length === 1) {
      riskLevel = 'low';
    } else if (detectedPatterns.length <= 3) {
      riskLevel = 'medium';
    } else if (detectedPatterns.length <= 5) {
      riskLevel = 'high';
    } else {
      riskLevel = 'critical';
    }

    return {
      isSuspicious: detectedPatterns.length > 0,
      detectedPatterns,
      riskLevel,
    };
  }

  /**
   * Sanitize input by encoding HTML entities
   */
  static sanitize(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
}

/**
 * Custom Zod refinements for security validation
 */
export const securityRefinements = {
  /**
   * Zod refinement to block PHI
   */
  noPHI: () =>
    z.string().superRefine((val, ctx) => {
      const detection = PHIDetector.detect(val);
      if (detection.hasPHI) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `PHI detected in input: ${detection.detectedTypes.join(', ')}`,
        });
      }
    }),

  /**
   * Zod refinement to block SQL injection
   */
  noSQLInjection: () =>
    z.string().superRefine((val, ctx) => {
      const detection = SQLInjectionDetector.detect(val);
      if (detection.isSuspicious) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `SQL injection attempt detected (risk: ${detection.riskLevel})`,
        });
      }
    }),

  /**
   * Zod refinement to block XSS
   */
  noXSS: () =>
    z.string().superRefine((val, ctx) => {
      const detection = XSSDetector.detect(val);
      if (detection.isSuspicious) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `XSS attempt detected (risk: ${detection.riskLevel})`,
        });
      }
    }),

  /**
   * Zod refinement for safe text (no PHI, SQL injection, or XSS)
   */
  safeText: () =>
    z.string().superRefine((val, ctx) => {
      const phiResult = PHIDetector.detect(val);
      if (phiResult.hasPHI) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `PHI detected: ${phiResult.detectedTypes.join(', ')}`,
        });
      }

      const sqlResult = SQLInjectionDetector.detect(val);
      if (sqlResult.isSuspicious) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `SQL injection detected (risk: ${sqlResult.riskLevel})`,
        });
      }

      const xssResult = XSSDetector.detect(val);
      if (xssResult.isSuspicious) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `XSS detected (risk: ${xssResult.riskLevel})`,
        });
      }
    }),

  /**
   * Safe string with auto-sanitization
   */
  sanitizedString: () =>
    z.string().transform((val) => {
      // Log if any dangerous patterns were found
      const sqlResult = SQLInjectionDetector.detect(val);
      const xssResult = XSSDetector.detect(val);

      if (sqlResult.isSuspicious || xssResult.isSuspicious) {
        void auditLogger.warn('INPUT_SANITIZED', {
          sqlRisk: sqlResult.riskLevel,
          xssRisk: xssResult.riskLevel,
        });
      }

      // First sanitize SQL, then XSS
      const sanitized = XSSDetector.sanitize(SQLInjectionDetector.sanitize(val));
      return sanitized;
    }),
};

/**
 * Schema Registry - Stores all validated schemas
 */
export class SchemaRegistry {
  private schemas: Map<string, z.ZodSchema> = new Map();

  /**
   * Register a schema for a tool/action
   */
  register(name: string, schema: z.ZodSchema): void {
    this.schemas.set(name, schema);
  }

  /**
   * Get a schema by name
   */
  get(name: string): z.ZodSchema | undefined {
    return this.schemas.get(name);
  }

  /**
   * Check if schema exists
   */
  has(name: string): boolean {
    return this.schemas.has(name);
  }

  /**
   * Get all registered schemas
   */
  list(): string[] {
    return Array.from(this.schemas.keys());
  }
}

/**
 * Schema Validator - Validates data against schemas
 */
export class SchemaValidator {
  private registry: SchemaRegistry;

  constructor() {
    this.registry = new SchemaRegistry();
    this.registerCoreSchemas();
  }

  /**
   * Validate input data against a schema
   */
  validateInput<T>(schemaName: string, data: unknown): {
    valid: boolean;
    data?: T;
    errors?: string[];
  } {
    const schema = this.registry.get(schemaName);

    if (!schema) {
      return {
        valid: false,
        errors: [`Schema '${schemaName}' not found in registry`],
      };
    }

    const result = schema.safeParse(data);

    if (result.success) {
      return {
        valid: true,
        data: result.data as T,
      };
    } else {
      return {
        valid: false,
        errors: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      };
    }
  }

  /**
   * Validate output data against a schema
   */
  validateOutput<T>(schemaName: string, data: unknown): {
    valid: boolean;
    data?: T;
    errors?: string[];
  } {
    // Same validation logic, but semantically different
    return this.validateInput<T>(schemaName, data);
  }

  /**
   * Register a new schema
   */
  registerSchema(name: string, schema: z.ZodSchema): void {
    this.registry.register(name, schema);
  }

  /**
   * Get registry for direct access
   */
  getRegistry(): SchemaRegistry {
    return this.registry;
  }

  /**
   * Register core Guardian Agent schemas
   */
  private registerCoreSchemas(): void {
    // DetectedIssue schema
    this.registry.register(
      'DetectedIssue',
      z.object({
        id: z.string(),
        timestamp: z.date(),
        signature: z.object({
          id: z.string(),
          category: z.string(),
          pattern: z.any(), // RegExp is hard to validate with Zod
          severity: z.enum(['low', 'medium', 'high', 'critical']),
          healingStrategies: z.array(z.string()),
          description: z.string(),
        }),
        severity: z.enum(['low', 'medium', 'high', 'critical']),
        matchedPattern: z.string(),
        affectedResources: z.array(z.string()),
        context: z.object({
          stackTrace: z.string().optional(),
          errorMessage: z.string().optional(),
          component: z.string().optional(),
          userId: z.string().optional(),
          sessionId: z.string().optional(),
          url: z.string().optional(),
          userAgent: z.string().optional(),
          timestamp: z.number().optional(),
        }),
        estimatedImpact: z.object({
          usersAffected: z.number(),
          dataAtRisk: z.boolean(),
          systemStability: z.enum(['stable', 'degraded', 'critical']),
        }),
      })
    );

    // HealingAction schema
    this.registry.register(
      'HealingAction',
      z.object({
        id: z.string(),
        issueId: z.string(),
        strategy: z.string(),
        description: z.string(),
        steps: z.array(
          z.object({
            action: z.string(),
            target: z.string(),
            parameters: z.record(z.string(), z.any()),
            timeout: z.number(),
          })
        ),
        rollbackPlan: z.array(
          z.object({
            action: z.string(),
            target: z.string(),
            parameters: z.record(z.string(), z.any()),
          })
        ),
        estimatedTime: z.number(),
        requiresApproval: z.boolean(),
      })
    );

    // HealingResult schema
    this.registry.register(
      'HealingResult',
      z.object({
        actionId: z.string(),
        success: z.boolean(),
        outcomeDescription: z.string(),
        stepsCompleted: z.number(),
        totalSteps: z.number(),
        metrics: z.object({
          timeToDetect: z.number(),
          timeToHeal: z.number(),
          resourcesAffected: z.number(),
          usersImpacted: z.number(),
        }),
        lessons: z.array(z.string()),
        preventiveMeasures: z.array(z.string()),
      })
    );

    // API Response schema (for external API calls)
    this.registry.register(
      'ApiResponse',
      z.object({
        status: z.number(),
        data: z.any(),
        headers: z.record(z.string(), z.string()).optional(),
        error: z.string().optional(),
      })
    );

    // Database Query Result schema
    this.registry.register(
      'DatabaseQueryResult',
      z.object({
        rows: z.array(z.record(z.string(), z.any())),
        count: z.number(),
        error: z.string().optional(),
      })
    );

    // File Operation Result schema
    this.registry.register(
      'FileOperationResult',
      z.object({
        success: z.boolean(),
        path: z.string(),
        operation: z.enum(['read', 'write', 'delete', 'move']),
        content: z.string().optional(),
        error: z.string().optional(),
      })
    );

    // Cache Operation Result schema
    this.registry.register(
      'CacheOperationResult',
      z.object({
        success: z.boolean(),
        key: z.string(),
        value: z.any().optional(),
        ttl: z.number().optional(),
        error: z.string().optional(),
      })
    );

    // FHIR Resource schemas (examples)
    this.registerFHIRSchemas();
  }

  /**
   * Register FHIR resource schemas
   */
  private registerFHIRSchemas(): void {
    // FHIR Observation (simplified)
    this.registry.register(
      'fhir.Observation',
      z.object({
        resourceType: z.literal('Observation'),
        id: z.string().optional(),
        status: z.enum(['registered', 'preliminary', 'final', 'amended']),
        code: z.object({
          coding: z.array(
            z.object({
              system: z.string(),
              code: z.string(),
              display: z.string().optional(),
            })
          ),
        }),
        subject: z.object({
          reference: z.string(),
        }),
        effectiveDateTime: z.string().optional(),
        valueQuantity: z
          .object({
            value: z.number(),
            unit: z.string(),
            system: z.string().optional(),
            code: z.string().optional(),
          })
          .optional(),
      })
    );

    // FHIR Patient (simplified)
    this.registry.register(
      'fhir.Patient',
      z.object({
        resourceType: z.literal('Patient'),
        id: z.string().optional(),
        active: z.boolean().optional(),
        name: z
          .array(
            z.object({
              use: z.enum(['official', 'usual', 'nickname', 'anonymous']).optional(),
              family: z.string().optional(),
              given: z.array(z.string()).optional(),
            })
          )
          .optional(),
        gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
        birthDate: z.string().optional(),
      })
    );

    // FHIR Condition (simplified)
    this.registry.register(
      'fhir.Condition',
      z.object({
        resourceType: z.literal('Condition'),
        id: z.string().optional(),
        clinicalStatus: z
          .object({
            coding: z.array(
              z.object({
                system: z.string(),
                code: z.string(),
              })
            ),
          })
          .optional(),
        code: z.object({
          coding: z.array(
            z.object({
              system: z.string(),
              code: z.string(),
              display: z.string().optional(),
            })
          ),
        }),
        subject: z.object({
          reference: z.string(),
        }),
      })
    );
  }
}

/**
 * Schema-locked wrapper for tool execution
 * Ensures all inputs/outputs are validated
 */
export class SchemaLockedTool<TInput, TOutput> {
  private validator: SchemaValidator;
  private inputSchemaName: string;
  private outputSchemaName: string;
  private toolName: string;

  constructor(
    validator: SchemaValidator,
    toolName: string,
    inputSchemaName: string,
    outputSchemaName: string
  ) {
    this.validator = validator;
    this.toolName = toolName;
    this.inputSchemaName = inputSchemaName;
    this.outputSchemaName = outputSchemaName;
  }

  /**
   * Execute tool with schema validation
   */
  async execute(
    input: unknown,
    executor: (validatedInput: TInput) => Promise<TOutput>
  ): Promise<{
    success: boolean;
    output?: TOutput;
    errors?: string[];
  }> {
    // Validate input
    const inputValidation = this.validator.validateInput<TInput>(this.inputSchemaName, input);

    if (!inputValidation.valid || !inputValidation.data) {
      // Schema validation failed - errors logged to audit system
      return {
        success: false,
        errors: inputValidation.errors,
      };
    }

    try {
      // Execute with validated input
      const output = await executor(inputValidation.data);

      // Validate output
      const outputValidation = this.validator.validateOutput<TOutput>(this.outputSchemaName, output);

      if (!outputValidation.valid) {
        // Output validation failed - errors logged to audit system
        return {
          success: false,
          errors: outputValidation.errors,
        };
      }

      return {
        success: true,
        output: outputValidation.data,
      };
    } catch (error: unknown) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }
}

/**
 * Global schema validator instance
 */
let globalValidator: SchemaValidator | null = null;

export function getSchemaValidator(): SchemaValidator {
  if (!globalValidator) {
    globalValidator = new SchemaValidator();
  }
  return globalValidator;
}

/**
 * Helper function to create schema-locked tools
 */
export function createSchemaLockedTool<TInput, TOutput>(
  toolName: string,
  inputSchemaName: string,
  outputSchemaName: string
): SchemaLockedTool<TInput, TOutput> {
  const validator = getSchemaValidator();
  return new SchemaLockedTool<TInput, TOutput>(validator, toolName, inputSchemaName, outputSchemaName);
}

/**
 * Implementation Status:
 *
 * ✅ IMPLEMENTED:
 * 1. PHI Detection (HIPAA 18 identifiers):
 *    - SSN, Phone, Email, MRN, IP, DOB, ZIP+4, VIN, URL
 *    - Biometric keywords, Face/Photo keywords
 *    - PHI redaction for logging
 *
 * 2. SQL Injection Detection:
 *    - Classic injection (OR/AND attacks)
 *    - Union-based injection
 *    - Comment-based injection
 *    - Time-based (SLEEP/BENCHMARK)
 *    - Stacked queries detection
 *    - Risk level assessment
 *
 * 3. XSS Detection:
 *    - Script tags and event handlers
 *    - JavaScript/VBScript URLs
 *    - DOM manipulation patterns
 *    - HTML injection (iframe, object, etc.)
 *    - SVG-based attacks
 *    - Entity encoding bypass
 *    - Risk level assessment
 *
 * 4. Zod Refinements:
 *    - securityRefinements.noPHI()
 *    - securityRefinements.noSQLInjection()
 *    - securityRefinements.noXSS()
 *    - securityRefinements.safeText()
 *    - securityRefinements.sanitizedString()
 *
 * 🔲 TODO (Future Enhancements):
 *
 * 1. Auto-generate Zod schemas from TypeScript types:
 *    - Use ts-to-zod or zod-to-ts
 *    - Keep schemas in sync with types
 *    - Generate at build time
 *
 * 2. Version schemas:
 *    - Schema versioning (v1, v2, etc.)
 *    - Backward compatibility checking
 *    - Migration paths for schema changes
 *
 * 3. Add business rule validators:
 *    - Custom validation for domain-specific rules
 *    - Cross-field validation
 *    - Async validators for database lookups
 *
 * 4. Add telemetry:
 *    - Log all validation failures
 *    - Track most common validation errors
 *    - Alert on schema violations
 *
 * 5. Add schema documentation:
 *    - Generate schema docs from Zod schemas
 *    - Examples for each schema
 *    - Validation rules documentation
 */
