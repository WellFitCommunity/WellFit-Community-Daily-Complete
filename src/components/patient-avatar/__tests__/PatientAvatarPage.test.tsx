/**
 * PatientAvatarPage Tests
 *
 * Tests for the standalone patient avatar page component.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PatientAvatarPage } from '../PatientAvatarPage';

// Mock hooks
vi.mock('../hooks/usePatientAvatar', () => ({
  usePatientAvatar: () => ({
    avatar: {
      id: 'test-avatar-id',
      patient_id: 'test-patient-id',
      skin_tone: 'medium',
      gender_presentation: 'neutral',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    loading: false,
    error: null,
    updateSkinTone: vi.fn().mockResolvedValue(true),
    updateGenderPresentation: vi.fn().mockResolvedValue(true),
    refresh: vi.fn(),
  }),
}));

vi.mock('../hooks/usePatientMarkers', () => ({
  usePatientMarkers: () => ({
    markers: [
      {
        id: 'marker-1',
        patient_id: 'test-patient-id',
        category: 'critical',
        marker_type: 'central_line_jugular',
        display_name: 'Central Line (Jugular)',
        body_region: 'neck',
        position_x: 45,
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
        id: 'marker-2',
        patient_id: 'test-patient-id',
        category: 'neurological',
        marker_type: 'parkinsons',
        display_name: "Parkinson's Disease",
        body_region: 'brain',
        position_x: 50,
        position_y: 8,
        body_view: 'front',
        source: 'smartscribe',
        status: 'pending_confirmation',
        confidence_score: 0.85,
        details: {
          raw_smartscribe_text: 'Patient has Parkinsons disease',
        },
        is_active: true,
        requires_attention: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'marker-3',
        patient_id: 'test-patient-id',
        category: 'monitoring',
        marker_type: 'wound_back',
        display_name: 'Wound (Back)',
        body_region: 'upper_back',
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
    ],
    pendingCount: 1,
    attentionCount: 1,
    loading: false,
    error: null,
    refresh: vi.fn(),
    createMarker: vi.fn().mockResolvedValue(null),
    updateMarker: vi.fn().mockResolvedValue(null),
    confirmMarker: vi.fn().mockResolvedValue(true),
    rejectMarker: vi.fn().mockResolvedValue(true),
    deactivateMarker: vi.fn().mockResolvedValue(true),
    confirmAllPending: vi.fn().mockResolvedValue(1),
  }),
}));

// Mock realtime subscription
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

// Mock AuthContext
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
  }),
}));

// Mock auditLogger
vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    ai: vi.fn(),
  },
}));

// Mock patientAvatarService
vi.mock('../../../services/patientAvatarService', () => ({
  PatientAvatarService: {
    getMarkerHistory: vi.fn().mockResolvedValue({
      success: true,
      data: [],
    }),
  },
}));

describe('PatientAvatarPage', () => {
  it('renders the page with patient body map heading', () => {
    render(<PatientAvatarPage patientId="test-patient-id" />);
    expect(screen.getByText('Patient Body Map')).toBeInTheDocument();
  });

  it('shows active marker count', () => {
    render(<PatientAvatarPage patientId="test-patient-id" />);
    expect(screen.getByText(/3 active markers/)).toBeInTheDocument();
  });

  it('shows pending markers alert', () => {
    render(<PatientAvatarPage patientId="test-patient-id" />);
    expect(screen.getByText(/1 marker from SmartScribe need confirmation/)).toBeInTheDocument();
  });

  it('renders front/back toggle buttons', () => {
    render(<PatientAvatarPage patientId="test-patient-id" />);
    expect(screen.getByRole('button', { name: 'Front' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('renders marker list grouped by category', () => {
    render(<PatientAvatarPage patientId="test-patient-id" />);
    expect(screen.getByText('Central Line (Jugular)')).toBeInTheDocument();
    expect(screen.getByText("Parkinson's Disease")).toBeInTheDocument();
  });

  it('renders Add Marker button', () => {
    render(<PatientAvatarPage patientId="test-patient-id" />);
    expect(screen.getByRole('button', { name: 'Add Marker' })).toBeInTheDocument();
  });

  it('renders Print button', () => {
    render(<PatientAvatarPage patientId="test-patient-id" />);
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument();
  });

  it('renders right panel tab buttons', () => {
    render(<PatientAvatarPage patientId="test-patient-id" />);
    expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('switches to settings tab when clicked', async () => {
    render(<PatientAvatarPage patientId="test-patient-id" />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await waitFor(() => {
      expect(screen.getByText('Avatar Appearance')).toBeInTheDocument();
    });
  });

  it('shows select marker message when no marker selected', () => {
    render(<PatientAvatarPage patientId="test-patient-id" />);
    expect(screen.getByText('Select a marker to view details')).toBeInTheDocument();
  });

  it('renders category legend', () => {
    render(<PatientAvatarPage patientId="test-patient-id" />);
    // 'Critical' appears in both legend and category header, so use getAllByText
    const criticalElements = screen.getAllByText('Critical');
    expect(criticalElements.length).toBeGreaterThanOrEqual(1);
    const neuroElements = screen.getAllByText('Neurological');
    expect(neuroElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the SVG avatar body', () => {
    render(<PatientAvatarPage patientId="test-patient-id" />);
    const svg = document.querySelector('svg[viewBox="0 0 100 160"]');
    expect(svg).toBeInTheDocument();
  });
});
