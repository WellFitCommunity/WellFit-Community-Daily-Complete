import { BillingService } from '../billingService';

// Mock supabase client
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
  },
}));

describe('BillingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined as a class', () => {
    expect(BillingService).toBeDefined();
    expect(typeof BillingService).toBe('function');
  });

  it('should have static methods', () => {
    expect(typeof BillingService.createProvider).toBe('function');
  });
});