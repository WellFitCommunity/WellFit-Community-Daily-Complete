// src/components/__tests__/CheckInTracker.test.tsx
// Tests for the senior-facing daily check-in component
// Tests match ACTUAL component UI - title "Check-In Center", buttons as defined in component

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CheckInTracker from '../CheckInTracker';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';

// Mock scrollIntoView which is not available in jsdom
Element.prototype.scrollIntoView = jest.fn();

// Mock dependencies
jest.mock('../../contexts/AuthContext', () => ({
  useSupabaseClient: jest.fn(),
  useUser: jest.fn(),
}));

describe('CheckInTracker - Senior Facing Component', () => {
  let mockSupabase: any;
  let mockUser: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUser = {
      id: 'senior-user-123',
      email: 'senior@test.com',
    };

    // Mock supabase with functions.invoke for edge function calls
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { emergency_contact_phone: '+15551234567' },
        error: null
      }),
      functions: {
        invoke: jest.fn().mockResolvedValue({ data: null, error: null })
      }
    };

    (useUser as jest.Mock).mockReturnValue(mockUser);
    (useSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe('Component Rendering', () => {
    it('should render the check-in center title', () => {
      render(<CheckInTracker />);

      // Actual component title is "Check-In Center"
      expect(screen.getByText('Check-In Center')).toBeInTheDocument();
    });

    it('should display quick check-in buttons', () => {
      render(<CheckInTracker />);

      // These are the actual buttons defined in the component
      expect(screen.getByText('😊 Feeling Great Today')).toBeInTheDocument();
      expect(screen.getByText('📅 Feeling fine & have a Dr. Appt today')).toBeInTheDocument();
      expect(screen.getByText('🏥 In the hospital')).toBeInTheDocument();
      expect(screen.getByText('🤒 Not Feeling My Best')).toBeInTheDocument();
      expect(screen.getByText('🧭 Need Healthcare Navigation Assistance')).toBeInTheDocument();
      expect(screen.getByText('⭐ Attending the event today')).toBeInTheDocument();
    });

    it('should display the emotional state dropdown', () => {
      render(<CheckInTracker />);

      expect(screen.getByLabelText(/Emotional State/i)).toBeInTheDocument();
    });

    it('should display vitals input fields', () => {
      render(<CheckInTracker />);

      expect(screen.getByLabelText(/Heart Rate/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Pulse Oximeter/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Systolic/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Diastolic/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Glucose/i)).toBeInTheDocument();
    });

    it('should have submit button disabled when no emotional state selected', () => {
      render(<CheckInTracker />);

      const submitButton = screen.getByText('Submit Check-In Details');
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Quick Check-in Flow', () => {
    it('should call edge function when clicking "Feeling Great Today"', async () => {
      render(<CheckInTracker />);

      const feelingGreatButton = screen.getByText('😊 Feeling Great Today');
      fireEvent.click(feelingGreatButton);

      await waitFor(() => {
        expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
          'create-checkin',
          expect.objectContaining({
            body: expect.objectContaining({
              label: '😊 Feeling Great Today',
              is_quick: true
            })
          })
        );
      });
    });

    it('should show success message after quick check-in', async () => {
      render(<CheckInTracker />);

      const feelingGreatButton = screen.getByText('😊 Feeling Great Today');
      fireEvent.click(feelingGreatButton);

      await waitFor(() => {
        // Component shows feedback with "(Saved to cloud)" for logged-in users
        expect(screen.getByRole('status')).toHaveTextContent(/Saved to cloud/i);
      });
    });
  });

  describe('Detailed Check-in Form', () => {
    it('should enable submit when emotional state is selected', async () => {
      render(<CheckInTracker />);

      const emotionalStateSelect = screen.getByLabelText(/Emotional State/i);
      fireEvent.change(emotionalStateSelect, { target: { value: 'Happy' } });

      const submitButton = screen.getByText('Submit Check-In Details');
      expect(submitButton).not.toBeDisabled();
    });

    it('should submit detailed check-in with form data', async () => {
      render(<CheckInTracker />);

      // Fill in the form
      fireEvent.change(screen.getByLabelText(/Emotional State/i), { target: { value: 'Happy' } });
      fireEvent.change(screen.getByLabelText(/Heart Rate/i), { target: { value: '72' } });
      fireEvent.change(screen.getByLabelText(/Pulse Oximeter/i), { target: { value: '98' } });

      // Submit
      const submitButton = screen.getByText('Submit Check-In Details');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
          'create-checkin',
          expect.objectContaining({
            body: expect.objectContaining({
              label: 'Daily Self-Report',
              is_quick: false,
              emotional_state: 'Happy',
              heart_rate: 72,
              pulse_oximeter: 98
            })
          })
        );
      });
    });
  });

  describe('Crisis Options Flow', () => {
    it('should show crisis options when clicking "Not Feeling My Best"', async () => {
      render(<CheckInTracker />);

      const notFeelingBestButton = screen.getByText('🤒 Not Feeling My Best');
      fireEvent.click(notFeelingBestButton);

      // Component shows crisis options modal with title "How can we help you?"
      await waitFor(() => {
        expect(screen.getByText('How can we help you?')).toBeInTheDocument();
      });
    });
  });

  describe('Unauthenticated User', () => {
    it('should show local save message when user is not logged in', async () => {
      (useUser as jest.Mock).mockReturnValue(null);

      render(<CheckInTracker />);

      const feelingGreatButton = screen.getByText('😊 Feeling Great Today');
      fireEvent.click(feelingGreatButton);

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/Saved locally/i);
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error message when edge function fails', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: new Error('Network error')
      });

      render(<CheckInTracker />);

      const feelingGreatButton = screen.getByText('😊 Feeling Great Today');
      fireEvent.click(feelingGreatButton);

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/Cloud save failed/i);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes on form elements', () => {
      render(<CheckInTracker />);

      const emotionalStateSelect = screen.getByLabelText(/Emotional State/i);
      expect(emotionalStateSelect).toHaveAttribute('aria-required', 'true');
    });

    it('should have role="status" on feedback messages', async () => {
      render(<CheckInTracker />);

      const feelingGreatButton = screen.getByText('😊 Feeling Great Today');
      fireEvent.click(feelingGreatButton);

      await waitFor(() => {
        const feedback = screen.getByRole('status');
        expect(feedback).toBeInTheDocument();
      });
    });
  });
});
