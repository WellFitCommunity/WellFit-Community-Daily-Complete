// src/pages/__tests__/SeniorViewPage.test.tsx
// Tests for the caregiver senior view dashboard (read-only)
/* eslint-disable testing-library/no-wait-for-multiple-assertions, testing-library/no-node-access */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

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
// Jest hoists jest.mock() calls, so we can't reference variables defined after the mock.
// The solution is to create the mocks inside the factory and access them via the module.
jest.mock('@supabase/supabase-js', () => {
  const mockRpc = jest.fn().mockResolvedValue({ data: null, error: null });
  const mockFrom = jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      })),
    })),
  }));

  return {
    createClient: jest.fn(() => ({
      rpc: mockRpc,
      from: mockFrom,
    })),
    // Export mocks for test access
    __esModule: true,
    __mocks: { mockRpc, mockFrom },
  };
});

// Import after mocks are set up
import SeniorViewPage from '../SeniorViewPage';
import * as supabaseModule from '@supabase/supabase-js';

// Get mock references
const { mockRpc: mockRpcFn, mockFrom: mockFromFn } = (supabaseModule as any).__mocks;

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
    mockRpcFn.mockResolvedValue({ data: { valid: false }, error: null });
    mockFromFn.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
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
        expect(screen.getByText(/Session Error/i)).toBeInTheDocument();
      });
    });

    it('should show error when session is expired', async () => {
      // Set up expired session
      const expiredSession = {
        ...validSession,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      };
      sessionStorage.setItem('caregiver_session', JSON.stringify(expiredSession));

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Session Error/i)).toBeInTheDocument();
      });
    });

    it('should show error when session senior ID does not match', async () => {
      sessionStorage.setItem('caregiver_session', JSON.stringify(validSession));

      renderPage('different-senior-id');

      await waitFor(() => {
        expect(screen.getByText(/Session Error/i)).toBeInTheDocument();
      });
    });

    it('should validate session with backend', async () => {
      sessionStorage.setItem('caregiver_session', JSON.stringify(validSession));
      mockRpcFn.mockResolvedValue({ data: { valid: true }, error: null });

      renderPage();

      await waitFor(() => {
        expect(mockRpcFn).toHaveBeenCalledWith('validate_caregiver_session', {
          p_session_token: validSession.sessionToken,
        });
      });
    });
  });

  describe('Page Content', () => {
    it('should display senior name in header', async () => {
      sessionStorage.setItem('caregiver_session', JSON.stringify(validSession));
      mockRpcFn.mockResolvedValue({ data: { valid: true }, error: null });

      renderPage();

      await waitFor(() => {
        // Multiple elements contain John Smith, so use getAllByText
        expect(screen.getAllByText(/John Smith/i).length).toBeGreaterThan(0);
      });
    });

    it('should show read-only notice', async () => {
      sessionStorage.setItem('caregiver_session', JSON.stringify(validSession));
      mockRpcFn.mockResolvedValue({ data: { valid: true }, error: null });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Read-Only Access/i)).toBeInTheDocument();
      });
    });

    it('should display session timer', async () => {
      sessionStorage.setItem('caregiver_session', JSON.stringify(validSession));
      mockRpcFn.mockResolvedValue({ data: { valid: true }, error: null });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Session expires in/i)).toBeInTheDocument();
      });
    });
  });

  describe('Data Display', () => {
    it('should display check-in stats section', async () => {
      sessionStorage.setItem('caregiver_session', JSON.stringify(validSession));
      mockRpcFn.mockResolvedValue({ data: { valid: true }, error: null });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Recent Check-ins/i)).toBeInTheDocument();
      });
    });

    it('should display mood trend section', async () => {
      sessionStorage.setItem('caregiver_session', JSON.stringify(validSession));
      mockRpcFn.mockResolvedValue({ data: { valid: true }, error: null });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Mood Trend/i)).toBeInTheDocument();
      });
    });
  });

  describe('Security', () => {
    it('should display security notice', async () => {
      sessionStorage.setItem('caregiver_session', JSON.stringify(validSession));
      mockRpcFn.mockResolvedValue({ data: { valid: true }, error: null });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/logged for security/i)).toBeInTheDocument();
      });
    });

    it('should log page view', async () => {
      sessionStorage.setItem('caregiver_session', JSON.stringify(validSession));
      mockRpcFn.mockResolvedValue({ data: { valid: true }, error: null });

      renderPage();

      await waitFor(() => {
        expect(mockRpcFn).toHaveBeenCalledWith('log_caregiver_page_view', expect.any(Object));
      });
    });
  });

  describe('Error Handling', () => {
    it('should show return to login button on error', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Return to Login/i)).toBeInTheDocument();
      });
    });

    it('should navigate to caregiver-access on return click', async () => {
      renderPage();

      await waitFor(() => {
        const returnButton = screen.getByText(/Return to Login/i);
        returnButton.click();
        expect(mockNavigate).toHaveBeenCalledWith('/caregiver-access');
      });
    });
  });
});
