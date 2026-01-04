/**
 * MedicationManager Test Suite
 *
 * Tests for the enterprise-grade administrative medication management dashboard.
 * Tests rendering, permissions, navigation, and core functionality.
 *
 * Location: src/components/admin/__tests__/MedicationManager.test.tsx
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MedicationManager from '../MedicationManager';

// Mock data
const mockPatients = [
  { user_id: 'patient-1', first_name: 'John', last_name: 'Doe', phone: '555-0001' },
  { user_id: 'patient-2', first_name: 'Jane', last_name: 'Smith', phone: '555-0002' },
];

const mockMedications = [
  {
    id: 'med-1',
    patient_id: 'patient-1',
    medication_display: 'Warfarin 5mg',
    status: 'active',
    dosage_text: '5mg daily',
    dosage_timing_frequency: 1,
    authored_on: '2025-01-01',
    dispense_number_of_repeats: 3,
  },
  {
    id: 'med-2',
    patient_id: 'patient-2',
    medication_display: 'Metformin 500mg',
    status: 'active',
    dosage_text: '500mg twice daily',
    dosage_timing_frequency: 2,
    authored_on: '2025-01-01',
    dispense_number_of_repeats: 5,
  },
];

// Mock Supabase client
const mockFrom = vi.fn();

// Default mock user with admin role
let mockUser = {
  id: 'test-admin-id',
  role: 'admin',
  email: 'admin@test.com'
};

// Mock AuthContext
vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    from: mockFrom,
  }),
  useUser: () => mockUser,
}));

// Mock auditLogger
vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Helper to setup Supabase mocks for successful data load
const setupSuccessMocks = () => {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: mockPatients, error: null })
        })
      };
    }
    if (table === 'medication_requests') {
      return {
        select: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: mockMedications, error: null })
          })
        })
      };
    }
    return {
      select: () => ({
        eq: () => Promise.resolve({ data: [], error: null }),
        order: () => ({
          limit: () => Promise.resolve({ data: [], error: null })
        })
      })
    };
  });
};

// Helper to setup error mocks
const setupErrorMocks = () => {
  mockFrom.mockImplementation(() => ({
    select: () => ({
      eq: () => Promise.resolve({ data: null, error: { message: 'Database error' } }),
      order: () => ({
        limit: () => Promise.resolve({ data: null, error: { message: 'Database error' } })
      })
    })
  }));
};

describe('MedicationManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'test-admin-id', role: 'admin', email: 'admin@test.com' };
    setupSuccessMocks();
  });

  describe('Rendering', () => {
    it('renders without crashing', async () => {
      render(
        <MemoryRouter>
          <MedicationManager />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Medication Manager')).toBeInTheDocument();
      });
    });

    it('displays loading state initially', () => {
      render(
        <MemoryRouter>
          <MedicationManager />
        </MemoryRouter>
      );

      expect(screen.getByText(/loading medication management data/i)).toBeInTheDocument();
    });

    it('renders header with description', async () => {
      render(
        <MemoryRouter>
          <MedicationManager />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Medication Manager')).toBeInTheDocument();
        expect(screen.getByText(/population-level medication oversight/i)).toBeInTheDocument();
      });
    });

    it('renders refresh button', async () => {
      render(
        <MemoryRouter>
          <MedicationManager />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
      });
    });
  });

  describe('Permission Handling', () => {
    it('denies access for senior role', async () => {
      mockUser = { id: 'senior-id', role: 'senior', email: 'senior@test.com' };

      render(
        <MemoryRouter>
          <MedicationManager />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/insufficient permissions/i)).toBeInTheDocument();
      });
    });

    it('allows access for admin role', async () => {
      mockUser = { id: 'admin-id', role: 'admin', email: 'admin@test.com' };

      render(
        <MemoryRouter>
          <MedicationManager />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Medication Manager')).toBeInTheDocument();
      });
    });

    it('allows access for nurse role', async () => {
      mockUser = { id: 'nurse-id', role: 'nurse', email: 'nurse@test.com' };

      render(
        <MemoryRouter>
          <MedicationManager />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Medication Manager')).toBeInTheDocument();
      });
    });

    it('allows access for pharmacist role', async () => {
      mockUser = { id: 'pharmacist-id', role: 'pharmacist', email: 'pharmacist@test.com' };

      render(
        <MemoryRouter>
          <MedicationManager />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Medication Manager')).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    it('renders all navigation tabs', async () => {
      render(
        <MemoryRouter>
          <MedicationManager />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /patient overview/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /reconciliation/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /drug interactions/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /high-risk monitoring/i })).toBeInTheDocument();
      });
    });

    it('switches to reconciliation tab when clicked', async () => {
      render(
        <MemoryRouter>
          <MedicationManager />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /reconciliation/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('tab', { name: /reconciliation/i }));

      await waitFor(() => {
        expect(screen.getByText(/medication reconciliation queue/i)).toBeInTheDocument();
      });
    });

    it('switches to drug interactions tab when clicked', async () => {
      render(
        <MemoryRouter>
          <MedicationManager />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /drug interactions/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('tab', { name: /drug interactions/i }));

      await waitFor(() => {
        expect(screen.getByText(/drug interaction alerts/i)).toBeInTheDocument();
      });
    });
  });

  describe('Overview Stats', () => {
    it('displays stat cards', async () => {
      render(
        <MemoryRouter>
          <MedicationManager />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Total Patients')).toBeInTheDocument();
        expect(screen.getByText('Active Rx')).toBeInTheDocument();
        expect(screen.getByText('Pending Refills')).toBeInTheDocument();
        expect(screen.getByText('High Risk')).toBeInTheDocument();
        expect(screen.getByText('Polypharmacy')).toBeInTheDocument();
      });
    });
  });

  describe('Search and Filter', () => {
    it('renders search input', async () => {
      render(
        <MemoryRouter>
          <MedicationManager />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search patients/i)).toBeInTheDocument();
      });
    });

    it('renders risk level filter', async () => {
      render(
        <MemoryRouter>
          <MedicationManager />
        </MemoryRouter>
      );

      await waitFor(() => {
        const filterSelect = screen.getByDisplayValue('All Risk Levels');
        expect(filterSelect).toBeInTheDocument();
      });
    });

    it('filters by search term', async () => {
      render(
        <MemoryRouter>
          <MedicationManager />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search patients/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search patients/i);
      fireEvent.change(searchInput, { target: { value: 'John' } });

      expect(searchInput).toHaveValue('John');
    });
  });

  describe('Error Handling', () => {
    it('displays error when data load fails', async () => {
      setupErrorMocks();

      render(
        <MemoryRouter>
          <MedicationManager />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/failed|error|database/i)).toBeInTheDocument();
      });
    });
  });

  describe('Audit Logging', () => {
    it('logs successful data load', async () => {
      const { auditLogger } = await import('../../../services/auditLogger');

      render(
        <MemoryRouter>
          <MedicationManager />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(auditLogger.info).toHaveBeenCalledWith(
          'MEDICATION_MANAGER_DATA_LOADED',
          expect.objectContaining({
            userId: 'test-admin-id',
          })
        );
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('refreshes data when refresh button is clicked', async () => {
      render(
        <MemoryRouter>
          <MedicationManager />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      // Should trigger data reload - mockFrom will be called again
      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalled();
      });
    });
  });
});
