import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CheckInPage from '../CheckInPage';

// Mock AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  }),
  useUser: () => ({ id: 'test-user-id' }),
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

describe('CheckInPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders check-in center heading', () => {
    render(
      <MemoryRouter>
        <CheckInPage />
      </MemoryRouter>
    );

    // Should show the Daily Check-In Center title
    expect(screen.getByText(/daily check-in center/i)).toBeInTheDocument();
  });

  it('renders back to dashboard button', () => {
    render(
      <MemoryRouter>
        <CheckInPage />
      </MemoryRouter>
    );

    // CheckInPage passes showBackButton={true} to CheckInTracker
    expect(screen.getByText(/back to dashboard/i)).toBeInTheDocument();
  });

  it('displays mood options for check-in', () => {
    render(
      <MemoryRouter>
        <CheckInPage />
      </MemoryRouter>
    );

    // Should have mood selection options
    expect(screen.getByText('Great')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
    expect(screen.getByText('Okay')).toBeInTheDocument();
  });
});
