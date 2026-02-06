/**
 * PatientAvatarProfileSection Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PatientAvatarProfileSection } from '../PatientAvatarProfileSection';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock hooks
vi.mock('../hooks/usePatientAvatar', () => ({
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

vi.mock('../hooks/usePatientMarkers', () => ({
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

describe('PatientAvatarProfileSection', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders body map heading', () => {
    render(
      <MemoryRouter>
        <PatientAvatarProfileSection patientId="p-1" patientName="John Doe" />
      </MemoryRouter>
    );
    expect(screen.getByText('Body Map')).toBeInTheDocument();
  });

  it('renders View Full button', () => {
    render(
      <MemoryRouter>
        <PatientAvatarProfileSection patientId="p-1" />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: 'View Full' })).toBeInTheDocument();
  });

  it('navigates to full avatar page on View Full click', () => {
    render(
      <MemoryRouter>
        <PatientAvatarProfileSection patientId="p-1" />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: 'View Full' }));
    expect(mockNavigate).toHaveBeenCalledWith('/patient-avatar/p-1');
  });

  it('applies custom className', () => {
    const { container } = render(
      <MemoryRouter>
        <PatientAvatarProfileSection patientId="p-1" className="my-class" />
      </MemoryRouter>
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('my-class');
  });
});
