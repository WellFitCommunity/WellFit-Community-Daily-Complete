import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SeniorViewPage from '../SeniorViewPage';

// Mock the BrandingContext
jest.mock('../../BrandingContext', () => ({
  useBranding: () => ({
    branding: {
      primaryColor: '#00857a',
      orgName: 'Test Org',
    },
  }),
}));

// Mock auditLogger
jest.mock('../../services/auditLogger', () => ({
  auditLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
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
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders without crashing', () => {
    renderWithRouter();
    // Page should render even without a valid session
    expect(document.body).toBeInTheDocument();
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
      expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    });
  });
});
