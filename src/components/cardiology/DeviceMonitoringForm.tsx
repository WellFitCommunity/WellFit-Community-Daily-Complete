/**
 * DeviceMonitoringForm - Record cardiac device interrogation
 *
 * Purpose: Data entry for pacemaker/ICD/CRT interrogation results
 *          including battery, pacing, leads, shocks, and alerts
 * Used by: CardiologyDashboard devices tab
 */

import React, { useState } from 'react';
import { CardiologyService } from '../../services/cardiology';
import { auditLogger } from '../../services/auditLogger';
import type { DeviceType, CardDeviceMonitoring } from '../../types/cardiology';

interface DeviceMonitoringFormProps {
  patientId: string;
  tenantId: string;
  registryId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

type BatteryStatus = CardDeviceMonitoring['battery_status'];

const DEVICE_TYPE_OPTIONS: { value: DeviceType; label: string }[] = [
  { value: 'pacemaker', label: 'Pacemaker' },
  { value: 'icd', label: 'ICD (Implantable Cardioverter-Defibrillator)' },
  { value: 'crt_d', label: 'CRT-D (Cardiac Resynchronization + Defibrillator)' },
  { value: 'crt_p', label: 'CRT-P (Cardiac Resynchronization + Pacemaker)' },
  { value: 'loop_recorder', label: 'Implantable Loop Recorder' },
  { value: 'event_monitor', label: 'Event Monitor' },
];

const BATTERY_STATUS_OPTIONS: { value: BatteryStatus; label: string }[] = [
  { value: 'good', label: 'Good (BOL/MOL)' },
  { value: 'elective_replacement', label: 'Elective Replacement Indicator (ERI)' },
  { value: 'end_of_life', label: 'End of Life (EOL)' },
];

const COMMON_MANUFACTURERS = ['Medtronic', 'Boston Scientific', 'Abbott/St. Jude', 'Biotronik', 'MicroPort'];

const DeviceMonitoringForm: React.FC<DeviceMonitoringFormProps> = ({
  patientId,
  tenantId,
  registryId,
  onSuccess,
  onCancel,
}) => {
  // Device Info
  const [deviceType, setDeviceType] = useState<DeviceType>('pacemaker');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [implantDate, setImplantDate] = useState('');
  const [checkedBy, setCheckedBy] = useState('');

  // Battery
  const [batteryStatus, setBatteryStatus] = useState<BatteryStatus>('good');
  const [batteryVoltage, setBatteryVoltage] = useState('');
  const [batteryLongevity, setBatteryLongevity] = useState('');

  // Pacing
  const [atrialPacing, setAtrialPacing] = useState('');
  const [ventricularPacing, setVentricularPacing] = useState('');

  // Leads
  const [leadImpedanceAtrial, setLeadImpedanceAtrial] = useState('');
  const [leadImpedanceVentricular, setLeadImpedanceVentricular] = useState('');
  const [sensingAtrial, setSensingAtrial] = useState('');
  const [sensingVentricular, setSensingVentricular] = useState('');
  const [thresholdAtrial, setThresholdAtrial] = useState('');
  const [thresholdVentricular, setThresholdVentricular] = useState('');

  // Events
  const [shocksDelivered, setShocksDelivered] = useState('0');
  const [atpEvents, setAtpEvents] = useState('0');
  const [arrhythmiaBurden, setArrhythmiaBurden] = useState('');

  // Alerts & Notes
  const [alertsText, setAlertsText] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSaving(true);
    setError(null);

    try {
      const alerts = alertsText
        .split('\n')
        .map(a => a.trim())
        .filter(a => a.length > 0);

      const result = await CardiologyService.createDeviceCheck({
        patient_id: patientId,
        tenant_id: tenantId,
        registry_id: registryId,
        device_type: deviceType,
        device_manufacturer: manufacturer || undefined,
        device_model: model || undefined,
        implant_date: implantDate || undefined,
        checked_by: checkedBy || undefined,
        battery_status: batteryStatus,
        battery_voltage: batteryVoltage ? parseFloat(batteryVoltage) : undefined,
        battery_longevity_months: batteryLongevity ? parseInt(batteryLongevity) : undefined,
        atrial_pacing_percent: atrialPacing ? parseFloat(atrialPacing) : undefined,
        ventricular_pacing_percent: ventricularPacing ? parseFloat(ventricularPacing) : undefined,
        lead_impedance_atrial_ohms: leadImpedanceAtrial ? parseInt(leadImpedanceAtrial) : undefined,
        lead_impedance_ventricular_ohms: leadImpedanceVentricular ? parseInt(leadImpedanceVentricular) : undefined,
        shocks_delivered: parseInt(shocksDelivered) || 0,
        anti_tachycardia_pacing_events: parseInt(atpEvents) || 0,
        atrial_arrhythmia_burden_percent: arrhythmiaBurden ? parseFloat(arrhythmiaBurden) : undefined,
        alerts: alerts.length > 0 ? alerts : undefined,
        notes: notes || undefined,
      });

      if (!result.success) {
        setError(result.error || 'Failed to save device check');
        return;
      }

      await auditLogger.info('CARD_DEVICE_CHECK_RECORDED', {
        patientId,
        deviceType,
        batteryStatus,
        shocksDelivered: parseInt(shocksDelivered) || 0,
      });
      setSuccess(true);
      setTimeout(onSuccess, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected error';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <p className="text-green-800 font-medium text-lg">Device interrogation recorded</p>
        {batteryStatus !== 'good' && (
          <p className="text-red-700 font-medium mt-2">
            Battery: {batteryStatus === 'end_of_life' ? 'END OF LIFE — Schedule replacement' : 'ERI — Plan replacement'}
          </p>
        )}
        {parseInt(shocksDelivered) > 0 && (
          <p className="text-red-700 font-medium mt-2">
            {shocksDelivered} shock(s) delivered — Review with electrophysiologist
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Device Interrogation</h3>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px]">
          Cancel
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Device Info */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">Device Information</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Device Type <span className="text-red-500">*</span></label>
            <select
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value as DeviceType)}
              className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
            >
              {DEVICE_TYPE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
            <select
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
            >
              <option value="">Select manufacturer...</option>
              {COMMON_MANUFACTURERS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. Micra AV"
              className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Implant Date</label>
            <input
              type="date"
              value={implantDate}
              onChange={(e) => setImplantDate(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Checked By</label>
            <input
              type="text"
              value={checkedBy}
              onChange={(e) => setCheckedBy(e.target.value)}
              placeholder="Technician/EP name"
              className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
            />
          </div>
        </div>
      </fieldset>

      {/* Battery */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">Battery Status</legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status <span className="text-red-500">*</span></label>
            <select
              value={batteryStatus}
              onChange={(e) => setBatteryStatus(e.target.value as BatteryStatus)}
              className={`w-full p-2 border rounded-lg min-h-[44px] ${
                batteryStatus === 'end_of_life' ? 'border-red-500 bg-red-50' :
                batteryStatus === 'elective_replacement' ? 'border-yellow-500 bg-yellow-50' :
                'border-gray-300'
              }`}
            >
              {BATTERY_STATUS_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Voltage (V)</label>
            <input
              type="number"
              min={0}
              max={5}
              step={0.01}
              value={batteryVoltage}
              onChange={(e) => setBatteryVoltage(e.target.value)}
              placeholder="e.g. 2.85"
              className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Est. Longevity (months)</label>
            <input
              type="number"
              min={0}
              max={240}
              value={batteryLongevity}
              onChange={(e) => setBatteryLongevity(e.target.value)}
              placeholder="e.g. 48"
              className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
            />
          </div>
        </div>
      </fieldset>

      {/* Pacing Percentages */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Atrial Pacing (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={atrialPacing}
            onChange={(e) => setAtrialPacing(e.target.value)}
            placeholder="e.g. 45"
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ventricular Pacing (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={ventricularPacing}
            onChange={(e) => setVentricularPacing(e.target.value)}
            placeholder="e.g. 2"
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          />
        </div>
      </div>

      {/* Lead Parameters */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">Lead Parameters</legend>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Atrial Impedance (Ω)</label>
            <input
              type="number"
              min={200}
              max={2000}
              value={leadImpedanceAtrial}
              onChange={(e) => setLeadImpedanceAtrial(e.target.value)}
              placeholder="300-1000"
              className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Ventricular Impedance (Ω)</label>
            <input
              type="number"
              min={200}
              max={2000}
              value={leadImpedanceVentricular}
              onChange={(e) => setLeadImpedanceVentricular(e.target.value)}
              placeholder="300-1000"
              className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Atrial Sensing (mV)</label>
            <input
              type="number"
              min={0}
              max={20}
              step={0.1}
              value={sensingAtrial}
              onChange={(e) => setSensingAtrial(e.target.value)}
              placeholder="e.g. 2.5"
              className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Ventricular Sensing (mV)</label>
            <input
              type="number"
              min={0}
              max={30}
              step={0.1}
              value={sensingVentricular}
              onChange={(e) => setSensingVentricular(e.target.value)}
              placeholder="e.g. 8.0"
              className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Atrial Threshold (V)</label>
            <input
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={thresholdAtrial}
              onChange={(e) => setThresholdAtrial(e.target.value)}
              placeholder="e.g. 0.5"
              className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Ventricular Threshold (V)</label>
            <input
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={thresholdVentricular}
              onChange={(e) => setThresholdVentricular(e.target.value)}
              placeholder="e.g. 0.75"
              className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
            />
          </div>
        </div>
      </fieldset>

      {/* Events */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Shocks Delivered</label>
          <input
            type="number"
            min={0}
            max={100}
            value={shocksDelivered}
            onChange={(e) => setShocksDelivered(e.target.value)}
            className={`w-full p-2 border rounded-lg min-h-[44px] ${
              parseInt(shocksDelivered) > 0 ? 'border-red-500 bg-red-50' : 'border-gray-300'
            }`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ATP Events</label>
          <input
            type="number"
            min={0}
            max={500}
            value={atpEvents}
            onChange={(e) => setAtpEvents(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">AF Burden (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={arrhythmiaBurden}
            onChange={(e) => setArrhythmiaBurden(e.target.value)}
            placeholder="e.g. 12.5"
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          />
        </div>
      </div>

      {/* Alerts & Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Device Alerts (one per line)</label>
        <textarea
          value={alertsText}
          onChange={(e) => setAlertsText(e.target.value)}
          rows={2}
          className="w-full p-2 border border-gray-300 rounded-lg"
          placeholder="High ventricular rate episode&#10;Lead impedance out of range&#10;..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full p-2 border border-gray-300 rounded-lg"
          placeholder="Additional interrogation notes..."
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 min-h-[44px]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium min-h-[44px] disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Device Check'}
        </button>
      </div>
    </form>
  );
};

export default DeviceMonitoringForm;
