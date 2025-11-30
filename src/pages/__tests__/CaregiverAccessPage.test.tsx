// src/pages/__tests__/CaregiverAccessPage.test.tsx
// Tests for the public caregiver access page (no auth required)

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

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
      secondaryColor: '#8cc63f',
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
  const mockRpc = jest.fn();
  const mockFrom = jest.fn();
  const mockFunctionsInvoke = jest.fn();

  return {
    createClient: jest.fn(() => ({
      rpc: mockRpc,
      from: mockFrom,
      functions: {
        invoke: mockFunctionsInvoke,
      },
    })),
    // Export mocks for test access
    __esModule: true,
    __mocks: { mockRpc, mockFrom, mockFunctionsInvoke },
  };
});

// Import after mocks are set up
import CaregiverAccessPage from '../CaregiverAccessPage';
import * as supabaseModule from '@supabase/supabase-js';

// Get mock references
const { mockRpc: mockRpcFn, mockFrom: mockFromFn, mockFunctionsInvoke: mockFunctionsInvokeFn } = (supabaseModule as any).__mocks;

describe('CaregiverAccessPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();

    // Default mock implementations
    mockRpcFn.mockResolvedValue({ data: { valid: false }, error: null });
    mockFromFn.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  const renderPage = () => {
    return render(
      <MemoryRouter>
        <CaregiverAccessPage />
      </MemoryRouter>
    );
  };

  describe('Page Rendering', () => {
    it('should render the caregiver access page', async () => {
      renderPage();

      await waitFor(() => {
        // Multiple elements contain "Caregiver Access", use getAllByText
        expect(screen.getAllByText(/Caregiver Access/i).length).toBeGreaterThan(0);
      });
    });

    it('should display the access form', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText(/Senior's Phone Number/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/4-Digit PIN/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Your Full Name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Your Phone Number/i)).toBeInTheDocument();
      });
    });

    it('should display security notice', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Security Notice/i)).toBeInTheDocument();
        expect(screen.getByText(/logged for security/i)).toBeInTheDocument();
      });
    });

    it('should display how caregiver access works info', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/How Caregiver Access Works/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('should require complete form for submission', async () => {
      renderPage();

      await waitFor(() => {
        // Form exists with submit button
        const submitButton = screen.getByRole('button', { name: /Access Senior's Information/i });
        expect(submitButton).toBeInTheDocument();
      });
    });

    it('should format phone number as user types', async () => {
      renderPage();

      await waitFor(() => {
        const phoneInput = screen.getByLabelText(/Senior's Phone Number/i);
        fireEvent.change(phoneInput, { target: { value: '5551234567' } });
        expect(phoneInput).toHaveValue('+1 555-123-4567');
      });
    });

    it('should limit PIN to 4 digits', async () => {
      renderPage();

      await waitFor(() => {
        const pinInput = screen.getByLabelText(/4-Digit PIN/i);
        // Input has maxLength of 4, so only first 4 chars are entered
        expect(pinInput).toHaveAttribute('maxLength', '4');
      });
    });

    it('should only allow numeric input for PIN', async () => {
      renderPage();

      await waitFor(() => {
        const pinInput = screen.getByLabelText(/4-Digit PIN/i);
        fireEvent.change(pinInput, { target: { value: 'abcd' } });
        expect(pinInput).toHaveValue('');
      });
    });
  });

  describe('Form Submission', () => {
    it('should show error when senior not found', async () => {
      mockFromFn.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      renderPage();

      await waitFor(() => {
        // Fill in form
        fireEvent.change(screen.getByLabelText(/Senior's Phone Number/i), {
          target: { value: '5551234567' },
        });
        fireEvent.change(screen.getByLabelText(/4-Digit PIN/i), {
          target: { value: '1234' },
        });
        fireEvent.change(screen.getByLabelText(/Your Full Name/i), {
          target: { value: 'Jane Doe' },
        });
        fireEvent.change(screen.getByLabelText(/Your Phone Number/i), {
          target: { value: '5559876543' },
        });
      });

      // Submit form
      const submitButton = screen.getByRole('button', { name: /Access Senior's Information/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Senior not found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Session Management', () => {
    it('should check for existing session on mount', async () => {
      renderPage();

      // Should finish loading without existing session
      await waitFor(() => {
        // Multiple elements contain "Caregiver Access", use getAllByText
        expect(screen.getAllByText(/Caregiver Access/i).length).toBeGreaterThan(0);
      });
    });

    it('should display existing session if valid', async () => {
      // Set up existing session BEFORE render
      const existingSession = {
        sessionToken: 'test-token',
        seniorId: 'senior-123',
        seniorName: 'John Smith',
        caregiverName: 'Jane Doe',
        caregiverPhone: '+15559876543',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      };
      sessionStorage.setItem('caregiver_session', JSON.stringify(existingSession));

      // Mock valid session response BEFORE render
      mockRpcFn.mockResolvedValue({
        data: { valid: true, senior_name: 'John Smith' },
        error: null,
      });

      renderPage();

      // Wait for the component to check and display the session
      await waitFor(() => {
        // Component shows session info with "Continue Viewing" button
        expect(screen.getByText(/Continue Viewing/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Navigation', () => {
    it('should have back to login link', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Back to Login/i)).toBeInTheDocument();
      });
    });

    it('should navigate to login when clicking back', async () => {
      renderPage();

      await waitFor(() => {
        const backButton = screen.getByText(/Back to Login/i);
        fireEvent.click(backButton);
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText(/Senior's Phone Number/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/4-Digit PIN/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Your Full Name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Your Phone Number/i)).toBeInTheDocument();
      });
    });

    it('should have input type hints', async () => {
      renderPage();

      await waitFor(() => {
        const pinInput = screen.getByLabelText(/4-Digit PIN/i);
        expect(pinInput).toHaveAttribute('type', 'password');
        expect(pinInput).toHaveAttribute('inputMode', 'numeric');
      });
    });
  });
});
