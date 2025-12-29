/**
 * FHIR Resource Mapper
 *
 * Maps offline healthcare records to FHIR R4 resources for interoperability.
 * Supports standard FHIR resources: Encounter, DiagnosticReport, Observation, Media, Flag.
 *
 * Implements:
 * - FHIR R4 (v4.0.1) specification
 * - US Core Implementation Guide profiles where applicable
 * - SNOMED CT and ICD-10 coding systems
 */

import type { ServiceResult } from '../../_base/ServiceResult';
import { success, failure } from '../../_base/ServiceResult';
import type {
  OfflineFieldVisit,
  OfflineAssessment,
  OfflinePhoto,
  OfflineAlert,
  FHIRResource,
  FHIRBundle,
  FHIRBundleEntry,
} from './types';

/**
 * FHIR Encounter resource
 */
interface FHIREncounter extends FHIRResource {
  resourceType: 'Encounter';
  status: 'planned' | 'in-progress' | 'on-hold' | 'completed' | 'cancelled' | 'entered-in-error';
  class: {
    system: string;
    code: string;
    display: string;
  };
  subject: {
    reference: string;
    display?: string;
  };
  participant?: Array<{
    type?: Array<{
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    }>;
    individual?: {
      reference: string;
      display?: string;
    };
  }>;
  period?: {
    start?: string;
    end?: string;
  };
  location?: Array<{
    location: {
      display: string;
    };
    physicalType?: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    };
  }>;
  serviceType?: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
}

/**
 * FHIR DiagnosticReport resource
 */
interface FHIRDiagnosticReport extends FHIRResource {
  resourceType: 'DiagnosticReport';
  status: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'cancelled';
  category?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  }>;
  code: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text?: string;
  };
  subject: {
    reference: string;
  };
  encounter?: {
    reference: string;
  };
  effectiveDateTime?: string;
  issued?: string;
  conclusion?: string;
  conclusionCode?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  }>;
}

/**
 * FHIR Media resource
 */
interface FHIRMedia extends FHIRResource {
  resourceType: 'Media';
  status: 'preparation' | 'in-progress' | 'not-done' | 'on-hold' | 'stopped' | 'completed' | 'entered-in-error' | 'unknown';
  type?: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  subject: {
    reference: string;
  };
  encounter?: {
    reference: string;
  };
  createdDateTime?: string;
  bodySite?: {
    coding?: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text?: string;
  };
  content: {
    contentType: string;
    url?: string;
    size?: number;
    title?: string;
  };
  note?: Array<{
    text: string;
  }>;
}

/**
 * FHIR Flag resource
 */
interface FHIRFlag extends FHIRResource {
  resourceType: 'Flag';
  status: 'active' | 'inactive' | 'entered-in-error';
  category?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  }>;
  code: {
    coding?: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  };
  subject: {
    reference: string;
  };
  encounter?: {
    reference: string;
  };
  period?: {
    start: string;
    end?: string;
  };
}

/**
 * FHIR coding systems
 */
const FHIR_SYSTEMS = {
  SNOMED: 'http://snomed.info/sct',
  LOINC: 'http://loinc.org',
  ICD10: 'http://hl7.org/fhir/sid/icd-10-cm',
  CPT: 'http://www.ama-assn.org/go/cpt',
  ENCOUNTER_CLASS: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
  PARTICIPANT_TYPE: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
  DIAGNOSTIC_SERVICE: 'http://terminology.hl7.org/CodeSystem/v2-0074',
  FLAG_CATEGORY: 'http://terminology.hl7.org/CodeSystem/flag-category',
  MEDIA_TYPE: 'http://terminology.hl7.org/CodeSystem/media-type',
} as const;

/**
 * Visit type to FHIR encounter class mapping
 */
const VISIT_TYPE_TO_ENCOUNTER_CLASS: Record<string, { code: string; display: string }> = {
  routine: { code: 'HH', display: 'home health' },
  follow_up: { code: 'HH', display: 'home health' },
  emergency: { code: 'EMER', display: 'emergency' },
  initial: { code: 'HH', display: 'home health' },
  discharge: { code: 'HH', display: 'home health' },
};

/**
 * Visit status to FHIR encounter status mapping
 */
const VISIT_STATUS_TO_ENCOUNTER_STATUS: Record<string, FHIREncounter['status']> = {
  scheduled: 'planned',
  in_progress: 'in-progress',
  completed: 'completed',
  cancelled: 'cancelled',
  no_show: 'cancelled',
};

/**
 * Alert severity to FHIR flag category mapping
 */
const SEVERITY_TO_FLAG_CATEGORY: Record<string, { code: string; display: string }> = {
  low: { code: 'admin', display: 'Administrative' },
  medium: { code: 'clinical', display: 'Clinical' },
  high: { code: 'clinical', display: 'Clinical' },
  critical: { code: 'safety', display: 'Safety' },
};

/**
 * FHIR Resource Mapper Service
 */
export class FHIRMapper {
  private tenantId: string;
  private baseUrl: string;

  constructor(tenantId: string, baseUrl: string = 'urn:uuid:') {
    this.tenantId = tenantId;
    this.baseUrl = baseUrl;
  }

  /**
   * Map a field visit to a FHIR Encounter resource
   */
  mapVisitToEncounter(visit: OfflineFieldVisit): ServiceResult<FHIREncounter> {
    try {
      const encounterClass = VISIT_TYPE_TO_ENCOUNTER_CLASS[visit.visitType] || {
        code: 'HH',
        display: 'home health',
      };

      const encounter: FHIREncounter = {
        resourceType: 'Encounter',
        id: visit.fhirEncounterId || visit.id,
        meta: {
          versionId: String(visit.localVersion),
          lastUpdated: new Date(visit.updatedAt).toISOString(),
          profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter'],
        },
        status: VISIT_STATUS_TO_ENCOUNTER_STATUS[visit.status] || 'completed',
        class: {
          system: FHIR_SYSTEMS.ENCOUNTER_CLASS,
          code: encounterClass.code,
          display: encounterClass.display,
        },
        subject: {
          reference: `Patient/${visit.patient.fhirPatientId || visit.patient.patientId}`,
        },
        participant: [
          {
            type: [
              {
                coding: [
                  {
                    system: FHIR_SYSTEMS.PARTICIPANT_TYPE,
                    code: 'PPRF',
                    display: 'primary performer',
                  },
                ],
              },
            ],
            individual: {
              reference: `Practitioner/${visit.specialistId}`,
            },
          },
        ],
        serviceType: {
          coding: [
            {
              system: FHIR_SYSTEMS.SNOMED,
              code: this.getServiceTypeCode(visit.visitType),
              display: this.getServiceTypeDisplay(visit.visitType),
            },
          ],
        },
      };

      // Add period if timing data available
      if (visit.startTime || visit.endTime) {
        encounter.period = {};
        if (visit.startTime) {
          encounter.period.start = new Date(visit.startTime).toISOString();
        }
        if (visit.endTime) {
          encounter.period.end = new Date(visit.endTime).toISOString();
        }
      }

      // Add location if check-in data available
      if (visit.checkInLocation) {
        encounter.location = [
          {
            location: {
              display: visit.checkInLocation.address || 'Patient Home',
            },
            physicalType: {
              coding: [
                {
                  system: FHIR_SYSTEMS.SNOMED,
                  code: '264362003',
                  display: 'Home',
                },
              ],
            },
          },
        ];
      }

      return success(encounter);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return failure('OPERATION_FAILED', `Failed to map visit to Encounter: ${errorMessage}`, err);
    }
  }

  /**
   * Map an assessment to a FHIR DiagnosticReport resource
   */
  mapAssessmentToDiagnosticReport(
    assessment: OfflineAssessment,
    visitId?: string
  ): ServiceResult<FHIRDiagnosticReport> {
    try {
      const report: FHIRDiagnosticReport = {
        resourceType: 'DiagnosticReport',
        id: assessment.fhirDiagnosticReportId || assessment.id,
        meta: {
          versionId: String(assessment.localVersion),
          lastUpdated: new Date(assessment.updatedAt).toISOString(),
        },
        status: 'final',
        category: [
          {
            coding: [
              {
                system: FHIR_SYSTEMS.DIAGNOSTIC_SERVICE,
                code: this.getAssessmentCategory(assessment.assessmentType),
                display: this.getAssessmentCategoryDisplay(assessment.assessmentType),
              },
            ],
          },
        ],
        code: {
          coding: this.getAssessmentCoding(assessment),
          text: assessment.assessmentType,
        },
        subject: {
          reference: `Patient/${assessment.patient.fhirPatientId || assessment.patient.patientId}`,
        },
        effectiveDateTime: new Date(assessment.createdAt).toISOString(),
        issued: new Date(assessment.updatedAt).toISOString(),
      };

      // Link to encounter if visit ID provided
      if (visitId) {
        report.encounter = {
          reference: `Encounter/${visitId}`,
        };
      }

      // Add conclusion codes if ICD-10 or SNOMED codes available
      if (assessment.icd10Codes?.length || assessment.snomedCodes?.length) {
        report.conclusionCode = [];

        if (assessment.icd10Codes) {
          for (const code of assessment.icd10Codes) {
            report.conclusionCode.push({
              coding: [
                {
                  system: FHIR_SYSTEMS.ICD10,
                  code,
                  display: code, // Would need lookup for display
                },
              ],
            });
          }
        }

        if (assessment.snomedCodes) {
          for (const code of assessment.snomedCodes) {
            report.conclusionCode.push({
              coding: [
                {
                  system: FHIR_SYSTEMS.SNOMED,
                  code,
                  display: code, // Would need lookup for display
                },
              ],
            });
          }
        }
      }

      return success(report);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return failure(
        'OPERATION_FAILED',
        `Failed to map assessment to DiagnosticReport: ${errorMessage}`,
        err
      );
    }
  }

  /**
   * Map a photo to a FHIR Media resource
   */
  mapPhotoToMedia(photo: OfflinePhoto, visitId?: string): ServiceResult<FHIRMedia> {
    try {
      const media: FHIRMedia = {
        resourceType: 'Media',
        id: photo.fhirMediaId || photo.id,
        meta: {
          versionId: String(photo.localVersion),
          lastUpdated: new Date(photo.updatedAt).toISOString(),
        },
        status: photo.storageUrl ? 'completed' : 'preparation',
        type: {
          coding: [
            {
              system: FHIR_SYSTEMS.MEDIA_TYPE,
              code: 'image',
              display: 'Image',
            },
          ],
        },
        subject: {
          reference: `Patient/${photo.patient.fhirPatientId || photo.patient.patientId}`,
        },
        createdDateTime: new Date(photo.createdAt).toISOString(),
        content: {
          contentType: photo.mimeType,
          size: photo.sizeBytes,
          title: photo.description || 'Clinical Photo',
        },
      };

      // Add storage URL if available
      if (photo.storageUrl) {
        media.content.url = photo.storageUrl;
      }

      // Link to encounter if visit ID provided
      if (visitId) {
        media.encounter = {
          reference: `Encounter/${visitId}`,
        };
      }

      // Add body site if available
      if (photo.bodySite) {
        media.bodySite = {
          text: photo.bodySite,
        };

        if (photo.bodySiteSnomedCode) {
          media.bodySite.coding = [
            {
              system: FHIR_SYSTEMS.SNOMED,
              code: photo.bodySiteSnomedCode,
              display: photo.bodySite,
            },
          ];
        }
      }

      // Add description as note
      if (photo.description) {
        media.note = [
          {
            text: photo.description,
          },
        ];
      }

      return success(media);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return failure('OPERATION_FAILED', `Failed to map photo to Media: ${errorMessage}`, err);
    }
  }

  /**
   * Map an alert to a FHIR Flag resource
   */
  mapAlertToFlag(alert: OfflineAlert, visitId?: string): ServiceResult<FHIRFlag> {
    try {
      const category = SEVERITY_TO_FLAG_CATEGORY[alert.severity] || {
        code: 'clinical',
        display: 'Clinical',
      };

      const flag: FHIRFlag = {
        resourceType: 'Flag',
        id: alert.fhirFlagId || alert.id,
        meta: {
          versionId: String(alert.localVersion),
          lastUpdated: new Date(alert.updatedAt).toISOString(),
        },
        status: alert.acknowledged ? 'inactive' : 'active',
        category: [
          {
            coding: [
              {
                system: FHIR_SYSTEMS.FLAG_CATEGORY,
                code: category.code,
                display: category.display,
              },
            ],
          },
        ],
        code: {
          text: alert.message,
        },
        subject: {
          reference: `Patient/${alert.patient.fhirPatientId || alert.patient.patientId}`,
        },
        period: {
          start: new Date(alert.createdAt).toISOString(),
        },
      };

      // Add end date if acknowledged
      if (alert.acknowledged && alert.acknowledgedAt) {
        flag.period = {
          ...flag.period,
          start: flag.period?.start || new Date(alert.createdAt).toISOString(),
          end: new Date(alert.acknowledgedAt).toISOString(),
        };
      }

      // Link to encounter if visit ID provided
      if (visitId) {
        flag.encounter = {
          reference: `Encounter/${visitId}`,
        };
      }

      return success(flag);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return failure('OPERATION_FAILED', `Failed to map alert to Flag: ${errorMessage}`, err);
    }
  }

  /**
   * Create a FHIR transaction bundle from a visit and its related records
   */
  createTransactionBundle(
    visit: OfflineFieldVisit,
    assessments: OfflineAssessment[],
    photos: OfflinePhoto[],
    alerts: OfflineAlert[]
  ): ServiceResult<FHIRBundle> {
    try {
      const entries: FHIRBundleEntry[] = [];

      // Add encounter
      const encounterResult = this.mapVisitToEncounter(visit);
      if (!encounterResult.success || !encounterResult.data) {
        return failure('OPERATION_FAILED', 'Failed to map visit');
      }

      entries.push({
        fullUrl: `${this.baseUrl}${visit.id}`,
        resource: encounterResult.data,
        request: {
          method: 'PUT',
          url: `Encounter/${visit.id}`,
        },
      });

      // Add diagnostic reports
      for (const assessment of assessments) {
        const reportResult = this.mapAssessmentToDiagnosticReport(assessment, visit.id);
        if (reportResult.success && reportResult.data) {
          entries.push({
            fullUrl: `${this.baseUrl}${assessment.id}`,
            resource: reportResult.data,
            request: {
              method: 'PUT',
              url: `DiagnosticReport/${assessment.id}`,
            },
          });
        }
      }

      // Add media
      for (const photo of photos) {
        const mediaResult = this.mapPhotoToMedia(photo, visit.id);
        if (mediaResult.success && mediaResult.data) {
          entries.push({
            fullUrl: `${this.baseUrl}${photo.id}`,
            resource: mediaResult.data,
            request: {
              method: 'PUT',
              url: `Media/${photo.id}`,
            },
          });
        }
      }

      // Add flags
      for (const alert of alerts) {
        const flagResult = this.mapAlertToFlag(alert, visit.id);
        if (flagResult.success && flagResult.data) {
          entries.push({
            fullUrl: `${this.baseUrl}${alert.id}`,
            resource: flagResult.data,
            request: {
              method: 'PUT',
              url: `Flag/${alert.id}`,
            },
          });
        }
      }

      const bundle: FHIRBundle = {
        resourceType: 'Bundle',
        type: 'transaction',
        entry: entries,
      };

      return success(bundle);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return failure('OPERATION_FAILED', `Failed to create FHIR bundle: ${errorMessage}`, err);
    }
  }

  // Private helper methods

  /**
   * Get SNOMED service type code for visit type
   */
  private getServiceTypeCode(visitType: string): string {
    const codes: Record<string, string> = {
      routine: '225362009', // Home visit
      follow_up: '185389009', // Follow-up visit
      emergency: '50849002', // Emergency care
      initial: '185387006', // Initial visit
      discharge: '306237005', // Discharge assessment
    };
    return codes[visitType] || '225362009';
  }

  /**
   * Get display name for service type
   */
  private getServiceTypeDisplay(visitType: string): string {
    const displays: Record<string, string> = {
      routine: 'Home visit',
      follow_up: 'Follow-up visit',
      emergency: 'Emergency care',
      initial: 'Initial visit',
      discharge: 'Discharge assessment',
    };
    return displays[visitType] || 'Home visit';
  }

  /**
   * Get diagnostic service category code for assessment type
   */
  private getAssessmentCategory(assessmentType: string): string {
    const type = assessmentType.toLowerCase();
    if (type.includes('vital') || type.includes('bp') || type.includes('heart')) {
      return 'VR'; // Virology
    }
    if (type.includes('mental') || type.includes('cognitive') || type.includes('phq')) {
      return 'NRS'; // Neurological
    }
    if (type.includes('wound') || type.includes('skin')) {
      return 'SP'; // Surgical pathology
    }
    return 'OTH'; // Other
  }

  /**
   * Get display name for assessment category
   */
  private getAssessmentCategoryDisplay(assessmentType: string): string {
    const type = assessmentType.toLowerCase();
    if (type.includes('vital') || type.includes('bp') || type.includes('heart')) {
      return 'Vital Signs';
    }
    if (type.includes('mental') || type.includes('cognitive') || type.includes('phq')) {
      return 'Neurological';
    }
    if (type.includes('wound') || type.includes('skin')) {
      return 'Surgical pathology';
    }
    return 'Other';
  }

  /**
   * Get LOINC/SNOMED coding for assessment type
   */
  private getAssessmentCoding(
    assessment: OfflineAssessment
  ): Array<{ system: string; code: string; display: string }> {
    const type = assessment.assessmentType.toLowerCase();
    const coding: Array<{ system: string; code: string; display: string }> = [];

    // Common assessment type mappings
    if (type.includes('vital')) {
      coding.push({
        system: FHIR_SYSTEMS.LOINC,
        code: '29274-8',
        display: 'Vital signs measurements',
      });
    } else if (type.includes('phq') || type.includes('depression')) {
      coding.push({
        system: FHIR_SYSTEMS.LOINC,
        code: '44249-1',
        display: 'PHQ-9 Depression Screener',
      });
    } else if (type.includes('fall') || type.includes('risk')) {
      coding.push({
        system: FHIR_SYSTEMS.LOINC,
        code: '73830-2',
        display: 'Fall risk assessment',
      });
    } else if (type.includes('wound')) {
      coding.push({
        system: FHIR_SYSTEMS.LOINC,
        code: '72300-7',
        display: 'Wound assessment panel',
      });
    } else if (type.includes('adl') || type.includes('activities')) {
      coding.push({
        system: FHIR_SYSTEMS.LOINC,
        code: '46595-5',
        display: 'ADL assessment',
      });
    } else {
      // Generic assessment
      coding.push({
        system: FHIR_SYSTEMS.SNOMED,
        code: '710839001',
        display: 'Assessment',
      });
    }

    return coding;
  }
}

/**
 * Create a FHIR mapper instance
 */
export function createFHIRMapper(tenantId: string, baseUrl?: string): FHIRMapper {
  return new FHIRMapper(tenantId, baseUrl);
}
