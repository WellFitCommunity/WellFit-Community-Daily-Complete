// Claims Submission Panel - Submit and track medical claims
// Integrates with Atlus billing workflow using UnifiedBillingService
// NOW CONNECTED: SmartScribe → UnifiedBillingService → Atlus

import React, { useState, useEffect } from 'react';
import { BillingService } from '../../services/billingService';
import { UnifiedBillingService } from '../../services/unifiedBillingService';
import { EncounterService } from '../../services/encounterService';
import type { BillingWorkflowResult } from '../../services/unifiedBillingService';

interface ClaimFormData {
  encounterId: string;
  billingProviderId: string;
  payerId: string;
  claimType: string;
  patientId: string;
  encounterType: 'office_visit' | 'telehealth' | 'emergency' | 'procedure' | 'surgery';
  placeOfService: string;
}

export const ClaimsSubmissionPanel: React.FC = () => {
  const [formData, setFormData] = useState<ClaimFormData>({
    encounterId: '',
    billingProviderId: '',
    payerId: '',
    claimType: '837P',
    patientId: '',
    encounterType: 'office_visit',
    placeOfService: '11', // Office
  });

  const [providers, setProviders] = useState<any[]>([]);
  const [payers, setPayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; claimId?: string; workflowResult?: BillingWorkflowResult } | null>(null);
  const [x12Content, setX12Content] = useState<string | null>(null);
  const [workflowResult, setWorkflowResult] = useState<BillingWorkflowResult | null>(null);

  useEffect(() => {
    loadLookupData();
  }, []);

  const loadLookupData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [providersData, payersData] = await Promise.all([
        BillingService.getProviders(),
        BillingService.getPayers(),
      ]);
      setProviders(providersData);
      setPayers(payersData);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  const downloadX12File = () => {
    if (!x12Content || !result?.claimId) return;

    const blob = new Blob([x12Content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `claim_${result.claimId}_837P.x12`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const copyX12ToClipboard = async () => {
    if (!x12Content) return;

    try {
      await navigator.clipboard.writeText(x12Content);
      alert('X12 content copied to clipboard!');
    } catch (error) {

      alert('Failed to copy to clipboard');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    setWorkflowResult(null);

    try {
      // Validate encounter has required data
      const encounterData = await EncounterService.getEncounterForBilling(formData.encounterId);
      const validation = EncounterService.validateEncounterForBilling(encounterData.encounter);

      if (!validation.valid) {
        setResult({
          success: false,
          message: `Validation failed: ${validation.errors.join(', ')}`,
        });
        return;
      }

      // ✅ NEW: Use UnifiedBillingService with FULL smart scribe integration
      // This will:
      // - Load scribe session data automatically
      // - Pre-populate AI-suggested CPT/ICD-10 codes
      // - Auto-add CCM billing codes if eligible (20+ minutes)
      // - Include SDOH codes and complexity assessment
      // - Run decision tree analysis
      // - Validate billing compliance
      const billingWorkflowResult = await UnifiedBillingService.processBillingWorkflow({
        encounterId: formData.encounterId,
        patientId: formData.patientId,
        providerId: formData.billingProviderId,
        payerId: formData.payerId,
        serviceDate: encounterData.encounter.date_of_service,
        encounterType: formData.encounterType,
        diagnoses: encounterData.diagnoses?.map((d: any) => ({
          term: d.description || d.term,
          icd10Code: d.code || d.icd10Code,
        })) || [],
        procedures: encounterData.procedures?.map((p: any) => ({
          description: p.description,
          cptCode: p.code || p.cptCode,
        })) || [],
        placeOfService: formData.placeOfService,
        enableAIAssist: true,
        enableSDOHAnalysis: true,
        enableDecisionTree: true,
        autoSubmit: true,
      });

      setWorkflowResult(billingWorkflowResult);

      if (!billingWorkflowResult.success) {
        setResult({
          success: false,
          message: `Billing workflow failed: ${billingWorkflowResult.errors.map(e => e.message).join(', ')}`,
        });
        return;
      }

      // Generate X12 837P file (already done if autoSubmit=true, but we need content for display)
      const x12Data = await BillingService.generateX12Claim(
        formData.encounterId,
        formData.billingProviderId
      );

      // Save X12 content for display and download
      setX12Content(x12Data);

      // Build success message with smart insights
      const successMessages = [];
      successMessages.push('Claim created successfully with AI-powered coding!');

      if (billingWorkflowResult.codingSuggestions && 'sdohAssessment' in billingWorkflowResult.codingSuggestions && billingWorkflowResult.codingSuggestions.sdohAssessment) {
        const sdoh = billingWorkflowResult.codingSuggestions.sdohAssessment;
        if (sdoh.ccmEligible) {
          successMessages.push(`CCM Eligible: ${sdoh.ccmTier} tier automatically added`);
        }
      }

      if (billingWorkflowResult.claimLines && billingWorkflowResult.claimLines.length > 0) {
        const ccmLines = billingWorkflowResult.claimLines.filter(
          line => line.procedure_code === '99490' || line.procedure_code === '99439'
        );
        if (ccmLines.length > 0) {
          successMessages.push(`${ccmLines.length} CCM billing code(s) auto-added from scribe session`);
        }
      }

      if (billingWorkflowResult.warnings.length > 0) {
        successMessages.push(`${billingWorkflowResult.warnings.length} coding optimization(s) suggested`);
      }

      setResult({
        success: true,
        message: successMessages.join(' • '),
        claimId: billingWorkflowResult.claim?.id,
        workflowResult: billingWorkflowResult,
      });

      // Reset form
      setFormData({
        encounterId: '',
        billingProviderId: formData.billingProviderId,
        payerId: formData.payerId,
        claimType: '837P',
        patientId: '',
        encounterType: 'office_visit',
        placeOfService: '11',
      });
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || 'Failed to create claim',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">📋 Submit Medical Claim</h2>
        <p className="text-sm text-gray-600 mt-1">
          Generate and submit 837P professional claims to clearinghouses
        </p>
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          <p className="mt-2 text-gray-600">Loading billing data...</p>
        </div>
      )}

      {!loading && loadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h3 className="text-lg font-bold text-red-900 mb-2">Failed to Load Billing Data</h3>
          <p className="text-red-700 mb-4">{loadError}</p>
          <button
            onClick={loadLookupData}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !loadError && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Encounter ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Encounter ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.encounterId}
              onChange={(e) => setFormData({ ...formData, encounterId: e.target.value })}
              placeholder="Enter encounter UUID"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              System will auto-load scribe session data and AI-suggested codes
            </p>
          </div>

          {/* Patient ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Patient ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.patientId}
              onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
              placeholder="Enter patient UUID"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Encounter Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Encounter Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.encounterType}
              onChange={(e) => setFormData({ ...formData, encounterType: e.target.value as any })}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="office_visit">Office Visit</option>
              <option value="telehealth">Telehealth</option>
              <option value="emergency">Emergency</option>
              <option value="procedure">Procedure</option>
              <option value="surgery">Surgery</option>
            </select>
          </div>

          {/* Place of Service */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Place of Service <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.placeOfService}
              onChange={(e) => setFormData({ ...formData, placeOfService: e.target.value })}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="11">11 - Office</option>
              <option value="02">02 - Telehealth</option>
              <option value="23">23 - Emergency Room</option>
              <option value="21">21 - Inpatient Hospital</option>
              <option value="22">22 - Outpatient Hospital</option>
            </select>
          </div>

          {/* Billing Provider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Billing Provider <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.billingProviderId}
              onChange={(e) => setFormData({ ...formData, billingProviderId: e.target.value })}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select provider...</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.organization_name || `Provider ${provider.npi}`} (NPI: {provider.npi})
                </option>
              ))}
            </select>
          </div>

          {/* Payer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Insurance Payer <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.payerId}
              onChange={(e) => setFormData({ ...formData, payerId: e.target.value })}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select payer...</option>
              {payers.map((payer) => (
                <option key={payer.id} value={payer.id}>
                  {payer.name}
                </option>
              ))}
            </select>
          </div>

          {/* Claim Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Claim Type</label>
            <select
              value={formData.claimType}
              onChange={(e) => setFormData({ ...formData, claimType: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="837P">837P - Professional (CMS-1500)</option>
              <option value="837I">837I - Institutional (UB-04)</option>
            </select>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
            >
              {submitting ? 'Generating Claim...' : 'Generate & Submit Claim'}
            </button>
          </div>
        </form>
      )}

      {/* Result Message */}
      {result && (
        <div
          className={`mt-6 p-4 rounded-lg border-2 ${
            result.success
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">
              {result.success ? '✅' : '❌'}
            </span>
            <div className="flex-1">
              <h3
                className={`font-semibold ${
                  result.success ? 'text-green-900' : 'text-red-900'
                }`}
              >
                {result.success ? 'Success!' : 'Error'}
              </h3>
              <p
                className={`text-sm mt-1 ${
                  result.success ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {result.message}
              </p>
              {result.success && result.claimId && (
                <div className="mt-3 p-3 bg-white rounded border border-green-200">
                  <p className="text-xs text-gray-600">Claim ID:</p>
                  <code className="text-sm font-mono text-blue-600">{result.claimId}</code>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Workflow Insights - Show what UnifiedBillingService found */}
      {workflowResult && workflowResult.success && (
        <div className="mt-6 p-6 bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl">
          <h3 className="text-lg font-bold text-purple-900 mb-4 flex items-center">
            <span className="mr-2">🤖</span>
            Smart Billing Workflow Insights
          </h3>

          {/* Financial Summary */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-white rounded-lg shadow">
              <div className="text-xs text-gray-600 mb-1">Total Charges</div>
              <div className="text-2xl font-bold text-gray-900">
                ${workflowResult.totalCharges.toFixed(2)}
              </div>
            </div>
            <div className="p-4 bg-white rounded-lg shadow">
              <div className="text-xs text-gray-600 mb-1">Est. Reimbursement</div>
              <div className="text-2xl font-bold text-green-600">
                ${workflowResult.estimatedReimbursement.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Workflow Steps */}
          <div className="mb-4">
            <div className="text-sm font-semibold text-purple-900 mb-2">Workflow Steps Completed:</div>
            <div className="space-y-2">
              {workflowResult.workflowSteps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <span className={
                    step.status === 'completed' ? 'text-green-600' :
                    step.status === 'failed' ? 'text-red-600' :
                    'text-gray-400'
                  }>
                    {step.status === 'completed' ? '✓' : step.status === 'failed' ? '✗' : '○'}
                  </span>
                  <span className="text-gray-700">{step.stepName}</span>
                  {step.duration && (
                    <span className="text-xs text-gray-500">({step.duration}ms)</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Warnings */}
          {workflowResult.warnings.length > 0 && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <div className="text-sm font-semibold text-yellow-900 mb-2">
                ⚠️ Coding Optimizations ({workflowResult.warnings.length})
              </div>
              <div className="space-y-1">
                {workflowResult.warnings.slice(0, 3).map((warning, idx) => (
                  <div key={idx} className="text-xs text-yellow-800">
                    • {warning.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Actions */}
          {workflowResult.recommendedActions.length > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="text-sm font-semibold text-blue-900 mb-2">
                💡 Recommended Actions
              </div>
              <div className="space-y-1">
                {workflowResult.recommendedActions.map((action, idx) => (
                  <div key={idx} className="text-xs text-blue-800">
                    • {action}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manual Review Flag */}
          {workflowResult.requiresManualReview && (
            <div className="mt-4 p-3 bg-red-50 border-2 border-red-300 rounded">
              <div className="text-sm font-bold text-red-900 mb-1">
                🚨 Manual Review Required
              </div>
              <div className="text-xs text-red-800">
                {workflowResult.manualReviewReasons.join(' • ')}
              </div>
            </div>
          )}
        </div>
      )}

      {/* X12 Content Display */}
      {x12Content && result?.success && (
        <div className="mt-6 p-6 bg-gray-50 border-2 border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <span className="mr-2">📄</span>
              Generated X12 837P File
            </h3>
            <div className="flex gap-2">
              <button
                onClick={copyX12ToClipboard}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
                title="Copy to clipboard"
              >
                📋 Copy
              </button>
              <button
                onClick={downloadX12File}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                title="Download X12 file"
              >
                ⬇️ Download
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
            <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
              <span className="text-sm text-gray-300 font-mono">claim_{result.claimId}_837P.x12</span>
              <span className="text-xs text-gray-400">{x12Content.length} characters</span>
            </div>
            <div className="p-4 overflow-x-auto">
              <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap break-words">
                {x12Content}
              </pre>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-800">
              <strong>Next Steps:</strong> Download this X12 file and submit it to your clearinghouse for processing.
              The file is formatted according to HIPAA 837P standards.
            </p>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">📝 Smart Billing Workflow (AI-Powered)</h3>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Complete patient encounter (SmartScribe auto-records codes)</li>
          <li>Enter encounter and patient IDs</li>
          <li>System auto-loads scribe session with AI-suggested codes</li>
          <li>CCM billing codes (99490/99439) auto-added if 20+ minutes</li>
          <li>SDOH codes auto-included based on patient assessment</li>
          <li>Decision tree validates medical necessity</li>
          <li>837P X12 file generated with compliance validation</li>
          <li>Monitor claim status in Revenue Dashboard</li>
        </ol>
        <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded">
          <p className="text-xs text-purple-900 font-semibold">
            🤖 NEW: This panel now uses UnifiedBillingService - the complete integration of SmartScribe AI coding,
            SDOH assessment, CCM time tracking, and Atlus revenue optimization.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ClaimsSubmissionPanel;
