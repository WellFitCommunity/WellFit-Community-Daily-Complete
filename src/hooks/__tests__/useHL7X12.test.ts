/**
 * Tests for useHL7X12 hook
 *
 * Tests HL7/X12 message operations: parse, validate, convert to FHIR,
 * and state management for the message lab panel.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useHL7X12 } from '../useHL7X12';

// Mock the HL7/X12 MCP client
vi.mock('../../services/mcp/mcpHL7X12Client', () => ({
  hl7x12MCP: {
    parseHL7: vi.fn(),
    validateHL7: vi.fn(),
    hl7ToFHIR: vi.fn(),
    generateHL7ACK: vi.fn(),
    generate837P: vi.fn(),
    validateX12: vi.fn(),
    parseX12: vi.fn(),
    x12ToFHIR: vi.fn(),
    getMessageTypes: vi.fn(),
  },
  HL7_TEMPLATES: {
    ADT_A01: vi.fn(() => 'MSH|...ADT^A01'),
    ADT_A03: vi.fn(() => 'MSH|...ADT^A03'),
    ORU_R01: vi.fn(() => 'MSH|...ORU^R01'),
  },
}));

import { hl7x12MCP } from '../../services/mcp/mcpHL7X12Client';

const mockClient = vi.mocked(hl7x12MCP);

describe('useHL7X12', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in idle state with no result or error', () => {
    const { result } = renderHook(() => useHL7X12());

    expect(result.current.result).toBeNull();
    expect(result.current.operation).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  describe('HL7 Operations', () => {
    it('parses HL7 message and returns structured patient data', async () => {
      const parsedMessage = {
        message_type: 'ADT',
        event_type: 'A01',
        control_id: 'MSG001',
        version: '2.4',
        sending_application: 'ATLUS',
        sending_facility: 'WELLFIT',
        receiving_application: 'EHR',
        receiving_facility: 'HOSPITAL',
        timestamp: '20260221120000',
        segments: [
          { name: 'MSH', fields: [] },
          { name: 'PID', fields: [] },
          { name: 'PV1', fields: [] },
        ],
        patient: {
          id: 'PAT-001',
          name: { family: 'DOE', given: 'JANE' },
          dob: '19500315',
          gender: 'F',
        },
        encounter: {
          id: 'ENC-001',
          class: 'I',
          location: 'ICU^ROOM1^BED2',
        },
      };

      mockClient.parseHL7.mockResolvedValue({
        success: true,
        data: parsedMessage,
      });

      const { result } = renderHook(() => useHL7X12());

      await act(async () => {
        await result.current.parseHL7('MSH|^~\\&|ATLUS|WELLFIT||...');
      });

      expect(result.current.result).toEqual(parsedMessage);
      expect(result.current.operation).toBe('parse_hl7');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();

      // Verify patient data was extracted
      const parsed = result.current.result as typeof parsedMessage;
      expect(parsed.patient?.id).toBe('PAT-001');
      expect(parsed.patient?.name.family).toBe('DOE');
      expect(parsed.encounter?.id).toBe('ENC-001');
      expect(parsed.segments).toHaveLength(3);
    });

    it('validates HL7 message and reports errors/warnings', async () => {
      const validationResult = {
        valid: false,
        errors: ['Missing required PID segment', 'Invalid date format in OBR-7'],
        warnings: ['OBX-5 value exceeds expected range'],
        message_type: 'ORU',
        segment_count: 5,
      };

      mockClient.validateHL7.mockResolvedValue({
        success: true,
        data: validationResult,
      });

      const { result } = renderHook(() => useHL7X12());

      await act(async () => {
        await result.current.validateHL7('MSH|^~\\&|...');
      });

      const validation = result.current.result as typeof validationResult;
      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(2);
      expect(validation.errors[0]).toContain('PID segment');
      expect(validation.warnings).toHaveLength(1);
      expect(validation.segment_count).toBe(5);
    });

    it('converts HL7 to FHIR R4 Bundle', async () => {
      const fhirBundle = {
        resourceType: 'Bundle' as const,
        type: 'transaction',
        timestamp: '2026-02-21T12:00:00Z',
        total: 3,
        entry: [
          { fullUrl: 'urn:uuid:patient-1', resource: { resourceType: 'Patient', id: 'patient-1' } },
          { fullUrl: 'urn:uuid:encounter-1', resource: { resourceType: 'Encounter', id: 'encounter-1' } },
          { fullUrl: 'urn:uuid:obs-1', resource: { resourceType: 'Observation', id: 'obs-1' } },
        ],
      };

      mockClient.hl7ToFHIR.mockResolvedValue({
        success: true,
        data: fhirBundle,
      });

      const { result } = renderHook(() => useHL7X12());

      await act(async () => {
        await result.current.convertHL7ToFHIR('MSH|^~\\&|...');
      });

      const bundle = result.current.result as typeof fhirBundle;
      expect(bundle.resourceType).toBe('Bundle');
      expect(bundle.type).toBe('transaction');
      expect(bundle.total).toBe(3);
      expect(bundle.entry).toHaveLength(3);
      expect(bundle.entry[0].resource.resourceType).toBe('Patient');
    });

    it('generates ACK response for incoming message', async () => {
      const ackResult = {
        message: 'MSH|^~\\&|...\rMSA|AA|MSG001|Message accepted',
        control_id: 'ACK001',
        ack_code: 'AA' as const,
        text_message: 'Message accepted',
      };

      mockClient.generateHL7ACK.mockResolvedValue({
        success: true,
        data: ackResult,
      });

      const { result } = renderHook(() => useHL7X12());

      await act(async () => {
        await result.current.generateACK('MSG001', 'AA');
      });

      const ack = result.current.result as typeof ackResult;
      expect(ack.ack_code).toBe('AA');
      expect(ack.control_id).toBe('ACK001');
    });
  });

  describe('X12 Operations', () => {
    it('parses X12 837P claim and extracts service lines', async () => {
      const parsedClaim = {
        control_number: '000000001',
        transaction_type: '837P',
        submitter: { name: 'WellFit Health', id: 'SUB001' },
        receiver: { name: 'Blue Cross', id: 'BCBS' },
        subscriber: { id: 'MBR-12345', name: 'Jane Doe', dob: '1950-03-15' },
        claims: [{
          claim_id: 'CLM-001',
          total_charge: 450.00,
          place_of_service: '11',
          service_lines: [
            { line_number: 1, cpt_code: '99213', charge_amount: 150.00, units: 1, date_of_service: '2026-02-21' },
            { line_number: 2, cpt_code: '85025', charge_amount: 75.00, units: 1, date_of_service: '2026-02-21' },
            { line_number: 3, cpt_code: '80053', charge_amount: 225.00, units: 1, date_of_service: '2026-02-21' },
          ],
          diagnoses: ['E11.9', 'I10'],
        }],
        loop_count: 5,
        segment_count: 28,
      };

      mockClient.parseX12.mockResolvedValue({
        success: true,
        data: parsedClaim,
      });

      const { result } = renderHook(() => useHL7X12());

      await act(async () => {
        await result.current.parseX12('ISA*00*...');
      });

      const claim = result.current.result as typeof parsedClaim;
      expect(claim.transaction_type).toBe('837P');
      expect(claim.claims[0].claim_id).toBe('CLM-001');
      expect(claim.claims[0].total_charge).toBe(450.00);
      expect(claim.claims[0].service_lines).toHaveLength(3);
      expect(claim.claims[0].service_lines[0].cpt_code).toBe('99213');
      expect(claim.claims[0].diagnoses).toContain('E11.9');
    });

    it('validates X12 837P structure and reports issues', async () => {
      const validationResult = {
        valid: true,
        errors: [],
        warnings: ['Modifier 25 typically requires documentation'],
        transaction_type: '837P',
        segment_count: 28,
        loop_count: 5,
      };

      mockClient.validateX12.mockResolvedValue({
        success: true,
        data: validationResult,
      });

      const { result } = renderHook(() => useHL7X12());

      await act(async () => {
        await result.current.validateX12('ISA*00*...');
      });

      const validation = result.current.result as typeof validationResult;
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.warnings).toHaveLength(1);
      expect(validation.segment_count).toBe(28);
    });

    it('converts X12 837P to FHIR Claim resource', async () => {
      const fhirClaim = {
        resourceType: 'Claim' as const,
        id: 'claim-001',
        status: 'active',
        type: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }],
        },
        patient: { reference: 'Patient/pat-001' },
        provider: { reference: 'Practitioner/prov-001' },
        priority: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }],
        },
        insurance: [{
          sequence: 1,
          focal: true,
          coverage: { reference: 'Coverage/cov-001' },
        }],
        item: [{
          sequence: 1,
          productOrService: {
            coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '99213' }],
          },
          servicedDate: '2026-02-21',
          unitPrice: { value: 150.00, currency: 'USD' },
          quantity: { value: 1 },
          net: { value: 150.00, currency: 'USD' },
        }],
        total: { value: 450.00, currency: 'USD' },
      };

      mockClient.x12ToFHIR.mockResolvedValue({
        success: true,
        data: fhirClaim,
      });

      const { result } = renderHook(() => useHL7X12());

      await act(async () => {
        await result.current.convertX12ToFHIR('ISA*00*...');
      });

      const claim = result.current.result as typeof fhirClaim;
      expect(claim.resourceType).toBe('Claim');
      expect(claim.status).toBe('active');
      expect(claim.total.value).toBe(450.00);
      expect(claim.item[0].productOrService.coding[0].code).toBe('99213');
    });
  });

  describe('Error Handling', () => {
    it('sets error state when HL7 parse fails', async () => {
      mockClient.parseHL7.mockResolvedValue({
        success: false,
        error: 'Invalid message header: missing MSH segment',
      });

      const { result } = renderHook(() => useHL7X12());

      await act(async () => {
        await result.current.parseHL7('INVALID_MESSAGE');
      });

      expect(result.current.error).toBe('Invalid message header: missing MSH segment');
      expect(result.current.result).toBeNull();
      expect(result.current.operation).toBe('parse_hl7');
    });

    it('sets error state when X12 validation fails', async () => {
      mockClient.validateX12.mockResolvedValue({
        success: false,
        error: 'Missing ISA envelope segment',
      });

      const { result } = renderHook(() => useHL7X12());

      await act(async () => {
        await result.current.validateX12('BAD_CONTENT');
      });

      expect(result.current.error).toBe('Missing ISA envelope segment');
      expect(result.current.result).toBeNull();
    });
  });

  describe('State Management', () => {
    it('resets state when reset is called', async () => {
      mockClient.parseHL7.mockResolvedValue({
        success: true,
        data: {
          message_type: 'ADT',
          event_type: 'A01',
          control_id: 'MSG001',
          version: '2.4',
          sending_application: '',
          sending_facility: '',
          receiving_application: '',
          receiving_facility: '',
          timestamp: '',
          segments: [],
        },
      });

      const { result } = renderHook(() => useHL7X12());

      await act(async () => {
        await result.current.parseHL7('MSH|...');
      });

      expect(result.current.result).not.toBeNull();

      act(() => {
        result.current.reset();
      });

      expect(result.current.result).toBeNull();
      expect(result.current.operation).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('updates operation type correctly for each action', async () => {
      mockClient.parseHL7.mockResolvedValue({ success: true, data: { message_type: 'ADT', event_type: 'A01', control_id: '', version: '', sending_application: '', sending_facility: '', receiving_application: '', receiving_facility: '', timestamp: '', segments: [] } });
      mockClient.validateX12.mockResolvedValue({ success: true, data: { valid: true, errors: [], warnings: [] } });

      const { result } = renderHook(() => useHL7X12());

      await act(async () => {
        await result.current.parseHL7('MSH|...');
      });
      expect(result.current.operation).toBe('parse_hl7');

      await act(async () => {
        await result.current.validateX12('ISA*...');
      });
      expect(result.current.operation).toBe('validate_x12');
    });

    it('gets supported message types', async () => {
      const messageTypes = {
        hl7_types: [
          { type: 'ADT', events: ['A01', 'A02', 'A03', 'A04', 'A08'], description: 'Admit/Discharge/Transfer' },
          { type: 'ORU', events: ['R01'], description: 'Observation Result' },
          { type: 'ORM', events: ['O01'], description: 'Order Message' },
        ],
        x12_types: [
          { type: '837P', description: 'Professional Claims' },
        ],
      };

      mockClient.getMessageTypes.mockResolvedValue({
        success: true,
        data: messageTypes,
      });

      const { result } = renderHook(() => useHL7X12());

      await act(async () => {
        await result.current.getMessageTypes();
      });

      const types = result.current.result as typeof messageTypes;
      expect(types.hl7_types).toHaveLength(3);
      expect(types.hl7_types[0].type).toBe('ADT');
      expect(types.hl7_types[0].events).toContain('A01');
      expect(types.x12_types[0].type).toBe('837P');
    });
  });
});
