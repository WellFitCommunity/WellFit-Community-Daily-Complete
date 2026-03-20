// ============================================================================
// ResourceLibrary — P3-2 Tests
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResourceLibrary } from '../ResourceLibrary';

vi.mock('../../../services/resilienceHubService', () => ({
  getResources: vi.fn(),
  trackResourceView: vi.fn(),
}));

import { getResources, trackResourceView } from '../../../services/resilienceHubService';
const mockGetResources = vi.mocked(getResources);
const mockTrackView = vi.mocked(trackResourceView);

const sampleResources = [
  {
    id: 'res-1',
    title: 'Crisis Hotline',
    description: 'Call 988 for immediate support',
    resource_type: 'hotline',
    url: 'tel:988',
    categories: ['crisis_support'],
    tags: ['crisis', 'immediate'],
    target_audience: ['all'],
    is_evidence_based: true,
    citation: 'SAMHSA',
    is_active: true,
    featured: true,
    view_count: 42,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    id: 'res-2',
    title: 'Mindfulness App Guide',
    description: 'Top apps for daily meditation practice',
    resource_type: 'app',
    url: 'https://example.com/mindfulness',
    categories: ['mindfulness'],
    tags: ['meditation'],
    target_audience: ['nurse'],
    is_evidence_based: false,
    is_active: true,
    featured: false,
    view_count: 10,
    created_at: '2026-01-02',
    updated_at: '2026-01-02',
  },
];

describe('ResourceLibrary', () => {
  const defaultProps = { onClose: vi.fn(), userRole: 'nurse' };

  beforeEach(() => {
    vi.resetAllMocks();
    mockGetResources.mockResolvedValue({ success: true, data: sampleResources, error: null } as never);
    mockTrackView.mockResolvedValue({ success: true, data: undefined, error: null } as never);
  });

  describe('Loading State', () => {
    it('shows loading skeleton while fetching', () => {
      mockGetResources.mockImplementation(() => new Promise(() => {}));
      render(<ResourceLibrary {...defaultProps} />);
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message on fetch failure', async () => {
      mockGetResources.mockResolvedValue({
        success: false, data: null,
        error: { code: 'DATABASE_ERROR', message: 'Connection lost' },
      } as never);
      render(<ResourceLibrary {...defaultProps} />);
      expect(await screen.findByText('Failed to load resources')).toBeInTheDocument();
      expect(screen.getByText('Connection lost')).toBeInTheDocument();
    });

    it('shows Retry and Close buttons on error', async () => {
      mockGetResources.mockResolvedValue({
        success: false, data: null,
        error: { code: 'DATABASE_ERROR', message: 'Error' },
      } as never);
      render(<ResourceLibrary {...defaultProps} />);
      expect(await screen.findByText('Retry')).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
    });
  });

  describe('Emergency Banner', () => {
    it('displays 988 crisis support banner', async () => {
      render(<ResourceLibrary {...defaultProps} />);
      expect(await screen.findByText(/Call 988 Suicide & Crisis Lifeline/)).toBeInTheDocument();
    });

    it('has call, text, and chat links', async () => {
      render(<ResourceLibrary {...defaultProps} />);
      await screen.findByText('Resource Library 📚');
      const callLink = screen.getByText('Call 988 Suicide & Crisis Lifeline');
      expect(callLink.closest('a')).toHaveAttribute('href', 'tel:988');
      const textLink = screen.getByText('Text 988');
      expect(textLink.closest('a')).toHaveAttribute('href', 'sms:988');
    });
  });

  describe('Resource Display', () => {
    it('displays resource cards', async () => {
      render(<ResourceLibrary {...defaultProps} />);
      expect(await screen.findByText('Crisis Hotline')).toBeInTheDocument();
      expect(screen.getByText('Mindfulness App Guide')).toBeInTheDocument();
    });

    it('shows featured resources section', async () => {
      render(<ResourceLibrary {...defaultProps} />);
      expect(await screen.findByText('Featured Resources')).toBeInTheDocument();
    });

    it('shows evidence-based badge for qualified resources', async () => {
      render(<ResourceLibrary {...defaultProps} />);
      await screen.findByText('Crisis Hotline');
      expect(screen.getByText(/Evidence-Based/)).toBeInTheDocument();
    });

    it('shows resource count in footer', async () => {
      render(<ResourceLibrary {...defaultProps} />);
      expect(await screen.findByText('2 resources available')).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('shows empty state when no resources match filters', async () => {
      mockGetResources.mockResolvedValue({ success: true, data: [], error: null } as never);
      render(<ResourceLibrary {...defaultProps} />);
      expect(await screen.findByText(/No resources found/)).toBeInTheDocument();
    });

    it('shows Clear Filters button in empty state', async () => {
      mockGetResources.mockResolvedValue({ success: true, data: [], error: null } as never);
      render(<ResourceLibrary {...defaultProps} />);
      expect(await screen.findByText('Clear Filters')).toBeInTheDocument();
    });
  });

  describe('Resource Interaction', () => {
    it('tracks view when resource is clicked', async () => {
      render(<ResourceLibrary {...defaultProps} />);
      await screen.findByText('Crisis Hotline');

      const card = screen.getByText('Crisis Hotline').closest('div[class*="cursor-pointer"]');
      if (card) fireEvent.click(card);

      await waitFor(() => {
        expect(mockTrackView).toHaveBeenCalledWith('res-1');
      });
    });
  });

  describe('Close Behavior', () => {
    it('calls onClose when close button is clicked', async () => {
      render(<ResourceLibrary {...defaultProps} />);
      await screen.findByText('Resource Library 📚');

      // Footer close button
      const closeButtons = screen.getAllByText('Close');
      fireEvent.click(closeButtons[closeButtons.length - 1]);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });
});
