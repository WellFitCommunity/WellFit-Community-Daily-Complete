// src/pages/MyHealthHubPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '../BrandingContext';

interface HealthNavigationTile {
  id: string;
  icon: string;
  title: string;
  description: string;
  route: string;
  color: string;
}

interface DeviceTile {
  id: string;
  icon: string;
  title: string;
  description: string;
  route: string;
  connected?: boolean;
}

const MyHealthHubPage: React.FC = () => {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [isDownloading, setIsDownloading] = useState(false);

  // Use branding colors for tile accents - alternating pattern
  const getTileAccentColor = (index: number) => {
    // Alternate between primary and secondary colors
    return index % 2 === 0 ? branding.primaryColor : branding.secondaryColor;
  };

  // Handle health records download
  const handleDownloadRecords = async () => {
    setIsDownloading(true);
    try {
      // Navigate to download page or trigger download modal
      navigate('/health-records-download');
    } finally {
      setIsDownloading(false);
    }
  };

  // Connected Devices tiles
  const deviceTiles: DeviceTile[] = [
    {
      id: 'smartwatch',
      icon: '⌚',
      title: 'Smartwatch',
      description: 'Fall detection, heart rate, steps & activity',
      route: '/wearables',
      connected: true,
    },
    {
      id: 'scale',
      icon: '⚖️',
      title: 'Smart Scale',
      description: 'Track weight, BMI, and body composition',
      route: '/devices/scale',
      connected: true,
    },
    {
      id: 'bp-monitor',
      icon: '❤️',
      title: 'BP Monitor',
      description: 'Blood pressure and pulse readings',
      route: '/devices/blood-pressure',
      connected: true,
    },
    {
      id: 'glucometer',
      icon: '🩸',
      title: 'Glucometer',
      description: 'Blood glucose monitoring for diabetes care',
      route: '/devices/glucometer',
      connected: true,
    },
    {
      id: 'pulse-ox',
      icon: '🫁',
      title: 'Pulse Oximeter',
      description: 'Blood oxygen (SpO2) and pulse rate',
      route: '/devices/pulse-oximeter',
      connected: true,
    },
  ];

  const healthTiles: HealthNavigationTile[] = [
    {
      id: 'appointments',
      icon: '📹',
      title: 'My Appointments',
      description: 'View and join your scheduled video doctor visits',
      route: '/telehealth-appointments',
      color: '', // Will use branding color
    },
    {
      id: 'vitals-labs',
      icon: '📊',
      title: 'My Vitals & Labs',
      description: 'Track your blood pressure, heart rate, lab results, and more',
      route: '/health-observations',
      color: '', // Will use branding color
    },
    {
      id: 'vaccines',
      icon: '💉',
      title: 'My Vaccines',
      description: 'View your immunization records and vaccine care gaps',
      route: '/immunizations',
      color: '', // Will use branding color
    },
    {
      id: 'medications',
      icon: '💊',
      title: 'My Medications',
      description: 'AI-powered medication tracking and management',
      route: '/medicine-cabinet',
      color: '', // Will use branding color
    },
    {
      id: 'care-plans',
      icon: '📋',
      title: 'My Care Plans',
      description: 'View your active care plans and health goals',
      route: '/care-plans',
      color: '', // Will use branding color
    },
    {
      id: 'allergies',
      icon: '⚠️',
      title: 'My Allergies',
      description: 'Track your allergies and intolerances for safer care',
      route: '/allergies',
      color: '', // Will use branding color
    },
    {
      id: 'conditions',
      icon: '🩺',
      title: 'My Conditions',
      description: 'View and manage your medical conditions and diagnoses',
      route: '/conditions',
      color: '', // Will use branding color
    },
  ];

  return (
    <div
      className="min-h-screen pb-20"
      style={{ background: branding.gradient }}
    >
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-5xl">

        {/* Header Section */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="text-6xl sm:text-7xl mb-4">🏥</div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-lg">
            My Health Records
          </h1>
          <p className="text-xl sm:text-2xl text-white/90 max-w-2xl mx-auto drop-shadow-sm mb-6">
            Access your complete health information in one place
          </p>

          {/* Download Button */}
          <button
            onClick={handleDownloadRecords}
            disabled={isDownloading}
            aria-label="Download all my health records"
            className="inline-flex items-center gap-3 px-8 py-4 bg-white text-gray-700 rounded-xl font-semibold text-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-2xl" aria-hidden="true">📥</span>
            <span>{isDownloading ? 'Preparing Download...' : 'Download My Records'}</span>
          </button>
        </div>

        {/* Connected Devices Section */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-4xl" aria-hidden="true">📱</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg">
              My Connected Devices
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6" role="navigation" aria-label="Connected health devices">
            {deviceTiles.map((device) => (
              <button
                key={device.id}
                onClick={() => navigate(device.route)}
                aria-label={`${device.connected ? 'Connected' : 'Connect'} ${device.title}: ${device.description}`}
                className="group relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 overflow-hidden p-6 text-center"
                style={{ minHeight: '180px' }}
              >
                {/* Connection Status Indicator */}
                <div
                  className={`absolute top-3 right-3 w-3 h-3 rounded-full ${
                    device.connected ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                  title={device.connected ? 'Connected' : 'Not connected'}
                />

                {/* Icon */}
                <div className="text-5xl sm:text-6xl mb-3 relative z-10 transform group-hover:scale-110 transition-transform duration-300" aria-hidden="true">
                  {device.icon}
                </div>

                {/* Title */}
                <h3
                  className="text-lg sm:text-xl font-bold mb-2 relative z-10"
                  style={{ color: branding.primaryColor }}
                >
                  {device.title}
                </h3>

                {/* Description */}
                <p className="text-sm sm:text-base text-gray-600 leading-snug relative z-10">
                  {device.description}
                </p>

                {/* Connect/View Label */}
                <div
                  className="mt-3 text-sm font-semibold opacity-70 group-hover:opacity-100 transition-opacity"
                  style={{ color: branding.primaryColor }}
                >
                  {device.connected ? 'View Data →' : 'Tap to Connect →'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Navigation Tiles Grid - First row has Appointments, second row has 2x2 grid */}
        <div className="mb-8">
          {/* Featured: My Appointments (full width) */}
          <div className="mb-6 sm:mb-8">
            <button
              onClick={() => navigate(healthTiles[0].route)}
              aria-label={`Go to ${healthTiles[0].title}: ${healthTiles[0].description}`}
              className="group relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 overflow-hidden p-8 sm:p-10 text-left w-full"
              style={{ minHeight: '220px' }}
            >
              <div
                className="absolute top-0 right-0 w-32 h-32 rounded-full -mr-16 -mt-16 opacity-10 group-hover:opacity-20 transition-opacity duration-300"
                style={{
                  background: `linear-gradient(to bottom right, ${branding.primaryColor}, ${branding.primaryColor}dd)`
                }}
              ></div>
              <div className="text-6xl sm:text-7xl mb-4 relative z-10 transform group-hover:scale-110 transition-transform duration-300" aria-hidden="true">
                {healthTiles[0].icon}
              </div>
              <h2
                className="text-2xl sm:text-3xl font-bold mb-3 relative z-10"
                style={{ color: branding.primaryColor }}
              >
                {healthTiles[0].title}
              </h2>
              <p className="text-lg sm:text-xl text-gray-600 leading-relaxed relative z-10">
                {healthTiles[0].description}
              </p>
              <div className="absolute bottom-6 right-6 text-3xl opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                →
              </div>
            </button>
          </div>

          {/* Other Health Records (2x2 grid) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8" role="navigation" aria-label="Health records sections">
          {healthTiles.slice(1).map((tile, index) => (
            <button
              key={tile.id}
              onClick={() => navigate(tile.route)}
              aria-label={`Go to ${tile.title}: ${tile.description}`}
              className="group relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 overflow-hidden p-8 sm:p-10 text-left"
              style={{ minHeight: '220px' }}
            >
              {/* Gradient Background Accent - Using Branding Colors */}
              <div
                className="absolute top-0 right-0 w-32 h-32 rounded-full -mr-16 -mt-16 opacity-10 group-hover:opacity-20 transition-opacity duration-300"
                style={{
                  background: `linear-gradient(to bottom right, ${getTileAccentColor(index + 1)}, ${getTileAccentColor(index + 1)}dd)`
                }}
              ></div>

              {/* Icon */}
              <div className="text-6xl sm:text-7xl mb-4 relative z-10 transform group-hover:scale-110 transition-transform duration-300" aria-hidden="true">
                {tile.icon}
              </div>

              {/* Title */}
              <h2
                className="text-2xl sm:text-3xl font-bold mb-3 relative z-10"
                style={{ color: branding.primaryColor }}
              >
                {tile.title}
              </h2>

              {/* Description */}
              <p className="text-lg sm:text-xl text-gray-600 leading-relaxed relative z-10">
                {tile.description}
              </p>

              {/* Arrow Indicator */}
              <div className="absolute bottom-6 right-6 text-3xl opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                →
              </div>
            </button>
          ))}
          </div>
        </div>

        {/* Back to Dashboard Button */}
        <div className="text-center mt-8">
          <button
            onClick={() => navigate('/dashboard')}
            aria-label="Go back to main dashboard"
            className="inline-flex items-center gap-3 px-8 py-4 bg-white text-gray-700 rounded-xl font-semibold text-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            <span className="text-2xl" aria-hidden="true">←</span>
            <span>Back to Dashboard</span>
          </button>
        </div>

        {/* Quick Tips Section */}
        <div className="mt-12 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6 sm:p-8" role="complementary" aria-label="Health tips">
          <h3 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: branding.primaryColor }}>
            <span aria-hidden="true">💡</span> Quick Tips
          </h3>
          <ul className="space-y-3 text-lg sm:text-xl text-gray-700">
            <li className="flex items-start gap-3">
              <span className="text-2xl shrink-0" aria-hidden="true">✅</span>
              <span>Keep your health records up to date for better care coordination</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-2xl shrink-0" aria-hidden="true">📱</span>
              <span>Share your vaccine records with your healthcare providers</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-2xl shrink-0" aria-hidden="true">🔔</span>
              <span>Check for vaccine care gaps to stay protected</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-2xl shrink-0" aria-hidden="true">💪</span>
              <span>Track your vitals regularly to monitor your health trends</span>
            </li>
          </ul>
        </div>

      </div>
    </div>
  );
};

export default MyHealthHubPage;
