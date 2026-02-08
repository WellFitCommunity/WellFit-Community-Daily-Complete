/**
 * PriorAuthDashboard - Prior Authorization Management Center
 *
 * CMS-0057-F compliant prior authorization dashboard for admin/billing staff.
 * Displays pending authorizations, statistics, deadline alerts, and supports
 * creating, submitting, and recording decisions on prior auth requests.
 *
 * Used by: /admin/prior-auth route
 * Data source: PriorAuthorizationService (src/services/fhir/prior-auth/)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { PriorAuthorizationService } from '../../services/fhir/prior-auth';
import type {
  PriorAuthorization,
  PriorAuthStatistics,
  PriorAuthStatus,
  PriorAuthUrgency,
} from '../../services/fhir/prior-auth';
import { auditLogger } from '../../services/auditLogger';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Send,
  Plus,
  RefreshCw,
  TrendingUp,
  Shield,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────
type ViewMode = 'list' | 'create';

interface CreateFormState {
  patient_id: string;
  payer_id: string;
  payer_name: string;
  service_codes: string;
  diagnosis_codes: string;
  urgency: PriorAuthUrgency;
  clinical_notes: string;
  date_of_service: string;
}

const INITIAL_FORM: CreateFormState = {
  patient_id: '',
  payer_id: '',
  payer_name: '',
  service_codes: '',
  diagnosis_codes: '',
  urgency: 'routine',
  clinical_notes: '',
  date_of_service: new Date().toISOString().split('T')[0],
};

// ─────────────────────────────────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'text-gray-700', bg: 'bg-gray-100' },
  pending_submission: { label: 'Pending Submission', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  submitted: { label: 'Submitted', color: 'text-blue-700', bg: 'bg-blue-100' },
  pending_review: { label: 'Pending Review', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  approved: { label: 'Approved', color: 'text-green-700', bg: 'bg-green-100' },
  denied: { label: 'Denied', color: 'text-red-700', bg: 'bg-red-100' },
  partial_approval: { label: 'Partial', color: 'text-orange-700', bg: 'bg-orange-100' },
  pending_additional_info: { label: 'Info Needed', color: 'text-purple-700', bg: 'bg-purple-100' },
  cancelled: { label: 'Cancelled', color: 'text-gray-500', bg: 'bg-gray-50' },
  expired: { label: 'Expired', color: 'text-red-500', bg: 'bg-red-50' },
  appealed: { label: 'Appealed', color: 'text-amber-700', bg: 'bg-amber-100' },
};

function StatusBadge({ status }: { status: PriorAuthStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function UrgencyBadge({ urgency }: { urgency: PriorAuthUrgency }) {
  const map: Record<PriorAuthUrgency, { label: string; cls: string }> = {
    stat: { label: 'STAT', cls: 'bg-red-600 text-white' },
    urgent: { label: 'Urgent', cls: 'bg-orange-500 text-white' },
    routine: { label: 'Routine', cls: 'bg-gray-200 text-gray-700' },
  };
  const cfg = map[urgency];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className={`rounded-xl border p-5 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        <div className="p-3 rounded-lg bg-white/50">{icon}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────
const PriorAuthDashboard: React.FC = () => {
  const user = useUser();
  const supabase = useSupabaseClient();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [auths, setAuths] = useState<PriorAuthorization[]>([]);
  const [stats, setStats] = useState<PriorAuthStatistics | null>(null);
  const [deadlineAuths, setDeadlineAuths] = useState<PriorAuthorization[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [form, setForm] = useState<CreateFormState>(INITIAL_FORM);

  // Resolve tenant on mount
  useEffect(() => {
    async function resolveTenant() {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();
      if (data?.tenant_id) setTenantId(data.tenant_id);
    }
    resolveTenant();
  }, [user?.id, supabase]);

  // Load data when tenant is resolved
  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);

    try {
      const [pendingRes, statsRes, deadlineRes] = await Promise.all([
        PriorAuthorizationService.getPending(tenantId),
        PriorAuthorizationService.getStatistics(tenantId),
        PriorAuthorizationService.getApproachingDeadline(tenantId, 48),
      ]);

      // Also load all auths for the full list view
      const { data: allData, error: allErr } = await supabase
        .from('prior_authorizations')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (allErr) throw allErr;
      setAuths((allData as PriorAuthorization[]) || []);

      if (statsRes.success && statsRes.data) setStats(statsRes.data);
      if (deadlineRes.success && deadlineRes.data) setDeadlineAuths(deadlineRes.data);
      if (pendingRes.success) {
        await auditLogger.info('PRIOR_AUTH_DASHBOARD_LOADED', {
          tenantId,
          pendingCount: pendingRes.data?.length || 0,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load prior authorizations';
      setError(msg);
      await auditLogger.error('PRIOR_AUTH_DASHBOARD_LOAD_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { tenantId }
      );
    } finally {
      setLoading(false);
    }
  }, [tenantId, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Create prior auth
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !user?.id) return;
    setSubmitting(true);
    setError(null);

    const result = await PriorAuthorizationService.create({
      patient_id: form.patient_id.trim(),
      payer_id: form.payer_id.trim(),
      payer_name: form.payer_name.trim() || undefined,
      service_codes: form.service_codes.split(',').map(c => c.trim()).filter(Boolean),
      diagnosis_codes: form.diagnosis_codes.split(',').map(c => c.trim()).filter(Boolean),
      urgency: form.urgency,
      clinical_notes: form.clinical_notes.trim() || undefined,
      date_of_service: form.date_of_service || undefined,
      tenant_id: tenantId,
      created_by: user.id,
    });

    setSubmitting(false);

    if (result.success) {
      setForm(INITIAL_FORM);
      setViewMode('list');
      await loadData();
    } else {
      setError(result.error || 'Failed to create prior authorization');
    }
  };

  // Submit a draft auth to payer
  const handleSubmit = async (authId: string) => {
    const result = await PriorAuthorizationService.submit({ id: authId, updated_by: user?.id });
    if (result.success) {
      await loadData();
    } else {
      setError(result.error || 'Failed to submit');
    }
  };

  // Cancel an auth
  const handleCancel = async (authId: string) => {
    const result = await PriorAuthorizationService.cancel(authId, 'Cancelled by admin', user?.id);
    if (result.success) {
      await loadData();
    } else {
      setError(result.error || 'Failed to cancel');
    }
  };

  // Filtered list
  const filteredAuths = statusFilter === 'all'
    ? auths
    : auths.filter(a => a.status === statusFilter);

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        <span className="ml-3 text-lg text-gray-600">Loading prior authorizations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-indigo-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Prior Authorization Center</h2>
            <p className="text-sm text-gray-500">CMS-0057-F Compliant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'create' : 'list')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            {viewMode === 'list' ? <><Plus className="w-4 h-4" /> New Request</> : 'Back to List'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-center gap-2">
          <XCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700 text-sm font-medium">Dismiss</button>
        </div>
      )}

      {/* Deadline alerts */}
      {deadlineAuths.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-amber-800">Approaching Deadlines ({deadlineAuths.length})</h3>
          </div>
          <ul className="space-y-1">
            {deadlineAuths.slice(0, 5).map(a => (
              <li key={a.id} className="text-sm text-amber-700 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                <span className="font-medium">{a.auth_number || a.id.slice(0, 8)}</span>
                <span>- {a.service_codes.join(', ')}</span>
                {a.decision_due_at && (
                  <span className="ml-auto text-xs">Due: {new Date(a.decision_due_at).toLocaleDateString()}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Submitted"
            value={stats.total_submitted}
            icon={<FileText className="w-6 h-6 text-blue-600" />}
            color="bg-blue-50 border-blue-200"
          />
          <StatCard
            label="Approval Rate"
            value={`${stats.approval_rate.toFixed(0)}%`}
            icon={<CheckCircle className="w-6 h-6 text-green-600" />}
            color="bg-green-50 border-green-200"
          />
          <StatCard
            label="Avg Response (hrs)"
            value={stats.avg_response_hours.toFixed(1)}
            icon={<Clock className="w-6 h-6 text-indigo-600" />}
            color="bg-indigo-50 border-indigo-200"
          />
          <StatCard
            label="SLA Compliance"
            value={`${stats.sla_compliance_rate.toFixed(0)}%`}
            icon={<TrendingUp className="w-6 h-6 text-emerald-600" />}
            color="bg-emerald-50 border-emerald-200"
          />
        </div>
      )}

      {/* Main content: list or create form */}
      {viewMode === 'create' ? (
        <CreateForm
          form={form}
          setForm={setForm}
          onSubmit={handleCreate}
          submitting={submitting}
        />
      ) : (
        <AuthList
          auths={filteredAuths}
          statusFilter={statusFilter}
          onFilterChange={setStatusFilter}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Create Form Sub-Component
// ─────────────────────────────────────────────────────────────────────
function CreateForm({ form, setForm, onSubmit, submitting }: {
  form: CreateFormState;
  setForm: React.Dispatch<React.SetStateAction<CreateFormState>>;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
}) {
  const updateField = (field: keyof CreateFormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl border p-6 space-y-5">
      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
        <Plus className="w-5 h-5 text-indigo-600" /> New Prior Authorization Request
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID *</label>
          <input
            type="text" required value={form.patient_id}
            onChange={e => updateField('patient_id', e.target.value)}
            className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base p-2.5 border"
            placeholder="Patient UUID"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payer ID *</label>
          <input
            type="text" required value={form.payer_id}
            onChange={e => updateField('payer_id', e.target.value)}
            className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base p-2.5 border"
            placeholder="Payer identifier"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payer Name</label>
          <input
            type="text" value={form.payer_name}
            onChange={e => updateField('payer_name', e.target.value)}
            className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base p-2.5 border"
            placeholder="e.g. Blue Cross Blue Shield"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date of Service</label>
          <input
            type="date" value={form.date_of_service}
            onChange={e => updateField('date_of_service', e.target.value)}
            className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base p-2.5 border"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Service Codes (CPT) *</label>
          <input
            type="text" required value={form.service_codes}
            onChange={e => updateField('service_codes', e.target.value)}
            className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base p-2.5 border"
            placeholder="99213, 99214 (comma-separated)"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis Codes (ICD-10) *</label>
          <input
            type="text" required value={form.diagnosis_codes}
            onChange={e => updateField('diagnosis_codes', e.target.value)}
            className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base p-2.5 border"
            placeholder="E11.9, I50.9 (comma-separated)"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
          <select
            value={form.urgency}
            onChange={e => updateField('urgency', e.target.value)}
            className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base p-2.5 border"
          >
            <option value="routine">Routine (7 days)</option>
            <option value="urgent">Urgent (72 hours)</option>
            <option value="stat">STAT (4 hours)</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Clinical Notes</label>
        <textarea
          value={form.clinical_notes}
          onChange={e => updateField('clinical_notes', e.target.value)}
          rows={3}
          className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base p-2.5 border"
          placeholder="Clinical justification for the requested services..."
        />
      </div>
      <div className="flex justify-end">
        <button
          type="submit" disabled={submitting}
          className="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 min-h-[44px]"
        >
          {submitting ? 'Creating...' : <><FileText className="w-5 h-5" /> Create Draft</>}
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Auth List Sub-Component
// ─────────────────────────────────────────────────────────────────────
function AuthList({ auths, statusFilter, onFilterChange, onSubmit, onCancel }: {
  auths: PriorAuthorization[];
  statusFilter: string;
  onFilterChange: (status: string) => void;
  onSubmit: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'pending_review', label: 'Pending Review' },
    { value: 'approved', label: 'Approved' },
    { value: 'denied', label: 'Denied' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="bg-white rounded-xl border">
      {/* Filter bar */}
      <div className="flex items-center gap-2 p-4 border-b overflow-x-auto">
        {filterOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => onFilterChange(opt.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
              statusFilter === opt.value
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {auths.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <FileText className="w-12 h-12 mb-3 text-gray-300" />
          <p className="text-lg font-medium">No prior authorizations found</p>
          <p className="text-sm">Create a new request to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">Auth #</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600">Urgency</th>
                <th className="px-4 py-3 font-medium text-gray-600">Service Codes</th>
                <th className="px-4 py-3 font-medium text-gray-600">Payer</th>
                <th className="px-4 py-3 font-medium text-gray-600">Created</th>
                <th className="px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {auths.map(auth => (
                <tr key={auth.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">
                    {auth.auth_number || auth.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={auth.status} /></td>
                  <td className="px-4 py-3"><UrgencyBadge urgency={auth.urgency} /></td>
                  <td className="px-4 py-3 text-gray-700">{auth.service_codes.join(', ')}</td>
                  <td className="px-4 py-3 text-gray-700">{auth.payer_name || auth.payer_id}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(auth.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {auth.status === 'draft' && (
                        <button
                          onClick={() => onSubmit(auth.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 min-h-[32px]"
                          title="Submit to payer"
                        >
                          <Send className="w-3.5 h-3.5" /> Submit
                        </button>
                      )}
                      {['draft', 'submitted', 'pending_review'].includes(auth.status) && (
                        <button
                          onClick={() => onCancel(auth.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded hover:bg-red-100 min-h-[32px]"
                          title="Cancel request"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default PriorAuthDashboard;
