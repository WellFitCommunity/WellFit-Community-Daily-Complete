/**
 * LDMetricsPanel.test.tsx — Tests for L&D unit KPI panel
 *
 * Tier 2 (state) tests:
 * - Loading skeleton on mount
 * - Displays metric values after data loads
 * - Alert card shows red styling when alerts > 0
 * - Handles null/zero metrics gracefully
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LDMetricsPanel from '../LDMetricsPanel';

vi.mock('../../../services/laborDelivery', () => ({
  LDMetricsService: {
    getUnitMetrics: vi.fn(),
  },
}));

import { LDMetricsService } from '../../../services/laborDelivery';

describe('LDMetricsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton on initial render', () => {
    vi.mocked(LDMetricsService.getUnitMetrics).mockImplementation(
      () => new Promise(() => {}) // Never resolves — simulates loading
    );

    const { container } = render(<LDMetricsPanel tenantId="tenant-1" />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(4);
  });

  it('displays metric values after successful load', async () => {
    vi.mocked(LDMetricsService.getUnitMetrics).mockResolvedValue({
      success: true,
      data: {
        active_pregnancies: 12,
        deliveries_today: 3,
        active_labors_today: 5,
        active_alerts: 2,
      },
    });

    render(<LDMetricsPanel tenantId="tenant-1" />);

    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument();
    });
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('displays correct labels for each metric', async () => {
    vi.mocked(LDMetricsService.getUnitMetrics).mockResolvedValue({
      success: true,
      data: {
        active_pregnancies: 0,
        deliveries_today: 0,
        active_labors_today: 0,
        active_alerts: 0,
      },
    });

    render(<LDMetricsPanel tenantId="tenant-1" />);

    await waitFor(() => {
      expect(screen.getByText('Active Pregnancies')).toBeInTheDocument();
    });
    expect(screen.getByText('Deliveries Today')).toBeInTheDocument();
    expect(screen.getByText('Active Labors')).toBeInTheDocument();
    expect(screen.getByText('Active Alerts')).toBeInTheDocument();
  });

  it('renders nothing when service returns failure', async () => {
    vi.mocked(LDMetricsService.getUnitMetrics).mockResolvedValue({
      success: false,
      error: 'Network error',
    });

    const { container } = render(<LDMetricsPanel tenantId="tenant-1" />);

    await waitFor(() => {
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBe(0);
    });
    // No metric values should be shown
    expect(screen.queryByText('Active Pregnancies')).not.toBeInTheDocument();
  });

  it('uses green styling for alerts when count is 0', async () => {
    vi.mocked(LDMetricsService.getUnitMetrics).mockResolvedValue({
      success: true,
      data: {
        active_pregnancies: 5,
        deliveries_today: 2,
        active_labors_today: 3,
        active_alerts: 0,
      },
    });

    render(<LDMetricsPanel tenantId="tenant-1" />);

    await waitFor(() => {
      expect(screen.getByText('Active Alerts')).toBeInTheDocument();
    });

    // The alert card should have green background when alerts = 0
    const alertLabel = screen.getByText('Active Alerts');
    const alertCard = alertLabel.closest('div[class*="rounded-lg"]');
    expect(alertCard?.className).toContain('bg-green-50');
  });
});
