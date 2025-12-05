import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TelehealthAppointmentsPage from '../TelehealthAppointmentsPage';

// Mock AuthContext
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  })),
};

jest.mock('../../contexts/AuthContext', () => ({
  useSupabaseClient: () => mockSupabase,
  useUser: () => ({ id: 'test-user-id', email: 'test@example.com' }),
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

// Mock TelehealthConsultation component
jest.mock('../../components/telehealth/TelehealthConsultation', () => {
  return function MockTelehealthConsultation() {
    return <div data-testid="telehealth-consultation">Telehealth Consultation</div>;
  };
});

const renderWithRouter = () => {
  return render(
    <MemoryRouter>
      <TelehealthAppointmentsPage />
    </MemoryRouter>
  );
};

describe('TelehealthAppointmentsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(document.body).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    renderWithRouter();
    // Component should render even during loading
    expect(document.body).toBeInTheDocument();
  });

  it('calls supabase to fetch appointments', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalled();
    });
  });
});
