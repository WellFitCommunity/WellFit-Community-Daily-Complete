/**
 * Enterprise-Grade Pagination Utilities for Envision VirtualEdge Group System
 *
 * HIPAA-compliant pagination for healthcare data at scale
 * Supports both offset-based and cursor-based pagination strategies
 *
 * @module pagination
 * @author WellFit Systems Architecture Team
 */

import { SupabaseClient as _SupabaseClient } from '@supabase/supabase-js';
import { auditLogger } from '../services/auditLogger';

/**
 * Standard pagination configuration for different data types
 */
export const PAGINATION_LIMITS = {
  // High-frequency clinical data (vitals, labs, observations)
  VITALS: 100,
  LABS: 50,
  OBSERVATIONS: 100,

  // Patient and encounter data
  PATIENTS: 50,
  ENCOUNTERS: 50,
  APPOINTMENTS: 50,

  // Billing and claims (can be large)
  CLAIMS: 100,
  CLAIM_LINES: 200,
  FEE_SCHEDULES: 50,
  FEE_SCHEDULE_ITEMS: 1000, // CPT codes per schedule

  // Audit and compliance logs (grows continuously)
  AUDIT_LOGS: 100,
  PHI_ACCESS_LOGS: 100,
  SECURITY_EVENTS: 50,
  TRACKING_EVENTS: 200,

  // Care coordination
  CARE_PLANS: 50,
  DISCHARGE_PLANS: 50,
  HANDOFFS: 50,
  ALERTS: 100,

  // Assessments and questionnaires
  ASSESSMENTS: 50,
  QUESTIONNAIRES: 50,

  // Wearable and device data (very high volume)
  WEARABLE_VITALS: 500, // Can be 1/min = 1440/day
  WEARABLE_ACTIVITIES: 100,
  DEVICE_READINGS: 500,

  // Lists and reference data
  PROVIDERS: 100,
  FACILITIES: 100,
  MEDICATIONS: 100,

  // Default fallback
  DEFAULT: 50,
  MAX: 1000, // Hard limit for any single query
} as const;

/**
 * Pagination metadata for offset-based pagination
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Cursor-based pagination metadata (better for real-time data)
 */
export interface CursorPaginationMeta {
  nextCursor: string | null;
  previousCursor: string | null;
  hasMore: boolean;
  pageSize: number;
  total?: number; // Optional, expensive to calculate
}

/**
 * Paginated result wrapper for offset-based pagination
 */
export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Paginated result wrapper for cursor-based pagination
 */
export interface CursorPaginatedResult<T> {
  data: T[];
  meta: CursorPaginationMeta;
}

/**
 * Pagination options for queries
 */
export interface PaginationOptions {
  page?: number; // 1-indexed page number
  pageSize?: number; // Number of records per page
  maxPageSize?: number; // Maximum allowed page size
}

/**
 * Cursor pagination options
 */
export interface CursorPaginationOptions {
  cursor?: string | null; // Cursor for next page
  pageSize?: number; // Number of records per page
  direction?: 'forward' | 'backward'; // Pagination direction
}

type RangeQueryable = {
  select: (columns: string, options?: Record<string, unknown>) => Promise<{ count: number | null; error: { message: string } | null }>;
  range: (from: number, to: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
};

type CursorQueryable<TItem extends Record<string, unknown>> = {
  or: (filters: string) => CursorQueryable<TItem>;
  order: (column: string, options?: { ascending: boolean }) => CursorQueryable<TItem>;
  limit: (count: number) => Promise<{ data: TItem[] | null; error: { message: string } | null }>;
};

/**
 * Calculate offset-based pagination parameters
 */
export function calculatePagination(
  options: PaginationOptions,
  defaultPageSize: number = PAGINATION_LIMITS.DEFAULT
): { offset: number; limit: number; page: number; pageSize: number } {
  const page = Math.max(1, options.page || 1);
  const requestedPageSize = options.pageSize || defaultPageSize;
  const maxPageSize = options.maxPageSize || PAGINATION_LIMITS.MAX;

  // Enforce maximum page size for security
  const pageSize = Math.min(requestedPageSize, maxPageSize);
  const offset = (page - 1) * pageSize;

  return {
    offset,
    limit: pageSize,
    page,
    pageSize,
  };
}

/**
 * Build pagination metadata from query results
 */
export function buildPaginationMeta(
  total: number,
  page: number,
  pageSize: number
): PaginationMeta {
  const totalPages = Math.ceil(total / pageSize);

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * Apply offset-based pagination to a Supabase query
 *
 * @example
 * const query = supabase.from('patients').select('*');
 * const result = await applyPagination(query, { page: 2, pageSize: 50 });
 */
export async function applyPagination<T>(
  query: RangeQueryable,
  options: PaginationOptions,
  defaultPageSize: number = PAGINATION_LIMITS.DEFAULT
): Promise<PaginatedResult<T>> {
  const { offset, limit, page, pageSize } = calculatePagination(options, defaultPageSize);

  // Get total count (expensive, consider caching)
  const countQuery = query;
  const { count, error: countError } = await countQuery.select('*', { count: 'exact', head: true });

  if (countError) {
    throw new Error(`Failed to get total count: ${countError.message}`);
  }

  const total = count || 0;

  // Get paginated data
  const { data, error } = await query.range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Pagination query failed: ${error.message}`);
  }

  return {
    data: (data as T[]) || [],
    meta: buildPaginationMeta(total, page, pageSize),
  };
}

/**
 * Apply simple limit without full pagination metadata
 * Use this for queries where you don't need total counts
 *
 * @example
 * const query = supabase.from('lab_results').select('*').eq('patient_id', id);
 * const data = await applyLimit(query, PAGINATION_LIMITS.LABS);
 */
export async function applyLimit<T>(
  query: RangeQueryable,
  limit: number = PAGINATION_LIMITS.DEFAULT,
  offset: number = 0
): Promise<T[]> {
  const { data, error } = await query.range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Query with limit failed: ${error.message}`);
  }

  return (data as T[]) || [];
}

/**
 * Encode cursor for cursor-based pagination
 * Cursor format: base64(timestamp|id) for time-series data
 */
export function encodeCursor(timestamp: string, id: string): string {
  const payload = `${timestamp}|${id}`;
  return Buffer.from(payload).toString('base64');
}

/**
 * Decode cursor for cursor-based pagination
 */
export function decodeCursor(cursor: string): { timestamp: string; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const [timestamp, id] = decoded.split('|');

    if (!timestamp || !id) {
      return null;
    }

    return { timestamp, id };
  } catch {
    return null;
  }
}

/**
 * Apply cursor-based pagination to a time-series query
 * Best for: audit logs, vitals, wearable data, events
 *
 * @example
 * const query = supabase
 *   .from('wearable_vital_signs')
 *   .select('*')
 *   .eq('user_id', userId);
 *
 * const result = await applyCursorPagination(
 *   query,
 *   'measured_at',
 *   'id',
 *   { cursor: nextCursor, pageSize: 500 }
 * );
 */
export async function applyCursorPagination<T extends Record<string, unknown>>(
  query: CursorQueryable<T>,
  timestampField: string,
  idField: string,
  options: CursorPaginationOptions,
  defaultPageSize: number = PAGINATION_LIMITS.DEFAULT
): Promise<CursorPaginatedResult<T>> {
  const pageSize = Math.min(
    options.pageSize || defaultPageSize,
    PAGINATION_LIMITS.MAX
  );
  const direction = options.direction || 'forward';

  // Apply cursor filtering if provided
  if (options.cursor) {
    const decoded = decodeCursor(options.cursor);

    if (decoded) {
      if (direction === 'forward') {
        query = query.or(
          `${timestampField}.gt.${decoded.timestamp},and(${timestampField}.eq.${decoded.timestamp},${idField}.gt.${decoded.id})`
        );
      } else {
        query = query.or(
          `${timestampField}.lt.${decoded.timestamp},and(${timestampField}.eq.${decoded.timestamp},${idField}.lt.${decoded.id})`
        );
      }
    }
  }

  // Fetch one extra record to determine if there are more pages
  const limit = pageSize + 1;
  const { data, error } = await query
    .order(timestampField, { ascending: direction === 'forward' })
    .order(idField, { ascending: direction === 'forward' })
    .limit(limit);

  if (error) {
    throw new Error(`Cursor pagination query failed: ${error.message}`);
  }

  const results = data || [];
  const hasMore = results.length > pageSize;

  // Remove the extra record if present
  const pageData = hasMore ? results.slice(0, pageSize) : results;

  // Build next/previous cursors
  let nextCursor: string | null = null;
  let previousCursor: string | null = null;

  if (hasMore && pageData.length > 0) {
    const lastItem = pageData[pageData.length - 1];
    const lastTimestamp = lastItem[timestampField];
    const lastId = lastItem[idField];

    if (typeof lastTimestamp === 'string' && typeof lastId === 'string') {
      nextCursor = encodeCursor(lastTimestamp, lastId);
    }
  }

  if (pageData.length > 0) {
    const firstItem = pageData[0];
    const firstTimestamp = firstItem[timestampField];
    const firstId = firstItem[idField];

    if (typeof firstTimestamp === 'string' && typeof firstId === 'string') {
      previousCursor = encodeCursor(firstTimestamp, firstId);
    }
  }

  return {
    data: pageData,
    meta: {
      nextCursor,
      previousCursor,
      hasMore,
      pageSize,
    },
  };
}

/**
 * HIPAA-compliant pagination for PHI data
 * Includes audit logging of pagination queries
 *
 * NOTE: This function should be called from server-side code that uses
 * the proper auditLogger service for HIPAA compliance.
 * Client-side code should not directly access PHI data.
 */
export async function applyPHIPagination<T>(
  query: RangeQueryable,
  options: PaginationOptions,
  auditContext: {
    userId: string;
    resourceType: string;
    action: string;
  },
  defaultPageSize: number = PAGINATION_LIMITS.DEFAULT
): Promise<PaginatedResult<T>> {
  const { offset, page, pageSize } = calculatePagination(options, defaultPageSize);

  // Log PHI access before query
  await auditLogger.info('PHI_PAGINATED_ACCESS', {
    userId: auditContext.userId,
    resourceType: auditContext.resourceType,
    action: auditContext.action,
    page,
    pageSize,
    offset,
  });

  // Apply standard pagination
  return applyPagination<T>(query, options, defaultPageSize);
}

/**
 * Helper: Get recommended page size for a resource type
 */
export function getRecommendedPageSize(resourceType: string): number {
  const normalized = resourceType.toUpperCase().replace(/[_-]/g, '_');

  // Check if we have a specific limit for this resource
  if (normalized in PAGINATION_LIMITS) {
    return PAGINATION_LIMITS[normalized as keyof typeof PAGINATION_LIMITS] as number;
  }

  // Fallback to default
  return PAGINATION_LIMITS.DEFAULT;
}

/**
 * Validate pagination options
 */
export function validatePaginationOptions(options: PaginationOptions): void {
  if (options.page !== undefined && options.page < 1) {
    throw new Error('Page number must be >= 1');
  }

  if (options.pageSize !== undefined && options.pageSize < 1) {
    throw new Error('Page size must be >= 1');
  }

  if (options.pageSize !== undefined && options.pageSize > PAGINATION_LIMITS.MAX) {
    throw new Error(`Page size cannot exceed ${PAGINATION_LIMITS.MAX}`);
  }
}

/**
 * Smart pagination: automatically chooses between offset and cursor based on data characteristics
 */
export async function smartPagination<T extends Record<string, unknown>>(
  query: RangeQueryable | CursorQueryable<T>,
  options: {
    type: 'offset' | 'cursor' | 'auto';
    page?: number;
    pageSize?: number;
    cursor?: string;
    timestampField?: string;
    idField?: string;
  },
  defaultPageSize: number = PAGINATION_LIMITS.DEFAULT
): Promise<PaginatedResult<T> | CursorPaginatedResult<T>> {
  const paginationType = options.type === 'auto'
    ? (options.timestampField && options.idField ? 'cursor' : 'offset')
    : options.type;

  if (paginationType === 'cursor') {
    if (!options.timestampField || !options.idField) {
      throw new Error('Cursor pagination requires timestampField and idField');
    }

    return applyCursorPagination<T>(
      query as CursorQueryable<T>,
      options.timestampField,
      options.idField,
      {
        cursor: options.cursor,
        pageSize: options.pageSize,
      },
      defaultPageSize
    );
  } else {
    return applyPagination<T>(
      query as RangeQueryable,
      {
        page: options.page,
        pageSize: options.pageSize,
      },
      defaultPageSize
    );
  }
}

export default {
  PAGINATION_LIMITS,
  calculatePagination,
  buildPaginationMeta,
  applyPagination,
  applyLimit,
  applyCursorPagination,
  applyPHIPagination,
  encodeCursor,
  decodeCursor,
  getRecommendedPageSize,
  validatePaginationOptions,
  smartPagination,
};
