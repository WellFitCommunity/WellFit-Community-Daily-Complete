/**
 * SMART on FHIR App Management Panel (Orchestrator)
 *
 * Admin interface for registering and managing third-party healthcare apps
 * that connect to Envision Atlus via SMART on FHIR / OAuth2.
 *
 * Decomposed into sub-components:
 *   - SmartAppCard: individual app display
 *   - SmartAppRegistrationModal: create/edit modal (server-side secret gen)
 *   - SmartAppReviewModal: approval/rejection workflow
 *   - SmartAppManagement.types: shared types and constants
 *
 * Security: Client secrets are generated SERVER-SIDE via the
 * smart-register-app edge function. No crypto operations in browser.
 *
 * Compliance: 21st Century Cures Act, ONC Cures Act Final Rule
 *
 * Copyright 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, RefreshCw, XCircle, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

import type { SmartApp, SmartAppFormData } from './smart-app/SmartAppManagement.types';
import { emptyFormData } from './smart-app/SmartAppManagement.types';
import { SmartAppCard } from './smart-app/SmartAppCard';
import { SmartAppRegistrationModal } from './smart-app/SmartAppRegistrationModal';
import { SmartAppReviewModal } from './smart-app/SmartAppReviewModal';

const SmartAppManagementPanel: React.FC = () => {
  const [apps, setApps] = useState<SmartApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Registration/Edit modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<SmartApp | null>(null);
  const [initialFormData, setInitialFormData] = useState<SmartAppFormData>(emptyFormData);

  // Review modal
  const [reviewApp, setReviewApp] = useState<SmartApp | null>(null);

  const loadApps = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('smart_registered_apps')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setApps(data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load apps';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  const filteredApps = apps.filter((app) => {
    if (statusFilter !== 'all' && app.status !== statusFilter) return false;
    if (typeFilter !== 'all' && app.app_type !== typeFilter) return false;
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    return (
      app.client_name.toLowerCase().includes(query) ||
      app.client_id.toLowerCase().includes(query) ||
      app.developer_name?.toLowerCase().includes(query) ||
      app.developer_email?.toLowerCase().includes(query)
    );
  });

  // ---- Modal helpers ----

  const handleOpenModal = (app?: SmartApp) => {
    if (app) {
      setEditingApp(app);
      setInitialFormData({
        client_name: app.client_name,
        client_description: app.client_description || '',
        client_uri: app.client_uri || '',
        logo_uri: app.logo_uri || '',
        is_confidential: app.is_confidential,
        redirect_uris: app.redirect_uris.join('\n'),
        launch_uri: app.launch_uri || '',
        scopes_allowed: app.scopes_allowed,
        pkce_required: app.pkce_required,
        token_endpoint_auth_method: app.token_endpoint_auth_method,
        jwks_uri: app.jwks_uri || '',
        app_type: app.app_type,
        developer_name: app.developer_name || '',
        developer_email: app.developer_email || '',
        tos_uri: app.tos_uri || '',
        policy_uri: app.policy_uri || '',
      });
    } else {
      setEditingApp(null);
      setInitialFormData(emptyFormData);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingApp(null);
    setInitialFormData(emptyFormData);
  };

  // ---- Status change handlers ----

  const handleSuspend = async (app: SmartApp) => {
    if (!window.confirm(`Suspend "${app.client_name}"? This will prevent new authorizations.`)) {
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('smart_registered_apps')
        .update({ status: 'suspended' })
        .eq('id', app.id);

      if (updateError) throw updateError;

      setSuccessMessage(`${app.client_name} has been suspended`);
      await loadApps();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to suspend app';
      setError(message);
    }
  };

  const handleReactivate = async (app: SmartApp) => {
    try {
      const { error: updateError } = await supabase
        .from('smart_registered_apps')
        .update({ status: 'approved' })
        .eq('id', app.id);

      if (updateError) throw updateError;

      setSuccessMessage(`${app.client_name} has been reactivated`);
      await loadApps();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reactivate app';
      setError(message);
    }
  };

  const handleRevoke = async (app: SmartApp) => {
    if (!window.confirm(`Permanently revoke "${app.client_name}"? This will invalidate all tokens.`)) {
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('smart_registered_apps')
        .update({ status: 'revoked' })
        .eq('id', app.id);

      if (updateError) throw updateError;

      setSuccessMessage(`${app.client_name} has been revoked`);
      await loadApps();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to revoke app';
      setError(message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccessMessage('Copied to clipboard');
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  // ---- Render ----

  if (loading && apps.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">SMART on FHIR Apps</h2>
          <p className="text-sm text-gray-600">
            Manage third-party healthcare apps connecting via SMART on FHIR
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Register App
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)}>
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search apps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="suspended">Suspended</option>
          <option value="revoked">Revoked</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">All Types</option>
          <option value="patient">Patient Apps</option>
          <option value="provider">Provider Apps</option>
          <option value="system">System/Backend</option>
          <option value="research">Research Apps</option>
        </select>

        <button
          onClick={loadApps}
          className="p-2 text-gray-500 hover:text-gray-700"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-2xl font-semibold text-gray-900">
            {apps.filter((a) => a.status === 'approved').length}
          </div>
          <div className="text-sm text-gray-600">Approved Apps</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-2xl font-semibold text-yellow-600">
            {apps.filter((a) => a.status === 'pending').length}
          </div>
          <div className="text-sm text-gray-600">Pending Review</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-2xl font-semibold text-teal-600">
            {apps.reduce((sum, a) => sum + a.active_authorizations, 0)}
          </div>
          <div className="text-sm text-gray-600">Active Authorizations</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-2xl font-semibold text-gray-900">
            {apps.reduce((sum, a) => sum + a.total_authorizations, 0)}
          </div>
          <div className="text-sm text-gray-600">Total Authorizations</div>
        </div>
      </div>

      {/* Apps List */}
      <div className="space-y-4">
        {filteredApps.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No apps found</p>
            <button
              onClick={() => handleOpenModal()}
              className="mt-4 text-teal-600 hover:text-teal-700"
            >
              Register your first app
            </button>
          </div>
        ) : (
          filteredApps.map((app) => (
            <SmartAppCard
              key={app.id}
              app={app}
              onEdit={handleOpenModal}
              onReview={(a) => setReviewApp(a)}
              onSuspend={handleSuspend}
              onReactivate={handleReactivate}
              onRevoke={handleRevoke}
              onCopy={copyToClipboard}
            />
          ))
        )}
      </div>

      {/* Registration/Edit Modal */}
      {isModalOpen && (
        <SmartAppRegistrationModal
          editingApp={editingApp}
          initialFormData={initialFormData}
          onClose={handleCloseModal}
          onSaved={loadApps}
          onError={(msg) => setError(msg)}
          onSuccess={(msg) => setSuccessMessage(msg)}
        />
      )}

      {/* Review Modal */}
      {reviewApp && (
        <SmartAppReviewModal
          app={reviewApp}
          onClose={() => setReviewApp(null)}
          onDecision={loadApps}
          onError={(msg) => setError(msg)}
          onSuccess={(msg) => setSuccessMessage(msg)}
        />
      )}
    </div>
  );
};

export default SmartAppManagementPanel;
