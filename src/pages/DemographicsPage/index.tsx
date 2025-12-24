// src/pages/DemographicsPage/index.tsx
// Thin orchestrator - all logic is in useDemographicsForm hook, all UI in step components
import React from 'react';
import { useBranding } from '../../BrandingContext';
import { WELLFIT_COLORS } from '../../settings/settings';
import { useDemographicsForm } from './useDemographicsForm';
import {
  BasicDemographicsStep,
  LivingSituationStep,
  HealthConditionsStep,
  EmergencyContactStep,
  SocialSupportStep
} from './steps';

const DemographicsPage: React.FC = () => {
  const { branding } = useBranding();
  const {
    formData,
    currentStep,
    totalSteps,
    loading,
    submitting,
    saving,
    error,
    userRole,
    handleInputChange,
    handleHealthConditionToggle,
    nextStep,
    prevStep,
    saveProgress,
    skipToConsent,
    handleSubmit
  } = useDemographicsForm();

  // Loading state
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: branding.gradient }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading your information...</p>
        </div>
      </div>
    );
  }

  // Determine which step component to render based on currentStep and userRole
  const renderStep = () => {
    // Step 1: Basic Demographics (all users)
    if (currentStep === 1) {
      return (
        <BasicDemographicsStep
          formData={formData}
          onInputChange={handleInputChange}
        />
      );
    }

    // Step 2: Living Situation (SENIORS ONLY) or Health (PATIENTS)
    if (currentStep === 2) {
      if (userRole === 'senior') {
        return (
          <LivingSituationStep
            formData={formData}
            onInputChange={handleInputChange}
          />
        );
      } else {
        return (
          <HealthConditionsStep
            formData={formData}
            onInputChange={handleInputChange}
            onHealthConditionToggle={handleHealthConditionToggle}
          />
        );
      }
    }

    // Step 3: Health (SENIORS) or Emergency Contact (PATIENTS)
    if (currentStep === 3) {
      if (userRole === 'senior') {
        return (
          <HealthConditionsStep
            formData={formData}
            onInputChange={handleInputChange}
            onHealthConditionToggle={handleHealthConditionToggle}
          />
        );
      } else {
        return (
          <EmergencyContactStep
            formData={formData}
            onInputChange={handleInputChange}
          />
        );
      }
    }

    // Step 4: Emergency Contact (SENIORS) or Social Support (PATIENTS - final)
    if (currentStep === 4) {
      if (userRole === 'senior') {
        return (
          <EmergencyContactStep
            formData={formData}
            onInputChange={handleInputChange}
          />
        );
      } else {
        return (
          <SocialSupportStep
            formData={formData}
            onInputChange={handleInputChange}
          />
        );
      }
    }

    // Step 5: Social Support (SENIORS - final)
    if (currentStep === 5 && userRole === 'senior') {
      return (
        <SocialSupportStep
          formData={formData}
          onInputChange={handleInputChange}
        />
      );
    }

    return null;
  };

  return (
    <div
      className="min-h-screen py-8"
      style={{ background: branding.gradient }}
    >
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: WELLFIT_COLORS.blue }}>
            Tell Us About Yourself
          </h1>
          <p className="text-lg text-gray-600">
            This helps us provide better care and resources for you
          </p>
          <p className="text-base text-gray-500 mt-2">
            You can save your progress and come back anytime
          </p>

          {/* Progress Indicator */}
          <div className="mt-4">
            <div className="flex justify-center space-x-2">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
                <div
                  key={step}
                  className={`w-3 h-3 rounded-full ${
                    step <= currentStep ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">Step {currentStep} of {totalSteps}</p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 text-center">{error}</p>
          </div>
        )}

        {/* Form Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Current Step Content */}
          {renderStep()}

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center mt-8">
            {currentStep > 1 && (
              <button
                onClick={prevStep}
                className="px-6 py-3 text-lg font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 focus:outline-hidden focus:ring-2 focus:ring-gray-500"
              >
                Previous
              </button>
            )}

            <div className="flex gap-3 ml-auto">
              {/* Skip to Consent Button - Only on first step */}
              {currentStep === 1 && (
                <button
                  onClick={skipToConsent}
                  disabled={saving}
                  className="px-6 py-3 text-lg font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 focus:outline-hidden focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
                >
                  {saving ? 'Skipping...' : 'Skip to Consent'}
                </button>
              )}

              {/* Save for Later Button */}
              <button
                onClick={saveProgress}
                disabled={saving}
                className="px-6 py-3 text-lg font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save for Later'}
              </button>

              {/* Next/Complete Button */}
              {currentStep < totalSteps ? (
                <button
                  onClick={nextStep}
                  className="px-6 py-3 text-lg font-medium text-white rounded-lg focus:outline-hidden focus:ring-2 focus:ring-green-500"
                  style={{ backgroundColor: WELLFIT_COLORS.green }}
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-8 py-3 text-lg font-medium text-white rounded-lg focus:outline-hidden focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                  style={{ backgroundColor: WELLFIT_COLORS.green }}
                >
                  {submitting ? 'Saving...' : 'Continue to Consent'}
                </button>
              )}
            </div>
          </div>

          {/* Progress Message */}
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-center text-sm">
              <strong>Tip:</strong> You can click "Save for Later" to return to the dashboard and complete this later, or "Skip to Consent" to continue registration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemographicsPage;
