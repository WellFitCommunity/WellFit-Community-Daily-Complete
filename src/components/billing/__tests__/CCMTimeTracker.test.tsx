/**
 * Tests for CCMTimeTracker Component
 *
 * Purpose: Verify CCM time tracking modal rendering and functionality
 * Coverage: Modal rendering, timer controls, activity management, time summary, suggested codes, compliance
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CCMTimeTracker } from '../CCMTimeTracker';

describe('CCMTimeTracker', () => {
  const defaultProps = {
    encounterId: 'encounter-123',
    patientId: 'patient-456',
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Mock window.alert
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Modal Rendering', () => {
    it('should render modal with title "CCM Time Tracking"', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByText('CCM Time Tracking')).toBeInTheDocument();
    });

    it('should render subtitle about tracking billable activities', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByText(/Track billable activities for Chronic Care Management/)).toBeInTheDocument();
    });

    it('should render as modal overlay', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      // Modal should have overlay with fixed positioning
      const overlay = document.querySelector('.fixed.inset-0');
      expect(overlay).toBeInTheDocument();
    });
  });

  describe('Timer Controls', () => {
    it('should render Start button initially', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Start/i })).toBeInTheDocument();
    });

    it('should render Reset button', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Reset/i })).toBeInTheDocument();
    });

    it('should show 00:00 timer display initially', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByText('00:00')).toBeInTheDocument();
    });

    it('should show Stop button after starting timer', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Start/i }));

      expect(screen.getByRole('button', { name: /Stop/i })).toBeInTheDocument();
    });

    it('should reset timer when Reset is clicked', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      // Start timer
      fireEvent.click(screen.getByRole('button', { name: /Start/i }));

      // Advance time
      act(() => {
        vi.advanceTimersByTime(65000); // 1 minute 5 seconds
      });

      // Reset timer
      fireEvent.click(screen.getByRole('button', { name: /Reset/i }));

      // Should show 00:00 again
      expect(screen.getByText('00:00')).toBeInTheDocument();
    });
  });

  describe('Activity Type Dropdown', () => {
    it('should render activity type dropdown', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should have Assessment & Care Planning option', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByText('Assessment & Care Planning')).toBeInTheDocument();
    });

    it('should have Care Coordination option', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByText('Care Coordination')).toBeInTheDocument();
    });

    it('should have Medication Management option', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByText('Medication Management')).toBeInTheDocument();
    });

    it('should have Patient Education option', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByText('Patient Education')).toBeInTheDocument();
    });

    it('should have Patient/Family Communication option', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByText('Patient/Family Communication')).toBeInTheDocument();
    });
  });

  describe('Provider Name Input', () => {
    it('should render provider name input field', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByPlaceholderText('Provider name')).toBeInTheDocument();
    });

    it('should allow typing in provider name field', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      const input = screen.getByPlaceholderText('Provider name');
      fireEvent.change(input, { target: { value: 'Dr. Smith' } });

      expect(input).toHaveValue('Dr. Smith');
    });
  });

  describe('Description Textarea', () => {
    it('should render description textarea', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByPlaceholderText(/Detailed description of activity performed/)).toBeInTheDocument();
    });

    it('should allow typing in description textarea', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      const textarea = screen.getByPlaceholderText(/Detailed description of activity performed/);
      fireEvent.change(textarea, { target: { value: 'Reviewed care plan with patient' } });

      expect(textarea).toHaveValue('Reviewed care plan with patient');
    });
  });

  describe('Manual Time Entry Input', () => {
    it('should render manual time entry input', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByPlaceholderText('min')).toBeInTheDocument();
    });

    it('should show "minutes" label for manual entry', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByText('minutes')).toBeInTheDocument();
    });

    it('should allow entering manual time', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      const input = screen.getByPlaceholderText('min');
      fireEvent.change(input, { target: { value: '15' } });

      expect(input).toHaveValue(15);
    });
  });

  describe('Add Activity Button', () => {
    it('should render Add Activity button', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Add Activity/i })).toBeInTheDocument();
    });

    it('should show alert when adding activity without required fields', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Add Activity/i }));

      expect(window.alert).toHaveBeenCalled();
    });

    it('should add activity when all fields are filled', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      // Fill in required fields
      fireEvent.change(screen.getByPlaceholderText('Provider name'), { target: { value: 'Dr. Smith' } });
      fireEvent.change(screen.getByPlaceholderText(/Detailed description/), { target: { value: 'Care coordination activities' } });
      fireEvent.change(screen.getByPlaceholderText('min'), { target: { value: '25' } });

      // Add activity
      fireEvent.click(screen.getByRole('button', { name: /Add Activity/i }));

      // Should show the logged activity
      expect(screen.queryByText('No activities logged yet')).not.toBeInTheDocument();
    });
  });

  describe('Logged Activities Display', () => {
    it('should show "No activities logged yet" message initially', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByText('No activities logged yet')).toBeInTheDocument();
    });

    it('should display logged activities section', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByText('Logged Activities')).toBeInTheDocument();
    });

    it('should show Billable badge for billable activities', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      // Add an activity
      fireEvent.change(screen.getByPlaceholderText('Provider name'), { target: { value: 'Dr. Smith' } });
      fireEvent.change(screen.getByPlaceholderText(/Detailed description/), { target: { value: 'Care coordination' } });
      fireEvent.change(screen.getByPlaceholderText('min'), { target: { value: '25' } });
      fireEvent.click(screen.getByRole('button', { name: /Add Activity/i }));

      expect(screen.getByText('Billable')).toBeInTheDocument();
    });

    it('should show Remove button for logged activities', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      // Add an activity
      fireEvent.change(screen.getByPlaceholderText('Provider name'), { target: { value: 'Dr. Smith' } });
      fireEvent.change(screen.getByPlaceholderText(/Detailed description/), { target: { value: 'Care coordination' } });
      fireEvent.change(screen.getByPlaceholderText('min'), { target: { value: '25' } });
      fireEvent.click(screen.getByRole('button', { name: /Add Activity/i }));

      expect(screen.getByText('Remove')).toBeInTheDocument();
    });
  });

  describe('Time Summary Section', () => {
    it('should display Time Summary header', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByText('Time Summary')).toBeInTheDocument();
    });

    it('should display Total Time', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByText('Total Time')).toBeInTheDocument();
    });

    it('should display Billable Time', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByText('Billable Time')).toBeInTheDocument();
    });

    it('should display Suggested Codes count', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByText('Suggested Codes')).toBeInTheDocument();
    });
  });

  describe('Suggested CPT Codes', () => {
    it('should show no suggested codes initially', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      // With 0 billable minutes, should not show suggested codes section header
      expect(screen.queryByText('Suggested CPT Codes:')).not.toBeInTheDocument();
    });

    it('should suggest 99490 when billable minutes >= 20', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      // Add activity with 25 minutes
      fireEvent.change(screen.getByPlaceholderText('Provider name'), { target: { value: 'Dr. Smith' } });
      fireEvent.change(screen.getByPlaceholderText(/Detailed description/), { target: { value: 'Assessment and planning' } });
      fireEvent.change(screen.getByPlaceholderText('min'), { target: { value: '25' } });
      fireEvent.click(screen.getByRole('button', { name: /Add Activity/i }));

      expect(screen.getByText('99490')).toBeInTheDocument();
    });

    it('should suggest 99487 when billable minutes >= 60', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      // Add activity with 65 minutes
      fireEvent.change(screen.getByPlaceholderText('Provider name'), { target: { value: 'Dr. Smith' } });
      fireEvent.change(screen.getByPlaceholderText(/Detailed description/), { target: { value: 'Complex assessment' } });
      fireEvent.change(screen.getByPlaceholderText('min'), { target: { value: '65' } });
      fireEvent.click(screen.getByRole('button', { name: /Add Activity/i }));

      expect(screen.getByText('99487')).toBeInTheDocument();
    });
  });

  describe('Compliance Issues Display', () => {
    it('should show compliance issue for minimum 20 minutes', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByText(/Minimum 20 minutes required for CCM billing/)).toBeInTheDocument();
    });

    it('should show compliance header when issues exist', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByText('Compliance Issues:')).toBeInTheDocument();
    });
  });

  describe('Save and Cancel Buttons', () => {
    it('should render Cancel button', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    it('should render Save Time Tracking button', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Save Time Tracking/i })).toBeInTheDocument();
    });

    it('should call onCancel when Cancel is clicked', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('should disable Save button when no activities are logged', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      const saveButton = screen.getByRole('button', { name: /Save Time Tracking/i });
      expect(saveButton).toBeDisabled();
    });

    it('should enable Save button when activities are logged', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      // Add activity
      fireEvent.change(screen.getByPlaceholderText('Provider name'), { target: { value: 'Dr. Smith' } });
      fireEvent.change(screen.getByPlaceholderText(/Detailed description/), { target: { value: 'Care coordination' } });
      fireEvent.change(screen.getByPlaceholderText('min'), { target: { value: '25' } });
      fireEvent.click(screen.getByRole('button', { name: /Add Activity/i }));

      const saveButton = screen.getByRole('button', { name: /Save Time Tracking/i });
      expect(saveButton).not.toBeDisabled();
    });

    it('should call onSave with activities when Save is clicked', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      // Add activity
      fireEvent.change(screen.getByPlaceholderText('Provider name'), { target: { value: 'Dr. Smith' } });
      fireEvent.change(screen.getByPlaceholderText(/Detailed description/), { target: { value: 'Care coordination' } });
      fireEvent.change(screen.getByPlaceholderText('min'), { target: { value: '25' } });
      fireEvent.click(screen.getByRole('button', { name: /Add Activity/i }));

      // Save
      fireEvent.click(screen.getByRole('button', { name: /Save Time Tracking/i }));

      expect(defaultProps.onSave).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          type: 'assessment',
          duration: 25,
          provider: 'Dr. Smith',
          description: 'Care coordination',
          billable: true,
        }),
      ]));
    });
  });

  describe('Initial Data Handling', () => {
    it('should pre-populate activities from initialData', () => {
      const initialData = {
        encounterId: 'enc-123',
        patientId: 'patient-456',
        serviceDate: '2024-01-15',
        activities: [
          { type: 'assessment' as const, duration: 30, description: 'Initial assessment', provider: 'Dr. Jones', billable: true },
        ],
        totalMinutes: 30,
        billableMinutes: 30,
        suggestedCodes: ['99490'],
        isCompliant: true,
        complianceNotes: [],
      };

      render(<CCMTimeTracker {...defaultProps} initialData={initialData} />);

      // Should show the pre-populated activity
      expect(screen.getByText('Initial assessment')).toBeInTheDocument();
      expect(screen.getByText('Provider: Dr. Jones')).toBeInTheDocument();
    });
  });

  describe('Activity Removal', () => {
    it('should remove activity when Remove is clicked', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      // Add activity
      fireEvent.change(screen.getByPlaceholderText('Provider name'), { target: { value: 'Dr. Smith' } });
      fireEvent.change(screen.getByPlaceholderText(/Detailed description/), { target: { value: 'Care coordination' } });
      fireEvent.change(screen.getByPlaceholderText('min'), { target: { value: '25' } });
      fireEvent.click(screen.getByRole('button', { name: /Add Activity/i }));

      // Remove activity
      fireEvent.click(screen.getByText('Remove'));

      // Should show empty message again
      expect(screen.getByText('No activities logged yet')).toBeInTheDocument();
    });
  });

  describe('Billable Checkbox', () => {
    it('should render billable activity checkbox', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByText('Billable activity')).toBeInTheDocument();
    });

    it('should be checked by default', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    it('should allow unchecking billable checkbox', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      expect(checkbox).not.toBeChecked();
    });
  });
});
