/**
 * Senior Data Service
 *
 * Manages senior-specific data across dedicated tables:
 * - senior_demographics: Age-specific demographic information
 * - senior_health: Geriatric health tracking (mobility, cognition, ADLs)
 * - senior_sdoh: Social Determinants of Health (food security, transportation, isolation)
 * - senior_emergency_contacts: Multiple emergency contacts with healthcare proxy tracking
 *
 * Seniors (role_code 4) require different care tracking than regular patients.
 * Geriatric care involves SDOH, emergency contacts with specific relationships,
 * health conditions specific to aging, and demographics relevant to senior services.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ServiceResult, success, failure } from './_base';
import { auditLogger } from './auditLogger';

// ============================================================================
// Types
// ============================================================================

export interface SeniorDemographics {
  user_id: string;
  date_of_birth?: string;
  age_at_enrollment?: number;
  preferred_language?: string;
  requires_interpreter?: boolean;
  veteran_status?: boolean;
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed' | 'separated' | 'domestic-partner';
  living_situation?: 'alone' | 'spouse' | 'family' | 'roommate' | 'assisted-living' | 'nursing-home' | 'other';
  education_level?: string;
  primary_caregiver_name?: string;
  primary_caregiver_phone?: string;
  primary_caregiver_relationship?: string;
  tenant_id?: string;
}

export interface SeniorHealth {
  user_id: string;
  primary_diagnosis?: string[];
  chronic_conditions?: string[];
  allergies?: string[];
  current_medications?: string[];
  mobility_level?: 'independent' | 'cane' | 'walker' | 'wheelchair' | 'bedbound';
  fall_risk_level?: 'low' | 'moderate' | 'high';
  fall_history?: string;
  cognitive_status?: 'intact' | 'mild-impairment' | 'moderate-impairment' | 'severe-impairment';
  hearing_status?: 'normal' | 'mild-loss' | 'moderate-loss' | 'severe-loss' | 'hearing-aid';
  vision_status?: 'normal' | 'glasses' | 'low-vision' | 'legally-blind';
  dental_status?: string;
  nutrition_status?: 'well-nourished' | 'at-risk' | 'malnourished';
  weight_trend?: 'stable' | 'gaining' | 'losing';
  pain_level?: number;
  sleep_quality?: 'good' | 'fair' | 'poor';
  adl_score?: number;
  iadl_score?: number;
  last_hospitalization?: string;
  hospitalization_reason?: string;
  primary_care_physician?: string;
  specialist_providers?: string[];
  tenant_id?: string;
}

export interface SeniorSDOH {
  user_id: string;
  // Food Security
  food_security?: 'secure' | 'low-security' | 'very-low-security';
  meals_per_day?: number;
  needs_meal_assistance?: boolean;
  meal_delivery_enrolled?: boolean;
  // Transportation
  transportation_access?: 'own-car' | 'family-drives' | 'public-transport' | 'rideshare' | 'medical-transport' | 'limited' | 'none';
  can_drive?: boolean;
  needs_transport_assistance?: boolean;
  // Housing
  housing_type?: 'own-home' | 'rent' | 'senior-housing' | 'assisted-living' | 'family-home' | 'other';
  housing_safe?: boolean;
  home_modifications_needed?: string[];
  // Social Support
  social_isolation_risk?: 'low' | 'moderate' | 'high';
  has_regular_social_contact?: boolean;
  attends_senior_center?: boolean;
  attends_religious_services?: boolean;
  has_pets?: boolean;
  // Financial
  income_source?: string[];
  has_medicare?: boolean;
  has_medicaid?: boolean;
  has_supplemental_insurance?: boolean;
  financial_stress_level?: 'none' | 'mild' | 'moderate' | 'severe';
  needs_financial_assistance?: boolean;
  // Technology
  has_smartphone?: boolean;
  has_internet?: boolean;
  tech_comfort_level?: 'comfortable' | 'some-help' | 'needs-assistance' | 'unable';
  uses_medical_alert_device?: boolean;
  // Caregiver Burden
  caregiver_burnout_risk?: 'low' | 'moderate' | 'high';
  caregiver_needs_respite?: boolean;
  tenant_id?: string;
}

export interface SeniorEmergencyContact {
  id?: string;
  user_id: string;
  contact_name: string;
  contact_phone: string;
  contact_relationship: string;
  contact_priority?: number;
  is_healthcare_proxy?: boolean;
  is_power_of_attorney?: boolean;
  has_key_to_home?: boolean;
  notes?: string;
  tenant_id?: string;
}

export interface CompleteSeniorProfile {
  demographics: SeniorDemographics;
  health: SeniorHealth;
  sdoh: SeniorSDOH;
  emergency_contacts: SeniorEmergencyContact[];
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Get senior demographics for a user
 */
export async function getSeniorDemographics(
  supabase: SupabaseClient,
  userId: string
): Promise<ServiceResult<SeniorDemographics | null>> {
  try {
    const { data, error } = await supabase
      .from('senior_demographics')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      auditLogger.error('Failed to get senior demographics', error.message);
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data);
  } catch (err) {
    auditLogger.error('Unexpected error in getSeniorDemographics', String(err));
    return failure('UNKNOWN_ERROR', 'Failed to get senior demographics', err);
  }
}

/**
 * Save senior demographics (upsert)
 */
export async function saveSeniorDemographics(
  supabase: SupabaseClient,
  data: SeniorDemographics
): Promise<ServiceResult<SeniorDemographics>> {
  try {
    const { data: saved, error } = await supabase
      .from('senior_demographics')
      .upsert(data, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      auditLogger.error('Failed to save senior demographics', error.message);
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Senior demographics saved', { userId: data.user_id });
    return success(saved);
  } catch (err) {
    auditLogger.error('Unexpected error in saveSeniorDemographics', String(err));
    return failure('UNKNOWN_ERROR', 'Failed to save senior demographics', err);
  }
}

/**
 * Get senior health data for a user
 */
export async function getSeniorHealth(
  supabase: SupabaseClient,
  userId: string
): Promise<ServiceResult<SeniorHealth | null>> {
  try {
    const { data, error } = await supabase
      .from('senior_health')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      auditLogger.error('Failed to get senior health', error.message);
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data);
  } catch (err) {
    auditLogger.error('Unexpected error in getSeniorHealth', String(err));
    return failure('UNKNOWN_ERROR', 'Failed to get senior health', err);
  }
}

/**
 * Save senior health data (upsert)
 */
export async function saveSeniorHealth(
  supabase: SupabaseClient,
  data: SeniorHealth
): Promise<ServiceResult<SeniorHealth>> {
  try {
    const { data: saved, error } = await supabase
      .from('senior_health')
      .upsert(data, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      auditLogger.error('Failed to save senior health', error.message);
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Senior health saved', { userId: data.user_id });
    return success(saved);
  } catch (err) {
    auditLogger.error('Unexpected error in saveSeniorHealth', String(err));
    return failure('UNKNOWN_ERROR', 'Failed to save senior health', err);
  }
}

/**
 * Get senior SDOH data for a user
 */
export async function getSeniorSDOH(
  supabase: SupabaseClient,
  userId: string
): Promise<ServiceResult<SeniorSDOH | null>> {
  try {
    const { data, error } = await supabase
      .from('senior_sdoh')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      auditLogger.error('Failed to get senior SDOH', error.message);
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data);
  } catch (err) {
    auditLogger.error('Unexpected error in getSeniorSDOH', String(err));
    return failure('UNKNOWN_ERROR', 'Failed to get senior SDOH', err);
  }
}

/**
 * Save senior SDOH data (upsert)
 */
export async function saveSeniorSDOH(
  supabase: SupabaseClient,
  data: SeniorSDOH
): Promise<ServiceResult<SeniorSDOH>> {
  try {
    const { data: saved, error } = await supabase
      .from('senior_sdoh')
      .upsert(data, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      auditLogger.error('Failed to save senior SDOH', error.message);
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Senior SDOH saved', { userId: data.user_id });
    return success(saved);
  } catch (err) {
    auditLogger.error('Unexpected error in saveSeniorSDOH', String(err));
    return failure('UNKNOWN_ERROR', 'Failed to save senior SDOH', err);
  }
}

/**
 * Get all emergency contacts for a senior
 */
export async function getSeniorEmergencyContacts(
  supabase: SupabaseClient,
  userId: string
): Promise<ServiceResult<SeniorEmergencyContact[]>> {
  try {
    const { data, error } = await supabase
      .from('senior_emergency_contacts')
      .select('*')
      .eq('user_id', userId)
      .order('contact_priority', { ascending: true });

    if (error) {
      auditLogger.error('Failed to get senior emergency contacts', error.message);
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err) {
    auditLogger.error('Unexpected error in getSeniorEmergencyContacts', String(err));
    return failure('UNKNOWN_ERROR', 'Failed to get senior emergency contacts', err);
  }
}

/**
 * Save or update an emergency contact
 */
export async function saveSeniorEmergencyContact(
  supabase: SupabaseClient,
  contact: SeniorEmergencyContact
): Promise<ServiceResult<SeniorEmergencyContact>> {
  try {
    const { data: saved, error } = await supabase
      .from('senior_emergency_contacts')
      .upsert(contact)
      .select()
      .single();

    if (error) {
      auditLogger.error('Failed to save senior emergency contact', error.message);
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Senior emergency contact saved', { userId: contact.user_id });
    return success(saved);
  } catch (err) {
    auditLogger.error('Unexpected error in saveSeniorEmergencyContact', String(err));
    return failure('UNKNOWN_ERROR', 'Failed to save senior emergency contact', err);
  }
}

/**
 * Delete an emergency contact
 */
export async function deleteSeniorEmergencyContact(
  supabase: SupabaseClient,
  contactId: string
): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase
      .from('senior_emergency_contacts')
      .delete()
      .eq('id', contactId);

    if (error) {
      auditLogger.error('Failed to delete senior emergency contact', error.message);
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Senior emergency contact deleted', { contactId });
    return success(undefined);
  } catch (err) {
    auditLogger.error('Unexpected error in deleteSeniorEmergencyContact', String(err));
    return failure('UNKNOWN_ERROR', 'Failed to delete senior emergency contact', err);
  }
}

/**
 * Get complete senior profile (all tables)
 */
export async function getCompleteSeniorProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<ServiceResult<CompleteSeniorProfile>> {
  try {
    // Fetch all data in parallel
    const [demographicsResult, healthResult, sdohResult, contactsResult] = await Promise.all([
      getSeniorDemographics(supabase, userId),
      getSeniorHealth(supabase, userId),
      getSeniorSDOH(supabase, userId),
      getSeniorEmergencyContacts(supabase, userId),
    ]);

    // Check for errors
    if (!demographicsResult.success) return demographicsResult;
    if (!healthResult.success) return healthResult;
    if (!sdohResult.success) return sdohResult;
    if (!contactsResult.success) return contactsResult;

    return success({
      demographics: demographicsResult.data || { user_id: userId },
      health: healthResult.data || { user_id: userId },
      sdoh: sdohResult.data || { user_id: userId },
      emergency_contacts: contactsResult.data,
    });
  } catch (err) {
    auditLogger.error('Unexpected error in getCompleteSeniorProfile', String(err));
    return failure('UNKNOWN_ERROR', 'Failed to get complete senior profile', err);
  }
}

/**
 * Save complete senior profile (all tables)
 * Used by DemographicsPage to save all senior data at once
 */
export async function saveCompleteSeniorProfile(
  supabase: SupabaseClient,
  profile: CompleteSeniorProfile
): Promise<ServiceResult<CompleteSeniorProfile>> {
  try {
    // Save all data in parallel
    const [demographicsResult, healthResult, sdohResult] = await Promise.all([
      saveSeniorDemographics(supabase, profile.demographics),
      saveSeniorHealth(supabase, profile.health),
      saveSeniorSDOH(supabase, profile.sdoh),
    ]);

    // Check for errors
    if (!demographicsResult.success) return demographicsResult;
    if (!healthResult.success) return healthResult;
    if (!sdohResult.success) return sdohResult;

    // Save emergency contacts sequentially (might have dependencies)
    const savedContacts: SeniorEmergencyContact[] = [];
    for (const contact of profile.emergency_contacts) {
      const result = await saveSeniorEmergencyContact(supabase, contact);
      if (!result.success) return result;
      savedContacts.push(result.data);
    }

    auditLogger.info('Complete senior profile saved', { userId: profile.demographics.user_id });

    return success({
      demographics: demographicsResult.data,
      health: healthResult.data,
      sdoh: sdohResult.data,
      emergency_contacts: savedContacts,
    });
  } catch (err) {
    auditLogger.error('Unexpected error in saveCompleteSeniorProfile', String(err));
    return failure('UNKNOWN_ERROR', 'Failed to save complete senior profile', err);
  }
}

// ============================================================================
// Mapping Functions (UI form data to senior tables)
// ============================================================================

/**
 * Map demographics form data to senior tables
 * This is the key function that translates the DemographicsPage form data
 * into the proper senior table structure
 */
export function mapFormDataToSeniorProfile(
  userId: string,
  tenantId: string,
  formData: {
    // Basic demographics
    dob?: string;
    gender?: string;
    ethnicity?: string;
    marital_status?: string;
    living_situation?: string;
    education_level?: string;
    income_range?: string;
    insurance_type?: string;
    // Emergency contact
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relationship?: string;
    // Health
    health_conditions?: string[];
    medications?: string;
    mobility_level?: string;
    hearing_status?: string;
    vision_status?: string;
    // Technology
    has_smartphone?: boolean;
    has_internet?: boolean;
    tech_comfort_level?: string;
    // SDOH
    transportation_access?: string;
    food_security?: string;
    social_support?: string;
  }
): CompleteSeniorProfile {
  // Map mobility level from friendly names to database values
  const mobilityMap: Record<string, SeniorHealth['mobility_level']> = {
    'excellent': 'independent',
    'good': 'independent',
    'fair': 'cane',
    'poor': 'wheelchair',
  };

  // Map tech comfort from friendly names to database values
  const techComfortMap: Record<string, SeniorSDOH['tech_comfort_level']> = {
    'very-comfortable': 'comfortable',
    'somewhat-comfortable': 'some-help',
    'not-very-comfortable': 'needs-assistance',
    'not-comfortable': 'unable',
  };

  // Map food security to database values
  const foodSecurityMap: Record<string, SeniorSDOH['food_security']> = {
    'never': 'secure',
    'rarely': 'secure',
    'sometimes': 'low-security',
    'often': 'very-low-security',
  };

  // Map social support to isolation risk
  const socialIsolationMap: Record<string, SeniorSDOH['social_isolation_risk']> = {
    'never': 'low',
    'rarely': 'low',
    'sometimes': 'moderate',
    'often': 'high',
    'always': 'high',
  };

  // Build demographics
  const demographics: SeniorDemographics = {
    user_id: userId,
    tenant_id: tenantId,
    date_of_birth: formData.dob || undefined,
    marital_status: formData.marital_status as SeniorDemographics['marital_status'],
    living_situation: formData.living_situation as SeniorDemographics['living_situation'],
    education_level: formData.education_level,
  };

  // Build health
  const health: SeniorHealth = {
    user_id: userId,
    tenant_id: tenantId,
    chronic_conditions: formData.health_conditions,
    current_medications: formData.medications ? [formData.medications] : undefined,
    mobility_level: formData.mobility_level ? mobilityMap[formData.mobility_level] : undefined,
    hearing_status: formData.hearing_status as SeniorHealth['hearing_status'],
    vision_status: formData.vision_status as SeniorHealth['vision_status'],
  };

  // Build SDOH
  const sdoh: SeniorSDOH = {
    user_id: userId,
    tenant_id: tenantId,
    transportation_access: formData.transportation_access as SeniorSDOH['transportation_access'],
    food_security: formData.food_security ? foodSecurityMap[formData.food_security] : undefined,
    social_isolation_risk: formData.social_support ? socialIsolationMap[formData.social_support] : undefined,
    has_smartphone: formData.has_smartphone,
    has_internet: formData.has_internet,
    tech_comfort_level: formData.tech_comfort_level ? techComfortMap[formData.tech_comfort_level] : undefined,
    // Insurance mapping
    has_medicare: formData.insurance_type === 'medicare' || formData.insurance_type === 'medicare-supplement',
    has_medicaid: formData.insurance_type === 'medicaid',
    has_supplemental_insurance: formData.insurance_type === 'medicare-supplement',
    // Financial stress from income range (rough mapping)
    financial_stress_level: formData.income_range === 'under-25k' ? 'moderate' :
                           formData.income_range === '25k-50k' ? 'mild' : 'none',
  };

  // Build emergency contacts (single contact from form)
  const emergency_contacts: SeniorEmergencyContact[] = [];
  if (formData.emergency_contact_name && formData.emergency_contact_phone) {
    emergency_contacts.push({
      user_id: userId,
      tenant_id: tenantId,
      contact_name: formData.emergency_contact_name,
      contact_phone: formData.emergency_contact_phone,
      contact_relationship: formData.emergency_contact_relationship || 'other',
      contact_priority: 1,
    });
  }

  return {
    demographics,
    health,
    sdoh,
    emergency_contacts,
  };
}

// Export as a service object for consistent usage
export const SeniorDataService = {
  getSeniorDemographics,
  saveSeniorDemographics,
  getSeniorHealth,
  saveSeniorHealth,
  getSeniorSDOH,
  saveSeniorSDOH,
  getSeniorEmergencyContacts,
  saveSeniorEmergencyContact,
  deleteSeniorEmergencyContact,
  getCompleteSeniorProfile,
  saveCompleteSeniorProfile,
  mapFormDataToSeniorProfile,
};

export default SeniorDataService;
