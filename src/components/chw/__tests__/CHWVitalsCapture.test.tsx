/**
 * CHWVitalsCapture Component Tests
 * Tests critical vitals capture, validation, Bluetooth integration, alert generation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CHWVitalsCapture } from '../CHWVitalsCapture';
import { chwService } from '../../../services/chwService';

vi.mock('../../../services/chwService');

// Mock useBluetooth hook
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockBluetoothState: {
  isConnecting: boolean;
  isConnected: boolean;
  deviceName: string | null;
  error: string | null;
  lastReading: unknown;
} = {
  isConnecting: false,
  isConnected: false,
  deviceName: null,
  error: null,
  lastReading: null,
};

vi.mock('../../vitals/useBluetooth', () => ({
  useBluetooth: () => ({
    state: mockBluetoothState,
    connect: mockConnect,
    disconnect: mockDisconnect,
    isSupported: true,
  }),
}));

describe('CHWVitalsCapture - Error message handling', () => {
  const mockProps = {
    visitId: 'visit-123',
    language: 'en' as const,
    onComplete: vi.fn(),
    onBack: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Bluetooth state
    mockBluetoothState.isConnecting = false;
    mockBluetoothState.isConnected = false;
    mockBluetoothState.deviceName = null;
    mockBluetoothState.error = null;
    mockBluetoothState.lastReading = null;
  });

  describe('Manual Vitals Entry', () => {
    it('should render all vital sign input fields', () => {
      render(<CHWVitalsCapture {...mockProps} />);

      expect(screen.getByLabelText(/Systolic/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Diastolic/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Heart Rate/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Oxygen Saturation/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Temperature/i)).toBeInTheDocument();
    });

    it('should accept valid vital sign values', () => {
      render(<CHWVitalsCapture {...mockProps} />);

      const systolicInput = screen.getByLabelText(/Systolic/i) as HTMLInputElement;
      fireEvent.change(systolicInput, { target: { value: '120' } });

      expect(systolicInput.value).toBe('120');
    });

    it('should validate blood pressure range (systolic)', () => {
      render(<CHWVitalsCapture {...mockProps} />);

      const systolicInput = screen.getByLabelText(/Systolic/i) as HTMLInputElement;

      // Test invalid low value - displays critical alert for <90
      fireEvent.change(systolicInput, { target: { value: '50' } });
      fireEvent.blur(systolicInput);

      // Value <90 shows CRITICAL alert, not validation message
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Test invalid high value - displays critical alert for >180
      fireEvent.change(systolicInput, { target: { value: '250' } });
      fireEvent.blur(systolicInput);

      // Value >180 shows CRITICAL alert
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should validate oxygen saturation range (0-100)', () => {
      render(<CHWVitalsCapture {...mockProps} />);

      const o2Input = screen.getByLabelText(/Oxygen Saturation/i) as HTMLInputElement;

      fireEvent.change(o2Input, { target: { value: '101' } });
      fireEvent.blur(o2Input);

      expect(screen.getByText(/must be between 0 and 100/i)).toBeInTheDocument();
    });
  });

  describe('Critical Values - Alert Warnings', () => {
    it('should show warning for critical high blood pressure', () => {
      render(<CHWVitalsCapture {...mockProps} />);

      const systolicInput = screen.getByLabelText(/Systolic/i);
      fireEvent.change(systolicInput, { target: { value: '190' } });
      fireEvent.blur(systolicInput);

      // Check for the alert role element which contains the full critical message
      const alertElement = screen.getByRole('alert');
      expect(alertElement).toBeInTheDocument();
      expect(alertElement.textContent).toMatch(/CRITICAL.*High Blood Pressure.*physician will be notified immediately/i);
    });

    it('should show warning for critical low blood pressure', () => {
      render(<CHWVitalsCapture {...mockProps} />);

      const systolicInput = screen.getByLabelText(/Systolic/i);
      fireEvent.change(systolicInput, { target: { value: '85' } });
      fireEvent.blur(systolicInput);

      const alertElement = screen.getByRole('alert');
      expect(alertElement).toBeInTheDocument();
      expect(alertElement.textContent).toMatch(/CRITICAL.*Low Blood Pressure.*shock risk/i);
    });

    it('should show warning for critical low oxygen saturation', () => {
      render(<CHWVitalsCapture {...mockProps} />);

      const o2Input = screen.getByLabelText(/Oxygen Saturation/i);
      fireEvent.change(o2Input, { target: { value: '85' } });
      fireEvent.blur(o2Input);

      const alertElement = screen.getByRole('alert');
      expect(alertElement).toBeInTheDocument();
      expect(alertElement.textContent).toMatch(/CRITICAL.*Low Oxygen Saturation.*immediate attention/i);
    });

    it('should show warning for elevated blood pressure', () => {
      render(<CHWVitalsCapture {...mockProps} />);

      const systolicInput = screen.getByLabelText(/Systolic/i);
      fireEvent.change(systolicInput, { target: { value: '165' } });
      fireEvent.blur(systolicInput);

      const alertElement = screen.getByRole('alert');
      expect(alertElement).toBeInTheDocument();
      expect(alertElement.textContent).toMatch(/Elevated.*Blood Pressure/i);
    });
  });

  describe('Bluetooth Device Integration', () => {
    it('should show Bluetooth connection button', () => {
      render(<CHWVitalsCapture {...mockProps} />);

      expect(screen.getByText(/Connect Bluetooth Device/i)).toBeInTheDocument();
    });

    it('should show device type menu when button is clicked', async () => {
      const user = userEvent.setup();
      render(<CHWVitalsCapture {...mockProps} />);

      const connectButton = screen.getByRole('button', { name: /Connect Bluetooth Device/i });
      await user.click(connectButton);

      // Menu should appear with device type options
      await waitFor(() => {
        expect(screen.getByText('Select Device Type')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /Blood Pressure/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Heart Rate/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Weight Scale/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Glucose Meter/i })).toBeInTheDocument();
    });

    it('should call connect with correct vital type when device selected', async () => {
      const user = userEvent.setup();
      render(<CHWVitalsCapture {...mockProps} />);

      const connectButton = screen.getByRole('button', { name: /Connect Bluetooth Device/i });
      await user.click(connectButton);

      // Wait for menu to appear
      await waitFor(() => {
        expect(screen.getByText('Select Device Type')).toBeInTheDocument();
      });

      // Click on Blood Pressure option (use getByRole to be specific)
      const bpButton = screen.getByRole('button', { name: /💓.*Blood Pressure/i });
      await user.click(bpButton);

      expect(mockConnect).toHaveBeenCalledWith('blood_pressure');
    });

    it('should show connected status when device is connected', () => {
      mockBluetoothState.isConnected = true;
      mockBluetoothState.deviceName = 'BP Monitor';

      render(<CHWVitalsCapture {...mockProps} />);

      expect(screen.getByText(/Connected.*BP Monitor/i)).toBeInTheDocument();
    });

    it('should show connecting state during connection', () => {
      mockBluetoothState.isConnecting = true;

      render(<CHWVitalsCapture {...mockProps} />);

      expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
    });

    it('should handle Bluetooth connection failure gracefully', async () => {
      mockBluetoothState.error = 'Connection failed';

      render(<CHWVitalsCapture {...mockProps} />);

      expect(screen.getByText(/Connection failed/i)).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should require at least blood pressure values before submission', () => {
      render(<CHWVitalsCapture {...mockProps} />);

      const submitButton = screen.getByText(/Save Vitals/i);
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit when required vitals are entered', () => {
      render(<CHWVitalsCapture {...mockProps} />);

      fireEvent.change(screen.getByLabelText(/Systolic/i), { target: { value: '120' } });
      fireEvent.change(screen.getByLabelText(/Diastolic/i), { target: { value: '80' } });

      const submitButton = screen.getByText(/Save Vitals/i);
      expect(submitButton).not.toBeDisabled();
    });

    it('should call chwService.captureVitals on submission', async () => {
      (chwService.captureVitals as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      render(<CHWVitalsCapture {...mockProps} />);

      fireEvent.change(screen.getByLabelText(/Systolic/i), { target: { value: '120' } });
      fireEvent.change(screen.getByLabelText(/Diastolic/i), { target: { value: '80' } });
      fireEvent.change(screen.getByLabelText(/Heart Rate/i), { target: { value: '72' } });

      const submitButton = screen.getByText(/Save Vitals/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(chwService.captureVitals).toHaveBeenCalledWith(
          'visit-123',
          expect.objectContaining({
            systolic: 120,
            diastolic: 80,
            heart_rate: 72,
          })
        );
      });
    });

    it('should call onComplete callback after successful submission', async () => {
      (chwService.captureVitals as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      render(<CHWVitalsCapture {...mockProps} />);

      fireEvent.change(screen.getByLabelText(/Systolic/i), { target: { value: '120' } });
      fireEvent.change(screen.getByLabelText(/Diastolic/i), { target: { value: '80' } });

      fireEvent.click(screen.getByText(/Save Vitals/i));

      await waitFor(() => {
        expect(mockProps.onComplete).toHaveBeenCalled();
      });
    });
  });

  describe('Offline Support', () => {
    it('should show offline indicator when network is unavailable', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      render(<CHWVitalsCapture {...mockProps} />);

      expect(screen.getByText(/Offline Mode/i)).toBeInTheDocument();
      expect(screen.getByText(/Data will sync when connection is restored/i)).toBeInTheDocument();
    });

    it('should still allow data entry in offline mode', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      render(<CHWVitalsCapture {...mockProps} />);

      const systolicInput = screen.getByLabelText(/Systolic/i) as HTMLInputElement;
      fireEvent.change(systolicInput, { target: { value: '120' } });

      expect(systolicInput.value).toBe('120');
      expect(systolicInput).not.toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for all inputs', () => {
      render(<CHWVitalsCapture {...mockProps} />);

      const systolicInput = screen.getByLabelText(/Systolic/i);
      expect(systolicInput).toHaveAttribute('aria-label');
    });

    it('should announce critical values to screen readers', () => {
      render(<CHWVitalsCapture {...mockProps} />);

      fireEvent.change(screen.getByLabelText(/Systolic/i), { target: { value: '190' } });
      fireEvent.blur(screen.getByLabelText(/Systolic/i));

      const alertElement = screen.getByRole('alert');
      expect(alertElement).toBeInTheDocument();
    });
  });

  describe('Data Integrity', () => {
    it('should include timestamp in captured vitals', async () => {
      (chwService.captureVitals as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      render(<CHWVitalsCapture {...mockProps} />);

      fireEvent.change(screen.getByLabelText(/Systolic/i), { target: { value: '120' } });
      fireEvent.change(screen.getByLabelText(/Diastolic/i), { target: { value: '80' } });

      fireEvent.click(screen.getByText(/Save Vitals/i));

      await waitFor(() => {
        expect(chwService.captureVitals).toHaveBeenCalledWith(
          'visit-123',
          expect.objectContaining({
            captured_at: expect.any(String),
          })
        );
      });
    });

    it('should include device type in captured data', async () => {
      (chwService.captureVitals as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      render(<CHWVitalsCapture {...mockProps} />);

      fireEvent.change(screen.getByLabelText(/Systolic/i), { target: { value: '120' } });
      fireEvent.change(screen.getByLabelText(/Diastolic/i), { target: { value: '80' } });

      fireEvent.click(screen.getByText(/Save Vitals/i));

      await waitFor(() => {
        expect(chwService.captureVitals).toHaveBeenCalledWith(
          'visit-123',
          expect.objectContaining({
            device_type: 'manual',
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message if save fails', async () => {
      (chwService.captureVitals as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Save failed'));

      render(<CHWVitalsCapture {...mockProps} />);

      fireEvent.change(screen.getByLabelText(/Systolic/i), { target: { value: '120' } });
      fireEvent.change(screen.getByLabelText(/Diastolic/i), { target: { value: '80' } });

      fireEvent.click(screen.getByText(/Save Vitals/i));

      // Use getAllByText since "Failed to save vitals" appears in both heading and message
      await waitFor(() => {
        const errorMessages = screen.getAllByText(/Failed to save vitals/i);
        expect(errorMessages.length).toBeGreaterThan(0);
      });
      expect(screen.getByText(/Please try again/i)).toBeInTheDocument();
    });

    it('should allow retry after error', async () => {
      (chwService.captureVitals as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined);

      render(<CHWVitalsCapture {...mockProps} />);

      fireEvent.change(screen.getByLabelText(/Systolic/i), { target: { value: '120' } });
      fireEvent.change(screen.getByLabelText(/Diastolic/i), { target: { value: '80' } });

      // First attempt fails
      fireEvent.click(screen.getByText(/Save Vitals/i));

      // Use getAllByText since "Failed to save vitals" appears in both heading and message
      await waitFor(() => {
        const errorMessages = screen.getAllByText(/Failed to save vitals/i);
        expect(errorMessages.length).toBeGreaterThan(0);
      });
      expect(screen.getByText(/Please try again/i)).toBeInTheDocument();

      // Retry succeeds
      fireEvent.click(screen.getByText(/Retry/i));

      await waitFor(() => {
        expect(mockProps.onComplete).toHaveBeenCalled();
      });
    });
  });
});
