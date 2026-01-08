/**
 * Tests for WorkflowModeSwitcher Component (Physician)
 *
 * Purpose: Workflow mode filter to reduce cognitive load by filtering sections
 * Tests: Mode rendering, selection, persistence, section filtering
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  WorkflowModeSwitcher,
  WORKFLOW_MODES,
  useSectionFilter,
} from '../WorkflowModeSwitcher';
import type { WorkflowMode } from '../WorkflowModeSwitcher';

// Mock Supabase
const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: mockUpsert,
    })),
  },
}));

// Mock AuthContext
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-123', email: 'doctor@hospital.com' },
  })),
}));

describe('WorkflowModeSwitcher', () => {
  const mockOnModeChange = vi.fn();
  const defaultProps = {
    currentMode: 'all' as WorkflowMode,
    onModeChange: mockOnModeChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the workflow mode switcher', () => {
      render(<WorkflowModeSwitcher {...defaultProps} />);

      expect(screen.getByText('Workflow Mode')).toBeInTheDocument();
    });

    it('should render all workflow mode buttons', () => {
      render(<WorkflowModeSwitcher {...defaultProps} />);

      expect(screen.getByText('All Sections')).toBeInTheDocument();
      expect(screen.getByText('Clinical Focus')).toBeInTheDocument();
      expect(screen.getByText('Administrative')).toBeInTheDocument();
      expect(screen.getByText('Wellness Hub')).toBeInTheDocument();
    });

    it('should show descriptions for each mode', () => {
      render(<WorkflowModeSwitcher {...defaultProps} />);

      expect(screen.getByText('Show everything')).toBeInTheDocument();
      expect(screen.getByText('Patient care, vitals, medications, notes')).toBeInTheDocument();
      expect(screen.getByText('Documentation, reports, compliance')).toBeInTheDocument();
      expect(screen.getByText('Community programs, SDOH, prevention')).toBeInTheDocument();
    });

    it('should show Zap icon in header', () => {
      const { container } = render(<WorkflowModeSwitcher {...defaultProps} />);

      const zapIcon = container.querySelector('svg');
      expect(zapIcon).toBeInTheDocument();
    });

    it('should show filter description text', () => {
      render(<WorkflowModeSwitcher {...defaultProps} />);

      expect(screen.getByText('Filter sections by workflow')).toBeInTheDocument();
    });
  });

  describe('Mode Selection', () => {
    it('should highlight the current mode', () => {
      render(<WorkflowModeSwitcher {...defaultProps} currentMode="clinical" />);

      const clinicalButton = screen.getByText('Clinical Focus').closest('button');
      expect(clinicalButton).toHaveClass('text-white');
    });

    it('should show checkmark on active mode', () => {
      render(<WorkflowModeSwitcher {...defaultProps} currentMode="clinical" />);

      const clinicalButton = screen.getByText('Clinical Focus').closest('button');
      const checkIcon = clinicalButton?.querySelector('svg.w-5.h-5');
      expect(checkIcon).toBeInTheDocument();
    });

    it('should call onModeChange when a mode is clicked', async () => {
      render(<WorkflowModeSwitcher {...defaultProps} />);

      const clinicalButton = screen.getByText('Clinical Focus').closest('button') as HTMLElement;
      await userEvent.click(clinicalButton);

      expect(mockOnModeChange).toHaveBeenCalledWith('clinical');
    });

    it('should save preference to database when mode changes', async () => {
      render(<WorkflowModeSwitcher {...defaultProps} />);

      const clinicalButton = screen.getByText('Clinical Focus').closest('button') as HTMLElement;
      await userEvent.click(clinicalButton);

      await waitFor(() => {
        expect(mockUpsert).toHaveBeenCalled();
      });
    });

    it('should not save preference when switching to all mode', async () => {
      render(<WorkflowModeSwitcher {...defaultProps} currentMode="clinical" />);

      const allButton = screen.getByText('All Sections').closest('button') as HTMLElement;
      await userEvent.click(allButton);

      // Wait a bit to ensure async operations complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // The upsert should not be called for 'all' mode
      expect(mockUpsert).not.toHaveBeenCalled();
    });
  });

  describe('Active Mode Tips', () => {
    it('should not show tips when all mode is active', () => {
      render(<WorkflowModeSwitcher {...defaultProps} currentMode="all" />);

      expect(screen.queryByText(/mode active:/)).not.toBeInTheDocument();
    });

    it('should show tips when a specific mode is active', () => {
      render(<WorkflowModeSwitcher {...defaultProps} currentMode="clinical" />);

      expect(screen.getByText(/Clinical Focus mode active:/)).toBeInTheDocument();
    });

    it('should show section count in tips', () => {
      render(<WorkflowModeSwitcher {...defaultProps} currentMode="clinical" />);

      expect(screen.getByText(/Showing \d+ focused sections/)).toBeInTheDocument();
    });

    it('should mention keyboard shortcut in tips', () => {
      render(<WorkflowModeSwitcher {...defaultProps} currentMode="clinical" />);

      expect(screen.getByText(/Cmd\+K/)).toBeInTheDocument();
    });
  });

  describe('Mode Icons', () => {
    it('should render icons for each mode', () => {
      const { container } = render(<WorkflowModeSwitcher {...defaultProps} />);

      const buttons = container.querySelectorAll('button');
      buttons.forEach(button => {
        const icon = button.querySelector('svg');
        expect(icon).toBeInTheDocument();
      });
    });
  });

  describe('Grid Layout', () => {
    it('should render buttons in a grid', () => {
      const { container } = render(<WorkflowModeSwitcher {...defaultProps} />);

      const grid = container.querySelector('.grid');
      expect(grid).toBeInTheDocument();
      expect(grid).toHaveClass('grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-6');
    });
  });

  describe('Styling', () => {
    it('should have white background container', () => {
      const { container } = render(<WorkflowModeSwitcher {...defaultProps} />);

      const mainContainer = container.firstChild;
      expect(mainContainer).toHaveClass('bg-white', 'rounded-xl', 'shadow-lg');
    });

    it('should have gradient background on active mode', () => {
      render(<WorkflowModeSwitcher {...defaultProps} currentMode="clinical" />);

      const clinicalButton = screen.getByText('Clinical Focus').closest('button');
      expect(clinicalButton?.className).toMatch(/bg-linear-to-br|bg-gradient-to-br/);
    });
  });
});

describe('WORKFLOW_MODES Configuration', () => {
  it('should have all required modes', () => {
    expect(WORKFLOW_MODES).toHaveProperty('all');
    expect(WORKFLOW_MODES).toHaveProperty('clinical');
    expect(WORKFLOW_MODES).toHaveProperty('administrative');
    expect(WORKFLOW_MODES).toHaveProperty('wellness');
  });

  it('should have sections defined for each mode', () => {
    expect(WORKFLOW_MODES.all.sections).toBeDefined();
    expect(WORKFLOW_MODES.clinical.sections.length).toBeGreaterThan(0);
    expect(WORKFLOW_MODES.administrative.sections.length).toBeGreaterThan(0);
    expect(WORKFLOW_MODES.wellness.sections.length).toBeGreaterThan(0);
  });

  it('should have labels for each mode', () => {
    Object.values(WORKFLOW_MODES).forEach(mode => {
      expect(mode.label).toBeTruthy();
      expect(mode.description).toBeTruthy();
    });
  });

  it('should have gradient defined for each mode', () => {
    Object.values(WORKFLOW_MODES).forEach(mode => {
      expect(mode.gradient).toBeTruthy();
    });
  });
});

describe('useSectionFilter Hook', () => {
  // Helper component to test the hook
  const TestComponent: React.FC<{ mode: WorkflowMode; sectionId: string }> = ({ mode, sectionId }) => {
    const { visible, prioritized } = useSectionFilter(mode, sectionId);
    return (
      <div data-testid="result">
        <span data-testid="visible">{visible.toString()}</span>
        <span data-testid="prioritized">{prioritized.toString()}</span>
      </div>
    );
  };

  it('should show all sections when mode is all', () => {
    render(<TestComponent mode="all" sectionId="any-section" />);

    expect(screen.getByTestId('visible')).toHaveTextContent('true');
    expect(screen.getByTestId('prioritized')).toHaveTextContent('false');
  });

  it('should show clinical sections in clinical mode', () => {
    render(<TestComponent mode="clinical" sectionId="smart-scribe" />);

    expect(screen.getByTestId('visible')).toHaveTextContent('true');
    expect(screen.getByTestId('prioritized')).toHaveTextContent('true');
  });

  it('should hide non-clinical sections in clinical mode', () => {
    render(<TestComponent mode="clinical" sectionId="reports" />);

    expect(screen.getByTestId('visible')).toHaveTextContent('false');
    expect(screen.getByTestId('prioritized')).toHaveTextContent('false');
  });

  it('should show administrative sections in administrative mode', () => {
    render(<TestComponent mode="administrative" sectionId="reports" />);

    expect(screen.getByTestId('visible')).toHaveTextContent('true');
    expect(screen.getByTestId('prioritized')).toHaveTextContent('true');
  });

  it('should show wellness sections in wellness mode', () => {
    render(<TestComponent mode="wellness" sectionId="physician-wellness" />);

    expect(screen.getByTestId('visible')).toHaveTextContent('true');
    expect(screen.getByTestId('prioritized')).toHaveTextContent('true');
  });
});
