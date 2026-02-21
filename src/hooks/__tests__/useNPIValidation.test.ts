/**
 * Tests for useNPIValidation hook
 *
 * Tests NPI format validation, registry lookup integration,
 * and state management for the billing provider onboarding flow.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNPIValidation } from '../useNPIValidation';

// Mock the NPI Registry client
vi.mock('../../services/mcp/mcpNPIRegistryClient', () => ({
  validateNPI: vi.fn(),
  lookupProviderByNPI: vi.fn(),
  isValidNPIFormat: vi.fn(),
}));

// Mock audit logger
vi.mock('../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

import { validateNPI, lookupProviderByNPI, isValidNPIFormat } from '../../services/mcp/mcpNPIRegistryClient';

const mockValidateNPI = vi.mocked(validateNPI);
const mockLookupNPI = vi.mocked(lookupProviderByNPI);
const mockIsValidFormat = vi.mocked(isValidNPIFormat);

describe('useNPIValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsValidFormat.mockReturnValue(true);
  });

  it('starts in idle state with no validation data', () => {
    const { result } = renderHook(() => useNPIValidation());

    expect(result.current.status).toBe('idle');
    expect(result.current.validation).toBeNull();
    expect(result.current.provider).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('rejects invalid NPI format without making API call', async () => {
    mockIsValidFormat.mockReturnValue(false);

    const { result } = renderHook(() => useNPIValidation());

    await act(async () => {
      await result.current.validateAndLookup('1234567890');
    });

    expect(result.current.status).toBe('invalid');
    expect(result.current.error).toContain('Invalid NPI format');
    expect(mockValidateNPI).not.toHaveBeenCalled();
  });

  it('validates active NPI and populates provider details', async () => {
    mockValidateNPI.mockResolvedValue({
      success: true,
      data: {
        npi: '1234567893',
        valid_format: true,
        is_active: true,
        provider_name: 'Dr. Smith',
        enumeration_type: 'NPI-1',
        status: 'active',
        validation_message: 'NPI is valid and active',
      },
    });

    mockLookupNPI.mockResolvedValue({
      success: true,
      data: {
        found: true,
        npi: '1234567893',
        provider: {
          name: 'Dr. John Smith',
          type: 'Individual',
          credential: 'MD',
          enumeration_date: '2010-01-15',
          last_updated: '2024-06-01',
          status: 'A',
          taxonomies: [{ code: '207R00000X', description: 'Internal Medicine', primary: true }],
          addresses: [{ type: 'LOCATION', address_1: '123 Main St', city: 'Houston', state: 'TX', postal_code: '77001' }],
          identifiers: [],
        },
      },
    });

    const { result } = renderHook(() => useNPIValidation());

    await act(async () => {
      await result.current.validateAndLookup('1234567893');
    });

    expect(result.current.status).toBe('valid');
    expect(result.current.validation?.is_active).toBe(true);
    expect(result.current.provider?.name).toBe('Dr. John Smith');
    expect(result.current.provider?.credential).toBe('MD');
    expect(result.current.error).toBeNull();
  });

  it('handles inactive NPI correctly', async () => {
    mockValidateNPI.mockResolvedValue({
      success: true,
      data: {
        npi: '1234567893',
        valid_format: true,
        is_active: false,
        status: 'deactivated',
        validation_message: 'NPI has been deactivated',
      },
    });

    const { result } = renderHook(() => useNPIValidation());

    await act(async () => {
      await result.current.validateAndLookup('1234567893');
    });

    expect(result.current.status).toBe('invalid');
    expect(result.current.error).toContain('deactivated');
    expect(mockLookupNPI).not.toHaveBeenCalled();
  });

  it('handles API failure gracefully', async () => {
    mockValidateNPI.mockResolvedValue({
      success: false,
      error: 'Network timeout',
    });

    const { result } = renderHook(() => useNPIValidation());

    await act(async () => {
      await result.current.validateAndLookup('1234567893');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toContain('Network timeout');
  });

  it('resets state to idle', async () => {
    mockValidateNPI.mockResolvedValue({
      success: true,
      data: {
        npi: '1234567893',
        valid_format: true,
        is_active: true,
        status: 'active',
        validation_message: 'Valid',
      },
    });
    mockLookupNPI.mockResolvedValue({ success: true, data: { found: false, npi: '1234567893' } });

    const { result } = renderHook(() => useNPIValidation());

    await act(async () => {
      await result.current.validateAndLookup('1234567893');
    });
    expect(result.current.status).toBe('valid');

    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.validation).toBeNull();
    expect(result.current.provider).toBeNull();
  });

  it('checkFormat returns true for valid NPI and updates state', () => {
    mockIsValidFormat.mockReturnValue(true);

    const { result } = renderHook(() => useNPIValidation());

    let valid = false;
    act(() => {
      valid = result.current.checkFormat('1234567893');
    });

    expect(valid).toBe(true);
    expect(result.current.formatValid).toBe(true);
  });

  it('checkFormat returns false for invalid NPI format', () => {
    mockIsValidFormat.mockReturnValue(false);

    const { result } = renderHook(() => useNPIValidation());

    let valid = true;
    act(() => {
      valid = result.current.checkFormat('0000000000');
    });

    expect(valid).toBe(false);
    expect(result.current.formatValid).toBe(false);
  });
});
