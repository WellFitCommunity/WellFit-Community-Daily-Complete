import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ManualEntryForm from '../ManualEntryForm';

describe('ManualEntryForm', () => {
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Blood Pressure Form', () => {
    it('renders BP form with correct fields', () => {
      render(
        <ManualEntryForm
          vitalType="bp"
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText('Blood Pressure Reading')).toBeInTheDocument();
      expect(screen.getByLabelText(/Systolic/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Diastolic/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Pulse/)).toBeInTheDocument();
    });

    it('validates required fields on submit', async () => {
      render(
        <ManualEntryForm
          vitalType="bp"
          onSave={mockOnSave}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Save Reading/i }));

      await waitFor(() => {
        expect(screen.getByText('Systolic is required')).toBeInTheDocument();
        expect(screen.getByText('Diastolic is required')).toBeInTheDocument();
        expect(screen.getByText('Pulse is required')).toBeInTheDocument();
      });

      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('has min/max constraints on input fields', () => {
      render(
        <ManualEntryForm
          vitalType="bp"
          onSave={mockOnSave}
        />
      );

      // Verify input constraints are set via HTML attributes
      const systolicInput = screen.getByLabelText(/Systolic/) as HTMLInputElement;
      const diastolicInput = screen.getByLabelText(/Diastolic/) as HTMLInputElement;
      const pulseInput = screen.getByLabelText(/Pulse/) as HTMLInputElement;

      expect(systolicInput).toHaveAttribute('min', '40');
      expect(systolicInput).toHaveAttribute('max', '300');
      expect(diastolicInput).toHaveAttribute('min', '20');
      expect(diastolicInput).toHaveAttribute('max', '200');
      expect(pulseInput).toHaveAttribute('min', '20');
      expect(pulseInput).toHaveAttribute('max', '300');
    });

    it('submits valid data', async () => {
      mockOnSave.mockResolvedValue({ success: true });

      render(
        <ManualEntryForm
          vitalType="bp"
          onSave={mockOnSave}
        />
      );

      fireEvent.change(screen.getByLabelText(/Systolic/), { target: { value: '120' } });
      fireEvent.change(screen.getByLabelText(/Diastolic/), { target: { value: '80' } });
      fireEvent.change(screen.getByLabelText(/Pulse/), { target: { value: '72' } });

      fireEvent.click(screen.getByRole('button', { name: /Save Reading/i }));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            systolic: 120,
            diastolic: 80,
            pulse: 72,
            measured_at: expect.any(String),
          })
        );
      });
    });
  });

  describe('Glucose Form', () => {
    it('renders glucose form with correct fields', () => {
      render(
        <ManualEntryForm
          vitalType="glucose"
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText('Blood Glucose Reading')).toBeInTheDocument();
      expect(screen.getByLabelText(/Glucose Level/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Meal Context/)).toBeInTheDocument();
    });

    it('requires meal context selection', async () => {
      render(
        <ManualEntryForm
          vitalType="glucose"
          onSave={mockOnSave}
        />
      );

      fireEvent.change(screen.getByLabelText(/Glucose Level/), { target: { value: '100' } });
      fireEvent.click(screen.getByRole('button', { name: /Save Reading/i }));

      await waitFor(() => {
        expect(screen.getByText('Meal Context is required')).toBeInTheDocument();
      });
    });

    it('submits valid glucose data', async () => {
      mockOnSave.mockResolvedValue({ success: true });

      render(
        <ManualEntryForm
          vitalType="glucose"
          onSave={mockOnSave}
        />
      );

      fireEvent.change(screen.getByLabelText(/Glucose Level/), { target: { value: '105' } });
      fireEvent.change(screen.getByLabelText(/Meal Context/), { target: { value: 'fasting' } });

      fireEvent.click(screen.getByRole('button', { name: /Save Reading/i }));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            value: 105,
            meal_context: 'fasting',
            measured_at: expect.any(String),
          })
        );
      });
    });
  });

  describe('SpO2 Form', () => {
    it('renders SpO2 form with correct fields', () => {
      render(
        <ManualEntryForm
          vitalType="spo2"
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText('Oxygen Saturation Reading')).toBeInTheDocument();
      expect(screen.getByLabelText(/SpO2/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Pulse Rate/)).toBeInTheDocument();
    });

    it('has SpO2 percentage constraints on input fields', () => {
      render(
        <ManualEntryForm
          vitalType="spo2"
          onSave={mockOnSave}
        />
      );

      // Verify input constraints are set via HTML attributes
      const spo2Input = screen.getByLabelText(/SpO2/) as HTMLInputElement;
      const pulseInput = screen.getByLabelText(/Pulse Rate/) as HTMLInputElement;

      expect(spo2Input).toHaveAttribute('min', '0');
      expect(spo2Input).toHaveAttribute('max', '100');
      expect(pulseInput).toHaveAttribute('min', '20');
      expect(pulseInput).toHaveAttribute('max', '300');
    });
  });

  describe('Weight Form', () => {
    it('renders weight form with correct fields', () => {
      render(
        <ManualEntryForm
          vitalType="weight"
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText('Weight Measurement')).toBeInTheDocument();
      expect(screen.getByLabelText(/Weight/)).toBeInTheDocument();
      expect(screen.getByLabelText(/BMI/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Body Fat/)).toBeInTheDocument();
    });

    it('allows optional BMI and body fat fields', async () => {
      mockOnSave.mockResolvedValue({ success: true });

      render(
        <ManualEntryForm
          vitalType="weight"
          onSave={mockOnSave}
        />
      );

      fireEvent.change(screen.getByLabelText(/^Weight/), { target: { value: '150' } });

      fireEvent.click(screen.getByRole('button', { name: /Save Reading/i }));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            weight: 150,
            measured_at: expect.any(String),
          })
        );
      });
    });
  });

  describe('Form Interactions', () => {
    it('shows success message after successful save', async () => {
      mockOnSave.mockResolvedValue({ success: true });

      render(
        <ManualEntryForm
          vitalType="bp"
          onSave={mockOnSave}
        />
      );

      fireEvent.change(screen.getByLabelText(/Systolic/), { target: { value: '120' } });
      fireEvent.change(screen.getByLabelText(/Diastolic/), { target: { value: '80' } });
      fireEvent.change(screen.getByLabelText(/Pulse/), { target: { value: '72' } });

      fireEvent.click(screen.getByRole('button', { name: /Save Reading/i }));

      await waitFor(() => {
        expect(screen.getByText('Reading Saved!')).toBeInTheDocument();
      });
    });

    it('shows error message on save failure', async () => {
      mockOnSave.mockResolvedValue({ success: false, error: 'Network error' });

      render(
        <ManualEntryForm
          vitalType="bp"
          onSave={mockOnSave}
        />
      );

      fireEvent.change(screen.getByLabelText(/Systolic/), { target: { value: '120' } });
      fireEvent.change(screen.getByLabelText(/Diastolic/), { target: { value: '80' } });
      fireEvent.change(screen.getByLabelText(/Pulse/), { target: { value: '72' } });

      fireEvent.click(screen.getByRole('button', { name: /Save Reading/i }));

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('calls onCancel when cancel button is clicked', () => {
      render(
        <ManualEntryForm
          vitalType="bp"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('does not show cancel button when onCancel not provided', () => {
      render(
        <ManualEntryForm
          vitalType="bp"
          onSave={mockOnSave}
        />
      );

      expect(screen.queryByRole('button', { name: /Cancel/i })).not.toBeInTheDocument();
    });

    it('clears errors when user starts typing', async () => {
      render(
        <ManualEntryForm
          vitalType="bp"
          onSave={mockOnSave}
        />
      );

      // Trigger validation error
      fireEvent.click(screen.getByRole('button', { name: /Save Reading/i }));

      await waitFor(() => {
        expect(screen.getByText('Systolic is required')).toBeInTheDocument();
      });

      // Start typing - error should clear
      fireEvent.change(screen.getByLabelText(/Systolic/), { target: { value: '120' } });

      expect(screen.queryByText('Systolic is required')).not.toBeInTheDocument();
    });

    it('shows "Add Another Reading" button after success', async () => {
      mockOnSave.mockResolvedValue({ success: true });

      render(
        <ManualEntryForm
          vitalType="bp"
          onSave={mockOnSave}
        />
      );

      fireEvent.change(screen.getByLabelText(/Systolic/), { target: { value: '120' } });
      fireEvent.change(screen.getByLabelText(/Diastolic/), { target: { value: '80' } });
      fireEvent.change(screen.getByLabelText(/Pulse/), { target: { value: '72' } });

      fireEvent.click(screen.getByRole('button', { name: /Save Reading/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Another Reading/i })).toBeInTheDocument();
      });
    });

    it('resets form when "Add Another Reading" is clicked', async () => {
      mockOnSave.mockResolvedValue({ success: true });

      render(
        <ManualEntryForm
          vitalType="bp"
          onSave={mockOnSave}
        />
      );

      fireEvent.change(screen.getByLabelText(/Systolic/), { target: { value: '120' } });
      fireEvent.change(screen.getByLabelText(/Diastolic/), { target: { value: '80' } });
      fireEvent.change(screen.getByLabelText(/Pulse/), { target: { value: '72' } });

      fireEvent.click(screen.getByRole('button', { name: /Save Reading/i }));

      await waitFor(() => {
        expect(screen.getByText('Reading Saved!')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Add Another Reading/i }));

      expect(screen.getByText('Blood Pressure Reading')).toBeInTheDocument();
      expect(screen.getByLabelText(/Systolic/)).toHaveValue(null);
    });

    it('disables submit button while saving', async () => {
      let resolvePromise: ((value: { success: boolean }) => void) | undefined;
      mockOnSave.mockReturnValue(new Promise((resolve) => {
        resolvePromise = resolve;
      }));

      render(
        <ManualEntryForm
          vitalType="bp"
          onSave={mockOnSave}
        />
      );

      fireEvent.change(screen.getByLabelText(/Systolic/), { target: { value: '120' } });
      fireEvent.change(screen.getByLabelText(/Diastolic/), { target: { value: '80' } });
      fireEvent.change(screen.getByLabelText(/Pulse/), { target: { value: '72' } });

      fireEvent.click(screen.getByRole('button', { name: /Save Reading/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Saving/i })).toBeDisabled();
      });

      if (resolvePromise) {
        resolvePromise({ success: true });
      }
    });

    it('applies custom primary color to buttons', () => {
      render(
        <ManualEntryForm
          vitalType="bp"
          onSave={mockOnSave}
          primaryColor="#ff6600"
        />
      );

      const saveButton = screen.getByRole('button', { name: /Save Reading/i });
      expect(saveButton).toHaveStyle({ backgroundColor: '#ff6600' });
    });
  });
});
