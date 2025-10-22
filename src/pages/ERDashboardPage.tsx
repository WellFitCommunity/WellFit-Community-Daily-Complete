import React, { useState } from 'react';
import ERIncomingPatientBoard from '../components/ems/ERIncomingPatientBoard';

/**
 * ER Dashboard Page
 * Full-screen view for ER charge nurses to monitor all incoming ambulances
 * Optimized for display on ER monitors/tablets
 */
const ERDashboardPage: React.FC = () => {
  const [hospitalName, setHospitalName] = useState('Your Hospital Name');
  const [isEditingHospital, setIsEditingHospital] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-4xl">🚑</div>
              <div>
                <h1 className="text-3xl font-bold">ER Dashboard - Incoming Patients</h1>
                <p className="text-red-100 text-sm mt-1">
                  Real-time ambulance notifications and handoffs
                </p>
              </div>
            </div>

            {/* Hospital Name Selector */}
            <div className="flex items-center gap-3">
              {isEditingHospital ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={hospitalName}
                    onChange={(e) => setHospitalName(e.target.value)}
                    className="px-3 py-2 rounded-lg border-2 border-white text-gray-900 font-medium"
                    placeholder="Hospital Name"
                  />
                  <button
                    onClick={() => setIsEditingHospital(false)}
                    className="px-4 py-2 bg-white text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditingHospital(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-800 rounded-lg hover:bg-red-900 transition-colors"
                >
                  <span className="text-lg">🏥</span>
                  <span className="font-medium">{hospitalName}</span>
                  <span className="text-sm opacity-75">✏️</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Instructions Card */}
        <div className="mb-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="text-3xl">ℹ️</div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-blue-900 mb-2">
                ER Charge Nurse Dashboard
              </h2>
              <div className="text-blue-800 space-y-2">
                <p>
                  <strong>Purpose:</strong> Monitor all incoming patients from ambulances in real-time.
                  This view is designed for large displays in the ER charge nurse station.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <p className="font-semibold mb-1">🔴 Critical Alerts:</p>
                    <ul className="text-sm space-y-1 ml-4">
                      <li>• STEMI (Heart Attack) - Door-to-balloon &lt;90 min</li>
                      <li>• Stroke - Door-to-CT &lt;25 min, tPA &lt;60 min</li>
                      <li>• Trauma - Activate trauma team</li>
                      <li>• Sepsis - Early antibiotics critical</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">📋 Workflow:</p>
                    <ul className="text-sm space-y-1 ml-4">
                      <li>• Monitor incoming ambulances and ETAs</li>
                      <li>• Prepare team/bed based on chief complaint</li>
                      <li>• Activate alerts (STEMI, Stroke, Trauma)</li>
                      <li>• Complete handoff when patient arrives</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Incoming Patient Board */}
        <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-6">
          <ERIncomingPatientBoard hospitalName={hospitalName} />
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-6">
              <span>🔄 Auto-refreshes every 30 seconds</span>
              <span>📡 Real-time updates via WebSocket</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                SOC2 Compliant
              </span>
              <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                HIPAA Secure
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ERDashboardPage;
