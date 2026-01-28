// src/pages/devices/BloodPressureMonitorPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '../../BrandingContext';

interface BPReading {
  id: string;
  date: string;
  systolic: number;
  diastolic: number;
  pulse: number;
  status: 'normal' | 'elevated' | 'high' | 'low';
}

const BloodPressureMonitorPage: React.FC = () => {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Mock BP readings for demonstration
  const mockReadings: BPReading[] = [
    { id: '1', date: '2026-01-28', systolic: 118, diastolic: 76, pulse: 72, status: 'normal' },
    { id: '2', date: '2026-01-27', systolic: 122, diastolic: 78, pulse: 74, status: 'normal' },
    { id: '3', date: '2026-01-26', systolic: 128, diastolic: 82, pulse: 76, status: 'elevated' },
    { id: '4', date: '2026-01-25', systolic: 115, diastolic: 74, pulse: 70, status: 'normal' },
  ];

  const getStatusColor = (status: BPReading['status']) => {
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

  const handleConnect = async () => {
    setIsConnecting(true);
    // Simulate connection process
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsConnected(true);
    setIsConnecting(false);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
  };

  return (
    <div
      className="min-h-screen pb-20"
      style={{ background: branding.gradient }}
    >
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
                {isConnected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <button
              onClick={isConnected ? handleDisconnect : handleConnect}
              disabled={isConnecting}
              className={`px-6 py-3 rounded-xl font-semibold text-lg transition-all duration-300 ${
                isConnected
                  ? 'bg-red-100 text-red-600 hover:bg-red-200'
                  : 'text-white hover:opacity-90'
              }`}
              style={!isConnected ? { backgroundColor: branding.primaryColor } : {}}
            >
              {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect Monitor'}
            </button>
          </div>

          {!isConnected && (
            <div className="bg-blue-50 rounded-xl p-4 text-blue-700">
              <h3 className="font-semibold mb-2">Compatible BP Monitors:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Omron Complete</li>
                <li>Withings BPM Connect</li>
                <li>Qardio Arm</li>
                <li>iHealth Clear</li>
                <li>Any Bluetooth-enabled BP monitor</li>
              </ul>
            </div>
          )}
        </div>

        {/* BP Range Guide */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          <h2
            className="text-2xl font-bold mb-4"
            style={{ color: branding.primaryColor }}
          >
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

        {/* BP History */}
        {isConnected && (
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
            <h2
              className="text-2xl font-bold mb-6"
              style={{ color: branding.primaryColor }}
            >
              Recent Readings
            </h2>
            <div className="space-y-4">
              {mockReadings.map((reading) => (
                <div
                  key={reading.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                >
                  <div>
                    <div className="text-sm text-gray-500">{reading.date}</div>
                    <div className="text-2xl font-bold text-gray-800">
                      {reading.systolic}/{reading.diastolic}
                      <span className="text-lg font-normal text-gray-500 ml-2">mmHg</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500 mb-1">
                      Pulse: {reading.pulse} bpm
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                        reading.status
                      )}`}
                    >
                      {reading.status.charAt(0).toUpperCase() + reading.status.slice(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual Entry */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          <h2
            className="text-2xl font-bold mb-4"
            style={{ color: branding.primaryColor }}
          >
            Manual Entry
          </h2>
          <p className="text-gray-600 mb-4">
            Don't have a smart BP monitor? You can manually enter your readings.
          </p>
          <button
            onClick={() => navigate('/health-observations')}
            className="px-6 py-3 rounded-xl font-semibold text-lg text-white transition-all duration-300 hover:opacity-90"
            style={{ backgroundColor: branding.secondaryColor }}
          >
            Enter BP Reading Manually
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

export default BloodPressureMonitorPage;
