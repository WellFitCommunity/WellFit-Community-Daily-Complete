// Centralized Supabase mock with handler pattern
// Allows tests to configure behavior per-test using setSupabaseHandler

type SupabaseResponse<T = unknown> = {
  data: T | null;
  error: Error | null;
};

type QueryCall = {
  method: string;
  args: unknown[];
};

type QueryHandler = (table: string, method: string, calls: QueryCall[]) => Promise<SupabaseResponse>;

let handler: QueryHandler | null = null;

// Allow tests to configure behavior
export function setSupabaseHandler(fn: QueryHandler) {
  handler = fn;
}

// Query builder type for chaining
type QueryBuilder = Record<string, (...args: unknown[]) => QueryBuilder> & {
  then: (onFulfilled: (value: SupabaseResponse) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
};

// Build a mock query builder that supports chaining
function createQueryBuilder(table: string, method: string, prevCalls: QueryCall[] = []): QueryBuilder {
  const builder = {} as QueryBuilder;

  const chain = (nextMethod: string) => (...args: unknown[]) =>
    createQueryBuilder(table, nextMethod, [...prevCalls, { method: nextMethod, args }]);

  // Chainable methods
  builder.select = chain('select');
  builder.eq = chain('eq');
  builder.neq = chain('neq');
  builder.gt = chain('gt');
  builder.gte = chain('gte');
  builder.lt = chain('lt');
  builder.lte = chain('lte');
  builder.like = chain('like');
  builder.ilike = chain('ilike');
  builder.is = chain('is');
  builder.in = chain('in');
  builder.contains = chain('contains');
  builder.containedBy = chain('containedBy');
  builder.range = chain('range');
  builder.match = chain('match');
  builder.not = chain('not');
  builder.or = chain('or');
  builder.filter = chain('filter');
  builder.order = chain('order');
  builder.limit = chain('limit');
  builder.insert = chain('insert');
  builder.update = chain('update');
  builder.delete = chain('delete');
  builder.upsert = chain('upsert');
  builder.single = chain('single');
  builder.maybeSingle = chain('maybeSingle');

  // Finalizer: when awaited, call handler
  builder.then = (onFulfilled: (value: SupabaseResponse) => unknown, onRejected?: (reason: unknown) => unknown) => {
    const finalMethod = method || 'select';
    const allCalls = prevCalls;

    if (!handler) {
      // Default behavior: return empty response
      return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
    }

    return handler(table, finalMethod, allCalls).then(onFulfilled, onRejected);
  };

  return builder;
}

// Create from as a vi.fn() so tests can use mockImplementation
const defaultFrom = (table: string) => createQueryBuilder(table, 'from');

export const supabase = {
  from: vi.fn(defaultFrom),

  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),

  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { session: null, user: null }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
    setSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
  },

  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockResolvedValue({ status: 'SUBSCRIBED' }),
    unsubscribe: vi.fn().mockResolvedValue({ status: 'UNSUBSCRIBED' }),
  })),

  functions: {
    invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
  },

  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: null, error: null }),
      download: vi.fn().mockResolvedValue({ data: null, error: null }),
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://test.url' }, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://test.url' } }),
    }),
  },
};

// Reset handler and restore default from behavior
export function resetSupabaseHandler() {
  handler = null;
  supabase.from.mockImplementation(defaultFrom);
}
