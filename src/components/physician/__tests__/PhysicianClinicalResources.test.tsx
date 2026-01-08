/**
 * Tests for PhysicianClinicalResources Component
 *
 * Purpose: Clinical resources library with search and category filtering
 * Tests: Loading, search, categories, resource display, error handling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhysicianClinicalResources from '../PhysicianClinicalResources';
import type { ResilienceResource } from '../../../types/nurseos';

// Mock ResilienceHubService
const mockGetResources = vi.fn();
const mockTrackResourceView = vi.fn();

vi.mock('../../../services/resilienceHubService', () => ({
  ResilienceHubService: {
    getResources: () => mockGetResources(),
    trackResourceView: (resourceId: string) => mockTrackResourceView(resourceId),
  },
}));

const sampleResources: ResilienceResource[] = [
  {
    id: 'resource-1',
    title: 'Emergency Protocol: Code Blue',
    description: 'Step-by-step guide for cardiac arrest response',
    url: 'https://example.com/code-blue',
    categories: ['emergency_protocols'],
    target_audience: ['physician', 'nurse'],
    is_evidence_based: true,
    tags: ['emergency', 'cardiac', 'code-blue'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'resource-2',
    title: 'Clinical Guideline: Diabetes Management',
    description: 'ADA guidelines for type 2 diabetes',
    url: 'https://example.com/diabetes',
    categories: ['clinical_guidelines'],
    target_audience: ['physician', 'all_providers'],
    is_evidence_based: true,
    tags: ['diabetes', 'endocrine', 'chronic'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'resource-3',
    title: 'Formulary: Antibiotic Guide',
    description: 'Hospital formulary for antibiotic selection',
    url: 'https://example.com/antibiotics',
    categories: ['formulary'],
    target_audience: ['physician'],
    is_evidence_based: false,
    tags: ['antibiotics', 'infectious', 'formulary'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'resource-4',
    title: 'Specialist Directory',
    description: 'Contact list for hospital specialists',
    url: undefined,
    categories: ['specialist_directory'],
    target_audience: ['all_providers'],
    is_evidence_based: false,
    tags: ['directory', 'specialists', 'contacts'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

describe('PhysicianClinicalResources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetResources.mockResolvedValue(sampleResources);
    mockTrackResourceView.mockResolvedValue(undefined);
  });

  describe('Loading State', () => {
    it('should show loading spinner initially', () => {
      mockGetResources.mockImplementation(() => new Promise(() => {}));
      render(<PhysicianClinicalResources />);

      expect(screen.getByText('Loading resources...')).toBeInTheDocument();
    });

    it('should show loading animation', () => {
      mockGetResources.mockImplementation(() => new Promise(() => {}));
      const { container } = render(<PhysicianClinicalResources />);

      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('Search', () => {
    it('should render search input', async () => {
      render(<PhysicianClinicalResources />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search resources...')).toBeInTheDocument();
      });
    });

    it('should filter resources based on search term', async () => {
      render(<PhysicianClinicalResources />);

      await waitFor(() => {
        expect(screen.getByText('Emergency Protocol: Code Blue')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search resources...');
      await userEvent.type(searchInput, 'diabetes');

      expect(screen.getByText('Clinical Guideline: Diabetes Management')).toBeInTheDocument();
      expect(screen.queryByText('Emergency Protocol: Code Blue')).not.toBeInTheDocument();
    });

    it('should search in titles, descriptions, and tags', async () => {
      render(<PhysicianClinicalResources />);

      await waitFor(() => {
        expect(screen.getByText('Emergency Protocol: Code Blue')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search resources...');
      await userEvent.type(searchInput, 'cardiac');

      // Should find by tag
      expect(screen.getByText('Emergency Protocol: Code Blue')).toBeInTheDocument();
    });

    it('should show empty state when no results match', async () => {
      render(<PhysicianClinicalResources />);

      await waitFor(() => {
        expect(screen.getByText('Emergency Protocol: Code Blue')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search resources...');
      await userEvent.type(searchInput, 'xyz123nonexistent');

      expect(screen.getByText('No resources found')).toBeInTheDocument();
    });
  });

  describe('Category Filter', () => {
    it('should render category dropdown', async () => {
      render(<PhysicianClinicalResources />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
    });

    it('should have all category options in dropdown', async () => {
      render(<PhysicianClinicalResources />);

      await waitFor(() => {
        expect(screen.getByText('All Categories')).toBeInTheDocument();
      });

      // Category names appear in the select dropdown and as headers - check select options
      const select = screen.getByRole('combobox');
      const options = select.querySelectorAll('option');

      // Should have 5 options: All + 4 categories
      expect(options.length).toBe(5);
    });

    it('should filter resources by category', async () => {
      render(<PhysicianClinicalResources />);

      await waitFor(() => {
        expect(screen.getByText('Emergency Protocol: Code Blue')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      await userEvent.selectOptions(select, 'formulary');

      expect(screen.getByText('Formulary: Antibiotic Guide')).toBeInTheDocument();
      expect(screen.queryByText('Emergency Protocol: Code Blue')).not.toBeInTheDocument();
    });
  });

  describe('Resource Display', () => {
    it('should display resource cards', async () => {
      render(<PhysicianClinicalResources />);

      await waitFor(() => {
        expect(screen.getByText('Emergency Protocol: Code Blue')).toBeInTheDocument();
      });
    });

    it('should display resource descriptions', async () => {
      render(<PhysicianClinicalResources />);

      await waitFor(() => {
        expect(screen.getByText('Step-by-step guide for cardiac arrest response')).toBeInTheDocument();
      });
    });

    it('should display evidence-based badge', async () => {
      render(<PhysicianClinicalResources />);

      await waitFor(() => {
        const badges = screen.getAllByText('Evidence-Based');
        expect(badges.length).toBeGreaterThan(0);
      });
    });

    it('should display tags', async () => {
      render(<PhysicianClinicalResources />);

      await waitFor(() => {
        expect(screen.getByText('emergency')).toBeInTheDocument();
        expect(screen.getByText('cardiac')).toBeInTheDocument();
      });
    });

    it('should group resources by category when showing all', async () => {
      render(<PhysicianClinicalResources />);

      await waitFor(() => {
        // Category headers should be visible
        const headers = screen.getAllByText('Emergency Protocols');
        expect(headers.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Resource Interaction', () => {
    it('should track resource view when clicked', async () => {
      // Mock window.open
      const mockOpen = vi.fn();
      vi.stubGlobal('open', mockOpen);

      render(<PhysicianClinicalResources />);

      await waitFor(() => {
        expect(screen.getByText('Emergency Protocol: Code Blue')).toBeInTheDocument();
      });

      const resourceCard = screen.getByText('Emergency Protocol: Code Blue').closest('div');
      await userEvent.click(resourceCard!);

      expect(mockTrackResourceView).toHaveBeenCalledWith('resource-1');

      vi.unstubAllGlobals();
    });

    it('should open resource URL in new tab', async () => {
      const mockOpen = vi.fn();
      vi.stubGlobal('open', mockOpen);

      render(<PhysicianClinicalResources />);

      await waitFor(() => {
        expect(screen.getByText('Emergency Protocol: Code Blue')).toBeInTheDocument();
      });

      const resourceCard = screen.getByText('Emergency Protocol: Code Blue').closest('div');
      await userEvent.click(resourceCard!);

      expect(mockOpen).toHaveBeenCalledWith(
        'https://example.com/code-blue',
        '_blank',
        'noopener,noreferrer'
      );

      vi.unstubAllGlobals();
    });

    it('should not try to open URL if resource has no URL', async () => {
      const mockOpen = vi.fn();
      vi.stubGlobal('open', mockOpen);

      render(<PhysicianClinicalResources />);

      // First filter to specialist directory
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      await userEvent.selectOptions(select, 'specialist_directory');

      await waitFor(() => {
        // Multiple "Specialist Directory" texts exist - in select and in card
        const allSpecialist = screen.getAllByText('Specialist Directory');
        expect(allSpecialist.length).toBeGreaterThan(0);
      });

      // Find the resource card by its description text (more unique)
      const descriptionText = screen.getByText('Contact list for hospital specialists');
      const resourceCard = descriptionText.closest('div[class*="rounded-lg"]');
      await userEvent.click(resourceCard!);

      // Should still track view
      expect(mockTrackResourceView).toHaveBeenCalledWith('resource-4');
      // But not open URL (undefined URL)
      expect(mockOpen).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no resources exist', async () => {
      mockGetResources.mockResolvedValue([]);

      render(<PhysicianClinicalResources />);

      await waitFor(() => {
        expect(screen.getByText('No resources found')).toBeInTheDocument();
      });
    });

    it('should show appropriate message in empty state', async () => {
      mockGetResources.mockResolvedValue([]);

      render(<PhysicianClinicalResources />);

      await waitFor(() => {
        expect(screen.getByText('Resources will appear here once added')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle resource loading error gracefully', async () => {
      mockGetResources.mockRejectedValue(new Error('Failed to load'));

      render(<PhysicianClinicalResources />);

      // Component should not crash and should show empty state
      await waitFor(() => {
        expect(screen.getByText('No resources found')).toBeInTheDocument();
      });
    });
  });

  describe('Category Styling', () => {
    it('should render category-specific styling', async () => {
      const { container } = render(<PhysicianClinicalResources />);

      await waitFor(() => {
        // Should have color-coded categories
        expect(container.querySelector('.bg-red-50')).toBeInTheDocument(); // Emergency
        expect(container.querySelector('.bg-blue-50')).toBeInTheDocument(); // Clinical Guidelines
        expect(container.querySelector('.bg-green-50')).toBeInTheDocument(); // Formulary
        expect(container.querySelector('.bg-purple-50')).toBeInTheDocument(); // Specialist
      });
    });
  });
});
