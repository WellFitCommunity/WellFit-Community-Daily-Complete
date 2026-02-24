/**
 * AmendmentWorkflow Test Suite
 *
 * Tests amendment history display, create form workflow, type selection,
 * conditional original content field, approval/reject actions, empty states,
 * and error handling for the clinical note amendment management UI.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Service mocks — declared before vi.mock so hoisting works
const mockGetAmendmentsForNote = vi.fn();
const mockCreateAmendment = vi.fn();
const mockApproveAmendment = vi.fn();
const mockRejectAmendment = vi.fn();
const mockGetUser = vi.fn();

vi.mock('../../../services/noteAmendmentService', () => ({
  noteAmendmentService: {
    getAmendmentsForNote: (...args: unknown[]) => mockGetAmendmentsForNote(...args),
    createAmendment: (...args: unknown[]) => mockCreateAmendment(...args),
    approveAmendment: (...args: unknown[]) => mockApproveAmendment(...args),
    rejectAmendment: (...args: unknown[]) => mockRejectAmendment(...args),
  },
}));

vi.mock('../../../services/noteLockingService', () => ({}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock EA design system components
vi.mock('../../envision-atlus', () => ({
  EACard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="ea-card" className={className}>{children}</div>
  ),
  EACardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="ea-card-header" className={className}>{children}</div>
  ),
  EACardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="ea-card-content" className={className}>{children}</div>
  ),
  EAButton: ({ children, onClick, disabled, variant }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: string }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant}>{children}</button>
  ),
  EAAlert: ({ children, onDismiss, dismissible }: { children: React.ReactNode; onDismiss?: () => void; dismissible?: boolean }) => (
    <div role="alert">
      {children}
      {dismissible && onDismiss && <button onClick={onDismiss} aria-label="Dismiss">×</button>}
    </div>
  ),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  FileText: () => <span data-testid="file-text-icon">FileText</span>,
  Plus: () => <span data-testid="plus-icon">Plus</span>,
  CheckCircle: () => <span data-testid="check-circle-icon">CheckCircle</span>,
  XCircle: () => <span data-testid="x-circle-icon">XCircle</span>,
  Clock: () => <span data-testid="clock-icon">Clock</span>,
  ChevronDown: () => <span data-testid="chevron-down-icon">ChevronDown</span>,
  ChevronUp: () => <span data-testid="chevron-up-icon">ChevronUp</span>,
  RefreshCw: ({ className }: { className?: string }) => <span data-testid="refresh-icon" className={className}>RefreshCw</span>,
  History: () => <span data-testid="history-icon">History</span>,
  Edit3: () => <span data-testid="edit3-icon">Edit3</span>,
  MessageSquare: () => <span data-testid="message-square-icon">MessageSquare</span>,
}));

// -- Synthetic test data (PHI-safe per CLAUDE.md) --

const pendingAmendment = {
  id: 'amend-pend-001',
  amendment_type: 'correction' as const,
  amendment_content: 'Dosage was 250mg not 500mg',
  amendment_reason: 'Transcription error in original note',
  original_content: 'Patient takes 500mg daily',
  field_amended: 'Medications',
  status: 'pending' as const,
  amended_by: 'user-clinician-alpha',
  amended_by_name: 'Test Clinician Alpha',
  amended_at: '2026-01-20T08:00:00Z',
  approved_by: null,
  approved_by_name: undefined,
  approved_at: null,
  note_type: 'clinical_note' as const,
  clinical_note_id: 'note-001',
  ai_progress_note_id: null,
};

const approvedAmendment = {
  id: 'amend-appr-002',
  amendment_type: 'addendum' as const,
  amendment_content: 'Lab results received post-signing confirm diagnosis',
  amendment_reason: 'Late lab results needed documentation',
  original_content: null,
  field_amended: 'Assessment',
  status: 'approved' as const,
  amended_by: 'user-clinician-beta',
  amended_by_name: 'Test Clinician Beta',
  amended_at: '2026-01-18T14:00:00Z',
  approved_by: 'user-reviewer-gamma',
  approved_by_name: 'Test Reviewer Gamma',
  approved_at: '2026-01-19T09:00:00Z',
  note_type: 'clinical_note' as const,
  clinical_note_id: 'note-001',
  ai_progress_note_id: null,
};

const rejectedAmendment = {
  id: 'amend-rej-003',
  amendment_type: 'late_entry' as const,
  amendment_content: 'Vitals taken at 0800 were not recorded',
  amendment_reason: 'Charting delay during shift change',
  original_content: null,
  field_amended: 'Vitals',
  status: 'rejected' as const,
  amended_by: 'user-clinician-alpha',
  amended_by_name: 'Test Clinician Alpha',
  amended_at: '2026-01-17T06:00:00Z',
  approved_by: 'user-reviewer-gamma',
  approved_by_name: 'Test Reviewer Gamma',
  approved_at: '2026-01-17T10:00:00Z',
  note_type: 'clinical_note' as const,
  clinical_note_id: 'note-001',
  ai_progress_note_id: null,
};

const allAmendments = [pendingAmendment, approvedAmendment, rejectedAmendment];

describe('AmendmentWorkflow', () => {
  let AmendmentWorkflow: React.FC<{
    noteId: string;
    noteType: 'clinical_note' | 'ai_progress_note';
    onAmendmentCreated?: () => void;
  }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    mockGetAmendmentsForNote.mockResolvedValue({ success: true, data: allAmendments });
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-clinician-alpha' } } });

    const mod = await import('../AmendmentWorkflow');
    AmendmentWorkflow = mod.AmendmentWorkflow;
  });

  it('shows loading state while amendments are being fetched', async () => {
    mockGetAmendmentsForNote.mockImplementation(() => new Promise(() => {}));

    render(
      <AmendmentWorkflow noteId="note-001" noteType="clinical_note" />
    );

    expect(screen.getByText('Loading amendments...')).toBeInTheDocument();
  });

  it('shows empty state "No Amendments" when no amendments exist', async () => {
    mockGetAmendmentsForNote.mockResolvedValue({ success: true, data: [] });
    vi.resetModules();
    const mod = await import('../AmendmentWorkflow');
    const Component = mod.AmendmentWorkflow;

    render(
      <Component noteId="note-001" noteType="clinical_note" />
    );

    await waitFor(() => {
      expect(screen.getByText('No Amendments')).toBeInTheDocument();
    });
    expect(screen.getByText('This note has no amendments yet.')).toBeInTheDocument();
    expect(screen.getByTestId('file-text-icon')).toBeInTheDocument();
  });

  it('displays amendment list with type labels and status badges', async () => {
    render(
      <AmendmentWorkflow noteId="note-001" noteType="clinical_note" />
    );

    await waitFor(() => {
      expect(screen.getByText('Correction')).toBeInTheDocument();
    });
    expect(screen.getByText('Addendum')).toBeInTheDocument();
    expect(screen.getByText('Late Entry')).toBeInTheDocument();

    // Status badges
    expect(screen.getByText('Pending Review')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('shows "New Amendment" button that opens create form', async () => {
    render(
      <AmendmentWorkflow noteId="note-001" noteType="clinical_note" />
    );

    await waitFor(() => {
      expect(screen.getByText('New Amendment')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('New Amendment'));

    await waitFor(() => {
      expect(screen.getByText('Create Amendment')).toBeInTheDocument();
    });
    expect(screen.getByText('Amendment Type')).toBeInTheDocument();
    expect(screen.getByText('Amendment Content *')).toBeInTheDocument();
    expect(screen.getByText('Reason for Amendment *')).toBeInTheDocument();
  });

  it('shows 4 amendment type options in create form', async () => {
    render(
      <AmendmentWorkflow noteId="note-001" noteType="clinical_note" />
    );

    await waitFor(() => {
      expect(screen.getByText('New Amendment')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('New Amendment'));

    await waitFor(() => {
      expect(screen.getByText('Create Amendment')).toBeInTheDocument();
    });

    // The type selection buttons in the form
    expect(screen.getByText('Fix an error in the original note')).toBeInTheDocument();
    expect(screen.getByText('Add additional information discovered after signing')).toBeInTheDocument();
    expect(screen.getByText('Document care provided but not recorded at the time')).toBeInTheDocument();
    expect(screen.getByText('Clarify existing content without changing meaning')).toBeInTheDocument();
  });

  it('shows original content field only when "Correction" type is selected', async () => {
    const user = userEvent.setup();

    render(
      <AmendmentWorkflow noteId="note-001" noteType="clinical_note" />
    );

    await waitFor(() => {
      expect(screen.getByText('New Amendment')).toBeInTheDocument();
    });

    await user.click(screen.getByText('New Amendment'));

    await waitFor(() => {
      expect(screen.getByText('Create Amendment')).toBeInTheDocument();
    });

    // Default type is 'addendum' — original content field should NOT be present
    expect(screen.queryByText('Original Content Being Corrected')).not.toBeInTheDocument();

    // Click the Correction type button (find the button containing "Correction" label)
    const correctionButton = screen.getByText('Fix an error in the original note').closest('button');
    expect(correctionButton).not.toBeNull();
    if (correctionButton) await user.click(correctionButton);

    // Now original content field should appear
    await waitFor(() => {
      expect(screen.getByText('Original Content Being Corrected')).toBeInTheDocument();
    });
  });

  it('disables Submit button when content or reason is empty', async () => {
    const user = userEvent.setup();

    render(
      <AmendmentWorkflow noteId="note-001" noteType="clinical_note" />
    );

    await waitFor(() => {
      expect(screen.getByText('New Amendment')).toBeInTheDocument();
    });

    await user.click(screen.getByText('New Amendment'));

    await waitFor(() => {
      expect(screen.getByText('Submit Amendment')).toBeInTheDocument();
    });

    // Submit button should be disabled initially (both fields empty)
    const submitButton = screen.getByText('Submit Amendment').closest('button');
    expect(submitButton).toBeDisabled();

    // Type content in the amendment content textarea
    const contentTextarea = screen.getByPlaceholderText('Enter the amendment text...');
    await user.type(contentTextarea, 'Test amendment content');

    // Still disabled because reason is empty
    expect(submitButton).toBeDisabled();

    // Type reason
    const reasonTextarea = screen.getByPlaceholderText('Explain why this amendment is necessary...');
    await user.type(reasonTextarea, 'Test amendment reason');

    // Now submit should be enabled
    expect(submitButton).not.toBeDisabled();
  });

  it('shows Approve and Reject buttons for pending amendments when expanded', async () => {
    render(
      <AmendmentWorkflow noteId="note-001" noteType="clinical_note" />
    );

    await waitFor(() => {
      expect(screen.getByText('Correction')).toBeInTheDocument();
    });

    // Click on the pending amendment row to expand it
    // The summary row contains 'Correction' and the pending status
    const correctionLabel = screen.getByText('Correction');
    const summaryRow = correctionLabel.closest('[class*="cursor-pointer"]');
    expect(summaryRow).not.toBeNull();
    if (summaryRow) fireEvent.click(summaryRow);

    // Expanded content should show Approve and Reject buttons
    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument();
    });
    expect(screen.getByText('Reject')).toBeInTheDocument();

    // The original content should show (since it's a correction type)
    expect(screen.getByText('Patient takes 500mg daily')).toBeInTheDocument();
    expect(screen.getByText('Dosage was 250mg not 500mg')).toBeInTheDocument();
    expect(screen.getByText('Transcription error in original note')).toBeInTheDocument();
  });

  it('calls approveAmendment when Approve button is clicked on pending amendment', async () => {
    mockApproveAmendment.mockResolvedValue({ success: true, data: true });

    render(
      <AmendmentWorkflow noteId="note-001" noteType="clinical_note" />
    );

    await waitFor(() => {
      expect(screen.getByText('Correction')).toBeInTheDocument();
    });

    // Expand the pending amendment
    const correctionLabel = screen.getByText('Correction');
    const summaryRow = correctionLabel.closest('[class*="cursor-pointer"]');
    if (summaryRow) fireEvent.click(summaryRow);

    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Approve'));

    await waitFor(() => {
      expect(mockApproveAmendment).toHaveBeenCalledWith(
        'amend-pend-001',
        'user-clinician-alpha'
      );
    });
  });

  it('expanding an approved amendment shows approval info', async () => {
    // Return only the approved amendment so we can click it without ambiguity
    mockGetAmendmentsForNote.mockResolvedValue({ success: true, data: [approvedAmendment] });
    vi.resetModules();
    const mod = await import('../AmendmentWorkflow');
    const Component = mod.AmendmentWorkflow;

    render(
      <Component noteId="note-001" noteType="clinical_note" />
    );

    await waitFor(() => {
      expect(screen.getByText('Addendum')).toBeInTheDocument();
    });

    // Expand the approved amendment
    const addendumLabel = screen.getByText('Addendum');
    const summaryRow = addendumLabel.closest('[class*="cursor-pointer"]');
    if (summaryRow) fireEvent.click(summaryRow);

    // Should show the amendment content and approval info
    await waitFor(() => {
      expect(screen.getByText('Lab results received post-signing confirm diagnosis')).toBeInTheDocument();
    });
    expect(screen.getByText('Late lab results needed documentation')).toBeInTheDocument();
    expect(screen.getByText(/Approved by/)).toBeInTheDocument();
    expect(screen.getByText(/Test Reviewer Gamma/)).toBeInTheDocument();

    // Should NOT show Approve/Reject buttons for already-approved amendment
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
  });

  it('shows error alert and allows dismissal when service fails', async () => {
    mockGetAmendmentsForNote.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'DATABASE_ERROR', message: 'Connection refused' },
    });
    vi.resetModules();
    const mod = await import('../AmendmentWorkflow');
    const Component = mod.AmendmentWorkflow;

    render(
      <Component noteId="note-001" noteType="clinical_note" />
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText('Connection refused')).toBeInTheDocument();

    // Dismiss the alert
    fireEvent.click(screen.getByLabelText('Dismiss'));

    await waitFor(() => {
      expect(screen.queryByText('Connection refused')).not.toBeInTheDocument();
    });
  });
});
