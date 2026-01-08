/**
 * Tests for PhysicianDailyCheckin Component
 *
 * Purpose: Daily wellness check-in form for physicians with medical-themed UI
 * Tests: Form rendering, slider inputs, checkboxes, validation, submission
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhysicianDailyCheckin } from '../PhysicianDailyCheckin';

// Mock AuthContext
vi.mock('../../../contexts/AuthContext', () => ({
  useUser: vi.fn(() => ({ id: 'user-123', email: 'doctor@hospital.com' })),
}));

// Mock resilienceHubService
const mockSubmitDailyCheckin = vi.fn();
vi.mock('../../../services/resilienceHubService', () => ({
  submitDailyCheckin: (data: unknown) => mockSubmitDailyCheckin(data),
}));

describe('PhysicianDailyCheckin', () => {
  const mockOnSuccess = vi.fn();
  const mockOnClose = vi.fn();
  const defaultProps = {
    onSuccess: mockOnSuccess,
    onClose: mockOnClose,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmitDailyCheckin.mockResolvedValue(undefined);
  });

  describe('Rendering', () => {
    it('should render the daily checkin form', () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      expect(screen.getByText(/Dr's Orders: Daily Wellness Check/)).toBeInTheDocument();
    });

    it('should render the 60-second tagline', () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      expect(screen.getByText('Quick 60-second self-assessment')).toBeInTheDocument();
    });

    it('should render Rx prescription joke', () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      expect(screen.getByText(/Rx: Take 1 minute to check in/)).toBeInTheDocument();
    });

    it('should render close button', () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      expect(screen.getByText('×')).toBeInTheDocument();
    });

    it('should render work setting dropdown', () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      expect(screen.getByText(/Work Setting Today/)).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should render Submit and Cancel buttons', () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Submit Check-In/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });
  });

  describe('Vitals Section', () => {
    it('should render stress level slider', () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      expect(screen.getByText(/Stress Level/)).toBeInTheDocument();
      expect(screen.getByText('😌 Zen')).toBeInTheDocument();
      expect(screen.getByText('😰 Maxed')).toBeInTheDocument();
    });

    it('should render energy level slider', () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      expect(screen.getByText(/Energy Level/)).toBeInTheDocument();
      expect(screen.getByText('😴 Exhausted')).toBeInTheDocument();
      expect(screen.getByText('⚡ Energized')).toBeInTheDocument();
    });

    it('should render mood rating slider', () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      expect(screen.getByText(/Mood Rating/)).toBeInTheDocument();
      expect(screen.getByText('😢 Low')).toBeInTheDocument();
      expect(screen.getByText('😄 Great')).toBeInTheDocument();
    });
  });

  describe('Physician-Specific Section', () => {
    it('should render prior auth frustration slider', () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      expect(screen.getByText(/Prior Auth Frustration Level/)).toBeInTheDocument();
      expect(screen.getByText('😊 Smooth')).toBeInTheDocument();
      expect(screen.getByText('🤬 Nightmare')).toBeInTheDocument();
    });

    it('should render clinical complexity slider', () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      expect(screen.getByText(/Clinical Complexity Today/)).toBeInTheDocument();
      expect(screen.getByText('🟢 Routine')).toBeInTheDocument();
      expect(screen.getByText('🔴 Complex')).toBeInTheDocument();
    });

    it('should render charting burden slider', () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      expect(screen.getByText(/Charting Burden/)).toBeInTheDocument();
      expect(screen.getByText('📝 Manageable')).toBeInTheDocument();
      expect(screen.getByText('📚 Overwhelming')).toBeInTheDocument();
    });
  });

  describe('Workload Metrics', () => {
    it('should render patients seen input', () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      expect(screen.getByText(/Patients Seen Today/)).toBeInTheDocument();
    });

    it('should render overtime hours input', () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      expect(screen.getByText(/Overtime Hours/)).toBeInTheDocument();
    });
  });

  describe('Yes/No Questions', () => {
    it('should render had lunch toggle', () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      expect(screen.getByText(/Had time for lunch\?/)).toBeInTheDocument();
    });

    it('should render felt overwhelmed toggle', () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      expect(screen.getByText(/Felt overwhelmed today\?/)).toBeInTheDocument();
    });

    it('should render felt supported toggle', () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      expect(screen.getByText(/Felt supported by team\?/)).toBeInTheDocument();
    });
  });

  describe('Work Setting Options', () => {
    it('should have all work setting options', () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      expect(screen.getByText('Office/Clinic')).toBeInTheDocument();
      expect(screen.getByText('Telehealth')).toBeInTheDocument();
      expect(screen.getByText('Hospital')).toBeInTheDocument();
      expect(screen.getByText('Remote')).toBeInTheDocument();
      expect(screen.getByText('Skilled Nursing')).toBeInTheDocument();
    });

    it('should update work setting when selected', async () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      const select = screen.getByRole('combobox');
      await userEvent.selectOptions(select, 'telehealth');

      expect(select).toHaveValue('telehealth');
    });
  });

  describe('Notes Field', () => {
    it('should render notes textarea', () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      expect(screen.getByText(/Notes \(Optional\)/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Anything else on your mind today?')).toBeInTheDocument();
    });

    it('should update notes when typed', async () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      const textarea = screen.getByPlaceholderText('Anything else on your mind today?');
      await userEvent.type(textarea, 'Tough day with prior auths');

      expect(textarea).toHaveValue('Tough day with prior auths');
    });
  });

  describe('Form Submission', () => {
    it('should call submitDailyCheckin on valid submission', async () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /Submit Check-In/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSubmitDailyCheckin).toHaveBeenCalled();
      });
    });

    it('should call onSuccess after successful submission', async () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /Submit Check-In/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should show loading state during submission', async () => {
      mockSubmitDailyCheckin.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<PhysicianDailyCheckin {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /Submit Check-In/i });
      await userEvent.click(submitButton);

      expect(screen.getByText('Submitting...')).toBeInTheDocument();
    });

    it('should disable submit button during submission', async () => {
      mockSubmitDailyCheckin.mockImplementation(() => new Promise(() => {}));

      render(<PhysicianDailyCheckin {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /Submit Check-In/i });
      await userEvent.click(submitButton);

      expect(submitButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should display error when submission fails', async () => {
      mockSubmitDailyCheckin.mockRejectedValue(new Error('Submission failed'));

      render(<PhysicianDailyCheckin {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /Submit Check-In/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Submission failed')).toBeInTheDocument();
      });
    });

    it('should not call onSuccess when submission fails', async () => {
      mockSubmitDailyCheckin.mockRejectedValue(new Error('Submission failed'));

      render(<PhysicianDailyCheckin {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /Submit Check-In/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Submission failed')).toBeInTheDocument();
      });

      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });

  describe('Cancel Action', () => {
    it('should call onClose when Cancel button is clicked', async () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await userEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when close button is clicked', async () => {
      render(<PhysicianDailyCheckin {...defaultProps} />);

      const closeButton = screen.getByText('×');
      await userEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Form Styling', () => {
    it('should have proper container styling', () => {
      const { container } = render(<PhysicianDailyCheckin {...defaultProps} />);

      const formContainer = container.querySelector('.bg-white.rounded-lg.shadow-xl');
      expect(formContainer).toBeInTheDocument();
    });

    it('should have blue vitals section', () => {
      const { container } = render(<PhysicianDailyCheckin {...defaultProps} />);

      const vitalsSection = container.querySelector('.bg-blue-50');
      expect(vitalsSection).toBeInTheDocument();
    });

    it('should have orange physician-specific section', () => {
      const { container } = render(<PhysicianDailyCheckin {...defaultProps} />);

      const physicianSection = container.querySelector('.bg-orange-50');
      expect(physicianSection).toBeInTheDocument();
    });
  });
});
