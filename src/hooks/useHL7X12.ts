/**
 * useHL7X12 — React hook for HL7/X12 MCP message operations
 *
 * Wraps the HL7/X12 MCP client for parsing, validating, and converting
 * healthcare messages between HL7 v2.x, X12 837P, and FHIR R4 formats.
 *
 * Usage:
 *   const { parseHL7, validateHL7, convertToFHIR, result, loading, error } = useHL7X12();
 */

import { useState, useCallback, useRef } from 'react';
import {
  hl7x12MCP,
  type HL7ParsedMessage,
  type HL7ValidationResult,
  type HL7ACK,
  type X12ClaimData,
  type X12GeneratedClaim,
  type X12ParsedClaim,
  type X12ValidationResult,
  type FHIRBundle,
  type FHIRClaim,
  type MessageTypeInfo,
} from '../services/mcp/mcpHL7X12Client';

// =====================================================
// Types
// =====================================================

export type HL7X12OperationType =
  | 'parse_hl7'
  | 'validate_hl7'
  | 'hl7_to_fhir'
  | 'generate_ack'
  | 'generate_837p'
  | 'validate_x12'
  | 'parse_x12'
  | 'x12_to_fhir'
  | 'get_message_types';

export type HL7X12ResultData =
  | HL7ParsedMessage
  | HL7ValidationResult
  | HL7ACK
  | X12GeneratedClaim
  | X12ParsedClaim
  | X12ValidationResult
  | FHIRBundle
  | FHIRClaim
  | MessageTypeInfo;

export interface HL7X12State {
  result: HL7X12ResultData | null;
  operation: HL7X12OperationType | null;
  loading: boolean;
  error: string | null;
}

// =====================================================
// Hook
// =====================================================

export function useHL7X12() {
  const [state, setState] = useState<HL7X12State>({
    result: null,
    operation: null,
    loading: false,
    error: null,
  });
  const mountedRef = useRef(true);

  const setLoading = (operation: HL7X12OperationType) => {
    setState({ result: null, operation, loading: true, error: null });
  };

  const setResult = (operation: HL7X12OperationType, data: HL7X12ResultData) => {
    if (mountedRef.current) {
      setState({ result: data, operation, loading: false, error: null });
    }
  };

  const setError = (operation: HL7X12OperationType, error: string) => {
    if (mountedRef.current) {
      setState({ result: null, operation, loading: false, error });
    }
  };

  // =====================================================
  // HL7 Operations
  // =====================================================

  const parseHL7 = useCallback(async (message: string) => {
    setLoading('parse_hl7');
    const response = await hl7x12MCP.parseHL7(message);
    if (response.success && response.data) {
      setResult('parse_hl7', response.data);
    } else {
      setError('parse_hl7', response.error || 'Failed to parse HL7 message');
    }
    return response;
  }, []);

  const validateHL7 = useCallback(async (message: string) => {
    setLoading('validate_hl7');
    const response = await hl7x12MCP.validateHL7(message);
    if (response.success && response.data) {
      setResult('validate_hl7', response.data);
    } else {
      setError('validate_hl7', response.error || 'Failed to validate HL7 message');
    }
    return response;
  }, []);

  const convertHL7ToFHIR = useCallback(async (message: string) => {
    setLoading('hl7_to_fhir');
    const response = await hl7x12MCP.hl7ToFHIR(message);
    if (response.success && response.data) {
      setResult('hl7_to_fhir', response.data);
    } else {
      setError('hl7_to_fhir', response.error || 'Failed to convert HL7 to FHIR');
    }
    return response;
  }, []);

  const generateACK = useCallback(async (
    controlId: string,
    ackCode: 'AA' | 'AE' | 'AR',
    errorText?: string
  ) => {
    setLoading('generate_ack');
    const response = await hl7x12MCP.generateHL7ACK(controlId, ackCode, errorText);
    if (response.success && response.data) {
      setResult('generate_ack', response.data);
    } else {
      setError('generate_ack', response.error || 'Failed to generate ACK');
    }
    return response;
  }, []);

  // =====================================================
  // X12 Operations
  // =====================================================

  const generate837P = useCallback(async (claimData: X12ClaimData) => {
    setLoading('generate_837p');
    const response = await hl7x12MCP.generate837P(claimData);
    if (response.success && response.data) {
      setResult('generate_837p', response.data);
    } else {
      setError('generate_837p', response.error || 'Failed to generate 837P claim');
    }
    return response;
  }, []);

  const validateX12 = useCallback(async (x12Content: string) => {
    setLoading('validate_x12');
    const response = await hl7x12MCP.validateX12(x12Content);
    if (response.success && response.data) {
      setResult('validate_x12', response.data);
    } else {
      setError('validate_x12', response.error || 'Failed to validate X12 claim');
    }
    return response;
  }, []);

  const parseX12 = useCallback(async (x12Content: string) => {
    setLoading('parse_x12');
    const response = await hl7x12MCP.parseX12(x12Content);
    if (response.success && response.data) {
      setResult('parse_x12', response.data);
    } else {
      setError('parse_x12', response.error || 'Failed to parse X12 claim');
    }
    return response;
  }, []);

  const convertX12ToFHIR = useCallback(async (x12Content: string) => {
    setLoading('x12_to_fhir');
    const response = await hl7x12MCP.x12ToFHIR(x12Content);
    if (response.success && response.data) {
      setResult('x12_to_fhir', response.data);
    } else {
      setError('x12_to_fhir', response.error || 'Failed to convert X12 to FHIR');
    }
    return response;
  }, []);

  // =====================================================
  // Utility Operations
  // =====================================================

  const getMessageTypes = useCallback(async () => {
    setLoading('get_message_types');
    const response = await hl7x12MCP.getMessageTypes();
    if (response.success && response.data) {
      setResult('get_message_types', response.data);
    } else {
      setError('get_message_types', response.error || 'Failed to get message types');
    }
    return response;
  }, []);

  const reset = useCallback(() => {
    setState({ result: null, operation: null, loading: false, error: null });
  }, []);

  return {
    // State
    result: state.result,
    operation: state.operation,
    loading: state.loading,
    error: state.error,

    // HL7 operations
    parseHL7,
    validateHL7,
    convertHL7ToFHIR,
    generateACK,

    // X12 operations
    generate837P,
    validateX12,
    parseX12,
    convertX12ToFHIR,

    // Utility
    getMessageTypes,
    reset,
  };
}
