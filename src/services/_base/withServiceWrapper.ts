/**
 * Service Wrapper Utilities
 *
 * Higher-order functions to wrap service operations with consistent
 * error handling, logging, and result formatting.
 */

import { ServiceResult, ServiceErrorCode, success, failure } from './ServiceResult';
import { auditLogger } from '../auditLogger';

/**
 * Options for the service wrapper
 */
export interface ServiceWrapperOptions {
  /** Operation name for logging */
  operationName: string;
  /** Should errors be logged to audit log? Default: true */
  logErrors?: boolean;
  /** Custom error code mapping */
  errorCodeMap?: Record<string, ServiceErrorCode>;
  /** Timeout in milliseconds (0 = no timeout) */
  timeout?: number;
}

/**
 * Wrap an async operation with standardized error handling
 *
 * @example
 * const getUser = withServiceWrapper(
 *   async (id: string) => {
 *     const { data, error } = await supabase.from('users').select().eq('id', id).single();
 *     if (error) throw error;
 *     return data;
 *   },
 *   { operationName: 'getUser' }
 * );
 *
 * const result = await getUser('123');
 */
export function withServiceWrapper<TArgs extends unknown[], TResult>(
  operation: (...args: TArgs) => Promise<TResult>,
  options: ServiceWrapperOptions
): (...args: TArgs) => Promise<ServiceResult<TResult>> {
  const { operationName, logErrors = true, errorCodeMap = {}, timeout = 0 } = options;

  return async (...args: TArgs): Promise<ServiceResult<TResult>> => {
    try {
      let result: TResult;

      if (timeout > 0) {
        // With timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Operation timed out')), timeout);
        });
        result = await Promise.race([operation(...args), timeoutPromise]);
      } else {
        // Without timeout
        result = await operation(...args);
      }

      return success(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      // Determine error code
      let code: ServiceErrorCode = 'OPERATION_FAILED';

      // Check custom error code mapping
      if (error.message && errorCodeMap[error.message]) {
        code = errorCodeMap[error.message];
      }
      // Check for common error patterns
      else if (error.message?.includes('timeout')) {
        code = 'TIMEOUT';
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        code = 'NETWORK_ERROR';
      } else if (error.message?.includes('not found') || error.message?.includes('PGRST116')) {
        code = 'NOT_FOUND';
      } else if (error.message?.includes('unauthorized') || error.message?.includes('401')) {
        code = 'UNAUTHORIZED';
      } else if (error.message?.includes('forbidden') || error.message?.includes('403')) {
        code = 'FORBIDDEN';
      }

      // Log error if enabled
      if (logErrors) {
        await auditLogger.error(`SERVICE_ERROR_${operationName.toUpperCase()}`, error, {
          operation: operationName,
          errorCode: code,
        }).catch(() => {
          // Silently fail if audit logging fails
        });
      }

      return failure(code, error.message, err);
    }
  };
}

/**
 * Create a service method that wraps Supabase queries
 *
 * @example
 * const getProfile = createSupabaseQuery(
 *   async (userId: string) => {
 *     return supabase.from('profiles').select('*').eq('id', userId).single();
 *   },
 *   { operationName: 'getProfile' }
 * );
 */
export function createSupabaseQuery<TArgs extends unknown[], TResult>(
  query: (...args: TArgs) => Promise<{ data: TResult | null; error: { message: string; code?: string } | null }>,
  options: ServiceWrapperOptions
): (...args: TArgs) => Promise<ServiceResult<TResult>> {
  return withServiceWrapper(
    async (...args: TArgs): Promise<TResult> => {
      const { data, error } = await query(...args);

      if (error) {
        throw error;
      }

      if (data === null) {
        throw new Error('No data returned');
      }

      return data;
    },
    options
  );
}

/**
 * Retry a service operation on failure
 *
 * @example
 * const getUserWithRetry = withRetry(getUser, { maxRetries: 3, delayMs: 1000 });
 */
export function withRetry<TArgs extends unknown[], TResult>(
  operation: (...args: TArgs) => Promise<ServiceResult<TResult>>,
  options: { maxRetries: number; delayMs: number; retryOn?: ServiceErrorCode[] }
): (...args: TArgs) => Promise<ServiceResult<TResult>> {
  const { maxRetries, delayMs, retryOn = ['NETWORK_ERROR', 'TIMEOUT'] } = options;

  return async (...args: TArgs): Promise<ServiceResult<TResult>> => {
    let lastResult: ServiceResult<TResult> | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      lastResult = await operation(...args);

      if (lastResult.success) {
        return lastResult;
      }

      // Check if we should retry this error type
      if (!retryOn.includes(lastResult.error.code)) {
        return lastResult;
      }

      // Don't delay on the last attempt
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }

    // lastResult is guaranteed to be assigned since maxRetries >= 0
    return lastResult as ServiceResult<TResult>;
  };
}
