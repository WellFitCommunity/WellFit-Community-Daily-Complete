/**
 * Billing Code Suggestion Panel
 * Displays AI-generated billing code suggestions for encounters
 * Allows providers to accept, modify, or reject suggestions
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { CheckCircle2, XCircle, Edit, AlertTriangle, Sparkles, DollarSign } from 'lucide-react';
import { billingCodeSuggester } from '../../services/ai/billingCodeSuggester';
import type { BillingSuggestionResult } from '../../services/ai/billingCodeSuggester';

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

  useEffect(() => {
    if (suggestionId) {
      loadSuggestion();
    }
  }, [suggestionId]);

  const loadSuggestion = async () => {
    try {
      setLoading(true);
      // Load suggestion from database
      // Implementation would fetch from encounter_billing_suggestions table
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

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

        <p className="text-xs text-gray-500 text-center mt-2">
          AI suggestions are for reference only. Provider review and approval required.
        </p>
      </CardContent>
    </Card>
  );
};
