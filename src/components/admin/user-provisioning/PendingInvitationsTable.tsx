/**
 * PendingInvitationsTable — Shows pending registrations with delete action
 *
 * Purpose: Display users who started signup but haven't completed verification
 * Used by: UserProvisioningPanel
 */

import React, { useState } from 'react';
import { Trash2, RefreshCw, Clock, CheckCircle, XCircle } from 'lucide-react';
import { EABadge } from '../../envision-atlus';
import type { PendingInvitationsTableProps } from './types';

export const PendingInvitationsTable: React.FC<PendingInvitationsTableProps> = ({
  invitations,
  loading,
  onRefresh,
  onDelete,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const formatDate = (dateStr: string): string => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const isExpired = (expiresAt: string | null): boolean => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const handleDelete = (id: string) => {
    onDelete(id);
    setConfirmDeleteId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 text-gray-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Loading pending registrations...
      </div>
    );
  }

  if (invitations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">No pending registrations</p>
        <button
          onClick={onRefresh}
          className="mt-2 text-xs text-[var(--ea-primary)] hover:text-[var(--ea-primary-hover)]"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-600">
          {invitations.length} pending registration{invitations.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-[var(--ea-primary)] hover:text-[var(--ea-primary-hover)]"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-3 py-2 font-medium text-gray-600">Name</th>
              <th className="px-3 py-2 font-medium text-gray-600">Contact</th>
              <th className="px-3 py-2 font-medium text-gray-600">Role</th>
              <th className="px-3 py-2 font-medium text-gray-600">Status</th>
              <th className="px-3 py-2 font-medium text-gray-600">Created</th>
              <th className="px-3 py-2 font-medium text-gray-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invitations.map(inv => {
              const expired = isExpired(inv.expires_at);
              return (
                <tr key={inv.id} className={expired ? 'bg-red-50/50' : ''}>
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {inv.first_name} {inv.last_name}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {inv.email || inv.phone || 'No contact'}
                  </td>
                  <td className="px-3 py-2">
                    {inv.role_slug ? (
                      <EABadge variant="info" size="sm">{inv.role_slug}</EABadge>
                    ) : (
                      <EABadge variant="neutral" size="sm">Unassigned</EABadge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {expired ? (
                        <EABadge variant="critical" size="sm">Expired</EABadge>
                      ) : inv.hcaptcha_verified ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-3.5 h-3.5" /> Verified
                        </span>
                      ) : inv.verification_code_sent ? (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Clock className="w-3.5 h-3.5" /> Code Sent
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-400">
                          <XCircle className="w-3.5 h-3.5" /> Pending
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs">
                    {formatDate(inv.created_at)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {confirmDeleteId === inv.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleDelete(inv.id)}
                          className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(inv.id)}
                        title="Delete pending registration"
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
