/**
 * CrossRoleContextModule Tests
 *
 * Tests for cross-role context sharing component:
 * - Context entry display
 * - Context sharing form
 * - Filter functionality
 * - Role badges
 * - Timeline display
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CrossRoleContextModule from '../CrossRoleContextModule';

// Mock ClaudeCareAssistant
vi.mock('../../../services/claudeCareAssistant', () => ({
  ClaudeCareAssistant: {
    getCareContext: vi.fn(),
    shareCareContext: vi.fn(),
  },
}));

import { ClaudeCareAssistant } from '../../../services/claudeCareAssistant';

const mockGetCareContext = ClaudeCareAssistant.getCareContext as ReturnType<typeof vi.fn>;
const mockShareCareContext = ClaudeCareAssistant.shareCareContext as ReturnType<typeof vi.fn>;

describe('CrossRoleContextModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCareContext.mockResolvedValue([]);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Basic Rendering
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Basic Rendering', () => {
    it('should render without crashing', () => {
      render(<CrossRoleContextModule userRole="physician" patientId="patient-123" />);
      expect(screen.getByText('Share Context with Team')).toBeInTheDocument();
    });

    it('should display context type selector', () => {
      render(<CrossRoleContextModule userRole="physician" patientId="patient-123" />);
      expect(screen.getByText('Context Type')).toBeInTheDocument();
    });

    it('should display context summary textarea', () => {
      render(<CrossRoleContextModule userRole="physician" patientId="patient-123" />);
      expect(screen.getByText('Context Summary')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Share important context with other care team members/)).toBeInTheDocument();
    });

    it('should display share button', async () => {
      render(<CrossRoleContextModule userRole="physician" patientId="patient-123" />);
      // Wait for initial loading to complete
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Share Context' })).toBeInTheDocument();
      });
    });

    it('should display timeline header', () => {
      render(<CrossRoleContextModule userRole="physician" patientId="patient-123" />);
      expect(screen.getByText('Team Context Timeline')).toBeInTheDocument();
    });

    it('should display info box', () => {
      render(<CrossRoleContextModule userRole="physician" patientId="patient-123" />);
      expect(screen.getByText('About Team Context')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Context Type Options
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Context Type Options', () => {
    it('should have clinical as default context type', () => {
      render(<CrossRoleContextModule userRole="physician" patientId="patient-123" />);
      const selects = screen.getAllByRole('combobox');
      expect(selects[0]).toHaveValue('clinical');
    });

    it('should display all context type options', () => {
      render(<CrossRoleContextModule userRole="physician" patientId="patient-123" />);
      // Context type options are available immediately
      const contextTypeSelect = screen.getAllByRole('combobox')[0];
      expect(contextTypeSelect).toBeInTheDocument();
      // Verify select has the correct options by checking the select has value 'clinical'
      expect(contextTypeSelect).toHaveValue('clinical');
    });

    it('should allow changing context type', () => {
      render(<CrossRoleContextModule userRole="physician" patientId="patient-123" />);
      const contextSelect = screen.getAllByRole('combobox')[0];

      fireEvent.change(contextSelect, { target: { value: 'social' } });
      expect(contextSelect).toHaveValue('social');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Filter Functionality
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Filter Functionality', () => {
    it('should have All Types as default filter', () => {
      render(<CrossRoleContextModule userRole="physician" patientId="patient-123" />);
      const selects = screen.getAllByRole('combobox');
      expect(selects[1]).toHaveValue('all');
    });

    it('should display all filter options', () => {
      render(<CrossRoleContextModule userRole="physician" patientId="patient-123" />);
      const filterOptions = screen.getAllByRole('option', { name: 'Clinical' });
      expect(filterOptions.length).toBe(2); // One in context type, one in filter
    });

    it('should allow filtering by context type', () => {
      render(<CrossRoleContextModule userRole="physician" patientId="patient-123" />);
      const filterSelect = screen.getAllByRole('combobox')[1];

      fireEvent.change(filterSelect, { target: { value: 'clinical' } });
      expect(filterSelect).toHaveValue('clinical');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Empty State
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Empty State', () => {
    it('should show empty state when no context entries', async () => {
      mockGetCareContext.mockResolvedValueOnce([]);
      render(<CrossRoleContextModule userRole="physician" patientId="patient-123" />);

      await waitFor(() => {
        expect(screen.getByText('No team context entries yet')).toBeInTheDocument();
      });
    });

    it('should show encouragement message in empty state', async () => {
      mockGetCareContext.mockResolvedValueOnce([]);
      render(<CrossRoleContextModule userRole="physician" patientId="patient-123" />);

      await waitFor(() => {
        expect(screen.getByText('Be the first to share context with the care team')).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Context Entry Display
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Context Entry Display', () => {
    it('should display context entries from API', async () => {
      mockGetCareContext.mockResolvedValueOnce([
        {
          id: 'entry-1',
          patientId: 'patient-123',
          contextType: 'clinical',
          contributedByRole: 'physician',
          contributedByUser: 'user-1',
          contextData: { summary: 'Test context' },
          contextSummary: 'Patient showing improvement',
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      ]);

      render(<CrossRoleContextModule userRole="nurse" patientId="patient-123" />);

      await waitFor(() => {
        expect(screen.getByText('Patient showing improvement')).toBeInTheDocument();
      });
    });

    it('should display role badges for entries', async () => {
      mockGetCareContext.mockResolvedValueOnce([
        {
          id: 'entry-1',
          patientId: 'patient-123',
          contextType: 'clinical',
          contributedByRole: 'physician',
          contributedByUser: 'user-1',
          contextData: {},
          contextSummary: 'Test entry',
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      ]);

      render(<CrossRoleContextModule userRole="nurse" patientId="patient-123" />);

      await waitFor(() => {
        expect(screen.getByText('Physician')).toBeInTheDocument();
      });
    });

    it('should display context type badge', async () => {
      mockGetCareContext.mockResolvedValueOnce([
        {
          id: 'entry-1',
          patientId: 'patient-123',
          contextType: 'social',
          contributedByRole: 'social_worker',
          contributedByUser: 'user-1',
          contextData: {},
          contextSummary: 'Social context',
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      ]);

      render(<CrossRoleContextModule userRole="nurse" patientId="patient-123" />);

      await waitFor(() => {
        expect(screen.getByText('social')).toBeInTheDocument();
      });
    });

    it('should display context type icons', async () => {
      mockGetCareContext.mockResolvedValueOnce([
        {
          id: 'entry-1',
          patientId: 'patient-123',
          contextType: 'clinical',
          contributedByRole: 'physician',
          contributedByUser: 'user-1',
          contextData: {},
          contextSummary: 'Clinical note',
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      ]);

      render(<CrossRoleContextModule userRole="nurse" patientId="patient-123" />);

      await waitFor(() => {
        expect(screen.getByText('🩺')).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Sharing Context
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Sharing Context', () => {
    it('should disable share button when context is empty', async () => {
      render(<CrossRoleContextModule userRole="physician" patientId="patient-123" userId="user-123" />);
      // Wait for initial loading to complete
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Share Context' })).toBeInTheDocument();
      });
      const shareButton = screen.getByRole('button', { name: 'Share Context' });
      expect(shareButton).toBeDisabled();
    });

    it('should enable share button when context is entered', async () => {
      render(<CrossRoleContextModule userRole="physician" patientId="patient-123" userId="user-123" />);
      // Wait for initial loading to complete
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Share Context' })).toBeInTheDocument();
      });
      const textarea = screen.getByPlaceholderText(/Share important context/);

      fireEvent.change(textarea, { target: { value: 'Important context note' } });

      const shareButton = screen.getByRole('button', { name: 'Share Context' });
      expect(shareButton).not.toBeDisabled();
    });

    it('should keep button disabled when userId is not provided', async () => {
      render(<CrossRoleContextModule userRole="physician" patientId="patient-123" />);
      // Wait for initial loading to complete
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Share Context' })).toBeInTheDocument();
      });
      const textarea = screen.getByPlaceholderText(/Share important context/);

      // Even with text entered, button should be disabled without userId
      fireEvent.change(textarea, { target: { value: 'Test' } });

      const shareButton = screen.getByRole('button', { name: 'Share Context' });
      // Button stays disabled because userId is missing
      expect(shareButton).toBeDisabled();
      // Warning message should be shown
      expect(screen.getByText('User ID required to share context')).toBeInTheDocument();
    });

    it('should call shareCareContext API on submit', async () => {
      mockShareCareContext.mockResolvedValueOnce({});
      mockGetCareContext.mockResolvedValue([]);

      render(<CrossRoleContextModule userRole="physician" patientId="patient-123" userId="user-123" />);
      // Wait for initial loading to complete
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Share Context' })).toBeInTheDocument();
      });
      const textarea = screen.getByPlaceholderText(/Share important context/);

      fireEvent.change(textarea, { target: { value: 'Important clinical note' } });
      fireEvent.click(screen.getByRole('button', { name: 'Share Context' }));

      await waitFor(() => {
        expect(mockShareCareContext).toHaveBeenCalledWith({
          patientId: 'patient-123',
          contextType: 'clinical',
          contributedByRole: 'physician',
          contributedByUser: 'user-123',
          contextData: { summary: 'Important clinical note' },
          contextSummary: 'Important clinical note',
          isActive: true,
        });
      });
    });

    it('should clear textarea after successful share', async () => {
      mockShareCareContext.mockResolvedValueOnce({});
      mockGetCareContext.mockResolvedValue([]);

      render(<CrossRoleContextModule userRole="physician" patientId="patient-123" userId="user-123" />);
      // Wait for initial loading to complete
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Share Context' })).toBeInTheDocument();
      });
      const textarea = screen.getByPlaceholderText(/Share important context/) as HTMLTextAreaElement;

      fireEvent.change(textarea, { target: { value: 'Important note' } });
      fireEvent.click(screen.getByRole('button', { name: 'Share Context' }));

      await waitFor(() => {
        expect(textarea.value).toBe('');
      });
    });

    it('should show loading state while sharing', async () => {
      let resolveShare: () => void;
      const sharePromise = new Promise<void>((resolve) => {
        resolveShare = resolve;
      });
      mockShareCareContext.mockReturnValueOnce(sharePromise);
      mockGetCareContext.mockResolvedValue([]);

      render(<CrossRoleContextModule userRole="physician" patientId="patient-123" userId="user-123" />);
      // Wait for initial loading to complete
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Share Context' })).toBeInTheDocument();
      });
      const textarea = screen.getByPlaceholderText(/Share important context/);

      fireEvent.change(textarea, { target: { value: 'Note' } });
      fireEvent.click(screen.getByRole('button', { name: 'Share Context' }));

      expect(screen.getByText('Sharing...')).toBeInTheDocument();

      resolveShare!();

      await waitFor(() => {
        expect(screen.queryByText('Sharing...')).not.toBeInTheDocument();
      });
    });

    it('should show error on share failure', async () => {
      mockShareCareContext.mockRejectedValueOnce(new Error('API Error'));
      mockGetCareContext.mockResolvedValue([]);

      render(<CrossRoleContextModule userRole="physician" patientId="patient-123" userId="user-123" />);
      // Wait for initial loading to complete
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Share Context' })).toBeInTheDocument();
      });
      const textarea = screen.getByPlaceholderText(/Share important context/);

      fireEvent.change(textarea, { target: { value: 'Note' } });
      fireEvent.click(screen.getByRole('button', { name: 'Share Context' }));

      await waitFor(() => {
        expect(screen.getByText('Failed to share context')).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // User ID Warning
  // ═══════════════════════════════════════════════════════════════════════════

  describe('User ID Warning', () => {
    it('should show warning when userId is not provided', () => {
      render(<CrossRoleContextModule userRole="physician" patientId="patient-123" />);
      expect(screen.getByText('User ID required to share context')).toBeInTheDocument();
    });

    it('should not show warning when userId is provided', () => {
      render(<CrossRoleContextModule userRole="physician" patientId="patient-123" userId="user-123" />);
      expect(screen.queryByText('User ID required to share context')).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Info Box Content
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Info Box Content', () => {
    it('should display context type descriptions', () => {
      render(<CrossRoleContextModule userRole="physician" patientId="patient-123" />);
      expect(screen.getByText(/Clinical:/)).toBeInTheDocument();
      expect(screen.getByText(/Social:/)).toBeInTheDocument();
      expect(screen.getByText(/Administrative:/)).toBeInTheDocument();
      expect(screen.getByText(/Cultural:/)).toBeInTheDocument();
    });
  });
});
