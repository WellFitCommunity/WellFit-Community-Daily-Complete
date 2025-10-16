/**
 * PasskeySetup Component
 * Allows users to register biometric authentication (Touch ID, Face ID, Windows Hello, etc.)
 */

import React, { useState, useEffect } from 'react';
import { useSupabaseClient } from '../contexts/AuthContext';
import {
  isPasskeySupported,
  isPlatformAuthenticatorAvailable,
  registerPasskey,
  getUserPasskeys,
  deletePasskey,
  type PasskeyCredential
} from '../services/passkeyService';

interface PasskeySetupProps {
  userId: string;
  userName: string;
  displayName: string;
  onSuccess?: () => void;
  className?: string;
}

export const PasskeySetup: React.FC<PasskeySetupProps> = ({
  userId,
  userName,
  displayName,
  onSuccess,
  className = ''
}) => {
  const [supported, setSupported] = useState(false);
  const [platformAvailable, setPlatformAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [credentials, setCredentials] = useState<PasskeyCredential[]>([]);
  const [deviceName, setDeviceName] = useState('');

  // Check browser support
  useEffect(() => {
    const checkSupport = async () => {
      const isSupported = isPasskeySupported();
      setSupported(isSupported);

      if (isSupported) {
        const platformAuth = await isPlatformAuthenticatorAvailable();
        setPlatformAvailable(platformAuth);
      }
    };

    checkSupport();
    loadCredentials();
  }, []);

  // Load existing credentials
  const loadCredentials = async () => {
    try {
      const creds = await getUserPasskeys();
      setCredentials(creds);
    } catch (err: any) {
      console.error('Failed to load credentials:', err);
    }
  };

  // Register new passkey
  const handleRegister = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await registerPasskey(
        userId,
        userName,
        displayName,
        deviceName || undefined,
        true // Prefer platform authenticator
      );

      setSuccess('Biometric authentication registered successfully!');
      setDeviceName('');
      await loadCredentials();

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Registration failed:', err);
      setError(err.message || 'Failed to register biometric authentication');
    } finally {
      setLoading(false);
    }
  };

  // Delete credential
  const handleDelete = async (credentialId: string) => {
    if (!window.confirm('Are you sure you want to remove this biometric authentication?')) {
      return;
    }

    try {
      await deletePasskey(credentialId);
      setSuccess('Biometric authentication removed');
      await loadCredentials();
    } catch (err: any) {
      console.error('Delete failed:', err);
      setError(err.message || 'Failed to remove biometric authentication');
    }
  };

  // Get friendly device icon
  const getDeviceIcon = (authenticatorType: string | null) => {
    if (authenticatorType === 'platform') {
      const ua = navigator.userAgent;
      if (ua.includes('iPhone') || ua.includes('iPad')) return '📱';
      if (ua.includes('Mac')) return '💻';
      if (ua.includes('Windows')) return '🖥️';
      if (ua.includes('Android')) return '📱';
      return '🔐';
    }
    return '🔑'; // Security key
  };

  if (!supported) {
    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-start">
          <span className="text-2xl mr-3">⚠️</span>
          <div>
            <h3 className="font-medium text-yellow-900">Biometric Login Not Available</h3>
            <p className="text-sm text-yellow-800 mt-1">
              Your browser doesn't support passkeys. Please use a modern browser like Chrome, Safari, or Edge.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <span className="mr-2">🔐</span>
          Biometric Authentication
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          {platformAvailable
            ? 'Use your fingerprint, face, or device PIN for quick and secure login'
            : 'Add a security key for passwordless authentication'}
        </p>
      </div>

      <div className="p-6">
        {/* Error/Success Messages */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {/* Existing Credentials */}
        {credentials.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Your Biometric Devices</h4>
            <div className="space-y-2">
              {credentials.map((cred) => (
                <div
                  key={cred.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">
                      {getDeviceIcon(cred.authenticator_type)}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {cred.device_name || 'Unknown Device'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {cred.last_used_at
                          ? `Last used: ${new Date(cred.last_used_at).toLocaleDateString()}`
                          : `Added: ${new Date(cred.created_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(cred.credential_id)}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New Credential */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Device Name (Optional)
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder={
                platformAvailable
                  ? 'e.g., My iPhone, My MacBook'
                  : 'e.g., YubiKey, Security Key'
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Setting up...
              </>
            ) : (
              <>
                <span className="mr-2">➕</span>
                Add Biometric Authentication
              </>
            )}
          </button>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-blue-800">
              <strong>How it works:</strong> After adding biometric authentication, you can log in
              using your {platformAvailable ? 'fingerprint, face, or device PIN' : 'security key'} instead of
              your password. This is more secure and convenient!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasskeySetup;
