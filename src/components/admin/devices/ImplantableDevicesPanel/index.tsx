/**
 * ImplantableDevicesPanel — ONC 170.315(a)(14) orchestrator.
 *
 * Loads the patient's Devices + DeviceUseStatements, joins them, and
 * renders the list view above a collapsible AddDeviceForm. After a
 * successful add, the list refreshes and the form collapses.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { DeviceService } from '../../../../services/fhir/DeviceService';
import { DeviceUseStatementService } from '../../../../services/fhir/DeviceUseStatementService';
import type { Device, DeviceUseStatement } from '../../../../types/fhir';
import AddDeviceForm from './AddDeviceForm';
import DeviceListView, { type DeviceRow } from './DeviceListView';
import type { ImplantableDevicesPanelProps } from './types';

function joinDevicesWithStatements(
  devices: Device[],
  statements: DeviceUseStatement[]
): DeviceRow[] {
  // Latest statement per device by recorded_on desc
  const byDevice = new Map<string, DeviceUseStatement>();
  for (const s of statements) {
    const existing = byDevice.get(s.device_id);
    if (!existing || (s.recorded_on > (existing.recorded_on ?? ''))) {
      byDevice.set(s.device_id, s);
    }
  }
  return devices.map((d) => ({
    device: d,
    latest_statement: d.id ? byDevice.get(d.id) : undefined,
  }));
}

export const ImplantableDevicesPanel: React.FC<ImplantableDevicesPanelProps> = ({ patientId }) => {
  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [devicesResult, statementsResult] = await Promise.all([
      DeviceService.getByPatient(patientId),
      DeviceUseStatementService.getByPatient(patientId),
    ]);

    if (!devicesResult.success) {
      setError(devicesResult.error ?? 'Failed to load devices');
      setRows([]);
      setLoading(false);
      return;
    }
    // Statements failing is non-fatal — still show devices, just without join data
    const devices = devicesResult.data ?? [];
    const statements = statementsResult.success ? (statementsResult.data ?? []) : [];

    setRows(joinDevicesWithStatements(devices, statements));
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSubmitted = useCallback(() => {
    setAdding(false);
    void refresh();
  }, [refresh]);

  return (
    <section aria-labelledby="implantable-devices-heading" className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 id="implantable-devices-heading" className="text-2xl font-semibold text-gray-900">
            Implanted Devices
          </h1>
          <p className="text-sm text-gray-600">
            ONC 170.315(a)(14) — FHIR Device + DeviceUseStatement records.
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="min-h-[44px] px-5 text-base font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500"
          >
            Add device
          </button>
        )}
      </header>

      {adding && (
        <div className="p-4 sm:p-6 rounded-lg border border-gray-200 bg-gray-50">
          <AddDeviceForm
            patientId={patientId}
            onSubmitted={handleSubmitted}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      <DeviceListView rows={rows} loading={loading} error={error} />
    </section>
  );
};

export default ImplantableDevicesPanel;
