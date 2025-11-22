// Lite Sender Portal - No Login Required
// Web-based patient handoff form with tokenized access
// 5-section smart form for patient transfers

import React, { Suspense, lazy } from 'react';
import { useLiteSenderLogic } from './hooks/useLiteSenderLogic';
import type { LiteSenderPortalProps } from '../../types/handoff';

// Lazy load form steps and confirmation screen for code splitting
const LiteSenderFormSteps = lazy(() => import('./LiteSenderFormSteps'));
const LiteSenderConfirmation = lazy(() => import('./LiteSenderConfirmation'));

const LiteSenderPortal: React.FC<LiteSenderPortalProps> = ({
  facilityName,
  onPacketCreated,
}) => {
  const {
    currentStep,
    isSubmitting,
    completedPacket,
    formData,
    medicationsGiven,
    medicationsPrescribed,
    medicationsCurrent,
    allergies,
    labs,
    attachments,
    isLookingUpPatient,
    setFormData,
    handleNext,
    handlePrevious,
    handlePatientLookup,
    handleSubmit,
    addMedicationGiven,
    updateMedicationGiven,
    removeMedicationGiven,
    addMedicationPrescribed,
    updateMedicationPrescribed,
    removeMedicationPrescribed,
    addMedicationCurrent,
    updateMedicationCurrent,
    removeMedicationCurrent,
    addAllergy,
    updateAllergy,
    removeAllergy,
    addLab,
    updateLab,
    removeLab,
    handleFileSelect,
    removeAttachment,
  } = useLiteSenderLogic({ facilityName, onPacketCreated });

  const steps = [
    { number: 1, title: 'Patient Demographics', icon: '👤' },
    { number: 2, title: 'Reason for Transfer', icon: '🚑' },
    { number: 3, title: 'Clinical Snapshot', icon: '💊' },
    { number: 4, title: 'Sender Info', icon: '📞' },
    { number: 5, title: 'Attachments', icon: '📎' },
  ];

  // Show confirmation screen after submission
  if (completedPacket) {
    return (
      <Suspense fallback={<LoadingFallback message="Loading confirmation..." />}>
        <LiteSenderConfirmation
          packetNumber={completedPacket.packetNumber}
          accessUrl={completedPacket.accessUrl}
        />
      </Suspense>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          🏥 Patient Transfer - Lite Sender Portal
        </h1>
        <p className="text-gray-600">Secure patient handoff - No login required</p>
      </div>

      {/* Progress Steps */}
      <div className="flex justify-between mb-8">
        {steps.map((step) => (
          <div
            key={step.number}
            className={`flex flex-col items-center ${
              step.number === currentStep
                ? 'text-blue-600'
                : step.number < currentStep
                ? 'text-green-600'
                : 'text-gray-400'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-2 ${
                step.number === currentStep
                  ? 'bg-blue-100 border-2 border-blue-600'
                  : step.number < currentStep
                  ? 'bg-green-100 border-2 border-green-600'
                  : 'bg-gray-100 border-2 border-gray-300'
              }`}
            >
              {step.icon}
            </div>
            <p className="text-xs font-medium text-center">{step.title}</p>
          </div>
        ))}
      </div>

      {/* Step Content - Lazy loaded */}
      <Suspense fallback={<LoadingFallback message="Loading form..." />}>
        <LiteSenderFormSteps
          currentStep={currentStep}
          formData={formData}
          setFormData={setFormData}
          isLookingUpPatient={isLookingUpPatient}
          handlePatientLookup={handlePatientLookup}
          medicationsGiven={medicationsGiven}
          addMedicationGiven={addMedicationGiven}
          updateMedicationGiven={updateMedicationGiven}
          removeMedicationGiven={removeMedicationGiven}
          medicationsPrescribed={medicationsPrescribed}
          addMedicationPrescribed={addMedicationPrescribed}
          updateMedicationPrescribed={updateMedicationPrescribed}
          removeMedicationPrescribed={removeMedicationPrescribed}
          medicationsCurrent={medicationsCurrent}
          addMedicationCurrent={addMedicationCurrent}
          updateMedicationCurrent={updateMedicationCurrent}
          removeMedicationCurrent={removeMedicationCurrent}
          allergies={allergies}
          addAllergy={addAllergy}
          updateAllergy={updateAllergy}
          removeAllergy={removeAllergy}
          labs={labs}
          addLab={addLab}
          updateLab={updateLab}
          removeLab={removeLab}
          attachments={attachments}
          handleFileSelect={handleFileSelect}
          removeAttachment={removeAttachment}
        />
      </Suspense>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-6 border-t border-gray-200">
        <button
          onClick={handlePrevious}
          disabled={currentStep === 1}
          className={`px-6 py-3 rounded-lg font-medium transition-all ${
            currentStep === 1
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-gray-600 text-white hover:bg-gray-700'
          }`}
        >
          ← Previous
        </button>

        {currentStep < 5 ? (
          <button
            onClick={handleNext}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              isSubmitting
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isSubmitting ? 'Sending...' : '📤 Send Secure Packet'}
          </button>
        )}
      </div>
    </div>
  );
};

// Loading fallback component
const LoadingFallback: React.FC<{ message: string }> = ({ message }) => (
  <div className="min-h-[400px] flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin text-4xl mb-4">⏳</div>
      <p className="text-gray-600">{message}</p>
    </div>
  </div>
);

export default LiteSenderPortal;
