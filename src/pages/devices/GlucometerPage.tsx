// src/pages/devices/GlucometerPage.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '../../BrandingContext';
import { DeviceService, type GlucoseReading } from '../../services/deviceService';
import VitalTrendChart, { type ChartDataPoint, type DataSeries, type ReferenceRange } from '../../components/devices/VitalTrendChart';
import CriticalValueAlert, { checkGlucoseCriticalValues, type CriticalAlert } from '../../components/devices/CriticalValueAlert';
import ManualEntryForm from '../../components/devices/ManualEntryForm';
import { useBleCapture } from '../../hooks/useBleCapture';
import { auditLogger } from '../../services/auditLogger';
import type { BleVitalReading } from '../../types/ble';

type GlucoseStatus = 'normal' | 'low' | 'high' | 'critical';

const FRIENDLY_NAME_KEY = 'ble_friendly_name_glucose_meter';

const GlucometerPage: React.FC = () => {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [isLoading, setIsLoading] = useState(true);
  const [readings, setReadings] = useState<GlucoseReading[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [friendlyName, setFriendlyName] = useState<string | null>(null);

  const deviceIdRef = useRef<string | null>(null);

  const loadReadings = useCallback(async () => {
    const result = await DeviceService.getGlucoseReadings(20);
    if (result.success && result.data) {
      setReadings(result.data);
    }
  }, []);

  const handleBleReading = useCallback(
    async (reading: BleVitalReading) => {
      const value = reading.values.find((v) => v.type === 'glucose')?.value;
      if (value === undefined) {
        setError('That reading came through incomplete. Please take it again.');
        return;
      }
      setSaving(true);
      try {
        const result = await DeviceService.saveGlucoseReading({
          device_id: deviceIdRef.current ?? 'ble',
          value: Math.round(value),
          // A meter reading carries no meal context; default to fasting
          // (same status thresholds as before_meal).
          meal_context: 'fasting',
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
          'BLE_GLUCOSE_SAVE_FAILED',
          err instanceof Error ? err : new Error(String(err)),
          { deviceType: 'glucose_meter' }
        );
        setError('We could not save that reading. Please try again.');
      } finally {
        setSaving(false);
      }
    },
    [loadReadings]
  );

  const ble = useBleCapture({ deviceType: 'glucose_meter', onReading: handleBleReading });

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
      const conn = await DeviceService.connectDevice('glucometer', name);
      if (conn.success && conn.data) {
        deviceIdRef.current = conn.data.id;
      }
    })();
  }, [ble.status, ble.deviceName]);

  const getGlucoseStatus = (value: number, mealContext: GlucoseReading['meal_context']): GlucoseStatus => {
    if (value < 70) return 'low';
    if (value > 250) return 'critical';
    if (mealContext === 'after_meal') {
      return value <= 180 ? 'normal' : 'high';
    }
    if (mealContext === 'bedtime') {
      return value >= 100 && value <= 140 ? 'normal' : (value < 100 ? 'low' : 'high');
    }
    return value >= 80 && value <= 130 ? 'normal' : (value < 80 ? 'low' : 'high');
  };

  const getStatusColor = (status: GlucoseStatus) => {
    switch (status) {
      case 'normal':
        return 'bg-green-100 text-green-700';
      case 'low':
        return 'bg-blue-100 text-blue-700';
      case 'high':
        return 'bg-yellow-100 text-yellow-700';
      case 'critical':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getMealLabel = (meal: GlucoseReading['meal_context']) => {
    switch (meal) {
      case 'fasting':
        return 'Fasting';
      case 'before_meal':
        return 'Before Meal';
      case 'after_meal':
        return 'After Meal';
      case 'bedtime':
        return 'Bedtime';
      default:
        return meal;
    }
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
      glucose: reading.value,
    }));
  }, [readings]);

  const glucoseSeries: DataSeries[] = [
    { key: 'glucose', label: 'Glucose', color: '#f59e0b', unit: 'mg/dL' },
  ];

  const glucoseReferenceLines: ReferenceRange[] = [
    { label: 'Target High', value: 180, color: '#eab308', strokeDasharray: '5 5' },
    { label: 'Target Low', value: 80, color: '#22c55e', strokeDasharray: '5 5' },
    { label: 'Low', value: 70, color: '#3b82f6', strokeDasharray: '3 3' },
  ];

  const criticalAlerts: CriticalAlert[] = useMemo(() => {
    if (readings.length === 0) return [];
    const latestReading = readings[0];
    return checkGlucoseCriticalValues(latestReading).filter((alert) => !dismissedAlerts.has(alert.id));
  }, [readings, dismissedAlerts]);

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlerts((prev) => new Set([...prev, alertId]));
  };

  const handleManualSave = async (data: Record<string, unknown>) => {
    const result = await DeviceService.saveGlucoseReading({
      device_id: 'manual',
      value: data.value as number,
      meal_context: data.meal_context as GlucoseReading['meal_context'],
      measured_at: data.measured_at as string,
    });
    if (result.success) {
      await loadReadings();
    }
    return result;
  };

  const isConnected = ble.status === 'connected';
  const isPairing = ble.status === 'pairing';
  const connectLabel = `Connect ${friendlyName ?? 'Glucometer'}`;
  const displayError = error ?? ble.error;

  return (
    <div className="min-h-screen pb-20" style={{ background: branding.gradient }}>
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-3xl">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl sm:text-7xl mb-4">🩸</div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-3 drop-shadow-lg">
            Glucometer
          </h1>
          <p className="text-lg sm:text-xl text-white/90 max-w-xl mx-auto drop-shadow-sm">
            Track your blood glucose for diabetes management
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
                {ble.capabilityMessage ?? 'This device can’t connect a Bluetooth glucometer.'} You can
                still enter your reading by hand below — just type the number from your meter.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-4 h-4 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-lg font-semibold text-gray-700">
                    {isConnected ? `Connected: ${ble.deviceName ?? friendlyName ?? 'your meter'}` : 'Not Connected'}
                  </span>
                </div>
                <button
                  onClick={isConnected ? handleDisconnect : ble.pair}
                  disabled={isPairing}
                  aria-label={isConnected ? 'Disconnect glucometer' : connectLabel}
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
                    {saving ? 'Saving your reading…' : 'Take a reading on your meter now — it will appear below automatically.'}
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 rounded-xl p-4 text-blue-800">
                  <h3 className="font-semibold mb-2 text-lg">How to connect your meter</h3>
                  <ol className="list-decimal list-inside space-y-1 text-base">
                    <li>Turn on your glucometer so it is ready to pair.</li>
                    <li>Tap <span className="font-semibold">Connect</span> above.</li>
                    <li>Pick your meter from the list that appears.</li>
                  </ol>
                  <p className="text-sm mt-3 text-blue-700">
                    Works with standard Bluetooth glucose meters on Android phones and computers using Chrome.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Target Ranges */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4" style={{ color: branding.primaryColor }}>
            Target Blood Glucose Ranges
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
              <span className="font-medium">Fasting / Before Meals</span>
              <span className="text-green-600 font-semibold">80-130 mg/dL</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
              <span className="font-medium">2 Hours After Meals</span>
              <span className="text-green-600 font-semibold">Less than 180 mg/dL</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
              <span className="font-medium">Bedtime</span>
              <span className="text-green-600 font-semibold">100-140 mg/dL</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            *These are general guidelines. Consult your healthcare provider for your personal targets.
          </p>
        </div>

        {/* Glucose Trend Chart */}
        {readings.length > 0 && (
          <div className="mb-6">
            <VitalTrendChart
              data={chartData}
              series={glucoseSeries}
              title="Blood Glucose Trends"
              referenceLines={glucoseReferenceLines}
              yAxisDomain={[40, 300]}
              primaryColor={branding.primaryColor}
            />
          </div>
        )}

        {/* Glucose History */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold mb-6" style={{ color: branding.primaryColor }}>
            Recent Readings
          </h2>
          {readings.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No readings yet. Take a glucose measurement to record your first reading.
            </p>
          ) : (
            <div className="space-y-4">
              {readings.map((reading) => {
                const { date, time } = formatDateTime(reading.measured_at);
                const status = getGlucoseStatus(reading.value, reading.meal_context);
                return (
                  <div key={reading.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <div className="text-sm text-gray-500">{date} at {time}</div>
                      <div className="text-2xl font-bold text-gray-800">
                        {reading.value}
                        <span className="text-lg font-normal text-gray-500 ml-2">mg/dL</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500 mb-1">{getMealLabel(reading.meal_context)}</div>
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

        {/* A1C Tracking */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4" style={{ color: branding.primaryColor }}>
            A1C Tracking
          </h2>
          <p className="text-gray-600 mb-4">
            Your A1C is a measure of your average blood sugar over the past 2-3 months.
            Ask your doctor about your A1C during your next visit.
          </p>
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-green-600 font-bold text-lg">Below 5.7%</div>
                <div className="text-sm text-gray-500">Normal</div>
              </div>
              <div>
                <div className="text-yellow-600 font-bold text-lg">5.7% - 6.4%</div>
                <div className="text-sm text-gray-500">Prediabetes</div>
              </div>
              <div>
                <div className="text-red-600 font-bold text-lg">6.5% or higher</div>
                <div className="text-sm text-gray-500">Diabetes</div>
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
              vitalType="glucose"
              onSave={handleManualSave}
              onCancel={() => setShowManualEntry(false)}
              primaryColor={branding.primaryColor}
            />
          ) : (
            <p className="text-gray-600">
              Don't have a connected glucometer? Click "Add Reading" to manually enter your glucose level.
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

export default GlucometerPage;
