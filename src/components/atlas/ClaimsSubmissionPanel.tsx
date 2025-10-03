// Claims Submission Panel - Submit and track medical claims
// Integrates with Atlas billing workflow

import React, { useState, useEffect } from 'react';
import { BillingService } from '../../services/billingService';
import { EncounterService } from '../../services/encounterService';

interface ClaimFormData {
  encounterId: string;
  billingProviderId: string;
  payerId: string;
  claimType: string;
}

export const ClaimsSubmissionPanel: React.FC = () => {
  const [formData, setFormData] = useState<ClaimFormData>({
    encounterId: '',
    billingProviderId: '',
    payerId: '',
    claimType: '837P',
  });

  const [providers, setProviders] = useState<any[]>([]);
  const [payers, setPayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; claimId?: string } | null>(null);

  useEffect(() => {
    loadLookupData();
  }, []);

  const loadLookupData = async () => {
    setLoading(true);
    try {
      const [providersData, payersData] = await Promise.all([
        BillingService.getProviders(),
        BillingService.getPayers(),
      ]);
      setProviders(providersData);
      setPayers(payersData);
    } catch (error) {
      console.error('Failed to load lookup data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

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

      // Create claim
      const claim = await BillingService.createClaim({
        encounter_id: formData.encounterId,
        payer_id: formData.payerId,
        billing_provider_id: formData.billingProviderId,
        claim_type: formData.claimType,
        status: 'generated',
        total_charge: encounterData.totalCharges,
      });

      // Add claim lines from encounter procedures
      for (let i = 0; i < encounterData.procedures.length; i++) {
        const proc = encounterData.procedures[i];
        await BillingService.addClaimLine({
          claim_id: claim.id,
          code_system: 'CPT',
          procedure_code: proc.code,
          modifiers: proc.modifiers || [],
          units: proc.units || 1,
          charge_amount: proc.charge_amount || 0,
          diagnosis_pointers: proc.diagnosis_pointers || [1],
          service_date: proc.service_date || encounterData.encounter.date_of_service,
          position: i + 1,
        });
      }

      // Generate X12 837P file
      const x12Content = await BillingService.generateX12Claim(
        formData.encounterId,
        formData.billingProviderId
      );

      // Update claim with X12 content
      await BillingService.updateClaimStatus(claim.id, 'submitted', 'Claim generated and ready for submission');

      setResult({
        success: true,
        message: 'Claim created successfully! Ready for clearinghouse submission.',
        claimId: claim.id,
      });

      // Reset form
      setFormData({
        encounterId: '',
        billingProviderId: formData.billingProviderId,
        payerId: formData.payerId,
        claimType: '837P',
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

      {!loading && (
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
              The encounter must have procedures and diagnoses added before submitting
            </p>
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

      {/* Instructions */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">📝 Submission Workflow</h3>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Complete patient encounter with procedures and diagnoses</li>
          <li>Select billing provider and insurance payer</li>
          <li>System generates 837P X12 file automatically</li>
          <li>Claim is marked as "submitted" and ready for clearinghouse</li>
          <li>Monitor claim status in Revenue Dashboard</li>
        </ol>
      </div>
    </div>
  );
};

export default ClaimsSubmissionPanel;
