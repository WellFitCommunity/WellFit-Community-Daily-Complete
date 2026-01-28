// src/pages/devices/GlucometerPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '../../BrandingContext';
import { DeviceService, type GlucoseReading } from '../../services/deviceService';
import VitalTrendChart, { type ChartDataPoint, type DataSeries, type ReferenceRange } from '../../components/devices/VitalTrendChart';
import CriticalValueAlert, { checkGlucoseCriticalValues, type CriticalAlert } from '../../components/devices/CriticalValueAlert';

type GlucoseStatus = 'normal' | 'low' | 'high' | 'critical';

const GlucometerPage: React.FC = () => {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [readings, setReadings] = useState<GlucoseReading[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Load connection status and readings on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [connectionResult, readingsResult] = await Promise.all([
        DeviceService.getConnectionStatus('glucometer'),
        DeviceService.getGlucoseReadings(10),
      ]);

      if (connectionResult.success && connectionResult.data) {
        setIsConnected(connectionResult.data.connected);
      }

      if (readingsResult.success && readingsResult.data) {
        setReadings(readingsResult.data);
      }
    } catch {
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const getGlucoseStatus = (value: number, mealContext: GlucoseReading['meal_context']): GlucoseStatus => {
    // Fasting/Before meal targets: 80-130 mg/dL
    // After meal target: <180 mg/dL
    // Bedtime target: 100-140 mg/dL
    if (value < 70) return 'low';
    if (value > 250) return 'critical';

    if (mealContext === 'after_meal') {
      return value <= 180 ? 'normal' : 'high';
    }
    if (mealContext === 'bedtime') {
      return value >= 100 && value <= 140 ? 'normal' : (value < 100 ? 'low' : 'high');
    }
    // fasting or before_meal
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

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const result = await DeviceService.connectDevice('glucometer', 'Glucometer');
      if (result.success) {
        setIsConnected(true);
        await loadData();
      } else {
        setError(result.error || 'Failed to connect');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    const result = await DeviceService.disconnectDevice('glucometer');
    if (result.success) {
      setIsConnected(false);
    }
  };

  // Prepare chart data
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

  // Check for critical values in recent readings
  const criticalAlerts: CriticalAlert[] = useMemo(() => {
    if (readings.length === 0) return [];
    const latestReading = readings[0];
    return checkGlucoseCriticalValues(latestReading).filter(
      (alert) => !dismissedAlerts.has(alert.id)
    );
  }, [readings, dismissedAlerts]);

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlerts((prev) => new Set([...prev, alertId]));
  };

  return (
    <div
      className="min-h-screen pb-20"
      style={{ background: branding.gradient }}
    >
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

        {/* Critical Value Alerts */}
        <CriticalValueAlert
          alerts={criticalAlerts}
          onDismiss={handleDismissAlert}
        />

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 rounded-xl p-4 mb-6">
            {error}
          </div>
        )}

        {/* Connection Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div
                className={`w-4 h-4 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-gray-300'
                }`}
              />
              <span className="text-lg font-semibold text-gray-700">
                {isLoading ? 'Loading...' : isConnected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <button
              onClick={isConnected ? handleDisconnect : handleConnect}
              disabled={isConnecting || isLoading}
              className={`px-6 py-3 rounded-xl font-semibold text-lg transition-all duration-300 ${
                isConnected
                  ? 'bg-red-100 text-red-600 hover:bg-red-200'
                  : 'text-white hover:opacity-90'
              }`}
              style={!isConnected ? { backgroundColor: branding.primaryColor } : {}}
            >
              {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect Glucometer'}
            </button>
          </div>

          {!isConnected && !isLoading && (
            <div className="bg-blue-50 rounded-xl p-4 text-blue-700">
              <h3 className="font-semibold mb-2">Compatible Glucometers:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Dexcom G6/G7 CGM</li>
                <li>FreeStyle Libre 2/3</li>
                <li>OneTouch Verio Reflect</li>
                <li>Contour Next One</li>
                <li>Any Bluetooth-enabled glucose meter</li>
              </ul>
            </div>
          )}
        </div>

        {/* Target Ranges */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          <h2
            className="text-2xl font-bold mb-4"
            style={{ color: branding.primaryColor }}
          >
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
        {isConnected && readings.length > 0 && (
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
        {isConnected && (
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
            <h2
              className="text-2xl font-bold mb-6"
              style={{ color: branding.primaryColor }}
            >
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
                    <div
                      key={reading.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                    >
                      <div>
                        <div className="text-sm text-gray-500">
                          {date} at {time}
                        </div>
                        <div className="text-2xl font-bold text-gray-800">
                          {reading.value}
                          <span className="text-lg font-normal text-gray-500 ml-2">mg/dL</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500 mb-1">
                          {getMealLabel(reading.meal_context)}
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status)}`}
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* A1C Tracking */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          <h2
            className="text-2xl font-bold mb-4"
            style={{ color: branding.primaryColor }}
          >
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
          <h2
            className="text-2xl font-bold mb-4"
            style={{ color: branding.primaryColor }}
          >
            Manual Entry
          </h2>
          <p className="text-gray-600 mb-4">
            Don't have a connected glucometer? You can manually enter your readings.
          </p>
          <button
            onClick={() => navigate('/health-observations')}
            className="px-6 py-3 rounded-xl font-semibold text-lg text-white transition-all duration-300 hover:opacity-90"
            style={{ backgroundColor: branding.secondaryColor }}
          >
            Enter Glucose Reading Manually
          </button>
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
