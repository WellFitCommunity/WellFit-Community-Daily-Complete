/**
 * MyAmendmentRequests Page Tests
 *
 * Tests submission form display, existing request listing,
 * form validation, and disagreement option on denied requests.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetMyAmendmentRequests = vi.fn();
const mockSubmitAmendmentRequest = vi.fn();
const mockFileDisagreementStatement = vi.fn();

vi.mock('../../services/patientAmendmentService', () => ({
  patientAmendmentService: {
    getMyAmendmentRequests: (...args: unknown[]) => mockGetMyAmendmentRequests(...args),
    submitAmendmentRequest: (...args: unknown[]) => mockSubmitAmendmentRequest(...args),
    fileDisagreementStatement: (...args: unknown[]) => mockFileDisagreementStatement(...args),
  },
}));

vi.mock('../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    phi: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockRequests = [
  {
    id: 'amend-1',
    record_type: 'medications',
    record_description: 'Blood pressure medication dosage',
    requested_value: 'Lisinopril 20mg',
    reason: 'Dosage was updated',
    status: 'submitted',
    denial_reason: null,
    disagreement_statement: null,
    created_at: '2026-02-01T10:00:00Z',
  },
  {
    id: 'amend-2',
    record_type: 'demographics',
    record_description: 'Address update',
    requested_value: '456 Oak St',
    reason: 'Moved to new address',
    status: 'denied',
    denial_reason: 'Address was verified as correct',
    disagreement_statement: null,
    created_at: '2026-01-15T10:00:00Z',
  },
];

describe('MyAmendmentRequests', () => {
  let MyAmendmentRequests: React.FC;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetMyAmendmentRequests.mockResolvedValue({
      success: true,
      data: mockRequests,
    });
    const mod = await import('../../pages/MyAmendmentRequests');
    MyAmendmentRequests = mod.default;
  });

  it('displays existing amendment requests after loading', async () => {
    render(<MyAmendmentRequests />);
    await waitFor(() => {
      expect(screen.getByText('Blood pressure medication dosage')).toBeInTheDocument();
    });
    expect(screen.getByText('Address update')).toBeInTheDocument();
  });

  it('shows New Request button that reveals the form', async () => {
    render(<MyAmendmentRequests />);
    await waitFor(() => {
      expect(screen.getByText('New Request')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('New Request'));

    expect(screen.getByText('Submit Amendment Request')).toBeInTheDocument();
    expect(screen.getByLabelText(/Description of Record/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Requested Change/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Reason for Amendment/)).toBeInTheDocument();
  });

  it('disables submit when required fields are empty', async () => {
    render(<MyAmendmentRequests />);
    await waitFor(() => {
      expect(screen.getByText('New Request')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('New Request'));

    const submitButton = screen.getByText('Submit Request');
    expect(submitButton).toBeDisabled();
  });

  it('enables submit when all required fields are filled', async () => {
    render(<MyAmendmentRequests />);
    await waitFor(() => {
      expect(screen.getByText('New Request')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('New Request'));

    fireEvent.change(screen.getByLabelText(/Description of Record/), {
      target: { value: 'My allergy is wrong' },
    });
    fireEvent.change(screen.getByLabelText(/Requested Change/), {
      target: { value: 'Remove penicillin allergy' },
    });
    fireEvent.change(screen.getByLabelText(/Reason for Amendment/), {
      target: { value: 'Allergy test was negative' },
    });

    const submitButton = screen.getByText('Submit Request');
    expect(submitButton).not.toBeDisabled();
  });

  it('shows disagreement option on denied requests', async () => {
    render(<MyAmendmentRequests />);
    await waitFor(() => {
      expect(screen.getByText('Address update')).toBeInTheDocument();
    });

    // Denied request should show the denial reason
    expect(screen.getByText(/Address was verified as correct/)).toBeInTheDocument();

    // Should show "File Disagreement Statement" button
    expect(screen.getByText('File Disagreement Statement')).toBeInTheDocument();
  });

  it('shows disagreement textarea when File Disagreement Statement is clicked', async () => {
    render(<MyAmendmentRequests />);
    await waitFor(() => {
      expect(screen.getByText('File Disagreement Statement')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('File Disagreement Statement'));

    expect(screen.getByLabelText('Your Disagreement Statement')).toBeInTheDocument();
    expect(screen.getByText('File Disagreement')).toBeInTheDocument();
  });

  it('shows status badges for each request', async () => {
    render(<MyAmendmentRequests />);
    await waitFor(() => {
      expect(screen.getByText('Submitted')).toBeInTheDocument();
    });
    expect(screen.getByText('Denied')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    mockGetMyAmendmentRequests.mockImplementation(() => new Promise(() => {}));
    render(<MyAmendmentRequests />);
    expect(screen.getByText('Loading your amendment requests...')).toBeInTheDocument();
  });

  it('shows empty state when no requests exist', async () => {
    mockGetMyAmendmentRequests.mockResolvedValue({ success: true, data: [] });
    vi.resetModules();
    const mod = await import('../../pages/MyAmendmentRequests');
    const Component = mod.default;

    render(<Component />);
    await waitFor(() => {
      expect(screen.getByText(/You have not submitted any amendment requests/)).toBeInTheDocument();
    });
  });
});
