// src/pages/DemographicsPage/useDemographicsForm.ts
// Custom hook containing all state and logic for the Demographics form

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';
import { SeniorDataService, mapFormDataToSeniorProfile } from '../../services/seniorDataService';
import { auditLogger } from '../../services/auditLogger';
import { DemographicsData, UserRole, INITIAL_FORM_DATA, DEFAULT_TENANT_ID } from './types';

export interface UseDemographicsFormReturn {
  // State
  formData: DemographicsData;
  currentStep: number;
  totalSteps: number;
  loading: boolean;
  submitting: boolean;
  saving: boolean;
  error: string | null;
  userRole: UserRole;

  // Handlers
  handleInputChange: (field: keyof DemographicsData, value: DemographicsData[keyof DemographicsData]) => void;
  handleHealthConditionToggle: (condition: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  saveProgress: () => Promise<void>;
  skipToConsent: () => Promise<void>;
  handleSubmit: () => Promise<void>;
  setError: (error: string | null) => void;
}

export function useDemographicsForm(): UseDemographicsFormReturn {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const user = useUser();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('senior');
  const [formData, setFormData] = useState<DemographicsData>(INITIAL_FORM_DATA);

  // Number of steps depends on user role
  // Seniors: 5 steps (basic, living situation, health, emergency, social/SDOH)
  // Patients: 4 steps (basic, health, emergency, social/SDOH)
  const totalSteps = userRole === 'senior' ? 5 : 4;

  // ✅ Single guard used by all write actions - returns userId or null
  const requireUserIdOrSetError = (): string | null => {
    if (!user?.id) {
      setError('Your session is still loading. Please wait a moment and try again.');
      return null;
    }
    return user.id;
  };

  // Load existing profile data
  useEffect(() => {
    const loadProfile = async () => {
      // ✅ Do NOT redirect if user is undefined - auth context may still be booting
      if (!user?.id) {
        setLoading(false);
        setError('Your session is still loading. Please wait a moment and try again.');
        return;
      }

      try {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (data) {
          const roleName = data.role || data.role_slug || 'senior';
          const userRoleCode = data.role_code || 4;

          if (userRoleCode === 4 || roleName === 'senior') {
            setUserRole('senior');
          } else if (userRoleCode === 19 || roleName === 'patient') {
            setUserRole('patient');
          } else {
            setUserRole('other');
          }

          // Skip demographics for admin/staff roles
          if (['admin', 'super_admin', 'staff', 'moderator'].includes(roleName)) {
            navigate('/dashboard');
            return;
          }

          // Check if already completed
          if (data.demographics_complete) {
            navigate('/dashboard');
            return;
          }

          // Load data from dedicated senior tables
          const seniorProfileResult = await SeniorDataService.getCompleteSeniorProfile(supabase, user.id);

          // Map senior table data back to form fields
          const seniorData = mapSeniorDataToForm(seniorProfileResult);

          // Pre-fill all available data
          setFormData(prev => ({
            ...prev,
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            phone: data.phone || '',
            dob: seniorData.dob || data.dob || '',
            address: data.address || '',
            emergency_contact_name: seniorData.emergency_contact_name || data.emergency_contact_name || '',
            emergency_contact_phone: seniorData.emergency_contact_phone || data.emergency_contact_phone || '',
            emergency_contact_relationship: seniorData.emergency_contact_relationship || data.emergency_contact_relationship || '',
            gender: data.gender || '',
            ethnicity: data.ethnicity || '',
            marital_status: seniorData.marital_status || data.marital_status || '',
            living_situation: seniorData.living_situation || data.living_situation || '',
            education_level: seniorData.education_level || data.education_level || '',
            income_range: data.income_range || '',
            insurance_type: data.insurance_type || '',
            preferred_language: seniorData.preferred_language || 'en',
            requires_interpreter: seniorData.requires_interpreter || false,
            veteran_status: seniorData.veteran_status || false,
            health_conditions: seniorData.health_conditions.length > 0 ? seniorData.health_conditions : (data.health_conditions || []),
            medications: seniorData.medications || data.medications || '',
            mobility_level: seniorData.mobility_level || data.mobility_level || '',
            hearing_status: seniorData.hearing_status || data.hearing_status || '',
            vision_status: seniorData.vision_status || data.vision_status || '',
            has_smartphone: seniorData.has_smartphone || data.has_smartphone || false,
            has_internet: seniorData.has_internet || data.has_internet || false,
            tech_comfort_level: seniorData.tech_comfort_level || data.tech_comfort_level || '',
            transportation_access: seniorData.transportation_access || data.transportation_access || '',
            food_security: seniorData.food_security || data.food_security || '',
            social_support: seniorData.social_support || data.social_support || ''
          }));

          // Resume from saved step if available
          if (data.demographics_step) {
            setCurrentStep(data.demographics_step);
          }
        }
      } catch (err) {
        auditLogger.error('Failed to load profile', String(err));
        setError('Unable to load your information. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user, supabase, navigate]);

  const handleInputChange = useCallback((field: keyof DemographicsData, value: DemographicsData[keyof DemographicsData]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleHealthConditionToggle = useCallback((condition: string) => {
    setFormData(prev => ({
      ...prev,
      health_conditions: prev.health_conditions.includes(condition)
        ? prev.health_conditions.filter(c => c !== condition)
        : [...prev.health_conditions, condition]
    }));
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, totalSteps]);

  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const saveProgress = useCallback(async () => {
    setSaving(true);
    setError(null);

    const userId = requireUserIdOrSetError();
    if (!userId) {
      setSaving(false);
      return;
    }

    try {
      const seniorProfile = mapFormDataToSeniorProfile(userId, DEFAULT_TENANT_ID, formData);
      const seniorResult = await SeniorDataService.saveCompleteSeniorProfile(supabase, seniorProfile);

      if (!seniorResult.success) {
        auditLogger.warn('Partial save to senior tables failed', { error: seniorResult.error.message });
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: userId,
          tenant_id: DEFAULT_TENANT_ID,
          gender: formData.gender,
          ethnicity: formData.ethnicity,
          demographics_step: currentStep,
          demographics_complete: false
        }, { onConflict: 'user_id' });

      if (profileError) throw profileError;

      auditLogger.info('Senior demographics progress saved', { userId, step: currentStep });
      navigate('/dashboard');
    } catch (err) {
      auditLogger.error('Failed to save demographics progress', String(err));
      setError('Unable to save your progress. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [user, supabase, formData, currentStep, navigate]);

  const skipToConsent = useCallback(async () => {
    setSaving(true);
    setError(null);

    const userId = requireUserIdOrSetError();
    if (!userId) {
      setSaving(false);
      return;
    }

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: userId,
          tenant_id: DEFAULT_TENANT_ID,
          demographics_step: null,
          demographics_complete: false
        }, { onConflict: 'user_id' });

      if (profileError) throw profileError;
      navigate('/consent-photo');
    } catch (err) {
      setError('Unable to proceed. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [user, supabase, navigate]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError(null);

    const userId = requireUserIdOrSetError();
    if (!userId) {
      setSubmitting(false);
      return;
    }

    try {
      const seniorProfile = mapFormDataToSeniorProfile(userId, DEFAULT_TENANT_ID, formData);
      const seniorResult = await SeniorDataService.saveCompleteSeniorProfile(supabase, seniorProfile);

      if (!seniorResult.success) {
        auditLogger.error('Failed to save senior profile', seniorResult.error.message);
        throw new Error(seniorResult.error.message);
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: userId,
          tenant_id: DEFAULT_TENANT_ID,
          gender: formData.gender,
          ethnicity: formData.ethnicity,
          demographics_complete: true,
          demographics_step: null
        }, { onConflict: 'user_id' });

      if (profileError) throw profileError;

      auditLogger.info('Senior demographics completed', { userId });
      navigate('/consent-photo');
    } catch (err) {
      auditLogger.error('Failed to save demographics', String(err));
      setError('Unable to save your information. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [user, supabase, formData, navigate]);

  return {
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
    handleSubmit,
    setError
  };
}

// Helper function to map senior profile result back to form data
interface SeniorFormData {
  dob: string;
  marital_status: string;
  living_situation: string;
  education_level: string;
  preferred_language: string;
  requires_interpreter: boolean;
  veteran_status: boolean;
  health_conditions: string[];
  medications: string;
  mobility_level: string;
  hearing_status: string;
  vision_status: string;
  transportation_access: string;
  food_security: string;
  social_support: string;
  has_smartphone: boolean;
  has_internet: boolean;
  tech_comfort_level: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
}

function mapSeniorDataToForm(seniorProfileResult: Awaited<ReturnType<typeof SeniorDataService.getCompleteSeniorProfile>>): SeniorFormData {
  const seniorData: SeniorFormData = {
    dob: '',
    marital_status: '',
    living_situation: '',
    education_level: '',
    preferred_language: 'en',
    requires_interpreter: false,
    veteran_status: false,
    health_conditions: [],
    medications: '',
    mobility_level: '',
    hearing_status: '',
    vision_status: '',
    transportation_access: '',
    food_security: '',
    social_support: '',
    has_smartphone: false,
    has_internet: false,
    tech_comfort_level: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: '',
  };

  if (!seniorProfileResult.success) return seniorData;

  const { demographics, health, sdoh, emergency_contacts } = seniorProfileResult.data;

  // Map demographics
  seniorData.dob = demographics.date_of_birth || '';
  seniorData.marital_status = demographics.marital_status || '';
  seniorData.living_situation = demographics.living_situation || '';
  seniorData.education_level = demographics.education_level || '';
  seniorData.preferred_language = demographics.preferred_language || 'en';
  seniorData.requires_interpreter = demographics.requires_interpreter || false;
  seniorData.veteran_status = demographics.veteran_status || false;

  // Map health with reverse mapping
  seniorData.health_conditions = health.chronic_conditions || [];
  seniorData.medications = (health.current_medications || []).join(', ');

  const mobilityReverseMap: Record<string, string> = {
    'independent': 'excellent',
    'cane': 'fair',
    'walker': 'fair',
    'wheelchair': 'poor',
    'bedbound': 'poor',
  };
  seniorData.mobility_level = health.mobility_level ? mobilityReverseMap[health.mobility_level] || '' : '';
  seniorData.hearing_status = health.hearing_status || '';
  seniorData.vision_status = health.vision_status || '';

  // Map SDOH with reverse mapping
  seniorData.transportation_access = sdoh.transportation_access || '';

  const foodSecurityReverseMap: Record<string, string> = {
    'secure': 'never',
    'low-security': 'sometimes',
    'very-low-security': 'often',
  };
  seniorData.food_security = sdoh.food_security ? foodSecurityReverseMap[sdoh.food_security] || '' : '';

  const socialReverseMap: Record<string, string> = {
    'low': 'rarely',
    'moderate': 'sometimes',
    'high': 'often',
  };
  seniorData.social_support = sdoh.social_isolation_risk ? socialReverseMap[sdoh.social_isolation_risk] || '' : '';
  seniorData.has_smartphone = sdoh.has_smartphone || false;
  seniorData.has_internet = sdoh.has_internet || false;

  const techReverseMap: Record<string, string> = {
    'comfortable': 'very-comfortable',
    'some-help': 'somewhat-comfortable',
    'needs-assistance': 'not-very-comfortable',
    'unable': 'not-comfortable',
  };
  seniorData.tech_comfort_level = sdoh.tech_comfort_level ? techReverseMap[sdoh.tech_comfort_level] || '' : '';

  // Map primary emergency contact
  if (emergency_contacts.length > 0) {
    const primary = emergency_contacts[0];
    seniorData.emergency_contact_name = primary.contact_name || '';
    seniorData.emergency_contact_phone = primary.contact_phone || '';
    seniorData.emergency_contact_relationship = primary.contact_relationship || '';
  }

  return seniorData;
}
