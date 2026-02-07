/**
 * SMART App Management - Shared Types & Constants
 *
 * Used by SmartAppManagementPanel, SmartAppCard, SmartAppRegistrationModal,
 * and SmartAppReviewModal.
 */

import { Smartphone, Stethoscope, Server, FlaskConical } from 'lucide-react';
import type React from 'react';

// ---- Data Types ----

export interface SmartApp {
  id: string;
  tenant_id: string | null;
  client_id: string;
  client_name: string;
  client_description: string | null;
  client_uri: string | null;
  logo_uri: string | null;
  client_secret_hash: string | null;
  is_confidential: boolean;
  redirect_uris: string[];
  launch_uri: string | null;
  scopes_allowed: string[];
  pkce_required: boolean;
  token_endpoint_auth_method: 'none' | 'client_secret_basic' | 'client_secret_post' | 'private_key_jwt';
  jwks_uri: string | null;
  app_type: 'patient' | 'provider' | 'system' | 'research';
  status: 'pending' | 'approved' | 'rejected' | 'suspended' | 'revoked';
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  developer_name: string | null;
  developer_email: string | null;
  tos_uri: string | null;
  policy_uri: string | null;
  total_authorizations: number;
  active_authorizations: number;
  last_authorization_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SmartAppFormData {
  client_name: string;
  client_description: string;
  client_uri: string;
  logo_uri: string;
  is_confidential: boolean;
  redirect_uris: string;
  launch_uri: string;
  scopes_allowed: string[];
  pkce_required: boolean;
  token_endpoint_auth_method: 'none' | 'client_secret_basic' | 'client_secret_post' | 'private_key_jwt';
  jwks_uri: string;
  app_type: 'patient' | 'provider' | 'system' | 'research';
  developer_name: string;
  developer_email: string;
  tos_uri: string;
  policy_uri: string;
}

// ---- Constants ----

export const emptyFormData: SmartAppFormData = {
  client_name: '',
  client_description: '',
  client_uri: '',
  logo_uri: '',
  is_confidential: false,
  redirect_uris: '',
  launch_uri: '',
  scopes_allowed: ['patient/*.read', 'openid', 'fhirUser'],
  pkce_required: true,
  token_endpoint_auth_method: 'none',
  jwks_uri: '',
  app_type: 'patient',
  developer_name: '',
  developer_email: '',
  tos_uri: '',
  policy_uri: '',
};

export const SMART_SCOPES = [
  { value: 'openid', label: 'OpenID Connect', description: 'Required for identity' },
  { value: 'fhirUser', label: 'FHIR User', description: 'Current user identity' },
  { value: 'profile', label: 'Profile', description: 'Basic user profile' },
  { value: 'patient/*.read', label: 'Patient Read All', description: 'Read all patient data' },
  { value: 'patient/*.write', label: 'Patient Write All', description: 'Write all patient data' },
  { value: 'patient/Observation.read', label: 'Observations', description: 'Read vitals and lab results' },
  { value: 'patient/Condition.read', label: 'Conditions', description: 'Read diagnoses' },
  { value: 'patient/MedicationRequest.read', label: 'Medications', description: 'Read prescriptions' },
  { value: 'patient/AllergyIntolerance.read', label: 'Allergies', description: 'Read allergies' },
  { value: 'patient/Immunization.read', label: 'Immunizations', description: 'Read vaccines' },
  { value: 'patient/Procedure.read', label: 'Procedures', description: 'Read procedures' },
  { value: 'patient/CarePlan.read', label: 'Care Plans', description: 'Read care plans' },
  { value: 'launch', label: 'EHR Launch', description: 'Support EHR launch context' },
  { value: 'offline_access', label: 'Offline Access', description: 'Refresh tokens for long-term access' },
] as const;

export const appTypeIcons: Record<string, React.ElementType> = {
  patient: Smartphone,
  provider: Stethoscope,
  system: Server,
  research: FlaskConical,
};

export const appTypeLabels: Record<string, string> = {
  patient: 'Patient App',
  provider: 'Provider App',
  system: 'System/Backend',
  research: 'Research App',
};

export const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  suspended: 'bg-orange-100 text-orange-800',
  revoked: 'bg-gray-100 text-gray-800',
};
