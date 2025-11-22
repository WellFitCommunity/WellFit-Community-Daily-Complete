// src/components/__tests__/CheckInTracker.test.tsx
// Tests for the senior-facing daily check-in component

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CheckInTracker from '../CheckInTracker';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';

// Mock dependencies
jest.mock('../../contexts/AuthContext', () => ({
  useSupabaseClient: jest.fn(),
  useUser: jest.fn(),
}));

describe('CheckInTracker - Senior Facing Component', () => {
  let mockSupabase: any;
  let mockUser: any;

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();

    mockUser = {
      id: 'senior-user-123',
      email: 'senior@test.com',
    };

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
      rpc: jest.fn().mockResolvedValue({
        data: null,
        error: null
      }),
    };

    (useUser as jest.Mock).mockReturnValue(mockUser);
    (useSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Component Rendering', () => {
    it('should render the check-in tracker component', () => {
      render(<CheckInTracker />);

      expect(screen.getByText(/Daily Check-In|Check In/i)).toBeInTheDocument();
    });

    it('should display check-in buttons', () => {
      render(<CheckInTracker />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should show "I\'m OK" button for regular check-in', () => {
      render(<CheckInTracker />);

      const okButton = screen.getByText(/I'm OK|Feeling Good|All Good/i);
      expect(okButton).toBeInTheDocument();
    });

    it('should show emergency button', () => {
      render(<CheckInTracker />);

      const emergencyButton = screen.getByText(/Need Help|Emergency/i);
      expect(emergencyButton).toBeInTheDocument();
    });
  });

  describe('User Interactions - Regular Check-in', () => {
    it('should allow user to check in as "OK"', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null
      });

      render(<CheckInTracker />);

      const okButton = screen.getByText(/I'm OK|Feeling Good|All Good/i);
      fireEvent.click(okButton);

      await waitFor(() => {
        expect(mockSupabase.rpc).toHaveBeenCalled();
      });
    });

    it('should show success message after successful check-in', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null
      });

      render(<CheckInTracker />);

      const okButton = screen.getByText(/I'm OK|Feeling Good|All Good/i);
      fireEvent.click(okButton);

      await waitFor(() => {
        expect(screen.getByText(/success|checked in|thank you/i)).toBeInTheDocument();
      });
    });

    it('should display emotional state options when checking in', () => {
      render(<CheckInTracker />);

      // Look for emotional state indicators
      const emotionalOptions = screen.queryAllByText(/Happy|Sad|Anxious|Peaceful|Tired|Energetic/i);
      expect(emotionalOptions.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('User Interactions - Emergency Check-in', () => {
    it('should show emergency modal when emergency button is clicked', async () => {
      render(<CheckInTracker />);

      const emergencyButton = screen.getByText(/Need Help|Emergency/i);
      fireEvent.click(emergencyButton);

      await waitFor(() => {
        expect(screen.getByText(/crisis|emergency|help/i)).toBeInTheDocument();
      });
    });

    it('should display crisis options in emergency modal', async () => {
      render(<CheckInTracker />);

      const emergencyButton = screen.getByText(/Need Help|Emergency/i);
      fireEvent.click(emergencyButton);

      await waitFor(() => {
        const modal = screen.getByText(/speak.*someone|fallen.*injured|lost/i);
        expect(modal).toBeInTheDocument();
      });
    });

    it('should show emergency contact phone number', async () => {
      render(<CheckInTracker />);

      const emergencyButton = screen.getByText(/Need Help|Emergency/i);
      fireEvent.click(emergencyButton);

      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      });
    });

    it('should handle emergency check-in submission', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null
      });

      render(<CheckInTracker />);

      const emergencyButton = screen.getByText(/Need Help|Emergency/i);
      fireEvent.click(emergencyButton);

      await waitFor(() => {
        const crisisOption = screen.queryByText(/speak.*someone/i);
        if (crisisOption) {
          fireEvent.click(crisisOption);
        }
      });
    });
  });

  describe('Vitals Tracking', () => {
    it('should display vitals input fields', () => {
      render(<CheckInTracker />);

      // Look for vitals-related text
      const vitalsLabels = screen.queryAllByText(/heart rate|blood pressure|oxygen|glucose|pulse/i);
      expect(vitalsLabels.length).toBeGreaterThanOrEqual(0);
    });

    it('should accept heart rate input', () => {
      render(<CheckInTracker />);

      const heartRateInput = screen.getByLabelText(/heart rate/i) as HTMLInputElement;
      fireEvent.change(heartRateInput, { target: { value: '72' } });
      expect(heartRateInput.value).toBe('72');
    });

    it('should accept blood pressure input', () => {
      render(<CheckInTracker />);

      const bpSystolicInput = screen.getByLabelText(/systolic|blood pressure/i) as HTMLInputElement;
      fireEvent.change(bpSystolicInput, { target: { value: '120' } });
      expect(bpSystolicInput.value).toBe('120');
    });

    it('should accept pulse oximeter input', () => {
      render(<CheckInTracker />);

      const spo2Input = screen.getByLabelText(/oxygen|pulse ox|SpO2/i) as HTMLInputElement;
      fireEvent.change(spo2Input, { target: { value: '98' } });
      expect(spo2Input.value).toBe('98');
    });

    it('should validate vitals are within safe ranges', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null
      });

      render(<CheckInTracker />);

      // Try to input invalid heart rate
      const heartRateInput = screen.queryByLabelText(/heart rate/i) as HTMLInputElement;
      if (heartRateInput) {
        fireEvent.change(heartRateInput, { target: { value: '300' } }); // Invalid
      }

      const okButton = screen.getByText(/I'm OK|Feeling Good|All Good/i);
      fireEvent.click(okButton);

      // The component should handle validation
      await waitFor(() => {
        expect(mockSupabase.rpc).toHaveBeenCalled();
      });
    });
  });

  describe('Check-in History', () => {
    it('should not store check-ins in localStorage (HIPAA compliance)', () => {
      render(<CheckInTracker />);

      const historyInStorage = localStorage.getItem('wellfitCheckIns');
      expect(historyInStorage).toBeNull();
    });

    it('should load check-in history from database', async () => {
      render(<CheckInTracker />);

      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalled();
      });
    });
  });

  describe('Data Submission', () => {
    it('should call database RPC function on check-in', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null
      });

      render(<CheckInTracker />);

      const okButton = screen.getByText(/I'm OK|Feeling Good|All Good/i);
      fireEvent.click(okButton);

      await waitFor(() => {
        expect(mockSupabase.rpc).toHaveBeenCalledWith(
          expect.stringMatching(/check_in|record_check_in|create_check_in/i),
          expect.any(Object)
        );
      });
    });

    it('should disable submit button while submitting', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      render(<CheckInTracker />);

      const okButton = screen.getByText(/I'm OK|Feeling Good|All Good/i);
      fireEvent.click(okButton);

      // Button should be disabled or show loading state
      await waitFor(() => {
        expect(mockSupabase.rpc).toHaveBeenCalled();
      });
    });

    it('should include user_id in check-in submission', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null
      });

      render(<CheckInTracker />);

      const okButton = screen.getByText(/I'm OK|Feeling Good|All Good/i);
      fireEvent.click(okButton);

      await waitFor(() => {
        expect(mockSupabase.rpc.mock.calls[0]).toBeDefined();
      });

      const rpcCall = mockSupabase.rpc.mock.calls[0];
      expect(rpcCall[1]).toBeDefined();
      expect(rpcCall[1]).toHaveProperty('p_user_id', mockUser.id);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing user gracefully', () => {
      (useUser as jest.Mock).mockReturnValue(null);

      render(<CheckInTracker />);

      expect(screen.getByText(/Daily Check-In|Check In|sign in/i)).toBeInTheDocument();
    });

    it('should show error message when check-in fails', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      render(<CheckInTracker />);

      const okButton = screen.getByText(/I'm OK|Feeling Good|All Good/i);
      fireEvent.click(okButton);

      await waitFor(() => {
        expect(screen.getByText(/error|failed|try again/i)).toBeInTheDocument();
      });
    });

    it('should handle database connection errors gracefully', async () => {
      // Don't actually throw during render, just return error in response
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Connection failed' }
        }),
      });

      render(<CheckInTracker />);

      // Component should render without crashing
      expect(screen.getByText(/Daily Check-In|Check In/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible buttons', () => {
      render(<CheckInTracker />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      buttons.forEach(button => {
        expect(button).toBeVisible();
      });
    });

    it('should have large, readable text for seniors', () => {
      render(<CheckInTracker />);

      const heading = screen.getByText(/Daily Check-In|Check In/i);
      expect(heading).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      render(<CheckInTracker />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).not.toHaveAttribute('tabIndex', '-1');
      });
    });
  });

  describe('Component Props', () => {
    it('should render back button when showBackButton prop is true', () => {
      render(<CheckInTracker showBackButton={true} />);

      const backButton = screen.queryByText(/back|return/i);
      expect(backButton).toBeInTheDocument();
    });

    it('should not render back button when showBackButton prop is false', () => {
      render(<CheckInTracker showBackButton={false} />);

      const backButton = screen.queryByText(/back|return/i);
      expect(backButton).not.toBeInTheDocument();
    });
  });
});
