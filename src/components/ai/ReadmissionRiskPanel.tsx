/**
 * Readmission Risk Panel
 * Displays AI-powered 30-day readmission risk prediction at discharge
 * Shows risk factors, protective factors, and recommended interventions
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Shield,
  Calendar,
  Activity,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import type { ReadmissionPrediction } from '../../services/ai/readmissionRiskPredictor';
import { AIFeedbackButton } from './AIFeedbackButton';

interface ReadmissionRiskPanelProps {
  predictionId: string;
  onCreateCarePlan?: () => void;
  onScheduleFollowUp?: () => void;
}

export const ReadmissionRiskPanel: React.FC<ReadmissionRiskPanelProps> = ({
  predictionId,
  onCreateCarePlan,
  onScheduleFollowUp
}) => {
  const [prediction, setPrediction] = useState<ReadmissionPrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPrediction();
  }, [predictionId]);

  const loadPrediction = async () => {
    try {
      setLoading(true);
      // Load prediction from database
      // Implementation would fetch from readmission_risk_predictions table
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Activity className="animate-pulse h-6 w-6 text-blue-500 mr-2" />
            <span>Analyzing readmission risk...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !prediction) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || 'Failed to load prediction'}</AlertDescription>
      </Alert>
    );
  }

  const getRiskColor = (category: string) => {
    switch (category) {
      case 'critical':
        return {
          bg: 'bg-red-50',
          border: 'border-red-500',
          text: 'text-red-800',
          badgeBg: 'bg-red-100',
          badgeText: 'text-red-800'
        };
      case 'high':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-500',
          text: 'text-orange-800',
          badgeBg: 'bg-orange-100',
          badgeText: 'text-orange-800'
        };
      case 'moderate':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-500',
          text: 'text-yellow-800',
          badgeBg: 'bg-yellow-100',
          badgeText: 'text-yellow-800'
        };
      default:
        return {
          bg: 'bg-green-50',
          border: 'border-green-500',
          text: 'text-green-800',
          badgeBg: 'bg-green-100',
          badgeText: 'text-green-800'
        };
    }
  };

  const riskColors = getRiskColor(prediction.riskCategory);

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical':
      case 'high':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-blue-600" />;
    }
  };

  return (
    <Card className={`border-2 ${riskColors.border}`}>
      <CardHeader className={riskColors.bg}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {prediction.riskCategory in ['critical', 'high'] ? (
              <AlertTriangle className={`h-5 w-5 ${riskColors.text}`} />
            ) : (
              <Shield className="h-5 w-5 text-green-600" />
            )}
            <CardTitle className="text-lg">30-Day Readmission Risk Prediction</CardTitle>
          </div>
          <Badge className={`${riskColors.badgeBg} ${riskColors.badgeText} text-lg px-3 py-1`}>
            {(prediction.readmissionRisk30Day * 100).toFixed(0)}% Risk
          </Badge>
        </div>
        <CardDescription>
          Discharge Date: {new Date(prediction.dischargeDate).toLocaleDateString()} •
          Confidence: {(prediction.predictionConfidence * 100).toFixed(0)}% •
          Model: {prediction.aiModel}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Risk Level Summary */}
        <div className={`p-4 rounded-lg ${riskColors.bg} border ${riskColors.border}`}>
          <h3 className={`font-semibold mb-2 ${riskColors.text}`}>
            Risk Assessment: {prediction.riskCategory.toUpperCase()}
          </h3>
          <div className="grid grid-cols-3 gap-4 mt-3">
            <div className="text-center">
              <p className="text-xs text-gray-600">7-Day Risk</p>
              <p className="text-lg font-bold">{(prediction.readmissionRisk7Day * 100).toFixed(0)}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-600">30-Day Risk</p>
              <p className="text-2xl font-bold">{(prediction.readmissionRisk30Day * 100).toFixed(0)}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-600">90-Day Risk</p>
              <p className="text-lg font-bold">{(prediction.readmissionRisk90Day * 100).toFixed(0)}%</p>
            </div>
          </div>
          {prediction.predictedReadmissionDate && (
            <div className="mt-3 pt-3 border-t flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" />
              <span>Predicted readmission date: {new Date(prediction.predictedReadmissionDate).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Risk Factors */}
        {prediction.riskFactors.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-red-600" />
              <h3 className="font-semibold text-sm">Risk Factors Identified</h3>
            </div>
            <div className="space-y-2">
              {prediction.riskFactors.map((factor, index) => (
                <div
                  key={index}
                  className="border border-red-200 rounded-lg p-3 bg-red-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-red-900">{factor.factor}</span>
                        <Badge variant="outline" className="bg-red-100 text-red-800 text-xs">
                          {(factor.weight * 100).toFixed(0)}% impact
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 capitalize">{factor.category.replace('_', ' ')}</p>
                      {factor.evidence && (
                        <p className="text-xs text-gray-500 mt-1 italic">{factor.evidence}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Protective Factors */}
        {prediction.protectiveFactors.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="h-4 w-4 text-green-600" />
              <h3 className="font-semibold text-sm">Protective Factors</h3>
            </div>
            <div className="space-y-2">
              {prediction.protectiveFactors.map((factor, index) => (
                <div
                  key={index}
                  className="border border-green-200 rounded-lg p-3 bg-green-50"
                >
                  <div className="flex items-start">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-900">{factor.factor}</p>
                      <p className="text-xs text-gray-600 mt-1">{factor.impact}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Interventions */}
        {prediction.recommendedInterventions.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm mb-3">Recommended Interventions</h3>
            <div className="space-y-2">
              {prediction.recommendedInterventions.map((intervention, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-3 bg-white hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getPriorityIcon(intervention.priority)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{intervention.intervention}</span>
                        <Badge
                          variant="outline"
                          className={
                            intervention.priority === 'critical' || intervention.priority === 'high'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-blue-100 text-blue-800'
                          }
                        >
                          {intervention.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-600 mt-1">
                        <span>Timeframe: {intervention.timeframe}</span>
                        <span>Responsible: {intervention.responsible}</span>
                        <span>Impact: {(intervention.estimatedImpact * 100).toFixed(0)}% risk reduction</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data Sources */}
        <div className="bg-gray-50 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">Data Sources Analyzed</h4>
          <div className="flex flex-wrap gap-2">
            {prediction.dataSourcesAnalyzed.readmissionHistory && (
              <Badge variant="outline" className="text-xs">Readmission History</Badge>
            )}
            {prediction.dataSourcesAnalyzed.sdohIndicators && (
              <Badge variant="outline" className="text-xs">SDOH Indicators</Badge>
            )}
            {prediction.dataSourcesAnalyzed.checkinPatterns && (
              <Badge variant="outline" className="text-xs">Check-in Patterns</Badge>
            )}
            {prediction.dataSourcesAnalyzed.medicationAdherence && (
              <Badge variant="outline" className="text-xs">Medication Adherence</Badge>
            )}
            {prediction.dataSourcesAnalyzed.carePlanAdherence && (
              <Badge variant="outline" className="text-xs">Care Plan Adherence</Badge>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {prediction.riskCategory in ['high', 'critical'] && (
          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={onCreateCarePlan}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              Create Care Plan
            </Button>
            <Button
              onClick={onScheduleFollowUp}
              variant="outline"
              className="flex-1"
            >
              Schedule Follow-Up
            </Button>
          </div>
        )}

        {/* AI Feedback Section */}
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-xs text-gray-500">
            AI prediction for clinical decision support.
          </p>
          <AIFeedbackButton
            predictionId={predictionId}
            skillName="readmission_risk"
            size="sm"
            variant="inline"
            showLabels={false}
          />
        </div>
      </CardContent>
    </Card>
  );
};
