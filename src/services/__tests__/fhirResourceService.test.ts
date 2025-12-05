import fhirResourceService from '../fhirResourceService';

// Mock supabaseClient
jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      update: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

describe('fhirResourceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exists and is defined', () => {
    expect(fhirResourceService).toBeDefined();
  });

  it('has expected properties', () => {
    expect(fhirResourceService.MedicationRequest).toBeDefined();
  });
});
