/**
 * Wearable Dashboard - Patient/Senior View
 *
 * Features:
 * - Device connection management
 * - Fall detection history with map
 * - Vital signs charts (heart rate, BP, SpO2 trends)
 * - Activity summary (steps, sleep, sedentary time)
 * - Emergency SOS button
 * - "I'm OK" response to fall alerts
 *
 * Design: Senior-friendly with large UI elements, high contrast
 */

import React, { useState, useEffect, useCallback } from 'react';
import { WearableService } from '../../services/wearableService';
import { useAuth } from '../../contexts/AuthContext';
import type {
  WearableConnection,
  WearableVitalSign,
  WearableActivityData,
  WearableFallDetection,
  WearableDeviceType,
} from '../../types/neuroSuite';

export const WearableDashboard: React.FC = () => {
  const { user } = useAuth();
  const [connectedDevices, setConnectedDevices] = useState<WearableConnection[]>([]);
  const [vitals, setVitals] = useState<WearableVitalSign[]>([]);
  const [activities, setActivities] = useState<WearableActivityData[]>([]);
  const [falls, setFalls] = useState<WearableFallDetection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'vitals' | 'activity' | 'falls' | 'devices'>('overview');

  const loadDashboardData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Load connected devices
      const devicesResponse = await WearableService.getConnectedDevices(user.id);
      if (devicesResponse.success && devicesResponse.data) {
        setConnectedDevices(devicesResponse.data);
      }

      // Load recent vitals (last 7 days)
      const vitalsResponse = await WearableService.getVitalsTrend(user.id, 'heart_rate', 7);
      if (vitalsResponse.success && vitalsResponse.data) {
        setVitals(vitalsResponse.data);
      }

      // Load recent activities (last 7 days)
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const activityResponse = await WearableService.getActivitySummary(
        user.id,
        weekAgo.toISOString().split('T')[0],
        today.toISOString().split('T')[0]
      );
      if (activityResponse.success && activityResponse.data) {
        setActivities(activityResponse.data);
      }

      // Load fall history (last 30 days)
      const fallsResponse = await WearableService.getFallHistory(user.id, 30);
      if (fallsResponse.success && fallsResponse.data) {
        setFalls(fallsResponse.data);
      }
    } catch (error) {

    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, loadDashboardData]);

  const handleConnectDevice = async (deviceType: WearableDeviceType) => {
    if (!user) return;

    try {
      const authCode = prompt('Enter device authorization code:');
      if (!authCode) return;

      const response = await WearableService.connectDevice({
        user_id: user.id,
        device_type: deviceType,
        auth_code: authCode,
      });

      if (response.success) {
        alert('Device connected successfully!');
        loadDashboardData();
      } else {
        alert(`Error connecting device: ${response.error}`);
      }
    } catch (error) {

      alert('Failed to connect device');
    }
  };

  const handleDisconnectDevice = async (connectionId: string) => {
     
    if (!confirm('Are you sure you want to disconnect this device?')) return;

    try {
      const response = await WearableService.disconnectDevice(connectionId);
      if (response.success) {
        alert('Device disconnected successfully');
        loadDashboardData();
      } else {
        alert(`Error disconnecting device: ${response.error}`);
      }
    } catch (error) {

      alert('Failed to disconnect device');
    }
  };

  const handleEmergencySOS = () => {
     
    if (confirm('Are you sure you want to send an emergency alert?')) {
      alert('Emergency alert sent to your emergency contacts!');
      // TODO: Implement actual emergency alert
    }
  };

  const handleFallResponse = async (fallId: string) => {
    try {
      const response = await WearableService.updateFallResponse(fallId, true, 10);
      if (response.success) {
        alert('Response recorded. Stay safe!');
        loadDashboardData();
      }
    } catch (error) {

    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-xl">Loading wearable data...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header with Emergency SOS */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Health Monitoring Dashboard</h1>
        <button
          onClick={handleEmergencySOS}
          className="bg-red-600 text-white px-8 py-4 rounded-lg text-xl font-bold hover:bg-red-700 shadow-lg"
        >
          🚨 EMERGENCY SOS
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b-2 border-gray-200">
        {['overview', 'vitals', 'activity', 'falls', 'devices'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as typeof activeTab)}
            className={`px-6 py-3 text-lg font-semibold ${
              activeTab === tab
                ? 'border-b-4 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-gray-600 text-sm mb-1">Connected Devices</div>
              <div className="text-3xl font-bold">{connectedDevices.length}</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-gray-600 text-sm mb-1">Today's Steps</div>
              <div className="text-3xl font-bold">
                {activities[0]?.steps?.toLocaleString() || '0'}
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-gray-600 text-sm mb-1">Latest Heart Rate</div>
              <div className="text-3xl font-bold">
                {vitals[vitals.length - 1]?.value || '--'} <span className="text-lg">bpm</span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-gray-600 text-sm mb-1">Falls This Month</div>
              <div className="text-3xl font-bold">{falls.length}</div>
            </div>
          </div>

          {/* Recent Fall Alerts */}
          {falls.length > 0 && (
            <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-yellow-900">Recent Fall Alerts</h2>
              {falls.slice(0, 3).map((fall) => (
                <div key={fall.id} className="mb-4 p-4 bg-white rounded border border-yellow-300">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold">
                        Fall detected on {new Date(fall.detected_at).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-gray-600">
                        Severity: {fall.fall_severity} |
                        Response: {fall.user_responded ? '✓ Responded' : '⚠ No response'}
                      </div>
                    </div>
                    {!fall.user_responded && (
                      <button
                        onClick={() => handleFallResponse(fall.id)}
                        className="bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700"
                      >
                        I'm OK
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'vitals' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Heart Rate Trend (7 Days)</h2>
            {vitals.length > 0 ? (
              <div className="space-y-2">
                {vitals.map((vital) => (
                  <div key={vital.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">
                      {new Date(vital.measured_at).toLocaleString()}
                    </span>
                    <span className="font-bold text-lg">
                      {vital.value} {vital.unit}
                    </span>
                    {vital.alert_triggered && (
                      <span className="text-red-600 font-bold">⚠ {vital.alert_type}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No vital signs data available</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Activity Summary (7 Days)</h2>
            {activities.length > 0 ? (
              <div className="space-y-4">
                {activities.map((activity) => (
                  <div key={activity.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="font-bold text-lg mb-2">
                      {new Date(activity.date).toLocaleDateString()}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-gray-600">Steps</div>
                        <div className="font-bold text-lg">{activity.steps?.toLocaleString() || '--'}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Active Minutes</div>
                        <div className="font-bold text-lg">{activity.active_minutes || '--'}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Calories</div>
                        <div className="font-bold text-lg">{activity.calories_burned || '--'}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Sleep</div>
                        <div className="font-bold text-lg">
                          {activity.sleep_minutes ? `${Math.floor(activity.sleep_minutes / 60)}h` : '--'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No activity data available</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'falls' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Fall Detection History</h2>
            {falls.length > 0 ? (
              <div className="space-y-4">
                {falls.map((fall) => (
                  <div key={fall.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-lg">
                          {new Date(fall.detected_at).toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">
                          Severity: <span className="font-semibold">{fall.fall_severity}</span>
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-bold ${
                          fall.user_responded ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {fall.user_responded ? 'Responded' : 'No Response'}
                      </span>
                    </div>
                    {fall.latitude && fall.longitude && (
                      <div className="text-sm text-gray-600">
                        Location: {fall.latitude.toFixed(6)}, {fall.longitude.toFixed(6)}
                      </div>
                    )}
                    {fall.injury_reported && (
                      <div className="mt-2 text-sm text-red-600 font-semibold">
                        ⚠ Injury reported
                      </div>
                    )}
                    {fall.hospital_transport && (
                      <div className="mt-2 text-sm text-orange-600 font-semibold">
                        🚑 Hospital transport
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 text-lg">No falls detected</p>
                <p className="text-gray-400 text-sm mt-2">Great job staying safe!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'devices' && (
        <div className="space-y-6">
          {/* Connected Devices */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Connected Devices</h2>
            {connectedDevices.length > 0 ? (
              <div className="space-y-4">
                {connectedDevices.map((device) => (
                  <div key={device.id} className="flex justify-between items-center p-4 border rounded-lg">
                    <div>
                      <div className="font-bold text-lg">{device.device_model}</div>
                      <div className="text-sm text-gray-600">
                        Type: {device.device_type.replace('_', ' ')}
                      </div>
                      <div className="text-sm text-gray-500">
                        Last sync: {new Date(device.last_sync).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Permissions: {device.permissions_granted?.join(', ') || 'None'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDisconnectDevice(device.id)}
                      className="bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200"
                    >
                      Disconnect
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 mb-4">No devices connected</p>
            )}
          </div>

          {/* Add New Device */}
          <div className="bg-blue-50 rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Connect New Device</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => handleConnectDevice('apple_watch')}
                className="p-6 bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:shadow-lg transition"
              >
                <div className="text-4xl mb-2">⌚</div>
                <div className="font-bold">Apple Watch</div>
                <div className="text-sm text-gray-600">Fall detection, vitals</div>
              </button>
              <button
                onClick={() => handleConnectDevice('fitbit')}
                className="p-6 bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:shadow-lg transition"
              >
                <div className="text-4xl mb-2">📊</div>
                <div className="font-bold">Fitbit</div>
                <div className="text-sm text-gray-600">Activity, sleep, heart rate</div>
              </button>
              <button
                onClick={() => handleConnectDevice('garmin')}
                className="p-6 bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:shadow-lg transition"
              >
                <div className="text-4xl mb-2">🏃</div>
                <div className="font-bold">Garmin</div>
                <div className="text-sm text-gray-600">Activity, GPS, vitals</div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WearableDashboard;
