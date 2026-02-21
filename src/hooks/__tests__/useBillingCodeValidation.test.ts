/**
 * Tests for useBillingCodeValidation hook
 *
 * Tests code validation, bundling checks, code suggestions,
 * and state management for billing workflows.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBillingCodeValidation } from '../useBillingCodeValidation';

// Mock the Medical Codes MCP client
vi.mock('../../services/mcp/mcpMedicalCodesClient', () => ({
  validateBillingCodes: vi.fn(),
  checkCodeBundling: vi.fn(),
  getCodeInfo: vi.fn(),
  suggestCodesForDescription: vi.fn(),
}));

// Mock audit logger
vi.mock('../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

import {
  validateBillingCodes,
  checkCodeBundling,
  getCodeInfo,
  suggestCodesForDescription,
} from '../../services/mcp/mcpMedicalCodesClient';

const mockValidateCodes = vi.mocked(validateBillingCodes);
const mockCheckBundling = vi.mocked(checkCodeBundling);
const mockGetCodeInfo = vi.mocked(getCodeInfo);
const mockSuggestCodes = vi.mocked(suggestCodesForDescription);

describe('useBillingCodeValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => useBillingCodeValidation());

    expect(result.current.status).toBe('idle');
    expect(result.current.result).toBeNull();
    expect(result.current.bundlingIssues).toEqual([]);
    expect(result.current.warningCount).toBe(0);
  });

  it('validates codes and returns valid status when all codes pass', async () => {
    mockValidateCodes.mockResolvedValue({
      success: true,
      data: {
        is_valid: true,
        cpt_validation: [{ code: '99213', valid: true }],
        icd10_validation: [{ code: 'J06.9', valid: true }],
        bundling_issues: [],
      },
    });
    mockCheckBundling.mockResolvedValue({ success: true, data: [] });

    const { result } = renderHook(() => useBillingCodeValidation());

    await act(async () => {
      await result.current.validateCodes(['99213'], ['J06.9']);
    });

    expect(result.current.status).toBe('valid');
    expect(result.current.warningCount).toBe(0);
    expect(result.current.bundlingIssues).toEqual([]);
    expect(mockValidateCodes).toHaveBeenCalledWith(['99213'], ['J06.9'], undefined);
  });

  it('detects bundling issues between multiple CPT codes', async () => {
    mockValidateCodes.mockResolvedValue({
      success: true,
      data: {
        is_valid: true,
        cpt_validation: [
          { code: '99213', valid: true },
          { code: '99214', valid: true },
        ],
        icd10_validation: [],
        bundling_issues: [],
      },
    });
    mockCheckBundling.mockResolvedValue({
      success: true,
      data: [
        {
          codes: ['99213', '99214'],
          issue: 'Mutually exclusive E/M codes',
          suggestion: 'Bill only the higher-level service',
        },
      ],
    });

    const { result } = renderHook(() => useBillingCodeValidation());

    await act(async () => {
      await result.current.validateCodes(['99213', '99214'], []);
    });

    expect(result.current.status).toBe('warnings');
    expect(result.current.bundlingIssues).toHaveLength(1);
    expect(result.current.bundlingIssues[0].issue).toContain('Mutually exclusive');
    expect(result.current.warningCount).toBe(1);
  });

  it('returns warnings status when invalid codes detected', async () => {
    mockValidateCodes.mockResolvedValue({
      success: true,
      data: {
        is_valid: false,
        cpt_validation: [{ code: '00000', valid: false }],
        icd10_validation: [{ code: 'J06.9', valid: true }],
        bundling_issues: [],
      },
    });

    const { result } = renderHook(() => useBillingCodeValidation());

    await act(async () => {
      await result.current.validateCodes(['00000'], ['J06.9']);
    });

    expect(result.current.status).toBe('warnings');
    expect(result.current.warningCount).toBeGreaterThan(0);
  });

  it('handles empty code arrays with warnings', async () => {
    const { result } = renderHook(() => useBillingCodeValidation());

    await act(async () => {
      await result.current.validateCodes([], []);
    });

    expect(result.current.status).toBe('warnings');
    expect(result.current.error).toContain('No codes to validate');
  });

  it('handles API failure gracefully', async () => {
    mockValidateCodes.mockResolvedValue({
      success: false,
      error: 'Service unavailable',
    });

    const { result } = renderHook(() => useBillingCodeValidation());

    await act(async () => {
      await result.current.validateCodes(['99213'], ['J06.9']);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toContain('Service unavailable');
  });

  it('suggests codes from clinical description', async () => {
    mockSuggestCodes.mockResolvedValue({
      success: true,
      data: {
        cpt: [{ code: '99213', short_description: 'Office visit, established' }],
        icd10: [{ code: 'J06.9', description: 'Acute upper resp infection' }],
      },
    });

    const { result } = renderHook(() => useBillingCodeValidation());

    let suggestion: unknown;
    await act(async () => {
      suggestion = await result.current.suggestCodes('Patient with upper respiratory infection');
    });

    expect(suggestion).toBeTruthy();
    expect(result.current.suggestions?.cpt).toHaveLength(1);
    expect(result.current.suggestions?.icd10).toHaveLength(1);
    expect(mockSuggestCodes).toHaveBeenCalledWith(
      'Patient with upper respiratory infection',
      ['cpt', 'icd10'],
      5
    );
  });

  it('looks up individual code details', async () => {
    mockGetCodeInfo.mockResolvedValue({
      success: true,
      data: {
        code: '99213',
        short_description: 'Office/outpatient visit, est',
        long_description: 'Office or outpatient visit for the evaluation and management of an established patient',
        work_rvu: 1.3,
      },
    });

    const { result } = renderHook(() => useBillingCodeValidation());

    let codeDetail: unknown;
    await act(async () => {
      codeDetail = await result.current.lookupCode('99213', 'cpt');
    });

    expect(codeDetail).toBeTruthy();
    expect((codeDetail as { code: string }).code).toBe('99213');
    expect(mockGetCodeInfo).toHaveBeenCalledWith('99213', 'cpt');
  });

  it('resets all state to idle', async () => {
    mockValidateCodes.mockResolvedValue({
      success: true,
      data: { is_valid: true, cpt_validation: [], icd10_validation: [], bundling_issues: [] },
    });

    const { result } = renderHook(() => useBillingCodeValidation());

    await act(async () => {
      await result.current.validateCodes(['99213'], []);
    });
    expect(result.current.status).not.toBe('idle');

    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.suggestions).toBeNull();
  });
});
