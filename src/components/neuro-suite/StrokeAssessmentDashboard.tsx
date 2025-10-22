/**
 * Stroke Assessment Dashboard
 * NIH Stroke Scale (NIHSS) Assessment Tool for Emergency Department
 *
 * Clinical Use: Hyperacute stroke assessment, tPA eligibility, door-to-needle tracking
 * Standards: NIH Stroke Scale (0-42), tPA window (<4.5 hours), quality metrics
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle, Clock, Activity, TrendingUp, CheckCircle2 } from 'lucide-react';
import { NeuroSuiteService } from '../../services/neuroSuiteService';
import { toast } from 'react-toastify';
import type {
  StrokeAssessment,
  CreateStrokeAssessmentRequest,
  StrokeAssessmentType,
  StrokeType,
} from '../../types/neuroSuite';

interface StrokeAssessmentDashboardProps {
  patientId: string;
  encounterId?: string;
}

export function StrokeAssessmentDashboard({
  patientId,
  encounterId,
}: StrokeAssessmentDashboardProps) {
  const [assessmentType, setAssessmentType] = useState<StrokeAssessmentType>('baseline');
  const [strokeType, setStrokeType] = useState<StrokeType | ''>('');
  const [symptomOnset, setSymptomOnset] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');

  // NIHSS Scores
  const [locScore, setLocScore] = useState(0);
  const [locQuestionsScore, setLocQuestionsScore] = useState(0);
  const [locCommandsScore, setLocCommandsScore] = useState(0);
  const [bestGazeScore, setBestGazeScore] = useState(0);
  const [visualFieldsScore, setVisualFieldsScore] = useState(0);
  const [facialPalsyScore, setFacialPalsyScore] = useState(0);
  const [leftArmMotorScore, setLeftArmMotorScore] = useState(0);
  const [rightArmMotorScore, setRightArmMotorScore] = useState(0);
  const [leftLegMotorScore, setLeftLegMotorScore] = useState(0);
  const [rightLegMotorScore, setRightLegMotorScore] = useState(0);
  const [limbAtaxiaScore, setLimbAtaxiaScore] = useState(0);
  const [sensoryScore, setSensoryScore] = useState(0);
  const [bestLanguageScore, setBestLanguageScore] = useState(0);
  const [dysarthriaScore, setDysarthriaScore] = useState(0);
  const [extinctionInattentionScore, setExtinctionInattentionScore] = useState(0);

  const [tpaAdministered, setTpaAdministered] = useState(false);
  const [tpaBolusTime, setTpaBolusTime] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [assessments, setAssessments] = useState<StrokeAssessment[]>([]);

  // Calculate total NIHSS
  const nihssTotal =
    locScore +
    locQuestionsScore +
    locCommandsScore +
    bestGazeScore +
    visualFieldsScore +
    facialPalsyScore +
    leftArmMotorScore +
    rightArmMotorScore +
    leftLegMotorScore +
    rightLegMotorScore +
    limbAtaxiaScore +
    sensoryScore +
    bestLanguageScore +
    dysarthriaScore +
    extinctionInattentionScore;

  // Calculate time since symptom onset
  const timeToAssessment = symptomOnset && arrivalTime
    ? Math.round((new Date(arrivalTime).getTime() - new Date(symptomOnset).getTime()) / 60000)
    : null;

  // Determine severity
  const getSeverity = () => {
    if (nihssTotal === 0) return { text: 'No Stroke', color: 'text-green-600', bg: 'bg-green-100' };
    if (nihssTotal <= 4) return { text: 'Minor Stroke', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    if (nihssTotal <= 15) return { text: 'Moderate Stroke', color: 'text-orange-600', bg: 'bg-orange-100' };
    if (nihssTotal <= 20) return { text: 'Moderate-Severe', color: 'text-red-600', bg: 'bg-red-100' };
    return { text: 'Severe Stroke', color: 'text-red-800', bg: 'bg-red-200' };
  };

  const severity = getSeverity();

  // tPA eligibility
  const tpaEligible = timeToAssessment !== null && timeToAssessment <= 270; // 4.5 hours = 270 minutes

  useEffect(() => {
    loadAssessments();
  }, [patientId]);

  const loadAssessments = async () => {
    const result = await NeuroSuiteService.getStrokeAssessmentsByPatient(patientId);
    if (result.success && result.data) {
      setAssessments(result.data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const request: CreateStrokeAssessmentRequest = {
      patient_id: patientId,
      encounter_id: encounterId,
      assessment_type: assessmentType,
      stroke_type: strokeType || undefined,
      symptom_onset: symptomOnset || undefined,
      arrival_time: arrivalTime || undefined,
      time_to_assessment_minutes: timeToAssessment || undefined,
      loc_score: locScore,
      loc_questions_score: locQuestionsScore,
      loc_commands_score: locCommandsScore,
      best_gaze_score: bestGazeScore,
      visual_fields_score: visualFieldsScore,
      facial_palsy_score: facialPalsyScore,
      left_arm_motor_score: leftArmMotorScore,
      right_arm_motor_score: rightArmMotorScore,
      left_leg_motor_score: leftLegMotorScore,
      right_leg_motor_score: rightLegMotorScore,
      limb_ataxia_score: limbAtaxiaScore,
      sensory_score: sensoryScore,
      best_language_score: bestLanguageScore,
      dysarthria_score: dysarthriaScore,
      extinction_inattention_score: extinctionInattentionScore,
      tpa_administered: tpaAdministered,
      tpa_bolus_time: tpaBolusTime || undefined,
      clinical_notes: clinicalNotes || undefined,
    };

    const result = await NeuroSuiteService.createStrokeAssessment(request);

    if (result.success) {
      toast.success('Stroke assessment saved successfully');
      loadAssessments();
      // Reset form for new assessment
      if (assessmentType === 'baseline') {
        setAssessmentType('24_hour');
      }
    } else {
      toast.error(`Failed to save assessment: ${result.error}`);
    }

    setSaving(false);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header with Timer */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Stroke Code Assessment</h1>
            <p className="text-gray-600 mt-1">NIH Stroke Scale (NIHSS)</p>
          </div>

          {timeToAssessment !== null && (
            <div className={`flex items-center gap-2 p-4 rounded-lg ${tpaEligible ? 'bg-green-100' : 'bg-red-100'}`}>
              <Clock className={`w-6 h-6 ${tpaEligible ? 'text-green-700' : 'text-red-700'}`} />
              <div>
                <div className={`text-2xl font-bold ${tpaEligible ? 'text-green-900' : 'text-red-900'}`}>
                  {timeToAssessment} min
                </div>
                <div className={`text-sm ${tpaEligible ? 'text-green-700' : 'text-red-700'}`}>
                  {tpaEligible ? 'tPA Window Open' : 'tPA Window Closed'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* NIHSS Score Display */}
      <div className={`rounded-lg shadow-md p-6 ${severity.bg}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-700">NIHSS Total Score</div>
            <div className={`text-5xl font-bold ${severity.color}`}>{nihssTotal}</div>
            <div className={`text-lg font-medium ${severity.color} mt-1`}>{severity.text}</div>
          </div>

          <Activity className={`w-16 h-16 ${severity.color}`} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
        {/* Assessment Context */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assessment Type
            </label>
            <select
              value={assessmentType}
              onChange={(e) => setAssessmentType(e.target.value as StrokeAssessmentType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="baseline">Baseline (ED)</option>
              <option value="24_hour">24 Hour Post-tPA</option>
              <option value="discharge">Discharge</option>
              <option value="90_day">90 Day Outcome</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stroke Type
            </label>
            <select
              value={strokeType}
              onChange={(e) => setStrokeType(e.target.value as StrokeType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select type...</option>
              <option value="ischemic_large_vessel">Ischemic - Large Vessel</option>
              <option value="ischemic_small_vessel">Ischemic - Small Vessel</option>
              <option value="ischemic_cardioembolic">Ischemic - Cardioembolic</option>
              <option value="hemorrhagic_intracerebral">Hemorrhagic - Intracerebral</option>
              <option value="tia">TIA</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Symptom Onset Time
            </label>
            <input
              type="datetime-local"
              value={symptomOnset}
              onChange={(e) => setSymptomOnset(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Arrival Time
            </label>
            <input
              type="datetime-local"
              value={arrivalTime}
              onChange={(e) => setArrivalTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* NIH Stroke Scale Items */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">NIH Stroke Scale (15 Items)</h3>

          <div className="grid grid-cols-3 gap-4">
            {/* 1a. Level of Consciousness */}
            <ScoreInput
              label="1a. LOC"
              value={locScore}
              onChange={setLocScore}
              max={3}
              description="0=Alert, 3=Coma"
            />

            {/* 1b. LOC Questions */}
            <ScoreInput
              label="1b. LOC Questions"
              value={locQuestionsScore}
              onChange={setLocQuestionsScore}
              max={2}
              description="Month, Age"
            />

            {/* 1c. LOC Commands */}
            <ScoreInput
              label="1c. LOC Commands"
              value={locCommandsScore}
              onChange={setLocCommandsScore}
              max={2}
              description="Open/Close Eyes"
            />

            {/* 2. Best Gaze */}
            <ScoreInput
              label="2. Best Gaze"
              value={bestGazeScore}
              onChange={setBestGazeScore}
              max={2}
              description="Horizontal eye movement"
            />

            {/* 3. Visual Fields */}
            <ScoreInput
              label="3. Visual Fields"
              value={visualFieldsScore}
              onChange={setVisualFieldsScore}
              max={3}
              description="Hemianopia"
            />

            {/* 4. Facial Palsy */}
            <ScoreInput
              label="4. Facial Palsy"
              value={facialPalsyScore}
              onChange={setFacialPalsyScore}
              max={3}
              description="Smile, grimace"
            />

            {/* 5a. Left Arm Motor */}
            <ScoreInput
              label="5a. Left Arm Motor"
              value={leftArmMotorScore}
              onChange={setLeftArmMotorScore}
              max={4}
              description="0=No drift"
            />

            {/* 5b. Right Arm Motor */}
            <ScoreInput
              label="5b. Right Arm Motor"
              value={rightArmMotorScore}
              onChange={setRightArmMotorScore}
              max={4}
              description="0=No drift"
            />

            {/* 6a. Left Leg Motor */}
            <ScoreInput
              label="6a. Left Leg Motor"
              value={leftLegMotorScore}
              onChange={setLeftLegMotorScore}
              max={4}
              description="0=No drift"
            />

            {/* 6b. Right Leg Motor */}
            <ScoreInput
              label="6b. Right Leg Motor"
              value={rightLegMotorScore}
              onChange={setRightLegMotorScore}
              max={4}
              description="0=No drift"
            />

            {/* 7. Limb Ataxia */}
            <ScoreInput
              label="7. Limb Ataxia"
              value={limbAtaxiaScore}
              onChange={setLimbAtaxiaScore}
              max={2}
              description="Finger-nose, heel-shin"
            />

            {/* 8. Sensory */}
            <ScoreInput
              label="8. Sensory"
              value={sensoryScore}
              onChange={setSensoryScore}
              max={2}
              description="Pinprick"
            />

            {/* 9. Best Language */}
            <ScoreInput
              label="9. Best Language"
              value={bestLanguageScore}
              onChange={setBestLanguageScore}
              max={3}
              description="Aphasia"
            />

            {/* 10. Dysarthria */}
            <ScoreInput
              label="10. Dysarthria"
              value={dysarthriaScore}
              onChange={setDysarthriaScore}
              max={2}
              description="Speech clarity"
            />

            {/* 11. Extinction/Inattention */}
            <ScoreInput
              label="11. Extinction"
              value={extinctionInattentionScore}
              onChange={setExtinctionInattentionScore}
              max={2}
              description="Neglect"
            />
          </div>
        </div>

        {/* tPA Treatment */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Treatment</h3>

          <div className="space-y-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={tpaAdministered}
                onChange={(e) => setTpaAdministered(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">tPA Administered</span>
            </label>

            {tpaAdministered && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  tPA Bolus Time
                </label>
                <input
                  type="datetime-local"
                  value={tpaBolusTime}
                  onChange={(e) => setTpaBolusTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Clinical Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Clinical Notes
          </label>
          <textarea
            value={clinicalNotes}
            onChange={(e) => setClinicalNotes(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Additional observations, contraindications, treatment decisions..."
          />
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>Saving...</>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Save Assessment
              </>
            )}
          </button>
        </div>
      </form>

      {/* Previous Assessments */}
      {assessments.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Assessment History
          </h3>

          <div className="space-y-2">
            {assessments.map((assessment) => (
              <div
                key={assessment.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
              >
                <div>
                  <div className="font-medium">{assessment.assessment_type.replace('_', ' ').toUpperCase()}</div>
                  <div className="text-sm text-gray-600">
                    {new Date(assessment.assessment_date).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">
                    {assessment.nihss_total_score}
                  </div>
                  <div className="text-sm text-gray-600">{assessment.nihss_severity.replace('_', ' ')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component for score inputs
interface ScoreInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  max: number;
  description?: string;
}

function ScoreInput({ label, value, onChange, max, description }: ScoreInputProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {description && <div className="text-xs text-gray-500 mb-1">{description}</div>}
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {Array.from({ length: max + 1 }, (_, i) => (
          <option key={i} value={i}>
            {i}
          </option>
        ))}
      </select>
    </div>
  );
}
