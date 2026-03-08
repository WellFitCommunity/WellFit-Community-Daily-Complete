/**
 * Tests for HL7/X12 Transformer MCP Client
 */

import {
  parseHL7Message,
  convertHL7ToFHIR,
  validateHL7Message,
  generateACK,
  generate837PClaim,
  parseX12Claim,
  validateX12Claim,
  convertX12ToFHIR,
  getSupportedMessageTypes,
  HL7_TEMPLATES,
  X12_HELPERS,
  HL7X12MCPClient
} from '../mcpHL7X12Client';

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

describe('HL7X12MCPClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('HL7 Operations', () => {
    describe('parseHL7Message', () => {
      it('should parse an ADT^A01 message', async () => {
        const mockParsed = {
          success: true,
          messageType: 'ADT',
          messageControlId: 'MSG00001',
          version: '2.4',
          sendingApplication: 'HIS',
          sendingFacility: 'FACILITY',
          segments: [
            { name: 'MSH', fieldCount: 4 },
            { name: 'PID', fieldCount: 3 }
          ],
          errors: [],
          warnings: []
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: mockParsed }],
              metadata: { tool: 'parse_hl7', executionTimeMs: 15 }
            }
          })
        });

        const result = await parseHL7Message('MSH|^~\\&|HIS|FACILITY...');

        expect(result.success).toBe(true);
        expect(result.data?.messageType).toBe('ADT');
        expect(result.data?.messageControlId).toBe('MSG00001');
      });

      it('should handle network errors', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await parseHL7Message('MSH|...');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Network error');
      });
    });

    describe('convertHL7ToFHIR', () => {
      it('should convert HL7 to FHIR Bundle', async () => {
        const mockBundle = {
          resourceType: 'Bundle',
          type: 'transaction',
          timestamp: '2024-01-15T10:00:00Z',
          total: 3,
          entry: [
            { fullUrl: 'urn:uuid:p1', resource: { resourceType: 'Patient', id: 'p1' } },
            { fullUrl: 'urn:uuid:e1', resource: { resourceType: 'Encounter', id: 'e1' } }
          ]
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: mockBundle }]
            }
          })
        });

        const result = await convertHL7ToFHIR('MSH|...|ADT^A01...');

        expect(result.success).toBe(true);
        expect(result.data?.resourceType).toBe('Bundle');
        expect(result.data?.entry).toHaveLength(2);
      });
    });

    describe('validateHL7Message', () => {
      it('should validate a valid HL7 message', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: {
                valid: true,
                errors: [],
                warnings: [],
                messageType: 'ADT',
                segmentCount: 5
              }}]
            }
          })
        });

        const result = await validateHL7Message('MSH|...');

        expect(result.success).toBe(true);
        expect(result.data?.valid).toBe(true);
        expect(result.data?.errors).toHaveLength(0);
      });

      it('should return validation errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: {
                valid: false,
                errors: ['Missing MSH segment', 'Invalid version'],
                warnings: ['Deprecated field usage']
              }}]
            }
          })
        });

        const result = await validateHL7Message('INVALID...');

        expect(result.success).toBe(true);
        expect(result.data?.valid).toBe(false);
        expect(result.data?.errors).toContain('Missing MSH segment');
      });
    });

    describe('generateACK', () => {
      it('should generate AA (accept) acknowledgment', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: {
                ack_message: 'MSH|^~\\&|...|ACK^A01...',
                ack_code: 'AA'
              }}]
            }
          })
        });

        const result = await generateACK('MSG00001', 'AA');

        expect(result.success).toBe(true);
        expect(result.data?.ack_code).toBe('AA');
        expect(result.data?.ack_message).toContain('ACK');
      });

      it('should generate AE (error) acknowledgment', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: {
                ack_message: 'MSH|...|MSA|AE|MSG00001|Patient not found',
                ack_code: 'AE'
              }}]
            }
          })
        });

        const result = await generateACK('MSG00001', 'AE', 'Patient not found');

        expect(result.success).toBe(true);
        expect(result.data?.ack_code).toBe('AE');
      });
    });
  });

  describe('X12 Operations', () => {
    describe('generate837PClaim', () => {
      it('should generate an 837P claim', async () => {
        const claimData = {
          claim_id: 'CLM001',
          claim_type: 'professional' as const,
          subscriber: {
            id: 'SUB123',
            first_name: 'Test',
            last_name: 'Patient Alpha',
            dob: '2000-01-01',
            gender: 'M' as const,
            address: {
              street: '123 Test Street',
              city: 'Testville',
              state: 'TX',
              zip: '75001'
            },
            payer_id: 'PAYER001',
            payer_name: 'Test Payer Alpha'
          },
          provider: {
            npi: '1234567890',
            name: 'Test Provider Alpha',
            tax_id: '123456789',
            address: {
              street: '456 Test Medical Dr',
              city: 'Testville',
              state: 'TX',
              zip: '75002'
            }
          },
          services: [{
            line_number: 1,
            date_from: '2024-01-10',
            place_of_service: '11',
            cpt_code: '99213',
            diagnosis_pointers: [1],
            units: 1,
            charge_amount: 150.00
          }],
          diagnoses: [{
            code: 'I10',
            type: 'principal' as const,
            sequence: 1
          }],
          total_charge: 150.00
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: {
                x12_content: 'ISA*00*...',
                control_numbers: {
                  isa: '000000001',
                  gs: '1',
                  st: '0001'
                },
                segment_count: 42,
                validation: {
                  valid: true,
                  errors: [],
                  warnings: [],
                  segmentCount: 42
                }
              }}]
            }
          })
        });

        const result = await generate837PClaim(claimData);

        expect(result.success).toBe(true);
        expect(result.data?.x12_content).toContain('ISA');
        expect(result.data?.control_numbers.isa).toBe('000000001');
        expect(result.data?.segment_count).toBe(42);
      });
    });

    describe('parseX12Claim', () => {
      it('should parse X12 837P content', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: {
                interchangeControlNumber: '000000001',
                groupControlNumber: '1',
                transactionSetControlNumber: '0001',
                claimId: 'CLM001',
                totalCharges: 150.00,
                diagnoses: ['I10'],
                procedures: [{
                  code: '99213',
                  charges: 150.00,
                  units: 1
                }],
                patientName: 'Test Patient Alpha',
                payerName: 'Test Payer Alpha',
                providerName: 'Test Provider Alpha',
                serviceDate: '2024-01-10'
              }}]
            }
          })
        });

        const result = await parseX12Claim('ISA*00*...');

        expect(result.success).toBe(true);
        expect(result.data?.claimId).toBe('CLM001');
        expect(result.data?.totalCharges).toBe(150.00);
        expect(result.data?.procedures).toHaveLength(1);
        expect(result.data?.procedures[0].code).toBe('99213');
      });
    });

    describe('validateX12Claim', () => {
      it('should validate valid X12 content', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: {
                valid: true,
                errors: [],
                warnings: [],
                segmentCount: 42
              }}]
            }
          })
        });

        const result = await validateX12Claim('ISA*00*...');

        expect(result.success).toBe(true);
        expect(result.data?.valid).toBe(true);
      });

      it('should return validation errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: {
                valid: false,
                errors: ['Missing ISA segment', 'Invalid control number'],
                warnings: [],
                segmentCount: 0
              }}]
            }
          })
        });

        const result = await validateX12Claim('INVALID...');

        expect(result.success).toBe(true);
        expect(result.data?.valid).toBe(false);
        expect(result.data?.errors).toContain('Missing ISA segment');
      });
    });

    describe('convertX12ToFHIR', () => {
      it('should convert X12 to FHIR Claim', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: {
                resourceType: 'Claim',
                id: 'claim-123',
                status: 'active',
                type: {
                  coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }]
                },
                total: { value: 150.00, currency: 'USD' }
              }}]
            }
          })
        });

        const result = await convertX12ToFHIR('ISA*00*...');

        expect(result.success).toBe(true);
        expect(result.data?.resourceType).toBe('Claim');
        expect(result.data?.total.value).toBe(150.00);
      });
    });
  });

  describe('Utility Operations', () => {
    describe('getSupportedMessageTypes', () => {
      it('should return supported HL7 and X12 types', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: {
                hl7: {
                  supported: ['ADT', 'ORU', 'ORM'],
                  versions: ['2.3', '2.4', '2.5']
                },
                x12: {
                  supported: ['837P', '835', '278'],
                  versions: ['5010']
                },
                fhir: {
                  supported: ['Bundle', 'Claim', 'Patient'],
                  version: 'R4'
                }
              }}]
            }
          })
        });

        const result = await getSupportedMessageTypes();

        expect(result.success).toBe(true);
        expect(result.data?.hl7.supported).toContain('ADT');
        expect(result.data?.x12.supported).toContain('837P');
        expect(result.data?.fhir.version).toBe('R4');
      });
    });
  });

  describe('HL7_TEMPLATES', () => {
    it('should generate ADT^A01 template', () => {
      const message = HL7_TEMPLATES.ADT_A01({
        controlId: 'MSG001',
        sendingApp: 'HIS',
        sendingFacility: 'HOSPITAL',
        patientId: 'P12345',
        patientName: { family: 'ALPHA', given: 'TESTPATIENT' },
        dob: '20000101',
        gender: 'M',
        encounterId: 'E001',
        admitDate: '20240115'
      });

      expect(message).toContain('MSH|^~\\&|HIS|HOSPITAL');
      expect(message).toContain('ADT^A01');
      expect(message).toContain('P12345');
      expect(message).toContain('ALPHA^TESTPATIENT');
    });

    it('should generate ADT^A03 template', () => {
      const message = HL7_TEMPLATES.ADT_A03({
        controlId: 'MSG002',
        sendingApp: 'HIS',
        sendingFacility: 'HOSPITAL',
        patientId: 'P12345',
        encounterId: 'E001',
        dischargeDate: '20240120'
      });

      expect(message).toContain('ADT^A03');
      expect(message).toContain('P12345');
    });

    it('should generate ORU^R01 template', () => {
      const message = HL7_TEMPLATES.ORU_R01({
        controlId: 'MSG003',
        sendingApp: 'LAB',
        sendingFacility: 'HOSPITAL',
        patientId: 'P12345',
        observationCode: '2345-7',
        observationValue: '120',
        observationUnit: 'mg/dL',
        observationDate: '20240115'
      });

      expect(message).toContain('ORU^R01');
      expect(message).toContain('2345-7');
      expect(message).toContain('120');
    });
  });

  describe('X12_HELPERS', () => {
    it('should format date correctly', () => {
      expect(X12_HELPERS.formatDate('2024-01-15')).toBe('20240115');
      expect(X12_HELPERS.formatDate(new Date('2024-06-30'))).toBe('20240630');
    });

    it('should format time correctly', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      expect(X12_HELPERS.formatTime(date)).toBe('1430');
    });

    it('should format amount correctly', () => {
      expect(X12_HELPERS.formatAmount(150.00)).toBe('15000');
      expect(X12_HELPERS.formatAmount(1234.56)).toBe('123456');
    });

    it('should parse X12 date correctly', () => {
      const date = X12_HELPERS.parseDate('20240115');
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(0); // January
      expect(date.getDate()).toBe(15);
    });

    it('should get place of service name', () => {
      expect(X12_HELPERS.getPlaceOfServiceName('11')).toBe('Office');
      expect(X12_HELPERS.getPlaceOfServiceName('21')).toBe('Inpatient Hospital');
      expect(X12_HELPERS.getPlaceOfServiceName('23')).toBe('Emergency Room');
      expect(X12_HELPERS.getPlaceOfServiceName('99')).toBe('Unknown (99)');
    });
  });

  describe('Error handling', () => {
    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'Unauthorized' } })
      });

      const result = await parseHL7Message('MSH|...');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should handle missing authentication', async () => {
      // Clear auth token
      delete mockLocalStorage['sb-test-auth-token'];

      const client = new HL7X12MCPClient();
      const result = await client.parseHL7('MSH|...');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');

      // Restore auth token
      mockLocalStorage['sb-test-auth-token'] = JSON.stringify({ access_token: 'test-token' });
    });
  });
});
