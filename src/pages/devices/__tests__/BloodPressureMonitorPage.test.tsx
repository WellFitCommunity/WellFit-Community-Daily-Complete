import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BloodPressureMonitorPage from '../BloodPressureMonitorPage';
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
    getBPReadings: vi.fn(),
    connectDevice: vi.fn(),
    disconnectDevice: vi.fn(),
  },
}));

const mockBPReadings = [
  {
    id: '1',
    user_id: 'user-1',
    device_id: 'device-1',
    systolic: 118,
    diastolic: 76,
    pulse: 72,
    measured_at: '2026-01-28T08:00:00Z',
  },
  {
    id: '2',
    user_id: 'user-1',
    device_id: 'device-1',
    systolic: 135,
    diastolic: 85,
    pulse: 78,
    measured_at: '2026-01-27T08:00:00Z',
  },
];

const renderPage = () => {
  return render(
    <MemoryRouter>
      <BloodPressureMonitorPage />
    </MemoryRouter>
  );
};

describe('BloodPressureMonitorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the page header correctly', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getBPReadings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      expect(screen.getByText('Blood Pressure Monitor')).toBeInTheDocument();
      expect(screen.getByText(/Track your blood pressure and pulse readings/i)).toBeInTheDocument();
    });

    it('renders the BP guide section', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getBPReadings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Blood Pressure Guide')).toBeInTheDocument();
      });
      expect(screen.getByText('Normal')).toBeInTheDocument();
      expect(screen.getByText('Elevated')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('shows loading state initially', () => {
      vi.mocked(DeviceService.getConnectionStatus).mockImplementation(
        () => new Promise(() => {})
      );
      vi.mocked(DeviceService.getBPReadings).mockImplementation(
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
      vi.mocked(DeviceService.getBPReadings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Not Connected')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /connect monitor/i })).toBeInTheDocument();
    });

    it('shows connected state when device is connected', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: {
          id: 'conn-1',
          user_id: 'user-1',
          device_type: 'bp_monitor',
          device_name: 'BP Monitor',
          connected: true,
          last_sync: '2026-01-28T08:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      vi.mocked(DeviceService.getBPReadings).mockResolvedValue({
        success: true,
        data: mockBPReadings,
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
      vi.mocked(DeviceService.getBPReadings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Compatible BP Monitors:')).toBeInTheDocument();
      });
    });
  });

  describe('Data Display', () => {
    it('displays BP readings when connected', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: {
          id: 'conn-1',
          user_id: 'user-1',
          device_type: 'bp_monitor',
          device_name: 'BP Monitor',
          connected: true,
          last_sync: '2026-01-28T08:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      vi.mocked(DeviceService.getBPReadings).mockResolvedValue({
        success: true,
        data: mockBPReadings,
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Recent Readings')).toBeInTheDocument();
      });
      expect(screen.getByText('118/76')).toBeInTheDocument();
      expect(screen.getByText('135/85')).toBeInTheDocument();
    });

    it('shows empty state when no readings exist', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: {
          id: 'conn-1',
          user_id: 'user-1',
          device_type: 'bp_monitor',
          device_name: 'BP Monitor',
          connected: true,
          last_sync: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      vi.mocked(DeviceService.getBPReadings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/no readings yet/i)).toBeInTheDocument();
      });
    });

    it('displays correct BP status for normal reading', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: {
          id: 'conn-1',
          user_id: 'user-1',
          device_type: 'bp_monitor',
          device_name: 'BP Monitor',
          connected: true,
          last_sync: '2026-01-28T08:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      vi.mocked(DeviceService.getBPReadings).mockResolvedValue({
        success: true,
        data: [mockBPReadings[0]], // 118/76 is normal
      });

      renderPage();

      await waitFor(() => {
        // The status badge should show "Normal" for 118/76
        const statusBadges = screen.getAllByText(/normal/i);
        expect(statusBadges.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when connection fails', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getBPReadings).mockResolvedValue({
        success: true,
        data: [],
      });
      vi.mocked(DeviceService.connectDevice).mockResolvedValue({
        success: false,
        error: 'Device not found',
      });

      renderPage();

      // Wait for loading to complete (button is disabled while loading)
      await waitFor(() => {
        expect(screen.getByText('Not Connected')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /connect monitor/i }));

      await waitFor(() => {
        expect(screen.getByText('Device not found')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('navigates back to My Health when back button clicked', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getBPReadings).mockResolvedValue({
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

    it('shows inline manual entry form when Add Reading clicked', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getBPReadings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add reading/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /add reading/i }));

      await waitFor(() => {
        expect(screen.getByText('Blood Pressure Reading')).toBeInTheDocument();
        expect(screen.getByLabelText(/Systolic/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Diastolic/)).toBeInTheDocument();
      });
    });
  });

  describe('Connect/Disconnect Actions', () => {
    it('calls connectDevice when connect button clicked', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getBPReadings).mockResolvedValue({
        success: true,
        data: [],
      });
      vi.mocked(DeviceService.connectDevice).mockResolvedValue({
        success: true,
        data: {
          id: 'conn-1',
          user_id: 'user-1',
          device_type: 'bp_monitor',
          device_name: 'Blood Pressure Monitor',
          connected: true,
          last_sync: null,
          created_at: '2026-01-28T00:00:00Z',
        },
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect monitor/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /connect monitor/i }));

      await waitFor(() => {
        expect(DeviceService.connectDevice).toHaveBeenCalledWith('bp_monitor', 'Blood Pressure Monitor');
      });
    });

    it('calls disconnectDevice when disconnect button clicked', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: {
          id: 'conn-1',
          user_id: 'user-1',
          device_type: 'bp_monitor',
          device_name: 'BP Monitor',
          connected: true,
          last_sync: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      vi.mocked(DeviceService.getBPReadings).mockResolvedValue({
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
        expect(DeviceService.disconnectDevice).toHaveBeenCalledWith('bp_monitor');
      });
    });
  });
});
