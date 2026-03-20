// ============================================================================
// DailyCheckinForm — P0-3 Tests
// ============================================================================
// Tests slider interactions, form submission, Clarity vs Shield
// field visibility, checkbox toggles, error states, and success feedback.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DailyCheckinForm } from '../DailyCheckinForm';

// Mock the service
vi.mock('../../../services/resilienceHubService', () => ({
  submitDailyCheckin: vi.fn(),
}));

import { submitDailyCheckin } from '../../../services/resilienceHubService';
const mockSubmit = vi.mocked(submitDailyCheckin);

// Helper: submit the form by clicking the submit button
const submitForm = () => {
  fireEvent.click(screen.getByRole('button', { name: /save check-in/i }));
};

describe('DailyCheckinForm', () => {
  const defaultProps = {
    onSuccess: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockSubmit.mockResolvedValue({ success: true, data: {}, error: null } as never);
  });

  // ========================================================================
  // RENDERING & INITIAL STATE
  // ========================================================================

  describe('Initial Rendering', () => {
    it('renders the form title and description', () => {
      render(<DailyCheckinForm {...defaultProps} />);
      expect(screen.getByText('Daily Emotional Check-In')).toBeInTheDocument();
      expect(screen.getByText(/How are you feeling today/)).toBeInTheDocument();
    });

    it('renders three sliders: stress, energy, mood', () => {
      render(<DailyCheckinForm {...defaultProps} />);
      const sliders = screen.getAllByRole('slider');
      expect(sliders).toHaveLength(3);
    });

    it('initializes all sliders to 5 (midpoint)', () => {
      render(<DailyCheckinForm {...defaultProps} />);
      const sliders = screen.getAllByRole('slider');
      sliders.forEach((slider) => {
        expect(slider).toHaveValue('5');
      });
    });

    it('renders the Save Check-In button', () => {
      render(<DailyCheckinForm {...defaultProps} />);
      expect(screen.getByRole('button', { name: /save check-in/i })).toBeInTheDocument();
    });

    it('renders Cancel button when onClose is provided', () => {
      render(<DailyCheckinForm {...defaultProps} />);
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('does not render Cancel button when onClose is not provided', () => {
      render(<DailyCheckinForm onSuccess={vi.fn()} />);
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    });

    it('renders work setting dropdown with default "Remote/Telehealth"', () => {
      render(<DailyCheckinForm {...defaultProps} />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('remote');
    });
  });

  // ========================================================================
  // SLIDER INTERACTIONS
  // ========================================================================

  describe('Slider Interactions', () => {
    it('updates stress level when slider changes', () => {
      render(<DailyCheckinForm {...defaultProps} />);
      const sliders = screen.getAllByRole('slider');
      fireEvent.change(sliders[0], { target: { value: '8' } });
      expect(sliders[0]).toHaveValue('8');
    });

    it('updates energy level when slider changes', () => {
      render(<DailyCheckinForm {...defaultProps} />);
      const sliders = screen.getAllByRole('slider');
      fireEvent.change(sliders[1], { target: { value: '3' } });
      expect(sliders[1]).toHaveValue('3');
    });

    it('updates mood rating when slider changes', () => {
      render(<DailyCheckinForm {...defaultProps} />);
      const sliders = screen.getAllByRole('slider');
      fireEvent.change(sliders[2], { target: { value: '9' } });
      expect(sliders[2]).toHaveValue('9');
    });

    it('displays stress level labels at endpoints', () => {
      render(<DailyCheckinForm {...defaultProps} />);
      expect(screen.getByText(/Calm \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/Crisis \(10\)/)).toBeInTheDocument();
    });

    it('displays energy level labels at endpoints', () => {
      render(<DailyCheckinForm {...defaultProps} />);
      expect(screen.getByText(/Drained \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/Energized \(10\)/)).toBeInTheDocument();
    });

    it('displays mood labels at endpoints', () => {
      render(<DailyCheckinForm {...defaultProps} />);
      expect(screen.getByText(/Terrible \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/Excellent \(10\)/)).toBeInTheDocument();
    });
  });

  // ========================================================================
  // CLARITY VS SHIELD PRODUCT LINES
  // ========================================================================

  describe('Clarity Product Line (default)', () => {
    it('shows Clarity-specific workload fields by default', () => {
      render(<DailyCheckinForm {...defaultProps} />);
      expect(screen.getByText('Workload (Optional)')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('# of patients')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('# of difficult calls')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('# of denials')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Hours beyond shift')).toBeInTheDocument();
    });

    it('does not show "Hospital Shift" in work setting dropdown', () => {
      render(<DailyCheckinForm {...defaultProps} productLine="clarity" />);
      const options = screen.getAllByRole('option');
      const optionTexts = options.map((o) => o.textContent);
      expect(optionTexts).not.toContain('Hospital Shift');
    });

    it('accepts numeric input for patients contacted', () => {
      render(<DailyCheckinForm {...defaultProps} />);
      const input = screen.getByPlaceholderText('# of patients');
      fireEvent.change(input, { target: { value: '12', name: 'patients_contacted_today', type: 'number' } });
      expect(input).toHaveValue(12);
    });
  });

  describe('Shield Product Line', () => {
    it('shows "Hospital Shift" option in work setting dropdown', () => {
      render(<DailyCheckinForm {...defaultProps} productLine="shield" />);
      const options = screen.getAllByRole('option');
      const optionTexts = options.map((o) => o.textContent);
      expect(optionTexts).toContain('Hospital Shift');
    });

    it('does not show Clarity-specific workload fields', () => {
      render(<DailyCheckinForm {...defaultProps} productLine="shield" />);
      expect(screen.queryByText('Workload (Optional)')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('# of patients')).not.toBeInTheDocument();
    });

    it('sets product_line to "shield" in form data', async () => {
      render(<DailyCheckinForm {...defaultProps} productLine="shield" />);
      submitForm();

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledTimes(1);
      });

      expect(mockSubmit.mock.calls[0][0].product_line).toBe('shield');
    });
  });

  // ========================================================================
  // CHECKBOX INTERACTIONS (Support & Self-Care)
  // ========================================================================

  describe('Support & Self-Care Checkboxes', () => {
    it('renders all four support checkboxes', () => {
      render(<DailyCheckinForm {...defaultProps} />);
      expect(screen.getByText('I felt overwhelmed today')).toBeInTheDocument();
      expect(screen.getByText('I skipped lunch or breaks')).toBeInTheDocument();
      expect(screen.getByText('I felt supported by my team')).toBeInTheDocument();
      expect(screen.getByText(/I worked after hours/)).toBeInTheDocument();
    });

    it('toggles overwhelmed checkbox', () => {
      render(<DailyCheckinForm {...defaultProps} />);
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).not.toBeChecked();
      fireEvent.click(checkboxes[0]);
      expect(checkboxes[0]).toBeChecked();
    });

    it('includes checkbox values in submission', async () => {
      render(<DailyCheckinForm {...defaultProps} />);

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]); // felt_overwhelmed
      fireEvent.click(checkboxes[1]); // missed_break

      submitForm();

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledTimes(1);
      });

      const callArgs = mockSubmit.mock.calls[0][0];
      expect(callArgs.felt_overwhelmed).toBe(true);
      expect(callArgs.missed_break).toBe(true);
      expect(callArgs.felt_supported_by_team).toBeFalsy();
      expect(callArgs.after_hours_work).toBeFalsy();
    });
  });

  // ========================================================================
  // FORM SUBMISSION
  // ========================================================================

  describe('Form Submission', () => {
    it('submits form data with default slider values', async () => {
      render(<DailyCheckinForm {...defaultProps} />);
      submitForm();

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledTimes(1);
      });

      const callArgs = mockSubmit.mock.calls[0][0];
      expect(callArgs.stress_level).toBe(5);
      expect(callArgs.energy_level).toBe(5);
      expect(callArgs.mood_rating).toBe(5);
      expect(callArgs.work_setting).toBe('remote');
      expect(callArgs.product_line).toBe('clarity');
    });

    it('submits form data with adjusted slider values', async () => {
      render(<DailyCheckinForm {...defaultProps} />);

      const sliders = screen.getAllByRole('slider');
      fireEvent.change(sliders[0], { target: { value: '8' } });
      fireEvent.change(sliders[1], { target: { value: '3' } });
      fireEvent.change(sliders[2], { target: { value: '2' } });

      submitForm();

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledTimes(1);
      });

      const callArgs = mockSubmit.mock.calls[0][0];
      expect(callArgs.stress_level).toBe(8);
      expect(callArgs.energy_level).toBe(3);
      expect(callArgs.mood_rating).toBe(2);
    });

    it('submits with changed work setting', async () => {
      render(<DailyCheckinForm {...defaultProps} />);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'office' } });
      submitForm();

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledTimes(1);
      });

      expect(mockSubmit.mock.calls[0][0].work_setting).toBe('office');
    });

    it('includes notes in submission', async () => {
      render(<DailyCheckinForm {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText(/Anything else on your mind/), {
        target: { value: 'Tough day, but manageable', name: 'notes' },
      });
      submitForm();

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledTimes(1);
      });

      expect(mockSubmit.mock.calls[0][0].notes).toBe('Tough day, but manageable');
    });

    it('shows success message after successful submission', async () => {
      render(<DailyCheckinForm {...defaultProps} />);
      submitForm();
      expect(await screen.findByText(/Check-in saved/)).toBeInTheDocument();
    });

    it('shows loading state during submission', async () => {
      mockSubmit.mockImplementation(() => new Promise(() => {}));
      render(<DailyCheckinForm {...defaultProps} />);
      submitForm();
      expect(await screen.findByText('Saving...')).toBeInTheDocument();
    });

    it('disables submit button during submission', async () => {
      mockSubmit.mockImplementation(() => new Promise(() => {}));
      render(<DailyCheckinForm {...defaultProps} />);
      submitForm();
      const savingButton = await screen.findByText('Saving...');
      expect(savingButton).toBeDisabled();
    });
  });

  // ========================================================================
  // ERROR HANDLING
  // ========================================================================

  describe('Error Handling', () => {
    it('shows error message when submission returns failure', async () => {
      mockSubmit.mockResolvedValueOnce({
        success: false, data: null,
        error: { code: 'DATABASE_ERROR', message: 'Network timeout' },
      } as never);
      render(<DailyCheckinForm {...defaultProps} />);
      submitForm();
      expect(await screen.findByText('Network timeout')).toBeInTheDocument();
    });

    it('shows specific error message from ServiceResult', async () => {
      mockSubmit.mockResolvedValueOnce({
        success: false, data: null,
        error: { code: 'NOT_FOUND', message: 'Practitioner record not found' },
      } as never);
      render(<DailyCheckinForm {...defaultProps} />);
      submitForm();
      expect(await screen.findByText('Practitioner record not found')).toBeInTheDocument();
    });

    it('re-enables submit button after error', async () => {
      mockSubmit.mockResolvedValueOnce({
        success: false, data: null,
        error: { code: 'DATABASE_ERROR', message: 'Server error' },
      } as never);
      render(<DailyCheckinForm {...defaultProps} />);
      submitForm();
      await screen.findByText('Server error');
      expect(screen.getByRole('button', { name: /save check-in/i })).not.toBeDisabled();
    });

    it('clears previous error when form is re-submitted successfully', async () => {
      mockSubmit.mockResolvedValueOnce({
        success: false, data: null,
        error: { code: 'DATABASE_ERROR', message: 'First failure' },
      } as never);
      render(<DailyCheckinForm {...defaultProps} />);

      // First submission fails
      submitForm();
      await screen.findByText('First failure');

      // Second submission succeeds
      mockSubmit.mockResolvedValueOnce({ success: true, data: {}, error: null } as never);
      submitForm();

      await waitFor(() => {
        expect(screen.queryByText('First failure')).not.toBeInTheDocument();
      });
    });
  });

  // ========================================================================
  // NOTES & CANCEL
  // ========================================================================

  describe('Notes Field', () => {
    it('renders notes textarea with privacy placeholder', () => {
      render(<DailyCheckinForm {...defaultProps} />);
      expect(screen.getByPlaceholderText(/Anything else on your mind/)).toBeInTheDocument();
    });

    it('accepts text input in notes', () => {
      render(<DailyCheckinForm {...defaultProps} />);
      const textarea = screen.getByPlaceholderText(/Anything else on your mind/);
      fireEvent.change(textarea, { target: { value: 'Need to talk to someone', name: 'notes' } });
      expect(textarea).toHaveValue('Need to talk to someone');
    });
  });

  describe('Cancel Behavior', () => {
    it('calls onClose when Cancel is clicked', () => {
      render(<DailyCheckinForm {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('does not submit the form when Cancel is clicked', () => {
      render(<DailyCheckinForm {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(mockSubmit).not.toHaveBeenCalled();
    });
  });
});
