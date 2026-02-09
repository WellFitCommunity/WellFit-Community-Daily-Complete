/**
 * CardiologyAlerts - Renders cardiac clinical alerts by severity
 */

import React from 'react';
import type { CardiacAlert, CardiacAlertSeverity } from '../../types/cardiology';

interface CardiologyAlertsProps {
  alerts: CardiacAlert[];
}

const SEVERITY_STYLES: Record<CardiacAlertSeverity, { bg: string; text: string; border: string; icon: string }> = {
  critical: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200', icon: '🚨' },
  high: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200', icon: '⚠️' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200', icon: '📋' },
  low: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', icon: 'ℹ️' },
};

const CardiologyAlerts: React.FC<CardiologyAlertsProps> = ({ alerts }) => {
  if (alerts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-base">No active alerts</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const style = SEVERITY_STYLES[alert.severity];
        return (
          <div
            key={alert.id}
            className={`${style.bg} ${style.border} border rounded-lg p-4 flex items-start gap-3`}
            role="alert"
          >
            <span className="text-xl flex-shrink-0" aria-hidden="true">{style.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold uppercase ${style.text}`}>
                  {alert.severity}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(alert.timestamp).toLocaleString()}
                </span>
              </div>
              <p className={`text-sm font-medium mt-1 ${style.text}`}>
                {alert.message}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CardiologyAlerts;
