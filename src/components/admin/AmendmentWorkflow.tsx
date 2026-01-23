/**
 * Amendment Workflow - Clinical Note Amendment Management UI
 *
 * Purpose: Create, review, and manage amendments for locked clinical notes
 * Features: Amendment creation form, approval workflow, amendment history
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  History,
  Edit3,
  MessageSquare,
} from 'lucide-react';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EAAlert,
} from '../envision-atlus';
import {
  noteAmendmentService,
  type AmendmentWithDetails,
  type CreateAmendmentRequest,
} from '../../services/noteAmendmentService';
import type { NoteType, AmendmentType, AmendmentStatus } from '../../services/noteLockingService';
import { supabase } from '../../lib/supabaseClient';

// =============================================================================
// TYPES
// =============================================================================

interface AmendmentWorkflowProps {
  noteId: string;
  noteType: NoteType;
  onAmendmentCreated?: () => void;
}

const AMENDMENT_TYPE_CONFIG: Record<AmendmentType, { label: string; description: string; icon: typeof Edit3 }> = {
  correction: {
    label: 'Correction',
    description: 'Fix an error in the original note',
    icon: Edit3,
  },
  addendum: {
    label: 'Addendum',
    description: 'Add additional information discovered after signing',
    icon: Plus,
  },
  late_entry: {
    label: 'Late Entry',
    description: 'Document care provided but not recorded at the time',
    icon: Clock,
  },
  clarification: {
    label: 'Clarification',
    description: 'Clarify existing content without changing meaning',
    icon: MessageSquare,
  },
};

const STATUS_CONFIG: Record<AmendmentStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: XCircle },
};

// =============================================================================
// COMPONENT
// =============================================================================

export const AmendmentWorkflow: React.FC<AmendmentWorkflowProps> = ({
  noteId,
  noteType,
  onAmendmentCreated,
}) => {
  // State
  const [amendments, setAmendments] = useState<AmendmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [amendmentType, setAmendmentType] = useState<AmendmentType>('addendum');
  const [amendmentContent, setAmendmentContent] = useState('');
  const [amendmentReason, setAmendmentReason] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [fieldAmended, setFieldAmended] = useState('');

  // Fetch amendments
  const fetchAmendments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await noteAmendmentService.getAmendmentsForNote(noteId, noteType);
      if (result.success) {
        setAmendments(result.data);
      } else {
        setError(result.error.message);
      }
    } catch (err) {
      setError('Failed to load amendments');
    } finally {
      setLoading(false);
    }
  }, [noteId, noteType]);

  useEffect(() => {
    fetchAmendments();
  }, [fetchAmendments]);

  // Handle create amendment
  const handleCreateAmendment = async () => {
    if (!amendmentContent.trim() || !amendmentReason.trim()) {
      setError('Amendment content and reason are required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in to create amendments');
        return;
      }

      const request: CreateAmendmentRequest = {
        noteId,
        noteType,
        amendmentType,
        amendmentContent: amendmentContent.trim(),
        amendmentReason: amendmentReason.trim(),
        originalContent: amendmentType === 'correction' ? originalContent.trim() || undefined : undefined,
        fieldAmended: fieldAmended.trim() || undefined,
      };

      const result = await noteAmendmentService.createAmendment(request, user.id);

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      // Reset form
      setShowCreateForm(false);
      setAmendmentType('addendum');
      setAmendmentContent('');
      setAmendmentReason('');
      setOriginalContent('');
      setFieldAmended('');

      // Refresh list
      await fetchAmendments();
      onAmendmentCreated?.();
    } catch (err) {
      setError('Failed to create amendment');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle approve amendment
  const handleApprove = async (amendmentId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in');
        return;
      }

      const result = await noteAmendmentService.approveAmendment(amendmentId, user.id);
      if (!result.success) {
        setError(result.error.message);
        return;
      }

      await fetchAmendments();
    } catch (err) {
      setError('Failed to approve amendment');
    }
  };

  // Handle reject amendment
  const handleReject = async (amendmentId: string) => {
    const reason = window.prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in');
        return;
      }

      const result = await noteAmendmentService.rejectAmendment(amendmentId, user.id, reason);
      if (!result.success) {
        setError(result.error.message);
        return;
      }

      await fetchAmendments();
    } catch (err) {
      setError('Failed to reject amendment');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
          <History className="w-5 h-5 text-blue-600" />
          Amendment History
        </h3>
        <div className="flex gap-2">
          <EAButton variant="secondary" onClick={fetchAmendments} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </EAButton>
          <EAButton variant="primary" onClick={() => setShowCreateForm(!showCreateForm)}>
            <Plus className="w-4 h-4 mr-2" />
            New Amendment
          </EAButton>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <EAAlert variant="critical" onDismiss={() => setError(null)} dismissible>
          {error}
        </EAAlert>
      )}

      {/* Create Amendment Form */}
      {showCreateForm && (
        <EACard className="border-2 border-blue-200">
          <EACardHeader className="bg-blue-50">
            <h4 className="font-medium text-blue-900">Create Amendment</h4>
          </EACardHeader>
          <EACardContent className="p-4 space-y-4">
            {/* Amendment Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Amendment Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(AMENDMENT_TYPE_CONFIG) as [AmendmentType, typeof AMENDMENT_TYPE_CONFIG.correction][]).map(([type, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={type}
                      onClick={() => setAmendmentType(type)}
                      className={`p-3 rounded-lg border-2 text-left transition-colors ${
                        amendmentType === type
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${amendmentType === type ? 'text-blue-600' : 'text-gray-500'}`} />
                        <span className="font-medium text-sm">{config.label}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{config.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Original Content (for corrections) */}
            {amendmentType === 'correction' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Original Content Being Corrected
                </label>
                <textarea
                  value={originalContent}
                  onChange={(e) => setOriginalContent(e.target.value)}
                  className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Enter the original text that needs correction..."
                />
              </div>
            )}

            {/* Field Amended */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Field Amended (optional)
              </label>
              <input
                type="text"
                value={fieldAmended}
                onChange={(e) => setFieldAmended(e.target.value)}
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Assessment, Plan, Medications"
              />
            </div>

            {/* Amendment Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amendment Content *
              </label>
              <textarea
                value={amendmentContent}
                onChange={(e) => setAmendmentContent(e.target.value)}
                className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="Enter the amendment text..."
                required
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Amendment *
              </label>
              <textarea
                value={amendmentReason}
                onChange={(e) => setAmendmentReason(e.target.value)}
                className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Explain why this amendment is necessary..."
                required
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <EAButton variant="secondary" onClick={() => setShowCreateForm(false)}>
                Cancel
              </EAButton>
              <EAButton
                variant="primary"
                onClick={handleCreateAmendment}
                disabled={submitting || !amendmentContent.trim() || !amendmentReason.trim()}
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Submit Amendment
                  </>
                )}
              </EAButton>
            </div>
          </EACardContent>
        </EACard>
      )}

      {/* Amendments List */}
      {loading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
          <p className="mt-2 text-gray-500">Loading amendments...</p>
        </div>
      ) : amendments.length === 0 ? (
        <EACard>
          <EACardContent className="p-8 text-center">
            <FileText className="w-10 h-10 mx-auto text-gray-400 mb-3" />
            <h4 className="font-medium text-gray-900">No Amendments</h4>
            <p className="text-gray-500 mt-1">This note has no amendments yet.</p>
          </EACardContent>
        </EACard>
      ) : (
        <div className="space-y-2">
          {amendments.map((amendment) => {
            const isExpanded = expandedId === amendment.id;
            const typeConfig = AMENDMENT_TYPE_CONFIG[amendment.amendment_type];
            const statusConfig = STATUS_CONFIG[amendment.status];
            const StatusIcon = statusConfig.icon;
            const TypeIcon = typeConfig.icon;

            return (
              <EACard key={amendment.id} className="overflow-hidden">
                {/* Summary Row */}
                <div
                  className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : amendment.id)}
                >
                  <div className="flex items-center gap-3">
                    <TypeIcon className="w-4 h-4 text-gray-500" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{typeConfig.label}</span>
                        {amendment.field_amended && (
                          <span className="text-sm text-gray-500">({amendment.field_amended})</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        By {amendment.amended_by_name || 'Unknown'} •{' '}
                        {new Date(amendment.amended_at).toLocaleString()}
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusConfig.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusConfig.label}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4 space-y-3">
                    {/* Original Content (for corrections) */}
                    {amendment.amendment_type === 'correction' && amendment.original_content && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Original Content</label>
                        <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800 line-through">
                          {amendment.original_content}
                        </div>
                      </div>
                    )}

                    {/* Amendment Content */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Amendment</label>
                      <div className="mt-1 p-2 bg-white border rounded text-sm text-gray-900">
                        {amendment.amendment_content}
                      </div>
                    </div>

                    {/* Reason */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Reason</label>
                      <div className="mt-1 p-2 bg-white border rounded text-sm text-gray-700">
                        {amendment.amendment_reason}
                      </div>
                    </div>

                    {/* Approval Info */}
                    {amendment.status !== 'pending' && amendment.approved_by && (
                      <div className="text-sm text-gray-500">
                        {amendment.status === 'approved' ? 'Approved' : 'Rejected'} by{' '}
                        {amendment.approved_by_name || 'Unknown'} on{' '}
                        {amendment.approved_at ? new Date(amendment.approved_at).toLocaleString() : 'Unknown'}
                      </div>
                    )}

                    {/* Actions for pending amendments */}
                    {amendment.status === 'pending' && (
                      <div className="flex justify-end gap-2 pt-2">
                        <EAButton variant="secondary" onClick={() => handleReject(amendment.id)}>
                          <XCircle className="w-4 h-4 mr-2" />
                          Reject
                        </EAButton>
                        <EAButton variant="primary" onClick={() => handleApprove(amendment.id)}>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve
                        </EAButton>
                      </div>
                    )}
                  </div>
                )}
              </EACard>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AmendmentWorkflow;
