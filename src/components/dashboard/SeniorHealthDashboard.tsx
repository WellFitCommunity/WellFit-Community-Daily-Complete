// Senior-Friendly Health Dashboard
// Ultra-simple interface with large buttons, clear messaging, and minimal clicks

import React from 'react';
import SimpleFhirAiWidget from './SimpleFhirAiWidget';

const SeniorHealthDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Simple Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Your Health Today
          </h1>
          <p className="text-xl text-gray-600">
            Let's see how you're doing
          </p>
        </div>

        {/* Main AI Health Widget */}
        <SimpleFhirAiWidget />

        {/* Quick Help */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6 text-center">
          <div className="text-3xl mb-3">💬</div>
          <div className="text-lg font-medium text-gray-800 mb-2">Need Help?</div>
          <div className="text-gray-600 mb-4">
            If you have questions or concerns, we're here to help.
          </div>
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => window.location.href = 'tel:1-800-WELLFIT'}
              className="bg-green-600 text-white text-xl px-8 py-4 rounded-xl hover:bg-green-700 transition-colors"
            >
              📞 Call Support
            </button>
            <button
              onClick={() => window.location.href = '/community'}
              className="bg-purple-600 text-white text-xl px-8 py-4 rounded-xl hover:bg-purple-700 transition-colors"
            >
              👥 Community
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeniorHealthDashboard;