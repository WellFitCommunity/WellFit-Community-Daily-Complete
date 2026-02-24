/**
 * NoteLockingControls Test Suite
 *
 * Tests lock status display, lock confirmation workflow, amendment count,
 * compact mode rendering, and error handling for clinical note locking UI.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Service mocks — declared before vi.mock so hoisting works
const mockGetLockDetails = vi.fn();
const mockLockNote = vi.fn();
const mockGetAmendmentsForNote = vi.fn();
const mockGetUser = vi.fn();

vi.mock('../../../services/noteLockingService', () => ({
  noteLockingService: {
    getLockDetails: (...args: unknown[]) => mockGetLockDetails(...args),
    lockNote: (...args: unknown[]) => mockLockNote(...args),
  },
}));

vi.mock('../../../services/noteAmendmentService', () => ({
  noteAmendmentService: {
    getAmendmentsForNote: (...args: unknown[]) => mockGetAmendmentsForNote(...args),
  },
}));

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

// Mock EA design system components — render children with appropriate roles/structure
vi.mock('../../envision-atlus', () => ({
  EACard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="ea-card" className={className}>{children}</div>
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

// Mock lucide-react icons as simple labeled spans
vi.mock('lucide-react', () => ({
  Lock: ({ className }: { className?: string }) => <span data-testid="lock-icon" className={className}>Lock</span>,
  Unlock: ({ className }: { className?: string }) => <span data-testid="unlock-icon" className={className}>Unlock</span>,
  AlertTriangle: () => <span data-testid="alert-triangle-icon">AlertTriangle</span>,
  CheckCircle: () => <span data-testid="check-circle-icon">CheckCircle</span>,
  Clock: () => <span data-testid="clock-icon">Clock</span>,
  Shield: () => <span data-testid="shield-icon">Shield</span>,
  History: () => <span data-testid="history-icon">History</span>,
  FileText: () => <span data-testid="file-text-icon">FileText</span>,
  RefreshCw: ({ className }: { className?: string }) => <span data-testid="refresh-icon" className={className}>RefreshCw</span>,
}));

// -- Test data using synthetic/fake names per CLAUDE.md PHI rules --

const lockedDetails = {
  is_locked: true,
  locked_at: '2026-01-15T10:00:00Z',
  locked_by: 'user-clinician-alpha',
  locked_by_name: 'Test Clinician Alpha',
  signature_hash: 'abc123def456',
  version: 3,
};

const unlockedDetails = {
  is_locked: false,
  locked_at: null,
  locked_by: null,
  locked_by_name: undefined,
  signature_hash: null,
  version: 1,
};

const sampleAmendments = [
  { id: 'amend-1', amendment_type: 'correction', status: 'pending' },
  { id: 'amend-2', amendment_type: 'addendum', status: 'approved' },
  { id: 'amend-3', amendment_type: 'late_entry', status: 'approved' },
];

describe('NoteLockingControls', () => {
  let NoteLockingControls: React.FC<{
    noteId: string;
    noteType: 'clinical_note' | 'ai_progress_note';
    onLockChange?: (isLocked: boolean) => void;
    showAmendmentHistory?: boolean;
    compact?: boolean;
  }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    mockGetLockDetails.mockResolvedValue({ success: true, data: unlockedDetails });
    mockGetAmendmentsForNote.mockResolvedValue({ success: true, data: [] });
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-clinician-alpha' } } });

    const mod = await import('../NoteLockingControls');
    NoteLockingControls = mod.NoteLockingControls;
  });

  it('shows loading state while lock details are being fetched', async () => {
    // Make getLockDetails never resolve so we stay in loading state
    mockGetLockDetails.mockImplementation(() => new Promise(() => {}));

    render(
      <NoteLockingControls noteId="note-001" noteType="clinical_note" />
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('displays "Note Locked" with lock details when note is locked', async () => {
    mockGetLockDetails.mockResolvedValue({ success: true, data: lockedDetails });
    mockGetAmendmentsForNote.mockResolvedValue({ success: true, data: sampleAmendments });

    render(
      <NoteLockingControls noteId="note-001" noteType="clinical_note" />
    );

    await waitFor(() => {
      expect(screen.getByText('Note Locked')).toBeInTheDocument();
    });
    expect(screen.getByText(/Test Clinician Alpha/)).toBeInTheDocument();
    // Lock button should NOT be present when note is already locked
    expect(screen.queryByText('Lock Note')).not.toBeInTheDocument();
  });

  it('displays "Note Unlocked" with lock button when note is not locked', async () => {
    render(
      <NoteLockingControls noteId="note-001" noteType="clinical_note" />
    );

    await waitFor(() => {
      expect(screen.getByText('Note Unlocked')).toBeInTheDocument();
    });
    expect(screen.getByText('Lock Note')).toBeInTheDocument();
    expect(screen.getByText(/prevent modifications/)).toBeInTheDocument();
  });

  it('shows "Digitally signed" when signature_hash is present on locked note', async () => {
    mockGetLockDetails.mockResolvedValue({ success: true, data: lockedDetails });

    render(
      <NoteLockingControls noteId="note-001" noteType="clinical_note" />
    );

    await waitFor(() => {
      expect(screen.getByText('Digitally signed')).toBeInTheDocument();
    });
    expect(screen.getByTestId('shield-icon')).toBeInTheDocument();
  });

  it('shows confirmation dialog when "Lock Note" is clicked', async () => {
    render(
      <NoteLockingControls noteId="note-001" noteType="clinical_note" />
    );

    await waitFor(() => {
      expect(screen.getByText('Lock Note')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Lock Note'));

    await waitFor(() => {
      // "Confirm Lock" appears as both heading and button text — use getAllByText
      const confirmElements = screen.getAllByText('Confirm Lock');
      expect(confirmElements.length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText(/Once locked, this note cannot be directly edited/)).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls lockNote service and triggers onLockChange when "Confirm Lock" is clicked', async () => {
    const onLockChangeMock = vi.fn();
    mockLockNote.mockResolvedValue({
      success: true,
      data: { success: true, locked_at: '2026-01-15T12:00:00Z', locked_by: 'user-clinician-alpha' },
    });
    // After locking, the refetch returns locked state
    mockGetLockDetails
      .mockResolvedValueOnce({ success: true, data: unlockedDetails })
      .mockResolvedValueOnce({ success: true, data: lockedDetails });

    render(
      <NoteLockingControls
        noteId="note-001"
        noteType="clinical_note"
        onLockChange={onLockChangeMock}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Lock Note')).toBeInTheDocument();
    });

    // Open confirmation
    fireEvent.click(screen.getByText('Lock Note'));
    await waitFor(() => {
      // "Confirm Lock" appears as heading and button — find the button variant
      const confirmElements = screen.getAllByText('Confirm Lock');
      expect(confirmElements.length).toBeGreaterThanOrEqual(1);
    });

    // Click the Confirm Lock button (the one inside a <button> element)
    const confirmButtons = screen.getAllByText('Confirm Lock');
    const confirmButton = confirmButtons.find(el => el.closest('button'));
    expect(confirmButton).toBeDefined();
    if (confirmButton) fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockLockNote).toHaveBeenCalledWith(
        'note-001',
        'clinical_note',
        'user-clinician-alpha',
        { generateSignature: true }
      );
    });

    await waitFor(() => {
      expect(onLockChangeMock).toHaveBeenCalledWith(true);
    });
  });

  it('shows amendment count in the Amendments button', async () => {
    mockGetLockDetails.mockResolvedValue({ success: true, data: unlockedDetails });
    mockGetAmendmentsForNote.mockResolvedValue({ success: true, data: sampleAmendments });

    render(
      <NoteLockingControls
        noteId="note-001"
        noteType="clinical_note"
        showAmendmentHistory={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Amendments \(3\)/)).toBeInTheDocument();
    });
  });

  it('renders compact mode with "Locked" badge when note is locked', async () => {
    mockGetLockDetails.mockResolvedValue({ success: true, data: lockedDetails });

    render(
      <NoteLockingControls
        noteId="note-001"
        noteType="clinical_note"
        compact={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Locked')).toBeInTheDocument();
    });
    // Full mode UI elements should not be present
    expect(screen.queryByText('Note Locked')).not.toBeInTheDocument();
    expect(screen.queryByText('Lock Note')).not.toBeInTheDocument();
  });

  it('renders compact mode with "Lock" button when note is unlocked', async () => {
    render(
      <NoteLockingControls
        noteId="note-001"
        noteType="clinical_note"
        compact={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Lock')).toBeInTheDocument();
    });
    expect(screen.queryByText('Locked')).not.toBeInTheDocument();
  });

  it('shows version info at the bottom of the card in full mode', async () => {
    mockGetLockDetails.mockResolvedValue({ success: true, data: lockedDetails });

    render(
      <NoteLockingControls noteId="note-001" noteType="clinical_note" />
    );

    await waitFor(() => {
      expect(screen.getByText('Version 3')).toBeInTheDocument();
    });
    expect(screen.getByText('Amendments only')).toBeInTheDocument();
  });
});
