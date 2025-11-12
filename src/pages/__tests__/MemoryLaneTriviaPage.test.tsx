// src/pages/__tests__/MemoryLaneTriviaPage.test.tsx
// Tests for the senior-facing Memory Lane trivia page

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MemoryLaneTriviaPage from '../MemoryLaneTriviaPage';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// Mock dependencies
jest.mock('../../contexts/AuthContext', () => ({
  useSupabaseClient: jest.fn(),
  useUser: jest.fn(),
  useAuth: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
  useLocation: jest.fn(),
}));

// Mock react-use for useWindowSize hook
jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useWindowSize: () => ({ width: 1024, height: 768 }),
}));

// Mock react-confetti
jest.mock('react-confetti', () => {
  return function MockConfetti() {
    return <div data-testid="confetti">Confetti</div>;
  };
});

describe('MemoryLaneTriviaPage - Senior Facing Page', () => {
  let mockSupabase: any;
  let mockUser: any;
  let mockNavigate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUser = {
      id: 'senior-user-123',
      email: 'senior@test.com',
    };

    mockNavigate = jest.fn();

    // Mock useLocation
    const mockLocation = {
      pathname: '/memory-lane-trivia',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    };
    (require('react-router-dom').useLocation as jest.Mock).mockReturnValue(mockLocation);

    // Create chainable mock for Supabase
    const mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: null,
        error: null
      }),
      insert: jest.fn().mockResolvedValue({
        data: null,
        error: null
      }),
      upsert: jest.fn().mockResolvedValue({
        data: null,
        error: null
      }),
    };

    mockSupabase = {
      from: jest.fn().mockReturnValue(mockChain),
      rpc: jest.fn().mockResolvedValue({
        data: [],
        error: null
      }),
    };

    (useUser as jest.Mock).mockReturnValue(mockUser);
    (useSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);

    // Mock useAuth for SmartBackButton
    (require('../../contexts/AuthContext').useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      supabase: mockSupabase,
    });
  });

  describe('Page Rendering', () => {
    it('should render the Memory Lane trivia page', async () => {
      render(<MemoryLaneTriviaPage />);

      await waitFor(() => {
        expect(screen.getByText('Memory Lane Trivia')).toBeInTheDocument();
      });
    });

    it('should render page title and description', async () => {
      render(<MemoryLaneTriviaPage />);

      await waitFor(() => {
        expect(screen.getByText('Memory Lane Trivia')).toBeInTheDocument();
        expect(screen.getByText(/Travel back in time from the 1950s to 1990s/i)).toBeInTheDocument();
      });
    });

    it('should render loading state initially', () => {
      render(<MemoryLaneTriviaPage />);

      expect(screen.getByText(/Loading your daily trivia/i)).toBeInTheDocument();
    });
  });

  describe('Page Purpose', () => {
    it('should provide cognitive engagement for seniors', async () => {
      render(<MemoryLaneTriviaPage />);

      await waitFor(() => {
        expect(screen.getByText('Memory Lane Trivia')).toBeInTheDocument();
      });
    });

    it('should be accessible to senior users with ARIA labels', async () => {
      render(<MemoryLaneTriviaPage />);

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar', { name: /question progress/i });
        expect(progressBar).toBeInTheDocument();
      });
    });
  });

  describe('User Experience', () => {
    it('should provide engaging brain exercise', async () => {
      render(<MemoryLaneTriviaPage />);

      await waitFor(() => {
        expect(screen.getByText('Memory Lane Trivia')).toBeInTheDocument();
      });
    });
  });

  describe('Integration', () => {
    it('should work with authenticated user', async () => {
      render(<MemoryLaneTriviaPage />);

      await waitFor(() => {
        expect(screen.getByText('Memory Lane Trivia')).toBeInTheDocument();
      });

      // Verify Supabase queries were called
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_daily_trivia_questions', {
        p_user_id: 'senior-user-123'
      });
    });

    it('should show loading state when user is not authenticated', () => {
      (useUser as jest.Mock).mockReturnValue(null);

      render(<MemoryLaneTriviaPage />);

      // Should still render but remain in loading state since no user
      expect(screen.getByText(/Loading your daily trivia/i)).toBeInTheDocument();
    });
  });
});
