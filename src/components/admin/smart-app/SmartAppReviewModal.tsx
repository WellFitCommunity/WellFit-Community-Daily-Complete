/**
 * SmartAppReviewModal - Approval/rejection modal for pending SMART apps
 *
 * Allows admins to review pending apps, approve or reject them.
 */

import React, { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import type { SmartApp } from './SmartAppManagement.types';
import { appTypeLabels } from './SmartAppManagement.types';

interface SmartAppReviewModalProps {
  app: SmartApp;
  onClose: () => void;
  onDecision: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export const SmartAppReviewModal: React.FC<SmartAppReviewModalProps> = ({
  app,
  onClose,
  onDecision,
  onError,
  onSuccess,
}) => {
  const [rejectionReason, setRejectionReason] = useState('');

  const handleApprove = async () => {
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
        .eq('id', app.id);

      if (updateError) throw updateError;

      onSuccess(`${app.client_name} has been approved`);
      onDecision();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to approve app';
      onError(message);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      onError('Please provide a reason for rejection');
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
        .eq('id', app.id);

      if (updateError) throw updateError;

      onSuccess(`${app.client_name} has been rejected`);
      onDecision();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reject app';
      onError(message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Review App: {app.client_name}
          </h3>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Type:</span>
              <span className="font-medium">{appTypeLabels[app.app_type]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Developer:</span>
              <span className="font-medium">{app.developer_email || 'Not provided'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Confidential:</span>
              <span className="font-medium">{app.is_confidential ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">PKCE Required:</span>
              <span className="font-medium">{app.pkce_required ? 'Yes' : 'No'}</span>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Requested Scopes:</h4>
            <div className="flex flex-wrap gap-1">
              {app.scopes_allowed.map((scope) => (
                <span key={scope} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                  {scope}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Redirect URIs:</h4>
            <div className="bg-gray-50 rounded p-2 font-mono text-xs">
              {app.redirect_uris.map((uri, i) => (
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
            onClick={onClose}
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
  );
};

export default SmartAppReviewModal;
