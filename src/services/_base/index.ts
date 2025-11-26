/**
 * Service Base Utilities
 *
 * This module provides standardized patterns for all services:
 * - ServiceResult type for consistent return values
 * - Error handling wrappers
 * - Retry utilities
 *
 * @example
 * import { ServiceResult, success, failure, withServiceWrapper } from './_base';
 *
 * export const UserService = {
 *   async getUser(id: string): Promise<ServiceResult<User>> {
 *     // Implementation
 *   }
 * };
 */

// Result types and helpers
export type {
  ServiceResult,
  ServiceSuccess,
  ServiceFailure,
  ServiceError,
  ServiceErrorCode,
} from './ServiceResult';

export {
  success,
  failure,
  isSuccess,
  isFailure,
  unwrap,
  unwrapOr,
  mapSuccess,
  fromSupabaseError,
} from './ServiceResult';

// Wrapper utilities
export type {
  ServiceWrapperOptions,
} from './withServiceWrapper';

export {
  withServiceWrapper,
  createSupabaseQuery,
  withRetry,
} from './withServiceWrapper';
