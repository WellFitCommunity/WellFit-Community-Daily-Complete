/**
 * DeviceListView — renders the patient's existing implanted devices joined
 * with their latest active DeviceUseStatement (implant date, body site).
 *
 * Read-only display. The Add flow lives in AddDeviceForm.
 */

import React from 'react';
import type { Device, DeviceUseStatement } from '../../../../types/fhir';

export interface DeviceRow {
  device: Device;
  /**
   * The latest DeviceUseStatement for this device, or undefined if none
   * exists yet (rare — only happens on partial submits).
   */
  latest_statement: DeviceUseStatement | undefined;
}

export interface DeviceListViewProps {
  rows: DeviceRow[];
  loading: boolean;
  error: string | null;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export const DeviceListView: React.FC<DeviceListViewProps> = ({ rows, loading, error }) => {
  if (loading) {
    return (
      <p role="status" className="text-gray-600">
        Loading devices…
      </p>
    );
  }

  if (error) {
    return (
      <div role="alert" className="p-4 rounded-lg border bg-yellow-50 border-yellow-300 text-yellow-900">
        <p className="font-medium">Could not load devices</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="p-6 rounded-lg border border-dashed border-gray-300 text-center text-gray-600">
        <p>No implanted devices on file for this patient.</p>
        <p className="text-sm mt-1">Use the “Add device” button above to record one.</p>
      </div>
    );
  }

  return (
    <ul aria-label="Implanted devices" className="space-y-3">
      {rows.map(({ device, latest_statement }) => (
        <li
          key={device.id}
          className="p-4 rounded-lg border border-gray-200 bg-white"
        >
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {device.device_type_display}
              </h3>
              {device.manufacturer && (
                <p className="text-sm text-gray-600">
                  {device.manufacturer}
                  {device.model_number ? ` · ${device.model_number}` : ''}
                </p>
              )}
            </div>
            <span
              className={`text-xs uppercase px-2 py-1 rounded-full ${
                device.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {device.status}
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {device.serial_number && (
              <div>
                <dt className="inline text-gray-500">Serial: </dt>
                <dd className="inline text-gray-800">{device.serial_number}</dd>
              </div>
            )}
            {device.lot_number && (
              <div>
                <dt className="inline text-gray-500">Lot: </dt>
                <dd className="inline text-gray-800">{device.lot_number}</dd>
              </div>
            )}
            {device.udi_device_identifier && (
              <div>
                <dt className="inline text-gray-500">UDI DI: </dt>
                <dd className="inline text-gray-800 font-mono">{device.udi_device_identifier}</dd>
              </div>
            )}
            {device.expiration_date && (
              <div>
                <dt className="inline text-gray-500">Expires: </dt>
                <dd className="inline text-gray-800">{formatDate(device.expiration_date)}</dd>
              </div>
            )}
            {latest_statement?.timing_datetime && (
              <div>
                <dt className="inline text-gray-500">Implanted: </dt>
                <dd className="inline text-gray-800">{formatDate(latest_statement.timing_datetime)}</dd>
              </div>
            )}
            {latest_statement?.body_site_display && (
              <div>
                <dt className="inline text-gray-500">Site: </dt>
                <dd className="inline text-gray-800">{latest_statement.body_site_display}</dd>
              </div>
            )}
          </dl>

          {device.udi_carrier_hrf && (
            <p className="mt-2 text-xs font-mono text-gray-500 break-all">
              UDI: {device.udi_carrier_hrf}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
};

export default DeviceListView;
