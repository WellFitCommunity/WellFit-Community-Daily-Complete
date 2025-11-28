// src/pages/DemographicsPage.tsx - Senior-Friendly Demographics with Save Feature
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient, useUser } from '../contexts/AuthContext';
import { useBranding } from '../BrandingContext';
import { WELLFIT_COLORS } from '../settings/settings';

interface DemographicsData {
  // Basic Info (already collected during registration)
  first_name: string;
  last_name: string;
  phone: string;
  dob: string;
  address: string;
  pin: string; // For caregiver view-only access

  // Actual Demographics for Seniors
  gender: string;
  ethnicity: string;
  marital_status: string;
  living_situation: string;
  education_level: string;
  income_range: string;
  insurance_type: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;

  // Health Demographics
  health_conditions: string[];
  medications: string;
  mobility_level: string;
  hearing_status: string;
  vision_status: string;

  // Technology Access
  has_smartphone: boolean;
  has_internet: boolean;
  tech_comfort_level: string;

  // Social Determinants
  transportation_access: string;
  food_security: string;
  social_support: string;
}

const DemographicsPage: React.FC = () => {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const user = useUser();
  const { branding } = useBranding();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<DemographicsData>({
    first_name: '',
    last_name: '',
    phone: '',
    dob: '',
    address: '',
    pin: '', // Kept for backward compatibility but not used in this flow
    gender: '',
    ethnicity: '',
    marital_status: '',
    living_situation: '',
    education_level: '',
    income_range: '',
    insurance_type: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: '',
    health_conditions: [],
    medications: '',
    mobility_level: '',
    hearing_status: '',
    vision_status: '',
    has_smartphone: false,
    has_internet: false,
    tech_comfort_level: '',
    transportation_access: '',
    food_security: '',
    social_support: ''
  });

  // Load existing profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) {
        navigate('/login');
        return;
      }

      try {
        // Query profile without FK join to roles - use the role column directly
        // Use maybeSingle() to avoid 406 when profile doesn't exist yet
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (data) {
          // Use role column (stores role name directly) instead of FK join
          const roleName = data.role || data.role_slug || 'senior';

          // Skip demographics for admin/staff roles
          if (['admin', 'super_admin', 'staff', 'moderator'].includes(roleName)) {
            navigate('/dashboard');
            return;
          }

          // Check if already completed demographics (only for seniors)
          if (data.demographics_complete) {
            navigate('/dashboard');
            return;
          }

          // Pre-fill all available data including partial progress
          setFormData(prev => ({
            ...prev,
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            phone: data.phone || '',
            dob: data.dob || '',
            address: data.address || '',
            emergency_contact_name: data.emergency_contact_name || '',
            emergency_contact_phone: data.emergency_contact_phone || '',
            emergency_contact_relationship: data.emergency_contact_relationship || '',
            gender: data.gender || '',
            ethnicity: data.ethnicity || '',
            marital_status: data.marital_status || '',
            living_situation: data.living_situation || '',
            education_level: data.education_level || '',
            income_range: data.income_range || '',
            insurance_type: data.insurance_type || '',
            health_conditions: data.health_conditions || [],
            medications: data.medications || '',
            mobility_level: data.mobility_level || '',
            hearing_status: data.hearing_status || '',
            vision_status: data.vision_status || '',
            has_smartphone: data.has_smartphone || false,
            has_internet: data.has_internet || false,
            tech_comfort_level: data.tech_comfort_level || '',
            transportation_access: data.transportation_access || '',
            food_security: data.food_security || '',
            social_support: data.social_support || ''
          }));

          // Resume from saved step if available
          if (data.demographics_step) {
            setCurrentStep(data.demographics_step);
          }
        }
      } catch (err) {

        setError('Unable to load your information. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user, supabase, navigate]);

  const handleInputChange = (field: keyof DemographicsData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleHealthConditionToggle = (condition: string) => {
    setFormData(prev => ({
      ...prev,
      health_conditions: prev.health_conditions.includes(condition)
        ? prev.health_conditions.filter(c => c !== condition)
        : [...prev.health_conditions, condition]
    }));
  };

  const nextStep = () => {
    if (currentStep < 5) { // 5 steps total (removed PIN step - handled separately)
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Save progress without completing
  const saveProgress = async () => {
    setSaving(true);
    setError(null);

    try {
      // Use upsert in case profile doesn't exist yet (trigger may have failed)
      // Default tenant_id for WellFit Community self-registration
      const DEFAULT_TENANT_ID = '2b902657-6a20-4435-a78a-576f397517ca';

      const { error: profileError} = await supabase
        .from('profiles')
        .upsert({
          user_id: user?.id,
          tenant_id: DEFAULT_TENANT_ID,
          gender: formData.gender,
          ethnicity: formData.ethnicity,
          marital_status: formData.marital_status,
          living_situation: formData.living_situation,
          education_level: formData.education_level,
          income_range: formData.income_range,
          insurance_type: formData.insurance_type,
          emergency_contact_name: formData.emergency_contact_name,
          emergency_contact_phone: formData.emergency_contact_phone,
          emergency_contact_relationship: formData.emergency_contact_relationship,
          health_conditions: formData.health_conditions,
          medications: formData.medications,
          mobility_level: formData.mobility_level,
          hearing_status: formData.hearing_status,
          vision_status: formData.vision_status,
          has_smartphone: formData.has_smartphone,
          has_internet: formData.has_internet,
          tech_comfort_level: formData.tech_comfort_level,
          transportation_access: formData.transportation_access,
          food_security: formData.food_security,
          social_support: formData.social_support,
          demographics_step: currentStep, // Save current step
          demographics_complete: false // Not finished yet
        }, { onConflict: 'user_id' });

      if (profileError) throw profileError;

      // Navigate to dashboard with saved progress
      navigate('/dashboard');
    } catch (err) {

      setError('Unable to save your progress. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Skip demographics and go straight to consent
  const skipToConsent = async () => {
    setSaving(true);
    setError(null);

    try {
      // Mark that they skipped demographics for now
      // Use upsert in case profile doesn't exist yet
      // Default tenant_id for WellFit Community self-registration
      const DEFAULT_TENANT_ID = '2b902657-6a20-4435-a78a-576f397517ca';

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: user?.id,
          tenant_id: DEFAULT_TENANT_ID,
          demographics_step: null,
          demographics_complete: false
        }, { onConflict: 'user_id' });

      if (profileError) throw profileError;

      // Go to consent flow
      navigate('/consent-photo');
    } catch (err) {

      setError('Unable to proceed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    // Note: first_name, last_name, and phone are collected during registration
    // and should already be in the profile. We don't block here since those
    // fields aren't editable on this page - if missing, they can be added later.

    try {
      // Upsert profile with all demographics data (handles missing profile)
      // Default tenant_id for WellFit Community self-registration
      const DEFAULT_TENANT_ID = '2b902657-6a20-4435-a78a-576f397517ca';

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: user?.id,
          tenant_id: DEFAULT_TENANT_ID,
          gender: formData.gender,
          ethnicity: formData.ethnicity,
          marital_status: formData.marital_status,
          living_situation: formData.living_situation,
          education_level: formData.education_level,
          income_range: formData.income_range,
          insurance_type: formData.insurance_type,
          emergency_contact_name: formData.emergency_contact_name,
          emergency_contact_phone: formData.emergency_contact_phone,
          emergency_contact_relationship: formData.emergency_contact_relationship,
          health_conditions: formData.health_conditions,
          medications: formData.medications,
          mobility_level: formData.mobility_level,
          hearing_status: formData.hearing_status,
          vision_status: formData.vision_status,
          has_smartphone: formData.has_smartphone,
          has_internet: formData.has_internet,
          tech_comfort_level: formData.tech_comfort_level,
          transportation_access: formData.transportation_access,
          food_security: formData.food_security,
          social_support: formData.social_support,
          demographics_complete: true,
          demographics_step: null // Clear step since completed
        }, { onConflict: 'user_id' });

      if (profileError) throw profileError;

      // Navigate to consent forms after demographics completion
      navigate('/consent-photo');
    } catch (err) {

      setError('Unable to save your information. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

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
          <div className="mt-4">
            <div className="flex justify-center space-x-2">
              {[1, 2, 3, 4, 5].map((step) => (
                <div
                  key={step}
                  className={`w-3 h-3 rounded-full ${
                    step <= currentStep
                      ? 'bg-green-500'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">Step {currentStep} of 5</p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 text-center">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Step 1: Basic Demographics */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Basic Information</h2>

              <div>
                <label className="block text-lg font-medium text-gray-700 mb-2">
                  How do you identify your gender?
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                  className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Please select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non-binary">Non-binary</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label className="block text-lg font-medium text-gray-700 mb-2">
                  What is your ethnic background?
                </label>
                <select
                  value={formData.ethnicity}
                  onChange={(e) => handleInputChange('ethnicity', e.target.value)}
                  className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Please select</option>
                  <option value="white">White</option>
                  <option value="black">Black or African American</option>
                  <option value="hispanic">Hispanic or Latino</option>
                  <option value="asian">Asian</option>
                  <option value="native-american">Native American</option>
                  <option value="pacific-islander">Pacific Islander</option>
                  <option value="mixed">Mixed race</option>
                  <option value="other">Other</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label className="block text-lg font-medium text-gray-700 mb-2">
                  What is your marital status?
                </label>
                <select
                  value={formData.marital_status}
                  onChange={(e) => handleInputChange('marital_status', e.target.value)}
                  className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Please select</option>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                  <option value="separated">Separated</option>
                  <option value="domestic-partner">Domestic Partner</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Living Situation */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Your Living Situation</h2>

              <div>
                <label className="block text-lg font-medium text-gray-700 mb-2">
                  Who do you live with?
                </label>
                <select
                  value={formData.living_situation}
                  onChange={(e) => handleInputChange('living_situation', e.target.value)}
                  className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Please select</option>
                  <option value="alone">I live alone</option>
                  <option value="spouse">With my spouse/partner</option>
                  <option value="family">With family members</option>
                  <option value="roommate">With roommates/friends</option>
                  <option value="assisted-living">In assisted living</option>
                  <option value="nursing-home">In a nursing home</option>
                  <option value="other">Other arrangement</option>
                </select>
              </div>

              <div>
                <label className="block text-lg font-medium text-gray-700 mb-2">
                  What is your highest level of education?
                </label>
                <select
                  value={formData.education_level}
                  onChange={(e) => handleInputChange('education_level', e.target.value)}
                  className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Please select</option>
                  <option value="less-than-high-school">Less than high school</option>
                  <option value="high-school">High school diploma or GED</option>
                  <option value="some-college">Some college</option>
                  <option value="associate">Associate degree</option>
                  <option value="bachelor">Bachelor's degree</option>
                  <option value="graduate">Graduate degree</option>
                </select>
              </div>

              <div>
                <label className="block text-lg font-medium text-gray-700 mb-2">
                  What is your household income range? (Optional)
                </label>
                <select
                  value={formData.income_range}
                  onChange={(e) => handleInputChange('income_range', e.target.value)}
                  className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Prefer not to say</option>
                  <option value="under-25k">Under $25,000</option>
                  <option value="25k-50k">$25,000 - $50,000</option>
                  <option value="50k-75k">$50,000 - $75,000</option>
                  <option value="75k-100k">$75,000 - $100,000</option>
                  <option value="over-100k">Over $100,000</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 3: Health Information */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Health Information</h2>

              <div>
                <label className="block text-lg font-medium text-gray-700 mb-2">
                  What type of health insurance do you have?
                </label>
                <select
                  value={formData.insurance_type}
                  onChange={(e) => handleInputChange('insurance_type', e.target.value)}
                  className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Please select</option>
                  <option value="medicare">Medicare</option>
                  <option value="medicaid">Medicaid</option>
                  <option value="private">Private insurance</option>
                  <option value="medicare-supplement">Medicare + Supplement</option>
                  <option value="va">Veterans Affairs (VA)</option>
                  <option value="none">No insurance</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-lg font-medium text-gray-700 mb-2">
                  Do you have any of these health conditions? (Check all that apply)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    'Diabetes', 'High Blood Pressure', 'Heart Disease', 'Arthritis',
                    'Depression', 'Anxiety', 'COPD', 'Osteoporosis',
                    'Memory Problems', 'Chronic Pain', 'Kidney Disease', 'Cancer'
                  ].map((condition) => (
                    <label key={condition} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.health_conditions.includes(condition)}
                        onChange={() => handleHealthConditionToggle(condition)}
                        className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                      <span className="text-base">{condition}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-lg font-medium text-gray-700 mb-2">
                  How would you describe your mobility?
                </label>
                <select
                  value={formData.mobility_level}
                  onChange={(e) => handleInputChange('mobility_level', e.target.value)}
                  className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Please select</option>
                  <option value="excellent">I get around very well</option>
                  <option value="good">I get around well with minor difficulty</option>
                  <option value="fair">I need some help getting around</option>
                  <option value="poor">I need a lot of help getting around</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 4: Emergency Contact */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Emergency Contact</h2>

              <div>
                <label className="block text-lg font-medium text-gray-700 mb-2">
                  Emergency contact name
                </label>
                <input
                  type="text"
                  value={formData.emergency_contact_name}
                  onChange={(e) => handleInputChange('emergency_contact_name', e.target.value)}
                  className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Full name"
                />
              </div>

              <div>
                <label className="block text-lg font-medium text-gray-700 mb-2">
                  Emergency contact phone number
                </label>
                <input
                  type="tel"
                  value={formData.emergency_contact_phone}
                  onChange={(e) => handleInputChange('emergency_contact_phone', e.target.value)}
                  className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-lg font-medium text-gray-700 mb-2">
                  Relationship to you
                </label>
                <select
                  value={formData.emergency_contact_relationship}
                  onChange={(e) => handleInputChange('emergency_contact_relationship', e.target.value)}
                  className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Please select</option>
                  <option value="spouse">Spouse/Partner</option>
                  <option value="child">Child</option>
                  <option value="parent">Parent</option>
                  <option value="sibling">Brother/Sister</option>
                  <option value="friend">Friend</option>
                  <option value="neighbor">Neighbor</option>
                  <option value="caregiver">Caregiver</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 5: Social Support */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Social Support & Resources</h2>

              <div>
                <label className="block text-lg font-medium text-gray-700 mb-2">
                  How do you usually get around?
                </label>
                <select
                  value={formData.transportation_access}
                  onChange={(e) => handleInputChange('transportation_access', e.target.value)}
                  className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Please select</option>
                  <option value="own-car">I drive my own car</option>
                  <option value="family-drives">Family/friends drive me</option>
                  <option value="public-transport">Public transportation</option>
                  <option value="rideshare">Uber/Lyft/Taxi</option>
                  <option value="medical-transport">Medical transport</option>
                  <option value="walk">I walk most places</option>
                  <option value="limited">Limited transportation</option>
                </select>
              </div>

              <div>
                <label className="block text-lg font-medium text-gray-700 mb-2">
                  Do you ever worry about having enough food?
                </label>
                <select
                  value={formData.food_security}
                  onChange={(e) => handleInputChange('food_security', e.target.value)}
                  className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Please select</option>
                  <option value="never">Never</option>
                  <option value="rarely">Rarely</option>
                  <option value="sometimes">Sometimes</option>
                  <option value="often">Often</option>
                </select>
              </div>

              <div>
                <label className="block text-lg font-medium text-gray-700 mb-2">
                  How often do you feel lonely or isolated?
                </label>
                <select
                  value={formData.social_support}
                  onChange={(e) => handleInputChange('social_support', e.target.value)}
                  className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Please select</option>
                  <option value="never">Never</option>
                  <option value="rarely">Rarely</option>
                  <option value="sometimes">Sometimes</option>
                  <option value="often">Often</option>
                  <option value="always">Most of the time</option>
                </select>
              </div>

              <div>
                <label className="block text-lg font-medium text-gray-700 mb-2">
                  How comfortable are you with technology?
                </label>
                <select
                  value={formData.tech_comfort_level}
                  onChange={(e) => handleInputChange('tech_comfort_level', e.target.value)}
                  className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Please select</option>
                  <option value="very-comfortable">Very comfortable</option>
                  <option value="somewhat-comfortable">Somewhat comfortable</option>
                  <option value="not-very-comfortable">Not very comfortable</option>
                  <option value="not-comfortable">Not comfortable at all</option>
                </select>
              </div>
            </div>
          )}


          {/* Navigation Buttons */}
          <div className="flex justify-between items-center mt-8">
            {currentStep > 1 && (
              <button
                onClick={prevStep}
                className="px-6 py-3 text-lg font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
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
                  className="px-6 py-3 text-lg font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
                >
                  {saving ? 'Skipping...' : 'Skip to Consent'}
                </button>
              )}

              {/* Save for Later Button */}
              <button
                onClick={saveProgress}
                disabled={saving}
                className="px-6 py-3 text-lg font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save for Later'}
              </button>

              {/* Next/Complete Button */}
              {currentStep < 5 ? (
                <button
                  onClick={nextStep}
                  className="px-6 py-3 text-lg font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  style={{ backgroundColor: WELLFIT_COLORS.green }}
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-8 py-3 text-lg font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
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
              💡 <strong>Tip:</strong> You can click "Save for Later" to return to the dashboard and complete this later, or "Skip to Consent" to continue registration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemographicsPage;