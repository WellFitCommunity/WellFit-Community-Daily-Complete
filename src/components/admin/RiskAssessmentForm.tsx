// Risk Assessment Form Component
// For healthcare professionals to assess senior patients

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';
import { RiskAssessment } from '../../types/riskAssessment';
import { claudeService } from '../../services/claudeService';

interface RiskAssessmentFormProps {
  patientId: string;
  patientName?: string;
  onSubmit?: (assessment: RiskAssessment) => void;
  onCancel?: () => void;
  existingAssessment?: RiskAssessment | null;
}

// RiskAssessment interface imported from shared types

const RISK_FACTORS_OPTIONS = [
  'Fall risk',
  'Medication non-compliance',
  'Social isolation',
  'Cognitive decline',
  'Multiple chronic conditions',
  'Recent hospitalization',
  'Living alone',
  'Depression/anxiety',
  'Poor nutrition',
  'Mobility limitations',
  'Substance abuse',
  'Financial difficulties'
];

const RECOMMENDED_ACTIONS_OPTIONS = [
  'Increase check-in frequency',
  'Physical therapy referral',
  'Medication review',
  'Social services referral',
  'Nutrition consultation',
  'Mental health support',
  'Home safety assessment',
  'Family involvement',
  'Care coordination',
  'Emergency contact update',
  'Medical specialist referral',
  'Assisted living evaluation'
];

const RiskAssessmentForm: React.FC<RiskAssessmentFormProps> = ({
  patientId,
  patientName,
  onSubmit,
  onCancel,
  existingAssessment
}) => {
  const supabase = useSupabaseClient();
  const user = useUser();

  const [formData, setFormData] = useState<Partial<RiskAssessment>>({
    patient_id: patientId,
    assessor_id: user?.id || '',
    risk_level: 'LOW',
    priority: 'LOW',
    medical_risk_score: 1,
    mobility_risk_score: 1,
    cognitive_risk_score: 1,
    social_risk_score: 1,
    overall_score: 1,
    assessment_notes: '',
    risk_factors: [],
    recommended_actions: [],
    next_assessment_due: '',
    review_frequency: 'monthly'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<{
    suggestedRiskLevel: string;
    riskFactors: string[];
    recommendations: string[];
    clinicalNotes: string;
  } | null>(null);
  const [analyzingAI, setAnalyzingAI] = useState(false);

  // Load existing assessment if provided
  useEffect(() => {
    if (existingAssessment) {
      setFormData({
        ...existingAssessment,
        next_assessment_due: existingAssessment.next_assessment_due ?
          new Date(existingAssessment.next_assessment_due).toISOString().split('T')[0] : ''
      });
    }
  }, [existingAssessment]);

  // Calculate overall score based on individual scores
  useEffect(() => {
    const { medical_risk_score, mobility_risk_score, cognitive_risk_score, social_risk_score } = formData;
    if (medical_risk_score && mobility_risk_score && cognitive_risk_score && social_risk_score) {
      const average = (medical_risk_score + mobility_risk_score + cognitive_risk_score + social_risk_score) / 4;
      setFormData(prev => ({ ...prev, overall_score: Math.round(average * 10) / 10 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.medical_risk_score, formData.mobility_risk_score, formData.cognitive_risk_score, formData.social_risk_score]);

  // Auto-calculate risk level based on overall score
  useEffect(() => {
    const score = formData.overall_score || 0;
    let riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

    if (score >= 8) {
      riskLevel = 'CRITICAL';
      priority = 'URGENT';
    } else if (score >= 6) {
      riskLevel = 'HIGH';
      priority = 'HIGH';
    } else if (score >= 4) {
      riskLevel = 'MODERATE';
      priority = 'MEDIUM';
    } else {
      riskLevel = 'LOW';
      priority = 'LOW';
    }

    setFormData(prev => ({ ...prev, risk_level: riskLevel, priority }));
  }, [formData.overall_score]);

  const handleScoreChange = (field: string, value: number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayFieldToggle = (field: 'risk_factors' | 'recommended_actions', value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field]?.includes(value)
        ? prev[field]?.filter(item => item !== value)
        : [...(prev[field] || []), value]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!user?.id) {
        throw new Error('You must be logged in to submit an assessment');
      }

      const assessmentData = {
        ...formData,
        assessor_id: user.id,
        next_assessment_due: formData.next_assessment_due || null
      };

      let result;
      if (existingAssessment?.id) {
        // Update existing assessment
        result = await supabase
          .from('risk_assessments')
          .update(assessmentData)
          .eq('id', existingAssessment.id)
          .select()
          .single();
      } else {
        // Create new assessment
        result = await supabase
          .from('risk_assessments')
          .insert([assessmentData])
          .select()
          .single();
      }

      if (result.error) throw result.error;

      setSuccess(existingAssessment ? 'Assessment updated successfully!' : 'Assessment saved successfully!');
      onSubmit?.(result.data as RiskAssessment);

    } catch (err) {
      console.error('Error saving assessment:', err);
      setError(err instanceof Error ? err.message : 'Failed to save assessment');
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MODERATE': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const runAIAnalysis = async () => {
    setAnalyzingAI(true);
    setError(null);
    try {
      const assessmentData = {
        medical_risk_score: formData.medical_risk_score,
        mobility_risk_score: formData.mobility_risk_score,
        cognitive_risk_score: formData.cognitive_risk_score,
        social_risk_score: formData.social_risk_score,
        risk_factors: formData.risk_factors,
        assessment_notes: formData.assessment_notes
      };

      const analysis = await claudeService.analyzeRiskAssessment(assessmentData);

      setAiAnalysis(analysis);
      setSuccess('AI analysis completed successfully. Review suggestions below.');
    } catch (err) {
      console.error('AI analysis failed:', err);
      setError('AI analysis is currently unavailable. Please continue with manual assessment.');
    } finally {
      setAnalyzingAI(false);
    }
  };

  const applyAISuggestions = () => {
    if (!aiAnalysis) return;

    setFormData(prev => ({
      ...prev,
      risk_level: aiAnalysis.suggestedRiskLevel as any,
      risk_factors: [...(prev.risk_factors || []), ...aiAnalysis.riskFactors.filter(f => !prev.risk_factors?.includes(f))],
      recommended_actions: [...(prev.recommended_actions || []), ...aiAnalysis.recommendations.filter(r => !prev.recommended_actions?.includes(r))],
      assessment_notes: prev.assessment_notes ?
        `${prev.assessment_notes}\n\nAI Analysis: ${aiAnalysis.clinicalNotes}` :
        `AI Analysis: ${aiAnalysis.clinicalNotes}`
    }));

    setSuccess('AI suggestions applied to assessment');
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>
            {existingAssessment ? 'Update' : 'New'} Risk Assessment
            {patientName && <span className="text-lg font-normal text-gray-600 ml-2">for {patientName}</span>}
          </span>
          <div className="flex items-center space-x-2">
            <Badge className={getRiskLevelColor(formData.risk_level || 'LOW')}>
              {formData.risk_level} RISK
            </Badge>
            <Badge variant="outline">
              Score: {formData.overall_score}/10
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Functional Assessment Questions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">📋 Functional Assessment Questions</h3>

            {/* Basic Mobility */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">🚶‍♀️ Mobility & Movement</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Can walk independently?</label>
                  <select
                    value={formData.walking_ability || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, walking_ability: e.target.value }))}
                    className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select...</option>
                    <option value="independent">Yes, without assistance</option>
                    <option value="cane">With cane/walker</option>
                    <option value="assistance">Needs human assistance</option>
                    <option value="wheelchair">Uses wheelchair</option>
                    <option value="bedbound">Unable to walk</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Can climb stairs?</label>
                  <select
                    value={formData.stair_climbing || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, stair_climbing: e.target.value }))}
                    className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select...</option>
                    <option value="independent">Yes, without help</option>
                    <option value="handrail">With handrail only</option>
                    <option value="assistance">Needs assistance</option>
                    <option value="unable">Cannot climb stairs</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Sitting & Standing */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">🪑 Sitting & Standing</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Can sit down safely?</label>
                  <select
                    value={formData.sitting_ability || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, sitting_ability: e.target.value }))}
                    className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select...</option>
                    <option value="independent">Yes, easily</option>
                    <option value="careful">Carefully, but independent</option>
                    <option value="assistance">Needs assistance</option>
                    <option value="unsafe">Unsafe without help</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Can stand up from chair?</label>
                  <select
                    value={formData.standing_ability || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, standing_ability: e.target.value }))}
                    className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select...</option>
                    <option value="independent">Yes, easily</option>
                    <option value="arms">Using arms for support</option>
                    <option value="assistance">Needs assistance</option>
                    <option value="unable">Cannot stand independently</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Bathroom Independence */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">🚽 Bathroom Independence</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Can get on/off toilet safely?</label>
                  <select
                    value={formData.toilet_transfer || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, toilet_transfer: e.target.value }))}
                    className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select...</option>
                    <option value="independent">Yes, independently</option>
                    <option value="grab_bars">With grab bars</option>
                    <option value="assistance">Needs assistance</option>
                    <option value="unsafe">Unsafe without help</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Bathing independence?</label>
                  <select
                    value={formData.bathing_ability || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, bathing_ability: e.target.value }))}
                    className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select...</option>
                    <option value="independent">Bathes independently</option>
                    <option value="shower_chair">Uses shower chair/aids</option>
                    <option value="assistance">Needs assistance</option>
                    <option value="full_help">Requires full help</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Daily Living Activities */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">🍽️ Daily Living Activities</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Can prepare meals?</label>
                  <select
                    value={formData.meal_preparation || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, meal_preparation: e.target.value }))}
                    className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select...</option>
                    <option value="independent">Yes, cooks full meals</option>
                    <option value="simple">Simple meals only</option>
                    <option value="microwave">Microwave/reheat only</option>
                    <option value="unable">Cannot prepare food</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Managing medications?</label>
                  <select
                    value={formData.medication_management || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, medication_management: e.target.value }))}
                    className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select...</option>
                    <option value="independent">Manages independently</option>
                    <option value="reminder">Needs reminders</option>
                    <option value="assistance">Needs assistance</option>
                    <option value="supervised">Requires supervision</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Fall Risk Assessment */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">⚠️ Fall Risk Factors</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  'History of falls',
                  'Fear of falling',
                  'Dizziness/lightheaded',
                  'Uses assistive device',
                  'Balance problems',
                  'Takes 4+ medications',
                  'Vision problems',
                  'Hearing problems',
                  'Foot problems',
                  'Home hazards present'
                ].map(factor => (
                  <label key={factor} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.fall_risk_factors?.includes(factor) || false}
                      onChange={() => {
                        const currentFactors = formData.fall_risk_factors || [];
                        const newFactors = currentFactors.includes(factor)
                          ? currentFactors.filter(f => f !== factor)
                          : [...currentFactors, factor];
                        setFormData(prev => ({ ...prev, fall_risk_factors: newFactors }));
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{factor}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Risk Scoring Section */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Clinical Risk Scores</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { field: 'medical_risk_score', label: 'Medical Risk', icon: '🏥' },
                { field: 'mobility_risk_score', label: 'Mobility Risk', icon: '🚶' },
                { field: 'cognitive_risk_score', label: 'Cognitive Risk', icon: '🧠' },
                { field: 'social_risk_score', label: 'Social Risk', icon: '👥' }
              ].map(({ field, label, icon }) => (
                <div key={field} className="space-y-2">
                  <label className="text-sm font-medium flex items-center">
                    <span className="mr-2">{icon}</span>
                    {label}
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={formData[field as keyof RiskAssessment] as number || 1}
                      onChange={(e) => handleScoreChange(field, parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-lg font-bold min-w-[2rem] text-center">
                      {formData[field as keyof RiskAssessment] as number || 1}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assessment Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Clinical Assessment Notes</label>
            <textarea
              value={formData.assessment_notes || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, assessment_notes: e.target.value }))}
              rows={4}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Document your clinical observations, concerns, and rationale for risk scores..."
            />
          </div>

          {/* AI Analysis Section */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-purple-900 flex items-center">
                <span className="mr-2">🤖</span>
                AI-Assisted Risk Analysis
              </h3>
              <Button
                type="button"
                onClick={runAIAnalysis}
                disabled={analyzingAI || loading}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {analyzingAI ? 'Analyzing...' : 'Run AI Analysis'}
              </Button>
            </div>

            {aiAnalysis && (
              <div className="space-y-4 mt-4">
                <div className="bg-white rounded-lg p-4 border border-purple-100">
                  <h4 className="font-semibold text-gray-900 mb-2">AI Recommendations:</h4>

                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Suggested Risk Level: </span>
                      <Badge className={getRiskLevelColor(aiAnalysis.suggestedRiskLevel)}>
                        {aiAnalysis.suggestedRiskLevel}
                      </Badge>
                    </div>

                    {aiAnalysis.riskFactors.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-700 block mb-1">
                          Additional Risk Factors:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {aiAnalysis.riskFactors.map((factor, idx) => (
                            <Badge key={idx} variant="outline" className="bg-orange-50">
                              {factor}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {aiAnalysis.recommendations.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-700 block mb-1">
                          Recommended Actions:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {aiAnalysis.recommendations.map((rec, idx) => (
                            <Badge key={idx} variant="outline" className="bg-blue-50">
                              {rec}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {aiAnalysis.clinicalNotes && (
                      <div>
                        <span className="text-sm font-medium text-gray-700 block mb-1">
                          Clinical Notes:
                        </span>
                        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                          {aiAnalysis.clinicalNotes}
                        </p>
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    onClick={applyAISuggestions}
                    disabled={loading}
                    className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    Apply AI Suggestions to Assessment
                  </Button>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-600">
              AI analysis uses Claude to review risk scores and patient data.
              Healthcare professional review and approval is always required.
            </p>
          </div>

          {/* Risk Factors */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Identified Risk Factors</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {RISK_FACTORS_OPTIONS.map(factor => (
                <label key={factor} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.risk_factors?.includes(factor) || false}
                    onChange={() => handleArrayFieldToggle('risk_factors', factor)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{factor}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Recommended Actions */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Recommended Interventions</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {RECOMMENDED_ACTIONS_OPTIONS.map(action => (
                <label key={action} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.recommended_actions?.includes(action) || false}
                    onChange={() => handleArrayFieldToggle('recommended_actions', action)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{action}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Follow-up Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Next Assessment Due</label>
              <input
                type="date"
                value={formData.next_assessment_due || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, next_assessment_due: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Review Frequency</label>
              <select
                value={formData.review_frequency || 'monthly'}
                onChange={(e) => setFormData(prev => ({ ...prev, review_frequency: e.target.value as any }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
          </div>

          {/* Status Messages */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 border-green-200 text-green-800">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-4 pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? 'Saving...' : (existingAssessment ? 'Update Assessment' : 'Save Assessment')}
            </Button>
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default RiskAssessmentForm;