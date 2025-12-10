import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MemoryLaneTriviaPage from '../MemoryLaneTriviaPage';

// Mock AuthContext
jest.mock('../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
  }),
  useUser: () => ({ id: 'test-user-id' }),
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    session: null,
    loading: false,
    isLoading: false,
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    resetPassword: jest.fn(),
    updatePassword: jest.fn(),
    profile: null,
    roleCode: null,
    isSenior: false,
    isCaregiver: false,
    isVolunteer: false,
  }),
}));

// Mock NavigationHistoryContext
jest.mock('../../contexts/NavigationHistoryContext', () => ({
  useNavigationHistory: () => ({
    historyStack: [],
    canGoBack: false,
    goBack: jest.fn(),
    getPreviousRoute: jest.fn(),
    clearHistory: jest.fn(),
  }),
}));

// Mock BrandingContext
jest.mock('../../BrandingContext', () => ({
  useBranding: () => ({
    branding: {
      primaryColor: '#00857a',
      orgName: 'Test Org',
    },
  }),
}));

describe('MemoryLaneTriviaPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <MemoryLaneTriviaPage />
      </MemoryRouter>
    );
    expect(document.body).toBeInTheDocument();
  });
});
