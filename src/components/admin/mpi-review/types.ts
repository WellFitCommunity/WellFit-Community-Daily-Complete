/**
 * MPI Review Queue — Shared types, constants, and helpers
 *
 * @module mpi-review/types
 * Copyright © 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { AlertTriangle, Clock } from 'lucide-react';
import type { MPIMatchCandidate, MPIPriority } from '../../../services/mpiMatchingService';
import type { PatientDemographics } from '../../../types/patientContext';

// =============================================================================
// TYPES
// =============================================================================

export interface PatientInfo {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  dob: string | null;
  phone: string | null;
  mrn: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  gender: string | null;
  email: string | null;
}

export interface CandidateWithPatients extends MPIMatchCandidate {
  patientA?: PatientInfo;
  patientB?: PatientInfo;
}

/** Address/email fields lazy-loaded on expand (not in PatientDemographics) */
export interface PatientAddressFields {
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  email: string | null;
}

export type FilterStatus = 'all' | 'pending' | 'under_review' | 'confirmed_match' | 'confirmed_not_match';
export type SortField = 'score' | 'priority' | 'date';

// =============================================================================
// CONSTANTS
// =============================================================================

export const PRIORITY_CONFIG: Record<MPIPriority, { label: string; color: string; icon: typeof AlertTriangle }> = {
  urgent: { label: 'Urgent', color: 'text-red-600 bg-red-50 border-red-200', icon: AlertTriangle },
  high: { label: 'High', color: 'text-orange-600 bg-orange-50 border-orange-200', icon: AlertTriangle },
  normal: { label: 'Normal', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Clock },
  low: { label: 'Low', color: 'text-gray-600 bg-gray-50 border-gray-200', icon: Clock },
};

export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-800' },
  under_review: { label: 'Under Review', color: 'bg-blue-100 text-blue-800' },
  confirmed_match: { label: 'Confirmed Match', color: 'bg-green-100 text-green-800' },
  confirmed_not_match: { label: 'Not a Match', color: 'bg-gray-100 text-gray-800' },
  merged: { label: 'Merged', color: 'bg-purple-100 text-purple-800' },
  deferred: { label: 'Deferred', color: 'bg-orange-100 text-orange-800' },
};

// =============================================================================
// HELPERS
// =============================================================================

/** Map PatientDemographics → PatientInfo (address/email null until lazy-loaded) */
export function mapToPatientInfo(d: PatientDemographics | undefined): PatientInfo | undefined {
  if (!d) return undefined;
  return {
    user_id: d.patient_id, first_name: d.first_name, last_name: d.last_name,
    dob: d.dob, phone: d.phone, mrn: d.mrn, gender: d.gender,
    address: null, city: null, state: null, zip: null, email: null,
  };
}
