import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Send,
  Eye,
  Edit,
  DollarSign,
  FileText,
  TrendingUp
} from 'lucide-react';

interface ClaimLineItem {
  cpt_code: string;
  description: string;
  units: number;
  charge: number;
  icd10_codes: string[];
}

interface AIFlag {
  code: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  flagged_at: string;
}

interface Claim {
  id: string;
  claim_number: string;
  patient_name: string;
  provider_name: string;
  service_date: string;
  total_charge: number;
  expected_reimbursement: number;
  review_status: string;
  ai_confidence_score: number;
  ai_flags: AIFlag[];
  line_items: ClaimLineItem[];
  encounter_type: string;
  chief_complaint: string;
  created_at: string;
}

export function BillingReviewDashboard() {
  const { user } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewNotes, setReviewNotes] = useState('');
  const [filter, setFilter] = useState<'all' | 'flagged' | 'high_value'>('all');

  useEffect(() => {
    loadClaims();
  }, [filter]);

  const loadClaims = async () => {
    setLoading(true);
    try {
      // Load claims pending review
      const { data, error } = await supabase
        .from('claims')
        .select(`
          id,
          claim_number,
          service_date,
          total_charge,
          expected_reimbursement,
          review_status,
          ai_confidence_score,
          ai_flags,
          created_at,
          encounter_id,
          encounters (
            encounter_type,
            chief_complaint,
            patient:patient_id (
              full_name
            ),
            provider:provider_id (
              full_name
            )
          )
        `)
        .in('review_status', ['pending_review', 'flagged'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Load line items for each claim
      const claimsWithDetails = await Promise.all(
        (data || []).map(async (claim: any) => {
          const { data: lineItems } = await supabase
            .from('claim_lines')
            .select('cpt_code, description, units, charge_amount, icd10_codes')
            .eq('claim_id', claim.id);

          return {
            ...claim,
            patient_name: claim.encounters?.patient?.full_name || 'Unknown',
            provider_name: claim.encounters?.provider?.full_name || 'Unknown',
            encounter_type: claim.encounters?.encounter_type || 'Unknown',
            chief_complaint: claim.encounters?.chief_complaint || '',
            line_items: lineItems?.map((item: any) => ({
              cpt_code: item.cpt_code,
              description: item.description,
              units: item.units,
              charge: item.charge_amount,
              icd10_codes: item.icd10_codes || []
            })) || []
          };
        })
      );

      // Apply filters
      let filteredClaims = claimsWithDetails;
      if (filter === 'flagged') {
        filteredClaims = claimsWithDetails.filter(c =>
          c.ai_flags && c.ai_flags.length > 0
        );
      } else if (filter === 'high_value') {
        filteredClaims = claimsWithDetails.filter(c => c.total_charge > 500);
      }

      setClaims(filteredClaims);
    } catch (error) {
      console.error('Error loading claims:', error);
    } finally {
      setLoading(false);
    }
  };

  const approveClaim = async (claimId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('approve_claim', {
        p_claim_id: claimId,
        p_reviewer_id: user.id,
        p_review_notes: reviewNotes || null
      });

      if (error) throw error;

      if (data?.success) {
        // Move to submit step
        await submitClaim(claimId);
      } else {
        alert(data?.error || 'Failed to approve claim');
      }
    } catch (error) {
      console.error('Error approving claim:', error);
      alert('Error approving claim');
    }
  };

  const submitClaim = async (claimId: string) => {
    if (!user) return;

    const confirmSubmit = window.confirm(
      'Submit this claim to the clearinghouse? This action cannot be undone.'
    );

    if (!confirmSubmit) return;

    try {
      const { data, error } = await supabase.rpc('submit_claim_to_clearinghouse', {
        p_claim_id: claimId,
        p_submitter_id: user.id,
        p_clearinghouse_name: 'waystar'  // TODO: Make configurable
      });

      if (error) throw error;

      if (data?.success) {
        alert('Claim submitted successfully!');
        setSelectedClaim(null);
        setReviewNotes('');
        loadClaims();
      } else {
        alert(data?.error || 'Failed to submit claim');
      }
    } catch (error) {
      console.error('Error submitting claim:', error);
      alert('Error submitting claim');
    }
  };

  const rejectClaim = async (claimId: string) => {
    if (!user) return;

    const reason = window.prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      const { error } = await supabase.rpc('reject_claim', {
        p_claim_id: claimId,
        p_reviewer_id: user.id,
        p_rejection_reason: reason
      });

      if (error) throw error;

      alert('Claim rejected');
      setSelectedClaim(null);
      loadClaims();
    } catch (error) {
      console.error('Error rejecting claim:', error);
      alert('Error rejecting claim');
    }
  };

  const approveAndSubmit = async (claimId: string) => {
    // One-click: Approve + Submit
    await approveClaim(claimId);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.9) return 'text-green-600';
    if (score >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Billing Review Dashboard
        </h1>
        <p className="text-gray-600">
          Review AI-generated claims before submission
        </p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Review</p>
              <p className="text-2xl font-bold text-gray-900">
                {claims.filter(c => c.review_status === 'pending_review').length}
              </p>
            </div>
            <Clock className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Flagged</p>
              <p className="text-2xl font-bold text-orange-600">
                {claims.filter(c => c.review_status === 'flagged').length}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-green-600">
                ${claims.reduce((sum, c) => sum + c.total_charge, 0).toLocaleString()}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Expected Revenue</p>
              <p className="text-2xl font-bold text-blue-600">
                ${claims.reduce((sum, c) => sum + (c.expected_reimbursement || 0), 0).toLocaleString()}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          All Claims
        </button>
        <button
          onClick={() => setFilter('flagged')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'flagged'
              ? 'bg-orange-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          Flagged Only
        </button>
        <button
          onClick={() => setFilter('high_value')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'high_value'
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          High Value (&gt;$500)
        </button>
      </div>

      {/* Claims List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Claims List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Claims Awaiting Review ({claims.length})
          </h2>

          {claims.length === 0 ? (
            <div className="bg-white p-8 rounded-lg border border-gray-200 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <p className="text-gray-600">No claims pending review!</p>
            </div>
          ) : (
            claims.map(claim => (
              <div
                key={claim.id}
                onClick={() => setSelectedClaim(claim)}
                className={`bg-white p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedClaim?.id === claim.id
                    ? 'border-blue-500 shadow-lg'
                    : 'border-gray-200 hover:border-gray-300'
                } ${claim.review_status === 'flagged' ? 'bg-orange-50' : ''}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {claim.patient_name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Claim #{claim.claim_number}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">
                      ${claim.total_charge.toLocaleString()}
                    </p>
                    {claim.ai_confidence_score && (
                      <p className={`text-sm font-medium ${getConfidenceColor(claim.ai_confidence_score)}`}>
                        {(claim.ai_confidence_score * 100).toFixed(0)}% confident
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-sm text-gray-600 mb-2">
                  <p>Service: {new Date(claim.service_date).toLocaleDateString()}</p>
                  <p>Provider: {claim.provider_name}</p>
                  <p>Type: {claim.encounter_type}</p>
                </div>

                {/* Flags */}
                {claim.ai_flags && claim.ai_flags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {claim.ai_flags.slice(0, 2).map((flag, idx) => (
                      <span
                        key={idx}
                        className={`text-xs px-2 py-1 rounded-full border ${getSeverityColor(flag.severity)}`}
                      >
                        {flag.name}
                      </span>
                    ))}
                    {claim.ai_flags.length > 2 && (
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                        +{claim.ai_flags.length - 2} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Right: Claim Details */}
        <div className="lg:sticky lg:top-6 h-fit">
          {selectedClaim ? (
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedClaim.patient_name}
                  </h2>
                  <p className="text-gray-600">Claim #{selectedClaim.claim_number}</p>
                </div>
                <button
                  onClick={() => setSelectedClaim(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              {/* AI Confidence */}
              {selectedClaim.ai_confidence_score && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">AI Confidence</span>
                    <span className={`text-sm font-bold ${getConfidenceColor(selectedClaim.ai_confidence_score)}`}>
                      {(selectedClaim.ai_confidence_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        selectedClaim.ai_confidence_score >= 0.9
                          ? 'bg-green-600'
                          : selectedClaim.ai_confidence_score >= 0.7
                          ? 'bg-yellow-600'
                          : 'bg-red-600'
                      }`}
                      style={{ width: `${selectedClaim.ai_confidence_score * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Flags */}
              {selectedClaim.ai_flags && selectedClaim.ai_flags.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    ⚠️ Issues Detected ({selectedClaim.ai_flags.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedClaim.ai_flags.map((flag, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border ${getSeverityColor(flag.severity)}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{flag.name}</p>
                            {flag.details && Object.keys(flag.details).length > 0 && (
                              <p className="text-xs mt-1 opacity-75">
                                {JSON.stringify(flag.details)}
                              </p>
                            )}
                          </div>
                          <span className="text-xs uppercase font-bold ml-2">
                            {flag.severity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Line Items */}
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Billing Codes
                </h3>
                <div className="space-y-2">
                  {selectedClaim.line_items.map((item, idx) => (
                    <div key={idx} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-mono font-bold text-sm">{item.cpt_code}</p>
                        <p className="text-sm text-gray-600">{item.description}</p>
                        {item.icd10_codes && item.icd10_codes.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Dx: {item.icd10_codes.join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm text-gray-600">{item.units} unit(s)</p>
                        <p className="font-bold text-green-600">${item.charge.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Summary */}
              <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-700">Total Charge:</span>
                  <span className="text-xl font-bold text-gray-900">
                    ${selectedClaim.total_charge.toLocaleString()}
                  </span>
                </div>
                {selectedClaim.expected_reimbursement && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Expected Reimbursement:</span>
                    <span className="text-xl font-bold text-green-600">
                      ${selectedClaim.expected_reimbursement.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Review Notes */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Review Notes (Optional)
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add notes about this claim..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => approveAndSubmit(selectedClaim.id)}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
                >
                  <CheckCircle className="h-5 w-5" />
                  Approve & Submit
                </button>

                <button
                  onClick={() => rejectClaim(selectedClaim.id)}
                  className="flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                >
                  <XCircle className="h-5 w-5" />
                  Reject
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center mt-3">
                Claim will be submitted to clearinghouse after approval
              </p>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-lg border border-gray-200 text-center">
              <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Select a claim to review</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
