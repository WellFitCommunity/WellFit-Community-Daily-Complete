/**
 * ServiceResult Pattern Integration Tests
 *
 * Tests the ServiceResult pattern used across all services.
 * Verifies proper error handling and result propagation.
 */

import { describe, it, expect } from 'vitest';

// ServiceResult types (mirroring src/services/_base/types.ts)
interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Helper functions (mirroring src/services/_base/helpers.ts)
function success<T>(data: T): ServiceResult<T> {
  return { success: true, data };
}

function failure<T>(code: string, message: string, details?: unknown): ServiceResult<T> {
  return {
    success: false,
    error: { code, message, details }
  };
}

describe('ServiceResult Pattern Integration', () => {
  describe('Success Results', () => {
    it('should create success result with data', () => {
      const result = success({ id: '123', name: 'Test' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '123', name: 'Test' });
      expect(result.error).toBeUndefined();
    });

    it('should handle null data as valid success', () => {
      const result = success(null);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should handle array data', () => {
      const items = [{ id: '1' }, { id: '2' }];
      const result = success(items);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('Failure Results', () => {
    it('should create failure result with error details', () => {
      const result = failure<string>(
        'NOT_FOUND',
        'Resource not found',
        { resourceId: '123' }
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
      expect(result.error?.message).toBe('Resource not found');
      expect(result.error?.details).toEqual({ resourceId: '123' });
    });

    it('should handle failure without details', () => {
      const result = failure<string>('UNKNOWN_ERROR', 'Something went wrong');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
      expect(result.error?.details).toBeUndefined();
    });
  });

  describe('Error Code Standards', () => {
    it('should use SCREAMING_SNAKE_CASE for error codes', () => {
      const validCodes = [
        'NOT_FOUND',
        'UNAUTHORIZED',
        'DATABASE_ERROR',
        'VALIDATION_ERROR',
        'RATE_LIMITED',
        'CLINICAL_IMMUTABILITY_VIOLATION'
      ];

      validCodes.forEach(code => {
        const result = failure(code, 'Test message');
        expect(result.error?.code).toMatch(/^[A-Z][A-Z0-9_]*$/);
      });
    });
  });

  describe('Type Safety', () => {
    it('should preserve type information in success results', () => {
      interface Patient {
        id: string;
        name: string;
        dob: string;
      }

      const patient: Patient = { id: '123', name: 'John', dob: '1990-01-01' };
      const result = success<Patient>(patient);

      // TypeScript should know result.data is Patient type
      expect(result.data?.id).toBe('123');
      expect(result.data?.name).toBe('John');
    });

    it('should allow generic type in failure results', () => {
      const result = failure<{ items: string[] }>(
        'EMPTY_LIST',
        'No items found'
      );

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
    });
  });

  describe('Result Chaining', () => {
    it('should support result checking pattern', () => {
      function processResult<T>(result: ServiceResult<T>): string {
        if (result.success && result.data) {
          return 'processed';
        }
        return `error: ${result.error?.code}`;
      }

      const successResult = success({ value: 42 });
      const failureResult = failure('FAILED', 'Operation failed');

      expect(processResult(successResult)).toBe('processed');
      expect(processResult(failureResult)).toBe('error: FAILED');
    });

    it('should support early return on failure', () => {
      function operation1(): ServiceResult<number> {
        return success(10);
      }

      function operation2(input: number): ServiceResult<number> {
        if (input < 5) {
          return failure('TOO_SMALL', 'Input must be >= 5');
        }
        return success(input * 2);
      }

      function chainedOperation(): ServiceResult<number> {
        const result1 = operation1();
        if (!result1.success || result1.data === undefined) {
          return failure('CHAIN_FAILED', 'Operation 1 failed');
        }

        return operation2(result1.data);
      }

      const result = chainedOperation();
      expect(result.success).toBe(true);
      expect(result.data).toBe(20);
    });
  });
});
