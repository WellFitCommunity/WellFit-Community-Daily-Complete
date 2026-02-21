/**
 * Tests for usePostgresAnalytics hooks
 *
 * Tests MCP Postgres analytics query hooks for dashboard KPIs
 * and specialized analytics data with proper state management.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  useDashboardKPIs,
  usePatientRiskDistribution,
  useClaimsStatusSummary,
  useBedAvailability,
  useQualityMetrics,
} from '../usePostgresAnalytics';

// Mock the MCP Postgres client
vi.mock('../../services/mcp/mcpPostgresClient', () => ({
  getDashboardMetrics: vi.fn(),
  getPatientRiskDistribution: vi.fn(),
  getReadmissionRiskSummary: vi.fn(),
  getEncounterSummary: vi.fn(),
  getSDOHFlagsSummary: vi.fn(),
  getMedicationAdherenceStats: vi.fn(),
  getClaimsStatusSummary: vi.fn(),
  getBillingRevenueSummary: vi.fn(),
  getCarePlanSummary: vi.fn(),
  getTaskCompletionRate: vi.fn(),
  getReferralSummary: vi.fn(),
  getBedAvailability: vi.fn(),
  getShiftHandoffSummary: vi.fn(),
  getQualityMetrics: vi.fn(),
}));

import {
  getDashboardMetrics,
  getPatientRiskDistribution,
  getClaimsStatusSummary,
  getBedAvailability,
  getQualityMetrics,
} from '../../services/mcp/mcpPostgresClient';

const mockGetDashboardMetrics = vi.mocked(getDashboardMetrics);
const mockGetPatientRisk = vi.mocked(getPatientRiskDistribution);
const mockGetClaimsStatus = vi.mocked(getClaimsStatusSummary);
const mockGetBedAvail = vi.mocked(getBedAvailability);
const mockGetQuality = vi.mocked(getQualityMetrics);

const TENANT_ID = 'test-tenant-uuid';

describe('useDashboardKPIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches KPI data on mount and populates state', async () => {
    const mockKPIs = {
      active_members: 142,
      high_risk_patients: 8,
      todays_encounters: 23,
      pending_tasks: 5,
      active_sdoh_flags: 12,
    };

    mockGetDashboardMetrics.mockResolvedValue({
      success: true,
      data: [mockKPIs],
    });

    const { result } = renderHook(() => useDashboardKPIs(TENANT_ID));

    // Initially loading
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockKPIs);
    expect(result.current.data?.active_members).toBe(142);
    expect(result.current.data?.high_risk_patients).toBe(8);
    expect(result.current.data?.todays_encounters).toBe(23);
    expect(result.current.data?.pending_tasks).toBe(5);
    expect(result.current.data?.active_sdoh_flags).toBe(12);
    expect(result.current.error).toBeNull();
  });

  it('sets error when MCP query fails', async () => {
    mockGetDashboardMetrics.mockResolvedValue({
      success: false,
      error: 'Connection refused',
    });

    const { result } = renderHook(() => useDashboardKPIs(TENANT_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Connection refused');
  });

  it('does not fetch when tenantId is null', async () => {
    const { result } = renderHook(() => useDashboardKPIs(null));

    // Should not be loading since tenantId is null
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(mockGetDashboardMetrics).not.toHaveBeenCalled();
  });

  it('refreshes data when refresh is called', async () => {
    const kpi1 = {
      active_members: 100,
      high_risk_patients: 5,
      todays_encounters: 10,
      pending_tasks: 3,
      active_sdoh_flags: 7,
    };
    const kpi2 = {
      active_members: 105,
      high_risk_patients: 6,
      todays_encounters: 15,
      pending_tasks: 2,
      active_sdoh_flags: 8,
    };

    mockGetDashboardMetrics
      .mockResolvedValueOnce({ success: true, data: [kpi1] })
      .mockResolvedValueOnce({ success: true, data: [kpi2] });

    const { result } = renderHook(() => useDashboardKPIs(TENANT_ID));

    await waitFor(() => {
      expect(result.current.data?.active_members).toBe(100);
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.data?.active_members).toBe(105);
    expect(mockGetDashboardMetrics).toHaveBeenCalledTimes(2);
  });

  it('handles network errors gracefully', async () => {
    mockGetDashboardMetrics.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useDashboardKPIs(TENANT_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.data).toBeNull();
  });

  it('passes tenant ID to the MCP client', async () => {
    mockGetDashboardMetrics.mockResolvedValue({
      success: true,
      data: [{
        active_members: 0,
        high_risk_patients: 0,
        todays_encounters: 0,
        pending_tasks: 0,
        active_sdoh_flags: 0,
      }],
    });

    renderHook(() => useDashboardKPIs('my-custom-tenant'));

    await waitFor(() => {
      expect(mockGetDashboardMetrics).toHaveBeenCalledWith('my-custom-tenant');
    });
  });
});

describe('usePatientRiskDistribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and returns risk distribution data', async () => {
    const mockData = [
      { risk_level: 'high', count: 15 },
      { risk_level: 'medium', count: 45 },
      { risk_level: 'low', count: 120 },
    ];

    mockGetPatientRisk.mockResolvedValue({
      success: true,
      data: mockData,
    });

    const { result } = renderHook(() => usePatientRiskDistribution(TENANT_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data[0].risk_level).toBe('high');
    expect(result.current.data[0].count).toBe(15);
    expect(result.current.data[2].risk_level).toBe('low');
  });

  it('returns empty array on error', async () => {
    mockGetPatientRisk.mockResolvedValue({
      success: false,
      error: 'Query failed',
    });

    const { result } = renderHook(() => usePatientRiskDistribution(TENANT_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBe('Query failed');
  });
});

describe('useClaimsStatusSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches claims by status with charge totals', async () => {
    const mockData = [
      { status: 'submitted', count: 50, total_charges: 125000.00 },
      { status: 'paid', count: 30, total_charges: 85000.50 },
      { status: 'denied', count: 5, total_charges: 12500.00 },
    ];

    mockGetClaimsStatus.mockResolvedValue({
      success: true,
      data: mockData,
    });

    const { result } = renderHook(() => useClaimsStatusSummary(TENANT_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data[0].status).toBe('submitted');
    expect(result.current.data[0].total_charges).toBe(125000.00);
    expect(result.current.data[1].status).toBe('paid');
  });
});

describe('useBedAvailability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns bed counts grouped by unit and status', async () => {
    const mockData = [
      { unit: 'ICU', status: 'available', count: 3 },
      { unit: 'ICU', status: 'occupied', count: 12 },
      { unit: 'MedSurg', status: 'available', count: 8 },
    ];

    mockGetBedAvail.mockResolvedValue({
      success: true,
      data: mockData,
    });

    const { result } = renderHook(() => useBedAvailability(TENANT_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data[0].unit).toBe('ICU');
    expect(result.current.data[0].status).toBe('available');
    expect(result.current.data[0].count).toBe(3);
  });
});

describe('useQualityMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns quality measure performance rates', async () => {
    const mockData = [
      {
        measure_code: 'CMS134',
        measure_name: 'Diabetes: Medical Attention for Nephropathy',
        numerator: 85,
        denominator: 100,
        performance_rate: 0.85,
      },
      {
        measure_code: 'CMS165',
        measure_name: 'Controlling High Blood Pressure',
        numerator: 72,
        denominator: 90,
        performance_rate: 0.80,
      },
    ];

    mockGetQuality.mockResolvedValue({
      success: true,
      data: mockData,
    });

    const { result } = renderHook(() => useQualityMetrics(TENANT_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data[0].measure_code).toBe('CMS134');
    expect(result.current.data[0].performance_rate).toBe(0.85);
    expect(result.current.data[1].measure_name).toContain('Blood Pressure');
  });
});
