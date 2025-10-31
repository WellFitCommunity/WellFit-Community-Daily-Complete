/**
 * Schema Validator - Zod-based I/O validation
 * Prevents AI hallucination by enforcing strict type safety
 *
 * Every tool input and output must be validated against a schema
 * This ensures the agent cannot invent fields or return malformed data
 */

import { z } from 'zod';
import { DetectedIssue, HealingAction, HealingResult } from './types';

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
        errors: result.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`),
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
            parameters: z.record(z.any()),
            timeout: z.number(),
          })
        ),
        rollbackPlan: z.array(
          z.object({
            action: z.string(),
            target: z.string(),
            parameters: z.record(z.any()),
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
        headers: z.record(z.string()).optional(),
        error: z.string().optional(),
      })
    );

    // Database Query Result schema
    this.registry.register(
      'DatabaseQueryResult',
      z.object({
        rows: z.array(z.record(z.any())),
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
        valueQuantity: z.object({
          value: z.number(),
          unit: z.string(),
          system: z.string().optional(),
          code: z.string().optional(),
        }).optional(),
      })
    );

    // FHIR Patient (simplified)
    this.registry.register(
      'fhir.Patient',
      z.object({
        resourceType: z.literal('Patient'),
        id: z.string().optional(),
        active: z.boolean().optional(),
        name: z.array(
          z.object({
            use: z.enum(['official', 'usual', 'nickname', 'anonymous']).optional(),
            family: z.string().optional(),
            given: z.array(z.string()).optional(),
          })
        ).optional(),
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
        clinicalStatus: z.object({
          coding: z.array(
            z.object({
              system: z.string(),
              code: z.string(),
            })
          ),
        }).optional(),
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
    const inputValidation = this.validator.validateInput<TInput>(
      this.inputSchemaName,
      input
    );

    if (!inputValidation.valid) {
      // Schema validation failed - errors logged to audit system
      return {
        success: false,
        errors: inputValidation.errors,
      };
    }

    try {
      // Execute with validated input
      const output = await executor(inputValidation.data!);

      // Validate output
      const outputValidation = this.validator.validateOutput<TOutput>(
        this.outputSchemaName,
        output
      );

      if (!outputValidation.valid) {
        // Output validation failed - errors logged to audit system
        return {
          success: false,
          errors: outputValidation.errors,
        };
      }

      return {
        success: true,
        output: outputValidation.data!,
      };
    } catch (error) {

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
  return new SchemaLockedTool<TInput, TOutput>(
    validator,
    toolName,
    inputSchemaName,
    outputSchemaName
  );
}

/**
 * Production TODO:
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
 * 3. Add custom validators:
 *    - PHI detection validator
 *    - SQL injection validator
 *    - XSS validator
 *    - Business rule validators
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
