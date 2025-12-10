import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CaregiverAccessPage from '../CaregiverAccessPage';

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
  }),
}));

const renderWithRouter = () => {
  return render(
    <MemoryRouter>
      <CaregiverAccessPage />
    </MemoryRouter>
  );
};

describe('CaregiverAccessPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders without crashing', async () => {
    renderWithRouter();

    await waitFor(() => {
      // Multiple elements match "caregiver access" so we use getAllByText
      const elements = screen.getAllByText(/caregiver access/i);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  it('renders the PIN input field', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/pin/i)).toBeInTheDocument();
    });
  });

  it('renders phone input fields', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/senior.*phone/i)).toBeInTheDocument();
    });
  });

  it('renders submit button', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /access|submit|view/i })).toBeInTheDocument();
    });
  });

  it('allows typing in PIN field', async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/pin/i)).toBeInTheDocument();
    });

    const pinInput = screen.getByLabelText(/pin/i);
    await user.type(pinInput, '1234');

    expect(pinInput).toHaveValue('1234');
  });
});
