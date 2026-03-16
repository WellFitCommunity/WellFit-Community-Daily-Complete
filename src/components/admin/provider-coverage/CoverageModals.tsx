/**
 * CoverageModals — Modal dialogs for ProviderCoverageDashboard
 *
 * Purpose: Cancel confirmation modal and Add Coverage Assignment modal.
 * Extracted to keep main dashboard file under 600 lines.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { EAButton, EAAlert } from '../../envision-atlus';
import { providerCoverageService } from '../../../services/providerCoverageService';
import type { CoverageReason } from '../../../services/providerCoverageService';

// =============================================================================
// CANCEL CONFIRMATION MODAL
// =============================================================================

export function CancelConfirmModal({ onConfirm, onClose }: {
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    await onConfirm();
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-label="Cancel coverage confirmation">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Cancel Coverage</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" type="button" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to cancel this coverage assignment? Tasks will no longer be automatically routed.
        </p>
        <div className="flex gap-3 justify-end">
          <EAButton variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Keep</EAButton>
          <EAButton variant="primary" size="sm" onClick={handleConfirm} loading={submitting}>
            Cancel Coverage
          </EAButton>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// ADD COVERAGE MODAL
// =============================================================================

export function AddCoverageModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [absentProviderId, setAbsentProviderId] = useState('');
  const [coverageProviderId, setCoverageProviderId] = useState('');
  const [effectiveStart, setEffectiveStart] = useState('');
  const [effectiveEnd, setEffectiveEnd] = useState('');
  const [coverageReason, setCoverageReason] = useState<CoverageReason>('vacation');
  const [priority, setPriority] = useState(1);
  const [autoRoute, setAutoRoute] = useState(true);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setFormError(null);
    if (!absentProviderId || !coverageProviderId) {
      setFormError('Both provider IDs are required');
      return;
    }
    if (absentProviderId === coverageProviderId) {
      setFormError('Provider cannot cover themselves');
      return;
    }
    if (!effectiveStart || !effectiveEnd) {
      setFormError('Start and end dates are required');
      return;
    }

    setSubmitting(true);
    const result = await providerCoverageService.createCoverageAssignment({
      absent_provider_id: absentProviderId,
      coverage_provider_id: coverageProviderId,
      effective_start: new Date(effectiveStart).toISOString(),
      effective_end: new Date(effectiveEnd).toISOString(),
      coverage_reason: coverageReason,
      coverage_priority: priority,
      auto_route_tasks: autoRoute,
      notes: notes || undefined,
    });

    if (!result.success) {
      setFormError(result.error.message);
      setSubmitting(false);
      return;
    }

    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-label="Add coverage assignment">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Add Coverage Assignment</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" type="button" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {formError && (
          <EAAlert variant="critical" className="mb-4">{formError}</EAAlert>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Absent Provider ID</label>
            <input
              type="text" value={absentProviderId} onChange={e => setAbsentProviderId(e.target.value)}
              placeholder="UUID of absent provider"
              className="w-full rounded-md border-gray-300 shadow-sm text-sm focus-visible:ring-[var(--ea-primary)] focus-visible:border-[var(--ea-primary)]"
              aria-label="Absent provider ID"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Coverage Provider ID</label>
            <input
              type="text" value={coverageProviderId} onChange={e => setCoverageProviderId(e.target.value)}
              placeholder="UUID of covering provider"
              className="w-full rounded-md border-gray-300 shadow-sm text-sm focus-visible:ring-[var(--ea-primary)] focus-visible:border-[var(--ea-primary)]"
              aria-label="Coverage provider ID"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="datetime-local" value={effectiveStart} onChange={e => setEffectiveStart(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm text-sm focus-visible:ring-[var(--ea-primary)] focus-visible:border-[var(--ea-primary)]"
                aria-label="Effective start"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="datetime-local" value={effectiveEnd} onChange={e => setEffectiveEnd(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm text-sm focus-visible:ring-[var(--ea-primary)] focus-visible:border-[var(--ea-primary)]"
                aria-label="Effective end"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <select
                value={coverageReason} onChange={e => setCoverageReason(e.target.value as CoverageReason)}
                className="w-full rounded-md border-gray-300 shadow-sm text-sm focus-visible:ring-[var(--ea-primary)] focus-visible:border-[var(--ea-primary)]"
                aria-label="Coverage reason"
              >
                <option value="vacation">Vacation</option>
                <option value="pto">PTO</option>
                <option value="sick">Sick</option>
                <option value="training">Training</option>
                <option value="personal">Personal</option>
                <option value="on_call_swap">On-Call Swap</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority (1-3)</label>
              <select
                value={priority} onChange={e => setPriority(Number(e.target.value))}
                className="w-full rounded-md border-gray-300 shadow-sm text-sm focus-visible:ring-[var(--ea-primary)] focus-visible:border-[var(--ea-primary)]"
                aria-label="Coverage priority"
              >
                <option value={1}>1 (Primary)</option>
                <option value={2}>2 (Secondary)</option>
                <option value={3}>3 (Backup)</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox" id="auto-route" checked={autoRoute} onChange={e => setAutoRoute(e.target.checked)}
              className="rounded border-gray-300 text-[var(--ea-primary)] focus-visible:ring-[var(--ea-primary)]"
            />
            <label htmlFor="auto-route" className="text-sm text-gray-700">Automatically route tasks to coverage provider</label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Additional notes..."
              className="w-full rounded-md border-gray-300 shadow-sm text-sm focus-visible:ring-[var(--ea-primary)] focus-visible:border-[var(--ea-primary)]"
              rows={2}
              aria-label="Notes"
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <EAButton variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Cancel</EAButton>
          <EAButton variant="primary" size="sm" onClick={handleSubmit} loading={submitting}>
            <Plus className="w-4 h-4 mr-1" />
            Create Assignment
          </EAButton>
        </div>
      </div>
    </div>
  );
}
