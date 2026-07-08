// src/test-utils/supabaseMock.ts
//
// Chainable Supabase query-builder mock.
//
// WHY THIS EXISTS
// ---------------
// The old pattern hand-built the call chain in each test:
//
//   const single = vi.fn().mockResolvedValue({ data, error });
//   const eq     = vi.fn().mockReturnValue({ single });
//   const select = vi.fn().mockReturnValue({ eq });
//   mockFrom.mockReturnValue({ select });
//
// That couples the test to the EXACT chain shape. The moment production code
// changes the chain — reorders `.eq()/.order()`, or swaps `.single()` for
// `.maybeSingle()` — the mock no longer matches and CI goes red even though the
// feature is fine. (That is exactly what broke VoiceProfileMaturity when its
// query moved from `.single()` to `.maybeSingle()`.)
//
// This builder makes EVERY chainable method return the same builder, and every
// terminal (`.single()/.maybeSingle()/.csv()`) — plus awaiting the builder
// directly — resolve to the same configured `{ data, error, count }`. Tests
// specify the RESULT, never the plumbing, so they survive query refactors and
// only fail when behavior actually changes.
//
// A passing test built on this is still only a REGRESSION GUARD, not proof the
// feature works against the real database. Pair it with a live round-trip for
// "done" (see .claude rules / feedback_live_proof_over_mocks).

import { vi, type Mock } from 'vitest';

export interface SupabaseResult<T = unknown> {
  data: T | null;
  error: { message?: string; code?: string; details?: string } | null;
  count: number | null;
  status: number;
  statusText: string;
}

// Methods that return the builder itself (chainable filters/transforms).
const CHAIN_METHODS = [
  'select', 'insert', 'update', 'upsert', 'delete',
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
  'like', 'ilike', 'is', 'in', 'contains', 'containedBy',
  'not', 'or', 'filter', 'match',
  'order', 'limit', 'range', 'textSearch', 'overlaps',
  'returns', 'abortSignal', 'throwOnError', 'geojson', 'explain',
] as const;

// Methods that terminate the chain and resolve to the configured result.
const TERMINAL_METHODS = ['single', 'maybeSingle', 'csv'] as const;

type ChainMethod = (typeof CHAIN_METHODS)[number];
type TerminalMethod = (typeof TERMINAL_METHODS)[number];

export type ChainableQueryBuilder<T = unknown> =
  { [K in ChainMethod]: Mock } &
  { [K in TerminalMethod]: Mock } &
  PromiseLike<SupabaseResult<T>>;

function toResult<T>(partial: Partial<SupabaseResult<T>>): SupabaseResult<T> {
  const hasError = partial.error != null;
  return {
    data: (partial.data ?? null) as T | null,
    error: partial.error ?? null,
    count: partial.count ?? null,
    status: partial.status ?? (hasError ? 400 : 200),
    statusText: partial.statusText ?? (hasError ? 'Bad Request' : 'OK'),
  };
}

/**
 * Build a chainable query builder that resolves to `result` no matter which
 * chain of methods the code under test calls.
 *
 * Drop-in replacement for a hand-built chain:
 *   mockFrom.mockReturnValue(createQueryBuilder({ data: rows }));
 *   mockFrom.mockReturnValue(createQueryBuilder({ error: { code: 'PGRST116' } }));
 */
export function createQueryBuilder<T = unknown>(
  result: Partial<SupabaseResult<T>> = {},
): ChainableQueryBuilder<T> {
  const resolved = toResult(result);
  const builder = {} as Record<string, unknown>;

  for (const method of CHAIN_METHODS) {
    builder[method] = vi.fn(() => builder);
  }
  for (const method of TERMINAL_METHODS) {
    builder[method] = vi.fn(() => Promise.resolve(resolved));
  }

  // Make the builder itself awaitable — covers the common path that awaits
  // `.select().eq().order()` with no terminal, and `{ head: true, count }`.
  builder.then = <R1 = SupabaseResult<T>, R2 = never>(
    onFulfilled?: ((value: SupabaseResult<T>) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> => Promise.resolve(resolved).then(onFulfilled, onRejected);

  // Double-cast at the test-util boundary: `builder` is assembled dynamically
  // (vi.fn()s keyed by method name) so it doesn't structurally overlap the typed
  // interface until viewed as `unknown` first (TS2352 under the CI tsconfig).
  return builder as unknown as ChainableQueryBuilder<T>;
}

/**
 * Build a full `supabase`-shaped mock whose `.from()` / `.rpc()` return chainable
 * builders. Key results by table (or RPC) name; anything unmatched falls back.
 *
 *   const supabase = createSupabaseMock({
 *     profiles: { data: { user_id: 'u1', role: 'admin' } },
 *     audit_logs: { data: [] },
 *   });
 *   vi.mock('../../lib/supabaseClient', () => ({ supabase }));
 */
export function createSupabaseMock(
  results: Record<string, Partial<SupabaseResult>> = {},
  fallback: Partial<SupabaseResult> = {},
) {
  const resolveFor = (name: string) => createQueryBuilder(results[name] ?? fallback);
  return {
    from: vi.fn((table: string) => resolveFor(table)),
    rpc: vi.fn((fn: string) => resolveFor(fn)),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getClaims: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  };
}
