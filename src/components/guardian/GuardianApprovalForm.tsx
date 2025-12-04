/**
 * Guardian Approval Form
 *
 * Detailed review form for Guardian Agent pool reports.
 * Reviewers MUST complete the checklist and provide notes to approve.
 *
 * Features:
 * - Full issue details display
 * - Proposed fix code/steps viewer
 * - Sandbox test results
 * - Required checklist (prevents rubber-stamping)
 * - Required review notes
 * - Approve/Reject actions
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { getGuardianApprovalService } from '../../services/guardianApprovalService';
import {
  GuardianReviewTicket,
  ApprovalFormData,
  TICKET_STATUS_CONFIG,
  HEALING_STRATEGY_CONFIG,
} from '../../types/guardianApproval';
import { EACard, EACardHeader, EACardContent } from '../envision-atlus/EACard';
import { EAButton } from '../envision-atlus/EAButton';
import { EABadge } from '../envision-atlus/EABadge';
import { auditLogger } from '../../services/auditLogger';

// ============================================================================
// Main Component
// ============================================================================

export const GuardianApprovalForm: React.FC = () => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const service = getGuardianApprovalService(supabase);

  // State
  const [ticket, setTicket] = useState<GuardianReviewTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<ApprovalFormData>({
    code_reviewed: false,
    impact_understood: false,
    rollback_understood: false,
    review_notes: '',
  });

  // Load ticket
  useEffect(() => {
    const loadTicket = async () => {
      if (!ticketId) return;

      setLoading(true);
      const result = await service.getTicketById(ticketId);

      if (result.success && result.data) {
        setTicket(result.data);
        // Mark as in_review when opened
        if (result.data.status === 'pending') {
          await service.markInReview(ticketId);
        }
      } else {
        setError(result.error?.message || 'Failed to load ticket');
      }
      setLoading(false);
    };

    loadTicket();
  }, [ticketId, service]);

  // Handle approval
  const handleApprove = async () => {
    if (!ticketId || !ticket) return;

    // Validate form
    if (!formData.code_reviewed || !formData.impact_understood || !formData.rollback_understood) {
      setError('You must check all review checkboxes to approve');
      return;
    }

    if (!formData.review_notes.trim()) {
      setError('Review notes are required to approve');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await service.approveTicket(ticketId, formData);

    if (result.success) {
      auditLogger.info('GUARDIAN_APPROVAL_FORM_APPROVED', {
        message: 'Ticket approved via form',
        ticket_id: ticketId,
      });
      navigate('/guardian/approvals', { state: { message: 'Ticket approved. Fix will be auto-applied.' } });
    } else {
      setError(result.error?.message || 'Failed to approve ticket');
    }

    setSubmitting(false);
  };

  // Handle rejection
  const handleReject = async () => {
    if (!ticketId || !ticket) return;

    if (!formData.review_notes.trim()) {
      setError('Review notes are required to reject');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await service.rejectTicket(ticketId, { review_notes: formData.review_notes });

    if (result.success) {
      auditLogger.info('GUARDIAN_APPROVAL_FORM_REJECTED', {
        message: 'Ticket rejected via form',
        ticket_id: ticketId,
      });
      navigate('/guardian/approvals', { state: { message: 'Ticket rejected. Fix will not be applied.' } });
    } else {
      setError(result.error?.message || 'Failed to reject ticket');
    }

    setSubmitting(false);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading review ticket...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (!ticket) {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="max-w-4xl mx-auto">
          <EACard>
            <EACardContent>
              <div className="text-center py-8">
                <span className="text-6xl mb-4 block">404</span>
                <h2 className="text-xl font-bold text-white mb-2">Ticket Not Found</h2>
                <p className="text-slate-400 mb-4">{error || 'The requested ticket could not be found.'}</p>
                <EAButton onClick={() => navigate('/guardian/approvals')}>
                  Back to Approvals
                </EAButton>
              </div>
            </EACardContent>
          </EACard>
        </div>
      </div>
    );
  }

  const statusConfig = TICKET_STATUS_CONFIG[ticket.status];
  const strategyConfig = HEALING_STRATEGY_CONFIG[ticket.healing_strategy];
  const canReview = ticket.status === 'pending' || ticket.status === 'in_review';

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate('/guardian/approvals')}
              className="text-slate-400 hover:text-white mb-2 flex items-center gap-1"
            >
              &larr; Back to Approvals
            </button>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              Guardian Approval Review
              <span className={`text-sm px-3 py-1 rounded ${statusConfig.bgColor} ${statusConfig.color}`}>
                {statusConfig.icon} {statusConfig.label}
              </span>
            </h1>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Issue Details */}
          <div className="space-y-6">
            {/* Issue Summary */}
            <EACard>
              <EACardHeader>
                <h2 className="text-lg font-semibold text-white">Issue Details</h2>
              </EACardHeader>
              <EACardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-400 uppercase">Severity</label>
                      <div className="mt-1">
                        <EABadge variant={ticket.issue_severity === 'critical' ? 'critical' : ticket.issue_severity === 'high' ? 'high' : 'elevated'}>
                          {ticket.issue_severity.toUpperCase()}
                        </EABadge>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 uppercase">Category</label>
                      <p className="text-white font-mono text-sm mt-1">{ticket.issue_category}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 uppercase">Description</label>
                    <p className="text-slate-300 mt-1">{ticket.issue_description || 'No description provided'}</p>
                  </div>

                  {ticket.affected_component && (
                    <div>
                      <label className="text-xs text-slate-400 uppercase">Affected Component</label>
                      <p className="text-white font-mono text-sm mt-1 bg-slate-800 px-3 py-2 rounded">
                        {ticket.affected_component}
                      </p>
                    </div>
                  )}

                  {ticket.affected_resources && ticket.affected_resources.length > 0 && (
                    <div>
                      <label className="text-xs text-slate-400 uppercase">Affected Resources</label>
                      <ul className="mt-1 space-y-1">
                        {ticket.affected_resources.map((resource, idx) => (
                          <li key={idx} className="text-white font-mono text-sm bg-slate-800 px-3 py-1 rounded">
                            {resource}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {ticket.stack_trace && (
                    <div>
                      <label className="text-xs text-slate-400 uppercase">Stack Trace</label>
                      <pre className="mt-1 text-xs text-slate-300 bg-slate-800 p-3 rounded overflow-x-auto max-h-40">
                        {ticket.stack_trace}
                      </pre>
                    </div>
                  )}
                </div>
              </EACardContent>
            </EACard>

            {/* Sandbox Test Results */}
            {ticket.sandbox_tested && (
              <EACard>
                <EACardHeader>
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    Sandbox Test Results
                    {ticket.sandbox_passed ? (
                      <span className="text-green-400">Passed</span>
                    ) : (
                      <span className="text-red-400">Failed</span>
                    )}
                  </h2>
                </EACardHeader>
                <EACardContent>
                  <div className="space-y-3">
                    {ticket.sandbox_test_results && (
                      <>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="bg-slate-800 rounded p-3">
                            <p className="text-2xl font-bold text-white">
                              {ticket.sandbox_test_results.tests_run || 0}
                            </p>
                            <p className="text-xs text-slate-400">Tests Run</p>
                          </div>
                          <div className="bg-slate-800 rounded p-3">
                            <p className="text-2xl font-bold text-green-400">
                              {ticket.sandbox_test_results.tests_passed || 0}
                            </p>
                            <p className="text-xs text-slate-400">Passed</p>
                          </div>
                          <div className="bg-slate-800 rounded p-3">
                            <p className="text-2xl font-bold text-red-400">
                              {ticket.sandbox_test_results.tests_failed || 0}
                            </p>
                            <p className="text-xs text-slate-400">Failed</p>
                          </div>
                        </div>

                        {ticket.sandbox_test_results.error_message && (
                          <div className="bg-red-500/20 border border-red-500 rounded p-3">
                            <p className="text-sm text-red-300">{ticket.sandbox_test_results.error_message}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </EACardContent>
              </EACard>
            )}
          </div>

          {/* Right Column - Proposed Fix & Review Form */}
          <div className="space-y-6">
            {/* Proposed Fix */}
            <EACard>
              <EACardHeader>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  Proposed Fix
                  <span className={`text-xs px-2 py-1 rounded ${
                    strategyConfig?.risk === 'high' ? 'bg-red-500/20 text-red-400' :
                    strategyConfig?.risk === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {strategyConfig?.risk?.toUpperCase()} RISK
                  </span>
                </h2>
              </EACardHeader>
              <EACardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 uppercase">Strategy</label>
                    <p className="text-white font-semibold mt-1">{strategyConfig?.label || ticket.healing_strategy}</p>
                    <p className="text-slate-400 text-sm">{strategyConfig?.description}</p>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 uppercase">Description</label>
                    <p className="text-slate-300 mt-1">{ticket.healing_description}</p>
                  </div>

                  {ticket.expected_outcome && (
                    <div>
                      <label className="text-xs text-slate-400 uppercase">Expected Outcome</label>
                      <p className="text-slate-300 mt-1">{ticket.expected_outcome}</p>
                    </div>
                  )}

                  {/* Healing Steps */}
                  {ticket.healing_steps && ticket.healing_steps.length > 0 && (
                    <div>
                      <label className="text-xs text-slate-400 uppercase">Healing Steps</label>
                      <div className="mt-2 space-y-2">
                        {ticket.healing_steps.map((step, idx) => (
                          <div key={step.id || idx} className="bg-slate-800 rounded p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-teal-400 font-mono text-sm">Step {step.order || idx + 1}</span>
                              <span className="text-white">{step.action}</span>
                            </div>
                            <p className="text-slate-400 text-sm">Target: {step.target}</p>
                            {step.parameters && Object.keys(step.parameters).length > 0 && (
                              <pre className="text-xs text-slate-500 mt-1">
                                {JSON.stringify(step.parameters, null, 2)}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rollback Plan */}
                  {ticket.rollback_plan && ticket.rollback_plan.length > 0 && (
                    <div>
                      <label className="text-xs text-slate-400 uppercase">Rollback Plan</label>
                      <div className="mt-2 bg-orange-500/10 border border-orange-500/30 rounded p-3">
                        <ul className="list-disc list-inside text-sm text-orange-300 space-y-1">
                          {ticket.rollback_plan.map((step, idx) => (
                            <li key={idx}>{step.action} on {step.target}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </EACardContent>
            </EACard>

            {/* Review Form */}
            {canReview && (
              <EACard>
                <EACardHeader>
                  <h2 className="text-lg font-semibold text-white">Review Checklist</h2>
                </EACardHeader>
                <EACardContent>
                  <div className="space-y-4">
                    {/* Required Checkboxes */}
                    <div className="space-y-3">
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={formData.code_reviewed}
                          onChange={(e) => setFormData({ ...formData, code_reviewed: e.target.checked })}
                          className="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-500"
                        />
                        <div>
                          <span className="text-white group-hover:text-teal-400">
                            I have reviewed the proposed code changes
                          </span>
                          <p className="text-sm text-slate-400">
                            Confirm you have reviewed the healing steps and understand what they will do
                          </p>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={formData.impact_understood}
                          onChange={(e) => setFormData({ ...formData, impact_understood: e.target.checked })}
                          className="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-500"
                        />
                        <div>
                          <span className="text-white group-hover:text-teal-400">
                            I understand the impact on the system
                          </span>
                          <p className="text-sm text-slate-400">
                            Confirm you understand which resources will be affected and potential side effects
                          </p>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={formData.rollback_understood}
                          onChange={(e) => setFormData({ ...formData, rollback_understood: e.target.checked })}
                          className="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-500"
                        />
                        <div>
                          <span className="text-white group-hover:text-teal-400">
                            I understand the rollback procedure
                          </span>
                          <p className="text-sm text-slate-400">
                            Confirm you know how to revert the changes if something goes wrong
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Review Notes */}
                    <div>
                      <label className="text-xs text-slate-400 uppercase block mb-2">
                        Review Notes <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        value={formData.review_notes}
                        onChange={(e) => setFormData({ ...formData, review_notes: e.target.value })}
                        placeholder="Explain what you reviewed and why you are approving/rejecting..."
                        className="w-full h-32 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none resize-none"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Required for both approval and rejection. This prevents rubber-stamping.
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-slate-700">
                      <EAButton
                        variant="primary"
                        onClick={handleApprove}
                        disabled={submitting}
                        className="flex-1"
                      >
                        {submitting ? 'Processing...' : 'Approve & Auto-Apply'}
                      </EAButton>
                      <EAButton
                        variant="secondary"
                        onClick={handleReject}
                        disabled={submitting}
                        className="flex-1 !bg-red-500/20 !text-red-400 hover:!bg-red-500/30"
                      >
                        Reject
                      </EAButton>
                    </div>
                  </div>
                </EACardContent>
              </EACard>
            )}

            {/* Already Reviewed Message */}
            {!canReview && (
              <EACard>
                <EACardContent>
                  <div className="text-center py-4">
                    <span className="text-4xl mb-2 block">{statusConfig.icon}</span>
                    <p className="text-slate-300">
                      This ticket has been {ticket.status}.
                      {ticket.reviewer_name && (
                        <span className="block text-sm text-slate-400 mt-1">
                          Reviewed by {ticket.reviewer_name} on{' '}
                          {ticket.reviewed_at ? new Date(ticket.reviewed_at).toLocaleString() : 'Unknown'}
                        </span>
                      )}
                    </p>
                    {ticket.review_notes && (
                      <div className="mt-4 bg-slate-800 rounded p-3 text-left">
                        <label className="text-xs text-slate-400 uppercase">Review Notes</label>
                        <p className="text-slate-300 mt-1">{ticket.review_notes}</p>
                      </div>
                    )}
                  </div>
                </EACardContent>
              </EACard>
            )}
          </div>
        </div>

        {/* Metadata Footer */}
        <div className="text-xs text-slate-500 flex items-center justify-between">
          <span>Ticket ID: {ticket.id}</span>
          <span>Created: {new Date(ticket.created_at).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default GuardianApprovalForm;
