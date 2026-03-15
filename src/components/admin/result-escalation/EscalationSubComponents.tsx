/**
 * Result Escalation Dashboard — Sub-components
 *
 * Purpose: Extracted MetricCard, ResolveModal, and AddRuleModal to keep
 * the main dashboard under the 600-line file limit.
 *
 * Used by: ResultEscalationDashboard.tsx
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState } from 'react';
import {
  Plus,
  CheckCircle,
  X,
} from 'lucide-react';
import {
  EAButton,
  EAAlert,
} from '../../envision-atlus';
import {
  resultEscalationService,
} from '../../../services/resultEscalationService';
import type {
  EscalationLogEntry,
  EscalationSeverity,
} from '../../../services/resultEscalationService';

// =============================================================================
// METRIC CARD
// =============================================================================

export function MetricCard({ label, value, color }: {
  label: string;
  value: number;
  color: 'red' | 'orange' | 'blue' | 'green' | 'purple';
}) {
  const colorMap = {
    red: 'bg-red-50 border-red-200 text-red-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
    blue: 'bg-[var(--ea-primary,#00857a)]/5 border-[var(--ea-primary,#00857a)]/20 text-[var(--ea-primary,#00857a)]',
    green: 'bg-green-50 border-green-200 text-green-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorMap[color]}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

// =============================================================================
// RESOLVE MODAL
// =============================================================================

export function ResolveModal({ escalation, onClose, onResolve }: {
  escalation: EscalationLogEntry;
  onClose: () => void;
  onResolve: (id: string, notes: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await onResolve(escalation.id, notes);
    setSubmitting(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-label="Resolve escalation"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Resolve Escalation</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" type="button" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-md text-sm">
          <p><strong>Test:</strong> {escalation.test_name} = {escalation.test_value}{escalation.test_unit ? ` ${escalation.test_unit}` : ''}</p>
          <p><strong>Severity:</strong> {escalation.severity}</p>
          <p><strong>Specialty:</strong> {escalation.route_to_specialty}</p>
        </div>

        <label htmlFor="resolution-notes" className="block text-sm font-medium text-gray-700 mb-1">
          Resolution Notes
        </label>
        <textarea
          id="resolution-notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-md border-gray-300 shadow-sm focus:ring-[var(--ea-primary,#00857a)] focus:border-[var(--ea-primary,#00857a)] text-sm"
          placeholder="Describe the clinical resolution..."
        />

        <div className="mt-4 flex justify-end gap-2">
          <EAButton variant="ghost" size="sm" onClick={onClose}>Cancel</EAButton>
          <EAButton
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            loading={submitting}
            disabled={!notes.trim()}
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            Resolve
          </EAButton>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// ADD RULE MODAL
// =============================================================================

export function AddRuleModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const [testName, setTestName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [condition, setCondition] = useState<'above' | 'below' | 'outside_range'>('above');
  const [thresholdHigh, setThresholdHigh] = useState('');
  const [thresholdLow, setThresholdLow] = useState('');
  const [severity, setSeverity] = useState<EscalationSeverity>('high');
  const [specialty, setSpecialty] = useState('');
  const [targetMinutes, setTargetMinutes] = useState('60');
  const [guidance, setGuidance] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!testName || !displayName || !specialty) {
      setError('Test name, display name, and specialty are required');
      return;
    }
    setSubmitting(true);
    setError(null);

    const result = await resultEscalationService.createRule({
      test_name: testName,
      display_name: displayName,
      condition,
      threshold_high: thresholdHigh ? parseFloat(thresholdHigh) : null,
      threshold_low: thresholdLow ? parseFloat(thresholdLow) : null,
      severity,
      route_to_specialty: specialty,
      target_minutes: parseInt(targetMinutes, 10) || 60,
      clinical_guidance: guidance || undefined,
    });

    if (!result.success) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    await onSave();
    setSubmitting(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-label="Add escalation rule"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Add Escalation Rule</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" type="button" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <EAAlert variant="critical" dismissible onDismiss={() => setError(null)}>
            {error}
          </EAAlert>
        )}

        <div className="space-y-3 mt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rule-test-name" className="block text-sm font-medium text-gray-700">Test Name (key)</label>
              <input id="rule-test-name" type="text" value={testName} onChange={e => setTestName(e.target.value)}
                className="mt-1 w-full rounded-md border-gray-300 shadow-sm text-sm" placeholder="e.g., troponin" />
            </div>
            <div>
              <label htmlFor="rule-display-name" className="block text-sm font-medium text-gray-700">Display Name</label>
              <input id="rule-display-name" type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                className="mt-1 w-full rounded-md border-gray-300 shadow-sm text-sm" placeholder="e.g., Troponin I" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="rule-condition" className="block text-sm font-medium text-gray-700">Condition</label>
              <select id="rule-condition" value={condition} onChange={e => setCondition(e.target.value as 'above' | 'below' | 'outside_range')}
                className="mt-1 w-full rounded-md border-gray-300 shadow-sm text-sm">
                <option value="above">Above</option>
                <option value="below">Below</option>
                <option value="outside_range">Outside Range</option>
              </select>
            </div>
            <div>
              <label htmlFor="rule-threshold-high" className="block text-sm font-medium text-gray-700">Threshold High</label>
              <input id="rule-threshold-high" type="number" step="0.01" value={thresholdHigh} onChange={e => setThresholdHigh(e.target.value)}
                className="mt-1 w-full rounded-md border-gray-300 shadow-sm text-sm" />
            </div>
            <div>
              <label htmlFor="rule-threshold-low" className="block text-sm font-medium text-gray-700">Threshold Low</label>
              <input id="rule-threshold-low" type="number" step="0.01" value={thresholdLow} onChange={e => setThresholdLow(e.target.value)}
                className="mt-1 w-full rounded-md border-gray-300 shadow-sm text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="rule-severity" className="block text-sm font-medium text-gray-700">Severity</label>
              <select id="rule-severity" value={severity} onChange={e => setSeverity(e.target.value as EscalationSeverity)}
                className="mt-1 w-full rounded-md border-gray-300 shadow-sm text-sm">
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="moderate">Moderate</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label htmlFor="rule-specialty" className="block text-sm font-medium text-gray-700">Specialty</label>
              <input id="rule-specialty" type="text" value={specialty} onChange={e => setSpecialty(e.target.value)}
                className="mt-1 w-full rounded-md border-gray-300 shadow-sm text-sm" placeholder="e.g., cardiology" />
            </div>
            <div>
              <label htmlFor="rule-target" className="block text-sm font-medium text-gray-700">SLA (min)</label>
              <input id="rule-target" type="number" value={targetMinutes} onChange={e => setTargetMinutes(e.target.value)}
                className="mt-1 w-full rounded-md border-gray-300 shadow-sm text-sm" />
            </div>
          </div>

          <div>
            <label htmlFor="rule-guidance" className="block text-sm font-medium text-gray-700">Clinical Guidance</label>
            <textarea id="rule-guidance" value={guidance} onChange={e => setGuidance(e.target.value)} rows={2}
              className="mt-1 w-full rounded-md border-gray-300 shadow-sm text-sm" placeholder="e.g., Acute MI possible..." />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <EAButton variant="ghost" size="sm" onClick={onClose}>Cancel</EAButton>
          <EAButton variant="primary" size="sm" onClick={handleSubmit} loading={submitting}>
            <Plus className="w-4 h-4 mr-1" />
            Add Rule
          </EAButton>
        </div>
      </div>
    </div>
  );
}
