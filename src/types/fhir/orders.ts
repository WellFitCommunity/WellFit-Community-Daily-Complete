/**
 * FHIR R4 Order Resource Types
 *
 * ServiceRequest — single resource that backs both lab orders (ONC 170.315(a)(2))
 * and imaging orders (ONC 170.315(a)(3)). The `category` array discriminates
 * the order type: ['laboratory'] vs ['imaging'].
 *
 * Mirrors the shape of fhir_service_requests in the database (migration
 * 20260528102906_create_fhir_service_requests.sql).
 *
 * @see https://hl7.org/fhir/R4/servicerequest.html
 */

import type { FHIRResource } from './base';

export type ServiceRequestStatus =
  | 'draft'
  | 'active'
  | 'on-hold'
  | 'revoked'
  | 'completed'
  | 'entered-in-error'
  | 'unknown';

export type ServiceRequestIntent =
  | 'proposal'
  | 'plan'
  | 'directive'
  | 'order'
  | 'original-order'
  | 'reflex-order'
  | 'filler-order'
  | 'instance-order'
  | 'option';

export type ServiceRequestPriority = 'routine' | 'urgent' | 'asap' | 'stat';

export type ServiceRequestLaterality = 'left' | 'right' | 'bilateral';

export interface ServiceRequest extends FHIRResource {
  status: ServiceRequestStatus;
  intent: ServiceRequestIntent;
  patient_id: string;

  /**
   * FHIR R4 ServiceRequest.category — multi-valued. Acts as the order-type
   * discriminator. Common: 'laboratory', 'imaging', 'counselling',
   * 'education', 'surgical-procedure'.
   */
  category: string[];

  /** Code system OID/URI — LOINC for labs, RadLex/CPT for imaging */
  code_system?: string;
  /** The code being ordered */
  code: string;
  /** Human-readable display for the ordered service */
  code_display: string;

  priority?: ServiceRequestPriority;

  authored_on: string;

  requester_type?: string;
  requester_id?: string;
  requester_display?: string;
  requester_practitioner_id?: string;

  performer_type?: string;
  performer_id?: string;
  performer_display?: string;

  reason_code?: string[];
  reason_reference?: string[];
  encounter_id?: string;

  /** Lab-order context (NULL for non-lab orders) */
  specimen_type?: string;
  fasting_required?: boolean;

  /** Imaging-order context (NULL for non-imaging orders) */
  body_site?: string;
  body_site_laterality?: ServiceRequestLaterality;
  contrast_required?: boolean;

  occurrence_datetime?: string;
  occurrence_period_start?: string;
  occurrence_period_end?: string;

  note?: string;
  patient_instruction?: string;

  tenant_id?: string;
}

export interface CreateServiceRequest extends Partial<ServiceRequest> {
  patient_id: string;
  status: ServiceRequestStatus;
  intent: ServiceRequestIntent;
  category: string[];
  code: string;
  code_display: string;
}
