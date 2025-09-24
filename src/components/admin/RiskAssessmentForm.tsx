// Risk Assessment Form Component
// For healthcare professionals to assess senior patients

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';
import { RiskAssessment } from '../../types/riskAssessment';

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

          {/* Risk Scoring Section */}
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