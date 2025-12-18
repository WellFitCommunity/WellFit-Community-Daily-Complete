/**
 * Billing Code Suggestion Panel
 * Displays AI-generated billing code suggestions for encounters
 * Allows providers to accept, modify, or reject suggestions
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { CheckCircle2, XCircle, Edit, AlertTriangle, Sparkles, DollarSign, RefreshCw, FileText } from 'lucide-react';
import { billingCodeSuggester } from '../../services/ai/billingCodeSuggester';
import type { BillingSuggestionResult } from '../../services/ai/billingCodeSuggester';
import { AIFeedbackButton } from './AIFeedbackButton';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../../services/auditLogger';

interface BillingCodeSuggestionPanelProps {
  encounterId: string;
  suggestionId?: string;
  onAccept?: (suggestionId: string) => void;
  onModify?: (suggestionId: string, modifiedCodes: any) => void;
  onReject?: (suggestionId: string) => void;
}

export const BillingCodeSuggestionPanel: React.FC<BillingCodeSuggestionPanelProps> = ({
  encounterId,
  suggestionId,
  onAccept,
  onModify,
  onReject
}) => {
  const [suggestion, setSuggestion] = useState<BillingSuggestionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const loadSuggestion = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let suggestionData = null;

      if (suggestionId) {
        // Fetch specific suggestion by ID
        const { data, error: fetchError } = await supabase
          .from('encounter_billing_suggestions')
          .select('*')
          .eq('id', suggestionId)
          .single();

        if (fetchError) throw fetchError;
        suggestionData = data;
      } else if (encounterId) {
        // Fetch latest suggestion for this encounter
        const { data, error: fetchError } = await supabase
          .from('encounter_billing_suggestions')
          .select('*')
          .eq('encounter_id', encounterId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          // PGRST116 = no rows returned, which is ok
          throw fetchError;
        }
        suggestionData = data;
      }

      if (!suggestionData) {
        // No existing suggestion - show empty state
        setLoading(false);
        return;
      }

      // Transform database row to BillingSuggestionResult format
      const transformedSuggestion: BillingSuggestionResult = {
        encounterId: suggestionData.encounter_id,
        suggestedCodes: suggestionData.suggested_codes || { cpt: [], hcpcs: [], icd10: [] },
        overallConfidence: suggestionData.overall_confidence || 0,
        requiresReview: suggestionData.requires_review || false,
        reviewReason: suggestionData.review_reason,
        aiModel: suggestionData.ai_model || 'claude-3-haiku',
        aiCost: suggestionData.ai_cost || 0,
        fromCache: suggestionData.from_cache || false
      };

      setSuggestion(transformedSuggestion);
      auditLogger.clinical('BILLING_SUGGESTION_VIEWED', true, { encounterId, suggestionId });
    } catch (err: any) {
      auditLogger.error('BILLING_SUGGESTION_LOAD_FAILED', err, { encounterId, suggestionId });
      setError(err.message || 'Failed to load billing suggestions');
    } finally {
      setLoading(false);
    }
  }, [suggestionId, encounterId]);

  useEffect(() => {
    loadSuggestion();
  }, [loadSuggestion]);

  const handleAccept = async () => {
    if (!suggestionId) return;

    try {
      setProcessing(true);
      const userId = 'current-user-id'; // Get from auth context
      await billingCodeSuggester.acceptSuggestion(suggestionId, userId);
      onAccept?.(suggestionId);
      setProcessing(false);
    } catch (err: any) {
      setError(err.message);
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!suggestionId) return;

    try {
      setProcessing(true);
      const userId = 'current-user-id'; // Get from auth context
      await billingCodeSuggester.rejectSuggestion(suggestionId, userId);
      onReject?.(suggestionId);
      setProcessing(false);
    } catch (err: any) {
      setError(err.message);
      setProcessing(false);
    }
  };

  const handleModify = () => {
    if (!suggestionId) return;
    // Open modal or redirect to edit page
    onModify?.(suggestionId, suggestion?.suggestedCodes);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Sparkles className="animate-spin h-6 w-6 text-blue-500 mr-2" />
            <span>Loading AI suggestions...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!suggestion) {
    return null;
  }

  const allCodes = [
    ...suggestion.suggestedCodes.cpt,
    ...suggestion.suggestedCodes.hcpcs,
    ...suggestion.suggestedCodes.icd10
  ];

  // Calculate summary stats for all codes
  const avgConfidence = allCodes.length > 0
    ? allCodes.reduce((sum, code) => sum + code.confidence, 0) / allCodes.length
    : 0;
  const highConfidenceCodes = allCodes.filter(code => code.confidence >= 0.85).length;
  const lowConfidenceCodes = allCodes.filter(code => code.confidence < 0.60).length;

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.90) return 'bg-green-100 text-green-800 border-green-300';
    if (confidence >= 0.75) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (confidence >= 0.60) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.90) return 'Very High';
    if (confidence >= 0.75) return 'High';
    if (confidence >= 0.60) return 'Medium';
    return 'Low';
  };

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">AI Billing Code Suggestions</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {suggestion.fromCache && (
              <Badge variant="outline" className="bg-green-50 border-green-300 text-green-700">
                <DollarSign className="h-3 w-3 mr-1" />
                Cached (No Cost)
              </Badge>
            )}
            {!suggestion.fromCache && (
              <Badge variant="outline" className="bg-gray-50">
                Cost: ${suggestion.aiCost.toFixed(4)}
              </Badge>
            )}
            <Badge className={getConfidenceColor(suggestion.overallConfidence)}>
              {(suggestion.overallConfidence * 100).toFixed(0)}% Confidence
            </Badge>
          </div>
        </div>
        <CardDescription>
          Generated by {suggestion.aiModel} • {getConfidenceLabel(suggestion.overallConfidence)} confidence
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {/* Code Summary */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center mb-1">
              <FileText className="h-4 w-4 text-gray-500 mr-1" />
            </div>
            <div className="text-xl font-bold text-gray-900">{allCodes.length}</div>
            <div className="text-xs text-gray-500">Total Codes</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-green-700">{highConfidenceCodes}</div>
            <div className="text-xs text-green-600">High Confidence</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-blue-700">{(avgConfidence * 100).toFixed(0)}%</div>
            <div className="text-xs text-blue-600">Avg Confidence</div>
          </div>
          <div className={`rounded-lg p-3 text-center ${lowConfidenceCodes > 0 ? 'bg-yellow-50' : 'bg-gray-50'}`}>
            <div className={`text-xl font-bold ${lowConfidenceCodes > 0 ? 'text-yellow-700' : 'text-gray-400'}`}>
              {lowConfidenceCodes}
            </div>
            <div className={`text-xs ${lowConfidenceCodes > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>Need Review</div>
          </div>
        </div>

        {suggestion.requiresReview && (
          <Alert variant="default" className="bg-yellow-50 border-yellow-300">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Manual review recommended:</strong> {suggestion.reviewReason}
            </AlertDescription>
          </Alert>
        )}

        {/* CPT Codes */}
        {suggestion.suggestedCodes.cpt.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm text-gray-700 mb-2">CPT Codes</h3>
            <div className="space-y-2">
              {suggestion.suggestedCodes.cpt.map((code, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-3 bg-white hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                          {code.code}
                        </code>
                        <Badge
                          variant="outline"
                          className={getConfidenceColor(code.confidence)}
                        >
                          {(code.confidence * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700 mb-1">{code.description}</p>
                      <p className="text-xs text-gray-500 italic">{code.rationale}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HCPCS Codes */}
        {suggestion.suggestedCodes.hcpcs.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm text-gray-700 mb-2">HCPCS Codes</h3>
            <div className="space-y-2">
              {suggestion.suggestedCodes.hcpcs.map((code, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-3 bg-white hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                          {code.code}
                        </code>
                        <Badge
                          variant="outline"
                          className={getConfidenceColor(code.confidence)}
                        >
                          {(code.confidence * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700 mb-1">{code.description}</p>
                      <p className="text-xs text-gray-500 italic">{code.rationale}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ICD-10 Codes */}
        {suggestion.suggestedCodes.icd10.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm text-gray-700 mb-2">ICD-10 Diagnosis Codes</h3>
            <div className="space-y-2">
              {suggestion.suggestedCodes.icd10.map((code, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-3 bg-white hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                          {code.code}
                        </code>
                        <Badge
                          variant="outline"
                          className={getConfidenceColor(code.confidence)}
                        >
                          {(code.confidence * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700 mb-1">{code.description}</p>
                      <p className="text-xs text-gray-500 italic">{code.rationale}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t">
          <Button
            onClick={handleAccept}
            disabled={processing}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Accept All Codes
          </Button>
          <Button
            onClick={handleModify}
            disabled={processing}
            variant="outline"
            className="flex-1"
          >
            <Edit className="h-4 w-4 mr-2" />
            Modify & Accept
          </Button>
          <Button
            onClick={handleReject}
            disabled={processing}
            variant="outline"
            className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Reject
          </Button>
        </div>

        {/* AI Feedback Section */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-gray-500">
            AI suggestions are for reference only.
          </p>
          {suggestionId && (
            <AIFeedbackButton
              predictionId={suggestionId}
              skillName="billing_code_suggester"
              size="sm"
              variant="minimal"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
};
