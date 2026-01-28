import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GlucometerPage from '../GlucometerPage';
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
    getGlucoseReadings: vi.fn(),
    connectDevice: vi.fn(),
    disconnectDevice: vi.fn(),
  },
}));

const mockGlucoseReadings = [
  {
    id: '1',
    user_id: 'user-1',
    device_id: 'device-1',
    value: 98,
    meal_context: 'fasting' as const,
    measured_at: '2026-01-28T07:30:00Z',
  },
  {
    id: '2',
    user_id: 'user-1',
    device_id: 'device-1',
    value: 145,
    meal_context: 'after_meal' as const,
    measured_at: '2026-01-28T10:00:00Z',
  },
  {
    id: '3',
    user_id: 'user-1',
    device_id: 'device-1',
    value: 65,
    meal_context: 'before_meal' as const,
    measured_at: '2026-01-27T12:00:00Z',
  },
];

const renderPage = () => {
  return render(
    <MemoryRouter>
      <GlucometerPage />
    </MemoryRouter>
  );
};

describe('GlucometerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the page header correctly', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getGlucoseReadings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      expect(screen.getByText('Glucometer')).toBeInTheDocument();
      expect(screen.getByText(/Track your blood glucose for diabetes management/i)).toBeInTheDocument();
    });

    it('renders the target ranges section', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getGlucoseReadings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Target Blood Glucose Ranges')).toBeInTheDocument();
      });
      expect(screen.getByText('Fasting / Before Meals')).toBeInTheDocument();
      expect(screen.getByText('80-130 mg/dL')).toBeInTheDocument();
    });

    it('renders the A1C tracking section', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getGlucoseReadings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('A1C Tracking')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading state initially', () => {
      vi.mocked(DeviceService.getConnectionStatus).mockImplementation(
        () => new Promise(() => {})
      );
      vi.mocked(DeviceService.getGlucoseReadings).mockImplementation(
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
      vi.mocked(DeviceService.getGlucoseReadings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Not Connected')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /connect glucometer/i })).toBeInTheDocument();
    });

    it('shows connected state when device is connected', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: {
          id: 'conn-1',
          user_id: 'user-1',
          device_type: 'glucometer',
          device_name: 'Glucometer',
          connected: true,
          last_sync: '2026-01-28T08:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      vi.mocked(DeviceService.getGlucoseReadings).mockResolvedValue({
        success: true,
        data: mockGlucoseReadings,
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
      vi.mocked(DeviceService.getGlucoseReadings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Compatible Glucometers:')).toBeInTheDocument();
      });
      expect(screen.getByText(/Dexcom G6\/G7 CGM/i)).toBeInTheDocument();
    });
  });

  describe('Data Display', () => {
    it('displays glucose readings when connected', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: {
          id: 'conn-1',
          user_id: 'user-1',
          device_type: 'glucometer',
          device_name: 'Glucometer',
          connected: true,
          last_sync: '2026-01-28T08:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      vi.mocked(DeviceService.getGlucoseReadings).mockResolvedValue({
        success: true,
        data: mockGlucoseReadings,
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Recent Readings')).toBeInTheDocument();
      });
      expect(screen.getByText('98')).toBeInTheDocument();
      expect(screen.getByText('145')).toBeInTheDocument();
    });

    it('shows empty state when no readings exist', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: {
          id: 'conn-1',
          user_id: 'user-1',
          device_type: 'glucometer',
          device_name: 'Glucometer',
          connected: true,
          last_sync: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      vi.mocked(DeviceService.getGlucoseReadings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/no readings yet/i)).toBeInTheDocument();
      });
    });

    it('displays meal context labels correctly', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: {
          id: 'conn-1',
          user_id: 'user-1',
          device_type: 'glucometer',
          device_name: 'Glucometer',
          connected: true,
          last_sync: '2026-01-28T08:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      vi.mocked(DeviceService.getGlucoseReadings).mockResolvedValue({
        success: true,
        data: mockGlucoseReadings,
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Fasting')).toBeInTheDocument();
      });
      expect(screen.getByText('After Meal')).toBeInTheDocument();
      expect(screen.getByText('Before Meal')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('displays error message when connection fails', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getGlucoseReadings).mockResolvedValue({
        success: true,
        data: [],
      });
      vi.mocked(DeviceService.connectDevice).mockResolvedValue({
        success: false,
        error: 'Pairing failed',
      });

      renderPage();

      // Wait for loading to complete (button is disabled while loading)
      await waitFor(() => {
        expect(screen.getByText('Not Connected')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /connect glucometer/i }));

      await waitFor(() => {
        expect(screen.getByText('Pairing failed')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('navigates back to My Health when back button clicked', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getGlucoseReadings).mockResolvedValue({
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
      vi.mocked(DeviceService.getGlucoseReadings).mockResolvedValue({
        success: true,
        data: [],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add reading/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /add reading/i }));

      await waitFor(() => {
        expect(screen.getByText('Blood Glucose Reading')).toBeInTheDocument();
        expect(screen.getByLabelText(/Glucose Level/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Meal Context/)).toBeInTheDocument();
      });
    });
  });

  describe('Connect/Disconnect Actions', () => {
    it('calls connectDevice when connect button clicked', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: null,
      });
      vi.mocked(DeviceService.getGlucoseReadings).mockResolvedValue({
        success: true,
        data: [],
      });
      vi.mocked(DeviceService.connectDevice).mockResolvedValue({
        success: true,
        data: {
          id: 'conn-1',
          user_id: 'user-1',
          device_type: 'glucometer',
          device_name: 'Glucometer',
          connected: true,
          last_sync: null,
          created_at: '2026-01-28T00:00:00Z',
        },
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect glucometer/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /connect glucometer/i }));

      await waitFor(() => {
        expect(DeviceService.connectDevice).toHaveBeenCalledWith('glucometer', 'Glucometer');
      });
    });

    it('calls disconnectDevice when disconnect button clicked', async () => {
      vi.mocked(DeviceService.getConnectionStatus).mockResolvedValue({
        success: true,
        data: {
          id: 'conn-1',
          user_id: 'user-1',
          device_type: 'glucometer',
          device_name: 'Glucometer',
          connected: true,
          last_sync: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      vi.mocked(DeviceService.getGlucoseReadings).mockResolvedValue({
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
        expect(DeviceService.disconnectDevice).toHaveBeenCalledWith('glucometer');
      });
    });
  });
});
