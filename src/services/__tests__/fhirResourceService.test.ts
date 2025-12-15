import fhirResourceService from '../fhirResourceService';

// Mock supabaseClient
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

describe('fhirResourceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exists and is defined', () => {
    expect(fhirResourceService).toBeDefined();
  });

  it('has expected properties', () => {
    expect(fhirResourceService.MedicationRequest).toBeDefined();
  });
});
