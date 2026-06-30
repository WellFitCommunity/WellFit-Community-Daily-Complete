// src/pages/devices/PulseOximeterPage.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '../../BrandingContext';
import { DeviceService, type SpO2Reading } from '../../services/deviceService';
import VitalTrendChart, { type ChartDataPoint, type DataSeries, type ReferenceRange } from '../../components/devices/VitalTrendChart';
import CriticalValueAlert, { checkSpO2CriticalValues, type CriticalAlert } from '../../components/devices/CriticalValueAlert';
import ManualEntryForm from '../../components/devices/ManualEntryForm';
import { useBleCapture } from '../../hooks/useBleCapture';
import { auditLogger } from '../../services/auditLogger';
import type { BleVitalReading } from '../../types/ble';

type SpO2Status = 'normal' | 'low' | 'critical';

const FRIENDLY_NAME_KEY = 'ble_friendly_name_pulse_oximeter';

const PulseOximeterPage: React.FC = () => {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [isLoading, setIsLoading] = useState(true);
  const [readings, setReadings] = useState<SpO2Reading[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [friendlyName, setFriendlyName] = useState<string | null>(null);

  const deviceIdRef = useRef<string | null>(null);

  const loadReadings = useCallback(async () => {
    const result = await DeviceService.getSpO2Readings(20);
    if (result.success && result.data) {
      setReadings(result.data);
    }
  }, []);

  const handleBleReading = useCallback(
    async (reading: BleVitalReading) => {
      const spo2 = reading.values.find((v) => v.type === 'spo2')?.value;
      const pulseRate = reading.values.find((v) => v.type === 'pulse_rate')?.value ?? 0;
      if (spo2 === undefined) {
        setError('That reading came through incomplete. Please take it again.');
        return;
      }
      setSaving(true);
      try {
        const result = await DeviceService.saveSpO2Reading({
          device_id: deviceIdRef.current ?? 'ble',
          spo2: Math.round(spo2),
          pulse_rate: Math.round(pulseRate),
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
          'BLE_SPO2_SAVE_FAILED',
          err instanceof Error ? err : new Error(String(err)),
          { deviceType: 'pulse_oximeter' }
        );
        setError('We could not save that reading. Please try again.');
      } finally {
        setSaving(false);
      }
    },
    [loadReadings]
  );

  const ble = useBleCapture({ deviceType: 'pulse_oximeter', onReading: handleBleReading });

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
        // localStorage unavailable
      }
    })();
    return () => {
      mounted = false;
    };
  }, [loadReadings]);

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
      const conn = await DeviceService.connectDevice('pulse_oximeter', name);
      if (conn.success && conn.data) {
        deviceIdRef.current = conn.data.id;
      }
    })();
  }, [ble.status, ble.deviceName]);

  const getStatusColor = (status: SpO2Status) => {
    switch (status) {
      case 'normal':
        return 'bg-green-100 text-green-700';
      case 'low':
        return 'bg-yellow-100 text-yellow-700';
      case 'critical':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getSpO2Status = (spo2: number): SpO2Status => {
    if (spo2 >= 95) return 'normal';
    if (spo2 >= 90) return 'low';
    return 'critical';
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    };
  };

  const handleDisconnect = async () => {
    await ble.disconnect();
    deviceIdRef.current = null;
  };

  const chartData: ChartDataPoint[] = useMemo(() => {
    return readings.map((reading) => ({
      date: formatDateTime(reading.measured_at).date,
      timestamp: new Date(reading.measured_at).getTime(),
      spo2: reading.spo2,
      pulse: reading.pulse_rate,
    }));
  }, [readings]);

  const spo2Series: DataSeries[] = [
    { key: 'spo2', label: 'SpO2', color: '#06b6d4', unit: '%' },
  ];

  const spo2ReferenceLines: ReferenceRange[] = [
    { label: 'Normal', value: 95, color: '#22c55e', strokeDasharray: '5 5' },
    { label: 'Low', value: 90, color: '#eab308', strokeDasharray: '3 3' },
  ];

  const criticalAlerts: CriticalAlert[] = useMemo(() => {
    if (readings.length === 0) return [];
    const latestReading = readings[0];
    return checkSpO2CriticalValues(latestReading).filter((alert) => !dismissedAlerts.has(alert.id));
  }, [readings, dismissedAlerts]);

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlerts((prev) => new Set([...prev, alertId]));
  };

  const handleManualSave = async (data: Record<string, unknown>) => {
    const result = await DeviceService.saveSpO2Reading({
      device_id: 'manual',
      spo2: data.spo2 as number,
      pulse_rate: data.pulse_rate as number,
      measured_at: data.measured_at as string,
    });
    if (result.success) {
      await loadReadings();
    }
    return result;
  };

  const isConnected = ble.status === 'connected';
  const isPairing = ble.status === 'pairing';
  const connectLabel = `Connect ${friendlyName ?? 'Pulse Oximeter'}`;
  const displayError = error ?? ble.error;

  return (
    <div className="min-h-screen pb-20" style={{ background: branding.gradient }}>
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-3xl">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl sm:text-7xl mb-4">🫁</div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-3 drop-shadow-lg">
            Pulse Oximeter
          </h1>
          <p className="text-lg sm:text-xl text-white/90 max-w-xl mx-auto drop-shadow-sm">
            Monitor your blood oxygen levels (SpO2) and pulse rate
          </p>
        </div>

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
            <div className="bg-blue-50 rounded-xl p-4 text-blue-800">
              <h3 className="font-semibold mb-1 text-lg">Bluetooth isn’t available on this device</h3>
              <p className="text-base">
                {ble.capabilityMessage ?? 'This device can’t connect a Bluetooth pulse oximeter.'} You can
                still enter your reading by hand below — just type the numbers from your device.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-4 h-4 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-lg font-semibold text-gray-700">
                    {isConnected ? `Connected: ${ble.deviceName ?? friendlyName ?? 'your device'}` : 'Not Connected'}
                  </span>
                </div>
                <button
                  onClick={isConnected ? handleDisconnect : ble.pair}
                  disabled={isPairing}
                  aria-label={isConnected ? 'Disconnect pulse oximeter' : connectLabel}
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
                    {saving ? 'Saving your reading…' : 'Put your finger in the device now — your reading will appear below automatically.'}
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 rounded-xl p-4 text-blue-800">
                  <h3 className="font-semibold mb-2 text-lg">How to connect your pulse oximeter</h3>
                  <ol className="list-decimal list-inside space-y-1 text-base">
                    <li>Turn on your pulse oximeter so it is ready to pair.</li>
                    <li>Tap <span className="font-semibold">Connect</span> above.</li>
                    <li>Pick your device from the list that appears.</li>
                  </ol>
                  <p className="text-sm mt-3 text-blue-700">
                    Works with standard Bluetooth pulse oximeters on Android phones and computers using Chrome.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* SpO2 Range Guide */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4" style={{ color: branding.primaryColor }}>
            Blood Oxygen (SpO2) Guide
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-4 bg-green-50 rounded-xl">
              <div>
                <div className="text-green-700 font-semibold">Normal</div>
                <div className="text-sm text-green-600">Healthy oxygen levels</div>
              </div>
              <div className="text-green-700 font-bold text-xl">95-100%</div>
            </div>
            <div className="flex justify-between items-center p-4 bg-yellow-50 rounded-xl">
              <div>
                <div className="text-yellow-700 font-semibold">Low</div>
                <div className="text-sm text-yellow-600">Consult your doctor</div>
              </div>
              <div className="text-yellow-700 font-bold text-xl">90-94%</div>
            </div>
            <div className="flex justify-between items-center p-4 bg-red-50 rounded-xl">
              <div>
                <div className="text-red-700 font-semibold">Critical</div>
                <div className="text-sm text-red-600">Seek medical attention</div>
              </div>
              <div className="text-red-700 font-bold text-xl">Below 90%</div>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            *Normal SpO2 may vary for individuals with certain conditions. Consult your healthcare provider for your personal targets.
          </p>
        </div>

        {/* SpO2 Trend Chart */}
        {readings.length > 0 && (
          <div className="mb-6">
            <VitalTrendChart
              data={chartData}
              series={spo2Series}
              title="Blood Oxygen Trends"
              referenceLines={spo2ReferenceLines}
              yAxisDomain={[80, 100]}
              primaryColor={branding.primaryColor}
            />
          </div>
        )}

        {/* SpO2 History */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold mb-6" style={{ color: branding.primaryColor }}>
            Recent Readings
          </h2>
          {readings.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No readings yet. Take an SpO2 measurement to record your first reading.
            </p>
          ) : (
            <div className="space-y-4">
              {readings.map((reading) => {
                const { date, time } = formatDateTime(reading.measured_at);
                const status = getSpO2Status(reading.spo2);
                return (
                  <div key={reading.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <div className="text-sm text-gray-500">{date} at {time}</div>
                      <div className="text-2xl font-bold text-gray-800">
                        {reading.spo2}%
                        <span className="text-lg font-normal text-gray-500 ml-2">SpO2</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500 mb-1">Pulse: {reading.pulse_rate} bpm</div>
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

        {/* When to Monitor */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4" style={{ color: branding.primaryColor }}>
            When to Monitor SpO2
          </h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
              <span className="text-xl">🏃</span>
              <div>
                <div className="font-medium">During Exercise</div>
                <div className="text-sm text-gray-500">Monitor if you have respiratory conditions</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
              <span className="text-xl">😴</span>
              <div>
                <div className="font-medium">During Sleep</div>
                <div className="text-sm text-gray-500">Check for sleep apnea concerns</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
              <span className="text-xl">🤒</span>
              <div>
                <div className="font-medium">When Feeling Unwell</div>
                <div className="text-sm text-gray-500">Respiratory infections or COVID-19 monitoring</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
              <span className="text-xl">🏔️</span>
              <div>
                <div className="font-medium">At High Altitude</div>
                <div className="text-sm text-gray-500">Monitor for altitude sickness</div>
              </div>
            </div>
          </div>
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
              vitalType="spo2"
              onSave={handleManualSave}
              onCancel={() => setShowManualEntry(false)}
              primaryColor={branding.primaryColor}
            />
          ) : (
            <p className="text-gray-600">
              Don't have a connected pulse oximeter? Click "Add Reading" to manually enter your SpO2 level.
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

export default PulseOximeterPage;
