/**
 * Cognitive Assessment Form - MoCA & MMSE
 *
 * Features:
 * - MoCA (Montreal Cognitive Assessment) - 30 points
 * - MMSE (Mini-Mental State Examination) - 30 points
 * - Education adjustment for MoCA
 * - Auto-calculated total scores
 * - Cognitive status interpretation
 *
 * Use Cases:
 * - Dementia screening
 * - MCI detection
 * - Cognitive decline monitoring
 * - Pre/post intervention assessments
 *
 * For: Neurologists, geriatricians, neuropsychologists, memory clinic staff
 */

import React, { useState, useEffect } from 'react';
import { NeuroSuiteService } from '../../services/neuroSuiteService';
import type {
  CreateCognitiveAssessmentRequest,
  CognitiveAssessmentTool,
} from '../../types/neuroSuite';

interface CognitiveAssessmentFormProps {
  patientId: string;
  encounterId?: string;
  onComplete?: (assessmentId: string) => void;
  onCancel?: () => void;
}

export const CognitiveAssessmentForm: React.FC<CognitiveAssessmentFormProps> = ({
  patientId,
  encounterId,
  onComplete,
  onCancel,
}) => {
  const [assessmentTool, setAssessmentTool] = useState<CognitiveAssessmentTool>('MoCA');
  const [formData, setFormData] = useState<Partial<CreateCognitiveAssessmentRequest>>({
    patient_id: patientId,
    encounter_id: encounterId,
    assessment_tool: 'MoCA',
    assessment_date: new Date().toISOString(),
  });

  const [totalScore, setTotalScore] = useState(0);
  const [cognitiveStatus, setCognitiveStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Calculate total score based on assessment tool
  useEffect(() => {
    let score = 0;
    let status = '';

    if (assessmentTool === 'MoCA') {
      score =
        (formData.moca_visuospatial || 0) +
        (formData.moca_naming || 0) +
        (formData.moca_attention || 0) +
        (formData.moca_language || 0) +
        (formData.moca_abstraction || 0) +
        (formData.moca_delayed_recall || 0) +
        (formData.moca_orientation || 0);

      // Apply education adjustment (add 1 if ≤12 years)
      if (formData.years_education && formData.years_education <= 12) {
        score += 1;
      }

      // Interpret score
      if (score >= 26) status = 'Normal cognition';
      else if (score >= 18) status = 'Mild Cognitive Impairment (MCI)';
      else status = 'Cognitive impairment consistent with dementia';
    } else if (assessmentTool === 'MMSE') {
      score =
        (formData.mmse_orientation_time || 0) +
        (formData.mmse_orientation_place || 0) +
        (formData.mmse_registration || 0) +
        (formData.mmse_attention_calculation || 0) +
        (formData.mmse_recall || 0) +
        (formData.mmse_naming || 0) +
        (formData.mmse_repetition || 0) +
        (formData.mmse_comprehension || 0) +
        (formData.mmse_reading || 0) +
        (formData.mmse_writing || 0) +
        (formData.mmse_drawing || 0);

      // Interpret score
      if (score >= 24) status = 'Normal cognition';
      else if (score >= 18) status = 'Mild cognitive impairment';
      else if (score >= 10) status = 'Moderate cognitive impairment';
      else status = 'Severe cognitive impairment';
    }

    setTotalScore(score);
    setCognitiveStatus(status);
  }, [formData, assessmentTool]);

  const handleInputChange = (field: keyof CreateCognitiveAssessmentRequest, value: CreateCognitiveAssessmentRequest[keyof CreateCognitiveAssessmentRequest]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleToolChange = (tool: CognitiveAssessmentTool) => {
    setAssessmentTool(tool);
    setFormData((prev) => ({ ...prev, assessment_tool: tool }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await NeuroSuiteService.createCognitiveAssessment(
        formData as CreateCognitiveAssessmentRequest
      );

      if (response.success && response.data) {
        alert(`Cognitive assessment completed. Score: ${totalScore}/30 (${cognitiveStatus})`);
        if (onComplete) onComplete(response.data.id);
      } else {
        alert(`Error saving assessment: ${response.error}`);
      }
    } catch (error) {

      alert('Failed to save assessment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6 p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="border-b-2 pb-4">
        <h1 className="text-2xl font-bold">Cognitive Assessment</h1>
        <p className="text-gray-600">Patient ID: {patientId}</p>
      </div>

      {/* Assessment Tool Selector */}
      <div className="bg-blue-50 p-4 rounded-sm">
        <label className="block font-medium mb-2">Select Assessment Tool</label>
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => handleToolChange('MoCA')}
            className={`px-6 py-3 rounded-lg font-semibold ${
              assessmentTool === 'MoCA'
                ? 'bg-blue-600 text-white'
                : 'bg-white border-2 border-gray-300 hover:border-blue-400'
            }`}
          >
            MoCA
            <div className="text-xs font-normal">(Montreal Cognitive Assessment)</div>
          </button>
          <button
            type="button"
            onClick={() => handleToolChange('MMSE')}
            className={`px-6 py-3 rounded-lg font-semibold ${
              assessmentTool === 'MMSE'
                ? 'bg-blue-600 text-white'
                : 'bg-white border-2 border-gray-300 hover:border-blue-400'
            }`}
          >
            MMSE
            <div className="text-xs font-normal">(Mini-Mental State Exam)</div>
          </button>
        </div>
      </div>

      {/* Education Level (for MoCA adjustment) */}
      {assessmentTool === 'MoCA' && (
        <div className="bg-yellow-50 p-4 rounded-sm">
          <label className="block font-medium mb-2">Years of Education</label>
          <input
            type="number"
            value={formData.years_education || ''}
            onChange={(e) => handleInputChange('years_education', parseInt(e.target.value))}
            className="w-32 border rounded-sm p-2"
            placeholder="12"
          />
          <p className="text-sm text-gray-600 mt-2">
            ℹ️ Add 1 point to total score if education ≤12 years
          </p>
        </div>
      )}

      {/* MoCA Scoring */}
      {assessmentTool === 'MoCA' && (
        <div className="space-y-4 bg-gray-50 p-4 rounded-sm">
          <h2 className="text-xl font-bold">MoCA Scoring (Total: 30 points)</h2>

          <div className="border-b pb-3">
            <label className="block font-medium mb-2">1. Visuospatial/Executive (0-5)</label>
            <div className="text-sm text-gray-600 mb-2">Trail making, cube copy, clock drawing</div>
            <input
              type="number"
              min="0"
              max="5"
              value={formData.moca_visuospatial || ''}
              onChange={(e) => handleInputChange('moca_visuospatial', parseInt(e.target.value) || 0)}
              className="w-20 border rounded-sm p-2"
            />
          </div>

          <div className="border-b pb-3">
            <label className="block font-medium mb-2">2. Naming (0-3)</label>
            <div className="text-sm text-gray-600 mb-2">Lion, rhinoceros, camel</div>
            <input
              type="number"
              min="0"
              max="3"
              value={formData.moca_naming || ''}
              onChange={(e) => handleInputChange('moca_naming', parseInt(e.target.value) || 0)}
              className="w-20 border rounded-sm p-2"
            />
          </div>

          <div className="border-b pb-3">
            <label className="block font-medium mb-2">3. Attention (0-6)</label>
            <div className="text-sm text-gray-600 mb-2">Digits forward/backward, vigilance, serial 7s</div>
            <input
              type="number"
              min="0"
              max="6"
              value={formData.moca_attention || ''}
              onChange={(e) => handleInputChange('moca_attention', parseInt(e.target.value) || 0)}
              className="w-20 border rounded-sm p-2"
            />
          </div>

          <div className="border-b pb-3">
            <label className="block font-medium mb-2">4. Language (0-3)</label>
            <div className="text-sm text-gray-600 mb-2">Sentence repetition, fluency</div>
            <input
              type="number"
              min="0"
              max="3"
              value={formData.moca_language || ''}
              onChange={(e) => handleInputChange('moca_language', parseInt(e.target.value) || 0)}
              className="w-20 border rounded-sm p-2"
            />
          </div>

          <div className="border-b pb-3">
            <label className="block font-medium mb-2">5. Abstraction (0-2)</label>
            <div className="text-sm text-gray-600 mb-2">Similarities (train-bicycle, watch-ruler)</div>
            <input
              type="number"
              min="0"
              max="2"
              value={formData.moca_abstraction || ''}
              onChange={(e) => handleInputChange('moca_abstraction', parseInt(e.target.value) || 0)}
              className="w-20 border rounded-sm p-2"
            />
          </div>

          <div className="border-b pb-3">
            <label className="block font-medium mb-2">6. Delayed Recall (0-5)</label>
            <div className="text-sm text-gray-600 mb-2">
              Recall 5 words (face, velvet, church, daisy, red)
            </div>
            <input
              type="number"
              min="0"
              max="5"
              value={formData.moca_delayed_recall || ''}
              onChange={(e) => handleInputChange('moca_delayed_recall', parseInt(e.target.value) || 0)}
              className="w-20 border rounded-sm p-2"
            />
          </div>

          <div className="border-b pb-3">
            <label className="block font-medium mb-2">7. Orientation (0-6)</label>
            <div className="text-sm text-gray-600 mb-2">Date, month, year, day, place, city</div>
            <input
              type="number"
              min="0"
              max="6"
              value={formData.moca_orientation || ''}
              onChange={(e) => handleInputChange('moca_orientation', parseInt(e.target.value) || 0)}
              className="w-20 border rounded-sm p-2"
            />
          </div>
        </div>
      )}

      {/* MMSE Scoring */}
      {assessmentTool === 'MMSE' && (
        <div className="space-y-4 bg-gray-50 p-4 rounded-sm">
          <h2 className="text-xl font-bold">MMSE Scoring (Total: 30 points)</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border-b pb-3">
              <label className="block font-medium mb-2">Orientation - Time (0-5)</label>
              <input
                type="number"
                min="0"
                max="5"
                value={formData.mmse_orientation_time || ''}
                onChange={(e) => handleInputChange('mmse_orientation_time', parseInt(e.target.value) || 0)}
                className="w-20 border rounded-sm p-2"
              />
            </div>

            <div className="border-b pb-3">
              <label className="block font-medium mb-2">Orientation - Place (0-5)</label>
              <input
                type="number"
                min="0"
                max="5"
                value={formData.mmse_orientation_place || ''}
                onChange={(e) => handleInputChange('mmse_orientation_place', parseInt(e.target.value) || 0)}
                className="w-20 border rounded-sm p-2"
              />
            </div>

            <div className="border-b pb-3">
              <label className="block font-medium mb-2">Registration (0-3)</label>
              <input
                type="number"
                min="0"
                max="3"
                value={formData.mmse_registration || ''}
                onChange={(e) => handleInputChange('mmse_registration', parseInt(e.target.value) || 0)}
                className="w-20 border rounded-sm p-2"
              />
            </div>

            <div className="border-b pb-3">
              <label className="block font-medium mb-2">Attention/Calculation (0-5)</label>
              <input
                type="number"
                min="0"
                max="5"
                value={formData.mmse_attention_calculation || ''}
                onChange={(e) => handleInputChange('mmse_attention_calculation', parseInt(e.target.value) || 0)}
                className="w-20 border rounded-sm p-2"
              />
            </div>

            <div className="border-b pb-3">
              <label className="block font-medium mb-2">Recall (0-3)</label>
              <input
                type="number"
                min="0"
                max="3"
                value={formData.mmse_recall || ''}
                onChange={(e) => handleInputChange('mmse_recall', parseInt(e.target.value) || 0)}
                className="w-20 border rounded-sm p-2"
              />
            </div>

            <div className="border-b pb-3">
              <label className="block font-medium mb-2">Naming (0-2)</label>
              <input
                type="number"
                min="0"
                max="2"
                value={formData.mmse_naming || ''}
                onChange={(e) => handleInputChange('mmse_naming', parseInt(e.target.value) || 0)}
                className="w-20 border rounded-sm p-2"
              />
            </div>

            <div className="border-b pb-3">
              <label className="block font-medium mb-2">Repetition (0-1)</label>
              <input
                type="number"
                min="0"
                max="1"
                value={formData.mmse_repetition || ''}
                onChange={(e) => handleInputChange('mmse_repetition', parseInt(e.target.value) || 0)}
                className="w-20 border rounded-sm p-2"
              />
            </div>

            <div className="border-b pb-3">
              <label className="block font-medium mb-2">Comprehension (0-3)</label>
              <input
                type="number"
                min="0"
                max="3"
                value={formData.mmse_comprehension || ''}
                onChange={(e) => handleInputChange('mmse_comprehension', parseInt(e.target.value) || 0)}
                className="w-20 border rounded-sm p-2"
              />
            </div>

            <div className="border-b pb-3">
              <label className="block font-medium mb-2">Reading (0-1)</label>
              <input
                type="number"
                min="0"
                max="1"
                value={formData.mmse_reading || ''}
                onChange={(e) => handleInputChange('mmse_reading', parseInt(e.target.value) || 0)}
                className="w-20 border rounded-sm p-2"
              />
            </div>

            <div className="border-b pb-3">
              <label className="block font-medium mb-2">Writing (0-1)</label>
              <input
                type="number"
                min="0"
                max="1"
                value={formData.mmse_writing || ''}
                onChange={(e) => handleInputChange('mmse_writing', parseInt(e.target.value) || 0)}
                className="w-20 border rounded-sm p-2"
              />
            </div>

            <div className="border-b pb-3">
              <label className="block font-medium mb-2">Drawing (0-1)</label>
              <input
                type="number"
                min="0"
                max="1"
                value={formData.mmse_drawing || ''}
                onChange={(e) => handleInputChange('mmse_drawing', parseInt(e.target.value) || 0)}
                className="w-20 border rounded-sm p-2"
              />
            </div>
          </div>
        </div>
      )}

      {/* Score Summary */}
      <div className={`p-6 rounded-lg text-white ${
        totalScore >= 26 ? 'bg-green-600' :
        totalScore >= 18 ? 'bg-yellow-600' :
        'bg-red-600'
      }`}>
        <div className="text-center">
          <div className="text-sm mb-1">TOTAL SCORE</div>
          <div className="text-5xl font-bold mb-2">{totalScore} / 30</div>
          <div className="text-xl">{cognitiveStatus}</div>
          {assessmentTool === 'MoCA' && formData.years_education && formData.years_education <= 12 && (
            <div className="mt-2 text-sm">
              (Education adjustment +1 applied)
            </div>
          )}
        </div>
      </div>

      {/* Clinical Observations */}
      <div>
        <label className="block font-medium mb-2">Behavioral Observations</label>
        <textarea
          value={formData.behavioral_observations || ''}
          onChange={(e) => handleInputChange('behavioral_observations', e.target.value)}
          rows={3}
          className="w-full border rounded-sm p-2"
          placeholder="Patient cooperation, anxiety level, attention span, fatigue..."
        />
      </div>

      <div>
        <label className="block font-medium mb-2">Informant Report</label>
        <textarea
          value={formData.informant_report || ''}
          onChange={(e) => handleInputChange('informant_report', e.target.value)}
          rows={3}
          className="w-full border rounded-sm p-2"
          placeholder="Family/caregiver observations about daily functioning, memory concerns..."
        />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4 pt-4 border-t">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border rounded-sm hover:bg-gray-100"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 disabled:bg-gray-400"
        >
          {submitting ? 'Saving...' : 'Save Assessment'}
        </button>
      </div>
    </form>
  );
};

export default CognitiveAssessmentForm;
