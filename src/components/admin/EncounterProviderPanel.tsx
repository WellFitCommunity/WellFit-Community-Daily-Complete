/**
 * EncounterProviderPanel - Manage Provider Assignments for Clinical Encounters
 *
 * Purpose: Display and manage provider assignments (attending, supervising,
 * referring, consulting) for a clinical encounter. Enforces that encounters
 * require an attending provider before advancing from draft.
 *
 * Used by: Encounter detail views, clinical workflows
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  UserPlus,
  UserMinus,
  Users,
  Shield,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  History,
  Stethoscope,
} from 'lucide-react';
import {
  EACard,
  EACardContent,
  EACardHeader,
  EAButton,
  EAAlert,
  EABadge,
} from '../envision-atlus';
import { encounterProviderService } from '../../services/encounterProviderService';
import { supabase } from '../../lib/supabaseClient';
import type {
  EncounterProviderRole,
  EncounterProviderWithDetails,
  EncounterProviderAudit,
} from '../../types/encounterProvider';
import { ROLE_DISPLAY, ENCOUNTER_PROVIDER_ROLES } from '../../types/encounterProvider';
import { isEditable } from '../../types/encounterStatus';
import type { EncounterStatus } from '../../types/encounterStatus';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';

// =============================================================================
// TYPES
// =============================================================================

interface EncounterProviderPanelProps {
  encounterId: string;
  encounterStatus: EncounterStatus;
  onProviderChange?: () => void;
  compact?: boolean;
}

interface AvailableProvider {
  id: string;
  npi: string;
  organization_name: string | null;
  taxonomy_code: string | null;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function RoleBadge({ role }: { role: EncounterProviderRole }) {
  const colorMap: Record<EncounterProviderRole, 'normal' | 'info' | 'neutral' | 'elevated'> = {
    attending: 'normal',
    supervising: 'info',
    referring: 'neutral',
    consulting: 'elevated',
  };
  return <EABadge variant={colorMap[role]} size="sm">{ROLE_DISPLAY[role].label}</EABadge>;
}

function ProviderRow({
  assignment,
  editable,
  onRemove,
  removing,
}: {
  assignment: EncounterProviderWithDetails;
  editable: boolean;
  onRemove: (id: string, role: EncounterProviderRole) => void;
  removing: boolean;
}) {
  const provider = assignment.provider;
  const displayName = provider.organization_name || `NPI: ${provider.npi}`;

  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white rounded-lg shadow-sm">
          <Stethoscope className="w-5 h-5 text-[var(--ea-primary,#00857a)]" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{displayName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <RoleBadge role={assignment.role} />
            {provider.taxonomy_code && (
              <span className="text-xs text-gray-500">{provider.taxonomy_code}</span>
            )}
          </div>
        </div>
      </div>
      {editable && (
        <EAButton
          variant="ghost"
          size="sm"
          onClick={() => onRemove(assignment.id, assignment.role)}
          disabled={removing}
        >
          <UserMinus className="w-4 h-4 text-red-500" />
        </EAButton>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const EncounterProviderPanel: React.FC<EncounterProviderPanelProps> = ({
  encounterId,
  encounterStatus,
  onProviderChange,
  compact = false,
}) => {
  useDashboardTheme();
  const [providers, setProviders] = useState<EncounterProviderWithDetails[]>([]);
  const [availableProviders, setAvailableProviders] = useState<AvailableProvider[]>([]);
  const [auditTrail, setAuditTrail] = useState<EncounterProviderAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [selectedRole, setSelectedRole] = useState<EncounterProviderRole>('attending');
  const [assignNotes, setAssignNotes] = useState('');
  const [removeReason, setRemoveReason] = useState('');
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [confirmRemoveRole, setConfirmRemoveRole] = useState<EncounterProviderRole | null>(null);

  const editable = isEditable(encounterStatus);
  const hasAttending = providers.some(p => p.role === 'attending');

  // ---- Data fetching ----

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await encounterProviderService.getEncounterProviders(encounterId);
    if (result.success) {
      setProviders(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [encounterId]);

  const fetchAvailableProviders = useCallback(async () => {
    const { data, error: fetchErr } = await supabase
      .from('billing_providers')
      .select('id, npi, organization_name, taxonomy_code')
      .order('organization_name');

    if (!fetchErr && data) {
      setAvailableProviders(data as AvailableProvider[]);
    }
  }, []);

  const fetchAuditTrail = useCallback(async () => {
    const result = await encounterProviderService.getProviderAuditTrail(encounterId);
    if (result.success) {
      setAuditTrail(result.data);
    }
  }, [encounterId]);

  useEffect(() => {
    fetchProviders();
    fetchAvailableProviders();
  }, [fetchProviders, fetchAvailableProviders]);

  // ---- Actions ----

  const handleAssign = async () => {
    if (!selectedProviderId) {
      setError('Please select a provider');
      return;
    }

    setAssigning(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('You must be logged in to assign providers');
      setAssigning(false);
      return;
    }

    const result = await encounterProviderService.assignProvider(
      encounterId,
      selectedProviderId,
      selectedRole,
      user.id,
      assignNotes || undefined
    );

    if (result.success) {
      setShowAssignForm(false);
      setSelectedProviderId('');
      setAssignNotes('');
      await fetchProviders();
      onProviderChange?.();
    } else {
      setError(result.error.message);
    }

    setAssigning(false);
  };

  const handleRemove = async () => {
    if (!confirmRemoveId) return;

    setRemoving(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('You must be logged in to remove providers');
      setRemoving(false);
      return;
    }

    const result = await encounterProviderService.removeProvider(
      confirmRemoveId,
      user.id,
      removeReason || undefined
    );

    if (result.success) {
      setConfirmRemoveId(null);
      setConfirmRemoveRole(null);
      setRemoveReason('');
      await fetchProviders();
      onProviderChange?.();
    } else {
      setError(result.error.message);
    }

    setRemoving(false);
  };

  const handleShowAudit = async () => {
    if (!showAuditTrail) {
      await fetchAuditTrail();
    }
    setShowAuditTrail(!showAuditTrail);
  };

  const startRemove = (assignmentId: string, role: EncounterProviderRole) => {
    setConfirmRemoveId(assignmentId);
    setConfirmRemoveRole(role);
    setRemoveReason('');
  };

  // ---- Loading state ----

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 p-4">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading providers...</span>
      </div>
    );
  }

  // ---- Compact mode ----

  if (compact) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        {hasAttending ? (
          <div className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2 py-1 rounded">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs font-medium">
              {providers.length} Provider{providers.length !== 1 ? 's' : ''} Assigned
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-red-600 bg-red-50 px-2 py-1 rounded">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-medium">No Attending Provider</span>
          </div>
        )}
        {providers.map(p => (
          <RoleBadge key={p.id} role={p.role} />
        ))}
      </div>
    );
  }

  // ---- Full panel ----

  // Filter out already-assigned providers for the dropdown
  const assignedProviderIds = new Set(providers.map(p => p.provider_id));
  const unassignedProviders = availableProviders.filter(p => !assignedProviderIds.has(p.id));

  return (
    <EACard aria-label="Encounter Provider Panel">
      <EACardHeader icon={<Users className="w-5 h-5" />} action={
        <div className="flex items-center gap-2">
          <EAButton variant="ghost" size="sm" onClick={handleShowAudit}>
            <History className="w-4 h-4 mr-1" />
            Audit
          </EAButton>
          {editable && (
            <EAButton variant="primary" size="sm" onClick={() => setShowAssignForm(!showAssignForm)}>
              <UserPlus className="w-4 h-4 mr-1" />
              Assign
            </EAButton>
          )}
        </div>
      }>
        Encounter Providers
      </EACardHeader>

      <EACardContent className="p-4 space-y-4">
        {/* Error */}
        {error && (
          <EAAlert variant="critical" dismissible onDismiss={() => setError(null)}>
            {error}
          </EAAlert>
        )}

        {/* Attending Warning */}
        {!hasAttending && (
          <EAAlert variant="warning">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                No attending provider assigned. An attending provider is required
                before this encounter can advance from draft.
              </span>
            </div>
          </EAAlert>
        )}

        {/* Read-only notice for finalized encounters */}
        {!editable && (
          <EAAlert variant="info">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 flex-shrink-0" />
              <span>
                This encounter is {encounterStatus}. Provider assignments are locked.
              </span>
            </div>
          </EAAlert>
        )}

        {/* Provider List */}
        {providers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No providers assigned to this encounter</p>
          </div>
        ) : (
          <div className="space-y-2">
            {providers.map(assignment => (
              <ProviderRow
                key={assignment.id}
                assignment={assignment}
                editable={editable}
                onRemove={startRemove}
                removing={removing}
              />
            ))}
          </div>
        )}

        {/* Remove Confirmation */}
        {confirmRemoveId && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h5 className="font-medium text-red-900">
                  Remove {confirmRemoveRole ? ROLE_DISPLAY[confirmRemoveRole].label : 'Provider'}?
                </h5>
                <p className="text-sm text-red-800 mt-1">
                  This will remove the provider from this encounter. The change is audited.
                </p>
                <label className="block mt-3">
                  <span className="text-sm text-red-800">Reason (optional)</span>
                  <input
                    type="text"
                    value={removeReason}
                    onChange={e => setRemoveReason(e.target.value)}
                    placeholder="Why is this provider being removed?"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm focus-visible:ring-red-500 focus-visible:border-red-500"
                  />
                </label>
                <div className="flex gap-2 mt-3">
                  <EAButton variant="secondary" size="sm" onClick={() => {
                    setConfirmRemoveId(null);
                    setConfirmRemoveRole(null);
                    setRemoveReason('');
                  }}>
                    Cancel
                  </EAButton>
                  <EAButton
                    variant="primary"
                    size="sm"
                    onClick={handleRemove}
                    disabled={removing}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {removing ? (
                      <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Removing...</>
                    ) : (
                      <><UserMinus className="w-4 h-4 mr-1" /> Remove</>
                    )}
                  </EAButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Assign Form */}
        {showAssignForm && editable && (
          <div className="p-4 bg-[var(--ea-primary,#00857a)]/5 border border-[var(--ea-primary,#00857a)]/20 rounded-lg">
            <h5 className="font-medium text-[var(--ea-primary,#00857a)] mb-3">New Provider Assignment</h5>
            <div className="space-y-3">
              {/* Provider Select */}
              <label className="block">
                <span className="text-sm text-[var(--ea-primary,#00857a)]">Provider</span>
                <select
                  value={selectedProviderId}
                  onChange={e => setSelectedProviderId(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm focus-visible:ring-[var(--ea-primary,#00857a)] focus-visible:border-[var(--ea-primary,#00857a)]"
                >
                  <option value="">Select a provider...</option>
                  {unassignedProviders.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.organization_name || `NPI: ${p.npi}`}
                      {p.taxonomy_code ? ` (${p.taxonomy_code})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              {/* Role Select */}
              <label className="block">
                <span className="text-sm text-[var(--ea-primary,#00857a)]">Role</span>
                <select
                  value={selectedRole}
                  onChange={e => setSelectedRole(e.target.value as EncounterProviderRole)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm focus-visible:ring-[var(--ea-primary,#00857a)] focus-visible:border-[var(--ea-primary,#00857a)]"
                >
                  {ENCOUNTER_PROVIDER_ROLES.map(role => (
                    <option key={role} value={role}>
                      {ROLE_DISPLAY[role].label}
                      {ROLE_DISPLAY[role].required ? ' (Required)' : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-[var(--ea-primary,#00857a)]">
                  {ROLE_DISPLAY[selectedRole].description}
                </p>
              </label>

              {/* Notes */}
              <label className="block">
                <span className="text-sm text-[var(--ea-primary,#00857a)]">Notes (optional)</span>
                <input
                  type="text"
                  value={assignNotes}
                  onChange={e => setAssignNotes(e.target.value)}
                  placeholder="Assignment notes..."
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm focus-visible:ring-[var(--ea-primary,#00857a)] focus-visible:border-[var(--ea-primary,#00857a)]"
                />
              </label>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <EAButton variant="secondary" size="sm" onClick={() => {
                  setShowAssignForm(false);
                  setSelectedProviderId('');
                  setAssignNotes('');
                }}>
                  Cancel
                </EAButton>
                <EAButton
                  variant="primary"
                  size="sm"
                  onClick={handleAssign}
                  disabled={assigning || !selectedProviderId}
                >
                  {assigning ? (
                    <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Assigning...</>
                  ) : (
                    <><CheckCircle className="w-4 h-4 mr-1" /> Assign Provider</>
                  )}
                </EAButton>
              </div>
            </div>
          </div>
        )}

        {/* Audit Trail */}
        {showAuditTrail && (
          <div className="border-t pt-4">
            <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <History className="w-4 h-4" />
              Assignment History
            </h5>
            {auditTrail.length === 0 ? (
              <p className="text-sm text-gray-500">No assignment history recorded</p>
            ) : (
              <div className="space-y-2">
                {auditTrail.map(entry => (
                  <div key={entry.id} className="flex items-start gap-3 text-sm py-2 border-b last:border-0">
                    <div className="text-xs text-gray-400 whitespace-nowrap mt-0.5">
                      {new Date(entry.changed_at).toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">
                        {entry.action === 'assigned' && 'Assigned'}
                        {entry.action === 'removed' && 'Removed'}
                        {entry.action === 'role_changed' && 'Role Changed'}
                      </span>
                      {' '}
                      <span className="text-gray-600">
                        as {ROLE_DISPLAY[entry.role]?.label ?? entry.role}
                      </span>
                      {entry.previous_role && (
                        <span className="text-gray-500">
                          {' '}(from {ROLE_DISPLAY[entry.previous_role]?.label ?? entry.previous_role})
                        </span>
                      )}
                      {entry.reason && (
                        <p className="text-xs text-gray-500 mt-0.5">Reason: {entry.reason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </EACardContent>
    </EACard>
  );
};

export default EncounterProviderPanel;
