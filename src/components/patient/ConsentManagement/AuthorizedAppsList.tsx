/**
 * AuthorizedAppsList - SMART on FHIR Connected Apps
 *
 * Displays third-party healthcare apps that the patient has authorized
 * to access their health data via SMART on FHIR.
 *
 * Compliance: 21st Century Cures Act, ONC Cures Act Final Rule
 */

import React, { useState, useEffect } from 'react';
import { Smartphone, ExternalLink, Shield, Trash2, Clock, AlertCircle } from 'lucide-react';

interface AuthorizedAppsListProps {
  userId: string;
  onCountUpdate?: (count: number) => void;
}

interface AuthorizedApp {
  id: string;
  app_id: string;
  app_name: string;
  app_description?: string;
  logo_uri?: string;
  scopes_granted: string[];
  authorized_at: string;
  last_access_at?: string;
  access_count: number;
  status: string;
}

const AuthorizedAppsList: React.FC<AuthorizedAppsListProps> = ({ userId, onCountUpdate }) => {
  const [apps, setApps] = useState<AuthorizedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    loadAuthorizedApps();
  }, [userId]);

  const loadAuthorizedApps = async () => {
    setLoading(true);
    try {
      const { supabase } = await import('../../../lib/supabaseClient');

      // Get SMART authorizations with app details
      const { data, error } = await supabase
        .from('smart_authorizations')
        .select(`
          id,
          scopes_granted,
          authorized_at,
          last_access_at,
          access_count,
          status,
          app:smart_registered_apps(
            id,
            client_name,
            client_description,
            logo_uri,
            client_uri
          )
        `)
        .eq('patient_id', userId)
        .eq('status', 'active')
        .order('authorized_at', { ascending: false });

      if (!error && data) {
        const mappedApps = data.map((auth: any) => ({
          id: auth.id,
          app_id: auth.app?.id || '',
          app_name: auth.app?.client_name || 'Unknown App',
          app_description: auth.app?.client_description,
          logo_uri: auth.app?.logo_uri,
          scopes_granted: auth.scopes_granted || [],
          authorized_at: auth.authorized_at,
          last_access_at: auth.last_access_at,
          access_count: auth.access_count || 0,
          status: auth.status,
        }));

        setApps(mappedApps);
        onCountUpdate?.(mappedApps.length);
      }
    } catch (err: unknown) {
      // Silent fail - will show empty state
    }
    setLoading(false);
  };

  const handleRevoke = async (authId: string, appName: string) => {
    if (!confirm(`Are you sure you want to revoke access for "${appName}"? The app will no longer be able to access your health data.`)) {
      return;
    }

    setRevoking(authId);
    try {
      const { supabase } = await import('../../../lib/supabaseClient');

      const { error } = await supabase
        .from('smart_authorizations')
        .update({
          status: 'revoked',
          revoked_at: new Date().toISOString(),
          revoked_reason: 'User initiated revocation',
        })
        .eq('id', authId);

      if (!error) {
        // Also invalidate any active tokens
        await supabase
          .from('smart_access_tokens')
          .update({ revoked: true, revoked_at: new Date().toISOString() })
          .eq('authorization_id', authId);

        loadAuthorizedApps();
      } else {
        alert('Failed to revoke access. Please try again.');
      }
    } catch (err: unknown) {
      alert('Failed to revoke access. Please try again.');
    }
    setRevoking(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(dateStr);
  };

  const getScopeDisplayName = (scope: string): string => {
    // Convert FHIR scopes to human-readable names
    const scopeMap: Record<string, string> = {
      'patient/Patient.read': 'Basic Info',
      'patient/MedicationRequest.read': 'Medications',
      'patient/AllergyIntolerance.read': 'Allergies',
      'patient/Condition.read': 'Conditions',
      'patient/Observation.read': 'Vitals & Labs',
      'patient/Immunization.read': 'Immunizations',
      'patient/Procedure.read': 'Procedures',
      'patient/CarePlan.read': 'Care Plans',
      'patient/DiagnosticReport.read': 'Lab Reports',
      'patient/*.read': 'All Health Data',
      'openid': 'Identity',
      'fhirUser': 'User Profile',
      'offline_access': 'Offline Access',
    };

    return scopeMap[scope] || scope.replace('patient/', '').replace('.read', '');
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-24 bg-gray-200 rounded-lg"></div>
        <div className="h-24 bg-gray-200 rounded-lg"></div>
        <div className="h-24 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="text-center py-12">
        <Smartphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Connected Apps</h3>
        <p className="text-gray-600 mb-4">
          You haven't authorized any third-party apps to access your health data.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
          <p className="text-sm text-blue-700">
            <strong>What are connected apps?</strong><br />
            Apps like Apple Health, fitness trackers, or care coordination apps
            can request access to your health records via SMART on FHIR.
            When you authorize an app, it will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Connected Apps</h3>
        <span className="text-sm text-gray-500">
          {apps.length} app{apps.length !== 1 ? 's' : ''} connected
        </span>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
          <p className="text-sm text-yellow-700">
            These apps can access your health data based on the permissions you granted.
            Revoke access anytime if you no longer use an app.
          </p>
        </div>
      </div>

      {apps.map((app) => (
        <div
          key={app.id}
          className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start">
              {/* App Icon */}
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mr-4">
                {app.logo_uri ? (
                  <img
                    src={app.logo_uri}
                    alt={app.app_name}
                    className="w-10 h-10 rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <Smartphone className="w-6 h-6 text-gray-400" />
                )}
              </div>

              {/* App Info */}
              <div className="flex-1">
                <div className="flex items-center">
                  <h4 className="font-medium text-gray-900">{app.app_name}</h4>
                  <a
                    href="#"
                    className="ml-2 text-gray-400 hover:text-gray-600"
                    title="View app details"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                {app.app_description && (
                  <p className="text-sm text-gray-600 mt-1">{app.app_description}</p>
                )}

                {/* Permissions */}
                <div className="mt-2">
                  <p className="text-xs text-gray-500 mb-1">Permissions:</p>
                  <div className="flex flex-wrap gap-1">
                    {app.scopes_granted.slice(0, 4).map((scope, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded"
                      >
                        {getScopeDisplayName(scope)}
                      </span>
                    ))}
                    {app.scopes_granted.length > 4 && (
                      <span className="text-xs text-gray-500">
                        +{app.scopes_granted.length - 4} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Access Stats */}
                <div className="mt-3 flex items-center text-xs text-gray-500 space-x-4">
                  <span className="flex items-center">
                    <Shield className="w-3 h-3 mr-1" />
                    Connected {formatDate(app.authorized_at)}
                  </span>
                  {app.last_access_at && (
                    <span className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      Last used {formatRelativeTime(app.last_access_at)}
                    </span>
                  )}
                  {app.access_count > 0 && (
                    <span>{app.access_count} data request{app.access_count !== 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Revoke Button */}
            <button
              onClick={() => handleRevoke(app.id, app.app_name)}
              disabled={revoking === app.id}
              className="flex items-center text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              {revoking === app.id ? 'Revoking...' : 'Revoke'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AuthorizedAppsList;
