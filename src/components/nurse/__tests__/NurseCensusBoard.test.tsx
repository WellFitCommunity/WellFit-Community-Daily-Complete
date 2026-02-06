/**
 * NurseCensusBoard Tests
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NurseCensusBoard } from '../NurseCensusBoard';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({
              data: [
                {
                  user_id: 'p-1',
                  first_name: 'John',
                  last_name: 'Doe',
                  room_number: '101',
                  bed_number: 'A',
                  acuity_level: 3,
                },
                {
                  user_id: 'p-2',
                  first_name: 'Jane',
                  last_name: 'Smith',
                  room_number: '102',
                  bed_number: null,
                  acuity_level: 1,
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    }),
    channel: () => ({
      on: () => ({
        subscribe: () => ({ unsubscribe: vi.fn() }),
      }),
      unsubscribe: vi.fn(),
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test' } } }),
    },
  },
}));

// Mock patient avatar hooks
vi.mock('../../patient-avatar/hooks/usePatientAvatar', () => ({
  usePatientAvatar: () => ({
    avatar: {
      id: 'avatar-1',
      patient_id: 'p-1',
      skin_tone: 'medium',
      gender_presentation: 'neutral',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    loading: false,
    error: null,
    updateSkinTone: vi.fn(),
    updateGenderPresentation: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('../../patient-avatar/hooks/usePatientMarkers', () => ({
  usePatientMarkers: () => ({
    markers: [],
    pendingCount: 0,
    attentionCount: 0,
    loading: false,
    error: null,
    refresh: vi.fn(),
    createMarker: vi.fn(),
    updateMarker: vi.fn(),
    confirmMarker: vi.fn(),
    rejectMarker: vi.fn(),
    deactivateMarker: vi.fn(),
    confirmAllPending: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useRealtimeSubscription', () => ({
  useRealtimeSubscription: () => ({
    data: null,
    loading: false,
    error: null,
    refresh: vi.fn(),
    isSubscribed: true,
    subscriptionId: 'test',
  }),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user' } }),
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    ai: vi.fn(),
  },
}));

describe('NurseCensusBoard', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders the heading', async () => {
    render(
      <MemoryRouter>
        <NurseCensusBoard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Nurse Census Board')).toBeInTheDocument();
    });
  });

  it('shows patient count', async () => {
    render(
      <MemoryRouter>
        <NurseCensusBoard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/2 patients/)).toBeInTheDocument();
    });
  });

  it('renders patient names', async () => {
    render(
      <MemoryRouter>
        <NurseCensusBoard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Doe, John')).toBeInTheDocument();
      expect(screen.getByText('Smith, Jane')).toBeInTheDocument();
    });
  });

  it('shows room numbers', async () => {
    render(
      <MemoryRouter>
        <NurseCensusBoard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Room 101-A')).toBeInTheDocument();
    });
  });

  it('renders Refresh button', async () => {
    render(
      <MemoryRouter>
        <NurseCensusBoard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    });
  });
});
