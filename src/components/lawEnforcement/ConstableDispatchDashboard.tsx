/**
 * Constable Dispatch Dashboard
 *
 * Real-time dashboard for constables monitoring senior welfare checks
 * Shows missed check-ins prioritized by urgency
 */

import React, { useState, useEffect } from 'react';
import { LawEnforcementService } from '../../services/lawEnforcementService';
import type { MissedCheckInAlert, WelfareCheckInfo } from '../../types/lawEnforcement';

export const ConstableDispatchDashboard: React.FC = () => {
  const [alerts, setAlerts] = useState<MissedCheckInAlert[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [welfareCheckInfo, setWelfareCheckInfo] = useState<WelfareCheckInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadAlerts();

    // Auto-refresh every 2 minutes
    const interval = setInterval(loadAlerts, 2 * 60 * 1000);
    setRefreshInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      loadWelfareCheckInfo(selectedPatient);
    }
  }, [selectedPatient]);

  const loadAlerts = async () => {
    setLoading(true);
    const data = await LawEnforcementService.getMissedCheckInAlerts();
    setAlerts(data);
    setLoading(false);
  };

  const loadWelfareCheckInfo = async (patientId: string) => {
    const info = await LawEnforcementService.getWelfareCheckInfo(patientId);
    setWelfareCheckInfo(info);
  };

  const getUrgencyColor = (urgency: number) => {
    if (urgency >= 100) return 'bg-red-600 text-white';
    if (urgency >= 50) return 'bg-orange-500 text-white';
    return 'bg-yellow-500 text-white';
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      critical: 'bg-red-600 text-white',
      high: 'bg-orange-500 text-white',
      standard: 'bg-blue-500 text-white'
    };
    return colors[priority as keyof typeof colors] || colors.standard;
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Panel - Alerts List */}
      <div className="w-1/3 bg-white border-r border-gray-200 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-blue-600 text-white p-4 z-10">
          <h2 className="text-xl font-bold">Welfare Check Queue</h2>
          <p className="text-sm text-blue-100 mt-1">
            {alerts.length} seniors requiring welfare checks
          </p>
          <button
            onClick={loadAlerts}
            disabled={loading}
            className="mt-2 px-3 py-1 bg-blue-700 hover:bg-blue-800 rounded text-sm"
          >
            {loading ? 'Refreshing...' : 'Refresh Now'}
          </button>
        </div>

        {/* Alerts List */}
        <div className="divide-y divide-gray-200">
          {alerts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <svg className="mx-auto h-12 w-12 text-green-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-medium">All Clear!</p>
              <p className="text-sm mt-1">No welfare checks needed at this time</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.patientId}
                onClick={() => setSelectedPatient(alert.patientId)}
                className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedPatient === alert.patientId ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                }`}
              >
                {/* Urgency Score */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{alert.patientName}</h3>
                    <p className="text-sm text-gray-600">{alert.patientAddress}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getUrgencyColor(alert.urgencyScore)}`}>
                    {alert.urgencyScore}
                  </span>
                </div>

                {/* Status Info */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityBadge(alert.responsePriority)}`}>
                    {alert.responsePriority.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-600">
                    {alert.hoursSinceCheckIn.toFixed(1)} hours ago
                  </span>
                </div>

                {/* Special Needs */}
                {alert.specialNeeds && (
                  <div className="flex items-center text-xs text-orange-600 mb-2">
                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {alert.specialNeeds}
                  </div>
                )}

                {/* Emergency Contact */}
                <div className="text-xs text-gray-600">
                  Emergency: {alert.emergencyContactName} • {alert.emergencyContactPhone}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel - Welfare Check Details */}
      <div className="flex-1 overflow-y-auto">
        {selectedPatient && welfareCheckInfo ? (
          <div className="p-6">
            {/* Senior Info Header */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{welfareCheckInfo.patientName}</h2>
                  <p className="text-gray-600">Age {welfareCheckInfo.patientAge}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${getPriorityBadge(welfareCheckInfo.responsePriority)}`}>
                  {welfareCheckInfo.responsePriority.toUpperCase()} PRIORITY
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Address:</span>
                  <p className="text-gray-900">{welfareCheckInfo.patientAddress}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Phone:</span>
                  <p className="text-gray-900">{welfareCheckInfo.patientPhone}</p>
                </div>
              </div>

              {welfareCheckInfo.hoursSinceCheckIn && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                  <p className="text-red-800 font-medium">
                    ⚠️ Last check-in: {welfareCheckInfo.hoursSinceCheckIn.toFixed(1)} hours ago
                  </p>
                </div>
              )}
            </div>

            {/* Emergency Response Info */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <svg className="h-5 w-5 mr-2 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                EMERGENCY RESPONSE INFO
              </h3>

              <div className="space-y-4">
                {/* Building Location */}
                {welfareCheckInfo.buildingLocation && (
                  <div className="bg-indigo-50 border-2 border-indigo-300 rounded p-4">
                    <span className="font-bold text-indigo-900 flex items-center">
                      🏢 BUILDING LOCATION
                    </span>
                    <div className="mt-2 space-y-1 text-indigo-900">
                      <p className="whitespace-pre-line font-medium">{welfareCheckInfo.buildingLocation}</p>
                      {welfareCheckInfo.elevatorRequired && (
                        <p className="mt-2 px-2 py-1 bg-indigo-200 rounded font-bold text-indigo-900 inline-block">
                          🛗 ELEVATOR REQUIRED
                        </p>
                      )}
                      {welfareCheckInfo.parkingInstructions && (
                        <p className="mt-2">
                          <span className="font-semibold">🅿️ Parking:</span> {welfareCheckInfo.parkingInstructions}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Mobility */}
                <div>
                  <span className="font-medium text-gray-700">Mobility:</span>
                  <p className="text-gray-900 text-lg font-semibold">{welfareCheckInfo.mobilityStatus}</p>
                </div>

                {/* Medical Equipment */}
                {welfareCheckInfo.medicalEquipment?.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                    <span className="font-medium text-yellow-900">Medical Equipment:</span>
                    <ul className="list-disc list-inside text-yellow-900 mt-1">
                      {welfareCheckInfo.medicalEquipment.map((eq, i) => (
                        <li key={i}>{eq}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Communication Needs */}
                {welfareCheckInfo.communicationNeeds && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <span className="font-medium text-blue-900">Communication:</span>
                    <p className="text-blue-900 mt-1">{welfareCheckInfo.communicationNeeds}</p>
                  </div>
                )}

                {/* Access Instructions */}
                {welfareCheckInfo.accessInstructions && (
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    <span className="font-medium text-green-900">🔑 Access Instructions:</span>
                    <p className="text-green-900 mt-1 whitespace-pre-line">{welfareCheckInfo.accessInstructions}</p>
                  </div>
                )}

                {/* Pets */}
                {welfareCheckInfo.pets && (
                  <div>
                    <span className="font-medium text-gray-700">Pets:</span>
                    <p className="text-gray-900">{welfareCheckInfo.pets}</p>
                  </div>
                )}

                {/* Special Instructions */}
                {welfareCheckInfo.specialInstructions && (
                  <div className="bg-purple-50 border border-purple-200 rounded p-3">
                    <span className="font-medium text-purple-900">📝 Special Instructions:</span>
                    <p className="text-purple-900 mt-1 whitespace-pre-line">{welfareCheckInfo.specialInstructions}</p>
                  </div>
                )}

                {/* Risk Flags */}
                <div className="flex gap-2 flex-wrap">
                  {welfareCheckInfo.fallRisk && (
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-sm font-medium">
                      ⚠️ Fall Risk
                    </span>
                  )}
                  {welfareCheckInfo.cognitiveImpairment && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm font-medium">
                      🧠 Cognitive Impairment
                    </span>
                  )}
                  {welfareCheckInfo.oxygenDependent && (
                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm font-medium">
                      🫁 Oxygen Dependent
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Emergency Contacts */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Emergency Contacts</h3>
              <div className="space-y-3">
                {welfareCheckInfo.emergencyContacts?.map((contact: any, i: number) => (
                  <div key={i} className="border-l-4 border-blue-500 pl-3">
                    <p className="font-medium text-gray-900">{contact.name}</p>
                    <p className="text-sm text-gray-600">{contact.relationship}</p>
                    <p className="text-sm font-mono text-blue-600">{contact.phone}</p>
                  </div>
                ))}

                {welfareCheckInfo.neighborInfo && (
                  <div className="border-l-4 border-green-500 pl-3 mt-4">
                    <p className="text-sm font-medium text-gray-700">Neighbor:</p>
                    <p className="font-medium text-gray-900">{welfareCheckInfo.neighborInfo.name}</p>
                    <p className="text-sm text-gray-600">{welfareCheckInfo.neighborInfo.address}</p>
                    <p className="text-sm font-mono text-green-600">{welfareCheckInfo.neighborInfo.phone}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex gap-3">
              <button className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 font-medium">
                📞 Call Emergency Contact
              </button>
              <button className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 font-medium">
                🚔 Dispatch to Location
              </button>
              <button className="flex-1 bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700 font-medium">
                ✅ Complete Welfare Check
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-lg font-medium">Select a senior from the list</p>
              <p className="text-sm mt-1">View complete welfare check information</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConstableDispatchDashboard;
