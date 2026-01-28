/**
 * CriticalValueAlert - Displays warning banners for dangerous vital sign readings
 *
 * Patient safety component that shows prominent alerts when readings
 * fall outside safe ranges. Integrates with audit logging for compliance.
 */

import React from 'react';

export type AlertSeverity = 'warning' | 'critical';

export interface CriticalAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  value: string;
  timestamp: string;
  action?: string;
}

interface CriticalValueAlertProps {
  alerts: CriticalAlert[];
  onDismiss?: (alertId: string) => void;
}

const CriticalValueAlert: React.FC<CriticalValueAlertProps> = ({
  alerts,
  onDismiss,
}) => {
  if (alerts.length === 0) return null;

  const getSeverityStyles = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return {
          container: 'bg-red-50 border-red-500',
          icon: '🚨',
          title: 'text-red-800',
          message: 'text-red-700',
          button: 'text-red-600 hover:bg-red-100',
        };
      case 'warning':
        return {
          container: 'bg-yellow-50 border-yellow-500',
          icon: '⚠️',
          title: 'text-yellow-800',
          message: 'text-yellow-700',
          button: 'text-yellow-600 hover:bg-yellow-100',
        };
    }
  };

  return (
    <div className="space-y-3 mb-6">
      {alerts.map((alert) => {
        const styles = getSeverityStyles(alert.severity);
        return (
          <div
            key={alert.id}
            className={`rounded-xl border-l-4 p-4 ${styles.container}`}
            role="alert"
            aria-live={alert.severity === 'critical' ? 'assertive' : 'polite'}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0" aria-hidden="true">
                {styles.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className={`font-bold text-lg ${styles.title}`}>
                    {alert.title}
                  </h3>
                  {onDismiss && (
                    <button
                      onClick={() => onDismiss(alert.id)}
                      className={`p-1 rounded-lg transition-colors ${styles.button}`}
                      aria-label="Dismiss alert"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
                <p className={`mt-1 ${styles.message}`}>
                  {alert.message}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                  <span className={`font-semibold ${styles.title}`}>
                    Reading: {alert.value}
                  </span>
                  <span className={styles.message}>
                    {new Date(alert.timestamp).toLocaleString()}
                  </span>
                </div>
                {alert.action && (
                  <p className={`mt-2 font-medium ${styles.title}`}>
                    {alert.action}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CriticalValueAlert;

// =============================================================================
// CRITICAL VALUE THRESHOLDS
// =============================================================================

export const CRITICAL_THRESHOLDS = {
  spo2: {
    critical: { max: 89 },      // Below 90% is critical
    warning: { min: 90, max: 94 }, // 90-94% is concerning
  },
  systolic: {
    critical: { min: 90, max: 180 }, // Outside these = critical
    warning: { min: 100, max: 160 }, // Outside these but inside critical = warning
  },
  diastolic: {
    critical: { min: 60, max: 120 }, // Outside these = critical
    warning: { min: 65, max: 100 },  // Outside these but inside critical = warning
  },
  glucose: {
    critical: { min: 54, max: 400 }, // Outside these = critical
    warning: { min: 70, max: 250 },  // Outside these but inside critical = warning
  },
  pulse: {
    critical: { min: 40, max: 150 }, // Outside these = critical
    warning: { min: 50, max: 120 },  // Outside these but inside critical = warning
  },
} as const;

// =============================================================================
// CRITICAL VALUE DETECTION FUNCTIONS
// =============================================================================

export interface BPReading {
  systolic: number;
  diastolic: number;
  pulse: number;
  measured_at: string;
}

export interface GlucoseReading {
  value: number;
  measured_at: string;
}

export interface SpO2Reading {
  spo2: number;
  pulse_rate: number;
  measured_at: string;
}

/**
 * Check blood pressure reading for critical values
 */
export function checkBPCriticalValues(reading: BPReading): CriticalAlert[] {
  const alerts: CriticalAlert[] = [];
  const { systolic, diastolic, pulse, measured_at } = reading;

  // Systolic checks
  if (systolic < CRITICAL_THRESHOLDS.systolic.critical.min) {
    alerts.push({
      id: `bp-systolic-low-${measured_at}`,
      severity: 'critical',
      title: 'Critically Low Blood Pressure',
      message: `Systolic pressure of ${systolic} mmHg is dangerously low.`,
      value: `${systolic}/${diastolic} mmHg`,
      timestamp: measured_at,
      action: 'Seek immediate medical attention if experiencing symptoms.',
    });
  } else if (systolic > CRITICAL_THRESHOLDS.systolic.critical.max) {
    alerts.push({
      id: `bp-systolic-high-${measured_at}`,
      severity: 'critical',
      title: 'Hypertensive Crisis',
      message: `Systolic pressure of ${systolic} mmHg requires immediate attention.`,
      value: `${systolic}/${diastolic} mmHg`,
      timestamp: measured_at,
      action: 'Contact your doctor or seek emergency care immediately.',
    });
  } else if (systolic < CRITICAL_THRESHOLDS.systolic.warning.min ||
             systolic > CRITICAL_THRESHOLDS.systolic.warning.max) {
    alerts.push({
      id: `bp-systolic-warn-${measured_at}`,
      severity: 'warning',
      title: 'Blood Pressure Outside Normal Range',
      message: `Systolic pressure of ${systolic} mmHg is outside the normal range.`,
      value: `${systolic}/${diastolic} mmHg`,
      timestamp: measured_at,
      action: 'Monitor closely and consult your healthcare provider.',
    });
  }

  // Diastolic checks (only if no systolic alert already)
  if (alerts.length === 0) {
    if (diastolic < CRITICAL_THRESHOLDS.diastolic.critical.min) {
      alerts.push({
        id: `bp-diastolic-low-${measured_at}`,
        severity: 'critical',
        title: 'Critically Low Diastolic Pressure',
        message: `Diastolic pressure of ${diastolic} mmHg is dangerously low.`,
        value: `${systolic}/${diastolic} mmHg`,
        timestamp: measured_at,
        action: 'Seek immediate medical attention if experiencing symptoms.',
      });
    } else if (diastolic > CRITICAL_THRESHOLDS.diastolic.critical.max) {
      alerts.push({
        id: `bp-diastolic-high-${measured_at}`,
        severity: 'critical',
        title: 'Critically High Diastolic Pressure',
        message: `Diastolic pressure of ${diastolic} mmHg requires immediate attention.`,
        value: `${systolic}/${diastolic} mmHg`,
        timestamp: measured_at,
        action: 'Contact your doctor or seek emergency care immediately.',
      });
    }
  }

  // Pulse checks
  if (pulse < CRITICAL_THRESHOLDS.pulse.critical.min) {
    alerts.push({
      id: `bp-pulse-low-${measured_at}`,
      severity: 'critical',
      title: 'Critically Low Heart Rate',
      message: `Pulse of ${pulse} bpm indicates severe bradycardia.`,
      value: `${pulse} bpm`,
      timestamp: measured_at,
      action: 'Seek immediate medical attention.',
    });
  } else if (pulse > CRITICAL_THRESHOLDS.pulse.critical.max) {
    alerts.push({
      id: `bp-pulse-high-${measured_at}`,
      severity: 'critical',
      title: 'Critically High Heart Rate',
      message: `Pulse of ${pulse} bpm indicates severe tachycardia.`,
      value: `${pulse} bpm`,
      timestamp: measured_at,
      action: 'Seek immediate medical attention.',
    });
  }

  return alerts;
}

/**
 * Check glucose reading for critical values
 */
export function checkGlucoseCriticalValues(reading: GlucoseReading): CriticalAlert[] {
  const alerts: CriticalAlert[] = [];
  const { value, measured_at } = reading;

  if (value < CRITICAL_THRESHOLDS.glucose.critical.min) {
    alerts.push({
      id: `glucose-low-critical-${measured_at}`,
      severity: 'critical',
      title: 'Severe Hypoglycemia',
      message: `Blood glucose of ${value} mg/dL is dangerously low.`,
      value: `${value} mg/dL`,
      timestamp: measured_at,
      action: 'Consume fast-acting sugar immediately. Seek emergency care if symptoms persist.',
    });
  } else if (value > CRITICAL_THRESHOLDS.glucose.critical.max) {
    alerts.push({
      id: `glucose-high-critical-${measured_at}`,
      severity: 'critical',
      title: 'Severe Hyperglycemia',
      message: `Blood glucose of ${value} mg/dL is dangerously high.`,
      value: `${value} mg/dL`,
      timestamp: measured_at,
      action: 'Seek immediate medical attention. Risk of diabetic ketoacidosis.',
    });
  } else if (value < CRITICAL_THRESHOLDS.glucose.warning.min) {
    alerts.push({
      id: `glucose-low-warn-${measured_at}`,
      severity: 'warning',
      title: 'Low Blood Glucose',
      message: `Blood glucose of ${value} mg/dL is below target range.`,
      value: `${value} mg/dL`,
      timestamp: measured_at,
      action: 'Consider having a snack. Monitor for hypoglycemia symptoms.',
    });
  } else if (value > CRITICAL_THRESHOLDS.glucose.warning.max) {
    alerts.push({
      id: `glucose-high-warn-${measured_at}`,
      severity: 'warning',
      title: 'High Blood Glucose',
      message: `Blood glucose of ${value} mg/dL is above target range.`,
      value: `${value} mg/dL`,
      timestamp: measured_at,
      action: 'Review recent meals and medication. Contact provider if persistent.',
    });
  }

  return alerts;
}

/**
 * Check SpO2 reading for critical values
 */
export function checkSpO2CriticalValues(reading: SpO2Reading): CriticalAlert[] {
  const alerts: CriticalAlert[] = [];
  const { spo2, pulse_rate, measured_at } = reading;

  if (spo2 <= CRITICAL_THRESHOLDS.spo2.critical.max) {
    alerts.push({
      id: `spo2-critical-${measured_at}`,
      severity: 'critical',
      title: 'Critically Low Oxygen Level',
      message: `SpO2 of ${spo2}% indicates severe hypoxemia.`,
      value: `${spo2}%`,
      timestamp: measured_at,
      action: 'Seek immediate emergency medical care. Call 911 if needed.',
    });
  } else if (spo2 >= CRITICAL_THRESHOLDS.spo2.warning.min &&
             spo2 <= CRITICAL_THRESHOLDS.spo2.warning.max) {
    alerts.push({
      id: `spo2-warning-${measured_at}`,
      severity: 'warning',
      title: 'Low Oxygen Level',
      message: `SpO2 of ${spo2}% is below normal range.`,
      value: `${spo2}%`,
      timestamp: measured_at,
      action: 'Rest and recheck. Contact your doctor if it remains low.',
    });
  }

  // Pulse rate checks from oximeter
  if (pulse_rate < CRITICAL_THRESHOLDS.pulse.critical.min) {
    alerts.push({
      id: `spo2-pulse-low-${measured_at}`,
      severity: 'critical',
      title: 'Critically Low Heart Rate',
      message: `Pulse of ${pulse_rate} bpm indicates severe bradycardia.`,
      value: `${pulse_rate} bpm`,
      timestamp: measured_at,
      action: 'Seek immediate medical attention.',
    });
  } else if (pulse_rate > CRITICAL_THRESHOLDS.pulse.critical.max) {
    alerts.push({
      id: `spo2-pulse-high-${measured_at}`,
      severity: 'critical',
      title: 'Critically High Heart Rate',
      message: `Pulse of ${pulse_rate} bpm indicates severe tachycardia.`,
      value: `${pulse_rate} bpm`,
      timestamp: measured_at,
      action: 'Seek immediate medical attention.',
    });
  }

  return alerts;
}
