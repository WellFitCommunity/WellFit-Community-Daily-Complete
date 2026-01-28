// src/pages/devices/GlucometerPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '../../BrandingContext';

interface GlucoseReading {
  id: string;
  date: string;
  time: string;
  value: number;
  meal: 'fasting' | 'before_meal' | 'after_meal' | 'bedtime';
  status: 'normal' | 'low' | 'high' | 'critical';
}

const GlucometerPage: React.FC = () => {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Mock glucose readings for demonstration
  const mockReadings: GlucoseReading[] = [
    { id: '1', date: '2026-01-28', time: '07:30 AM', value: 98, meal: 'fasting', status: 'normal' },
    { id: '2', date: '2026-01-28', time: '10:00 AM', value: 142, meal: 'after_meal', status: 'normal' },
    { id: '3', date: '2026-01-27', time: '07:15 AM', value: 105, meal: 'fasting', status: 'normal' },
    { id: '4', date: '2026-01-27', time: '09:45 PM', value: 118, meal: 'bedtime', status: 'normal' },
    { id: '5', date: '2026-01-26', time: '07:00 AM', value: 92, meal: 'fasting', status: 'normal' },
  ];

  const getStatusColor = (status: GlucoseReading['status']) => {
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

  const getMealLabel = (meal: GlucoseReading['meal']) => {
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
          <div className="text-6xl sm:text-7xl mb-4">🩸</div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-3 drop-shadow-lg">
            Glucometer
          </h1>
          <p className="text-lg sm:text-xl text-white/90 max-w-xl mx-auto drop-shadow-sm">
            Track your blood glucose for diabetes management
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
              {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect Glucometer'}
            </button>
          </div>

          {!isConnected && (
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

        {/* Glucose History */}
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
                    <div className="text-sm text-gray-500">
                      {reading.date} at {reading.time}
                    </div>
                    <div className="text-2xl font-bold text-gray-800">
                      {reading.value}
                      <span className="text-lg font-normal text-gray-500 ml-2">mg/dL</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500 mb-1">
                      {getMealLabel(reading.meal)}
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
