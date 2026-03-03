/**
 * PriorAuthDashboard — Main Shell + View Routing
 *
 * CMS-0057-F compliant prior authorization dashboard for admin/billing staff.
 * Manages state, data loading, and delegates rendering to sub-components.
 *
 * Used by: /admin/prior-auth route (via barrel index.tsx)
 * Data source: PriorAuthorizationService (src/services/fhir/prior-auth/)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { PriorAuthorizationService } from '../../../services/fhir/prior-auth';
import type {
  PriorAuthorization,
  PriorAuthStatistics,
} from '../../../services/fhir/prior-auth';
import { auditLogger } from '../../../services/auditLogger';
import { useSupabaseClient, useUser } from '../../../contexts/AuthContext';
import {
  Clock,
  XCircle,
  AlertTriangle,
  Plus,
  RefreshCw,
  Shield,
} from 'lucide-react';
import type { ViewMode, CreateFormState } from './types';
import { INITIAL_FORM } from './types';
import { PriorAuthStatCards } from './PriorAuthStatCards';
import { PriorAuthCreateForm } from './PriorAuthCreateForm';
import { PriorAuthList } from './PriorAuthList';
import { PriorAuthDecisionModal } from './PriorAuthDecisionModal';
import { PriorAuthAppealModal } from './PriorAuthAppealModal';
import { PriorAuthFHIRExport } from './PriorAuthFHIRExport';
import { usePriorAuthMCP } from '../../../hooks/usePriorAuthMCP';
import type { PriorAuthDecision, PriorAuthAppeal } from '../../../services/mcp/mcpPriorAuthClient';

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
  const [decisionModalAuthId, setDecisionModalAuthId] = useState<string | null>(null);
  const [appealModalAuthId, setAppealModalAuthId] = useState<string | null>(null);
  const [fhirExportAuthId, setFhirExportAuthId] = useState<string | null>(null);
  const { recordDecision, createAppeal, exportToFHIR, isLoading: mcpLoading } = usePriorAuthMCP();

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

      const { data: allData, error: allErr } = await supabase
        .from('prior_authorizations')
        .select('id, patient_id, encounter_id, claim_id, ordering_provider_npi, rendering_provider_npi, facility_npi, payer_id, payer_name, member_id, group_number, auth_number, reference_number, trace_number, service_type_code, service_type_description, service_codes, diagnosis_codes, date_of_service, service_start_date, service_end_date, submitted_at, decision_due_at, approved_at, expires_at, status, urgency, clinical_notes, clinical_summary, documentation_submitted, requested_units, approved_units, unit_type, fhir_resource_id, fhir_resource_version, lcd_references, ncd_references, response_time_hours, sla_met, created_by, updated_by, created_at, updated_at, tenant_id')
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

  // MCP: Record payer decision
  const handleRecordDecision = async (decision: PriorAuthDecision) => {
    const result = await recordDecision(decision);
    if (result) {
      setDecisionModalAuthId(null);
      await loadData();
    }
  };

  // MCP: Create appeal
  const handleCreateAppeal = async (appeal: PriorAuthAppeal) => {
    const result = await createAppeal(appeal);
    if (result) {
      setAppealModalAuthId(null);
      await loadData();
    }
  };

  // Filtered list
  const filteredAuths = statusFilter === 'all'
    ? auths
    : auths.filter(a => a.status === statusFilter);

  // Loading state
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
      {stats && <PriorAuthStatCards stats={stats} />}

      {/* Main content: list or create form */}
      {viewMode === 'create' ? (
        <PriorAuthCreateForm
          form={form}
          setForm={setForm}
          onSubmit={handleCreate}
          submitting={submitting}
        />
      ) : (
        <PriorAuthList
          auths={filteredAuths}
          statusFilter={statusFilter}
          onFilterChange={setStatusFilter}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onRecordDecision={id => setDecisionModalAuthId(id)}
          onAppeal={id => setAppealModalAuthId(id)}
          onExportFHIR={id => setFhirExportAuthId(id)}
        />
      )}

      {/* Decision Modal */}
      {decisionModalAuthId && (
        <PriorAuthDecisionModal
          priorAuthId={decisionModalAuthId}
          onSubmit={handleRecordDecision}
          onClose={() => setDecisionModalAuthId(null)}
          submitting={mcpLoading}
        />
      )}

      {/* Appeal Modal */}
      {appealModalAuthId && (
        <PriorAuthAppealModal
          priorAuthId={appealModalAuthId}
          onSubmit={handleCreateAppeal}
          onClose={() => setAppealModalAuthId(null)}
          submitting={mcpLoading}
        />
      )}

      {/* FHIR Export Modal */}
      {fhirExportAuthId && (
        <PriorAuthFHIRExport
          priorAuthId={fhirExportAuthId}
          onExport={exportToFHIR}
          onClose={() => setFhirExportAuthId(null)}
        />
      )}
    </div>
  );
};

export default PriorAuthDashboard;
