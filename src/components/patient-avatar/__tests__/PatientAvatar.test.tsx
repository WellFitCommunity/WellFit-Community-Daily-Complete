/**
 * PatientAvatar Component Tests
 *
 * Tests for the Patient Avatar Visualization System.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PatientAvatar } from '../PatientAvatar';
import { AvatarBody } from '../AvatarBody';
import { AvatarMarker } from '../AvatarMarker';
import { AvatarThumbnail } from '../AvatarThumbnail';
import { PatientMarker } from '../../../types/patientAvatar';

// Mock the hooks
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
    updateSkinTone: vi.fn(),
    updateGenderPresentation: vi.fn(),
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
    ] as PatientMarker[],
    pendingCount: 1,
    attentionCount: 1,
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

// Mock AuthContext
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
  }),
}));

describe('AvatarBody', () => {
  it('renders without crashing', () => {
    render(
      <AvatarBody
        skinTone="medium"
        genderPresentation="neutral"
        view="front"
        size="full"
      />
    );

    // Check that the SVG is rendered
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders with different skin tones', () => {
    const { rerender } = render(
      <AvatarBody
        skinTone="light"
        genderPresentation="neutral"
        view="front"
      />
    );

    // SVG should be present
    expect(document.querySelector('svg')).toBeInTheDocument();

    // Rerender with different skin tone
    rerender(
      <AvatarBody
        skinTone="dark"
        genderPresentation="neutral"
        view="front"
      />
    );

    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('renders front and back views', () => {
    const { rerender } = render(
      <AvatarBody
        skinTone="medium"
        genderPresentation="neutral"
        view="front"
      />
    );

    expect(screen.getByText('FRONT')).toBeInTheDocument();

    rerender(
      <AvatarBody
        skinTone="medium"
        genderPresentation="neutral"
        view="back"
      />
    );

    expect(screen.getByText('BACK')).toBeInTheDocument();
  });

  it('renders different gender presentations', () => {
    const genders: Array<'male' | 'female' | 'neutral'> = ['male', 'female', 'neutral'];

    genders.forEach((gender) => {
      const { unmount } = render(
        <AvatarBody
          skinTone="medium"
          genderPresentation={gender}
          view="front"
        />
      );

      expect(document.querySelector('svg')).toBeInTheDocument();
      unmount();
    });
  });
});

describe('AvatarMarker', () => {
  const mockMarker: PatientMarker = {
    id: 'test-marker',
    patient_id: 'test-patient',
    category: 'critical',
    marker_type: 'central_line_jugular',
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
  };

  it('renders marker on SVG', () => {
    render(
      <svg viewBox="0 0 100 160">
        <AvatarMarker marker={mockMarker} size="md" />
      </svg>
    );

    // Marker should render a group element
    const group = document.querySelector('g[role="button"]');
    expect(group).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();

    render(
      <svg viewBox="0 0 100 160">
        <AvatarMarker marker={mockMarker} onClick={handleClick} />
      </svg>
    );

    const group = document.querySelector('g[role="button"]');
    if (group) {
      fireEvent.click(group);
    }

    expect(handleClick).toHaveBeenCalledWith(mockMarker);
  });

  it('shows pending indicator for SmartScribe markers', () => {
    const pendingMarker: PatientMarker = {
      ...mockMarker,
      source: 'smartscribe',
      status: 'pending_confirmation',
    };

    render(
      <svg viewBox="0 0 100 160">
        <AvatarMarker marker={pendingMarker} isPending />
      </svg>
    );

    // Check for question mark indicator
    const questionMark = document.querySelector('text');
    expect(questionMark?.textContent).toBe('?');
  });
});

describe('AvatarThumbnail', () => {
  const mockMarkers: PatientMarker[] = [
    {
      id: 'marker-1',
      patient_id: 'test-patient',
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
  ];

  it('renders thumbnail with marker count', () => {
    render(
      <AvatarThumbnail
        patientId="test-patient"
        patientName="John Doe"
        skinTone="medium"
        genderPresentation="neutral"
        markers={mockMarkers}
      />
    );

    expect(screen.getByText('1 marker')).toBeInTheDocument();
  });

  it('shows pending badge when markers pending', () => {
    render(
      <AvatarThumbnail
        patientId="test-patient"
        patientName="John Doe"
        skinTone="medium"
        genderPresentation="neutral"
        markers={mockMarkers}
        pendingCount={2}
      />
    );

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();

    render(
      <AvatarThumbnail
        patientId="test-patient"
        skinTone="medium"
        genderPresentation="neutral"
        markers={mockMarkers}
        onClick={handleClick}
      />
    );

    // Use aria-label to target the wrapper button, not the marker buttons inside
    const thumbnail = screen.getByRole('button', { name: /view.*avatar/i });
    fireEvent.click(thumbnail);

    expect(handleClick).toHaveBeenCalled();
  });
});

describe('PatientAvatar (Integration)', () => {
  it('renders in compact mode by default', () => {
    render(
      <PatientAvatar
        patientId="test-patient"
        patientName="John Doe"
      />
    );

    // Should show marker count from mocked data
    expect(screen.getByText('2 markers')).toBeInTheDocument();
  });

  it('expands to full view when thumbnail clicked', async () => {
    render(
      <PatientAvatar
        patientId="test-patient"
        patientName="John Doe"
      />
    );

    // Click the thumbnail (use aria-label to avoid matching marker buttons)
    const thumbnail = screen.getByRole('button', { name: /view.*avatar/i });
    fireEvent.click(thumbnail);

    // Should show expanded view
    await waitFor(() => {
      expect(screen.getByText('John Doe - Body Map')).toBeInTheDocument();
    });
  });

  it('starts in expanded mode when specified', () => {
    render(
      <PatientAvatar
        patientId="test-patient"
        patientName="Jane Doe"
        initialMode="expanded"
      />
    );

    expect(screen.getByText('Jane Doe - Body Map')).toBeInTheDocument();
  });
});
