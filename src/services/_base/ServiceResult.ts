/**
 * ServiceResult - Standardized return type for all service operations
 *
 * This provides a consistent interface for all service methods:
 * - Never throws exceptions (errors are in the result)
 * - Always returns success/failure status
 * - Includes typed error information
 *
 * @example
 * // In a service:
 * async function getUser(id: string): Promise<ServiceResult<User>> {
 *   try {
 *     const user = await fetchUser(id);
 *     return success(user);
 *   } catch (err) {
 *     return failure('USER_NOT_FOUND', 'User not found', err);
 *   }
 * }
 *
 * // In a component:
 * const result = await UserService.getUser(id);
 * if (result.success) {
 *   setUser(result.data);
 * } else {
 *   showError(result.error.message);
 * }
 */

/**
 * Standard error codes used across all services
 */
export type ServiceErrorCode =
  // Generic errors
  | 'UNKNOWN_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  // Auth errors
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'SESSION_EXPIRED'
  // Data errors
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'VALIDATION_ERROR'
  | 'INVALID_INPUT'
  // Database errors
  | 'DATABASE_ERROR'
  | 'CONSTRAINT_VIOLATION'
  // Business logic errors
  | 'OPERATION_FAILED'
  | 'NOT_ENTITLED'
  | 'MODULE_DISABLED'
  | 'RATE_LIMITED'
  // External service errors
  | 'EXTERNAL_SERVICE_ERROR'
  | 'API_ERROR'
  // AI service errors
  | 'AI_SERVICE_ERROR'
  | 'EDUCATION_GENERATION_FAILED'
  | 'BRIEFING_GENERATION_FAILED'
  | 'ANOMALY_DETECTION_FAILED'
  | 'QUESTION_GENERATION_FAILED'
  // SOAP Note AI errors
  | 'SOAP_NOTE_GENERATION_FAILED'
  | 'SOAP_NOTE_SAVE_FAILED'
  | 'HISTORY_FETCH_FAILED'
  // Patient Q&A Bot errors
  | 'INVALID_QUESTION'
  | 'QUESTION_TOO_LONG'
  | 'QA_REQUEST_FAILED'
  | 'TOPICS_FETCH_FAILED'
  | 'REPORT_FAILED'
  // Care Plan AI errors
  | 'CARE_PLAN_GENERATION_FAILED'
  | 'CARE_PLAN_SAVE_FAILED'
  | 'CARE_PLAN_APPROVAL_FAILED'
  | 'CARE_PLAN_REJECTION_FAILED'
  // Treatment Pathway AI errors
  | 'TREATMENT_PATHWAY_GENERATION_FAILED'
  | 'TREATMENT_PATHWAY_SAVE_FAILED'
  | 'TREATMENT_PATHWAY_APPROVAL_FAILED'
  | 'TREATMENT_PATHWAY_REJECTION_FAILED'
  | 'CONTRAINDICATION_CHECK_FAILED'
  // Discharge Summary AI errors
  | 'DISCHARGE_SUMMARY_GENERATION_FAILED'
  | 'DISCHARGE_SUMMARY_SAVE_FAILED'
  | 'DISCHARGE_SUMMARY_APPROVAL_FAILED'
  | 'DISCHARGE_SUMMARY_REJECTION_FAILED'
  | 'DISCHARGE_SUMMARY_RELEASE_FAILED'
  // Progress Note Synthesizer AI errors
  | 'PROGRESS_NOTE_SYNTHESIS_FAILED'
  | 'PROGRESS_NOTE_SAVE_FAILED'
  | 'PROGRESS_NOTE_APPROVAL_FAILED'
  | 'PROGRESS_NOTE_REJECTION_FAILED'
  | 'PROGRESS_NOTE_FINALIZE_FAILED';

/**
 * Structured error information
 */
export interface ServiceError {
  /** Error code for programmatic handling */
  code: ServiceErrorCode;
  /** Human-readable error message */
  message: string;
  /** Additional context (without PHI!) */
  details?: Record<string, unknown>;
  /** Original error if available (for debugging) */
  originalError?: unknown;
}

/**
 * Successful result
 */
export interface ServiceSuccess<T> {
  success: true;
  data: T;
  error: null;
}

/**
 * Failed result
 */
export interface ServiceFailure {
  success: false;
  data: null;
  error: ServiceError;
}

/**
 * Union type for service results
 */
export type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure;

/**
 * Create a successful result
 */
export function success<T>(data: T): ServiceSuccess<T> {
  return {
    success: true,
    data,
    error: null,
  };
}

/**
 * Create a failed result
 */
export function failure(
  code: ServiceErrorCode,
  message: string,
  originalError?: unknown,
  details?: Record<string, unknown>
): ServiceFailure {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      details,
      originalError,
    },
  };
}

/**
 * Type guard to check if result is successful
 */
export function isSuccess<T>(result: ServiceResult<T>): result is ServiceSuccess<T> {
  return result.success === true;
}

/**
 * Type guard to check if result is a failure
 */
export function isFailure<T>(result: ServiceResult<T>): result is ServiceFailure {
  return result.success === false;
}

/**
 * Extract data from result or throw
 * Use only when you're certain the operation succeeded
 */
export function unwrap<T>(result: ServiceResult<T>): T {
  if (result.success) {
    return result.data;
  }
  throw new Error(result.error.message);
}

/**
 * Extract data from result or return default value
 */
export function unwrapOr<T>(result: ServiceResult<T>, defaultValue: T): T {
  if (result.success) {
    return result.data;
  }
  return defaultValue;
}

/**
 * Map successful result to a new type
 */
export function mapSuccess<T, U>(
  result: ServiceResult<T>,
  fn: (data: T) => U
): ServiceResult<U> {
  if (result.success) {
    return success(fn(result.data));
  }
  return result;
}

/**
 * Convert Supabase error to ServiceError
 */
export function fromSupabaseError(error: { message: string; code?: string }): ServiceError {
  // Map common Supabase error codes
  let code: ServiceErrorCode = 'DATABASE_ERROR';

  if (error.code === 'PGRST116') {
    code = 'NOT_FOUND';
  } else if (error.code === '23505') {
    code = 'ALREADY_EXISTS';
  } else if (error.code === '23503') {
    code = 'CONSTRAINT_VIOLATION';
  } else if (error.code === '42501' || error.message?.includes('permission denied')) {
    code = 'FORBIDDEN';
  }

  return {
    code,
    message: error.message,
    originalError: error,
  };
}
