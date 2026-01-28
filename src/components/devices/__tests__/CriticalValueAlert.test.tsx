import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CriticalValueAlert, {
  checkBPCriticalValues,
  checkGlucoseCriticalValues,
  checkSpO2CriticalValues,
  type CriticalAlert,
} from '../CriticalValueAlert';

describe('CriticalValueAlert Component', () => {
  const mockAlerts: CriticalAlert[] = [
    {
      id: 'test-1',
      severity: 'critical',
      title: 'Test Critical Alert',
      message: 'This is a critical alert message',
      value: '85%',
      timestamp: '2026-01-28T08:00:00Z',
      action: 'Seek immediate care',
    },
    {
      id: 'test-2',
      severity: 'warning',
      title: 'Test Warning Alert',
      message: 'This is a warning alert message',
      value: '92%',
      timestamp: '2026-01-28T08:00:00Z',
    },
  ];

  describe('Rendering', () => {
    it('renders nothing when no alerts', () => {
      const { container } = render(<CriticalValueAlert alerts={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders critical alerts with red styling', () => {
      render(<CriticalValueAlert alerts={[mockAlerts[0]]} />);

      expect(screen.getByText('Test Critical Alert')).toBeInTheDocument();
      expect(screen.getByText('This is a critical alert message')).toBeInTheDocument();
      expect(screen.getByText(/Reading: 85%/)).toBeInTheDocument();
      expect(screen.getByText('Seek immediate care')).toBeInTheDocument();
    });

    it('renders warning alerts with yellow styling', () => {
      render(<CriticalValueAlert alerts={[mockAlerts[1]]} />);

      expect(screen.getByText('Test Warning Alert')).toBeInTheDocument();
      expect(screen.getByText('This is a warning alert message')).toBeInTheDocument();
    });

    it('renders multiple alerts', () => {
      render(<CriticalValueAlert alerts={mockAlerts} />);

      expect(screen.getByText('Test Critical Alert')).toBeInTheDocument();
      expect(screen.getByText('Test Warning Alert')).toBeInTheDocument();
    });

    it('has proper aria attributes for accessibility', () => {
      render(<CriticalValueAlert alerts={[mockAlerts[0]]} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });
  });

  describe('Dismiss Functionality', () => {
    it('calls onDismiss with alert id when dismiss button clicked', () => {
      const mockDismiss = vi.fn();
      render(<CriticalValueAlert alerts={[mockAlerts[0]]} onDismiss={mockDismiss} />);

      const dismissButton = screen.getByLabelText('Dismiss alert');
      fireEvent.click(dismissButton);

      expect(mockDismiss).toHaveBeenCalledWith('test-1');
    });

    it('does not show dismiss button when onDismiss not provided', () => {
      render(<CriticalValueAlert alerts={[mockAlerts[0]]} />);

      expect(screen.queryByLabelText('Dismiss alert')).not.toBeInTheDocument();
    });
  });
});

describe('Blood Pressure Critical Value Detection', () => {
  const baseReading = {
    systolic: 120,
    diastolic: 80,
    pulse: 72,
    measured_at: '2026-01-28T08:00:00Z',
  };

  it('returns no alerts for normal reading', () => {
    const alerts = checkBPCriticalValues(baseReading);
    expect(alerts).toHaveLength(0);
  });

  it('detects critically low systolic', () => {
    const alerts = checkBPCriticalValues({ ...baseReading, systolic: 85 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].title).toContain('Low Blood Pressure');
  });

  it('detects hypertensive crisis (high systolic)', () => {
    const alerts = checkBPCriticalValues({ ...baseReading, systolic: 185 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].title).toContain('Hypertensive Crisis');
  });

  it('detects elevated systolic as warning', () => {
    const alerts = checkBPCriticalValues({ ...baseReading, systolic: 165 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('warning');
  });

  it('detects critically high diastolic', () => {
    const alerts = checkBPCriticalValues({ ...baseReading, diastolic: 125 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].title).toContain('Diastolic');
  });

  it('detects critically low pulse (bradycardia)', () => {
    const alerts = checkBPCriticalValues({ ...baseReading, pulse: 35 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].title).toContain('Low Heart Rate');
  });

  it('detects critically high pulse (tachycardia)', () => {
    const alerts = checkBPCriticalValues({ ...baseReading, pulse: 160 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].title).toContain('High Heart Rate');
  });
});

describe('Glucose Critical Value Detection', () => {
  const baseReading = {
    value: 100,
    measured_at: '2026-01-28T08:00:00Z',
  };

  it('returns no alerts for normal reading', () => {
    const alerts = checkGlucoseCriticalValues(baseReading);
    expect(alerts).toHaveLength(0);
  });

  it('detects severe hypoglycemia', () => {
    const alerts = checkGlucoseCriticalValues({ ...baseReading, value: 50 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].title).toContain('Hypoglycemia');
  });

  it('detects severe hyperglycemia', () => {
    const alerts = checkGlucoseCriticalValues({ ...baseReading, value: 450 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].title).toContain('Hyperglycemia');
  });

  it('detects low glucose as warning', () => {
    const alerts = checkGlucoseCriticalValues({ ...baseReading, value: 65 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('warning');
    expect(alerts[0].title).toContain('Low Blood Glucose');
  });

  it('detects high glucose as warning', () => {
    const alerts = checkGlucoseCriticalValues({ ...baseReading, value: 280 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('warning');
    expect(alerts[0].title).toContain('High Blood Glucose');
  });
});

describe('SpO2 Critical Value Detection', () => {
  const baseReading = {
    spo2: 98,
    pulse_rate: 72,
    measured_at: '2026-01-28T08:00:00Z',
  };

  it('returns no alerts for normal reading', () => {
    const alerts = checkSpO2CriticalValues(baseReading);
    expect(alerts).toHaveLength(0);
  });

  it('detects critically low SpO2', () => {
    const alerts = checkSpO2CriticalValues({ ...baseReading, spo2: 88 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].title).toContain('Critically Low Oxygen');
  });

  it('detects low SpO2 as warning', () => {
    const alerts = checkSpO2CriticalValues({ ...baseReading, spo2: 92 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('warning');
    expect(alerts[0].title).toContain('Low Oxygen');
  });

  it('detects critically low pulse from oximeter', () => {
    const alerts = checkSpO2CriticalValues({ ...baseReading, pulse_rate: 35 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].title).toContain('Low Heart Rate');
  });

  it('detects critically high pulse from oximeter', () => {
    const alerts = checkSpO2CriticalValues({ ...baseReading, pulse_rate: 160 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].title).toContain('High Heart Rate');
  });

  it('returns multiple alerts for combined critical values', () => {
    const alerts = checkSpO2CriticalValues({ ...baseReading, spo2: 85, pulse_rate: 160 });
    expect(alerts).toHaveLength(2);
  });
});
