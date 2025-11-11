// src/pages/__tests__/CheckInPage.test.tsx
// Tests for the senior-facing check-in page

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CheckInPage from '../CheckInPage';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';

// Mock dependencies
jest.mock('../../contexts/AuthContext', () => ({
  useSupabaseClient: jest.fn(),
  useUser: jest.fn(),
}));

jest.mock('../../components/CheckInTracker', () => {
  return function MockCheckInTracker({ showBackButton }: { showBackButton?: boolean }) {
    return (
      <div data-testid="check-in-tracker">
        <div>Check In Tracker Component</div>
        {showBackButton && <div>Back Button Enabled</div>}
      </div>
    );
  };
});

describe('CheckInPage - Senior Facing Page', () => {
  let mockSupabase: any;
  let mockUser: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUser = {
      id: 'senior-user-123',
      email: 'senior@test.com',
    };

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { emergency_contact_phone: '+15551234567' },
        error: null
      }),
    };

    (useUser as jest.Mock).mockReturnValue(mockUser);
    (useSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe('Page Rendering', () => {
    it('should render the check-in page', () => {
      render(<CheckInPage />);

      expect(screen.getByTestId('check-in-tracker')).toBeInTheDocument();
    });

    it('should render CheckInTracker component', () => {
      render(<CheckInPage />);

      expect(screen.getByText(/Check In Tracker Component/i)).toBeInTheDocument();
    });

    it('should pass showBackButton prop as true', () => {
      render(<CheckInPage />);

      expect(screen.getByText(/Back Button Enabled/i)).toBeInTheDocument();
    });
  });

  describe('Page Structure', () => {
    it('should be a simple wrapper around CheckInTracker', () => {
      const { container } = render(<CheckInPage />);

      const checkInTracker = screen.getByTestId('check-in-tracker');
      expect(checkInTracker).toBeInTheDocument();
      expect(container.children.length).toBe(1);
    });
  });

  describe('User Experience', () => {
    it('should provide back navigation option', () => {
      render(<CheckInPage />);

      expect(screen.getByText(/Back Button Enabled/i)).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('should work with authenticated user', () => {
      render(<CheckInPage />);

      expect(screen.getByTestId('check-in-tracker')).toBeInTheDocument();
    });

    it('should work when user is not authenticated', () => {
      (useUser as jest.Mock).mockReturnValue(null);

      render(<CheckInPage />);

      expect(screen.getByTestId('check-in-tracker')).toBeInTheDocument();
    });
  });
});
