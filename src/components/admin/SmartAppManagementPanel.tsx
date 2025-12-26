/**
 * SMART on FHIR App Management Panel
 *
 * Admin interface for registering and managing third-party healthcare apps
 * that connect to Envision Atlus via SMART on FHIR / OAuth2.
 *
 * Compliance: 21st Century Cures Act, ONC Cures Act Final Rule
 *
 * Copyright 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Shield,
  Key,
  ExternalLink,
  AlertTriangle,
  Eye,
  EyeOff,
  Copy,
  Ban,
  Play,
  Users,
  Clock,
  Smartphone,
  Stethoscope,
  Server,
  FlaskConical,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

// Types
interface SmartApp {
  id: string;
  tenant_id: string | null;
  client_id: string;
  client_name: string;
  client_description: string | null;
  client_uri: string | null;
  logo_uri: string | null;
  client_secret_hash: string | null;
  is_confidential: boolean;
  redirect_uris: string[];
  launch_uri: string | null;
  scopes_allowed: string[];
  pkce_required: boolean;
  token_endpoint_auth_method: 'none' | 'client_secret_basic' | 'client_secret_post' | 'private_key_jwt';
  jwks_uri: string | null;
  app_type: 'patient' | 'provider' | 'system' | 'research';
  status: 'pending' | 'approved' | 'rejected' | 'suspended' | 'revoked';
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  developer_name: string | null;
  developer_email: string | null;
  tos_uri: string | null;
  policy_uri: string | null;
  total_authorizations: number;
  active_authorizations: number;
  last_authorization_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SmartAppFormData {
  client_name: string;
  client_description: string;
  client_uri: string;
  logo_uri: string;
  is_confidential: boolean;
  redirect_uris: string;
  launch_uri: string;
  scopes_allowed: string[];
  pkce_required: boolean;
  token_endpoint_auth_method: 'none' | 'client_secret_basic' | 'client_secret_post' | 'private_key_jwt';
  jwks_uri: string;
  app_type: 'patient' | 'provider' | 'system' | 'research';
  developer_name: string;
  developer_email: string;
  tos_uri: string;
  policy_uri: string;
}

const emptyFormData: SmartAppFormData = {
  client_name: '',
  client_description: '',
  client_uri: '',
  logo_uri: '',
  is_confidential: false,
  redirect_uris: '',
  launch_uri: '',
  scopes_allowed: ['patient/*.read', 'openid', 'fhirUser'],
  pkce_required: true,
  token_endpoint_auth_method: 'none',
  jwks_uri: '',
  app_type: 'patient',
  developer_name: '',
  developer_email: '',
  tos_uri: '',
  policy_uri: '',
};

// Available SMART scopes
const SMART_SCOPES = [
  { value: 'openid', label: 'OpenID Connect', description: 'Required for identity' },
  { value: 'fhirUser', label: 'FHIR User', description: 'Current user identity' },
  { value: 'profile', label: 'Profile', description: 'Basic user profile' },
  { value: 'patient/*.read', label: 'Patient Read All', description: 'Read all patient data' },
  { value: 'patient/*.write', label: 'Patient Write All', description: 'Write all patient data' },
  { value: 'patient/Observation.read', label: 'Observations', description: 'Read vitals and lab results' },
  { value: 'patient/Condition.read', label: 'Conditions', description: 'Read diagnoses' },
  { value: 'patient/MedicationRequest.read', label: 'Medications', description: 'Read prescriptions' },
  { value: 'patient/AllergyIntolerance.read', label: 'Allergies', description: 'Read allergies' },
  { value: 'patient/Immunization.read', label: 'Immunizations', description: 'Read vaccines' },
  { value: 'patient/Procedure.read', label: 'Procedures', description: 'Read procedures' },
  { value: 'patient/CarePlan.read', label: 'Care Plans', description: 'Read care plans' },
  { value: 'launch', label: 'EHR Launch', description: 'Support EHR launch context' },
  { value: 'offline_access', label: 'Offline Access', description: 'Refresh tokens for long-term access' },
];

// App type icons
const appTypeIcons: Record<string, React.ElementType> = {
  patient: Smartphone,
  provider: Stethoscope,
  system: Server,
  research: FlaskConical,
};

const appTypeLabels: Record<string, string> = {
  patient: 'Patient App',
  provider: 'Provider App',
  system: 'System/Backend',
  research: 'Research App',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  suspended: 'bg-orange-100 text-orange-800',
  revoked: 'bg-gray-100 text-gray-800',
};

const SmartAppManagementPanel: React.FC = () => {
  const [apps, setApps] = useState<SmartApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<SmartApp | null>(null);
  const [formData, setFormData] = useState<SmartAppFormData>(emptyFormData);
  const [saving, setSaving] = useState(false);

  // Secret display state
  const [showSecret, setShowSecret] = useState(false);
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);

  // Approval modal
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<SmartApp | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

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

  const handleOpenModal = (app?: SmartApp) => {
    if (app) {
      setEditingApp(app);
      setFormData({
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
      setFormData(emptyFormData);
    }
    setGeneratedSecret(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingApp(null);
    setFormData(emptyFormData);
    setGeneratedSecret(null);
  };

  const generateClientId = (): string => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return 'ea_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const generateClientSecret = (): string => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes));
  };

  const hashSecret = async (secret: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(secret);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleSave = async () => {
    if (!formData.client_name.trim()) {
      setError('App name is required');
      return;
    }

    if (!formData.redirect_uris.trim()) {
      setError('At least one redirect URI is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const redirectUris = formData.redirect_uris
        .split('\n')
        .map(uri => uri.trim())
        .filter(uri => uri.length > 0);

      if (editingApp) {
        // Update existing app
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
        setSuccessMessage('App updated successfully');
      } else {
        // Create new app
        const clientId = generateClientId();
        let secretHash: string | null = null;
        let plainSecret: string | null = null;

        if (formData.is_confidential) {
          plainSecret = generateClientSecret();
          secretHash = await hashSecret(plainSecret);
          setGeneratedSecret(plainSecret);
        }

        const { error: insertError } = await supabase
          .from('smart_registered_apps')
          .insert({
            client_id: clientId,
            client_name: formData.client_name,
            client_description: formData.client_description || null,
            client_uri: formData.client_uri || null,
            logo_uri: formData.logo_uri || null,
            client_secret_hash: secretHash,
            is_confidential: formData.is_confidential,
            redirect_uris: redirectUris,
            launch_uri: formData.launch_uri || null,
            scopes_allowed: formData.scopes_allowed,
            pkce_required: formData.pkce_required,
            token_endpoint_auth_method: formData.is_confidential ? 'client_secret_basic' : 'none',
            jwks_uri: formData.jwks_uri || null,
            app_type: formData.app_type,
            status: 'pending',
            developer_name: formData.developer_name || null,
            developer_email: formData.developer_email || null,
            tos_uri: formData.tos_uri || null,
            policy_uri: formData.policy_uri || null,
          });

        if (insertError) throw insertError;

        if (plainSecret) {
          setSuccessMessage('App created! Save the client secret - it cannot be retrieved later.');
        } else {
          setSuccessMessage('App created successfully');
          handleCloseModal();
        }
      }

      await loadApps();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save app';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedApp) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error: updateError } = await supabase
        .from('smart_registered_apps')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
          rejection_reason: null,
        })
        .eq('id', selectedApp.id);

      if (updateError) throw updateError;

      setSuccessMessage(`${selectedApp.client_name} has been approved`);
      setApprovalModalOpen(false);
      setSelectedApp(null);
      await loadApps();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to approve app';
      setError(message);
    }
  };

  const handleReject = async () => {
    if (!selectedApp || !rejectionReason.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error: updateError } = await supabase
        .from('smart_registered_apps')
        .update({
          status: 'rejected',
          approved_by: user?.id,
          rejection_reason: rejectionReason,
        })
        .eq('id', selectedApp.id);

      if (updateError) throw updateError;

      setSuccessMessage(`${selectedApp.client_name} has been rejected`);
      setApprovalModalOpen(false);
      setSelectedApp(null);
      setRejectionReason('');
      await loadApps();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reject app';
      setError(message);
    }
  };

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
            {apps.filter(a => a.status === 'approved').length}
          </div>
          <div className="text-sm text-gray-600">Approved Apps</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-2xl font-semibold text-yellow-600">
            {apps.filter(a => a.status === 'pending').length}
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
          filteredApps.map((app) => {
            const Icon = appTypeIcons[app.app_type] || Smartphone;
            return (
              <div
                key={app.id}
                className={`bg-white border rounded-lg p-4 ${
                  app.status === 'revoked' ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <Icon className="w-6 h-6 text-gray-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{app.client_name}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[app.status]}`}>
                          {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                        </span>
                        {app.is_confidential && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                            Confidential
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {app.client_description || 'No description'}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Key className="w-3 h-3" />
                          {app.client_id}
                          <button
                            onClick={() => copyToClipboard(app.client_id)}
                            className="ml-1 text-gray-400 hover:text-gray-600"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {app.active_authorizations} active / {app.total_authorizations} total
                        </span>
                        {app.last_authorization_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last auth: {new Date(app.last_authorization_at).toLocaleDateString()}
                          </span>
                        )}
                        {app.client_uri && (
                          <a
                            href={app.client_uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-teal-600 hover:text-teal-700"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Website
                          </a>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-gray-400">
                        {appTypeLabels[app.app_type]}
                        {app.developer_email && ` • ${app.developer_email}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {app.status === 'pending' && (
                      <button
                        onClick={() => {
                          setSelectedApp(app);
                          setApprovalModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                      >
                        Review
                      </button>
                    )}
                    {app.status === 'approved' && (
                      <button
                        onClick={() => handleSuspend(app)}
                        className="p-2 text-gray-400 hover:text-orange-600"
                        title="Suspend"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    )}
                    {app.status === 'suspended' && (
                      <button
                        onClick={() => handleReactivate(app)}
                        className="p-2 text-gray-400 hover:text-green-600"
                        title="Reactivate"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenModal(app)}
                      className="p-2 text-gray-400 hover:text-blue-600"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {app.status !== 'revoked' && (
                      <button
                        onClick={() => handleRevoke(app)}
                        className="p-2 text-gray-400 hover:text-red-600"
                        title="Revoke"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Rejection reason */}
                {app.status === 'rejected' && app.rejection_reason && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                    <div className="flex items-center gap-2 text-red-700 text-sm">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="font-medium">Rejection Reason:</span>
                    </div>
                    <p className="text-red-600 text-sm mt-1">{app.rejection_reason}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Registration/Edit Modal */}
      {isModalOpen && (
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      App Name *
                    </label>
                    <input
                      type="text"
                      value={formData.client_name}
                      onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder="My Health App"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.client_description}
                      onChange={(e) => setFormData({ ...formData, client_description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder="Brief description of what your app does..."
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      App Type
                    </label>
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
                      placeholder="https://myapp.com/callback&#10;http://localhost:3000/callback"
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
                            setFormData({ ...formData, scopes_allowed: formData.scopes_allowed.filter(s => s !== scope.value) });
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Developer Name
                    </label>
                    <input
                      type="text"
                      value={formData.developer_name}
                      onChange={(e) => setFormData({ ...formData, developer_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Developer Email
                    </label>
                    <input
                      type="email"
                      value={formData.developer_email}
                      onChange={(e) => setFormData({ ...formData, developer_email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Website URL
                    </label>
                    <input
                      type="url"
                      value={formData.client_uri}
                      onChange={(e) => setFormData({ ...formData, client_uri: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder="https://myapp.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Logo URL
                    </label>
                    <input
                      type="url"
                      value={formData.logo_uri}
                      onChange={(e) => setFormData({ ...formData, logo_uri: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder="https://myapp.com/logo.png"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Terms of Service URL
                    </label>
                    <input
                      type="url"
                      value={formData.tos_uri}
                      onChange={(e) => setFormData({ ...formData, tos_uri: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Privacy Policy URL
                    </label>
                    <input
                      type="url"
                      value={formData.policy_uri}
                      onChange={(e) => setFormData({ ...formData, policy_uri: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={handleCloseModal}
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
      )}

      {/* Approval Modal */}
      {approvalModalOpen && selectedApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Review App: {selectedApp.client_name}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium">{appTypeLabels[selectedApp.app_type]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Developer:</span>
                  <span className="font-medium">{selectedApp.developer_email || 'Not provided'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Confidential:</span>
                  <span className="font-medium">{selectedApp.is_confidential ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">PKCE Required:</span>
                  <span className="font-medium">{selectedApp.pkce_required ? 'Yes' : 'No'}</span>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Requested Scopes:</h4>
                <div className="flex flex-wrap gap-1">
                  {selectedApp.scopes_allowed.map((scope) => (
                    <span key={scope} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                      {scope}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Redirect URIs:</h4>
                <div className="bg-gray-50 rounded p-2 font-mono text-xs">
                  {selectedApp.redirect_uris.map((uri, i) => (
                    <div key={i}>{uri}</div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rejection Reason (if rejecting)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="Reason for rejection..."
                  rows={2}
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setApprovalModalOpen(false);
                  setSelectedApp(null);
                  setRejectionReason('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Reject
              </button>
              <button
                onClick={handleApprove}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartAppManagementPanel;
