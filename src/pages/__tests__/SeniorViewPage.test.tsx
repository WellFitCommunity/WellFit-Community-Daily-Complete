// src/pages/__tests__/SeniorViewPage.test.tsx
// Tests for the caregiver senior view dashboard (read-only)

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SeniorViewPage from '../SeniorViewPage';

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock BrandingContext
jest.mock('../../BrandingContext', () => ({
  useBranding: () => ({
    branding: {
      gradient: 'linear-gradient(to bottom, #003865, #8cc63f)',
      primaryColor: '#003865',
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
const mockRpc = jest.fn();
const mockFrom = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
  }),
}));

describe('SeniorViewPage', () => {
  const validSession = {
    sessionToken: 'test-token-123',
    seniorId: 'senior-user-456',
    seniorName: 'John Smith',
    caregiverName: 'Jane Doe',
    caregiverPhone: '+15559876543',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();

    // Default: no session
    mockRpc.mockResolvedValue({ data: { valid: false }, error: null });
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  const renderPage = (seniorId = 'senior-user-456') => {
    return render(
      <MemoryRouter initialEntries={[`/senior-view/${seniorId}`]}>
        <Routes>
          <Route path="/senior-view/:seniorId" element={<SeniorViewPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  describe('Session Validation', () => {
    it('should show error when no session exists', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/No active session/i)).toBeInTheDocument();
      });
    });

    it('should show error when session is expired', async () => {
      const expiredSession = {
        ...validSession,
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
      };
      sessionStorage.setItem('caregiver_session', JSON.stringify(expiredSession));

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Session expired/i)).toBeInTheDocument();
      });
    });

    it('should show error when session senior ID does not match', async () => {
      sessionStorage.setItem('caregiver_session', JSON.stringify(validSession));

      renderPage('different-senior-id');

      await waitFor(() => {
        expect(screen.getByText(/Session does not match/i)).toBeInTheDocument();
      });
    });

    it('should validate session with backend', async () => {
      sessionStorage.setItem('caregiver_session', JSON.stringify(validSession));

      mockRpc.mockImplementation((fnName) => {
        if (fnName === 'validate_caregiver_session') {
          return Promise.resolve({ data: { valid: true }, error: null });
        }
        if (fnName === 'log_caregiver_page_view') {
          return Promise.resolve({ data: true, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            first_name: 'John',
            last_name: 'Smith',
            phone: '+15551234567',
          },
          error: null,
        }),
      });

      renderPage();

      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith('validate_caregiver_session', {
          p_session_token: validSession.sessionToken,
        });
      });
    });
  });

  describe('Page Content', () => {
    beforeEach(() => {
      sessionStorage.setItem('caregiver_session', JSON.stringify(validSession));

      mockRpc.mockImplementation((fnName) => {
        if (fnName === 'validate_caregiver_session') {
          return Promise.resolve({ data: { valid: true }, error: null });
        }
        if (fnName === 'log_caregiver_page_view') {
          return Promise.resolve({ data: true, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            first_name: 'John',
            last_name: 'Smith',
            phone: '+15551234567',
          },
          error: null,
        }),
      });
    });

    it('should display senior name in header', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Viewing: John Smith/i)).toBeInTheDocument();
      });
    });

    it('should display caregiver name', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Caregiver: Jane Doe/i)).toBeInTheDocument();
      });
    });

    it('should display read-only notice', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Read-Only Access/i)).toBeInTheDocument();
      });
    });

    it('should display session countdown timer', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Session expires in/i)).toBeInTheDocument();
      });
    });

    it('should have End Session button', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /End Session/i })).toBeInTheDocument();
      });
    });

    it('should have View Health Reports button', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /View Health Reports/i })).toBeInTheDocument();
      });
    });
  });

  describe('Data Display', () => {
    beforeEach(() => {
      sessionStorage.setItem('caregiver_session', JSON.stringify(validSession));

      mockRpc.mockImplementation((fnName) => {
        if (fnName === 'validate_caregiver_session') {
          return Promise.resolve({ data: { valid: true }, error: null });
        }
        return Promise.resolve({ data: true, error: null });
      });
    });

    it('should display check-in stats section', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { first_name: 'John', last_name: 'Smith' },
          error: null,
        }),
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Check-ins/i)).toBeInTheDocument();
      });
    });

    it('should display mood trend section', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { first_name: 'John', last_name: 'Smith' },
          error: null,
        }),
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Mood Trend/i)).toBeInTheDocument();
      });
    });
  });

  describe('Security', () => {
    it('should display security notice', async () => {
      sessionStorage.setItem('caregiver_session', JSON.stringify(validSession));

      mockRpc.mockResolvedValue({ data: { valid: true }, error: null });
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { first_name: 'John', last_name: 'Smith' },
          error: null,
        }),
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Security Notice/i)).toBeInTheDocument();
        expect(screen.getByText(/HIPAA compliance/i)).toBeInTheDocument();
      });
    });

    it('should log page view', async () => {
      sessionStorage.setItem('caregiver_session', JSON.stringify(validSession));

      mockRpc.mockImplementation((fnName) => {
        if (fnName === 'validate_caregiver_session') {
          return Promise.resolve({ data: { valid: true }, error: null });
        }
        if (fnName === 'log_caregiver_page_view') {
          return Promise.resolve({ data: true, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { first_name: 'John', last_name: 'Smith' },
          error: null,
        }),
      });

      renderPage();

      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith('log_caregiver_page_view', {
          p_session_token: validSession.sessionToken,
          p_page_name: 'senior_dashboard',
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should show return to login button on error', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Return to Login/i })).toBeInTheDocument();
      });
    });

    it('should navigate to caregiver-access on return click', async () => {
      renderPage();

      await waitFor(() => {
        const returnButton = screen.getByRole('button', { name: /Return to Login/i });
        returnButton.click();
        expect(mockNavigate).toHaveBeenCalledWith('/caregiver-access');
      });
    });
  });
});
