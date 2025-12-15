import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MemoryLaneTriviaPage from '../MemoryLaneTriviaPage';

// Mock AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  }),
  useUser: () => ({ id: 'test-user-id' }),
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    session: null,
    loading: false,
    isLoading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPassword: vi.fn(),
    updatePassword: vi.fn(),
    profile: null,
    roleCode: null,
    isSenior: false,
    isCaregiver: false,
    isVolunteer: false,
  }),
}));

// Mock NavigationHistoryContext
vi.mock('../../contexts/NavigationHistoryContext', () => ({
  useNavigationHistory: () => ({
    historyStack: [],
    canGoBack: false,
    goBack: vi.fn(),
    getPreviousRoute: vi.fn(),
    clearHistory: vi.fn(),
  }),
}));

// Mock BrandingContext
vi.mock('../../BrandingContext', () => ({
  useBranding: () => ({
    branding: {
      primaryColor: '#00857a',
      orgName: 'Test Org',
    },
  }),
}));

describe('MemoryLaneTriviaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
