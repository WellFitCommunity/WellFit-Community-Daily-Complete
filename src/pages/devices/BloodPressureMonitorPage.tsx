// src/pages/devices/BloodPressureMonitorPage.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '../../BrandingContext';
import { DeviceService, type BPReading } from '../../services/deviceService';
import VitalTrendChart, { type ChartDataPoint, type DataSeries, type ReferenceRange } from '../../components/devices/VitalTrendChart';
import CriticalValueAlert, { checkBPCriticalValues, type CriticalAlert } from '../../components/devices/CriticalValueAlert';
import ManualEntryForm from '../../components/devices/ManualEntryForm';
import { useBleCapture } from '../../hooks/useBleCapture';
import { auditLogger } from '../../services/auditLogger';
import type { BleVitalReading } from '../../types/ble';

type BPStatus = 'normal' | 'elevated' | 'high' | 'low';

const FRIENDLY_NAME_KEY = 'ble_friendly_name_blood_pressure';

const BloodPressureMonitorPage: React.FC = () => {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [isLoading, setIsLoading] = useState(true);
  const [readings, setReadings] = useState<BPReading[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [friendlyName, setFriendlyName] = useState<string | null>(null);

  // wearable_connections.id for this device (used as device_id on saved readings).
  const deviceIdRef = useRef<string | null>(null);

  const loadReadings = useCallback(async () => {
    const result = await DeviceService.getBPReadings(20);
    if (result.success && result.data) {
      setReadings(result.data);
    }
  }, []);

  // Persist a reading that arrived over Bluetooth.
  const handleBleReading = useCallback(
    async (reading: BleVitalReading) => {
      const systolic = reading.values.find((v) => v.type === 'systolic')?.value;
      const diastolic = reading.values.find((v) => v.type === 'diastolic')?.value;
      const pulse = reading.values.find((v) => v.type === 'pulse_rate')?.value ?? 0;

      if (systolic === undefined || diastolic === undefined) {
        setError('That reading came through incomplete. Please take it again.');
        return;
      }

      setSaving(true);
      try {
        const result = await DeviceService.saveBPReading({
          device_id: deviceIdRef.current ?? 'ble',
          systolic: Math.round(systolic),
          diastolic: Math.round(diastolic),
          pulse: Math.round(pulse),
          measured_at: reading.timestamp,
        });

        if (result.success) {
          setError(null);
          await loadReadings();
        } else {
          setError(result.error ?? 'We could not save that reading. Please try again.');
        }
      } catch (err: unknown) {
        await auditLogger.error(
          'BLE_BP_SAVE_FAILED',
          err instanceof Error ? err : new Error(String(err)),
          { deviceType: 'blood_pressure' }
        );
        setError('We could not save that reading. Please try again.');
      } finally {
        setSaving(false);
      }
    },
    [loadReadings]
  );

  const ble = useBleCapture({ deviceType: 'blood_pressure', onReading: handleBleReading });

  // Initial load: readings + remembered device name.
  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      try {
        await loadReadings();
      } finally {
        if (mounted) setIsLoading(false);
      }
      try {
        const saved = localStorage.getItem(FRIENDLY_NAME_KEY);
        if (mounted && saved) setFriendlyName(saved);
      } catch {
        // localStorage unavailable — no remembered name.
      }
    })();
    return () => {
      mounted = false;
    };
  }, [loadReadings]);

  // When BLE connects, register/refresh the device record and remember its name.
  useEffect(() => {
    if (ble.status !== 'connected' || !ble.deviceName) return;
    const name = ble.deviceName;
    setFriendlyName(name);
    try {
      localStorage.setItem(FRIENDLY_NAME_KEY, name);
    } catch {
      // best-effort
    }
    void (async () => {
      const conn = await DeviceService.connectDevice('bp_monitor', name);
      if (conn.success && conn.data) {
        deviceIdRef.current = conn.data.id;
      }
    })();
  }, [ble.status, ble.deviceName]);

  const getBPStatus = (systolic: number, diastolic: number): BPStatus => {
    if (systolic < 90 || diastolic < 60) return 'low';
    if (systolic < 120 && diastolic < 80) return 'normal';
    if (systolic < 130 && diastolic < 80) return 'elevated';
    return 'high';
  };

  const getStatusColor = (status: BPStatus) => {
    switch (status) {
      case 'normal':
        return 'bg-green-100 text-green-700';
      case 'elevated':
        return 'bg-yellow-100 text-yellow-700';
      case 'high':
        return 'bg-red-100 text-red-700';
      case 'low':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleDisconnect = async () => {
    await ble.disconnect();
    deviceIdRef.current = null;
  };

  const chartData: ChartDataPoint[] = useMemo(() => {
    return readings.map((reading) => ({
      date: formatDate(reading.measured_at),
      timestamp: new Date(reading.measured_at).getTime(),
      systolic: reading.systolic,
      diastolic: reading.diastolic,
      pulse: reading.pulse,
    }));
  }, [readings]);

  const bpSeries: DataSeries[] = [
    { key: 'systolic', label: 'Systolic', color: '#ef4444', unit: 'mmHg' },
    { key: 'diastolic', label: 'Diastolic', color: '#3b82f6', unit: 'mmHg' },
  ];

  const bpReferenceLines: ReferenceRange[] = [
    { label: 'Normal Systolic', value: 120, color: '#22c55e', strokeDasharray: '5 5' },
    { label: 'Normal Diastolic', value: 80, color: '#22c55e', strokeDasharray: '3 3' },
  ];

  const criticalAlerts: CriticalAlert[] = useMemo(() => {
    if (readings.length === 0) return [];
    const latestReading = readings[0];
    return checkBPCriticalValues(latestReading).filter((alert) => !dismissedAlerts.has(alert.id));
  }, [readings, dismissedAlerts]);

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlerts((prev) => new Set([...prev, alertId]));
  };

  const handleManualSave = async (data: Record<string, unknown>) => {
    const result = await DeviceService.saveBPReading({
      device_id: 'manual',
      systolic: data.systolic as number,
      diastolic: data.diastolic as number,
      pulse: data.pulse as number,
      measured_at: data.measured_at as string,
    });

    if (result.success) {
      await loadReadings();
    }

    return result;
  };

  const isConnected = ble.status === 'connected';
  const isPairing = ble.status === 'pairing';
  const connectLabel = `Connect ${friendlyName ?? 'Blood Pressure Cuff'}`;
  const displayError = error ?? ble.error;

  return (
    <div className="min-h-screen pb-20" style={{ background: branding.gradient }}>
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-3xl">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl sm:text-7xl mb-4">❤️</div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-3 drop-shadow-lg">
            Blood Pressure Monitor
          </h1>
          <p className="text-lg sm:text-xl text-white/90 max-w-xl mx-auto drop-shadow-sm">
            Track your blood pressure and pulse readings
          </p>
        </div>

        {/* Critical Value Alerts */}
        <CriticalValueAlert alerts={criticalAlerts} onDismiss={handleDismissAlert} />

        {displayError && (
          <div className="bg-red-100 border border-red-400 text-red-700 rounded-xl p-4 mb-6" role="alert">
            {displayError}
          </div>
        )}

        {/* Connection Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          {isLoading ? (
            <div className="text-lg font-semibold text-gray-700">Loading...</div>
          ) : !ble.isSupported ? (
            /* iPhone/iPad or non-Chrome — no Bluetooth available, manual entry only */
            <div className="bg-blue-50 rounded-xl p-4 text-blue-800">
              <h3 className="font-semibold mb-1 text-lg">Bluetooth isn’t available on this device</h3>
              <p className="text-base">
                {ble.capabilityMessage ?? 'This device can’t connect a Bluetooth cuff.'} You can still
                enter your reading by hand below — just type the numbers from your cuff.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-4 h-4 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-lg font-semibold text-gray-700">
                    {isConnected ? `Connected: ${ble.deviceName ?? friendlyName ?? 'your cuff'}` : 'Not Connected'}
                  </span>
                </div>
                <button
                  onClick={isConnected ? handleDisconnect : ble.pair}
                  disabled={isPairing}
                  aria-label={isConnected ? 'Disconnect cuff' : connectLabel}
                  className={`min-h-[44px] px-6 py-3 rounded-xl font-semibold text-lg transition-all duration-300 ${
                    isConnected ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'text-white hover:opacity-90'
                  }`}
                  style={!isConnected ? { backgroundColor: branding.primaryColor } : {}}
                >
                  {isPairing ? 'Connecting...' : isConnected ? 'Disconnect' : connectLabel}
                </button>
              </div>

              {isConnected ? (
                <div className="bg-green-50 rounded-xl p-4 text-green-800">
                  <p className="text-base font-medium">
                    {saving ? 'Saving your reading…' : 'Take a reading on your cuff now — it will appear below automatically.'}
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 rounded-xl p-4 text-blue-800">
                  <h3 className="font-semibold mb-2 text-lg">How to connect your cuff</h3>
                  <ol className="list-decimal list-inside space-y-1 text-base">
                    <li>Press the button on your cuff until it flashes.</li>
                    <li>Tap <span className="font-semibold">Connect</span> above.</li>
                    <li>Pick your cuff from the list that appears.</li>
                  </ol>
                  <p className="text-sm mt-3 text-blue-700">
                    Works with standard Bluetooth blood-pressure monitors on Android phones and computers using Chrome.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* BP Range Guide */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4" style={{ color: branding.primaryColor }}>
            Blood Pressure Guide
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 rounded-xl p-4">
              <div className="text-green-700 font-semibold">Normal</div>
              <div className="text-sm text-green-600">Less than 120/80</div>
            </div>
            <div className="bg-yellow-50 rounded-xl p-4">
              <div className="text-yellow-700 font-semibold">Elevated</div>
              <div className="text-sm text-yellow-600">120-129/Less than 80</div>
            </div>
            <div className="bg-orange-50 rounded-xl p-4">
              <div className="text-orange-700 font-semibold">High Stage 1</div>
              <div className="text-sm text-orange-600">130-139/80-89</div>
            </div>
            <div className="bg-red-50 rounded-xl p-4">
              <div className="text-red-700 font-semibold">High Stage 2</div>
              <div className="text-sm text-red-600">140+/90+</div>
            </div>
          </div>
        </div>

        {/* BP Trend Chart */}
        {readings.length > 0 && (
          <div className="mb-6">
            <VitalTrendChart
              data={chartData}
              series={bpSeries}
              title="Blood Pressure Trends"
              referenceLines={bpReferenceLines}
              yAxisDomain={[40, 200]}
              primaryColor={branding.primaryColor}
            />
          </div>
        )}

        {/* BP History */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold mb-6" style={{ color: branding.primaryColor }}>
            Recent Readings
          </h2>
          {readings.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No readings yet. Take a blood pressure measurement to record your first reading.
            </p>
          ) : (
            <div className="space-y-4">
              {readings.map((reading) => {
                const status = getBPStatus(reading.systolic, reading.diastolic);
                return (
                  <div key={reading.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <div className="text-sm text-gray-500">{formatDate(reading.measured_at)}</div>
                      <div className="text-2xl font-bold text-gray-800">
                        {reading.systolic}/{reading.diastolic}
                        <span className="text-lg font-normal text-gray-500 ml-2">mmHg</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500 mb-1">Pulse: {reading.pulse} bpm</div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status)}`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Manual Entry */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold" style={{ color: branding.primaryColor }}>
              Manual Entry
            </h2>
            {!showManualEntry && (
              <button
                onClick={() => setShowManualEntry(true)}
                className="min-h-[44px] px-4 py-2 rounded-lg font-medium text-white transition-all duration-300 hover:opacity-90"
                style={{ backgroundColor: branding.primaryColor }}
              >
                + Add Reading
              </button>
            )}
          </div>

          {showManualEntry ? (
            <ManualEntryForm
              vitalType="bp"
              onSave={handleManualSave}
              onCancel={() => setShowManualEntry(false)}
              primaryColor={branding.primaryColor}
            />
          ) : (
            <p className="text-gray-600">
              Don't have a smart BP monitor? Click "Add Reading" to manually enter your blood pressure.
            </p>
          )}
        </div>

        {/* Back Button */}
        <div className="text-center mt-8">
          <button
            onClick={() => navigate('/my-health')}
            aria-label="Go back to My Health"
            className="inline-flex items-center gap-3 px-8 py-4 bg-white text-gray-700 rounded-xl font-semibold text-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            <span className="text-2xl" aria-hidden="true">←</span>
            <span>Back to My Health</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BloodPressureMonitorPage;
