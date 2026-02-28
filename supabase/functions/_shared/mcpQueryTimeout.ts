/**
 * MCP Query Timeout — Protects database operations from runaway queries (P2-3)
 *
 * Provides a Promise.race wrapper that enforces a maximum execution time
 * on any async operation (Supabase query, RPC call, etc.).
 *
 * Usage:
 * ```typescript
 * const result = await withTimeout(
 *   sb.from('table').select('id, name').eq('patient_id', id),
 *   15000, // 15 seconds
 *   'Patient bundle export'
 * );
 * ```
 *
 * @module mcpQueryTimeout
 */

/** Default timeout for standard queries (15 seconds) */
export const MCP_QUERY_TIMEOUT_MS = 15_000;

/** Extended timeout for complex operations like bundle exports (30 seconds) */
export const MCP_BUNDLE_TIMEOUT_MS = 30_000;

/** Short timeout for simple lookups (5 seconds) */
export const MCP_LOOKUP_TIMEOUT_MS = 5_000;

/**
 * Wraps an async operation with a timeout. If the operation doesn't resolve
 * within the specified duration, throws a descriptive timeout error.
 *
 * @param promise - The async operation to wrap (Supabase query, RPC call, etc.)
 * @param timeoutMs - Maximum execution time in milliseconds
 * @param operationName - Descriptive name for error messages
 * @returns The result of the async operation
 * @throws Error with timeout message if operation exceeds time limit
 */
export async function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number = MCP_QUERY_TIMEOUT_MS,
  operationName: string = 'Database query'
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(
        `${operationName} timed out after ${timeoutMs}ms. ` +
        `This may indicate a missing index or an overly broad query.`
      ));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Per-server timeout configurations. Servers can import their tier's config.
 */
export const MCP_TIMEOUT_CONFIG = {
  /** FHIR server: bundle exports are complex multi-table operations */
  fhir: {
    bundle: MCP_BUNDLE_TIMEOUT_MS,
    search: MCP_QUERY_TIMEOUT_MS,
    single: MCP_LOOKUP_TIMEOUT_MS,
    write: MCP_QUERY_TIMEOUT_MS,
  },
  /** Prior auth: most operations are single-table */
  priorAuth: {
    create: MCP_QUERY_TIMEOUT_MS,
    query: MCP_QUERY_TIMEOUT_MS,
    rpc: MCP_QUERY_TIMEOUT_MS,
  },
  /** Postgres analytics: whitelisted queries may scan large tables */
  postgres: {
    query: MCP_BUNDLE_TIMEOUT_MS,
    schema: MCP_LOOKUP_TIMEOUT_MS,
    count: MCP_LOOKUP_TIMEOUT_MS,
  },
} as const;
