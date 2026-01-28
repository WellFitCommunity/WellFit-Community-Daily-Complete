import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SmartScalePage from '../SmartScalePage';
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
    getWeightReadings: vi.fn(),
    connectDevice: vi.fn(),
    disconnectDevice: vi.fn(),
  },
}));

const mockWeightReadings = [
  {
    id: '1',
    user_id: 'user-1',
    device_id: 'device-1',
    weight: 165.5,
    unit: 'lbs' as const,
    bmi: 24.2,
    body_fat: 18.5,
    muscle_mass: 42.3,
    measured_at: '2026-01-28T08:00:00Z',
  },
  {
    id: '2',
    user_id: 'user-1',
    device_id: 'device-1',
    weight: 166.0,
    unit: 'lbs' as const,
    bmi: 24.3,
    measured_at: '2026-01-27T08:00:00Z',
  },
];

const renderPage = () => {
  return render(
    <MemoryRouter>
      <SmartScalePage />
    </MemoryRouter>
  );
};

describe('SmartScalePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the page header correctly', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getWeightReadings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      expect(screen.getByText('Smart Scale')).toBeInTheDocument();
      expect(screen.getByText(/Track your weight, BMI, and body composition/i)).toBeInTheDocument();
    });

    it('renders the back button', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getWeightReadings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back to my health/i })).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading state initially', () => {
      vi.mocked(DeviceService.getConnectionStatus).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );
      vi.mocked(DeviceService.getWeightReadings).mockImplementation(
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
      vi.mocked(DeviceService.getWeightReadings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Not Connected')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /connect scale/i })).toBeInTheDocument();
    });

    it('shows connected state when device is connected', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: {
          id: 'conn-1',
          user_id: 'user-1',
          device_type: 'smart_scale',
          device_name: 'Smart Scale',
          connected: true,
          last_sync: '2026-01-28T08:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      vi.mocked(DeviceService.getWeightReadings).mockResolvedValue({
        success: true,
        data: mockWeightReadings,
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
      vi.mocked(DeviceService.getWeightReadings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Compatible Smart Scales:')).toBeInTheDocument();
      });
    });
  });

  describe('Data Display', () => {
    it('displays weight readings when connected', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: {
          id: 'conn-1',
          user_id: 'user-1',
          device_type: 'smart_scale',
          device_name: 'Smart Scale',
          connected: true,
          last_sync: '2026-01-28T08:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      vi.mocked(DeviceService.getWeightReadings).mockResolvedValue({
        success: true,
        data: mockWeightReadings,
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Recent Measurements')).toBeInTheDocument();
      });
      expect(screen.getByText('165.5 lbs')).toBeInTheDocument();
      expect(screen.getByText('166 lbs')).toBeInTheDocument();
    });

    it('shows empty state when no readings exist', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: {
          id: 'conn-1',
          user_id: 'user-1',
          device_type: 'smart_scale',
          device_name: 'Smart Scale',
          connected: true,
          last_sync: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      vi.mocked(DeviceService.getWeightReadings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/no readings yet/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when connection fails', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getWeightReadings).mockResolvedValue({
        success: true,
        data: [],
      });
      vi.mocked(DeviceService.connectDevice).mockResolvedValue({
        success: false,
        error: 'Bluetooth connection failed',
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect scale/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /connect scale/i }));

      await waitFor(() => {
        expect(screen.getByText('Bluetooth connection failed')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('navigates back to My Health when back button clicked', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getWeightReadings).mockResolvedValue({
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
      vi.mocked(DeviceService.getWeightReadings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enter weight manually/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /enter weight manually/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/health-observations');
    });
  });

  describe('Connect/Disconnect Actions', () => {
    it('calls connectDevice when connect button clicked', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getWeightReadings).mockResolvedValue({
        success: true,
        data: [],
      });
      vi.mocked(DeviceService.connectDevice).mockResolvedValue({
        success: true,
        data: {
          id: 'conn-1',
          user_id: 'user-1',
          device_type: 'smart_scale',
          device_name: 'Smart Scale',
          connected: true,
          last_sync: null,
          created_at: '2026-01-28T00:00:00Z',
        },
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect scale/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /connect scale/i }));

      await waitFor(() => {
        expect(DeviceService.connectDevice).toHaveBeenCalledWith('smart_scale', 'Smart Scale');
      });
    });

    it('calls disconnectDevice when disconnect button clicked', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: {
          id: 'conn-1',
          user_id: 'user-1',
          device_type: 'smart_scale',
          device_name: 'Smart Scale',
          connected: true,
          last_sync: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      vi.mocked(DeviceService.getWeightReadings).mockResolvedValue({
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
        expect(DeviceService.disconnectDevice).toHaveBeenCalledWith('smart_scale');
      });
    });
  });
});
