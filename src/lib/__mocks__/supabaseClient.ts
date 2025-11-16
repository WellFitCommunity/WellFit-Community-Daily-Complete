// Centralized Supabase mock with handler pattern
// Allows tests to configure behavior per-test using setSupabaseHandler

type SupabaseResponse<T = any> = {
  data: T | null;
  error: any | null;
};

type QueryCall = {
  method: string;
  args: any[];
};

type QueryHandler = (table: string, method: string, calls: QueryCall[]) => Promise<SupabaseResponse>;

let handler: QueryHandler | null = null;

// Allow tests to configure behavior
export function setSupabaseHandler(fn: QueryHandler) {
  handler = fn;
}

export function resetSupabaseHandler() {
  handler = null;
}

// Build a mock query builder that supports chaining
function createQueryBuilder(table: string, method: string, prevCalls: QueryCall[] = []) {
  const builder: any = {};

  const chain = (nextMethod: string) => (...args: any[]) =>
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
  builder.then = (onFulfilled: any, onRejected: any) => {
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

export const supabase = {
  from: (table: string) => createQueryBuilder(table, 'from'),

  rpc: jest.fn().mockResolvedValue({ data: null, error: null }),

  auth: {
    getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signInWithPassword: jest.fn().mockResolvedValue({ data: { session: null, user: null }, error: null }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: jest.fn().mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    }),
    setSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
  },

  channel: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockResolvedValue({ status: 'SUBSCRIBED' }),
    unsubscribe: jest.fn().mockResolvedValue({ status: 'UNSUBSCRIBED' }),
  })),

  functions: {
    invoke: jest.fn().mockResolvedValue({ data: null, error: null }),
  },

  storage: {
    from: jest.fn().mockReturnValue({
      upload: jest.fn().mockResolvedValue({ data: null, error: null }),
      download: jest.fn().mockResolvedValue({ data: null, error: null }),
      list: jest.fn().mockResolvedValue({ data: [], error: null }),
      remove: jest.fn().mockResolvedValue({ data: null, error: null }),
      createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'http://test.url' }, error: null }),
      getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'http://test.url' } }),
    }),
  },
};
