// src/pages/devices/SmartScalePage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '../../BrandingContext';
import { DeviceService, type WeightReading } from '../../services/deviceService';
import VitalTrendChart, { type ChartDataPoint, type DataSeries } from '../../components/devices/VitalTrendChart';

const SmartScalePage: React.FC = () => {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [readings, setReadings] = useState<WeightReading[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load connection status and readings on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [connectionResult, readingsResult] = await Promise.all([
        DeviceService.getConnectionStatus('smart_scale'),
        DeviceService.getWeightReadings(10),
      ]);

      if (connectionResult.success && connectionResult.data) {
        setIsConnected(connectionResult.data.connected);
      }

      if (readingsResult.success && readingsResult.data) {
        setReadings(readingsResult.data);
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const result = await DeviceService.connectDevice('smart_scale', 'Smart Scale');
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
    const result = await DeviceService.disconnectDevice('smart_scale');
    if (result.success) {
      setIsConnected(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Prepare chart data
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
                className={`w-4 h-4 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`}
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
              {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect Scale'}
            </button>
          </div>

          {!isConnected && !isLoading && (
            <div className="bg-blue-50 rounded-xl p-4 text-blue-700">
              <h3 className="font-semibold mb-2">Compatible Smart Scales:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Withings Body+</li>
                <li>Fitbit Aria 2</li>
                <li>Eufy Smart Scale P2</li>
                <li>Renpho Smart Body Scale</li>
                <li>Any Bluetooth-enabled scale</li>
              </ul>
            </div>
          )}
        </div>

        {/* Weight Trend Chart */}
        {isConnected && readings.length > 0 && (
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
        {isConnected && (
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
                {readings.map(reading => (
                  <div
                    key={reading.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                  >
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
        )}

        {/* Manual Entry */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4" style={{ color: branding.primaryColor }}>
            Manual Entry
          </h2>
          <p className="text-gray-600 mb-4">
            Don't have a smart scale? You can manually enter your weight.
          </p>
          <button
            onClick={() => navigate('/health-observations')}
            className="px-6 py-3 rounded-xl font-semibold text-lg text-white transition-all duration-300 hover:opacity-90"
            style={{ backgroundColor: branding.secondaryColor }}
          >
            Enter Weight Manually
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

export default SmartScalePage;
