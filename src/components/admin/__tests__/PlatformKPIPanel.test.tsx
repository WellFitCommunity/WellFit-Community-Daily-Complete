/**
 * Tests for PlatformKPIPanel
 *
 * Validates that the MCP Postgres Analytics KPI panel displays
 * all 5 platform metrics and handles loading/error states.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformKPIPanel } from '../PlatformKPIPanel';

// Mock the analytics hook
vi.mock('../../../hooks/usePostgresAnalytics', () => ({
  useDashboardKPIs: vi.fn(),
}));

import { useDashboardKPIs } from '../../../hooks/usePostgresAnalytics';

const mockUseDashboardKPIs = vi.mocked(useDashboardKPIs);

describe('PlatformKPIPanel', () => {
  const mockKPIs = {
    active_members: 142,
    high_risk_patients: 8,
    todays_encounters: 23,
    pending_tasks: 5,
    active_sdoh_flags: 12,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays all 5 KPI values when data is loaded', () => {
    mockUseDashboardKPIs.mockReturnValue({
      data: mockKPIs,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<PlatformKPIPanel />);

    expect(screen.getByText('142')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('23')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('shows correct KPI labels', () => {
    mockUseDashboardKPIs.mockReturnValue({
      data: mockKPIs,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<PlatformKPIPanel />);

    expect(screen.getByText('Active Members')).toBeInTheDocument();
    expect(screen.getByText('High Risk Patients')).toBeInTheDocument();
    expect(screen.getByText("Today's Encounters")).toBeInTheDocument();
    expect(screen.getByText('Pending Tasks')).toBeInTheDocument();
    expect(screen.getByText('Active SDOH Flags')).toBeInTheDocument();
  });

  it('shows loading skeleton when data is loading', () => {
    mockUseDashboardKPIs.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refresh: vi.fn(),
    });

    const { container } = render(<PlatformKPIPanel />);

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('displays error alert when KPI fetch fails', () => {
    mockUseDashboardKPIs.mockReturnValue({
      data: null,
      loading: false,
      error: 'Connection refused',
      refresh: vi.fn(),
    });

    render(<PlatformKPIPanel />);

    expect(screen.getByText(/Connection refused/)).toBeInTheDocument();
  });

  it('calls refresh when refresh button is clicked', async () => {
    const mockRefresh = vi.fn();
    mockUseDashboardKPIs.mockReturnValue({
      data: mockKPIs,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    render(<PlatformKPIPanel />);

    const refreshButton = screen.getByLabelText('Refresh platform KPIs');
    await userEvent.click(refreshButton);

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('shows MCP Analytics badge', () => {
    mockUseDashboardKPIs.mockReturnValue({
      data: mockKPIs,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<PlatformKPIPanel />);

    expect(screen.getByText('via MCP Analytics')).toBeInTheDocument();
  });

  it('highlights high-risk patients in red when count is > 0', () => {
    mockUseDashboardKPIs.mockReturnValue({
      data: { ...mockKPIs, high_risk_patients: 17 },
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<PlatformKPIPanel />);

    const highRiskValue = screen.getByText('17');
    expect(highRiskValue.className).toContain('text-red-400');
  });

  it('does not highlight high-risk patients when count is 0', () => {
    mockUseDashboardKPIs.mockReturnValue({
      data: { ...mockKPIs, high_risk_patients: 0 },
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<PlatformKPIPanel />);

    const highRiskValue = screen.getByText('0');
    expect(highRiskValue.className).not.toContain('text-red-400');
  });

  it('accepts custom tenant ID prop', () => {
    mockUseDashboardKPIs.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<PlatformKPIPanel tenantId="custom-tenant-123" />);

    expect(mockUseDashboardKPIs).toHaveBeenCalledWith('custom-tenant-123');
  });
});
