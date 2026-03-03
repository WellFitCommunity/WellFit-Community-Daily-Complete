/**
 * PriorAuthDecisionModal — Record payer decision on a prior authorization
 *
 * Form for recording approved, denied, partial_approval, or pending_additional_info
 * decisions. Includes auth number, effective/expiration dates, denial codes.
 *
 * Used by: PriorAuthList (action button per row)
 */

import React, { useState, useCallback } from 'react';
import { X, CheckCircle, Loader2 } from 'lucide-react';
import type { PriorAuthDecision } from '../../../services/mcp/mcpPriorAuthClient';

// =====================================================
// Props
// =====================================================

interface PriorAuthDecisionModalProps {
  priorAuthId: string;
  onSubmit: (decision: PriorAuthDecision) => Promise<void>;
  onClose: () => void;
  submitting: boolean;
}

type DecisionType = PriorAuthDecision['decision_type'];

// =====================================================
// Component
// =====================================================

export const PriorAuthDecisionModal: React.FC<PriorAuthDecisionModalProps> = ({
  priorAuthId,
  onSubmit,
  onClose,
  submitting,
}) => {
  const [decisionType, setDecisionType] = useState<DecisionType>('approved');
  const [authNumber, setAuthNumber] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [denialReason, setDenialReason] = useState('');
  const [denialCodes, setDenialCodes] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const decision: PriorAuthDecision = {
      prior_auth_id: priorAuthId,
      decision_type: decisionType,
      ...(authNumber && { auth_number: authNumber }),
      ...(effectiveDate && { effective_date: effectiveDate }),
      ...(expirationDate && { expiration_date: expirationDate }),
      ...(denialReason && { denial_reason: denialReason }),
      ...(denialCodes && {
        denial_codes: denialCodes.split(',').map(c => c.trim()).filter(Boolean),
      }),
      ...(notes && { notes }),
    };
    await onSubmit(decision);
  }, [priorAuthId, decisionType, authNumber, effectiveDate, expirationDate, denialReason, denialCodes, notes, onSubmit]);

  const showDenialFields = decisionType === 'denied' || decisionType === 'partial_approval';
  const showApprovalFields = decisionType === 'approved' || decisionType === 'partial_approval';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-bold text-gray-900">Record Payer Decision</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Decision Type */}
          <div>
            <label htmlFor="decision-type" className="block text-sm font-medium text-gray-700 mb-1">
              Decision *
            </label>
            <select
              id="decision-type"
              value={decisionType}
              onChange={e => setDecisionType(e.target.value as DecisionType)}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base p-2.5 border"
              required
            >
              <option value="approved">Approved</option>
              <option value="denied">Denied</option>
              <option value="partial_approval">Partial Approval</option>
              <option value="pending_additional_info">Pending Additional Info</option>
            </select>
          </div>

          {/* Approval fields */}
          {showApprovalFields && (
            <>
              <div>
                <label htmlFor="decision-auth-number" className="block text-sm font-medium text-gray-700 mb-1">
                  Authorization Number
                </label>
                <input
                  id="decision-auth-number"
                  type="text"
                  value={authNumber}
                  onChange={e => setAuthNumber(e.target.value)}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base p-2.5 border"
                  placeholder="AUTH-12345"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="decision-effective-date" className="block text-sm font-medium text-gray-700 mb-1">
                    Effective Date
                  </label>
                  <input
                    id="decision-effective-date"
                    type="date"
                    value={effectiveDate}
                    onChange={e => setEffectiveDate(e.target.value)}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base p-2.5 border"
                  />
                </div>
                <div>
                  <label htmlFor="decision-expiration-date" className="block text-sm font-medium text-gray-700 mb-1">
                    Expiration Date
                  </label>
                  <input
                    id="decision-expiration-date"
                    type="date"
                    value={expirationDate}
                    onChange={e => setExpirationDate(e.target.value)}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base p-2.5 border"
                  />
                </div>
              </div>
            </>
          )}

          {/* Denial fields */}
          {showDenialFields && (
            <>
              <div>
                <label htmlFor="decision-denial-reason" className="block text-sm font-medium text-gray-700 mb-1">
                  Denial Reason
                </label>
                <textarea
                  id="decision-denial-reason"
                  value={denialReason}
                  onChange={e => setDenialReason(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base p-2.5 border"
                  placeholder="Reason for denial..."
                />
              </div>
              <div>
                <label htmlFor="decision-denial-codes" className="block text-sm font-medium text-gray-700 mb-1">
                  Denial Codes
                </label>
                <input
                  id="decision-denial-codes"
                  type="text"
                  value={denialCodes}
                  onChange={e => setDenialCodes(e.target.value)}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base p-2.5 border"
                  placeholder="CO-16, CO-50 (comma-separated)"
                />
              </div>
            </>
          )}

          {/* Notes */}
          <div>
            <label htmlFor="decision-notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              id="decision-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base p-2.5 border"
              placeholder="Additional notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition min-h-[44px]"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Record Decision
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
