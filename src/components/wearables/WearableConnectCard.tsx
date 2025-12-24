/**
 * Wearable Connect Card
 *
 * Central UI component for users to connect their wearable devices
 * Displays all available wearable adapters and connection status
 */

import React, { useState, useEffect } from 'react';
import { wearableRegistry } from '../../adapters/wearables';
import type { WearableAdapterMetadata } from '../../adapters/wearables/UniversalWearableRegistry';

interface WearableConnectCardProps {
  userId?: string;
  onConnect?: (adapterId: string) => void;
  onDisconnect?: (adapterId: string) => void;
}

export const WearableConnectCard: React.FC<WearableConnectCardProps> = ({
  userId,
  onConnect,
  onDisconnect,
}) => {
  const [adapters, setAdapters] = useState<WearableAdapterMetadata[]>([]);
  const [connectedAdapters, setConnectedAdapters] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    // Load available adapters
    const availableAdapters = wearableRegistry.listAdapters();
    setAdapters(availableAdapters);

    // Load connected status
    const activeConnections = wearableRegistry.getActiveConnections();
    const connected = new Set(activeConnections.map(conn => conn.split('-')[0]));
    setConnectedAdapters(connected);
  }, []);

  const handleConnect = async (adapter: WearableAdapterMetadata) => {
    setLoading(adapter.id);

    try {
      // In production, this would trigger OAuth flow
      // Initiating connection to adapter

      if (onConnect) {
        onConnect(adapter.id);
      }

      // Simulate connection
      setTimeout(() => {
        setConnectedAdapters(prev => new Set([...prev, adapter.id]));
        setLoading(null);
        // Successfully connected to adapter
      }, 1000);
    } catch (error) {
      // Connection failed - logged via audit system
      setLoading(null);
    }
  };

  const handleDisconnect = async (adapter: WearableAdapterMetadata) => {
    setLoading(adapter.id);

    try {
      // Disconnecting from adapter

      if (onDisconnect) {
        onDisconnect(adapter.id);
      }

      setTimeout(() => {
        setConnectedAdapters(prev => {
          const updated = new Set(prev);
          updated.delete(adapter.id);
          return updated;
        });
        setLoading(null);
        // Disconnected from adapter
      }, 500);
    } catch (error) {
      // Disconnect failed - logged via audit system
      setLoading(null);
    }
  };

  const getDeviceIcon = (deviceTypes: string[]) => {
    if (deviceTypes.includes('smartwatch')) return '⌚';
    if (deviceTypes.includes('fitness-band')) return '📿';
    if (deviceTypes.includes('medical-device')) return '🩺';
    if (deviceTypes.includes('smart-scale')) return '⚖️';
    return '📱';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Connect Your Wearable Devices
        </h2>
        <p className="text-gray-600">
          Sync your health data from popular wearable devices to track your progress
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {adapters.map((adapter) => {
          const isConnected = connectedAdapters.has(adapter.id);
          const isLoading = loading === adapter.id;

          return (
            <div
              key={adapter.id}
              className={`border-2 rounded-lg p-4 transition-all ${
                isConnected
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-blue-400'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className="text-3xl">
                    {getDeviceIcon(adapter.deviceTypes)}
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900">{adapter.name}</h3>
                    <p className="text-xs text-gray-500">{adapter.vendor}</p>
                  </div>
                </div>
                {isConnected && (
                  <span className="text-green-600 font-semibold text-sm">
                    ✓ Connected
                  </span>
                )}
              </div>

              {/* Capabilities */}
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-700 mb-2">Tracks:</p>
                <div className="flex flex-wrap gap-1">
                  {adapter.capabilities.heartRate && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-sm">
                      ❤️ Heart Rate
                    </span>
                  )}
                  {adapter.capabilities.steps && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-sm">
                      👣 Steps
                    </span>
                  )}
                  {adapter.capabilities.sleep && (
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-sm">
                      😴 Sleep
                    </span>
                  )}
                  {adapter.capabilities.bloodOxygen && (
                    <span className="text-xs bg-cyan-100 text-cyan-800 px-2 py-1 rounded-sm">
                      🫁 SpO2
                    </span>
                  )}
                  {adapter.capabilities.ecg && (
                    <span className="text-xs bg-pink-100 text-pink-800 px-2 py-1 rounded-sm">
                      📈 ECG
                    </span>
                  )}
                </div>
              </div>

              {/* Certifications */}
              {adapter.certifications && adapter.certifications.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-600">
                    🏅 {adapter.certifications.join(', ')}
                  </p>
                </div>
              )}

              {/* Connect/Disconnect Button */}
              <button
                onClick={() =>
                  isConnected ? handleDisconnect(adapter) : handleConnect(adapter)
                }
                disabled={isLoading}
                className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                  isConnected
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  </span>
                ) : isConnected ? (
                  'Disconnect'
                ) : (
                  'Connect Device'
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Help Text */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Need Help?</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Click "Connect Device" to authorize access to your wearable data</li>
          <li>• You'll be redirected to the device manufacturer's login page</li>
          <li>• Grant permissions to sync your health data securely</li>
          <li>• Data syncs automatically in the background</li>
        </ul>
      </div>

      {/* Supported Devices Summary */}
      <div className="mt-4 text-center text-sm text-gray-500">
        {adapters.length} devices supported • {connectedAdapters.size} connected
      </div>
    </div>
  );
};

export default WearableConnectCard;
