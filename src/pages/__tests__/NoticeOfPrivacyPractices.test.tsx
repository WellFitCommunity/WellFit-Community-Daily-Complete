/**
 * NoticeOfPrivacyPractices Page Tests
 *
 * Tests NPP content display, acknowledge button, already-acknowledged state,
 * and acknowledgment submission handling.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const mockCheckAcknowledgmentStatus = vi.fn();
const mockGetCurrentNPP = vi.fn();
const mockRecordAcknowledgment = vi.fn();

vi.mock('../../services/nppService', () => ({
  nppService: {
    checkAcknowledgmentStatus: (...args: unknown[]) => mockCheckAcknowledgmentStatus(...args),
    getCurrentNPP: (...args: unknown[]) => mockGetCurrentNPP(...args),
    recordAcknowledgment: (...args: unknown[]) => mockRecordAcknowledgment(...args),
  },
}));

vi.mock('../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockNppVersion = {
  id: 'npp-v1',
  version_number: '2.0',
  effective_date: '2026-01-01',
  is_current: true,
  content_hash: 'abc123',
  summary: 'Updated NPP',
};

describe('NoticeOfPrivacyPractices', () => {
  let NoticeOfPrivacyPractices: React.FC;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    mockCheckAcknowledgmentStatus.mockResolvedValue({
      success: true,
      data: {
        has_acknowledged_current: false,
        current_version: mockNppVersion,
        last_acknowledgment: null,
      },
    });

    const mod = await import('../../pages/NoticeOfPrivacyPractices');
    NoticeOfPrivacyPractices = mod.default;
  });

  it('displays NPP content sections after loading', async () => {
    render(<NoticeOfPrivacyPractices />);

    await waitFor(() => {
      expect(screen.getByText('Notice of Privacy Practices')).toBeInTheDocument();
    });

    // Verify key HIPAA content sections are rendered
    expect(screen.getByText('Our Responsibilities')).toBeInTheDocument();
    expect(screen.getByText('Your Rights Regarding Your Health Information')).toBeInTheDocument();
    expect(screen.getByText('Right to Amend Your Records')).toBeInTheDocument();
    expect(screen.getByText('Filing a Complaint')).toBeInTheDocument();
  });

  it('shows acknowledge button when patient has not yet acknowledged', async () => {
    render(<NoticeOfPrivacyPractices />);

    await waitFor(() => {
      expect(screen.getByText('I Acknowledge')).toBeInTheDocument();
    });
  });

  it('shows already-acknowledged state with date', async () => {
    mockCheckAcknowledgmentStatus.mockResolvedValue({
      success: true,
      data: {
        has_acknowledged_current: true,
        current_version: mockNppVersion,
        last_acknowledgment: {
          id: 'ack-1',
          patient_id: 'patient-456',
          npp_version_id: 'npp-v1',
          acknowledgment_type: 'electronic',
          acknowledged_at: '2026-02-01T10:30:00.000Z',
        },
      },
    });
    vi.resetModules();
    const mod = await import('../../pages/NoticeOfPrivacyPractices');
    const Component = mod.default;

    render(<Component />);

    await waitFor(() => {
      expect(
        screen.getByText(/You have acknowledged this Notice of Privacy Practices/)
      ).toBeInTheDocument();
    });

    // Should NOT show the acknowledge button
    expect(screen.queryByText('I Acknowledge')).not.toBeInTheDocument();
  });

  it('handles acknowledgment submission and shows success', async () => {
    mockRecordAcknowledgment.mockResolvedValue({
      success: true,
      data: {
        id: 'ack-new',
        patient_id: 'patient-456',
        npp_version_id: 'npp-v1',
        acknowledgment_type: 'electronic',
        acknowledged_at: '2026-02-10T12:00:00.000Z',
      },
    });

    render(<NoticeOfPrivacyPractices />);

    await waitFor(() => {
      expect(screen.getByText('I Acknowledge')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('I Acknowledge'));

    await waitFor(() => {
      expect(mockRecordAcknowledgment).toHaveBeenCalledWith('npp-v1', 'electronic');
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Your acknowledgment has been recorded successfully/)
      ).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    mockCheckAcknowledgmentStatus.mockImplementation(() => new Promise(() => {}));
    render(<NoticeOfPrivacyPractices />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error state when loading fails', async () => {
    mockCheckAcknowledgmentStatus.mockResolvedValue({
      success: false,
      error: { code: 'DATABASE_ERROR', message: 'Service unavailable' },
    });
    vi.resetModules();
    const mod = await import('../../pages/NoticeOfPrivacyPractices');
    const Component = mod.default;

    render(<Component />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
