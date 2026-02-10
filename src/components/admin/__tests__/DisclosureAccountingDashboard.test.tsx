/**
 * DisclosureAccountingDashboard Tests
 *
 * Tests disclosure table rendering with mock data, empty state display,
 * date filter inputs, and error handling per 45 CFR 164.528.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetDisclosureReport = vi.fn();

vi.mock('../../../services/disclosureAccountingService', () => ({
  disclosureAccountingService: {
    getDisclosureReport: (...args: unknown[]) => mockGetDisclosureReport(...args),
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockDisclosures = [
  {
    id: 'disc-1',
    tenant_id: 'tenant-1',
    patient_id: 'patient-1',
    disclosed_by: 'admin-1',
    disclosure_date: '2026-02-05T10:00:00Z',
    recipient_name: 'County Health Department',
    recipient_type: 'public_health' as const,
    purpose: 'Mandatory disease reporting',
    phi_types_disclosed: ['diagnosis', 'lab_results'],
    disclosure_method: 'electronic' as const,
    data_classes_disclosed: [],
    legal_authority: '42 CFR Part 2',
    patient_authorization_id: null,
    notes: null,
    created_at: '2026-02-05T10:00:00Z',
  },
  {
    id: 'disc-2',
    tenant_id: 'tenant-1',
    patient_id: 'patient-2',
    disclosed_by: 'admin-1',
    disclosure_date: '2026-02-03T14:30:00Z',
    recipient_name: 'FBI Field Office',
    recipient_type: 'law_enforcement' as const,
    purpose: 'Court order compliance',
    phi_types_disclosed: ['demographics', 'treatment_records'],
    disclosure_method: 'mail' as const,
    data_classes_disclosed: [],
    legal_authority: 'Court Order #2026-CV-1234',
    patient_authorization_id: null,
    notes: 'Subpoena received 2026-01-28',
    created_at: '2026-02-03T14:30:00Z',
  },
];

describe('DisclosureAccountingDashboard', () => {
  let DisclosureAccountingDashboard: React.FC;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetDisclosureReport.mockResolvedValue({ success: true, data: mockDisclosures });
    const mod = await import('../DisclosureAccountingDashboard');
    DisclosureAccountingDashboard = mod.default;
  });

  it('renders disclosure table with recipient names and purposes', async () => {
    render(<DisclosureAccountingDashboard />);
    await waitFor(() => {
      expect(screen.getByText('County Health Department')).toBeInTheDocument();
    });
    expect(screen.getByText('FBI Field Office')).toBeInTheDocument();
    expect(screen.getByText('Mandatory disease reporting')).toBeInTheDocument();
    expect(screen.getByText('Court order compliance')).toBeInTheDocument();
  });

  it('displays correct recipient type labels in the table', async () => {
    render(<DisclosureAccountingDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Public Health')).toBeInTheDocument();
    });
    expect(screen.getByText('Law Enforcement')).toBeInTheDocument();
  });

  it('shows disclosure method labels for each entry', async () => {
    render(<DisclosureAccountingDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Electronic')).toBeInTheDocument();
    });
    expect(screen.getByText('Mail')).toBeInTheDocument();
  });

  it('displays PHI types as comma-separated list', async () => {
    render(<DisclosureAccountingDashboard />);
    await waitFor(() => {
      expect(screen.getByText('diagnosis, lab_results')).toBeInTheDocument();
    });
    expect(screen.getByText('demographics, treatment_records')).toBeInTheDocument();
  });

  it('shows total disclosure count in stats card', async () => {
    render(<DisclosureAccountingDashboard />);
    await waitFor(() => {
      // "2" appears as the total count
      const statCards = screen.getAllByText('2');
      expect(statCards.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows empty state when no disclosures exist', async () => {
    mockGetDisclosureReport.mockResolvedValue({ success: true, data: [] });
    vi.resetModules();
    const mod = await import('../DisclosureAccountingDashboard');
    const Component = mod.default;

    render(<Component />);
    await waitFor(() => {
      expect(screen.getByText(/No disclosures found/)).toBeInTheDocument();
    });
  });

  it('renders date range filter inputs', async () => {
    render(<DisclosureAccountingDashboard />);
    await waitFor(() => {
      expect(screen.getByLabelText('From Date')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('To Date')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    mockGetDisclosureReport.mockImplementation(() => new Promise(() => {}));
    render(<DisclosureAccountingDashboard />);
    expect(screen.getByText('Loading disclosure data...')).toBeInTheDocument();
  });

  it('shows error state when data fails to load', async () => {
    mockGetDisclosureReport.mockResolvedValue({
      success: false,
      error: { code: 'DATABASE_ERROR', message: 'Permission denied' },
    });
    vi.resetModules();
    const mod = await import('../DisclosureAccountingDashboard');
    const Component = mod.default;

    render(<Component />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText('Permission denied')).toBeInTheDocument();
  });

  it('displays the HIPAA regulation reference', async () => {
    render(<DisclosureAccountingDashboard />);
    await waitFor(() => {
      expect(screen.getByText('45 CFR 164.528 Compliance')).toBeInTheDocument();
    });
  });
});
