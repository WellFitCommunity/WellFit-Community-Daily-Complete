/**
 * BreachNotificationDashboard Tests
 *
 * Tests breach incident list display, severity badges, loading state,
 * empty state, and stats card accuracy.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockListBreachIncidents = vi.fn();
const mockUpdateBreachStatus = vi.fn();

vi.mock('../../../services/breachNotificationService', () => ({
  breachNotificationService: {
    listBreachIncidents: (...args: unknown[]) => mockListBreachIncidents(...args),
    updateBreachStatus: (...args: unknown[]) => mockUpdateBreachStatus(...args),
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    security: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockIncidents = [
  {
    id: 'b-1',
    incident_number: 'INC-001',
    title: 'Laptop Theft',
    description: 'Unencrypted laptop stolen',
    severity: 'critical' as const,
    status: 'reported' as const,
    individuals_affected: 250,
    discovered_date: '2026-01-15T00:00:00Z',
    breach_type: 'theft' as const,
    phi_types_involved: ['SSN'],
    individual_notification_deadline: null,
  },
  {
    id: 'b-2',
    incident_number: 'INC-002',
    title: 'Email Disclosure',
    description: 'Wrong recipient',
    severity: 'medium' as const,
    status: 'resolved' as const,
    individuals_affected: 3,
    discovered_date: '2026-01-10T00:00:00Z',
    breach_type: 'unauthorized_disclosure' as const,
    phi_types_involved: ['name'],
    individual_notification_deadline: null,
  },
];

describe('BreachNotificationDashboard', () => {
  let BreachNotificationDashboard: React.FC;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockListBreachIncidents.mockResolvedValue({
      success: true,
      data: mockIncidents,
    });
    const mod = await import('../BreachNotificationDashboard');
    BreachNotificationDashboard = mod.default;
  });

  it('shows loading state initially', () => {
    mockListBreachIncidents.mockImplementation(() => new Promise(() => {}));
    render(<BreachNotificationDashboard />);
    expect(screen.getByText('Loading breach incidents...')).toBeInTheDocument();
  });

  it('displays breach incident titles after loading', async () => {
    render(<BreachNotificationDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Laptop Theft/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Email Disclosure/)).toBeInTheDocument();
  });

  it('shows correct severity badges for incidents', async () => {
    render(<BreachNotificationDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Critical')).toBeInTheDocument();
    });
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('displays stats cards with correct counts', async () => {
    render(<BreachNotificationDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Breach Notification Dashboard')).toBeInTheDocument();
    });
    // Total Incidents: 2
    const totalLabel = screen.getByLabelText(/Show all incidents: 2/);
    expect(totalLabel).toBeInTheDocument();
    // Open: 1 (reported = open)
    const openLabel = screen.getByLabelText(/Show open incidents: 1/);
    expect(openLabel).toBeInTheDocument();
    // Resolved: 1
    const resolvedLabel = screen.getByLabelText(/Show resolved incidents: 1/);
    expect(resolvedLabel).toBeInTheDocument();
  });

  it('shows empty state message when no incidents exist', async () => {
    mockListBreachIncidents.mockResolvedValue({ success: true, data: [] });
    vi.resetModules();
    const mod = await import('../BreachNotificationDashboard');
    const Component = mod.default;

    render(<Component />);
    await waitFor(() => {
      expect(screen.getByText(/No breach incidents found/)).toBeInTheDocument();
    });
  });

  it('shows error state when loading fails', async () => {
    mockListBreachIncidents.mockResolvedValue({
      success: false,
      error: { code: 'DATABASE_ERROR', message: 'Connection refused' },
    });
    vi.resetModules();
    const mod = await import('../BreachNotificationDashboard');
    const Component = mod.default;

    render(<Component />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText('Connection refused')).toBeInTheDocument();
  });

  it('displays individual affected counts per incident', async () => {
    render(<BreachNotificationDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/250 individuals/)).toBeInTheDocument();
    });
    expect(screen.getByText(/3 individuals/)).toBeInTheDocument();
  });
});
