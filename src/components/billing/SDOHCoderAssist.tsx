// Enhanced SDOH-aware billing coder assistant
// Integrates social determinants of health into coding workflow

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { SDOHBillingService } from '../../services/sdohBillingService';
import type {
  EnhancedCodingSuggestion,
  SDOHAssessment,
  BillingValidation,
  CCMTimeTracking,
  CCMActivity
} from '../../types/sdohBilling';

type Props = {
  encounterId: string;
  patientId: string;
  onSaved?: (data: { suggestionId: string; validationResults: BillingValidation }) => void;
};

export function SDOHCoderAssist({ encounterId, patientId, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<EnhancedCodingSuggestion | null>(null);
  const [validation, setValidation] = useState<BillingValidation | null>(null);
  const [activeTab, setActiveTab] = useState<'codes' | 'sdoh' | 'ccm' | 'compliance'>('codes');
  const [ccmTimeTracking, setCCMTimeTracking] = useState<CCMTimeTracking | null>(null);
  const [showTimeTracker, setShowTimeTracker] = useState(false);

  const disabled = useMemo(() => !encounterId || !patientId || loading || saving, [encounterId, patientId, loading, saving]);

  const fetchEnhancedSuggestions = async () => {
    setError(null);
    setLoading(true);
    setSuggestion(null);
    setValidation(null);

    try {
      // Get enhanced suggestions with SDOH analysis
      const enhancedSuggestion = await SDOHBillingService.analyzeEncounter(encounterId);
      setSuggestion(enhancedSuggestion);

      // Validate billing compliance
      const validationResults = await SDOHBillingService.validateBillingCompliance(enhancedSuggestion);
      setValidation(validationResults);

    } catch (e: any) {
      setError(e?.message || 'Failed to get enhanced coding suggestions');
    } finally {
      setLoading(false);
    }
  };

  const saveSuggestion = async () => {
    if (!suggestion || !validation) return;
    setSaving(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('coding_recommendations')
        .insert({
          encounter_id: encounterId,
          patient_id: patientId,
          payload: suggestion,
          confidence: suggestion.confidence,
        })
        .select('id')
        .single();

      if (error) throw new Error(error.message);

      if (onSaved) {
        onSaved({
          suggestionId: data.id,
          validationResults: validation
        });
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to save recommendation');
    } finally {
      setSaving(false);
    }
  };

  const startCCMTimeTracking = () => {
    setShowTimeTracker(true);
  };

  const saveCCMTimeTracking = async (activities: CCMActivity[]) => {
    try {
      const timeTracking = await SDOHBillingService.trackCCMTime(encounterId, patientId, activities);
      setCCMTimeTracking(timeTracking);
      setShowTimeTracker(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to save CCM time tracking');
    }
  };

  // Components
  const TabButton = ({ tab, label, count }: { tab: string; label: string; count?: number }) => (
    <button
      onClick={() => setActiveTab(tab as any)}
      className={`px-4 py-2 rounded-t-lg border-b-2 ${
        activeTab === tab
          ? 'border-blue-500 text-blue-600 bg-blue-50'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
      {count !== undefined && (
        <span className="ml-2 px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded-full">
          {count}
        </span>
      )}
    </button>
  );

  const CodeSection = ({ title, codes, type }: {
    title: string;
    codes: any[];
    type: 'icd10' | 'cpt' | 'hcpcs';
  }) => (
    <div className="border rounded-lg p-4 mb-4">
      <h4 className="font-semibold mb-3 flex items-center justify-between">
        {title}
        <span className="text-sm text-gray-500">{codes.length} codes</span>
      </h4>
      {codes.length > 0 ? (
        <div className="space-y-3">
          {codes.map((code, idx) => (
            <div key={`${type}-${idx}`} className="p-3 rounded border bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-mono font-semibold text-lg">{code.code}</div>
                  {code.rationale && (
                    <div className="text-sm text-gray-700 mt-1">{code.rationale}</div>
                  )}
                  {code.category === 'sdoh' && (
                    <div className="mt-2">
                      <span className="inline-block px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                        SDOH Code
                      </span>
                    </div>
                  )}
                  {code.principal && (
                    <span className="inline-block px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded ml-2">
                      Principal
                    </span>
                  )}
                </div>
                <div className="text-right">
                  {code.modifiers?.length > 0 && (
                    <div className="text-xs text-gray-600">Mod: {code.modifiers.join(', ')}</div>
                  )}
                  {code.timeRequired && (
                    <div className="text-xs text-blue-600">{code.timeRequired} min required</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500">No {title.toLowerCase()} codes suggested.</div>
      )}
    </div>
  );

  const SDOHAssessmentView = ({ assessment }: { assessment: SDOHAssessment }) => {
    const factors = [
      { key: 'housingInstability', label: 'Housing Instability', value: assessment.housingInstability },
      { key: 'foodInsecurity', label: 'Food Insecurity', value: assessment.foodInsecurity },
      { key: 'transportationBarriers', label: 'Transportation Barriers', value: assessment.transportationBarriers },
      { key: 'socialIsolation', label: 'Social Isolation', value: assessment.socialIsolation },
      { key: 'financialInsecurity', label: 'Financial Insecurity', value: assessment.financialInsecurity },
    ];

    return (
      <div className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-semibold">SDOH Complexity Assessment</h4>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">{assessment.overallComplexityScore}</div>
              <div className="text-xs text-gray-600">Complexity Score</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">CCM Eligible:</span>
              <span className={`ml-2 px-2 py-1 rounded text-xs ${
                assessment.ccmEligible
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {assessment.ccmEligible ? 'Yes' : 'No'}
              </span>
            </div>
            <div>
              <span className="font-medium">CCM Tier:</span>
              <span className={`ml-2 px-2 py-1 rounded text-xs ${
                assessment.ccmTier === 'complex'
                  ? 'bg-orange-100 text-orange-800'
                  : assessment.ccmTier === 'standard'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {assessment.ccmTier}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {factors.map(factor => (
            <div key={factor.key} className="border rounded p-3">
              <div className="font-medium text-sm mb-2">{factor.label}</div>
              {factor.value ? (
                <div className="space-y-1">
                  <div className="font-mono text-sm">{factor.value.zCode}</div>
                  <div className="text-xs text-gray-600">{factor.value.description}</div>
                  <div className="flex gap-2">
                    <span className={`px-2 py-1 text-xs rounded ${
                      factor.value.severity === 'severe'
                        ? 'bg-red-100 text-red-800'
                        : factor.value.severity === 'moderate'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {factor.value.severity}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded ${
                      factor.value.impact === 'high'
                        ? 'bg-red-100 text-red-800'
                        : factor.value.impact === 'medium'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {factor.value.impact} impact
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-400">No issues identified</div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const CCMRecommendationView = ({ recommendation }: { recommendation: any }) => (
    <div className="space-y-4">
      <div className="bg-green-50 p-4 rounded-lg">
        <h4 className="font-semibold mb-2">CCM Billing Recommendation</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Eligible:</span>
            <span className={`ml-2 px-2 py-1 rounded text-xs ${
              recommendation.eligible ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {recommendation.eligible ? 'Yes' : 'No'}
            </span>
          </div>
          <div>
            <span className="font-medium">Tier:</span>
            <span className="ml-2 font-mono">{recommendation.tier}</span>
          </div>
          <div>
            <span className="font-medium">Expected Reimbursement:</span>
            <span className="ml-2 font-mono text-green-600">${recommendation.expectedReimbursement.toFixed(2)}</span>
          </div>
        </div>
        <div className="mt-3">
          <div className="font-medium text-sm mb-1">Justification:</div>
          <div className="text-sm text-gray-700">{recommendation.justification}</div>
        </div>
      </div>

      <div className="border rounded p-4">
        <h5 className="font-medium mb-2">Required Documentation</h5>
        <ul className="text-sm space-y-1">
          {recommendation.requiredDocumentation.map((req: string, idx: number) => (
            <li key={idx} className="flex items-center">
              <div className="w-4 h-4 border rounded mr-2"></div>
              {req}
            </li>
          ))}
        </ul>
      </div>

      {recommendation.eligible && (
        <div className="bg-blue-50 p-4 rounded">
          <button
            onClick={startCCMTimeTracking}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Start CCM Time Tracking
          </button>
        </div>
      )}
    </div>
  );

  const ComplianceView = ({ validation }: { validation: BillingValidation }) => (
    <div className="space-y-4">
      <div className={`p-4 rounded-lg ${
        validation.isValid ? 'bg-green-50' : 'bg-red-50'
      }`}>
        <div className="flex items-center justify-between">
          <h4 className="font-semibold">
            Billing Compliance Status
          </h4>
          <span className={`px-3 py-1 rounded text-sm font-medium ${
            validation.isValid
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {validation.isValid ? 'Compliant' : 'Issues Found'}
          </span>
        </div>
      </div>

      {validation.errors.length > 0 && (
        <div className="border border-red-200 rounded p-4">
          <h5 className="font-medium text-red-800 mb-2">Errors ({validation.errors.length})</h5>
          <div className="space-y-2">
            {validation.errors.map((error, idx) => (
              <div key={idx} className="p-2 bg-red-50 rounded text-sm">
                <div className="font-medium text-red-800">{error.code}</div>
                <div className="text-red-700">{error.message}</div>
                <div className="text-xs text-red-600 mt-1">Field: {error.field}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="border border-yellow-200 rounded p-4">
          <h5 className="font-medium text-yellow-800 mb-2">Warnings ({validation.warnings.length})</h5>
          <div className="space-y-2">
            {validation.warnings.map((warning, idx) => (
              <div key={idx} className="p-2 bg-yellow-50 rounded text-sm">
                <div className="font-medium text-yellow-800">{warning.code}</div>
                <div className="text-yellow-700">{warning.message}</div>
                <div className="text-xs text-yellow-600 mt-1">{warning.recommendation}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {validation.auditFlags.length > 0 && (
        <div className="border border-orange-200 rounded p-4">
          <h5 className="font-medium text-orange-800 mb-2">Audit Flags ({validation.auditFlags.length})</h5>
          <div className="space-y-2">
            {validation.auditFlags.map((flag, idx) => (
              <div key={idx} className="p-2 bg-orange-50 rounded text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-orange-800">{flag.type}</div>
                  <span className={`px-2 py-1 text-xs rounded ${
                    flag.risk === 'high'
                      ? 'bg-red-100 text-red-800'
                      : flag.risk === 'medium'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {flag.risk} risk
                  </span>
                </div>
                <div className="text-orange-700 mt-1">{flag.description}</div>
                <div className="text-xs text-orange-600 mt-1">Remediation: {flag.remediation}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full rounded-xl border bg-white shadow-sm">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">SDOH Billing Encoder</h3>
            <div className="text-sm text-gray-600">
              Advanced coding with social determinants analysis
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchEnhancedSuggestions}
              disabled={disabled}
              className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-50 hover:bg-green-700"
            >
              {loading ? 'Analyzing…' : 'Analyze Encounter'}
            </button>
            <button
              onClick={saveSuggestion}
              disabled={!suggestion || !validation || saving}
              className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50 hover:bg-blue-700"
            >
              {saving ? 'Saving…' : 'Accept & Save'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        {suggestion && (
          <div className="flex border-b">
            <TabButton
              tab="codes"
              label="Codes"
              count={
                (suggestion.medicalCodes.icd10?.length || 0) +
                (suggestion.procedureCodes.cpt?.length || 0) +
                (suggestion.procedureCodes.hcpcs?.length || 0)
              }
            />
            <TabButton
              tab="sdoh"
              label="SDOH Analysis"
              count={suggestion.sdohAssessment.overallComplexityScore}
            />
            <TabButton
              tab="ccm"
              label="CCM Recommendation"
            />
            <TabButton
              tab="compliance"
              label="Compliance"
              count={validation ? validation.errors.length + validation.warnings.length : 0}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {!suggestion && !loading && !error && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-lg mb-2">Ready to analyze encounter</div>
            <div className="text-sm">
              Click "Analyze Encounter" to generate enhanced coding suggestions with SDOH analysis
            </div>
          </div>
        )}

        {suggestion && (
          <div>
            {/* Codes Tab */}
            {activeTab === 'codes' && (
              <div className="space-y-6">
                <CodeSection
                  title="ICD-10 Codes"
                  codes={suggestion.medicalCodes.icd10}
                  type="icd10"
                />
                <CodeSection
                  title="CPT Codes"
                  codes={suggestion.procedureCodes.cpt}
                  type="cpt"
                />
                <CodeSection
                  title="HCPCS Codes"
                  codes={suggestion.procedureCodes.hcpcs}
                  type="hcpcs"
                />
              </div>
            )}

            {/* SDOH Tab */}
            {activeTab === 'sdoh' && (
              <SDOHAssessmentView assessment={suggestion.sdohAssessment} />
            )}

            {/* CCM Tab */}
            {activeTab === 'ccm' && (
              <CCMRecommendationView recommendation={suggestion.ccmRecommendation} />
            )}

            {/* Compliance Tab */}
            {activeTab === 'compliance' && validation && (
              <ComplianceView validation={validation} />
            )}
          </div>
        )}

        {/* Summary Footer */}
        {suggestion && (
          <div className="mt-6 pt-4 border-t bg-gray-50 -m-6 p-6 rounded-b-xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="font-medium">Confidence Score</div>
                <div className="text-2xl font-bold text-blue-600">{suggestion.confidence}%</div>
              </div>
              <div>
                <div className="font-medium">Audit Readiness</div>
                <div className={`text-2xl font-bold ${
                  suggestion.auditReadiness.score >= 80
                    ? 'text-green-600'
                    : suggestion.auditReadiness.score >= 60
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}>
                  {suggestion.auditReadiness.score}%
                </div>
              </div>
              <div>
                <div className="font-medium">Expected Revenue</div>
                <div className="text-2xl font-bold text-green-600">
                  ${suggestion.ccmRecommendation.expectedReimbursement.toFixed(2)}
                </div>
              </div>
            </div>
            {suggestion.notes && (
              <div className="mt-3 text-sm text-gray-600">
                <span className="font-medium">Notes:</span> {suggestion.notes}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SDOHCoderAssist;