/**
 * CarePlanAvatarView Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CarePlanAvatarView } from '../CarePlanAvatarView';
import type { PatientMarker } from '../../../types/patientAvatar';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockMarkers: PatientMarker[] = [
  {
    id: 'm-1',
    patient_id: 'p-1',
    category: 'critical',
    marker_type: 'central_line',
    display_name: 'Central Line',
    body_region: 'neck',
    position_x: 50,
    position_y: 20,
    body_view: 'front',
    source: 'manual',
    status: 'confirmed',
    details: {},
    is_active: true,
    requires_attention: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'm-2',
    patient_id: 'p-1',
    category: 'chronic',
    marker_type: 'diabetes',
    display_name: 'Diabetes',
    body_region: 'abdomen',
    position_x: 50,
    position_y: 60,
    body_view: 'front',
    source: 'manual',
    status: 'confirmed',
    details: {},
    is_active: true,
    requires_attention: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'm-3',
    patient_id: 'p-1',
    category: 'monitoring',
    marker_type: 'wound_back',
    display_name: 'Wound',
    body_region: 'back',
    position_x: 50,
    position_y: 40,
    body_view: 'back',
    source: 'manual',
    status: 'confirmed',
    details: {},
    is_active: true,
    requires_attention: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

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
    markers: mockMarkers,
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

describe('CarePlanAvatarView', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders with marker count', () => {
    render(
      <MemoryRouter>
        <CarePlanAvatarView patientId="p-1" />
      </MemoryRouter>
    );
    // Only front markers (2 of 3)
    expect(screen.getByText('2 markers')).toBeInTheDocument();
  });

  it('renders View Full button', () => {
    render(
      <MemoryRouter>
        <CarePlanAvatarView patientId="p-1" />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: 'View Full' })).toBeInTheDocument();
  });

  it('navigates to full avatar page', () => {
    render(
      <MemoryRouter>
        <CarePlanAvatarView patientId="p-1" />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: 'View Full' }));
    expect(mockNavigate).toHaveBeenCalledWith('/patient-avatar/p-1');
  });

  it('filters markers by category', () => {
    render(
      <MemoryRouter>
        <CarePlanAvatarView patientId="p-1" filterCategories={['critical']} />
      </MemoryRouter>
    );
    // Only critical front markers (1)
    expect(screen.getByText('1 marker')).toBeInTheDocument();
  });

  it('renders the SVG body', () => {
    render(
      <MemoryRouter>
        <CarePlanAvatarView patientId="p-1" />
      </MemoryRouter>
    );
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <MemoryRouter>
        <CarePlanAvatarView patientId="p-1" className="custom-class" />
      </MemoryRouter>
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('custom-class');
  });
});
