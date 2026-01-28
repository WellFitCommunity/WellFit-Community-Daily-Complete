// src/pages/devices/SmartScalePage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '../../BrandingContext';

interface WeightReading {
  id: string;
  date: string;
  weight: number;
  bmi?: number;
  bodyFat?: number;
  muscleMass?: number;
}

const SmartScalePage: React.FC = () => {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Mock weight readings for demonstration
  const mockReadings: WeightReading[] = [
    { id: '1', date: '2026-01-28', weight: 165.2, bmi: 24.5, bodyFat: 22.1, muscleMass: 45.3 },
    { id: '2', date: '2026-01-25', weight: 165.8, bmi: 24.6, bodyFat: 22.3, muscleMass: 45.1 },
    { id: '3', date: '2026-01-22', weight: 166.1, bmi: 24.7, bodyFat: 22.5, muscleMass: 44.9 },
  ];

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
          <div className="text-6xl sm:text-7xl mb-4">⚖️</div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-3 drop-shadow-lg">
            Smart Scale
          </h1>
          <p className="text-lg sm:text-xl text-white/90 max-w-xl mx-auto drop-shadow-sm">
            Track your weight, BMI, and body composition
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
              {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect Scale'}
            </button>
          </div>

          {!isConnected && (
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

        {/* Weight History */}
        {isConnected && (
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
            <h2
              className="text-2xl font-bold mb-6"
              style={{ color: branding.primaryColor }}
            >
              Recent Measurements
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
                      {reading.weight} lbs
                    </div>
                  </div>
                  <div className="text-right grid grid-cols-3 gap-4">
                    {reading.bmi && (
                      <div>
                        <div className="text-xs text-gray-500">BMI</div>
                        <div className="font-semibold">{reading.bmi}</div>
                      </div>
                    )}
                    {reading.bodyFat && (
                      <div>
                        <div className="text-xs text-gray-500">Body Fat</div>
                        <div className="font-semibold">{reading.bodyFat}%</div>
                      </div>
                    )}
                    {reading.muscleMass && (
                      <div>
                        <div className="text-xs text-gray-500">Muscle</div>
                        <div className="font-semibold">{reading.muscleMass}%</div>
                      </div>
                    )}
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
