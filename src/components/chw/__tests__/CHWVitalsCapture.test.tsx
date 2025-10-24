/**
 * CHWVitalsCapture Component Tests
 * Tests critical vitals capture, validation, Bluetooth integration, alert generation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CHWVitalsCapture } from '../CHWVitalsCapture';
import { chwService } from '../../../services/chwService';

jest.mock('../../../services/chwService');

describe('CHWVitalsCapture', () => {
  const mockProps = {
    visitId: 'visit-123',
    onComplete: jest.fn(),
    onBack: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
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

      // Test invalid low value
      fireEvent.change(systolicInput, { target: { value: '50' } });
      fireEvent.blur(systolicInput);

      expect(screen.getByText(/Please check this value/i)).toBeInTheDocument();

      // Test invalid high value
      fireEvent.change(systolicInput, { target: { value: '250' } });
      fireEvent.blur(systolicInput);

      expect(screen.getByText(/Please check this value/i)).toBeInTheDocument();
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

      expect(screen.getByText(/CRITICAL/i)).toBeInTheDocument();
      expect(screen.getByText(/physician will be notified/i)).toBeInTheDocument();
    });

    it('should show warning for critical low blood pressure', () => {
      render(<CHWVitalsCapture {...mockProps} />);

      const systolicInput = screen.getByLabelText(/Systolic/i);
      fireEvent.change(systolicInput, { target: { value: '85' } });
      fireEvent.blur(systolicInput);

      expect(screen.getByText(/CRITICAL/i)).toBeInTheDocument();
      expect(screen.getByText(/shock risk/i)).toBeInTheDocument();
    });

    it('should show warning for critical low oxygen saturation', () => {
      render(<CHWVitalsCapture {...mockProps} />);

      const o2Input = screen.getByLabelText(/Oxygen Saturation/i);
      fireEvent.change(o2Input, { target: { value: '85' } });
      fireEvent.blur(o2Input);

      expect(screen.getByText(/CRITICAL/i)).toBeInTheDocument();
      expect(screen.getByText(/immediate attention/i)).toBeInTheDocument();
    });

    it('should show warning for elevated blood pressure', () => {
      render(<CHWVitalsCapture {...mockProps} />);

      const systolicInput = screen.getByLabelText(/Systolic/i);
      fireEvent.change(systolicInput, { target: { value: '165' } });
      fireEvent.blur(systolicInput);

      expect(screen.getByText(/Elevated/i)).toBeInTheDocument();
    });
  });

  describe('Bluetooth Device Integration', () => {
    it('should show Bluetooth connection button', () => {
      render(<CHWVitalsCapture {...mockProps} />);

      expect(screen.getByText(/Connect Bluetooth Device/i)).toBeInTheDocument();
    });

    it('should disable manual entry when Bluetooth is connected', async () => {
      render(<CHWVitalsCapture {...mockProps} />);

      const connectButton = screen.getByText(/Connect Bluetooth Device/i);
      fireEvent.click(connectButton);

      await waitFor(() => {
        const systolicInput = screen.getByLabelText(/Systolic/i) as HTMLInputElement;
        expect(systolicInput).toBeDisabled();
      });
    });

    it('should handle Bluetooth connection failure gracefully', async () => {
      render(<CHWVitalsCapture {...mockProps} />);

      const connectButton = screen.getByText(/Connect Bluetooth Device/i);
      fireEvent.click(connectButton);

      await waitFor(() => {
        expect(screen.getByText(/Unable to connect/i)).toBeInTheDocument();
      });
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
      (chwService.captureVitals as jest.Mock).mockResolvedValue(undefined);

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
      (chwService.captureVitals as jest.Mock).mockResolvedValue(undefined);

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
      (chwService.captureVitals as jest.Mock).mockResolvedValue(undefined);

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
      (chwService.captureVitals as jest.Mock).mockResolvedValue(undefined);

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
      (chwService.captureVitals as jest.Mock).mockRejectedValue(new Error('Save failed'));

      render(<CHWVitalsCapture {...mockProps} />);

      fireEvent.change(screen.getByLabelText(/Systolic/i), { target: { value: '120' } });
      fireEvent.change(screen.getByLabelText(/Diastolic/i), { target: { value: '80' } });

      fireEvent.click(screen.getByText(/Save Vitals/i));

      await waitFor(() => {
        expect(screen.getByText(/Failed to save vitals/i)).toBeInTheDocument();
      });
    });

    it('should allow retry after error', async () => {
      (chwService.captureVitals as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined);

      render(<CHWVitalsCapture {...mockProps} />);

      fireEvent.change(screen.getByLabelText(/Systolic/i), { target: { value: '120' } });
      fireEvent.change(screen.getByLabelText(/Diastolic/i), { target: { value: '80' } });

      // First attempt fails
      fireEvent.click(screen.getByText(/Save Vitals/i));

      await waitFor(() => {
        expect(screen.getByText(/Failed to save vitals/i)).toBeInTheDocument();
      });

      // Retry succeeds
      fireEvent.click(screen.getByText(/Retry/i));

      await waitFor(() => {
        expect(mockProps.onComplete).toHaveBeenCalled();
      });
    });
  });
});
