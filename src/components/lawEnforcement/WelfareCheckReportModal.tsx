/**
 * WelfareCheckReportModal - Modal for filing welfare check reports
 *
 * Purpose: Officers file a report after completing a welfare check
 * Used by: ConstableDispatchDashboard
 * Design: Envision Atlus dark theme
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LawEnforcementService } from '../../services/lawEnforcementService';
import { useUser } from '../../contexts/AuthContext';
import type {
  MissedCheckInAlert,
  WelfareCheckOutcome,
  WelfareCheckReportFormData,
} from '../../types/lawEnforcement';
import { getOutcomeLabel, getOutcomeSeverity } from '../../types/lawEnforcement';
import { EAButton } from '../envision-atlus';
import {
  X,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
} from 'lucide-react';

interface WelfareCheckReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  alert: MissedCheckInAlert;
  tenantId: string;
}

const OUTCOME_OPTIONS: WelfareCheckOutcome[] = [
  'senior_ok',
  'senior_ok_needs_followup',
  'senior_not_home',
  'medical_emergency',
  'non_medical_emergency',
  'unable_to_contact',
  'refused_check',
];

export const WelfareCheckReportModal: React.FC<WelfareCheckReportModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  alert,
  tenantId,
}) => {
  const user = useUser();
  const modalRef = useRef<HTMLDivElement>(null);

  // Form state
  const [outcome, setOutcome] = useState<WelfareCheckOutcome | ''>('');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [emsCalled, setEmsCalled] = useState(false);
  const [familyNotified, setFamilyNotified] = useState(false);
  const [actionsTaken, setActionsTaken] = useState<string[]>([]);
  const [actionInput, setActionInput] = useState('');
  const [transportedTo, setTransportedTo] = useState('');
  const [transportReason, setTransportReason] = useState('');
  const [followupRequired, setFollowupRequired] = useState(false);
  const [followupDate, setFollowupDate] = useState('');
  const [followupNotes, setFollowupNotes] = useState('');
  const [checkCompletedAt, setCheckCompletedAt] = useState('');

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setOutcome('');
      setOutcomeNotes('');
      setEmsCalled(false);
      setFamilyNotified(false);
      setActionsTaken([]);
      setActionInput('');
      setTransportedTo('');
      setTransportReason('');
      setFollowupRequired(false);
      setFollowupDate('');
      setFollowupNotes('');
      setCheckCompletedAt(new Date().toISOString().slice(0, 16));
      setError(null);
      setSaving(false);
    }
  }, [isOpen]);

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Focus trap
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    }
  }, [isOpen]);

  const isEmergencyOutcome = outcome === 'medical_emergency' || outcome === 'non_medical_emergency';

  const handleAddAction = () => {
    const trimmed = actionInput.trim();
    if (trimmed && !actionsTaken.includes(trimmed)) {
      setActionsTaken([...actionsTaken, trimmed]);
      setActionInput('');
    }
  };

  const handleRemoveAction = (index: number) => {
    setActionsTaken(actionsTaken.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!outcome) {
      setError('Please select an outcome');
      return;
    }

    if (isEmergencyOutcome && !outcomeNotes) {
      setError('Notes are required for emergency outcomes');
      return;
    }

    if (!user) {
      setError('Session expired. Please log in again.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Compute check_initiated_at from alert data
      const initiatedAt = new Date(
        Date.now() - alert.hoursSinceCheckIn * 60 * 60 * 1000
      ).toISOString();

      const reportData: WelfareCheckReportFormData = {
        tenantId,
        patientId: alert.patientId,
        officerId: user.id,
        officerName:
          (user.user_metadata?.full_name as string) ||
          (user.email ?? 'Unknown Officer'),
        checkInitiatedAt: initiatedAt,
        checkCompletedAt: new Date(checkCompletedAt).toISOString(),
        outcome,
        outcomeNotes: outcomeNotes || undefined,
        emsCalled,
        familyNotified,
        actionsTaken,
        transportedTo: transportedTo || undefined,
        transportReason: transportReason || undefined,
        followupRequired,
        followupDate: followupDate || undefined,
        followupNotes: followupNotes || undefined,
      };

      await LawEnforcementService.saveWelfareCheckReport(reportData);
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save report';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const getSeverityColor = (sev: 'success' | 'warning' | 'error') => {
    switch (sev) {
      case 'success': return 'border-emerald-500 bg-emerald-500/10 text-emerald-300';
      case 'warning': return 'border-amber-500 bg-amber-500/10 text-amber-300';
      case 'error': return 'border-red-500 bg-red-500/10 text-red-300';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="File welfare check report"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        data-testid="modal-overlay"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#00857a]/20 rounded-lg">
              <FileText className="h-5 w-5 text-[#00857a]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">File Welfare Check Report</h2>
              <p className="text-sm text-slate-400">{alert.patientName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error display */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400" role="alert">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Check Timing */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <Clock className="h-4 w-4 inline mr-1.5" />
              Check Completed At
            </label>
            <input
              type="datetime-local"
              value={checkCompletedAt}
              onChange={(e) => setCheckCompletedAt(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-[#00857a] focus:border-transparent"
              aria-label="Check completed at"
            />
          </div>

          {/* Outcome Selection */}
          <fieldset>
            <legend className="text-sm font-medium text-slate-300 mb-3">Outcome *</legend>
            <div className="grid grid-cols-1 gap-2">
              {OUTCOME_OPTIONS.map((opt) => {
                const severity = getOutcomeSeverity(opt);
                const isSelected = outcome === opt;
                return (
                  <label
                    key={opt}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? getSeverityColor(severity)
                        : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <input
                      type="radio"
                      name="outcome"
                      value={opt}
                      checked={isSelected}
                      onChange={() => setOutcome(opt)}
                      className="sr-only"
                    />
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'border-current' : 'border-slate-500'
                    }`}>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-current" />}
                    </span>
                    <span className="font-medium">{getOutcomeLabel(opt)}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Outcome Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2" htmlFor="outcome-notes">
              Notes {isEmergencyOutcome && <span className="text-red-400">*</span>}
            </label>
            <textarea
              id="outcome-notes"
              rows={3}
              value={outcomeNotes}
              onChange={(e) => setOutcomeNotes(e.target.value)}
              placeholder="Describe the situation and any observations..."
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-[#00857a] focus:border-transparent resize-none"
            />
          </div>

          {/* Actions Taken */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Actions Taken</label>
            <div className="flex gap-2 mb-2">
              <label className="flex items-center gap-2 p-2.5 bg-slate-800 border border-slate-600 rounded-lg cursor-pointer hover:border-slate-500">
                <input
                  type="checkbox"
                  checked={emsCalled}
                  onChange={(e) => setEmsCalled(e.target.checked)}
                  className="rounded border-slate-500 text-[#00857a] focus:ring-[#00857a]"
                />
                <span className="text-sm text-slate-300">EMS Called</span>
              </label>
              <label className="flex items-center gap-2 p-2.5 bg-slate-800 border border-slate-600 rounded-lg cursor-pointer hover:border-slate-500">
                <input
                  type="checkbox"
                  checked={familyNotified}
                  onChange={(e) => setFamilyNotified(e.target.checked)}
                  className="rounded border-slate-500 text-[#00857a] focus:ring-[#00857a]"
                />
                <span className="text-sm text-slate-300">Family Notified</span>
              </label>
            </div>
            {/* Custom actions */}
            <div className="flex gap-2">
              <input
                type="text"
                value={actionInput}
                onChange={(e) => setActionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAction();
                  }
                }}
                placeholder="Add other action..."
                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-[#00857a] focus:border-transparent text-sm"
                aria-label="Add action"
              />
              <EAButton type="button" variant="secondary" size="sm" onClick={handleAddAction}>
                Add
              </EAButton>
            </div>
            {actionsTaken.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {actionsTaken.map((action, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-slate-700 text-slate-300 text-sm rounded-full"
                  >
                    {action}
                    <button
                      type="button"
                      onClick={() => handleRemoveAction(i)}
                      className="text-slate-400 hover:text-white ml-1"
                      aria-label={`Remove action: ${action}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Transport (conditional on emergency outcome) */}
          {isEmergencyOutcome && (
            <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg space-y-4">
              <h4 className="text-sm font-medium text-red-300">Transport Information</h4>
              <div>
                <label className="block text-sm text-slate-400 mb-1" htmlFor="transported-to">
                  Transported To
                </label>
                <input
                  id="transported-to"
                  type="text"
                  value={transportedTo}
                  onChange={(e) => setTransportedTo(e.target.value)}
                  placeholder="Hospital or facility name..."
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-[#00857a] focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1" htmlFor="transport-reason">
                  Transport Reason
                </label>
                <input
                  id="transport-reason"
                  type="text"
                  value={transportReason}
                  onChange={(e) => setTransportReason(e.target.value)}
                  placeholder="Reason for transport..."
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-[#00857a] focus:border-transparent text-sm"
                />
              </div>
            </div>
          )}

          {/* Follow-up */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={followupRequired}
                onChange={(e) => setFollowupRequired(e.target.checked)}
                className="rounded border-slate-500 text-[#00857a] focus:ring-[#00857a]"
              />
              <span className="text-sm font-medium text-slate-300">Follow-up Required</span>
            </label>
            {followupRequired && (
              <div className="mt-3 space-y-3 pl-6">
                <div>
                  <label className="block text-sm text-slate-400 mb-1" htmlFor="followup-date">
                    Follow-up Date
                  </label>
                  <input
                    id="followup-date"
                    type="date"
                    value={followupDate}
                    onChange={(e) => setFollowupDate(e.target.value)}
                    className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-[#00857a] focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1" htmlFor="followup-notes">
                    Follow-up Notes
                  </label>
                  <textarea
                    id="followup-notes"
                    rows={2}
                    value={followupNotes}
                    onChange={(e) => setFollowupNotes(e.target.value)}
                    placeholder="What should be followed up on..."
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-[#00857a] focus:border-transparent resize-none text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
            <EAButton type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </EAButton>
            <EAButton
              type="submit"
              variant="primary"
              disabled={saving || !outcome}
              icon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            >
              {saving ? 'Saving...' : 'File Report'}
            </EAButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WelfareCheckReportModal;
