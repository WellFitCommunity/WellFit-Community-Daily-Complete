/**
 * BAATrackingDashboard Tests
 *
 * Tests BAA list with associate names, status badges, expiring soon alerts,
 * and empty state display.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockListBAAs = vi.fn();
const mockGetExpiringBAAs = vi.fn();

vi.mock('../../../services/baaTrackingService', () => ({
  baaTrackingService: {
    listBAAs: (...args: unknown[]) => mockListBAAs(...args),
    getExpiringBAAs: (...args: unknown[]) => mockGetExpiringBAAs(...args),
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockBAAs = [
  {
    id: 'baa-1',
    associate_name: 'AWS Cloud',
    associate_type: 'cloud_provider',
    service_description: 'Cloud hosting',
    status: 'active' as const,
    effective_date: '2025-06-01',
    expiration_date: '2026-06-01',
    auto_renew: true,
    phi_types_shared: ['all'],
    contact_name: 'Support Team',
    contact_email: 'support@aws.example.com',
  },
  {
    id: 'baa-2',
    associate_name: 'Clearinghouse Inc',
    associate_type: 'clearinghouse',
    service_description: 'Claims processing',
    status: 'expired' as const,
    effective_date: '2024-01-01',
    expiration_date: '2025-12-31',
    auto_renew: false,
    phi_types_shared: ['claims'],
    contact_name: null,
    contact_email: null,
  },
];

const mockExpiringBAAs = [
  {
    id: 'baa-3',
    associate_name: 'Lab Partner',
    associate_type: 'vendor',
    service_description: 'Lab results',
    status: 'active' as const,
    effective_date: '2025-01-01',
    expiration_date: '2026-04-15',
    auto_renew: false,
    phi_types_shared: ['lab_results'],
    contact_name: null,
    contact_email: null,
  },
];

describe('BAATrackingDashboard', () => {
  let BAATrackingDashboard: React.FC;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockListBAAs.mockResolvedValue({ success: true, data: mockBAAs });
    mockGetExpiringBAAs.mockResolvedValue({ success: true, data: mockExpiringBAAs });
    const mod = await import('../BAATrackingDashboard');
    BAATrackingDashboard = mod.default;
  });

  it('displays BAA associate names after loading', async () => {
    render(<BAATrackingDashboard />);
    await waitFor(() => {
      expect(screen.getByText('AWS Cloud')).toBeInTheDocument();
    });
    expect(screen.getByText('Clearinghouse Inc')).toBeInTheDocument();
  });

  it('shows correct status badges for each BAA', async () => {
    render(<BAATrackingDashboard />);
    await waitFor(() => {
      // "Active" appears in stats card label and status badge
      expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    });
    // "Expired" appears in stats card label and status badge
    expect(screen.getAllByText('Expired').length).toBeGreaterThanOrEqual(1);
  });

  it('shows expiring soon alert when BAAs are expiring', async () => {
    render(<BAATrackingDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/expiring within 90 days/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Lab Partner/)).toBeInTheDocument();
  });

  it('does not show expiring alert when no BAAs are expiring', async () => {
    mockGetExpiringBAAs.mockResolvedValue({ success: true, data: [] });
    vi.resetModules();
    const mod = await import('../BAATrackingDashboard');
    const Component = mod.default;

    render(<Component />);
    await waitFor(() => {
      expect(screen.getByText('AWS Cloud')).toBeInTheDocument();
    });
    expect(screen.queryByText(/expiring within 90 days/)).not.toBeInTheDocument();
  });

  it('shows empty state when no BAAs exist', async () => {
    mockListBAAs.mockResolvedValue({ success: true, data: [] });
    mockGetExpiringBAAs.mockResolvedValue({ success: true, data: [] });
    vi.resetModules();
    const mod = await import('../BAATrackingDashboard');
    const Component = mod.default;

    render(<Component />);
    await waitFor(() => {
      expect(screen.getByText(/No business associate agreements found/)).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    mockListBAAs.mockImplementation(() => new Promise(() => {}));
    mockGetExpiringBAAs.mockImplementation(() => new Promise(() => {}));
    render(<BAATrackingDashboard />);
    expect(screen.getByText('Loading BAA data...')).toBeInTheDocument();
  });

  it('shows error state when data fails to load', async () => {
    mockListBAAs.mockResolvedValue({
      success: false,
      error: { code: 'DATABASE_ERROR', message: 'Permission denied' },
    });
    vi.resetModules();
    const mod = await import('../BAATrackingDashboard');
    const Component = mod.default;

    render(<Component />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText('Permission denied')).toBeInTheDocument();
  });
});
