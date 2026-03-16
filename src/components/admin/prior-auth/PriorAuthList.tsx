/**
 * PriorAuthList — Authorization table with filter bar and action buttons
 *
 * Displays the table of prior authorizations with status filter pills,
 * submit/cancel actions per row.
 * Used by: PriorAuthDashboard (in 'list' view mode)
 */

import React from 'react';
import type { PriorAuthorization } from '../../../services/fhir/prior-auth';
import { FileText, Send, XCircle, ClipboardCheck, AlertTriangle, Download } from 'lucide-react';
import { StatusBadge, UrgencyBadge } from './PriorAuthBadges';

interface PriorAuthListProps {
  auths: PriorAuthorization[];
  statusFilter: string;
  onFilterChange: (status: string) => void;
  onSubmit: (id: string) => void;
  onCancel: (id: string) => void;
  onRecordDecision?: (id: string) => void;
  onAppeal?: (id: string) => void;
  onExportFHIR?: (id: string) => void;
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'denied', label: 'Denied' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const PriorAuthList: React.FC<PriorAuthListProps> = ({
  auths,
  statusFilter,
  onFilterChange,
  onSubmit,
  onCancel,
  onRecordDecision,
  onAppeal,
  onExportFHIR,
}) => (
  <div className="bg-white rounded-xl border" aria-label="Prior Authorization List">
    {/* Filter bar */}
    <div className="flex items-center gap-2 p-4 border-b overflow-x-auto">
      {FILTER_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onFilterChange(opt.value)}
          className={`px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)] ${
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
        <table className="w-full text-sm" aria-label="Prior authorizations">
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
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-[var(--ea-primary)] rounded hover:bg-[var(--ea-primary-hover)] min-h-[32px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
                        title="Submit to payer"
                      >
                        <Send className="w-3.5 h-3.5" /> Submit
                      </button>
                    )}
                    {['draft', 'submitted', 'pending_review'].includes(auth.status) && (
                      <button
                        onClick={() => onCancel(auth.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded hover:bg-red-100 min-h-[32px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
                        title="Cancel request"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Cancel
                      </button>
                    )}
                    {['submitted', 'pending_review'].includes(auth.status) && onRecordDecision && (
                      <button
                        onClick={() => onRecordDecision(auth.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded hover:bg-emerald-100 min-h-[32px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
                        title="Record payer decision"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" /> Decision
                      </button>
                    )}
                    {auth.status === 'denied' && onAppeal && (
                      <button
                        onClick={() => onAppeal(auth.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded hover:bg-amber-100 min-h-[32px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
                        title="File appeal"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" /> Appeal
                      </button>
                    )}
                    {onExportFHIR && (
                      <button
                        onClick={() => onExportFHIR(auth.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 rounded hover:bg-gray-100 min-h-[32px]"
                        title="Export as FHIR Claim"
                      >
                        <Download className="w-3.5 h-3.5" /> FHIR
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
