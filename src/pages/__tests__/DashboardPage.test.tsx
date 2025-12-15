// src/pages/__tests__/DashboardPage.test.tsx
// Tests for the senior-facing main dashboard page

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardPage from '../DashboardPage';
import { useSupabaseClient, useUser, useAuth } from '../../contexts/AuthContext';
import { useBranding } from '../../BrandingContext';

// Mock dependencies
vi.mock('../../contexts/AuthContext', () => ({
  useSupabaseClient: vi.fn(),
  useUser: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('../../BrandingContext', () => ({
  useBranding: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
}));

// Mock fetchMyProfile
vi.mock('../../data/profile', () => ({
  fetchMyProfile: vi.fn().mockResolvedValue({ role: 'senior', role_code: 4 }),
}));

// Mock the SeniorCommunityDashboard component
vi.mock('../../components/dashboard/SeniorCommunityDashboard', () => {
  return function MockSeniorCommunityDashboard() {
    return <div data-testid="senior-community-dashboard">Senior Community Dashboard</div>;
  };
});

describe('DashboardPage - Senior Facing Page', () => {
  let mockSupabase: any;
  let mockUser: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockUser = {
      id: 'senior-user-123',
      email: 'senior@test.com',
    };

    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { first_name: 'John', role: 'senior' },
        error: null
      }),
    };

    (useUser as ReturnType<typeof vi.fn>).mockReturnValue(mockUser);
    (useSupabaseClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: mockUser });
    (useBranding as ReturnType<typeof vi.fn>).mockReturnValue({
      branding: {
        gradient: 'linear-gradient(to bottom, #E0F2FE, #FFFFFF)',
        primaryColor: '#4F46E5',
        appName: 'WellFit',
      },
    });
  });

  describe('Page Rendering', () => {
    it('should render the dashboard page', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('senior-community-dashboard')).toBeInTheDocument();
      });
    });

    it('should render SeniorCommunityDashboard component', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/Senior Community Dashboard/i)).toBeInTheDocument();
      });
    });
  });

  describe('User Experience', () => {
    it('should provide central hub for senior users', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('senior-community-dashboard')).toBeInTheDocument();
      });
    });

    it('should be the main landing page for seniors', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        const dashboard = screen.getByTestId('senior-community-dashboard');
        expect(dashboard).toBeInTheDocument();
      });
    });
  });

  describe('Integration', () => {
    it('should work with authenticated user', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('senior-community-dashboard')).toBeInTheDocument();
      });
    });

    it('should handle missing user', async () => {
      (useUser as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('senior-community-dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should render accessible dashboard for seniors', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        const dashboard = screen.getByTestId('senior-community-dashboard');
        expect(dashboard).toBeVisible();
      });
    });
  });
});
