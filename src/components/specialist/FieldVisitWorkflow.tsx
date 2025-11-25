/**
 * Field Visit Workflow Component
 * Step-by-step workflow execution for any specialist type
 */

import React, { useEffect, useState } from 'react';
import { SpecialistWorkflowEngine } from '../../services/specialist-workflow-engine/SpecialistWorkflowEngine';
import { fieldVisitManager } from '../../services/specialist-workflow-engine/FieldVisitManager';
import { workflowRegistry } from '../../services/specialist-workflow-engine/templates';
import { FieldVisit, WorkflowStep } from '../../services/specialist-workflow-engine/types';

interface FieldVisitWorkflowProps {
  visitId: string;
}

export const FieldVisitWorkflow: React.FC<FieldVisitWorkflowProps> = ({ visitId }) => {
  const [visit, setVisit] = useState<FieldVisit | null>(null);
  const [currentStep, setCurrentStep] = useState<WorkflowStep | null>(null);
  const [engine, setEngine] = useState<SpecialistWorkflowEngine | null>(null);
  const [stepData, setStepData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState<GeolocationCoordinates | null>(null);

  useEffect(() => {
    loadVisit();
    getCurrentLocation();
  }, [visitId]);

  const loadVisit = async () => {
    try {
      const visitData = await fieldVisitManager.getVisit(visitId);
      if (!visitData) {
        alert('Visit not found');
        return;
      }

      setVisit(visitData);

      const workflow = workflowRegistry.get(visitData.workflow_template_id);
      if (!workflow) {
        alert('Workflow template not found');
        return;
      }

      const workflowEngine = new SpecialistWorkflowEngine(workflow);
      setEngine(workflowEngine);

      const step = workflowEngine.getCurrentStep(visitData.current_step);
      setCurrentStep(step || null);
    } catch (error) {

      alert('Failed to load visit');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    const coords = await fieldVisitManager.getCurrentLocation();
    setLocation(coords);
  };

  const handleCheckIn = async () => {
    if (!visit || !engine) return;

    try {
      await engine.checkIn(visit.id, location || undefined);
      await fieldVisitManager.startVisit(visit.id);
      await loadVisit(); // Reload to get updated status
      alert('Checked in successfully!');
    } catch (error) {

      alert('Check-in failed. Please try again.');
    }
  };

  const handleCheckOut = async () => {
    if (!visit || !engine) return;

    if (!window.confirm('Are you sure you want to complete this visit?')) {
      return;
    }

    try {
      await engine.checkOut(visit.id, location || undefined);
      await fieldVisitManager.completeVisit(visit.id);
      alert('Visit completed successfully!');
      window.location.href = '/specialist/dashboard';
    } catch (error) {

      alert('Check-out failed. Please try again.');
    }
  };

  const handleStepComplete = async () => {
    if (!visit || !engine || !currentStep) return;

    // Validate required fields
    const validation = engine.canCompleteStep(currentStep.step, stepData);
    if (!validation.canComplete) {
      alert(`Please complete required fields: ${validation.missingFields.join(', ')}`);
      return;
    }

    setSaving(true);
    try {
      await engine.captureStepData(visit.id, currentStep.step, stepData);
      await loadVisit(); // Reload to get next step
      setStepData({}); // Reset form
      alert('Step completed!');
    } catch (error) {

      alert('Failed to save. Data will be synced when online.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!visit || !engine || !currentStep) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-600">Unable to load visit workflow</p>
        <button
          onClick={() => window.location.href = '/specialist/dashboard'}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const progress = engine.getProgress(visit.completed_steps);
  const allSteps = engine.getAllSteps();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Progress Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {(visit as any).patient?.full_name}
            </h1>
            <p className="text-gray-600">{visit.visit_type}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600">{progress}%</div>
            <div className="text-sm text-gray-600">Complete</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        {/* Step Indicators */}
        <div className="mt-6 flex justify-between">
          {allSteps.map(step => (
            <div
              key={step.step}
              className={`flex flex-col items-center ${
                visit.completed_steps.includes(step.step)
                  ? 'text-green-600'
                  : step.step === currentStep.step
                  ? 'text-blue-600'
                  : 'text-gray-400'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  visit.completed_steps.includes(step.step)
                    ? 'bg-green-600 border-green-600 text-white'
                    : step.step === currentStep.step
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-300'
                }`}
              >
                {visit.completed_steps.includes(step.step) ? '✓' : step.step}
              </div>
              <div className="text-xs mt-1 text-center max-w-[80px]">{step.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Current Step */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Step {currentStep.step}: {currentStep.name}
            </h2>
            {currentStep.description && (
              <p className="text-gray-600 mt-1">{currentStep.description}</p>
            )}
            {currentStep.estimatedMinutes && (
              <p className="text-sm text-gray-500 mt-2">
                ⏱️ Estimated time: {currentStep.estimatedMinutes} minutes
              </p>
            )}
          </div>
          {currentStep.required && (
            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
              Required
            </span>
          )}
        </div>

        {/* Step-specific content */}
        <div className="space-y-4">
          {currentStep.action === 'gps-verify' && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">📍</span>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">Location Verification</h3>
                  <p className="text-sm text-gray-600">
                    {location
                      ? `Location: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
                      : 'Getting location...'}
                  </p>
                </div>
                {currentStep.step === 1 ? (
                  <button
                    onClick={handleCheckIn}
                    disabled={!location}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-400"
                  >
                    Check In
                  </button>
                ) : (
                  <button
                    onClick={handleCheckOut}
                    disabled={!location}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:bg-gray-400"
                  >
                    Check Out
                  </button>
                )}
              </div>
            </div>
          )}

          {currentStep.action !== 'gps-verify' && (
            <>
              {/* Generic field inputs */}
              <div className="space-y-4">
                <textarea
                  value={stepData.notes || ''}
                  onChange={e => setStepData({ ...stepData, notes: e.target.value })}
                  placeholder="Enter notes for this step..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={6}
                />

                {/* Photo capture button */}
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => {
                      // Trigger photo capture (would integrate with camera API)
                      alert('Photo capture would be triggered here');
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                  >
                    📷 Add Photo
                  </button>

                  <button
                    onClick={() => {
                      // Trigger voice recording
                      alert('Voice recording would be triggered here');
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                  >
                    🎤 Voice Note
                  </button>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => {
                    if (window.confirm('Skip this step?')) {
                      setCurrentStep(engine.getCurrentStep(currentStep.step + 1) || null);
                    }
                  }}
                  disabled={currentStep.required}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Skip
                </button>

                <button
                  onClick={handleStepComplete}
                  disabled={saving}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-gray-400"
                >
                  {saving ? 'Saving...' : 'Complete Step →'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Offline indicator */}
      {!navigator.onLine && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded-lg">
          <p className="font-medium">⚠️ Working Offline</p>
          <p className="text-sm">Data will be synced automatically when connection is restored.</p>
        </div>
      )}
    </div>
  );
};
