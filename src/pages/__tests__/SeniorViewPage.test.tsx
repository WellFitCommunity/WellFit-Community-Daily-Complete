import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SeniorViewPage from '../SeniorViewPage';

// Mock the BrandingContext
vi.mock('../../BrandingContext', () => ({
  useBranding: () => ({
    branding: {
      primaryColor: '#00857a',
      orgName: 'Test Org',
    },
  }),
}));

// Mock auditLogger
vi.mock('../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  }),
}));

const renderWithRouter = (seniorId: string = 'test-senior-id') => {
  return render(
    <MemoryRouter initialEntries={[`/senior-view/${seniorId}`]}>
      <Routes>
        <Route path="/senior-view/:seniorId" element={<SeniorViewPage />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('SeniorViewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders the page and shows session validation', async () => {
    renderWithRouter();

    // Page should render and show session-related content
    await waitFor(() => {
      // Should show either session error or loading state
      const content = screen.queryByText(/no active session/i) ||
                      screen.queryByText(/loading/i) ||
                      document.querySelector('.animate-pulse');
      expect(content).toBeTruthy();
    });
  });

  it('shows error when no session exists', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText(/no active session/i)).toBeInTheDocument();
    });
  });

  it('shows login button when session is invalid', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /return to login/i })).toBeInTheDocument();
    });
  });
});
