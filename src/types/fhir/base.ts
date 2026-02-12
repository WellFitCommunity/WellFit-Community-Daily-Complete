/**
 * FHIR R4 Base Types
 *
 * Foundation types used across all FHIR resource definitions.
 * Part of the fhir types decomposition (Strangler Fig from fhir.ts).
 */

// ============================================================================
// BASE FHIR TYPES
// ============================================================================

export interface FHIRResource {
  id: string;
  fhir_id: string;
  created_at: string;
  updated_at: string;
  last_synced_at?: string;
  sync_source?: string;
  external_id?: string;
}

export interface CodeableConcept {
  system?: string;
  code: string;
  display: string;
  text?: string;
}

export interface Reference {
  type?: string;
  id?: string;
  display?: string;
}

export interface Period {
  start?: string;
  end?: string;
}

export interface Quantity {
  value: number;
  unit: string;
  code?: string;
  system?: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface FHIRApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface FHIRSearchParams {
  patient?: string;
  status?: string;
  code?: string;
  category?: string;
  date?: string;
  encounter?: string;
  _count?: number;
  _sort?: string;
}

// ============================================================================
// CONTACT & ADDRESS (shared across Practitioner, Location, Organization, etc.)
// ============================================================================

export interface FHIRContactPoint {
  system: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  rank?: number;
  period?: {
    start?: string;
    end?: string;
  };
}

export interface FHIRAddress {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  type?: 'postal' | 'physical' | 'both';
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  period?: {
    start?: string;
    end?: string;
  };
}
