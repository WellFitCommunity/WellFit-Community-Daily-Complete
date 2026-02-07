/**
 * SmartAppRegistrationModal - Create/Edit SMART app modal
 *
 * Handles both new app registration (via server-side edge function)
 * and editing existing app metadata.
 *
 * Security: For new confidential apps, client_id and client_secret are
 * generated SERVER-SIDE by the smart-register-app edge function.
 * The secret is displayed once in this modal, then never again.
 */

import React, { useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Copy } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import type { SmartApp, SmartAppFormData } from './SmartAppManagement.types';
import { SMART_SCOPES } from './SmartAppManagement.types';

interface SmartAppRegistrationModalProps {
  editingApp: SmartApp | null;
  initialFormData: SmartAppFormData;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export const SmartAppRegistrationModal: React.FC<SmartAppRegistrationModalProps> = ({
  editingApp,
  initialFormData,
  onClose,
  onSaved,
  onError,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<SmartAppFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    onSuccess('Copied to clipboard');
  };

  const handleSave = async () => {
    if (!formData.client_name.trim()) {
      onError('App name is required');
      return;
    }

    if (!formData.redirect_uris.trim()) {
      onError('At least one redirect URI is required');
      return;
    }

    setSaving(true);

    try {
      const redirectUris = formData.redirect_uris
        .split('\n')
        .map((uri) => uri.trim())
        .filter((uri) => uri.length > 0);

      if (editingApp) {
        // Update existing app (metadata only, no secret regeneration)
        const { error: updateError } = await supabase
          .from('smart_registered_apps')
          .update({
            client_name: formData.client_name,
            client_description: formData.client_description || null,
            client_uri: formData.client_uri || null,
            logo_uri: formData.logo_uri || null,
            is_confidential: formData.is_confidential,
            redirect_uris: redirectUris,
            launch_uri: formData.launch_uri || null,
            scopes_allowed: formData.scopes_allowed,
            pkce_required: formData.pkce_required,
            token_endpoint_auth_method: formData.token_endpoint_auth_method,
            jwks_uri: formData.jwks_uri || null,
            app_type: formData.app_type,
            developer_name: formData.developer_name || null,
            developer_email: formData.developer_email || null,
            tos_uri: formData.tos_uri || null,
            policy_uri: formData.policy_uri || null,
          })
          .eq('id', editingApp.id);

        if (updateError) throw updateError;
        onSuccess('App updated successfully');
        onSaved();
        onClose();
      } else {
        // Create new app via server-side edge function
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          onError('Session expired — please log in again');
          return;
        }

        const response = await supabase.functions.invoke('smart-register-app', {
          body: {
            client_name: formData.client_name,
            client_description: formData.client_description || undefined,
            client_uri: formData.client_uri || undefined,
            logo_uri: formData.logo_uri || undefined,
            is_confidential: formData.is_confidential,
            redirect_uris: redirectUris,
            launch_uri: formData.launch_uri || undefined,
            scopes_allowed: formData.scopes_allowed,
            pkce_required: formData.pkce_required,
            token_endpoint_auth_method: formData.is_confidential
              ? 'client_secret_basic'
              : 'none',
            jwks_uri: formData.jwks_uri || undefined,
            app_type: formData.app_type,
            developer_name: formData.developer_name || undefined,
            developer_email: formData.developer_email || undefined,
            tos_uri: formData.tos_uri || undefined,
            policy_uri: formData.policy_uri || undefined,
          },
        });

        if (response.error) {
          throw new Error(response.error.message || 'Registration failed');
        }

        const result = response.data as { client_secret?: string; message: string };

        if (result.client_secret) {
          setGeneratedSecret(result.client_secret);
          onSuccess('App created! Save the client secret — it cannot be retrieved later.');
          onSaved();
        } else {
          onSuccess('App created successfully');
          onSaved();
          onClose();
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save app';
      onError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {editingApp ? 'Edit App' : 'Register SMART App'}
          </h3>
        </div>

        <div className="p-6 space-y-6">
          {/* Generated Secret Alert */}
          {generatedSecret && (
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-800 font-medium">
                <AlertTriangle className="w-5 h-5" />
                Save Your Client Secret
              </div>
              <p className="text-sm text-yellow-700 mt-2">
                This secret will only be shown once. Copy it now!
              </p>
              <div className="mt-3 flex items-center gap-2 bg-white border rounded p-2">
                <code className="flex-1 text-sm font-mono">
                  {showSecret ? generatedSecret : '••••••••••••••••'}
                </code>
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => copyToClipboard(generatedSecret)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">App Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">App Name *</label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="My Health App"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.client_description}
                  onChange={(e) => setFormData({ ...formData, client_description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="Brief description of what your app does..."
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">App Type</label>
                <select
                  value={formData.app_type}
                  onChange={(e) => setFormData({ ...formData, app_type: e.target.value as SmartAppFormData['app_type'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  <option value="patient">Patient App</option>
                  <option value="provider">Provider App</option>
                  <option value="system">System/Backend</option>
                  <option value="research">Research App</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_confidential}
                    onChange={(e) => setFormData({ ...formData, is_confidential: e.target.checked })}
                    className="rounded-sm border-gray-300 text-teal-600 focus:ring-teal-500"
                    disabled={!!editingApp}
                  />
                  <span className="text-sm text-gray-700">Confidential Client</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.pkce_required}
                    onChange={(e) => setFormData({ ...formData, pkce_required: e.target.checked })}
                    className="rounded-sm border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm text-gray-700">PKCE Required</span>
                </label>
              </div>
            </div>
          </div>

          {/* OAuth Settings */}
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-gray-900">OAuth Settings</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Redirect URIs * <span className="text-gray-400">(one per line)</span>
                </label>
                <textarea
                  value={formData.redirect_uris}
                  onChange={(e) => setFormData({ ...formData, redirect_uris: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-mono text-sm"
                  placeholder={'https://myapp.com/callback\nhttp://localhost:3000/callback'}
                  rows={3}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Launch URI <span className="text-gray-400">(for EHR launch)</span>
                </label>
                <input
                  type="url"
                  value={formData.launch_uri}
                  onChange={(e) => setFormData({ ...formData, launch_uri: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="https://myapp.com/launch"
                />
              </div>
            </div>
          </div>

          {/* Scopes */}
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-gray-900">Allowed Scopes</h4>
            <div className="grid grid-cols-2 gap-2">
              {SMART_SCOPES.map((scope) => (
                <label key={scope.value} className="flex items-start gap-2 p-2 border rounded-lg hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={formData.scopes_allowed.includes(scope.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, scopes_allowed: [...formData.scopes_allowed, scope.value] });
                      } else {
                        setFormData({ ...formData, scopes_allowed: formData.scopes_allowed.filter((s) => s !== scope.value) });
                      }
                    }}
                    className="mt-1 rounded-sm border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-700">{scope.label}</div>
                    <div className="text-xs text-gray-500">{scope.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Developer Info */}
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-gray-900">Developer Contact</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Developer Name</label>
                <input type="text" value={formData.developer_name} onChange={(e) => setFormData({ ...formData, developer_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Developer Email</label>
                <input type="email" value={formData.developer_email} onChange={(e) => setFormData({ ...formData, developer_email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
                <input type="url" value={formData.client_uri} onChange={(e) => setFormData({ ...formData, client_uri: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" placeholder="https://myapp.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                <input type="url" value={formData.logo_uri} onChange={(e) => setFormData({ ...formData, logo_uri: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" placeholder="https://myapp.com/logo.png" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Terms of Service URL</label>
                <input type="url" value={formData.tos_uri} onChange={(e) => setFormData({ ...formData, tos_uri: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Privacy Policy URL</label>
                <input type="url" value={formData.policy_uri} onChange={(e) => setFormData({ ...formData, policy_uri: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {generatedSecret ? 'Done' : 'Cancel'}
          </button>
          {!generatedSecret && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingApp ? 'Update App' : 'Register App'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartAppRegistrationModal;
