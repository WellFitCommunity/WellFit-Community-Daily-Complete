// src/pages/DemographicsPage/types.ts
// Shared types for the Demographics page components

export interface DemographicsData {
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

  // Language & Accessibility
  preferred_language: string;
  requires_interpreter: boolean;

  // Veteran Status
  veteran_status: boolean;

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

// Role types that use this demographics form
export type UserRole = 'senior' | 'patient' | 'other';

// Initial form data state
export const INITIAL_FORM_DATA: DemographicsData = {
  first_name: '',
  last_name: '',
  phone: '',
  dob: '',
  address: '',
  pin: '',
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
  preferred_language: 'en',
  requires_interpreter: false,
  veteran_status: false,
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
};

// Default tenant ID for WellFit Community self-registration
export const DEFAULT_TENANT_ID = '2b902657-6a20-4435-a78a-576f397517ca';

// Props interface for step components
export interface StepProps {
  formData: DemographicsData;
  onInputChange: (field: keyof DemographicsData, value: DemographicsData[keyof DemographicsData]) => void;
  onHealthConditionToggle?: (condition: string) => void;
}
