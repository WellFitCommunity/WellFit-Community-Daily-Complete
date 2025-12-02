import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReferralsDashboard } from '../ReferralsDashboard';

// Mock the supabase client
const mockFrom = jest.fn();
const mockSupabase = {
  from: mockFrom,
};

// Mock the AuthContext
jest.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    supabase: mockSupabase,
    user: { id: 'test-user-id' },
  }),
}));

describe('ReferralsDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const setupMockQueries = (options: {
    sources?: any[];
    pending?: any[];
    active?: any[];
    alerts?: any[];
  } = {}) => {
    const { sources = [], pending = [], active = [], alerts = [] } = options;

    mockFrom.mockImplementation((table: string) => {
      const query = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: table === 'external_referral_sources' ? sources :
                table === 'referral_alerts' ? alerts : [],
          error: null,
        }),
      };

      // For patient_referrals, use in() then order() then limit()
      if (table === 'patient_referrals') {
        query.in = jest.fn().mockImplementation((col, values) => {
          if (values.includes('pending')) {
            return {
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue({ data: pending, error: null }),
            };
          }
          if (values.includes('linked')) {
            return {
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue({ data: active, error: null }),
            };
          }
          return query;
        });
      }

      return query;
    });
  };

  it('should render loading state initially', () => {
    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockImplementation(() => new Promise(() => {})),
    }));

    render(<ReferralsDashboard />);

    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('should render dashboard with no referral sources', async () => {
    setupMockQueries({ sources: [] });

    render(<ReferralsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Referrals Dashboard/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/No referral sources configured/i)).toBeInTheDocument();
  });

  it('should render dashboard with referral sources', async () => {
    const mockSources = [
      {
        id: 'source-1',
        organization_name: 'Houston General Hospital',
        organization_type: 'hospital',
        contact_name: 'Dr. Smith',
        contact_email: 'smith@hospital.com',
        contact_phone: '555-1234',
        subscription_tier: 'premium',
        active: true,
        created_at: '2025-01-01',
      },
    ];

    setupMockQueries({ sources: mockSources });

    render(<ReferralsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Referrals Dashboard/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Houston General Hospital')).toBeInTheDocument();
    expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
  });

  it('should display pending referrals', async () => {
    const mockPending = [
      {
        id: 'ref-1',
        source_id: 'source-1',
        patient_first_name: 'John',
        patient_last_name: 'Doe',
        patient_phone: '555-9999',
        referral_reason: 'Post-discharge follow-up',
        priority: 'urgent',
        status: 'pending',
        created_at: '2025-12-01',
        updated_at: '2025-12-01',
        external_referral_sources: { organization_name: 'Houston General' },
      },
    ];

    setupMockQueries({ pending: mockPending });

    render(<ReferralsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Pending Referrals/i)).toBeInTheDocument();
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should display metrics correctly', async () => {
    setupMockQueries({ sources: [], pending: [], active: [], alerts: [] });

    render(<ReferralsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Referral Sources/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Active Sources/i)).toBeInTheDocument();
    expect(screen.getByText(/Pending Referrals/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Patients/i)).toBeInTheDocument();
  });

  it('should display alerts when present', async () => {
    const mockAlerts = [
      {
        id: 'alert-1',
        referral_id: 'ref-1',
        patient_name: 'Jane Smith',
        alert_type: 'missed_checkin',
        severity: 'high',
        message: 'Patient missed 3 consecutive check-ins',
        created_at: '2025-12-02',
        acknowledged: false,
      },
    ];

    setupMockQueries({ alerts: mockAlerts });

    render(<ReferralsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Referral Alerts/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Patient missed 3 consecutive check-ins')).toBeInTheDocument();
  });

  it('should have Add Referral Source button', async () => {
    setupMockQueries();

    render(<ReferralsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Referrals Dashboard/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Add Referral Source/i })).toBeInTheDocument();
  });
});
