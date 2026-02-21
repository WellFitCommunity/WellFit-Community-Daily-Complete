/**
 * SuperbillReviewPanel
 *
 * Provider sign-off gate for superbills before clearinghouse submission.
 * Left panel: pending claims list. Right panel: claim detail + approval.
 * Electronic signature required for approval; rejection requires reason.
 *
 * Pattern: ProviderSignoffForm.tsx (src/components/ems/)
 *
 * @module components/admin/SuperbillReviewPanel
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { useUser } from '../../contexts/AuthContext';
import { auditLogger } from '../../services/auditLogger';
import { BillingService } from '../../services/billingService';
import type { Claim, ClaimLine } from '../../types/billing';
import {
  FileCheck, Clock, CheckCircle, XCircle, RefreshCw,
  DollarSign, FileText, AlertTriangle, Loader2, ShieldAlert,
} from 'lucide-react';
import { useCMSCoverageCheck, type CoverageCheckState } from '../../hooks/useCMSCoverageCheck';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SuperbillReviewPanelProps {
  tenantId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CMS Coverage Sub-Component
// ─────────────────────────────────────────────────────────────────────────────

function CoverageCheckPanel({ coverageState }: { coverageState: CoverageCheckState }) {
  if (coverageState.status === 'checking') {
    return (
      <div className="border rounded-lg p-4 bg-blue-50">
        <div className="flex items-center gap-2 text-blue-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">Checking CMS coverage requirements...</span>
        </div>
      </div>
    );
  }

  if (coverageState.status === 'error') {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-sm">{coverageState.error}</AlertDescription>
      </Alert>
    );
  }

  if (coverageState.status === 'pass') {
    return (
      <div className="border rounded-lg p-4 bg-green-50">
        <div className="flex items-center gap-2 text-green-700">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm font-medium">CMS coverage check passed — no prior auth required</span>
        </div>
      </div>
    );
  }

  if (coverageState.status === 'warnings' && coverageState.result) {
    const { codesRequiringAuth, missingDocumentation } = coverageState.result;
    return (
      <div className="border rounded-lg p-4 bg-amber-50 space-y-3">
        <div className="flex items-center gap-2 text-amber-800">
          <ShieldAlert className="h-4 w-4" />
          <span className="text-sm font-bold">
            CMS Coverage: {coverageState.warningCount} item{coverageState.warningCount !== 1 ? 's' : ''} need attention
          </span>
        </div>

        {codesRequiringAuth.length > 0 && (
          <div className="text-sm">
            <span className="font-medium text-amber-900">Prior Authorization Required:</span>
            <ul className="list-disc list-inside mt-1 text-amber-800">
              {codesRequiringAuth.map(code => (
                <li key={code} className="font-mono">{code}</li>
              ))}
            </ul>
          </div>
        )}

        {missingDocumentation.length > 0 && (
          <div className="text-sm">
            <span className="font-medium text-amber-900">Documentation Needed:</span>
            <ul className="list-disc list-inside mt-1 text-amber-800">
              {missingDocumentation.map((doc, i) => (
                <li key={i}>{doc}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const SuperbillReviewPanel: React.FC<SuperbillReviewPanelProps> = ({ tenantId: _tenantId }) => {
  const user = useUser();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingClaims, setPendingClaims] = useState<Claim[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [claimLines, setClaimLines] = useState<ClaimLine[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);

  // Approval form state
  const [signature, setSignature] = useState('');
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionResult, setActionResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // CMS Coverage check
  const coverageCheck = useCMSCoverageCheck();

  // Load pending claims
  const loadPendingClaims = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const claims = await BillingService.getClaimsAwaitingApproval();
      setPendingClaims(claims);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load pending claims';
      setError(message);
      auditLogger.error('SUPERBILL_REVIEW_LOAD_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { userId: user?.id }
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadPendingClaims();
  }, [loadPendingClaims]);

  // Load claim lines when a claim is selected
  const handleClaimSelect = useCallback(async (claim: Claim) => {
    setSelectedClaim(claim);
    setShowRejectForm(false);
    setActionResult(null);
    setSignature('');
    setAgreementChecked(false);
    setApprovalNotes('');
    setRejectionReason('');
    coverageCheck.reset();

    setLoadingLines(true);
    try {
      const lines = await BillingService.getClaimLines(claim.id);
      setClaimLines(lines);

      // Auto-run CMS coverage check on loaded CPT codes
      const cptCodes = lines.map(l => l.procedure_code).filter(Boolean);
      if (cptCodes.length > 0) {
        coverageCheck.checkCoverage(cptCodes);
      }
    } catch (err: unknown) {
      auditLogger.error('SUPERBILL_LINES_LOAD_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { claim_id: claim.id }
      );
      setClaimLines([]);
    } finally {
      setLoadingLines(false);
    }
  }, [coverageCheck]);

  // Approve superbill
  const handleApprove = useCallback(async () => {
    if (!selectedClaim || !user?.id) return;
    if (!signature.trim()) {
      setActionResult({ type: 'error', message: 'Signature is required' });
      return;
    }
    if (!agreementChecked) {
      setActionResult({ type: 'error', message: 'You must agree to the certification statement' });
      return;
    }

    setSubmitting(true);
    setActionResult(null);

    const result = await BillingService.approveSuperbill(
      selectedClaim.id,
      user.id,
      approvalNotes || undefined
    );

    if (result.success) {
      setActionResult({ type: 'success', message: 'Superbill approved and ready for submission' });
      setSelectedClaim(null);
      setClaimLines([]);
      await loadPendingClaims();
    } else {
      setActionResult({ type: 'error', message: result.error.message });
    }
    setSubmitting(false);
  }, [selectedClaim, user?.id, signature, agreementChecked, approvalNotes, loadPendingClaims]);

  // Reject superbill
  const handleReject = useCallback(async () => {
    if (!selectedClaim || !user?.id) return;
    if (rejectionReason.trim().length < 10) {
      setActionResult({ type: 'error', message: 'Rejection reason must be at least 10 characters' });
      return;
    }

    setSubmitting(true);
    setActionResult(null);

    const result = await BillingService.rejectSuperbill(
      selectedClaim.id,
      user.id,
      rejectionReason.trim()
    );

    if (result.success) {
      setActionResult({ type: 'success', message: 'Superbill returned for revision' });
      setSelectedClaim(null);
      setClaimLines([]);
      await loadPendingClaims();
    } else {
      setActionResult({ type: 'error', message: result.error.message });
    }
    setSubmitting(false);
  }, [selectedClaim, user?.id, rejectionReason, loadPendingClaims]);

  // Loading state
  if (loading) {
    return (
      <Card><CardContent className="p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
        <div>Loading superbills awaiting review...</div>
      </CardContent></Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const totalCharges = claimLines.reduce((sum, line) => sum + (line.charge_amount * line.units), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileCheck className="h-6 w-6 text-blue-600" />
            Superbill Provider Sign-Off
          </h2>
          <p className="text-gray-600 text-sm">Review and approve superbills before clearinghouse submission</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={pendingClaims.length > 0 ? 'destructive' : 'default'} className="text-sm px-3 py-1">
            {pendingClaims.length} Pending
          </Badge>
          <Button onClick={loadPendingClaims} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Action result banner */}
      {actionResult && (
        <Alert variant={actionResult.type === 'success' ? 'default' : 'destructive'}>
          {actionResult.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          <AlertDescription>{actionResult.message}</AlertDescription>
        </Alert>
      )}

      {/* Main layout: pending list + claim detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Pending Claims List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5 text-yellow-600" />
              Pending Review ({pendingClaims.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[600px] overflow-y-auto">
            {pendingClaims.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
                <div className="font-medium text-gray-900">All Clear</div>
                <div className="text-sm text-gray-500">No superbills awaiting review</div>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingClaims.map(claim => (
                  <div
                    key={claim.id}
                    onClick={() => handleClaimSelect(claim)}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedClaim?.id === claim.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs text-gray-500">
                        {claim.control_number || claim.id.slice(0, 8)}
                      </span>
                      <Badge variant="secondary" className="text-xs">{claim.claim_type}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        ${(claim.total_charge ?? 0).toFixed(2)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(claim.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Claim Detail + Approval */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" />
              {selectedClaim ? 'Superbill Detail' : 'Select a Superbill'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedClaim ? (
              <div className="text-center py-12 text-gray-500">
                Select a superbill from the pending list to review
              </div>
            ) : (
              <div className="space-y-6">
                {/* Claim Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">Claim ID</div>
                    <div className="font-mono text-sm">{selectedClaim.control_number || selectedClaim.id.slice(0, 12)}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">Type</div>
                    <div className="text-sm font-medium">{selectedClaim.claim_type}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">Created</div>
                    <div className="text-sm">{new Date(selectedClaim.created_at).toLocaleString()}</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">Total Charges</div>
                    <div className="text-lg font-bold text-green-700 flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      {(selectedClaim.total_charge ?? 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Claim Lines */}
                <div>
                  <h3 className="font-bold text-sm text-gray-700 mb-2">Service Lines</h3>
                  {loadingLines ? (
                    <div className="text-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                    </div>
                  ) : claimLines.length === 0 ? (
                    <div className="text-sm text-gray-500 py-2">No service lines found</div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-3 py-2">Code</th>
                            <th className="text-left px-3 py-2">Modifiers</th>
                            <th className="text-right px-3 py-2">Units</th>
                            <th className="text-right px-3 py-2">Charge</th>
                            <th className="text-right px-3 py-2">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {claimLines.map(line => (
                            <tr key={line.id} className="border-t">
                              <td className="px-3 py-2 font-mono">
                                <Badge variant="outline" className="text-xs">{line.code_system}</Badge>
                                {' '}{line.procedure_code}
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                {line.modifiers.length > 0 ? line.modifiers.join(', ') : '-'}
                              </td>
                              <td className="px-3 py-2 text-right">{line.units}</td>
                              <td className="px-3 py-2 text-right">${line.charge_amount.toFixed(2)}</td>
                              <td className="px-3 py-2 text-right font-medium">
                                ${(line.charge_amount * line.units).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t-2">
                          <tr>
                            <td colSpan={4} className="px-3 py-2 font-bold text-right">Total</td>
                            <td className="px-3 py-2 text-right font-bold text-green-700">
                              ${totalCharges.toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* CMS Coverage Check Results */}
                {coverageCheck.status !== 'idle' && (
                  <CoverageCheckPanel coverageState={coverageCheck} />
                )}

                {/* Approval Section */}
                {!showRejectForm ? (
                  <div className="border-t pt-6 space-y-4">
                    <h3 className="font-bold text-gray-900">Provider Certification</h3>

                    {/* Agreement checkbox */}
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreementChecked}
                        onChange={(e) => setAgreementChecked(e.target.checked)}
                        className="mt-1 h-5 w-5 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">
                        I certify that the services listed were personally provided or supervised by me,
                        are medically necessary, and the documentation supports the codes and charges.
                        I understand that falsification may result in sanctions.
                      </span>
                    </label>

                    {/* Electronic signature */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">
                        Electronic Signature <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={signature}
                        onChange={(e) => setSignature(e.target.value)}
                        placeholder="Type your full name"
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>

                    {/* Optional notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes (optional)
                      </label>
                      <textarea
                        value={approvalNotes}
                        onChange={(e) => setApprovalNotes(e.target.value)}
                        placeholder="Any notes for this approval..."
                        rows={2}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-hidden resize-none"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setShowRejectForm(true)}
                        disabled={submitting}
                        className="flex items-center gap-2"
                      >
                        <XCircle className="h-4 w-4" /> Return for Revision
                      </Button>
                      <Button
                        onClick={handleApprove}
                        disabled={submitting || !signature.trim() || !agreementChecked}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                      >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                        Approve Superbill
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Rejection Form */
                  <div className="border-t pt-6 space-y-4">
                    <h3 className="font-bold text-red-900 flex items-center gap-2">
                      <XCircle className="h-5 w-5" /> Return for Revision
                    </h3>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">
                        Reason for Return <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Explain what needs to be corrected (minimum 10 characters)"
                        rows={3}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-hidden resize-none"
                        minLength={10}
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        {rejectionReason.trim().length} / 10 minimum characters
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setShowRejectForm(false)}
                        disabled={submitting}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleReject}
                        disabled={submitting || rejectionReason.trim().length < 10}
                        variant="destructive"
                        className="flex-1 flex items-center justify-center gap-2"
                      >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                        Return Superbill
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SuperbillReviewPanel;
