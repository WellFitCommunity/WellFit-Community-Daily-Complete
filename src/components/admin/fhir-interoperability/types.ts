/**
 * FHIR Interoperability Dashboard — Shared types
 */

export type TabId = 'overview' | 'connections' | 'sync' | 'mappings' | 'analytics' | 'resources';
export type SyncFrequency = 'manual' | 'realtime' | 'hourly' | 'daily';
export type EHRSystem = 'EPIC' | 'CERNER' | 'ALLSCRIPTS' | 'CUSTOM';

export interface FHIRResourceFormData {
  resourceType: string;
  patientId: string;
  fields: Record<string, string>;
}

export interface ResourceSearchFilters {
  resourceType: string;
  patientId: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}
