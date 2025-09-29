import { BillingService } from '../billingService';

// Mock supabase client
jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
  },
}));

describe('BillingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined as a class', () => {
    expect(BillingService).toBeDefined();
    expect(typeof BillingService).toBe('function');
  });

  it('should have static methods', () => {
    expect(typeof BillingService.createProvider).toBe('function');
  });
});