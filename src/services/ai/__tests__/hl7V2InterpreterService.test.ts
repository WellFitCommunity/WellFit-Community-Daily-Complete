/**
 * Tests for HL7 V2 Interpreter Service
 *
 * Covers message parsing, validation, and FHIR mapping
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  HL7V2InterpreterService,
  HL7InterpretRequest,
  HL7InterpretResponse,
} from '../hl7V2InterpreterService';

// Mock supabaseClient
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
    })),
  },
}));

// =====================================================
// MOCK DATA
// =====================================================

const SAMPLE_HL7_MESSAGE = `MSH|^~\\&|EPIC|HOSP|LAB|HOSP|20250101120000||ADT^A01|MSG001|P|2.5
EVN|A01|20250101120000
PID|1||12345^^^HOSP^MR||DOE^JOHN^||19500101|M
PV1|1|I|ICU^101^A`;

function createMockHL7Request(overrides?: Partial<HL7InterpretRequest>): HL7InterpretRequest {
  return {
    message: SAMPLE_HL7_MESSAGE,
    sourceSystem: 'EPIC',
    mapToFHIR: true,
    fhirVersion: 'R4',
    tenantId: 'test-tenant',
    ...overrides,
  };
}

function createMockHL7Response(): HL7InterpretResponse {
  return {
    result: {
      messageControlId: 'MSG001',
      messageType: 'ADT',
      triggerEvent: 'A01',
      version: '2.5',
      sendingApplication: 'EPIC',
      sendingFacility: 'HOSP',
      receivingApplication: 'LAB',
      receivingFacility: 'HOSP',
      messageTimestamp: '2025-01-01T12:00:00Z',
      segments: [
        {
          segmentId: 'MSH',
          fields: [
            { position: 3, name: 'Sending Application', value: 'EPIC', dataType: 'HD', required: true },
          ],
          rawText: 'MSH|^~\\&|EPIC|HOSP|LAB|HOSP|20250101120000||ADT^A01|MSG001|P|2.5',
          valid: true,
        },
        {
          segmentId: 'PID',
          fields: [
            { position: 3, name: 'Patient ID', value: '12345', dataType: 'CX', required: true },
            { position: 5, name: 'Patient Name', value: 'DOE^JOHN', dataType: 'XPN', required: true },
          ],
          rawText: 'PID|1||12345^^^HOSP^MR||DOE^JOHN^||19500101|M',
          valid: true,
        },
      ],
      ambiguities: [],
      structureValid: true,
      structureIssues: [],
      contentWarnings: [],
      fhirMappings: [
        {
          resourceType: 'Patient',
          resourceId: 'patient-12345',
          mappedFields: [
            {
              hl7Segment: 'PID',
              hl7Field: 'PID-5',
              fhirPath: 'Patient.name',
              value: { family: 'DOE', given: ['JOHN'] },
              mappingConfidence: 0.95,
            },
          ],
          unmappedFields: [],
          resource: {
            resourceType: 'Patient',
            id: 'patient-12345',
            name: [{ family: 'DOE', given: ['JOHN'] }],
          },
        },
      ],
      suggestions: [],
      summary: 'ADT A01 message processed successfully',
      clinicalContext: 'Patient admission to ICU',
      confidenceScore: 0.95,
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      model: 'claude-sonnet-4.5',
      responseTimeMs: 500,
      messageSize: 200,
      segmentCount: 4,
    },
  };
}

// =====================================================
// TESTS
// =====================================================

describe('HL7V2InterpreterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('interpretMessage', () => {
    it('should return failure when message is empty', async () => {
      const request = createMockHL7Request({ message: '' });
      const result = await HL7V2InterpreterService.interpretMessage(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should return failure when message is whitespace only', async () => {
      const request = createMockHL7Request({ message: '   ' });
      const result = await HL7V2InterpreterService.interpretMessage(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should return failure when message does not start with MSH', async () => {
      const request = createMockHL7Request({ message: 'PID|1||12345' });
      const result = await HL7V2InterpreterService.interpretMessage(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_MESSAGE');
    });

    it('should handle edge function errors gracefully', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: 'Edge function error' },
      });

      const request = createMockHL7Request();
      const result = await HL7V2InterpreterService.interpretMessage(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INTERPRETATION_FAILED');
    });

    it('should successfully interpret HL7 message', async () => {
      const mockResponse = createMockHL7Response();
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const request = createMockHL7Request();
      const result = await HL7V2InterpreterService.interpretMessage(request);

      expect(result.success).toBe(true);
      expect(result.data?.result.messageType).toBe('ADT');
      expect(result.data?.result.triggerEvent).toBe('A01');
      expect(result.data?.result.structureValid).toBe(true);
    });

    it('should map to FHIR when requested', async () => {
      const mockResponse = createMockHL7Response();
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const request = createMockHL7Request({ mapToFHIR: true });
      const result = await HL7V2InterpreterService.interpretMessage(request);

      expect(result.success).toBe(true);
      expect(result.data?.result.fhirMappings.length).toBeGreaterThan(0);
      expect(result.data?.result.fhirMappings[0].resourceType).toBe('Patient');
    });
  });

  describe('saveInterpretation', () => {
    it('should save interpretation successfully', async () => {
      const request = createMockHL7Request();
      const response = createMockHL7Response();

      const result = await HL7V2InterpreterService.saveInterpretation(request, response);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('test-id');
    });
  });

  describe('validateStructure', () => {
    it('should validate message structure', async () => {
      const mockResponse = createMockHL7Response();
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await HL7V2InterpreterService.validateStructure(SAMPLE_HL7_MESSAGE);

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(true);
    });
  });

  describe('extractPatient', () => {
    it('should extract patient FHIR resource', async () => {
      const mockResponse = createMockHL7Response();
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await HL7V2InterpreterService.extractPatient(SAMPLE_HL7_MESSAGE);

      expect(result.success).toBe(true);
      expect(result.data?.resourceType).toBe('Patient');
    });

    it('should return null when no patient mapping found', async () => {
      const mockResponse = createMockHL7Response();
      mockResponse.result.fhirMappings = [];

      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await HL7V2InterpreterService.extractPatient(SAMPLE_HL7_MESSAGE);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('parseMSHQuick', () => {
    it('should parse MSH segment quickly', () => {
      const result = HL7V2InterpreterService.parseMSHQuick(SAMPLE_HL7_MESSAGE);

      expect(result.sendingApp).toBe('EPIC');
      expect(result.sendingFacility).toBe('HOSP');
      expect(result.messageType).toBe('ADT');
      expect(result.triggerEvent).toBe('A01');
      expect(result.messageControlId).toBe('MSG001');
      expect(result.version).toBe('2.5');
    });

    it('should return empty object for invalid message', () => {
      const result = HL7V2InterpreterService.parseMSHQuick('INVALID MESSAGE');

      expect(result).toEqual({});
    });

    it('should handle message with different field separator', () => {
      const message = `MSH|^~\\&|EPIC|HOSP|LAB|HOSP|20250101120000||ORU^R01|MSG002|P|2.4`;
      const result = HL7V2InterpreterService.parseMSHQuick(message);

      expect(result.messageType).toBe('ORU');
      expect(result.triggerEvent).toBe('R01');
    });
  });

  describe('getSourceSystemPatterns', () => {
    it('should fetch source system patterns', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockData = [
        {
          ambiguities_detected: [
            { segmentId: 'PID', fieldPosition: 3, ambiguityType: 'non_standard' },
          ],
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      } as never);

      const result = await HL7V2InterpreterService.getSourceSystemPatterns('EPIC', 'tenant-123');

      expect(result.success).toBe(true);
      expect(result.data?.length).toBeGreaterThan(0);
    });
  });
});
