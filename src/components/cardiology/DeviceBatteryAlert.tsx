/**
 * DeviceBatteryAlert - Battery status warning banner
 *
 * Purpose: Visual alert when cardiac device battery is low (ERI or EOL)
 * Used by: CardiologyDashboard devices tab and overview
 */

import React from 'react';
import type { CardDeviceMonitoring } from '../../types/cardiology';

interface DeviceBatteryAlertProps {
  device: CardDeviceMonitoring;
}

const DeviceBatteryAlert: React.FC<DeviceBatteryAlertProps> = ({ device }) => {
  if (device.battery_status === 'good') return null;

  const isEol = device.battery_status === 'end_of_life';
  const deviceLabel = device.device_type.replace(/_/g, ' ').toUpperCase();

  return (
    <div
      className={`rounded-lg p-4 border ${
        isEol ? 'bg-red-50 border-red-300' : 'bg-yellow-50 border-yellow-300'
      }`}
      role="alert"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden="true">{isEol ? '🔴' : '🟡'}</span>
        <div>
          <p className={`font-semibold ${isEol ? 'text-red-800' : 'text-yellow-800'}`}>
            {isEol ? 'Device Battery End of Life' : 'Device Battery — Elective Replacement'}
          </p>
          <p className={`text-sm mt-1 ${isEol ? 'text-red-700' : 'text-yellow-700'}`}>
            {deviceLabel}
            {device.device_manufacturer && ` — ${device.device_manufacturer}`}
            {device.device_model && ` ${device.device_model}`}
          </p>
          <p className={`text-sm ${isEol ? 'text-red-600' : 'text-yellow-600'}`}>
            {isEol
              ? 'Schedule device replacement urgently'
              : 'Plan device replacement within the next few months'}
            {device.battery_longevity_months !== null && device.battery_longevity_months > 0 && (
              <span> — Est. {device.battery_longevity_months} months remaining</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DeviceBatteryAlert;
