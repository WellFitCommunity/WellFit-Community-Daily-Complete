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

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage: Record<string, string> = {
  'sb-xkybsjnvuohpqpbkikyn-auth-token': JSON.stringify({ access_token: 'test-token' })
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
    jest.clearAllMocks();
  });

  describe('HL7 Operations', () => {
    describe('parseHL7Message', () => {
      it('should parse an ADT^A01 message', async () => {
        const mockParsed = {
          message_type: 'ADT',
          event_type: 'A01',
          control_id: 'MSG00001',
          version: '2.4',
          sending_application: 'HIS',
          sending_facility: 'FACILITY',
          segments: [
            { name: 'MSH', fields: ['|', '^~\\&', 'HIS', 'FACILITY'] },
            { name: 'PID', fields: ['1', '', 'P12345'] }
          ],
          patient: {
            id: 'P12345',
            name: { family: 'DOE', given: 'JOHN' },
            dob: '19500101',
            gender: 'M'
          }
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
        expect(result.data?.message_type).toBe('ADT');
        expect(result.data?.patient?.id).toBe('P12345');
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
                message_type: 'ADT',
                segment_count: 5
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
                message: 'MSH|^~\\&|...|ACK^A01...',
                control_id: 'ACK00001',
                ack_code: 'AA',
                text_message: 'Message accepted'
              }}]
            }
          })
        });

        const result = await generateACK('MSG00001', 'AA');

        expect(result.success).toBe(true);
        expect(result.data?.ack_code).toBe('AA');
      });

      it('should generate AE (error) acknowledgment', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: {
                message: 'MSH|...',
                control_id: 'ACK00002',
                ack_code: 'AE',
                text_message: 'Patient not found'
              }}]
            }
          })
        });

        const result = await generateACK('MSG00001', 'AE', 'Patient not found');

        expect(result.success).toBe(true);
        expect(result.data?.ack_code).toBe('AE');
        expect(result.data?.text_message).toBe('Patient not found');
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
            first_name: 'John',
            last_name: 'Doe',
            dob: '1950-01-15',
            gender: 'M' as const,
            address: {
              street: '123 Main St',
              city: 'Anytown',
              state: 'TX',
              zip: '75001'
            },
            payer_id: 'AETNA001',
            payer_name: 'Aetna'
          },
          provider: {
            npi: '1234567890',
            name: 'Dr. Smith',
            tax_id: '123456789',
            address: {
              street: '456 Medical Dr',
              city: 'Anytown',
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
                control_number: '000000001',
                claim_id: 'CLM001',
                total_charge: 150.00,
                service_line_count: 1
              }}]
            }
          })
        });

        const result = await generate837PClaim(claimData);

        expect(result.success).toBe(true);
        expect(result.data?.claim_id).toBe('CLM001');
        expect(result.data?.x12_content).toContain('ISA');
      });
    });

    describe('parseX12Claim', () => {
      it('should parse X12 837P content', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: {
                control_number: '000000001',
                transaction_type: '837P',
                submitter: {
                  name: 'Medical Practice',
                  id: '1234567890'
                },
                claims: [{
                  claim_id: 'CLM001',
                  total_charge: 150.00,
                  service_lines: [{
                    line_number: 1,
                    cpt_code: '99213',
                    charge_amount: 150.00,
                    units: 1
                  }],
                  diagnoses: ['I10']
                }],
                loop_count: 5,
                segment_count: 42
              }}]
            }
          })
        });

        const result = await parseX12Claim('ISA*00*...');

        expect(result.success).toBe(true);
        expect(result.data?.transaction_type).toBe('837P');
        expect(result.data?.claims).toHaveLength(1);
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
                transaction_type: '837P',
                segment_count: 42,
                loop_count: 5
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
                warnings: []
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
                hl7_types: [
                  { type: 'ADT', events: ['A01', 'A02', 'A03', 'A04', 'A08'], description: 'Admission, Discharge, Transfer' },
                  { type: 'ORU', events: ['R01'], description: 'Observation Result' }
                ],
                x12_types: [
                  { type: '837P', description: 'Professional Claim' },
                  { type: '835', description: 'Remittance Advice' }
                ]
              }}]
            }
          })
        });

        const result = await getSupportedMessageTypes();

        expect(result.success).toBe(true);
        expect(result.data?.hl7_types).toBeDefined();
        expect(result.data?.x12_types).toBeDefined();
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
        patientName: { family: 'DOE', given: 'JOHN' },
        dob: '19500115',
        gender: 'M',
        encounterId: 'E001',
        admitDate: '20240115'
      });

      expect(message).toContain('MSH|^~\\&|HIS|HOSPITAL');
      expect(message).toContain('ADT^A01');
      expect(message).toContain('P12345');
      expect(message).toContain('DOE^JOHN');
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
      delete mockLocalStorage['sb-xkybsjnvuohpqpbkikyn-auth-token'];

      const client = new HL7X12MCPClient();
      const result = await client.parseHL7('MSH|...');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');

      // Restore auth token
      mockLocalStorage['sb-xkybsjnvuohpqpbkikyn-auth-token'] = JSON.stringify({ access_token: 'test-token' });
    });
  });
});
