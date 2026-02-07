/**
 * BedManagementPanel tests — validates the orchestrator loads data
 * via BedManagementService and delegates rendering to sub-components.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockGetBedBoard = vi.fn();
const mockGetUnitCapacity = vi.fn();
const mockGetHospitalUnits = vi.fn();
const mockUpdateBedStatus = vi.fn();

vi.mock('../../../services/bedManagementService', () => ({
  BedManagementService: {
    getBedBoard: (...args: unknown[]) => mockGetBedBoard(...args),
    getUnitCapacity: () => mockGetUnitCapacity(),
    getHospitalUnits: () => mockGetHospitalUnits(),
    updateBedStatus: (...args: unknown[]) => mockUpdateBedStatus(...args),
    generateForecast: vi.fn().mockResolvedValue({ success: false, error: { message: 'Not implemented' } }),
    dischargePatient: vi.fn().mockResolvedValue({ success: false, error: { message: 'Not implemented' } }),
    submitLearningFeedback: vi.fn().mockResolvedValue({ success: false, error: { message: 'Not implemented' } }),
    getPredictionAccuracy: vi.fn().mockResolvedValue({ success: false, error: { message: 'Not implemented' } }),
  },
}));

vi.mock('../../../services/ai', () => ({
  bedOptimizer: {
    generateOptimizationReport: vi.fn().mockResolvedValue({ success: false, error: { message: 'Not available' } }),
  },
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }),
    },
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../services/providerAffirmations', () => ({
  getProviderAffirmation: () => 'Great work!',
  METRICS_TEMPLATES: { tasksCompleted: (n: number) => `${n} tasks done!` },
}));

vi.mock('../../../hooks/usePresence', () => ({
  usePresence: () => ({
    otherUsers: [],
    setEditing: vi.fn(),
  }),
}));

vi.mock('../../collaboration', () => ({
  PresenceAvatars: () => null,
  ActivityFeed: () => null,
  useActivityBroadcast: () => ({ broadcast: vi.fn() }),
}));

vi.mock('../../../hooks/useVoiceSearch', () => ({
  useVoiceSearch: vi.fn(),
}));

vi.mock('../../../contexts/VoiceActionContext', () => ({
  SearchResult: {},
}));

vi.mock('../../envision-atlus/EAAffirmationToast', () => ({
  EAAffirmationToast: () => null,
}));

vi.mock('../../../BrandingContext', () => ({
  useBranding: () => ({ branding: { appName: 'Test' } }),
}));

// ============================================================================
// TEST DATA
// ============================================================================

const mockBedBoard = [
  {
    bed_id: 'bed-1',
    bed_label: '201A',
    room_number: '201',
    unit_id: 'unit-1',
    unit_name: 'ICU',
    unit_code: 'ICU-1',
    unit_type: 'icu',
    status: 'occupied',
    bed_type: 'standard',
    has_telemetry: true,
    has_isolation_capability: false,
    has_negative_pressure: false,
    patient_name: 'John Doe',
    patient_id: 'p1',
    patient_mrn: 'MRN001',
    patient_acuity: 'HIGH',
    expected_discharge_date: '2026-02-08',
    assigned_at: '2026-02-06',
  },
  {
    bed_id: 'bed-2',
    bed_label: '202A',
    room_number: '202',
    unit_id: 'unit-1',
    unit_name: 'ICU',
    unit_code: 'ICU-1',
    unit_type: 'icu',
    status: 'available',
    bed_type: 'standard',
    has_telemetry: false,
    has_isolation_capability: false,
    has_negative_pressure: false,
  },
];

const mockCapacity = [
  {
    unit_id: 'unit-1',
    unit_name: 'ICU',
    unit_code: 'ICU-1',
    unit_type: 'icu',
    total_beds: 10,
    occupied: 7,
    available: 2,
    pending_clean: 1,
    out_of_service: 0,
    occupancy_pct: 70,
  },
];

const mockUnits = [
  { id: 'unit-1', unit_name: 'ICU', unit_code: 'ICU-1', unit_type: 'icu', is_active: true, total_beds: 10 },
];

// ============================================================================
// SETUP
// ============================================================================

function setupMocks() {
  mockGetBedBoard.mockResolvedValue({ success: true, data: mockBedBoard });
  mockGetUnitCapacity.mockResolvedValue({ success: true, data: mockCapacity });
  mockGetHospitalUnits.mockResolvedValue({ success: true, data: mockUnits });
}

// ============================================================================
// TESTS
// ============================================================================

describe('BedManagementPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  async function renderPanel() {
    const { default: BedManagementPanel } = await import('../BedManagementPanel');
    return render(<BedManagementPanel />);
  }

  it('renders loading skeleton initially', async () => {
    // Make data never resolve
    mockGetBedBoard.mockReturnValue(new Promise(() => {}));
    mockGetUnitCapacity.mockReturnValue(new Promise(() => {}));
    mockGetHospitalUnits.mockReturnValue(new Promise(() => {}));

    const { default: BedManagementPanel } = await import('../BedManagementPanel');
    render(<BedManagementPanel />);

    // Expect the loading skeleton (pulse animation divs)
    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('renders header with title after data loads', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Bed Management')).toBeInTheDocument();
    });
    expect(screen.getByText(/Real-time bed tracking/)).toBeInTheDocument();
  });

  it('displays KPI metric cards', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Total Beds')).toBeInTheDocument();
    });
    // 'Occupancy' and 'Available' appear in metric cards and capacity table
    expect(screen.getAllByText('Occupancy').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Available').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pending Clean').length).toBeGreaterThan(0);
  });

  it('shows tab selector with 3 tabs', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Real-Time')).toBeInTheDocument();
    });
    expect(screen.getByText('Forecasts & AI')).toBeInTheDocument();
    expect(screen.getByText('ML Feedback')).toBeInTheDocument();
  });

  it('renders bed board with unit groups', async () => {
    await renderPanel();

    // 'ICU' appears in multiple places (bed board, capacity table, unit filter)
    await waitFor(() => {
      expect(screen.getAllByText('ICU').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('201A')).toBeInTheDocument();
    expect(screen.getByText('202A')).toBeInTheDocument();
  });

  it('displays unit capacity table', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Unit Capacity Overview')).toBeInTheDocument();
    });
  });

  it('calls BedManagementService methods on load', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(mockGetBedBoard).toHaveBeenCalled();
      expect(mockGetUnitCapacity).toHaveBeenCalled();
      expect(mockGetHospitalUnits).toHaveBeenCalled();
    });
  });

  it('switches to Forecasts & AI tab', async () => {
    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Forecasts & AI')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Forecasts & AI'));

    await waitFor(() => {
      expect(screen.getByText('Bed Availability Forecasts')).toBeInTheDocument();
    });
  });

  it('shows quick filter buttons for unit types', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('All Beds')).toBeInTheDocument();
    });
    expect(screen.getByText('Med-Surg')).toBeInTheDocument();
  });

  it('handles empty data gracefully', async () => {
    mockGetBedBoard.mockResolvedValue({ success: true, data: [] });
    mockGetUnitCapacity.mockResolvedValue({ success: true, data: [] });
    mockGetHospitalUnits.mockResolvedValue({ success: true, data: [] });

    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('No beds found')).toBeInTheDocument();
    });
  });
});
