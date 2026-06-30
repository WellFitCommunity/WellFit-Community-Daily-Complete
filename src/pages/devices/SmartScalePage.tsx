// src/pages/devices/SmartScalePage.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '../../BrandingContext';
import { DeviceService, type WeightReading } from '../../services/deviceService';
import VitalTrendChart, { type ChartDataPoint, type DataSeries } from '../../components/devices/VitalTrendChart';
import ManualEntryForm from '../../components/devices/ManualEntryForm';
import { useBleCapture } from '../../hooks/useBleCapture';
import { auditLogger } from '../../services/auditLogger';
import type { BleVitalReading } from '../../types/ble';

const FRIENDLY_NAME_KEY = 'ble_friendly_name_weight_scale';

const SmartScalePage: React.FC = () => {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [isLoading, setIsLoading] = useState(true);
  const [readings, setReadings] = useState<WeightReading[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [friendlyName, setFriendlyName] = useState<string | null>(null);

  const deviceIdRef = useRef<string | null>(null);

  const loadReadings = useCallback(async () => {
    const result = await DeviceService.getWeightReadings(20);
    if (result.success && result.data) {
      setReadings(result.data);
    }
  }, []);

  const handleBleReading = useCallback(
    async (reading: BleVitalReading) => {
      const weightValue = reading.values.find((v) => v.type === 'weight');
      const bmi = reading.values.find((v) => v.type === 'bmi')?.value;
      if (!weightValue) {
        setError('That reading came through incomplete. Please step on the scale again.');
        return;
      }
      // BLE reports 'kg' or 'lb'; DeviceService stores 'kg' or 'lbs'.
      const unit: 'lbs' | 'kg' = weightValue.unit === 'kg' ? 'kg' : 'lbs';
      setSaving(true);
      try {
        const result = await DeviceService.saveWeightReading({
          device_id: deviceIdRef.current ?? 'ble',
          weight: Math.round(weightValue.value * 10) / 10,
          unit,
          bmi,
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
          'BLE_WEIGHT_SAVE_FAILED',
          err instanceof Error ? err : new Error(String(err)),
          { deviceType: 'weight_scale' }
        );
        setError('We could not save that reading. Please try again.');
      } finally {
        setSaving(false);
      }
    },
    [loadReadings]
  );

  const ble = useBleCapture({ deviceType: 'weight_scale', onReading: handleBleReading });

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
      const conn = await DeviceService.connectDevice('smart_scale', name);
      if (conn.success && conn.data) {
        deviceIdRef.current = conn.data.id;
      }
    })();
  }, [ble.status, ble.deviceName]);

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

  const handleManualSave = async (data: Record<string, unknown>) => {
    const result = await DeviceService.saveWeightReading({
      device_id: 'manual',
      weight: data.weight as number,
      unit: 'lbs',
      bmi: data.bmi as number | undefined,
      body_fat: data.body_fat as number | undefined,
      measured_at: data.measured_at as string,
    });
    if (result.success) {
      await loadReadings();
    }
    return result;
  };

  const chartData: ChartDataPoint[] = useMemo(() => {
    return readings.map((reading) => ({
      date: formatDate(reading.measured_at),
      timestamp: new Date(reading.measured_at).getTime(),
      weight: reading.weight,
      bmi: reading.bmi || 0,
    }));
  }, [readings]);

  const weightSeries: DataSeries[] = [
    { key: 'weight', label: 'Weight', color: '#8b5cf6', unit: 'lbs' },
  ];

  const isConnected = ble.status === 'connected';
  const isPairing = ble.status === 'pairing';
  const connectLabel = `Connect ${friendlyName ?? 'Scale'}`;
  const displayError = error ?? ble.error;

  return (
    <div className="min-h-screen pb-20" style={{ background: branding.gradient }}>
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-3xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl sm:text-7xl mb-4">⚖️</div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-3 drop-shadow-lg">
            Smart Scale
          </h1>
          <p className="text-lg sm:text-xl text-white/90 max-w-xl mx-auto drop-shadow-sm">
            Track your weight, BMI, and body composition
          </p>
        </div>

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
                {ble.capabilityMessage ?? 'This device can’t connect a Bluetooth scale.'} You can still
                enter your weight by hand below — just type the number from your scale.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-4 h-4 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-lg font-semibold text-gray-700">
                    {isConnected ? `Connected: ${ble.deviceName ?? friendlyName ?? 'your scale'}` : 'Not Connected'}
                  </span>
                </div>
                <button
                  onClick={isConnected ? handleDisconnect : ble.pair}
                  disabled={isPairing}
                  aria-label={isConnected ? 'Disconnect scale' : connectLabel}
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
                    {saving ? 'Saving your reading…' : 'Step on your scale now — your weight will appear below automatically.'}
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 rounded-xl p-4 text-blue-800">
                  <h3 className="font-semibold mb-2 text-lg">How to connect your scale</h3>
                  <ol className="list-decimal list-inside space-y-1 text-base">
                    <li>Turn on your scale so it is ready to pair.</li>
                    <li>Tap <span className="font-semibold">Connect</span> above.</li>
                    <li>Pick your scale from the list that appears.</li>
                  </ol>
                  <p className="text-sm mt-3 text-blue-700">
                    Works with standard Bluetooth scales on Android phones and computers using Chrome. Many
                    consumer scales sync only through their own app and won’t connect here — enter your weight by hand instead.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Weight Trend Chart */}
        {readings.length > 0 && (
          <div className="mb-6">
            <VitalTrendChart
              data={chartData}
              series={weightSeries}
              title="Weight Trends"
              primaryColor={branding.primaryColor}
            />
          </div>
        )}

        {/* Weight History */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold mb-6" style={{ color: branding.primaryColor }}>
            Recent Measurements
          </h2>
          {readings.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No readings yet. Step on your scale to record your first measurement.
            </p>
          ) : (
            <div className="space-y-4">
              {readings.map((reading) => (
                <div key={reading.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <div className="text-sm text-gray-500">{formatDate(reading.measured_at)}</div>
                    <div className="text-2xl font-bold text-gray-800">
                      {reading.weight} {reading.unit}
                    </div>
                  </div>
                  <div className="text-right grid grid-cols-3 gap-4">
                    {reading.bmi && (
                      <div>
                        <div className="text-xs text-gray-500">BMI</div>
                        <div className="font-semibold">{reading.bmi.toFixed(1)}</div>
                      </div>
                    )}
                    {reading.body_fat && (
                      <div>
                        <div className="text-xs text-gray-500">Body Fat</div>
                        <div className="font-semibold">{reading.body_fat.toFixed(1)}%</div>
                      </div>
                    )}
                    {reading.muscle_mass && (
                      <div>
                        <div className="text-xs text-gray-500">Muscle</div>
                        <div className="font-semibold">{reading.muscle_mass.toFixed(1)}%</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
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
              vitalType="weight"
              onSave={handleManualSave}
              onCancel={() => setShowManualEntry(false)}
              primaryColor={branding.primaryColor}
            />
          ) : (
            <p className="text-gray-600">
              Don't have a smart scale? Click "Add Reading" to manually enter your weight.
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

export default SmartScalePage;
