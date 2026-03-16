/**
 * PriorAuthAppealModal — Create appeal for a denied prior authorization
 *
 * Form for first_level, second_level, or external_review appeals
 * with reason and clinical rationale. Only available for denied auths.
 *
 * Used by: PriorAuthList (action button per denied row)
 */

import React, { useState, useCallback } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import type { PriorAuthAppeal } from '../../../services/mcp/mcpPriorAuthClient';

// =====================================================
// Props
// =====================================================

interface PriorAuthAppealModalProps {
  priorAuthId: string;
  onSubmit: (appeal: PriorAuthAppeal) => Promise<void>;
  onClose: () => void;
  submitting: boolean;
}

type AppealType = PriorAuthAppeal['appeal_type'];

// =====================================================
// Component
// =====================================================

export const PriorAuthAppealModal: React.FC<PriorAuthAppealModalProps> = ({
  priorAuthId,
  onSubmit,
  onClose,
  submitting,
}) => {
  const [appealType, setAppealType] = useState<AppealType>('first_level');
  const [reason, setReason] = useState('');
  const [clinicalRationale, setClinicalRationale] = useState('');

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const appeal: PriorAuthAppeal = {
      prior_auth_id: priorAuthId,
      appeal_type: appealType,
      reason,
      clinical_rationale: clinicalRationale,
    };
    await onSubmit(appeal);
  }, [priorAuthId, appealType, reason, clinicalRationale, onSubmit]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-label="File prior authorization appeal">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            File Appeal
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Appeal Type */}
          <div>
            <label htmlFor="appeal-type" className="block text-sm font-medium text-gray-700 mb-1">
              Appeal Level *
            </label>
            <select
              id="appeal-type"
              value={appealType}
              onChange={e => setAppealType(e.target.value as AppealType)}
              className="w-full rounded-lg border-gray-300 shadow-sm focus-visible:ring-indigo-500 focus-visible:border-indigo-500 text-base p-2.5 border"
              required
            >
              <option value="first_level">First Level</option>
              <option value="second_level">Second Level</option>
              <option value="external_review">External Review</option>
            </select>
          </div>

          {/* Reason */}
          <div>
            <label htmlFor="appeal-reason" className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Appeal *
            </label>
            <textarea
              id="appeal-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              required
              className="w-full rounded-lg border-gray-300 shadow-sm focus-visible:ring-indigo-500 focus-visible:border-indigo-500 text-base p-2.5 border"
              placeholder="Why is this authorization medically necessary..."
            />
          </div>

          {/* Clinical Rationale */}
          <div>
            <label htmlFor="appeal-clinical-rationale" className="block text-sm font-medium text-gray-700 mb-1">
              Clinical Rationale *
            </label>
            <textarea
              id="appeal-clinical-rationale"
              value={clinicalRationale}
              onChange={e => setClinicalRationale(e.target.value)}
              rows={4}
              required
              className="w-full rounded-lg border-gray-300 shadow-sm focus-visible:ring-indigo-500 focus-visible:border-indigo-500 text-base p-2.5 border"
              placeholder="Clinical evidence supporting the medical necessity of the requested service..."
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
              disabled={submitting || !reason.trim() || !clinicalRationale.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition min-h-[44px]"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              Submit Appeal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
