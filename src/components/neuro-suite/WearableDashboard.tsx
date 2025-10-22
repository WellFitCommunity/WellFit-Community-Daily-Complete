/**
 * Wearable Dashboard
 * Senior citizen fall detection & health monitoring
 * Universal support: Apple Watch, Fitbit, Samsung, Garmin, all wearables
 */

import React, { useState, useEffect } from 'react';
import { Watch, Heart, Activity, MapPin, AlertTriangle, CheckCircle2, Phone } from 'lucide-react';
import { WearableService } from '../../services/wearableService';
import type {
  WearableConnection,
  WearableFallDetection,
  WearableVitalSign,
  WearableActivityData,
  WearableDeviceType,
} from '../../types/neuroSuite';

interface WearableDashboardProps {
  userId: string;
}

const WearableDashboard: React.FC<WearableDashboardProps> = ({ userId }) => {
  const [connectedDevices, setConnectedDevices] = useState<WearableConnection[]>([]);
  const [fallHistory, setFallHistory] = useState<WearableFallDetection[]>([]);
  const [recentVitals, setRecentVitals] = useState<WearableVitalSign[]>([]);
  const [todayActivity, setTodayActivity] = useState<WearableActivityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [userId]);

  const loadDashboardData = async () => {
    setLoading(true);

    // Load connected devices
    const devicesResponse = await WearableService.getConnectedDevices(userId);
    if (devicesResponse.success && devicesResponse.data) {
      setConnectedDevices(devicesResponse.data);
    }

    // Load fall history (last 30 days)
    const fallsResponse = await WearableService.getFallDetectionHistory(userId, 30);
    if (fallsResponse.success && fallsResponse.data) {
      setFallHistory(fallsResponse.data);
    }

    // Load recent vitals (last 7 days heart rate)
    const vitalsResponse = await WearableService.getVitalsTrend(userId, 'heart_rate', 7);
    if (vitalsResponse.success && vitalsResponse.data) {
      setRecentVitals(vitalsResponse.data);
    }

    // Load today's activity
    const today = new Date().toISOString().split('T')[0];
    const activityResponse = await WearableService.getActivitySummary(userId, today, today);
    if (activityResponse.success && activityResponse.data && activityResponse.data.length > 0) {
      setTodayActivity(activityResponse.data[0]);
    }

    setLoading(false);
  };

  const handleConfirmOkay = async (fallEventId: string) => {
    const response = await WearableService.updateFallResponse(fallEventId, true, 30);
    if (response.success) {
      alert("We're glad you're okay! Emergency contacts will not be notified.");
      loadDashboardData();
    }
  };

  const getDeviceIcon = (deviceType: WearableDeviceType) => {
    return <Watch className="w-6 h-6" />;
  };

  const getDeviceDisplayName = (deviceType: WearableDeviceType) => {
    const names: Record<WearableDeviceType, string> = {
      apple_watch: 'Apple Watch',
      fitbit: 'Fitbit',
      garmin: 'Garmin',
      samsung_health: 'Samsung Galaxy Watch',
      withings: 'Withings',
      empatica: 'Empatica',
      other: 'Wearable Device',
    };
    return names[deviceType] || 'Wearable Device';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-2xl text-gray-600">Loading your health data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Watch className="w-10 h-10 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">My Health Monitor</h1>
                <p className="text-gray-600">Fall Detection & Vital Signs Tracking</p>
              </div>
            </div>
            <button className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Emergency SOS
            </button>
          </div>
        </div>

        {/* Connected Devices */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Watch className="w-6 h-6 text-blue-600" />
            Connected Devices
          </h2>
          {connectedDevices.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No devices connected</p>
              <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                Connect Device
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {connectedDevices.map((device) => (
                <div key={device.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {getDeviceIcon(device.device_type)}
                      <div>
                        <div className="font-semibold">{getDeviceDisplayName(device.device_type)}</div>
                        {device.device_model && (
                          <div className="text-xs text-gray-500">{device.device_model}</div>
                        )}
                      </div>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="text-xs text-gray-500">
                    Last sync: {new Date(device.last_sync).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Today's Activity */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="w-6 h-6 text-green-600" />
              Today's Activity
            </h2>
            {todayActivity ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">{todayActivity.steps || 0}</div>
                  <div className="text-sm text-gray-600">Steps</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-3xl font-bold text-green-600">{todayActivity.active_minutes || 0}</div>
                  <div className="text-sm text-gray-600">Active Minutes</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-3xl font-bold text-purple-600">{todayActivity.sleep_minutes ? Math.round(todayActivity.sleep_minutes / 60) : 0}</div>
                  <div className="text-sm text-gray-600">Hours Sleep</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-3xl font-bold text-orange-600">{todayActivity.calories_burned || 0}</div>
                  <div className="text-sm text-gray-600">Calories</div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No activity data for today yet
              </div>
            )}
          </div>

          {/* Latest Vitals */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Heart className="w-6 h-6 text-red-600" />
              Latest Vitals
            </h2>
            {recentVitals.length > 0 ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-red-50 rounded-lg">
                  <span className="text-gray-700">Heart Rate</span>
                  <span className="text-2xl font-bold text-red-600">
                    {recentVitals[recentVitals.length - 1]?.value || '--'} bpm
                  </span>
                </div>
                <div className="text-xs text-gray-500 text-center">
                  Measured {new Date(recentVitals[recentVitals.length - 1]?.measured_at || '').toLocaleString()}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No vital signs recorded
              </div>
            )}
          </div>
        </div>

        {/* Fall Detection History */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
            Fall Detection History (Last 30 Days)
          </h2>
          {fallHistory.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-900">No Falls Detected</p>
              <p className="text-gray-600">Your wearable is monitoring your safety 24/7</p>
            </div>
          ) : (
            <div className="space-y-4">
              {fallHistory.map((fall) => (
                <div
                  key={fall.id}
                  className={`border-l-4 ${fall.user_responded ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'} p-4 rounded-lg`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                        <span className="font-semibold">Fall Detected</span>
                        {fall.fall_severity && (
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            fall.fall_severity === 'high' ? 'bg-red-200 text-red-800' :
                            fall.fall_severity === 'medium' ? 'bg-orange-200 text-orange-800' :
                            'bg-yellow-200 text-yellow-800'
                          }`}>
                            {fall.fall_severity} severity
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {new Date(fall.detected_at).toLocaleString()}
                      </div>
                      {fall.latitude && fall.longitude && (
                        <div className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                          <MapPin className="w-4 h-4" />
                          Location recorded
                        </div>
                      )}
                      <div className="mt-2">
                        {fall.user_responded ? (
                          <div className="flex items-center gap-2 text-green-700">
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="font-semibold">You confirmed you were okay</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleConfirmOkay(fall.id)}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700"
                          >
                            I'm Okay
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {fall.emergency_contact_notified && (
                    <div className="mt-2 text-sm text-gray-600">
                      ✓ Emergency contacts were notified
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Emergency Contacts */}
        <div className="mt-6 bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Phone className="w-8 h-8 text-red-600" />
            <div>
              <h3 className="text-lg font-bold text-gray-900">Emergency SOS</h3>
              <p className="text-sm text-gray-600">
                Press the Emergency SOS button on your device if you need immediate help
              </p>
            </div>
          </div>
          <div className="text-sm text-gray-700">
            Your emergency contacts will be automatically notified if:
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>A fall is detected and you don't respond within 60 seconds</li>
              <li>You manually trigger an emergency alert</li>
              <li>Abnormal vital signs are detected (very high/low heart rate, low oxygen)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WearableDashboard;
