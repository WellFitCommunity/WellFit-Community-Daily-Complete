/**
 * Tests for useCMSCoverageCheck hook
 *
 * Tests CMS coverage requirement lookups, prior authorization checks,
 * documentation requirement aggregation, and state management for
 * the pre-submission billing workflow.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCMSCoverageCheck } from '../useCMSCoverageCheck';

// Mock the CMS Coverage MCP client
vi.mock('../../services/mcp/mcpCMSCoverageClient', () => ({
  getCoverageRequirements: vi.fn(),
  checkPriorAuthRequired: vi.fn(),
}));

// Mock audit logger
vi.mock('../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

import {
  getCoverageRequirements,
  checkPriorAuthRequired,
} from '../../services/mcp/mcpCMSCoverageClient';

const mockGetCoverage = vi.mocked(getCoverageRequirements);
const mockCheckAuth = vi.mocked(checkPriorAuthRequired);

describe('useCMSCoverageCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in idle state with no results', () => {
    const { result } = renderHook(() => useCMSCoverageCheck());

    expect(result.current.status).toBe('idle');
    expect(result.current.result).toBeNull();
    expect(result.current.warningCount).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('returns pass status when all codes clear coverage and no prior auth needed', async () => {
    mockGetCoverage.mockResolvedValue({
      success: true,
      data: {
        code: '99213',
        description: 'Office visit, established',
        coverage_status: 'covered',
        requirements: [],
        documentation_needed: [],
        lcd_references: [],
        ncd_references: [],
      },
    });
    mockCheckAuth.mockResolvedValue({
      success: true,
      data: {
        cpt_code: '99213',
        requires_prior_auth: false,
        confidence: 'high',
        reason: 'E/M codes do not require prior auth',
        documentation_required: [],
        estimated_approval_time: '',
        appeal_process: '',
      },
    });

    const { result } = renderHook(() => useCMSCoverageCheck());

    await act(async () => {
      await result.current.checkCoverage(['99213']);
    });

    expect(result.current.status).toBe('pass');
    expect(result.current.warningCount).toBe(0);
    expect(result.current.result?.codesRequiringAuth).toEqual([]);
    expect(result.current.result?.missingDocumentation).toEqual([]);
  });

  it('detects prior authorization requirements', async () => {
    mockGetCoverage.mockResolvedValue({
      success: true,
      data: {
        code: '70553',
        description: 'MRI brain with/without contrast',
        coverage_status: 'covered_with_conditions',
        requirements: ['Clinical indication required'],
        documentation_needed: ['Prior imaging results'],
        lcd_references: ['L12345'],
        ncd_references: [],
      },
    });
    mockCheckAuth.mockResolvedValue({
      success: true,
      data: {
        cpt_code: '70553',
        requires_prior_auth: true,
        confidence: 'high',
        reason: 'Advanced imaging requires prior authorization',
        documentation_required: ['Clinical indication', 'Neurological exam'],
        estimated_approval_time: '3-5 business days',
        appeal_process: 'Peer-to-peer review',
      },
    });

    const { result } = renderHook(() => useCMSCoverageCheck());

    await act(async () => {
      await result.current.checkCoverage(['70553']);
    });

    expect(result.current.status).toBe('warnings');
    expect(result.current.result?.codesRequiringAuth).toContain('70553');
    expect(result.current.result?.missingDocumentation).toContain('Clinical indication');
    expect(result.current.result?.missingDocumentation).toContain('Prior imaging results');
    expect(result.current.warningCount).toBeGreaterThan(0);
  });

  it('handles multiple CPT codes and deduplicates documentation', async () => {
    mockGetCoverage.mockImplementation(async (code) => ({
      success: true,
      data: {
        code,
        description: 'Test procedure',
        coverage_status: 'covered',
        requirements: [],
        documentation_needed: ['Clinical indication'],
        lcd_references: [],
        ncd_references: [],
      },
    }));
    mockCheckAuth.mockImplementation(async (code) => ({
      success: true,
      data: {
        cpt_code: code,
        requires_prior_auth: true,
        confidence: 'medium' as const,
        reason: 'Requires auth',
        documentation_required: ['Clinical indication', 'Patient history'],
        estimated_approval_time: '5 days',
        appeal_process: 'Standard',
      },
    }));

    const { result } = renderHook(() => useCMSCoverageCheck());

    await act(async () => {
      await result.current.checkCoverage(['70553', '72148']);
    });

    expect(result.current.status).toBe('warnings');
    expect(result.current.result?.codesRequiringAuth).toHaveLength(2);
    // "Clinical indication" appears in both getCoverage and checkAuth — should be deduplicated
    const clinicalIndicationCount = result.current.result?.missingDocumentation
      .filter(d => d === 'Clinical indication').length ?? 0;
    expect(clinicalIndicationCount).toBe(1);
  });

  it('returns warnings when no procedure codes provided', async () => {
    const { result } = renderHook(() => useCMSCoverageCheck());

    await act(async () => {
      await result.current.checkCoverage([]);
    });

    expect(result.current.status).toBe('warnings');
    expect(result.current.error).toContain('No procedure codes');
  });

  it('handles API failure gracefully', async () => {
    mockGetCoverage.mockRejectedValue(new Error('Service timeout'));

    const { result } = renderHook(() => useCMSCoverageCheck());

    await act(async () => {
      await result.current.checkCoverage(['99213']);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toContain('Service timeout');
  });

  it('passes patient state to coverage and auth lookups', async () => {
    mockGetCoverage.mockResolvedValue({ success: true, data: {
      code: '99213', description: '', coverage_status: 'covered',
      requirements: [], documentation_needed: [], lcd_references: [], ncd_references: [],
    }});
    mockCheckAuth.mockResolvedValue({ success: true, data: {
      cpt_code: '99213', requires_prior_auth: false, confidence: 'high' as const,
      reason: '', documentation_required: [], estimated_approval_time: '', appeal_process: '',
    }});

    const { result } = renderHook(() => useCMSCoverageCheck());

    await act(async () => {
      await result.current.checkCoverage(['99213'], ['J06.9'], 'TX');
    });

    expect(mockGetCoverage).toHaveBeenCalledWith('99213', 'TX');
    expect(mockCheckAuth).toHaveBeenCalledWith('99213', ['J06.9'], 'TX');
  });

  it('resets state to idle', async () => {
    mockGetCoverage.mockResolvedValue({ success: true, data: {
      code: '99213', description: '', coverage_status: 'covered',
      requirements: [], documentation_needed: [], lcd_references: [], ncd_references: [],
    }});
    mockCheckAuth.mockResolvedValue({ success: true, data: {
      cpt_code: '99213', requires_prior_auth: false, confidence: 'high' as const,
      reason: '', documentation_required: [], estimated_approval_time: '', appeal_process: '',
    }});

    const { result } = renderHook(() => useCMSCoverageCheck());

    await act(async () => {
      await result.current.checkCoverage(['99213']);
    });
    expect(result.current.status).not.toBe('idle');

    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.result).toBeNull();
  });
});
