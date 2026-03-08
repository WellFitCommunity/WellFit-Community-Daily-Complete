/**
 * Tests for HL7/X12 278 Prior Authorization Client Operations
 * CMS-0057-F compliant X12 278 Health Care Services Review
 */

// Mock import.meta.env
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage: Record<string, string> = {
  'sb-test-auth-token': JSON.stringify({ access_token: 'test-token' })
};

Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (key: string) => mockLocalStorage[key] || null,
    setItem: (key: string, value: string) => { mockLocalStorage[key] = value; },
    removeItem: (key: string) => { delete mockLocalStorage[key]; },
    clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); }
  }
});

const mock278Request = {
  transaction_set_id: 'PA-TEST-001',
  control_number: 'CTL-278-001',
  submitter: { name: 'Test Provider Alpha', id: '1234567890' },
  receiver: { name: 'Test Payer Alpha', id: 'PAYER001' },
  subscriber: {
    member_id: 'MEM-TEST-001',
    first_name: 'Test',
    last_name: 'Patient Alpha',
    dob: '2000-01-01',
    gender: 'M' as const,
  },
  requesting_provider: {
    npi: '1234567890',
    name: 'Test Provider Alpha',
    taxonomy: '207Q00000X',
  },
  certification_type: 'I' as const,
  service_type_code: '3',
  service_date_from: '2024-03-01',
  diagnoses: [{
    code: 'M54.5',
    code_type: 'ABK' as const,
    qualifier: 'ABF' as const,
  }],
  procedures: [{
    code: '27447',
    code_type: 'HC' as const,
    quantity: 1,
    unit_type: 'UN',
    description: 'Total knee replacement',
  }],
};

describe('X12 278 Prior Authorization Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generate278PriorAuthRequest', () => {
    it('should generate a 278 prior auth request', async () => {
      const mockGenerated = {
        x12_content: 'ISA*00*          *00*          *ZZ*1234567890     *ZZ*PAYER001       *...',
        control_number: 'CTL-278-001',
        transaction_set_id: 'PA-TEST-001',
        segment_count: 28,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            content: [{ type: 'json', data: mockGenerated }],
            metadata: { tool: 'generate_278_request', executionTimeMs: 20 }
          }
        })
      });

      const { generate278PriorAuthRequest } = await import('../mcpHL7X12Client');
      const result = await generate278PriorAuthRequest(mock278Request);

      expect(result.success).toBe(true);
      expect(result.data?.x12_content).toContain('ISA');
      expect(result.data?.control_number).toBe('CTL-278-001');
      expect(result.data?.transaction_set_id).toBe('PA-TEST-001');
      expect(result.data?.segment_count).toBeGreaterThan(0);
    });

    it('should send correct tool name and arguments via JSON-RPC', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            content: [{ type: 'json', data: {
              x12_content: 'ISA*00*...',
              control_number: 'CTL-278-001',
              transaction_set_id: 'PA-TEST-001',
              segment_count: 25,
            }}]
          }
        })
      });

      const { generate278PriorAuthRequest } = await import('../mcpHL7X12Client');
      await generate278PriorAuthRequest(mock278Request);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.method).toBe('tools/call');
      expect(callBody.params.name).toBe('generate_278_request');
      expect(callBody.params.arguments.request_data).toBeDefined();
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { generate278PriorAuthRequest } = await import('../mcpHL7X12Client');
      const result = await generate278PriorAuthRequest(mock278Request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('parse278PriorAuthResponse', () => {
    it('should parse an approved 278 response', async () => {
      const mockParsed = {
        transaction_set_id: 'PA-TEST-001',
        control_number: 'RESP-001',
        original_control_number: 'CTL-278-001',
        action_code: 'A1',
        auth_number: 'AUTH-2024-00123',
        effective_date_from: '2024-03-01',
        effective_date_to: '2024-06-01',
        payer: { name: 'Test Payer Alpha', id: 'PAYER001' },
        segment_count: 22,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            content: [{ type: 'json', data: mockParsed }]
          }
        })
      });

      const { parse278PriorAuthResponse } = await import('../mcpHL7X12Client');
      const result = await parse278PriorAuthResponse('ISA*00*...*278...');

      expect(result.success).toBe(true);
      expect(result.data?.action_code).toBe('A1');
      expect(result.data?.auth_number).toBe('AUTH-2024-00123');
      expect(result.data?.payer.name).toBe('Test Payer Alpha');
      expect(result.data?.effective_date_from).toBe('2024-03-01');
      expect(result.data?.effective_date_to).toBe('2024-06-01');
    });

    it('should parse a denied 278 response with reason', async () => {
      const mockDenied = {
        transaction_set_id: 'PA-TEST-002',
        control_number: 'RESP-002',
        original_control_number: 'CTL-278-002',
        action_code: 'A6',
        decision_reason_code: '09',
        payer: { name: 'Test Payer Alpha', id: 'PAYER001' },
        denial_reason: {
          code: '09',
          description: 'Not medically necessary',
        },
        segment_count: 20,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            content: [{ type: 'json', data: mockDenied }]
          }
        })
      });

      const { parse278PriorAuthResponse } = await import('../mcpHL7X12Client');
      const result = await parse278PriorAuthResponse('ISA*00*...*278...');

      expect(result.success).toBe(true);
      expect(result.data?.action_code).toBe('A6');
      expect(result.data?.denial_reason?.code).toBe('09');
      expect(result.data?.denial_reason?.description).toContain('medically necessary');
    });

    it('should parse a pending 278 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            content: [{ type: 'json', data: {
              transaction_set_id: 'PA-TEST-003',
              control_number: 'RESP-003',
              original_control_number: 'CTL-278-003',
              action_code: 'A4',
              follow_up_action_code: 'N',
              payer: { name: 'Test Payer Alpha', id: 'PAYER001' },
              notes: 'Additional clinical documentation required',
              segment_count: 18,
            }}]
          }
        })
      });

      const { parse278PriorAuthResponse } = await import('../mcpHL7X12Client');
      const result = await parse278PriorAuthResponse('ISA*00*...*278...');

      expect(result.success).toBe(true);
      expect(result.data?.action_code).toBe('A4');
      expect(result.data?.notes).toContain('clinical documentation');
    });
  });

  describe('validate278Message', () => {
    it('should validate valid 278 content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            content: [{ type: 'json', data: {
              valid: true,
              errors: [],
              warnings: [],
              segmentCount: 28,
            }}]
          }
        })
      });

      const { validate278Message } = await import('../mcpHL7X12Client');
      const result = await validate278Message('ISA*00*...*278...');

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(true);
      expect(result.data?.errors).toHaveLength(0);
    });

    it('should return errors for invalid 278', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            content: [{ type: 'json', data: {
              valid: false,
              errors: ['Missing HL segments', 'Expected transaction set 278'],
              warnings: [],
              segmentCount: 3,
            }}]
          }
        })
      });

      const { validate278Message } = await import('../mcpHL7X12Client');
      const result = await validate278Message('ISA*00*INVALID');

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(false);
      expect(result.data?.errors).toHaveLength(2);
      expect(result.data?.errors).toContain('Expected transaction set 278');
    });
  });

  describe('X12_278_ACTION_CODES', () => {
    it('should export all standard 278 action codes', async () => {
      const { X12_278_ACTION_CODES } = await import('../mcpHL7X12Client');

      expect(X12_278_ACTION_CODES.APPROVED.code).toBe('A1');
      expect(X12_278_ACTION_CODES.APPROVED.description).toContain('Certified in total');
      expect(X12_278_ACTION_CODES.APPROVED_MODIFIED.code).toBe('A2');
      expect(X12_278_ACTION_CODES.APPROVED_PARTIAL.code).toBe('A3');
      expect(X12_278_ACTION_CODES.PENDING.code).toBe('A4');
      expect(X12_278_ACTION_CODES.DENIED.code).toBe('A6');
      expect(X12_278_ACTION_CODES.CONTACT_PAYER.code).toBe('CT');
    });
  });

  describe('X12_278_CERTIFICATION_TYPES', () => {
    it('should export all certification type codes', async () => {
      const { X12_278_CERTIFICATION_TYPES } = await import('../mcpHL7X12Client');

      expect(X12_278_CERTIFICATION_TYPES.INITIAL.code).toBe('I');
      expect(X12_278_CERTIFICATION_TYPES.RENEWAL.code).toBe('R');
      expect(X12_278_CERTIFICATION_TYPES.REVISED.code).toBe('S');
      expect(X12_278_CERTIFICATION_TYPES.EXTENSION.code).toBe('E');
      expect(X12_278_CERTIFICATION_TYPES.APPEAL.code).toBe('A');
    });
  });

  describe('X12_278_SERVICE_TYPE_CODES', () => {
    it('should map service type codes to descriptions', async () => {
      const { X12_278_SERVICE_TYPE_CODES } = await import('../mcpHL7X12Client');

      expect(X12_278_SERVICE_TYPE_CODES['1']).toBe('Medical Care');
      expect(X12_278_SERVICE_TYPE_CODES['2']).toBe('Surgical');
      expect(X12_278_SERVICE_TYPE_CODES['48']).toBe('Hospital - Inpatient');
      expect(X12_278_SERVICE_TYPE_CODES['62']).toBe('MRI/CAT Scan');
      expect(X12_278_SERVICE_TYPE_CODES['88']).toBe('Pharmacy');
    });
  });
});
