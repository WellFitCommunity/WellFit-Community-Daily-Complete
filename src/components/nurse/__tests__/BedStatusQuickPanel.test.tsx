/**
 * Tests for BedStatusQuickPanel Component
 *
 * Purpose: Nurse-focused component for rapid bed status updates at the bedside
 * Tests: Component exports, rendering, keyboard shortcuts, status updates, accessibility
 *
 * WCAG Compliance: Tests verify 44px+ touch targets for senior-friendly UI
 */

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock BedManagementService
const mockGetBedBoard = vi.fn();
const mockUpdateBedStatus = vi.fn();

vi.mock('../../../services/bedManagementService', () => ({
  BedManagementService: {
    getBedBoard: (options?: { unitId?: string; facilityId?: string }) => mockGetBedBoard(options),
    updateBedStatus: (bedId: string, status: string) => mockUpdateBedStatus(bedId, status),
  },
}));

// Mock providerAffirmations
vi.mock('../../../services/providerAffirmations', () => ({
  getProviderAffirmation: vi.fn(() => 'Great job updating that bed status!'),
}));

// Mock auditLogger
vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    clinical: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock EAAffirmationToast to simplify testing
vi.mock('../../envision-atlus/EAAffirmationToast', () => ({
  EAAffirmationToast: ({ message, onDismiss }: { message: string; onDismiss: () => void }) => (
    <div data-testid="affirmation-toast" onClick={onDismiss}>
      {message}
    </div>
  ),
}));

// Import component after mocking
import { BedStatusQuickPanel } from '../BedStatusQuickPanel';
import type { BedBoardEntry } from '../../../types/bed';

// Mock bed data
const createMockBed = (overrides: Partial<BedBoardEntry> = {}): BedBoardEntry => ({
  bed_id: 'bed-001',
  bed_label: '101A',
  room_number: '101',
  bed_position: 'A',
  bed_type: 'standard',
  status: 'available',
  status_changed_at: new Date().toISOString(),
  has_telemetry: false,
  has_isolation_capability: false,
  has_negative_pressure: false,
  unit_id: 'unit-001',
  unit_code: 'ICU-1',
  unit_name: 'ICU',
  unit_type: 'icu',
  tenant_id: 'tenant-001',
  patient_name: undefined,
  patient_id: undefined,
  ...overrides,
});

const mockBeds: BedBoardEntry[] = [
  createMockBed({ bed_id: 'bed-001', bed_label: '101A', status: 'available' }),
  createMockBed({ bed_id: 'bed-002', bed_label: '102A', status: 'occupied', patient_name: 'John D.' }),
  createMockBed({ bed_id: 'bed-003', bed_label: '103A', status: 'dirty' }),
  createMockBed({ bed_id: 'bed-004', bed_label: '104A', status: 'cleaning' }),
  createMockBed({ bed_id: 'bed-005', bed_label: '105A', status: 'blocked' }),
  createMockBed({ bed_id: 'bed-006', bed_label: '106A', status: 'maintenance' }),
];

describe('BedStatusQuickPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBedBoard.mockResolvedValue({
      success: true,
      data: mockBeds,
    });
    mockUpdateBedStatus.mockResolvedValue({
      success: true,
      data: { bed_id: 'bed-001', status: 'dirty' },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Module Exports', () => {
    it('should export BedStatusQuickPanel component', () => {
      expect(BedStatusQuickPanel).toBeDefined();
      expect(typeof BedStatusQuickPanel).toBe('function');
    });

    it('should be a React functional component', () => {
      expect(BedStatusQuickPanel.name).toBe('BedStatusQuickPanel');
    });
  });

  describe('Component Rendering', () => {
    it('should render loading state initially', async () => {
      render(<BedStatusQuickPanel />);

      expect(screen.getByText('Loading beds...')).toBeInTheDocument();
    });

    it('should render beds after loading', async () => {
      render(<BedStatusQuickPanel />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      // Should show bed labels
      expect(screen.getByText('101A')).toBeInTheDocument();
      expect(screen.getByText('102A')).toBeInTheDocument();
    });

    it('should display Quick Bed Status header', async () => {
      render(<BedStatusQuickPanel />);

      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Quick Bed Status')).toBeInTheDocument();
    });

    it('should show keyboard shortcuts help text', async () => {
      render(<BedStatusQuickPanel />);

      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Shortcuts (select bed first):')).toBeInTheDocument();
      expect(screen.getByText('Ready')).toBeInTheDocument();
      expect(screen.getByText('Dirty')).toBeInTheDocument();
    });

    it('should show swipe gestures help text when enabled', async () => {
      render(<BedStatusQuickPanel enableSwipe={true} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      expect(screen.getByText(/Swipe:/)).toBeInTheDocument();
    });

    it('should not show swipe gestures help text when disabled', async () => {
      render(<BedStatusQuickPanel enableSwipe={false} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      expect(screen.queryByText(/Swipe:/)).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when bed loading fails', async () => {
      mockGetBedBoard.mockResolvedValue({
        success: false,
        error: { message: 'Network error' },
      });

      render(<BedStatusQuickPanel />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Bed Selection', () => {
    it('should select bed when clicked', async () => {
      render(<BedStatusQuickPanel />);

      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      // Click on bed 101A
      const bedCard = screen.getByText('101A').closest('[role="button"]');
      expect(bedCard).toBeTruthy();
      if (bedCard) {
        fireEvent.click(bedCard);
      }

      // Should show quick action buttons for selected bed
      await waitFor(() => {
        expect(screen.getByText('Bed 101A')).toBeInTheDocument();
      });
    });

    it('should deselect bed when clicked again', async () => {
      render(<BedStatusQuickPanel />);

      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      // Click on bed 101A twice
      const bedCard = screen.getByText('101A').closest('[role="button"]');
      if (bedCard) {
        fireEvent.click(bedCard);
        fireEvent.click(bedCard);
      }

      // Quick action bar should disappear
      await waitFor(() => {
        expect(screen.queryByText('Bed 101A')).not.toBeInTheDocument();
      });
    });

    it('should be keyboard accessible', async () => {
      render(<BedStatusQuickPanel />);

      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      // Should be focusable and activatable with keyboard
      const bedCard = screen.getByText('101A').closest('[role="button"]');
      expect(bedCard).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Status Updates', () => {
    it('should update bed status when action button clicked', async () => {
      const onStatusChange = vi.fn();
      render(<BedStatusQuickPanel onStatusChange={onStatusChange} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      // Select bed
      const bedCard = screen.getByText('101A').closest('[role="button"]');
      if (bedCard) {
        fireEvent.click(bedCard);
      }

      await waitFor(() => {
        expect(screen.getByText('Bed 101A')).toBeInTheDocument();
      });

      // Click Dirty button
      const dirtyButton = screen.getByRole('button', { name: /Dirty/i });
      fireEvent.click(dirtyButton);

      await waitFor(() => {
        expect(mockUpdateBedStatus).toHaveBeenCalledWith('bed-001', 'dirty');
      });
    });

    it('should show affirmation toast after successful update', async () => {
      render(<BedStatusQuickPanel />);

      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      // Select bed and update status
      const bedCard = screen.getByText('101A').closest('[role="button"]');
      if (bedCard) {
        fireEvent.click(bedCard);
      }

      await waitFor(() => {
        expect(screen.getByText('Bed 101A')).toBeInTheDocument();
      });

      const dirtyButton = screen.getByRole('button', { name: /Dirty/i });
      fireEvent.click(dirtyButton);

      await waitFor(() => {
        expect(screen.getByTestId('affirmation-toast')).toBeInTheDocument();
      });
    });

    it('should call onStatusChange callback after update', async () => {
      const onStatusChange = vi.fn();
      render(<BedStatusQuickPanel onStatusChange={onStatusChange} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      // Select bed and update status
      const bedCard = screen.getByText('101A').closest('[role="button"]');
      if (bedCard) {
        fireEvent.click(bedCard);
      }

      await waitFor(() => {
        expect(screen.getByText('Bed 101A')).toBeInTheDocument();
      });

      const dirtyButton = screen.getByRole('button', { name: /Dirty/i });
      fireEvent.click(dirtyButton);

      await waitFor(() => {
        expect(onStatusChange).toHaveBeenCalledWith('bed-001', 'dirty');
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should update status when Shift+R pressed with bed selected', async () => {
      render(<BedStatusQuickPanel />);

      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      // Select bed 103A (dirty)
      const bedCard = screen.getByText('103A').closest('[role="button"]');
      if (bedCard) {
        fireEvent.click(bedCard);
      }

      await waitFor(() => {
        expect(screen.getByText('Bed 103A')).toBeInTheDocument();
      });

      // Press Shift+R
      fireEvent.keyDown(window, { key: 'R', shiftKey: true });

      await waitFor(() => {
        expect(mockUpdateBedStatus).toHaveBeenCalledWith('bed-003', 'available');
      });
    });

    it('should update status when Shift+D pressed with bed selected', async () => {
      render(<BedStatusQuickPanel />);

      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      // Select bed
      const bedCard = screen.getByText('101A').closest('[role="button"]');
      if (bedCard) {
        fireEvent.click(bedCard);
      }

      await waitFor(() => {
        expect(screen.getByText('Bed 101A')).toBeInTheDocument();
      });

      // Press Shift+D
      fireEvent.keyDown(window, { key: 'D', shiftKey: true });

      await waitFor(() => {
        expect(mockUpdateBedStatus).toHaveBeenCalledWith('bed-001', 'dirty');
      });
    });

    it('should update status when Shift+B pressed with bed selected', async () => {
      render(<BedStatusQuickPanel />);

      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      // Select bed
      const bedCard = screen.getByText('101A').closest('[role="button"]');
      if (bedCard) {
        fireEvent.click(bedCard);
      }

      await waitFor(() => {
        expect(screen.getByText('Bed 101A')).toBeInTheDocument();
      });

      // Press Shift+B
      fireEvent.keyDown(window, { key: 'B', shiftKey: true });

      await waitFor(() => {
        expect(mockUpdateBedStatus).toHaveBeenCalledWith('bed-001', 'blocked');
      });
    });

    it('should not trigger shortcut without Shift key', async () => {
      render(<BedStatusQuickPanel />);

      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      // Select bed
      const bedCard = screen.getByText('101A').closest('[role="button"]');
      if (bedCard) {
        fireEvent.click(bedCard);
      }

      await waitFor(() => {
        expect(screen.getByText('Bed 101A')).toBeInTheDocument();
      });

      // Press R without Shift
      fireEvent.keyDown(window, { key: 'R' });

      // Should not update
      expect(mockUpdateBedStatus).not.toHaveBeenCalled();
    });

    it('should not trigger shortcut without bed selected', async () => {
      render(<BedStatusQuickPanel />);

      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      // Press Shift+R without selecting a bed
      fireEvent.keyDown(window, { key: 'R', shiftKey: true });

      // Should not update
      expect(mockUpdateBedStatus).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have aria-labels on bed cards', async () => {
      render(<BedStatusQuickPanel />);

      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      const bedCard = screen.getByText('101A').closest('[role="button"]');
      expect(bedCard).toHaveAttribute('aria-label', 'Bed 101A, status: Available');
    });

    it('should have accessible refresh button', async () => {
      render(<BedStatusQuickPanel />);

      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      expect(screen.getByLabelText('Refresh beds')).toBeInTheDocument();
    });

    it('should have accessible voice button when enabled', async () => {
      render(<BedStatusQuickPanel enableVoice={true} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      expect(screen.getByLabelText('Start voice')).toBeInTheDocument();
    });

    it('should have 44px minimum touch targets for buttons', async () => {
      render(<BedStatusQuickPanel />);

      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      const refreshButton = screen.getByLabelText('Refresh beds');
      expect(refreshButton.className).toContain('min-w-[44px]');
      expect(refreshButton.className).toContain('min-h-[44px]');
    });
  });

  describe('Pagination', () => {
    it('should paginate beds when more than bedsPerPage', async () => {
      // Create more beds than fit on one page
      const manyBeds = Array.from({ length: 20 }, (_, i) =>
        createMockBed({ bed_id: `bed-${i}`, bed_label: `${100 + i}A` })
      );
      mockGetBedBoard.mockResolvedValue({
        success: true,
        data: manyBeds,
      });

      render(<BedStatusQuickPanel />);

      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      // Should show pagination
      expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
    });
  });

  describe('Refresh', () => {
    it('should refresh beds when refresh button clicked', async () => {
      render(<BedStatusQuickPanel />);

      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      // Click refresh
      const refreshButton = screen.getByLabelText('Refresh beds');
      fireEvent.click(refreshButton);

      // Should call getBedBoard again
      await waitFor(() => {
        expect(mockGetBedBoard).toHaveBeenCalledTimes(2);
      });
    });

    it('should set up auto-refresh interval', async () => {
      // Use fake timers for this specific test
      vi.useFakeTimers({ shouldAdvanceTime: true });

      render(<BedStatusQuickPanel />);

      // Wait for initial load to complete
      await vi.waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      // Initial load
      expect(mockGetBedBoard).toHaveBeenCalledTimes(1);

      // Advance time by 30 seconds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000);
      });

      // Should auto-refresh
      expect(mockGetBedBoard).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe('Compact Mode', () => {
    it('should render in compact mode with fewer beds per page', async () => {
      const manyBeds = Array.from({ length: 12 }, (_, i) =>
        createMockBed({ bed_id: `bed-${i}`, bed_label: `${100 + i}A` })
      );
      mockGetBedBoard.mockResolvedValue({
        success: true,
        data: manyBeds,
      });

      render(<BedStatusQuickPanel compact={true} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      // In compact mode, 6 beds per page, so 12 beds = 2 pages
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });
  });

  describe('Unit Filtering', () => {
    it('should pass unitId to getBedBoard', async () => {
      render(<BedStatusQuickPanel unitId="unit-icu" />);

      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      // Should have been called with the unitId option
      expect(mockGetBedBoard).toHaveBeenCalledWith({ unitId: 'unit-icu' });
    });

    it('should call getBedBoard without options when no unitId provided', async () => {
      render(<BedStatusQuickPanel />);

      await waitFor(() => {
        expect(screen.queryByText('Loading beds...')).not.toBeInTheDocument();
      });

      // Should have been called without arguments or with undefined
      expect(mockGetBedBoard).toHaveBeenCalled();
    });
  });
});
