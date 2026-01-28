import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PulseOximeterPage from '../PulseOximeterPage';
import { DeviceService } from '../../../services/deviceService';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock BrandingContext
vi.mock('../../../BrandingContext', () => ({
  useBranding: () => ({
    branding: {
      primaryColor: '#00857a',
      secondaryColor: '#5bb5ac',
      gradient: 'linear-gradient(135deg, #00857a 0%, #5bb5ac 100%)',
    },
  }),
}));

// Mock DeviceService
vi.mock('../../../services/deviceService', () => ({
  DeviceService: {
    getConnectionStatus: vi.fn(),
    getSpO2Readings: vi.fn(),
    connectDevice: vi.fn(),
    disconnectDevice: vi.fn(),
  },
}));

const mockSpO2Readings = [
  {
    id: '1',
    user_id: 'user-1',
    device_id: 'device-1',
    spo2: 98,
    pulse_rate: 72,
    measured_at: '2026-01-28T08:00:00Z',
  },
  {
    id: '2',
    user_id: 'user-1',
    device_id: 'device-1',
    spo2: 92,
    pulse_rate: 78,
    measured_at: '2026-01-27T14:00:00Z',
  },
  {
    id: '3',
    user_id: 'user-1',
    device_id: 'device-1',
    spo2: 88,
    pulse_rate: 85,
    measured_at: '2026-01-26T10:00:00Z',
  },
];

const renderPage = () => {
  return render(
    <MemoryRouter>
      <PulseOximeterPage />
    </MemoryRouter>
  );
};

describe('PulseOximeterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the page header correctly', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getSpO2Readings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      expect(screen.getByText('Pulse Oximeter')).toBeInTheDocument();
      expect(screen.getByText(/Monitor your blood oxygen levels/i)).toBeInTheDocument();
    });

    it('renders the SpO2 guide section', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getSpO2Readings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Blood Oxygen (SpO2) Guide')).toBeInTheDocument();
      });
      expect(screen.getByText('95-100%')).toBeInTheDocument();
      expect(screen.getByText('90-94%')).toBeInTheDocument();
      expect(screen.getByText('Below 90%')).toBeInTheDocument();
    });

    it('renders the when to monitor section', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getSpO2Readings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('When to Monitor SpO2')).toBeInTheDocument();
      });
      expect(screen.getByText('During Exercise')).toBeInTheDocument();
      expect(screen.getByText('During Sleep')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('shows loading state initially', () => {
      vi.mocked(DeviceService.getConnectionStatus).mockImplementation(
        () => new Promise(() => {})
      );
      vi.mocked(DeviceService.getSpO2Readings).mockImplementation(
        () => new Promise(() => {})
      );

      renderPage();

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Connection Status', () => {
    it('shows not connected state when device is not connected', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getSpO2Readings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Not Connected')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /connect pulse ox/i })).toBeInTheDocument();
    });

    it('shows connected state when device is connected', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: {
          id: 'conn-1',
          user_id: 'user-1',
          device_type: 'pulse_oximeter',
          device_name: 'Pulse Oximeter',
          connected: true,
          last_sync: '2026-01-28T08:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      vi.mocked(DeviceService.getSpO2Readings).mockResolvedValue({
        success: true,
        data: mockSpO2Readings,
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
    });

    it('shows compatible devices list when not connected', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getSpO2Readings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Compatible Pulse Oximeters:')).toBeInTheDocument();
      });
      expect(screen.getByText(/Masimo MightySat/i)).toBeInTheDocument();
    });
  });

  describe('Data Display', () => {
    it('displays SpO2 readings when connected', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: {
          id: 'conn-1',
          user_id: 'user-1',
          device_type: 'pulse_oximeter',
          device_name: 'Pulse Oximeter',
          connected: true,
          last_sync: '2026-01-28T08:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      vi.mocked(DeviceService.getSpO2Readings).mockResolvedValue({
        success: true,
        data: mockSpO2Readings,
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Recent Readings')).toBeInTheDocument();
      });
      expect(screen.getByText('98%')).toBeInTheDocument();
      expect(screen.getByText('92%')).toBeInTheDocument();
      expect(screen.getByText('88%')).toBeInTheDocument();
    });

    it('shows empty state when no readings exist', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: {
          id: 'conn-1',
          user_id: 'user-1',
          device_type: 'pulse_oximeter',
          device_name: 'Pulse Oximeter',
          connected: true,
          last_sync: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      vi.mocked(DeviceService.getSpO2Readings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/no readings yet/i)).toBeInTheDocument();
      });
    });

    it('displays pulse rate alongside SpO2', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: {
          id: 'conn-1',
          user_id: 'user-1',
          device_type: 'pulse_oximeter',
          device_name: 'Pulse Oximeter',
          connected: true,
          last_sync: '2026-01-28T08:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      vi.mocked(DeviceService.getSpO2Readings).mockResolvedValue({
        success: true,
        data: [mockSpO2Readings[0]],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Pulse: 72 bpm')).toBeInTheDocument();
      });
    });

    it('displays correct status for different SpO2 levels', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: {
          id: 'conn-1',
          user_id: 'user-1',
          device_type: 'pulse_oximeter',
          device_name: 'Pulse Oximeter',
          connected: true,
          last_sync: '2026-01-28T08:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      vi.mocked(DeviceService.getSpO2Readings).mockResolvedValue({
        success: true,
        data: mockSpO2Readings, // 98 (normal), 92 (low), 88 (critical)
      });

      renderPage();

      await waitFor(() => {
        // Should have Normal, Low, and Critical status badges
        const badges = screen.getAllByText(/normal|low|critical/i);
        expect(badges.length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when connection fails', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getSpO2Readings).mockResolvedValue({
        success: true,
        data: [],
      });
      vi.mocked(DeviceService.connectDevice).mockResolvedValue({
        success: false,
        error: 'Connection timeout',
      });

      renderPage();

      // Wait for loading to complete (button is disabled while loading)
      await waitFor(() => {
        expect(screen.getByText('Not Connected')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /connect pulse ox/i }));

      await waitFor(() => {
        expect(screen.getByText('Connection timeout')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('navigates back to My Health when back button clicked', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getSpO2Readings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back to my health/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /back to my health/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/my-health');
    });

    it('navigates to health observations for manual entry', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getSpO2Readings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enter spo2 reading manually/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /enter spo2 reading manually/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/health-observations');
    });
  });

  describe('Connect/Disconnect Actions', () => {
    it('calls connectDevice when connect button clicked', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getSpO2Readings).mockResolvedValue({
        success: true,
        data: [],
      });
      vi.mocked(DeviceService.connectDevice).mockResolvedValue({
        success: true,
        data: {
          id: 'conn-1',
          user_id: 'user-1',
          device_type: 'pulse_oximeter',
          device_name: 'Pulse Oximeter',
          connected: true,
          last_sync: null,
          created_at: '2026-01-28T00:00:00Z',
        },
      });

      renderPage();

      // Wait for loading to complete (button is disabled while loading)
      await waitFor(() => {
        expect(screen.getByText('Not Connected')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /connect pulse ox/i }));

      await waitFor(() => {
        expect(DeviceService.connectDevice).toHaveBeenCalledWith('pulse_oximeter', 'Pulse Oximeter');
      });
    });

    it('calls disconnectDevice when disconnect button clicked', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: {
          id: 'conn-1',
          user_id: 'user-1',
          device_type: 'pulse_oximeter',
          device_name: 'Pulse Oximeter',
          connected: true,
          last_sync: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      vi.mocked(DeviceService.getSpO2Readings).mockResolvedValue({
        success: true,
        data: [],
      });
      vi.mocked(DeviceService.disconnectDevice).mockResolvedValue({
        success: true,
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /disconnect/i }));

      await waitFor(() => {
        expect(DeviceService.disconnectDevice).toHaveBeenCalledWith('pulse_oximeter');
      });
    });
  });
});
