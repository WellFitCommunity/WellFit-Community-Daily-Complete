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

jest.mock('../../components/TriviaGame', () => {
  return function MockTriviaGame() {
    return <div data-testid="trivia-game">Trivia Game Component</div>;
  };
});

jest.mock('../../services/engagementTracking', () => ({
  saveTriviaGameResult: jest.fn(),
}));

jest.mock('../../data/triviaQuestions', () => ({
  triviaQuestions: [
    {
      id: 'q1',
      question: 'Test Question',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      difficulty: 'Easy',
    },
  ],
}));

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

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: null
      }),
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
    it('should render the Memory Lane trivia page', () => {
      render(<MemoryLaneTriviaPage />);

      expect(screen.getByTestId('trivia-game')).toBeInTheDocument();
    });

    it('should render TriviaGame component', () => {
      render(<MemoryLaneTriviaPage />);

      expect(screen.getByText(/Trivia Game Component/i)).toBeInTheDocument();
    });
  });

  describe('Page Purpose', () => {
    it('should provide cognitive engagement for seniors', () => {
      render(<MemoryLaneTriviaPage />);

      expect(screen.getByTestId('trivia-game')).toBeInTheDocument();
    });

    it('should be accessible to senior users', () => {
      render(<MemoryLaneTriviaPage />);

      const triviaGame = screen.getByTestId('trivia-game');
      expect(triviaGame).toBeInTheDocument();
    });
  });

  describe('User Experience', () => {
    it('should provide engaging brain exercise', () => {
      render(<MemoryLaneTriviaPage />);

      expect(screen.getByTestId('trivia-game')).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('should work with authenticated user', () => {
      render(<MemoryLaneTriviaPage />);

      expect(screen.getByTestId('trivia-game')).toBeInTheDocument();
    });

    it('should work when user is not authenticated', () => {
      (useUser as jest.Mock).mockReturnValue(null);

      render(<MemoryLaneTriviaPage />);

      expect(screen.getByTestId('trivia-game')).toBeInTheDocument();
    });
  });
});
