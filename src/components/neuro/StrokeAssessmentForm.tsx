/**
 * Stroke Assessment Form - NIH Stroke Scale (NIHSS)
 *
 * Features:
 * - Full 15-item NIHSS evaluation
 * - Auto-calculated total score and severity
 * - tPA eligibility checking
 * - Time-critical alerts
 * - Door-to-needle time tracking
 *
 * Use Cases:
 * - ED stroke code activation
 * - 24-hour reassessment
 * - Discharge evaluation
 * - 90-day follow-up
 *
 * For: Emergency physicians, neurologists, stroke coordinators
 */

import React, { useState, useEffect } from 'react';
import { NeuroSuiteService } from '../../services/neuroSuiteService';
import type {
  CreateStrokeAssessmentRequest,
  StrokeAssessmentType,
  StrokeType,
} from '../../types/neuroSuite';

interface StrokeAssessmentFormProps {
  patientId: string;
  encounterId?: string;
  assessmentType: StrokeAssessmentType;
  onComplete?: (assessmentId: string) => void;
  onCancel?: () => void;
}

export const StrokeAssessmentForm: React.FC<StrokeAssessmentFormProps> = ({
  patientId,
  encounterId,
  assessmentType,
  onComplete,
  onCancel,
}) => {
  const [formData, setFormData] = useState<Partial<CreateStrokeAssessmentRequest>>({
    patient_id: patientId,
    encounter_id: encounterId,
    assessment_type: assessmentType,
    assessment_date: new Date().toISOString(),
  });

  const [nihssTotal, setNihssTotal] = useState(0);
  const [severity, setSeverity] = useState('');
  const [tpaEligible, setTpaEligible] = useState(false);
  const [timeWarning, setTimeWarning] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Calculate NIHSS total whenever individual scores change
  useEffect(() => {
    const total =
      (formData.loc_score || 0) +
      (formData.loc_questions_score || 0) +
      (formData.loc_commands_score || 0) +
      (formData.best_gaze_score || 0) +
      (formData.visual_fields_score || 0) +
      (formData.facial_palsy_score || 0) +
      (formData.left_arm_motor_score || 0) +
      (formData.right_arm_motor_score || 0) +
      (formData.left_leg_motor_score || 0) +
      (formData.right_leg_motor_score || 0) +
      (formData.limb_ataxia_score || 0) +
      (formData.sensory_score || 0) +
      (formData.best_language_score || 0) +
      (formData.dysarthria_score || 0) +
      (formData.extinction_inattention_score || 0);

    setNihssTotal(total);

    // Determine severity
    if (total === 0) setSeverity('No Stroke');
    else if (total <= 4) setSeverity('Minor Stroke');
    else if (total <= 15) setSeverity('Moderate Stroke');
    else if (total <= 20) setSeverity('Moderate-Severe Stroke');
    else setSeverity('Severe Stroke');
  }, [formData]);

  // Check tPA eligibility based on symptom onset
  useEffect(() => {
    if (formData.symptom_onset && formData.assessment_date) {
      const onsetTime = new Date(formData.symptom_onset).getTime();
      const assessmentTime = new Date(formData.assessment_date).getTime();
      const diffMinutes = (assessmentTime - onsetTime) / 60000;

      if (diffMinutes <= 270) {
        setTpaEligible(true);
        setTimeWarning('');
      } else {
        setTpaEligible(false);
        setTimeWarning('⚠️ Outside tPA window (>4.5 hours from symptom onset)');
      }

      // Warning if approaching window
      if (diffMinutes > 180 && diffMinutes <= 270) {
        setTimeWarning('⏰ tPA window closing soon!');
      }
    }
  }, [formData.symptom_onset, formData.assessment_date]);

  const handleInputChange = (field: keyof CreateStrokeAssessmentRequest, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await NeuroSuiteService.createStrokeAssessment(
        formData as CreateStrokeAssessmentRequest
      );

      if (response.success && response.data) {
        alert(`Stroke assessment completed. NIHSS: ${nihssTotal} (${severity})`);
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
        <h1 className="text-2xl font-bold">NIH Stroke Scale Assessment</h1>
        <p className="text-gray-600">
          {assessmentType.replace('_', ' ')} · Patient ID: {patientId}
        </p>
      </div>

      {/* Time-Critical Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50 p-4 rounded">
        <div>
          <label className="block text-sm font-medium mb-1">Last Known Well</label>
          <input
            type="datetime-local"
            value={formData.last_known_well?.slice(0, 16) || ''}
            onChange={(e) => handleInputChange('last_known_well', e.target.value)}
            className="w-full border rounded p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Symptom Onset</label>
          <input
            type="datetime-local"
            value={formData.symptom_onset?.slice(0, 16) || ''}
            onChange={(e) => handleInputChange('symptom_onset', e.target.value)}
            className="w-full border rounded p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Arrival Time (ED)</label>
          <input
            type="datetime-local"
            value={formData.arrival_time?.slice(0, 16) || ''}
            onChange={(e) => handleInputChange('arrival_time', e.target.value)}
            className="w-full border rounded p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">CT Scan Time</label>
          <input
            type="datetime-local"
            value={formData.ct_time?.slice(0, 16) || ''}
            onChange={(e) => handleInputChange('ct_time', e.target.value)}
            className="w-full border rounded p-2"
          />
        </div>
      </div>

      {/* tPA Eligibility Alert */}
      {timeWarning && (
        <div className={`p-4 rounded ${tpaEligible ? 'bg-yellow-100 border-yellow-400' : 'bg-red-100 border-red-400'} border-2`}>
          <div className="font-bold text-lg">{timeWarning}</div>
          {tpaEligible && <div className="text-sm">Patient may be eligible for tPA</div>}
        </div>
      )}

      {/* Stroke Type */}
      <div>
        <label className="block text-sm font-medium mb-1">Stroke Type</label>
        <select
          value={formData.stroke_type || ''}
          onChange={(e) => handleInputChange('stroke_type', e.target.value as StrokeType)}
          className="w-full border rounded p-2"
        >
          <option value="">Select stroke type...</option>
          <option value="ischemic_large_vessel">Ischemic - Large Vessel</option>
          <option value="ischemic_small_vessel">Ischemic - Small Vessel</option>
          <option value="ischemic_cardioembolic">Ischemic - Cardioembolic</option>
          <option value="ischemic_cryptogenic">Ischemic - Cryptogenic</option>
          <option value="hemorrhagic_intracerebral">Hemorrhagic - Intracerebral</option>
          <option value="hemorrhagic_subarachnoid">Hemorrhagic - Subarachnoid</option>
          <option value="tia">TIA</option>
        </select>
      </div>

      {/* NIHSS Items */}
      <div className="space-y-4 bg-gray-50 p-4 rounded">
        <h2 className="text-xl font-bold">NIHSS Scoring (0-42 total)</h2>

        {/* 1a. Level of Consciousness */}
        <div className="border-b pb-3">
          <label className="block font-medium mb-2">1a. Level of Consciousness (0-3)</label>
          <div className="space-y-1 text-sm">
            {[
              { value: 0, label: '0 = Alert' },
              { value: 1, label: '1 = Not alert, arousable' },
              { value: 2, label: '2 = Not alert, requires repeated stimulation' },
              { value: 3, label: '3 = Unresponsive' },
            ].map((option) => (
              <label key={option.value} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="loc_score"
                  value={option.value}
                  checked={formData.loc_score === option.value}
                  onChange={() => handleInputChange('loc_score', option.value)}
                  className="w-4 h-4"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 1b. LOC Questions */}
        <div className="border-b pb-3">
          <label className="block font-medium mb-2">1b. LOC Questions (month, age) (0-2)</label>
          <div className="space-y-1 text-sm">
            {[
              { value: 0, label: '0 = Both correct' },
              { value: 1, label: '1 = One correct' },
              { value: 2, label: '2 = Neither correct' },
            ].map((option) => (
              <label key={option.value} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="loc_questions_score"
                  value={option.value}
                  checked={formData.loc_questions_score === option.value}
                  onChange={() => handleInputChange('loc_questions_score', option.value)}
                  className="w-4 h-4"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 1c. LOC Commands */}
        <div className="border-b pb-3">
          <label className="block font-medium mb-2">1c. LOC Commands (open/close eyes, grip/release) (0-2)</label>
          <div className="space-y-1 text-sm">
            {[
              { value: 0, label: '0 = Both correct' },
              { value: 1, label: '1 = One correct' },
              { value: 2, label: '2 = Neither correct' },
            ].map((option) => (
              <label key={option.value} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="loc_commands_score"
                  value={option.value}
                  checked={formData.loc_commands_score === option.value}
                  onChange={() => handleInputChange('loc_commands_score', option.value)}
                  className="w-4 h-4"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 2. Best Gaze */}
        <div className="border-b pb-3">
          <label className="block font-medium mb-2">2. Best Gaze (0-2)</label>
          <div className="space-y-1 text-sm">
            {[
              { value: 0, label: '0 = Normal' },
              { value: 1, label: '1 = Partial gaze palsy' },
              { value: 2, label: '2 = Forced deviation' },
            ].map((option) => (
              <label key={option.value} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="best_gaze_score"
                  value={option.value}
                  checked={formData.best_gaze_score === option.value}
                  onChange={() => handleInputChange('best_gaze_score', option.value)}
                  className="w-4 h-4"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 3. Visual Fields */}
        <div className="border-b pb-3">
          <label className="block font-medium mb-2">3. Visual Fields (0-3)</label>
          <div className="space-y-1 text-sm">
            {[
              { value: 0, label: '0 = No visual loss' },
              { value: 1, label: '1 = Partial hemianopia' },
              { value: 2, label: '2 = Complete hemianopia' },
              { value: 3, label: '3 = Bilateral hemianopia' },
            ].map((option) => (
              <label key={option.value} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="visual_fields_score"
                  value={option.value}
                  checked={formData.visual_fields_score === option.value}
                  onChange={() => handleInputChange('visual_fields_score', option.value)}
                  className="w-4 h-4"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 4. Facial Palsy */}
        <div className="border-b pb-3">
          <label className="block font-medium mb-2">4. Facial Palsy (0-3)</label>
          <div className="space-y-1 text-sm">
            {[
              { value: 0, label: '0 = Normal' },
              { value: 1, label: '1 = Minor paralysis' },
              { value: 2, label: '2 = Partial paralysis' },
              { value: 3, label: '3 = Complete paralysis' },
            ].map((option) => (
              <label key={option.value} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="facial_palsy_score"
                  value={option.value}
                  checked={formData.facial_palsy_score === option.value}
                  onChange={() => handleInputChange('facial_palsy_score', option.value)}
                  className="w-4 h-4"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Motor Scores - Arms */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border-b pb-3">
            <label className="block font-medium mb-2">5a. Left Arm Motor (0-4)</label>
            <select
              value={formData.left_arm_motor_score || 0}
              onChange={(e) => handleInputChange('left_arm_motor_score', parseInt(e.target.value))}
              className="w-full border rounded p-2"
            >
              <option value={0}>0 = No drift</option>
              <option value={1}>1 = Drift</option>
              <option value={2}>2 = Some effort against gravity</option>
              <option value={3}>3 = No effort against gravity</option>
              <option value={4}>4 = No movement</option>
            </select>
          </div>
          <div className="border-b pb-3">
            <label className="block font-medium mb-2">5b. Right Arm Motor (0-4)</label>
            <select
              value={formData.right_arm_motor_score || 0}
              onChange={(e) => handleInputChange('right_arm_motor_score', parseInt(e.target.value))}
              className="w-full border rounded p-2"
            >
              <option value={0}>0 = No drift</option>
              <option value={1}>1 = Drift</option>
              <option value={2}>2 = Some effort against gravity</option>
              <option value={3}>3 = No effort against gravity</option>
              <option value={4}>4 = No movement</option>
            </select>
          </div>
        </div>

        {/* Motor Scores - Legs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border-b pb-3">
            <label className="block font-medium mb-2">6a. Left Leg Motor (0-4)</label>
            <select
              value={formData.left_leg_motor_score || 0}
              onChange={(e) => handleInputChange('left_leg_motor_score', parseInt(e.target.value))}
              className="w-full border rounded p-2"
            >
              <option value={0}>0 = No drift</option>
              <option value={1}>1 = Drift</option>
              <option value={2}>2 = Some effort against gravity</option>
              <option value={3}>3 = No effort against gravity</option>
              <option value={4}>4 = No movement</option>
            </select>
          </div>
          <div className="border-b pb-3">
            <label className="block font-medium mb-2">6b. Right Leg Motor (0-4)</label>
            <select
              value={formData.right_leg_motor_score || 0}
              onChange={(e) => handleInputChange('right_leg_motor_score', parseInt(e.target.value))}
              className="w-full border rounded p-2"
            >
              <option value={0}>0 = No drift</option>
              <option value={1}>1 = Drift</option>
              <option value={2}>2 = Some effort against gravity</option>
              <option value={3}>3 = No effort against gravity</option>
              <option value={4}>4 = No movement</option>
            </select>
          </div>
        </div>

        {/* Remaining NIHSS items - simplified for space */}
        <div className="border-b pb-3">
          <label className="block font-medium mb-2">7. Limb Ataxia (0-2)</label>
          <select
            value={formData.limb_ataxia_score || 0}
            onChange={(e) => handleInputChange('limb_ataxia_score', parseInt(e.target.value))}
            className="w-full border rounded p-2"
          >
            <option value={0}>0 = Absent</option>
            <option value={1}>1 = Present in one limb</option>
            <option value={2}>2 = Present in two limbs</option>
          </select>
        </div>

        <div className="border-b pb-3">
          <label className="block font-medium mb-2">8. Sensory (0-2)</label>
          <select
            value={formData.sensory_score || 0}
            onChange={(e) => handleInputChange('sensory_score', parseInt(e.target.value))}
            className="w-full border rounded p-2"
          >
            <option value={0}>0 = Normal</option>
            <option value={1}>1 = Mild-moderate loss</option>
            <option value={2}>2 = Severe-total loss</option>
          </select>
        </div>

        <div className="border-b pb-3">
          <label className="block font-medium mb-2">9. Best Language (0-3)</label>
          <select
            value={formData.best_language_score || 0}
            onChange={(e) => handleInputChange('best_language_score', parseInt(e.target.value))}
            className="w-full border rounded p-2"
          >
            <option value={0}>0 = No aphasia</option>
            <option value={1}>1 = Mild-moderate aphasia</option>
            <option value={2}>2 = Severe aphasia</option>
            <option value={3}>3 = Mute</option>
          </select>
        </div>

        <div className="border-b pb-3">
          <label className="block font-medium mb-2">10. Dysarthria (0-2)</label>
          <select
            value={formData.dysarthria_score || 0}
            onChange={(e) => handleInputChange('dysarthria_score', parseInt(e.target.value))}
            className="w-full border rounded p-2"
          >
            <option value={0}>0 = Normal</option>
            <option value={1}>1 = Mild-moderate</option>
            <option value={2}>2 = Severe</option>
          </select>
        </div>

        <div className="border-b pb-3">
          <label className="block font-medium mb-2">11. Extinction/Inattention (0-2)</label>
          <select
            value={formData.extinction_inattention_score || 0}
            onChange={(e) => handleInputChange('extinction_inattention_score', parseInt(e.target.value))}
            className="w-full border rounded p-2"
          >
            <option value={0}>0 = No abnormality</option>
            <option value={1}>1 = Inattention to one modality</option>
            <option value={2}>2 = Profound hemi-inattention</option>
          </select>
        </div>
      </div>

      {/* Score Summary */}
      <div className="bg-blue-600 text-white p-6 rounded-lg">
        <div className="text-center">
          <div className="text-sm mb-1">TOTAL NIHSS SCORE</div>
          <div className="text-5xl font-bold mb-2">{nihssTotal}</div>
          <div className="text-xl">{severity}</div>
          {tpaEligible && (
            <div className="mt-4 bg-yellow-500 text-black px-4 py-2 rounded inline-block font-bold">
              ✓ tPA ELIGIBLE
            </div>
          )}
        </div>
      </div>

      {/* Treatment Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.tpa_administered || false}
              onChange={(e) => handleInputChange('tpa_administered', e.target.checked)}
              className="w-4 h-4"
            />
            <span className="font-medium">tPA Administered</span>
          </label>
          {formData.tpa_administered && (
            <input
              type="datetime-local"
              placeholder="tPA Bolus Time"
              value={formData.tpa_bolus_time?.slice(0, 16) || ''}
              onChange={(e) => handleInputChange('tpa_bolus_time', e.target.value)}
              className="mt-2 w-full border rounded p-2"
            />
          )}
        </div>
        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.thrombectomy_performed || false}
              onChange={(e) => handleInputChange('thrombectomy_performed', e.target.checked)}
              className="w-4 h-4"
            />
            <span className="font-medium">Thrombectomy Performed</span>
          </label>
        </div>
      </div>

      {/* Clinical Notes */}
      <div>
        <label className="block font-medium mb-2">Clinical Notes</label>
        <textarea
          value={formData.clinical_notes || ''}
          onChange={(e) => handleInputChange('clinical_notes', e.target.value)}
          rows={4}
          className="w-full border rounded p-2"
          placeholder="Additional clinical observations, complications, concerns..."
        />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4 pt-4 border-t">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border rounded hover:bg-gray-100"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {submitting ? 'Saving...' : 'Save Assessment'}
        </button>
      </div>
    </form>
  );
};

export default StrokeAssessmentForm;
