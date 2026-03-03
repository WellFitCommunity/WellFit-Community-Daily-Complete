/**
 * Types for the Prior Auth Dashboard
 *
 * Shared type aliases, form state, and status config used across
 * PriorAuthDashboard sub-components.
 */

import type { PriorAuthUrgency } from '../../../services/fhir/prior-auth';

export type ViewMode = 'list' | 'create';

export interface CreateFormState {
  patient_id: string;
  payer_id: string;
  payer_name: string;
  service_codes: string;
  diagnosis_codes: string;
  urgency: PriorAuthUrgency;
  clinical_notes: string;
  date_of_service: string;
}

export const INITIAL_FORM: CreateFormState = {
  patient_id: '',
  payer_id: '',
  payer_name: '',
  service_codes: '',
  diagnosis_codes: '',
  urgency: 'routine',
  clinical_notes: '',
  date_of_service: new Date().toISOString().split('T')[0],
};

export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'text-gray-700', bg: 'bg-gray-100' },
  pending_submission: { label: 'Pending Submission', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  submitted: { label: 'Submitted', color: 'text-blue-700', bg: 'bg-blue-100' },
  pending_review: { label: 'Pending Review', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  approved: { label: 'Approved', color: 'text-green-700', bg: 'bg-green-100' },
  denied: { label: 'Denied', color: 'text-red-700', bg: 'bg-red-100' },
  partial_approval: { label: 'Partial', color: 'text-orange-700', bg: 'bg-orange-100' },
  pending_additional_info: { label: 'Info Needed', color: 'text-purple-700', bg: 'bg-purple-100' },
  cancelled: { label: 'Cancelled', color: 'text-gray-500', bg: 'bg-gray-50' },
  expired: { label: 'Expired', color: 'text-red-500', bg: 'bg-red-50' },
  appealed: { label: 'Appealed', color: 'text-amber-700', bg: 'bg-amber-100' },
};
