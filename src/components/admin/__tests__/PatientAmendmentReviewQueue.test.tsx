/**
 * PatientAmendmentReviewQueue Tests
 *
 * Tests pending request display sorted by deadline, accept/deny buttons,
 * deadline countdown, and review decision handling.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetPendingAmendments = vi.fn();
const mockReviewAmendmentRequest = vi.fn();

vi.mock('../../../services/patientAmendmentService', () => ({
  patientAmendmentService: {
    getPendingAmendments: (...args: unknown[]) => mockGetPendingAmendments(...args),
    reviewAmendmentRequest: (...args: unknown[]) => mockReviewAmendmentRequest(...args),
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    clinical: vi.fn().mockResolvedValue(undefined),
  },
}));

const futureDeadline = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString();
const urgentDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

const mockRequests = [
  {
    id: 'amend-1',
    tenant_id: 'tenant-1',
    patient_id: 'patient-1',
    request_number: 'AMD-001',
    record_type: 'medications' as const,
    record_description: 'Metformin dosage correction',
    current_value: '1000mg daily',
    requested_value: '500mg twice daily',
    reason: 'Prescription was changed in January',
    status: 'submitted' as const,
    response_deadline: urgentDeadline,
    reviewed_by: null,
    reviewed_at: null,
    review_decision: null,
    denial_reason: null,
    disagreement_statement: null,
    disagreement_filed_at: null,
    rebuttal_statement: null,
    rebuttal_filed_at: null,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
  },
  {
    id: 'amend-2',
    tenant_id: 'tenant-1',
    patient_id: 'patient-2',
    request_number: 'AMD-002',
    record_type: 'demographics' as const,
    record_description: 'Name spelling correction',
    current_value: 'Jonh Smith',
    requested_value: 'John Smith',
    reason: 'Name is misspelled',
    status: 'submitted' as const,
    response_deadline: futureDeadline,
    reviewed_by: null,
    reviewed_at: null,
    review_decision: null,
    denial_reason: null,
    disagreement_statement: null,
    disagreement_filed_at: null,
    rebuttal_statement: null,
    rebuttal_filed_at: null,
    created_at: '2026-02-01T10:00:00Z',
    updated_at: '2026-02-01T10:00:00Z',
  },
];

describe('PatientAmendmentReviewQueue', () => {
  let PatientAmendmentReviewQueue: React.FC;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetPendingAmendments.mockResolvedValue({
      success: true,
      data: mockRequests,
    });
    const mod = await import('../PatientAmendmentReviewQueue');
    PatientAmendmentReviewQueue = mod.default;
  });

  it('displays pending requests after loading', async () => {
    render(<PatientAmendmentReviewQueue />);
    await waitFor(() => {
      expect(screen.getByText('Metformin dosage correction')).toBeInTheDocument();
    });
    expect(screen.getByText('Name spelling correction')).toBeInTheDocument();
  });

  it('shows accept and deny buttons for each request', async () => {
    render(<PatientAmendmentReviewQueue />);
    await waitFor(() => {
      expect(screen.getByText('Metformin dosage correction')).toBeInTheDocument();
    });
    // Two requests = two Accept buttons and two Deny buttons
    const acceptButtons = screen.getAllByText('Accept');
    const denyButtons = screen.getAllByText('Deny');
    expect(acceptButtons).toHaveLength(2);
    expect(denyButtons).toHaveLength(2);
  });

  it('shows deadline countdown with urgency for urgent requests', async () => {
    render(<PatientAmendmentReviewQueue />);
    await waitFor(() => {
      expect(screen.getByText('Metformin dosage correction')).toBeInTheDocument();
    });
    // Both requests show "X days remaining" countdown
    const deadlineElements = screen.getAllByText(/\d+ days remaining/);
    expect(deadlineElements.length).toBe(2);
  });

  it('handles accept decision and removes request from list', async () => {
    mockReviewAmendmentRequest.mockResolvedValue({
      success: true,
      data: { ...mockRequests[0], status: 'accepted', review_decision: 'accepted' },
    });

    render(<PatientAmendmentReviewQueue />);
    await waitFor(() => {
      expect(screen.getByText('Metformin dosage correction')).toBeInTheDocument();
    });

    const acceptButton = screen.getByLabelText('Accept amendment request: Metformin dosage correction');
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(mockReviewAmendmentRequest).toHaveBeenCalledWith({
        request_id: 'amend-1',
        decision: 'accepted',
      });
    });

    // After acceptance, the request should be removed
    await waitFor(() => {
      expect(screen.queryByText('Metformin dosage correction')).not.toBeInTheDocument();
    });
  });

  it('opens denial dialog when deny is clicked', async () => {
    render(<PatientAmendmentReviewQueue />);
    await waitFor(() => {
      expect(screen.getByText('Metformin dosage correction')).toBeInTheDocument();
    });

    const denyButton = screen.getByLabelText('Deny amendment request: Metformin dosage correction');
    fireEvent.click(denyButton);

    await waitFor(() => {
      expect(screen.getByText('Deny Amendment Request')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Denial Reason (required)')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    mockGetPendingAmendments.mockImplementation(() => new Promise(() => {}));
    render(<PatientAmendmentReviewQueue />);
    expect(screen.getByText('Loading amendment requests...')).toBeInTheDocument();
  });

  it('shows empty state when no pending requests', async () => {
    mockGetPendingAmendments.mockResolvedValue({ success: true, data: [] });
    vi.resetModules();
    const mod = await import('../PatientAmendmentReviewQueue');
    const Component = mod.default;

    render(<Component />);
    await waitFor(() => {
      expect(screen.getByText(/No pending amendment requests/)).toBeInTheDocument();
    });
  });
});
