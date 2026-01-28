// src/pages/devices/PulseOximeterPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '../../BrandingContext';
import { DeviceService, type SpO2Reading } from '../../services/deviceService';

type SpO2Status = 'normal' | 'low' | 'critical';

const PulseOximeterPage: React.FC = () => {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [readings, setReadings] = useState<SpO2Reading[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load connection status and readings on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [connectionResult, readingsResult] = await Promise.all([
        DeviceService.getConnectionStatus('pulse_oximeter'),
        DeviceService.getSpO2Readings(10),
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

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const result = await DeviceService.connectDevice('pulse_oximeter', 'Pulse Oximeter');
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
    const result = await DeviceService.disconnectDevice('pulse_oximeter');
    if (result.success) {
      setIsConnected(false);
    }
  };

  return (
    <div
      className="min-h-screen pb-20"
      style={{ background: branding.gradient }}
    >
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
              {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect Pulse Ox'}
            </button>
          </div>

          {!isConnected && !isLoading && (
            <div className="bg-blue-50 rounded-xl p-4 text-blue-700">
              <h3 className="font-semibold mb-2">Compatible Pulse Oximeters:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Masimo MightySat</li>
                <li>Nonin 3230</li>
                <li>Wellue O2Ring</li>
                <li>iHealth Air</li>
                <li>Any Bluetooth-enabled pulse oximeter</li>
              </ul>
            </div>
          )}
        </div>

        {/* SpO2 Range Guide */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          <h2
            className="text-2xl font-bold mb-4"
            style={{ color: branding.primaryColor }}
          >
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

        {/* SpO2 History */}
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
                No readings yet. Take an SpO2 measurement to record your first reading.
              </p>
            ) : (
              <div className="space-y-4">
                {readings.map((reading) => {
                  const { date, time } = formatDateTime(reading.measured_at);
                  const status = getSpO2Status(reading.spo2);
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
                          {reading.spo2}%
                          <span className="text-lg font-normal text-gray-500 ml-2">SpO2</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500 mb-1">
                          Pulse: {reading.pulse_rate} bpm
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

        {/* When to Monitor */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          <h2
            className="text-2xl font-bold mb-4"
            style={{ color: branding.primaryColor }}
          >
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
          <h2
            className="text-2xl font-bold mb-4"
            style={{ color: branding.primaryColor }}
          >
            Manual Entry
          </h2>
          <p className="text-gray-600 mb-4">
            Don't have a connected pulse oximeter? You can manually enter your readings.
          </p>
          <button
            onClick={() => navigate('/health-observations')}
            className="px-6 py-3 rounded-xl font-semibold text-lg text-white transition-all duration-300 hover:opacity-90"
            style={{ backgroundColor: branding.secondaryColor }}
          >
            Enter SpO2 Reading Manually
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

export default PulseOximeterPage;
