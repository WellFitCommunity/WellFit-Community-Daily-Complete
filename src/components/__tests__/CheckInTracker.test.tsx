// src/components/__tests__/CheckInTracker.test.tsx
// Tests for the senior-facing daily check-in component
// Tests match ACTUAL component UI

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import CheckInTracker from '../CheckInTracker';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';

// Helper to render with router
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

// Mock scrollIntoView which is not available in jsdom
Element.prototype.scrollIntoView = jest.fn();

// Mock dependencies
jest.mock('../../contexts/AuthContext', () => ({
  useSupabaseClient: jest.fn(),
  useUser: jest.fn(),
}));

describe('CheckInTracker - Senior Facing Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const mockUser = {
      id: 'senior-user-123',
      email: 'senior@test.com',
    };

    // Mock supabase with functions.invoke for edge function calls
    const mockSupabase = {
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
      renderWithRouter(<CheckInTracker />);

      expect(screen.getByText(/Daily Check-In Center/i)).toBeInTheDocument();
    });

    it('should display quick check-in buttons', () => {
      renderWithRouter(<CheckInTracker />);

      expect(screen.getByText('😊 Feeling Great Today')).toBeInTheDocument();
      expect(screen.getByText('📅 Feeling fine & have a Dr. Appt today')).toBeInTheDocument();
      expect(screen.getByText('🏥 In the hospital')).toBeInTheDocument();
      expect(screen.getByText('🤒 Not Feeling My Best')).toBeInTheDocument();
      expect(screen.getByText('🧭 Need Healthcare Navigation Assistance')).toBeInTheDocument();
      expect(screen.getByText('⭐ Attending the event today')).toBeInTheDocument();
    });

    it('should display the mood dropdown', () => {
      renderWithRouter(<CheckInTracker />);

      const moodSelect = screen.getByLabelText(/Select your mood today/i);
      expect(moodSelect).toBeInTheDocument();
    });

    it('should display vitals input fields', () => {
      renderWithRouter(<CheckInTracker />);

      // Use placeholder text since labels don't have htmlFor
      expect(screen.getByPlaceholderText('e.g., 70')).toBeInTheDocument(); // Heart rate
      expect(screen.getByPlaceholderText('e.g., 98')).toBeInTheDocument(); // Blood oxygen
      expect(screen.getByPlaceholderText('Top number')).toBeInTheDocument(); // Systolic
      expect(screen.getByPlaceholderText('Bottom number')).toBeInTheDocument(); // Diastolic
      expect(screen.getByPlaceholderText('e.g., 120')).toBeInTheDocument(); // Glucose
    });

    it('should have submit button disabled when no mood selected', () => {
      renderWithRouter(<CheckInTracker />);

      const submitButton = screen.getByText(/Save My Health Report/i);
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Quick Check-in Flow', () => {
    it('should show success message after quick check-in', async () => {
      renderWithRouter(<CheckInTracker />);

      const feelingGreatButton = screen.getByText('😊 Feeling Great Today');
      fireEvent.click(feelingGreatButton);

      await waitFor(() => {
        // Component shows feedback with "(Saved to cloud)" for logged-in users
        expect(screen.getByRole('status')).toHaveTextContent(/Saved to cloud/i);
      });
    });
  });

  describe('Detailed Check-in Form', () => {
    it('should enable submit when mood is selected', () => {
      renderWithRouter(<CheckInTracker />);

      const moodSelect = screen.getByLabelText(/Select your mood today/i);
      // Use a valid mood option from MOOD_OPTIONS: 'Great', 'Good', 'Okay', etc.
      fireEvent.change(moodSelect, { target: { value: 'Good' } });

      const submitButton = screen.getByText(/Save My Health Report/i);
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Crisis Options Flow', () => {
    it('should show crisis options when clicking "Not Feeling My Best"', async () => {
      renderWithRouter(<CheckInTracker />);

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

      renderWithRouter(<CheckInTracker />);

      const feelingGreatButton = screen.getByText('😊 Feeling Great Today');
      fireEvent.click(feelingGreatButton);

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/Saved locally/i);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes on mood select', () => {
      renderWithRouter(<CheckInTracker />);

      const moodSelect = screen.getByLabelText(/Select your mood today/i);
      expect(moodSelect).toHaveAttribute('aria-required', 'true');
    });

    it('should have role="status" on feedback messages', async () => {
      renderWithRouter(<CheckInTracker />);

      const feelingGreatButton = screen.getByText('😊 Feeling Great Today');
      fireEvent.click(feelingGreatButton);

      await waitFor(() => {
        const feedback = screen.getByRole('status');
        expect(feedback).toBeInTheDocument();
      });
    });
  });
});
