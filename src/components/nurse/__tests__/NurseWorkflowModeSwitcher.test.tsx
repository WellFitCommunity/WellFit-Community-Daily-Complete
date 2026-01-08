/**
 * Tests for NurseWorkflowModeSwitcher Component
 *
 * Purpose: Workflow mode filter to reduce cognitive load by filtering sections
 * Tests: Mode rendering, selection, persistence, section filtering
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  NurseWorkflowModeSwitcher,
  NURSE_WORKFLOW_MODES,
  useNurseSectionFilter,
} from '../NurseWorkflowModeSwitcher';
import type { NurseWorkflowMode } from '../NurseWorkflowModeSwitcher';

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
    user: { id: 'user-123', email: 'nurse@hospital.com' },
  })),
}));

describe('NurseWorkflowModeSwitcher', () => {
  const mockOnModeChange = vi.fn();
  const defaultProps = {
    currentMode: 'all' as NurseWorkflowMode,
    onModeChange: mockOnModeChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the workflow mode switcher', () => {
      render(<NurseWorkflowModeSwitcher {...defaultProps} />);

      expect(screen.getByText('Nursing Workflow Mode')).toBeInTheDocument();
    });

    it('should render all workflow mode buttons', () => {
      render(<NurseWorkflowModeSwitcher {...defaultProps} />);

      expect(screen.getByText('All Sections')).toBeInTheDocument();
      expect(screen.getByText('Clinical Care')).toBeInTheDocument();
      expect(screen.getByText('Shift Management')).toBeInTheDocument();
      expect(screen.getByText('Wellness & Support')).toBeInTheDocument();
      expect(screen.getByText('Administrative')).toBeInTheDocument();
    });

    it('should show descriptions for each mode', () => {
      render(<NurseWorkflowModeSwitcher {...defaultProps} />);

      expect(screen.getByText('Show everything')).toBeInTheDocument();
      expect(screen.getByText('Documentation, assessments, CCM, scribe')).toBeInTheDocument();
      expect(screen.getByText('Handoffs, prioritization, coordination')).toBeInTheDocument();
      expect(screen.getByText('Resilience, burnout prevention, community')).toBeInTheDocument();
      expect(screen.getByText('Enrollment, reports, patient questions')).toBeInTheDocument();
    });

    it('should show Zap icon in header', () => {
      const { container } = render(<NurseWorkflowModeSwitcher {...defaultProps} />);

      // Zap icon should be present
      const zapIcon = container.querySelector('svg');
      expect(zapIcon).toBeInTheDocument();
    });

    it('should show filter description text', () => {
      render(<NurseWorkflowModeSwitcher {...defaultProps} />);

      expect(screen.getByText('Focus on specific nursing tasks')).toBeInTheDocument();
    });
  });

  describe('Mode Selection', () => {
    it('should highlight the current mode', () => {
      render(<NurseWorkflowModeSwitcher {...defaultProps} currentMode="clinical" />);

      const clinicalButton = screen.getByText('Clinical Care').closest('button');
      expect(clinicalButton).toHaveClass('text-white');
    });

    it('should show checkmark on active mode', () => {
      render(<NurseWorkflowModeSwitcher {...defaultProps} currentMode="clinical" />);

      const clinicalButton = screen.getByText('Clinical Care').closest('button');
      // Check for CheckCircle icon in the button
      const checkIcon = clinicalButton?.querySelector('svg.w-5.h-5');
      expect(checkIcon).toBeInTheDocument();
    });

    it('should call onModeChange when a mode is clicked', async () => {
      render(<NurseWorkflowModeSwitcher {...defaultProps} />);

      const clinicalButton = screen.getByText('Clinical Care').closest('button');
      await userEvent.click(clinicalButton!);

      expect(mockOnModeChange).toHaveBeenCalledWith('clinical');
    });

    it('should save preference to database when mode changes', async () => {
      render(<NurseWorkflowModeSwitcher {...defaultProps} />);

      const clinicalButton = screen.getByText('Clinical Care').closest('button');
      await userEvent.click(clinicalButton!);

      await waitFor(() => {
        expect(mockUpsert).toHaveBeenCalled();
      });
    });

    it('should not save preference when switching to all mode', async () => {
      render(<NurseWorkflowModeSwitcher {...defaultProps} currentMode="clinical" />);

      const allButton = screen.getByText('All Sections').closest('button');
      await userEvent.click(allButton!);

      // Wait a bit to ensure async operations complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // The upsert should not be called for 'all' mode
      expect(mockUpsert).not.toHaveBeenCalled();
    });
  });

  describe('Active Mode Tips', () => {
    it('should not show tips when all mode is active', () => {
      render(<NurseWorkflowModeSwitcher {...defaultProps} currentMode="all" />);

      expect(screen.queryByText(/mode active:/)).not.toBeInTheDocument();
    });

    it('should show tips when a specific mode is active', () => {
      render(<NurseWorkflowModeSwitcher {...defaultProps} currentMode="clinical" />);

      expect(screen.getByText(/Clinical Care mode active:/)).toBeInTheDocument();
    });

    it('should show section count in tips', () => {
      render(<NurseWorkflowModeSwitcher {...defaultProps} currentMode="clinical" />);

      expect(screen.getByText(/Showing \d+ focused sections/)).toBeInTheDocument();
    });

    it('should mention keyboard shortcut in tips', () => {
      render(<NurseWorkflowModeSwitcher {...defaultProps} currentMode="wellness" />);

      // The tip should mention keyboard shortcut
      expect(screen.getByText(/Press Cmd\+K for quick access/)).toBeInTheDocument();
    });
  });

  describe('Mode Icons', () => {
    it('should render icons for each mode', () => {
      const { container } = render(<NurseWorkflowModeSwitcher {...defaultProps} />);

      const buttons = container.querySelectorAll('button');
      buttons.forEach(button => {
        const icon = button.querySelector('svg');
        expect(icon).toBeInTheDocument();
      });
    });
  });

  describe('Grid Layout', () => {
    it('should render buttons in a grid', () => {
      const { container } = render(<NurseWorkflowModeSwitcher {...defaultProps} />);

      const grid = container.querySelector('.grid');
      expect(grid).toBeInTheDocument();
      expect(grid).toHaveClass('grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-5');
    });
  });

  describe('Styling', () => {
    it('should have white background container', () => {
      const { container } = render(<NurseWorkflowModeSwitcher {...defaultProps} />);

      const mainContainer = container.firstChild;
      expect(mainContainer).toHaveClass('bg-white', 'rounded-xl', 'shadow-lg');
    });

    it('should have gradient background on active mode', () => {
      render(<NurseWorkflowModeSwitcher {...defaultProps} currentMode="clinical" />);

      const clinicalButton = screen.getByText('Clinical Care').closest('button');
      expect(clinicalButton?.className).toMatch(/bg-linear-to-br|bg-gradient-to-br/);
    });
  });
});

describe('NURSE_WORKFLOW_MODES Configuration', () => {
  it('should have all required modes', () => {
    expect(NURSE_WORKFLOW_MODES).toHaveProperty('all');
    expect(NURSE_WORKFLOW_MODES).toHaveProperty('clinical');
    expect(NURSE_WORKFLOW_MODES).toHaveProperty('shift');
    expect(NURSE_WORKFLOW_MODES).toHaveProperty('wellness');
    expect(NURSE_WORKFLOW_MODES).toHaveProperty('administrative');
  });

  it('should have sections defined for each mode', () => {
    expect(NURSE_WORKFLOW_MODES.all.sections).toBeDefined();
    expect(NURSE_WORKFLOW_MODES.clinical.sections.length).toBeGreaterThan(0);
    expect(NURSE_WORKFLOW_MODES.shift.sections.length).toBeGreaterThan(0);
    expect(NURSE_WORKFLOW_MODES.wellness.sections.length).toBeGreaterThan(0);
    expect(NURSE_WORKFLOW_MODES.administrative.sections.length).toBeGreaterThan(0);
  });

  it('should have labels for each mode', () => {
    Object.values(NURSE_WORKFLOW_MODES).forEach(mode => {
      expect(mode.label).toBeTruthy();
      expect(mode.description).toBeTruthy();
    });
  });

  it('should have gradient defined for each mode', () => {
    Object.values(NURSE_WORKFLOW_MODES).forEach(mode => {
      expect(mode.gradient).toBeTruthy();
    });
  });
});

describe('useNurseSectionFilter Hook', () => {
  // Helper component to test the hook
  const TestComponent: React.FC<{ mode: NurseWorkflowMode; sectionId: string }> = ({ mode, sectionId }) => {
    const { visible, prioritized } = useNurseSectionFilter(mode, sectionId);
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
    render(<TestComponent mode="clinical" sectionId="reports-analytics" />);

    expect(screen.getByTestId('visible')).toHaveTextContent('false');
    expect(screen.getByTestId('prioritized')).toHaveTextContent('false');
  });

  it('should show shift sections in shift mode', () => {
    render(<TestComponent mode="shift" sectionId="shift-handoff" />);

    expect(screen.getByTestId('visible')).toHaveTextContent('true');
    expect(screen.getByTestId('prioritized')).toHaveTextContent('true');
  });

  it('should show wellness sections in wellness mode', () => {
    render(<TestComponent mode="wellness" sectionId="resilience-hub" />);

    expect(screen.getByTestId('visible')).toHaveTextContent('true');
    expect(screen.getByTestId('prioritized')).toHaveTextContent('true');
  });

  it('should show administrative sections in administrative mode', () => {
    render(<TestComponent mode="administrative" sectionId="reports-analytics" />);

    expect(screen.getByTestId('visible')).toHaveTextContent('true');
    expect(screen.getByTestId('prioritized')).toHaveTextContent('true');
  });
});
