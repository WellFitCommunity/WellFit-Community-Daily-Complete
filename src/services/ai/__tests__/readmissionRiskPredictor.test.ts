import { ReadmissionRiskPredictor } from '../readmissionRiskPredictor';

// Mock supabaseClient
jest.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

describe('ReadmissionRiskPredictor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exists and is defined', () => {
    expect(ReadmissionRiskPredictor).toBeDefined();
  });

  it('can be instantiated', () => {
    const predictor = new ReadmissionRiskPredictor();
    expect(predictor).toBeDefined();
  });
});
