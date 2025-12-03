/**
 * HL7 v2.x to FHIR R4 Translator
 *
 * Converts parsed HL7 v2.x messages into FHIR R4 resources.
 * This bridges legacy hospital systems (which still use HL7 v2.x)
 * with modern FHIR-based infrastructure.
 *
 * Supported translations:
 * - ADT messages → Patient, Encounter, Location resources
 * - ORU messages → DiagnosticReport, Observation resources
 * - ORM messages → ServiceRequest resources
 * - AL1 segments → AllergyIntolerance resources
 * - DG1 segments → Condition resources
 * - IN1 segments → Coverage resources
 */

import {
  HL7Message,
  HL7MessageBase,
  ADTMessage,
  ORUMessage,
  ORMMessage,
  PIDSegment,
  PV1Segment,
  PV2Segment,
  OBRSegment,
  OBXSegment,
  ORCSegment,
  DG1Segment,
  AL1Segment,
  IN1Segment,
  CodedElement,
  ExtendedPerson,
  Address as HL7Address,
  ExtendedTelecom,
  HumanName as HL7HumanName,
  PatientLocation,
} from '../../types/hl7v2';
import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';

// ============================================================================
// FHIR R4 RESOURCE TYPES (simplified for translation)
// ============================================================================

interface FHIRResource {
  resourceType: string;
  id?: string;
  meta?: {
    source?: string;
    lastUpdated?: string;
    profile?: string[];
  };
  identifier?: FHIRIdentifier[];
}

interface FHIRIdentifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: FHIRCodeableConcept;
  system?: string;
  value: string;
  period?: { start?: string; end?: string };
  assigner?: { display?: string };
}

interface FHIRCodeableConcept {
  coding?: FHIRCoding[];
  text?: string;
}

interface FHIRCoding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}

interface FHIRHumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  period?: { start?: string; end?: string };
}

interface FHIRAddress {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  type?: 'postal' | 'physical' | 'both';
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  period?: { start?: string; end?: string };
}

interface FHIRContactPoint {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  rank?: number;
  period?: { start?: string; end?: string };
}

interface FHIRReference {
  reference?: string;
  type?: string;
  identifier?: FHIRIdentifier;
  display?: string;
}

interface FHIRPatient extends FHIRResource {
  resourceType: 'Patient';
  name?: FHIRHumanName[];
  telecom?: FHIRContactPoint[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
  address?: FHIRAddress[];
  maritalStatus?: FHIRCodeableConcept;
  multipleBirthBoolean?: boolean;
  multipleBirthInteger?: number;
  communication?: Array<{
    language: FHIRCodeableConcept;
    preferred?: boolean;
  }>;
}

interface FHIREncounter extends FHIRResource {
  resourceType: 'Encounter';
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled';
  class: FHIRCoding;
  type?: FHIRCodeableConcept[];
  priority?: FHIRCodeableConcept;
  subject?: FHIRReference;
  participant?: Array<{
    type?: FHIRCodeableConcept[];
    period?: { start?: string; end?: string };
    individual?: FHIRReference;
  }>;
  period?: { start?: string; end?: string };
  reasonCode?: FHIRCodeableConcept[];
  diagnosis?: Array<{
    condition: FHIRReference;
    use?: FHIRCodeableConcept;
    rank?: number;
  }>;
  hospitalization?: {
    preAdmissionIdentifier?: FHIRIdentifier;
    origin?: FHIRReference;
    admitSource?: FHIRCodeableConcept;
    reAdmission?: FHIRCodeableConcept;
    destination?: FHIRReference;
    dischargeDisposition?: FHIRCodeableConcept;
  };
  location?: Array<{
    location: FHIRReference;
    status?: 'planned' | 'active' | 'reserved' | 'completed';
    period?: { start?: string; end?: string };
  }>;
  serviceProvider?: FHIRReference;
}

interface FHIRDiagnosticReport extends FHIRResource {
  resourceType: 'DiagnosticReport';
  status: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'appended' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: FHIRCodeableConcept[];
  code: FHIRCodeableConcept;
  subject?: FHIRReference;
  encounter?: FHIRReference;
  effectiveDateTime?: string;
  effectivePeriod?: { start?: string; end?: string };
  issued?: string;
  performer?: FHIRReference[];
  result?: FHIRReference[];
  conclusion?: string;
  conclusionCode?: FHIRCodeableConcept[];
}

interface FHIRObservation extends FHIRResource {
  resourceType: 'Observation';
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: FHIRCodeableConcept[];
  code: FHIRCodeableConcept;
  subject?: FHIRReference;
  encounter?: FHIRReference;
  effectiveDateTime?: string;
  issued?: string;
  performer?: FHIRReference[];
  valueQuantity?: {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  valueCodeableConcept?: FHIRCodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  dataAbsentReason?: FHIRCodeableConcept;
  interpretation?: FHIRCodeableConcept[];
  referenceRange?: Array<{
    low?: { value?: number; unit?: string };
    high?: { value?: number; unit?: string };
    text?: string;
  }>;
}

interface FHIRServiceRequest extends FHIRResource {
  resourceType: 'ServiceRequest';
  status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
  intent: 'proposal' | 'plan' | 'directive' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
  category?: FHIRCodeableConcept[];
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  code?: FHIRCodeableConcept;
  subject: FHIRReference;
  encounter?: FHIRReference;
  occurrenceDateTime?: string;
  authoredOn?: string;
  requester?: FHIRReference;
  performer?: FHIRReference[];
  reasonCode?: FHIRCodeableConcept[];
  note?: Array<{ text: string }>;
}

interface FHIRAllergyIntolerance extends FHIRResource {
  resourceType: 'AllergyIntolerance';
  clinicalStatus?: FHIRCodeableConcept;
  verificationStatus?: FHIRCodeableConcept;
  type?: 'allergy' | 'intolerance';
  category?: Array<'food' | 'medication' | 'environment' | 'biologic'>;
  criticality?: 'low' | 'high' | 'unable-to-assess';
  code?: FHIRCodeableConcept;
  patient: FHIRReference;
  onsetDateTime?: string;
  recordedDate?: string;
  reaction?: Array<{
    substance?: FHIRCodeableConcept;
    manifestation: FHIRCodeableConcept[];
    severity?: 'mild' | 'moderate' | 'severe';
  }>;
}

interface FHIRCondition extends FHIRResource {
  resourceType: 'Condition';
  clinicalStatus?: FHIRCodeableConcept;
  verificationStatus?: FHIRCodeableConcept;
  category?: FHIRCodeableConcept[];
  severity?: FHIRCodeableConcept;
  code?: FHIRCodeableConcept;
  subject: FHIRReference;
  encounter?: FHIRReference;
  onsetDateTime?: string;
  recordedDate?: string;
  recorder?: FHIRReference;
}

interface FHIRCoverage extends FHIRResource {
  resourceType: 'Coverage';
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
  type?: FHIRCodeableConcept;
  subscriber?: FHIRReference;
  subscriberId?: string;
  beneficiary: FHIRReference;
  relationship?: FHIRCodeableConcept;
  period?: { start?: string; end?: string };
  payor: FHIRReference[];
  class?: Array<{
    type: FHIRCodeableConcept;
    value: string;
    name?: string;
  }>;
}

interface FHIRBundle {
  resourceType: 'Bundle';
  type: 'collection' | 'document' | 'message' | 'transaction' | 'transaction-response' | 'batch' | 'batch-response' | 'history' | 'searchset';
  timestamp?: string;
  entry?: Array<{
    fullUrl?: string;
    resource: FHIRResource;
  }>;
}

// ============================================================================
// TRANSLATION RESULT
// ============================================================================

/**
 * Successful translation result data
 */
export interface FHIRTranslationSuccess {
  bundle: FHIRBundle;
  resources: FHIRResource[];
  warnings: string[];
  sourceMessageId: string;
  sourceMessageType: string;
}

/**
 * @deprecated Use ServiceResult<FHIRTranslationSuccess> instead
 */
export interface TranslationResult {
  success: boolean;
  bundle?: FHIRBundle;
  resources: FHIRResource[];
  errors: string[];
  warnings: string[];
  sourceMessageId?: string;
  sourceMessageType?: string;
}

// ============================================================================
// HL7 TO FHIR TRANSLATOR
// ============================================================================

export class HL7ToFHIRTranslator {
  private tenantId: string;
  private sourceSystem: string;

  constructor(tenantId: string, sourceSystem: string = 'HL7v2') {
    this.tenantId = tenantId;
    this.sourceSystem = sourceSystem;
  }

  /**
   * Translate any HL7 message to FHIR resources
   * @returns ServiceResult with FHIR bundle and resources or error
   */
  translate(message: HL7MessageBase): ServiceResult<FHIRTranslationSuccess> {
    const resources: FHIRResource[] = [];
    const warnings: string[] = [];
    const sourceMessageId = message.header.messageControlId;
    const sourceMessageType = `${message.header.messageType.messageCode}^${message.header.messageType.triggerEvent}`;

    try {
      const messageType = message.header.messageType.messageCode;

      switch (messageType) {
        case 'ADT':
          this.translateADTResources(message as ADTMessage, resources, warnings);
          break;
        case 'ORU':
          this.translateORUResources(message as ORUMessage, resources, warnings);
          break;
        case 'ORM':
          this.translateORMResources(message as ORMMessage, resources, warnings);
          break;
        default:
          // Try to extract what we can from generic message
          this.translateGenericResources(message, resources, warnings);
      }

      // Check if we got any resources
      if (resources.length === 0) {
        return failure(
          'VALIDATION_ERROR',
          'No resources could be translated from the HL7 message',
          undefined,
          { sourceMessageId, sourceMessageType, warnings }
        );
      }

      // Build bundle
      const bundle: FHIRBundle = {
        resourceType: 'Bundle',
        type: 'collection',
        timestamp: new Date().toISOString(),
        entry: resources.map((resource, index) => ({
          fullUrl: `urn:uuid:${this.generateUUID(index)}`,
          resource,
        })),
      };

      // Log successful translation
      auditLogger.clinical('HL7_TO_FHIR_TRANSLATION', true, {
        messageType,
        messageControlId: message.header.messageControlId,
        resourceCount: resources.length,
        warningCount: warnings.length,
      });

      return success({
        bundle,
        resources,
        warnings,
        sourceMessageId,
        sourceMessageType,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown translation error';

      auditLogger.security('HL7_TRANSLATION_ERROR', 'medium', {
        error: errorMessage,
      });

      return failure(
        'OPERATION_FAILED',
        `Translation error: ${errorMessage}`,
        error,
        { sourceMessageId, sourceMessageType, warnings }
      );
    }
  }

  /**
   * @deprecated Use translate() which returns ServiceResult<FHIRTranslationSuccess>
   */
  translateLegacy(message: HL7Message): TranslationResult {
    const result = this.translate(message);

    if (result.success) {
      return {
        success: true,
        bundle: result.data.bundle,
        resources: result.data.resources,
        errors: [],
        warnings: result.data.warnings,
        sourceMessageId: result.data.sourceMessageId,
        sourceMessageType: result.data.sourceMessageType,
      };
    } else {
      const details = result.error.details as Record<string, unknown> || {};
      return {
        success: false,
        resources: [],
        errors: [result.error.message],
        warnings: (details.warnings as string[]) || [],
        sourceMessageId: details.sourceMessageId as string,
        sourceMessageType: details.sourceMessageType as string,
      };
    }
  }

  // ============================================================================
  // ADT MESSAGE TRANSLATION
  // ============================================================================

  private translateADTResources(
    message: ADTMessage,
    resources: FHIRResource[],
    warnings: string[]
  ): void {
    // Create Patient resource
    if (message.patientIdentification) {
      const patient = this.pidToPatient(message.patientIdentification);
      resources.push(patient);
    }

    // Create Encounter resource
    if (message.patientVisit) {
      const encounter = this.pv1ToEncounter(
        message.patientVisit,
        message.patientVisitAdditional,
        message.header.messageType.triggerEvent
      );
      resources.push(encounter);
    }

    // Create AllergyIntolerance resources
    if (message.allergies) {
      for (const allergy of message.allergies) {
        const allergyResource = this.al1ToAllergyIntolerance(allergy);
        resources.push(allergyResource);
      }
    }

    // Create Condition resources from diagnoses
    if (message.diagnoses) {
      for (const diagnosis of message.diagnoses) {
        const condition = this.dg1ToCondition(diagnosis);
        resources.push(condition);
      }
    }

    // Create Coverage resources from insurance
    if (message.insurance) {
      for (const insurance of message.insurance) {
        const coverage = this.in1ToCoverage(insurance);
        resources.push(coverage);
      }
    }
  }

  // ============================================================================
  // ORU MESSAGE TRANSLATION (Lab Results)
  // ============================================================================

  private translateORUResources(
    message: ORUMessage,
    resources: FHIRResource[],
    warnings: string[]
  ): void {
    // Create Patient resource
    if (message.patientIdentification) {
      const patient = this.pidToPatient(message.patientIdentification);
      resources.push(patient);
    }

    // Create DiagnosticReport and Observation resources
    for (const obsResult of message.observationResults) {
      const diagnosticReport = this.obrToDiagnosticReport(obsResult.request);
      const observations: FHIRObservation[] = [];

      for (const obx of obsResult.observations) {
        const observation = this.obxToObservation(obx);
        observations.push(observation);
        resources.push(observation);
      }

      // Link observations to diagnostic report
      diagnosticReport.result = observations.map((obs, index) => ({
        reference: `urn:uuid:observation-${index}`,
        display: obs.code?.text,
      }));

      resources.push(diagnosticReport);
    }
  }

  // ============================================================================
  // ORM MESSAGE TRANSLATION (Orders)
  // ============================================================================

  private translateORMResources(
    message: ORMMessage,
    resources: FHIRResource[],
    warnings: string[]
  ): void {
    // Create Patient resource if available
    if (message.patientIdentification) {
      const patient = this.pidToPatient(message.patientIdentification);
      resources.push(patient);
    }

    // Create ServiceRequest resources
    for (const order of message.orders) {
      const serviceRequest = this.orcToServiceRequest(order.commonOrder, order.orderDetail);
      resources.push(serviceRequest);
    }
  }

  // ============================================================================
  // GENERIC MESSAGE TRANSLATION
  // ============================================================================

  private translateGenericResources(
    message: HL7Message,
    resources: FHIRResource[],
    warnings: string[]
  ): void {
    warnings.push(
      `Unsupported message type: ${message.header.messageType.messageCode}. Extracting available segments.`
    );

    // Extract what we can
    if (message.patientIdentification) {
      resources.push(this.pidToPatient(message.patientIdentification));
    }

    if (message.patientVisit) {
      resources.push(this.pv1ToEncounter(message.patientVisit, message.patientVisitAdditional));
    }

    if (message.allergies) {
      for (const allergy of message.allergies) {
        resources.push(this.al1ToAllergyIntolerance(allergy));
      }
    }

    if (message.diagnoses) {
      for (const diagnosis of message.diagnoses) {
        resources.push(this.dg1ToCondition(diagnosis));
      }
    }
  }

  // ============================================================================
  // SEGMENT TO RESOURCE TRANSLATORS
  // ============================================================================

  private pidToPatient(pid: PIDSegment): FHIRPatient {
    const patient: FHIRPatient = {
      resourceType: 'Patient',
      id: this.generateResourceId('Patient'),
      meta: {
        source: this.sourceSystem,
        lastUpdated: new Date().toISOString(),
        profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'],
      },
      identifier: this.translatePatientIdentifiers(pid),
      name: this.translateHumanNames(pid.patientName),
      telecom: this.translateTelecoms(pid.homePhone, pid.businessPhone),
      gender: this.translateGender(pid.administrativeSex),
      birthDate: this.translateDate(pid.dateOfBirth),
      address: this.translateAddresses(pid.patientAddress),
    };

    // Deceased status
    if (pid.patientDeathIndicator === 'Y') {
      if (pid.patientDeathDateTime) {
        patient.deceasedDateTime = this.translateDateTime(pid.patientDeathDateTime);
      } else {
        patient.deceasedBoolean = true;
      }
    }

    // Marital status
    if (pid.maritalStatus) {
      patient.maritalStatus = this.translateCodedElement(pid.maritalStatus);
    }

    // Multiple birth
    if (pid.multipleBirthIndicator === 'Y') {
      if (pid.birthOrder) {
        patient.multipleBirthInteger = pid.birthOrder;
      } else {
        patient.multipleBirthBoolean = true;
      }
    }

    // Language
    if (pid.primaryLanguage) {
      patient.communication = [
        {
          language: this.translateCodedElement(pid.primaryLanguage),
          preferred: true,
        },
      ];
    }

    return patient;
  }

  private pv1ToEncounter(
    pv1: PV1Segment,
    pv2?: PV2Segment,
    eventType?: string
  ): FHIREncounter {
    const encounter: FHIREncounter = {
      resourceType: 'Encounter',
      id: this.generateResourceId('Encounter'),
      meta: {
        source: this.sourceSystem,
        lastUpdated: new Date().toISOString(),
        profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter'],
      },
      status: this.translateEncounterStatus(eventType, pv1),
      class: this.translatePatientClass(pv1.patientClass),
    };

    // Visit number as identifier
    if (pv1.visitNumber) {
      encounter.identifier = [
        {
          use: 'usual',
          system: `urn:oid:${this.tenantId}:visit`,
          value: pv1.visitNumber,
        },
      ];
    }

    // Period (admit/discharge times)
    if (pv1.admitDateTime || pv1.dischargeDateTime) {
      encounter.period = {
        start: pv1.admitDateTime ? this.translateDateTime(pv1.admitDateTime) : undefined,
        end: pv1.dischargeDateTime ? this.translateDateTime(pv1.dischargeDateTime) : undefined,
      };
    }

    // Participants (attending, admitting, consulting doctors)
    encounter.participant = [];
    if (pv1.attendingDoctor) {
      encounter.participant.push(
        ...pv1.attendingDoctor.map((doc) => ({
          type: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                  code: 'ATND',
                  display: 'attender',
                },
              ],
            },
          ],
          individual: this.translateExtendedPersonToReference(doc),
        }))
      );
    }

    // Location
    if (pv1.assignedPatientLocation) {
      encounter.location = [
        {
          location: this.translateLocationToReference(pv1.assignedPatientLocation),
          status: 'active',
        },
      ];
    }

    // Hospitalization details
    if (pv1.admitSource || pv1.dischargeDisposition || pv1.preadmitNumber) {
      encounter.hospitalization = {};
      if (pv1.preadmitNumber) {
        encounter.hospitalization.preAdmissionIdentifier = {
          value: pv1.preadmitNumber,
        };
      }
      if (pv1.admitSource) {
        encounter.hospitalization.admitSource = {
          coding: [{ code: pv1.admitSource }],
        };
      }
      if (pv1.dischargeDisposition) {
        encounter.hospitalization.dischargeDisposition = {
          coding: [{ code: pv1.dischargeDisposition }],
        };
      }
      if (pv1.readmissionIndicator) {
        encounter.hospitalization.reAdmission = {
          coding: [{ code: pv1.readmissionIndicator }],
        };
      }
    }

    // Reason for visit (from PV2)
    if (pv2?.admitReason) {
      encounter.reasonCode = [this.translateCodedElement(pv2.admitReason)];
    }

    return encounter;
  }

  private obrToDiagnosticReport(obr: OBRSegment): FHIRDiagnosticReport {
    const report: FHIRDiagnosticReport = {
      resourceType: 'DiagnosticReport',
      id: this.generateResourceId('DiagnosticReport'),
      meta: {
        source: this.sourceSystem,
        lastUpdated: new Date().toISOString(),
        profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-diagnosticreport-lab'],
      },
      status: this.translateResultStatus(obr.resultStatus),
      code: this.translateCodedElement(obr.universalServiceIdentifier),
    };

    // Identifiers
    report.identifier = [];
    if (obr.placerOrderNumber) {
      report.identifier.push({
        use: 'official',
        type: { text: 'Placer Order Number' },
        value: obr.placerOrderNumber,
      });
    }
    if (obr.fillerOrderNumber) {
      report.identifier.push({
        use: 'usual',
        type: { text: 'Filler Order Number' },
        value: obr.fillerOrderNumber,
      });
    }

    // Category
    if (obr.diagnosticServiceSectionId) {
      report.category = [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
              code: obr.diagnosticServiceSectionId,
            },
          ],
        },
      ];
    }

    // Effective time
    if (obr.observationDateTime) {
      report.effectiveDateTime = this.translateDateTime(obr.observationDateTime);
    } else if (obr.observationDateTime && obr.observationEndDateTime) {
      report.effectivePeriod = {
        start: this.translateDateTime(obr.observationDateTime),
        end: this.translateDateTime(obr.observationEndDateTime),
      };
    }

    // Issued time
    if (obr.resultsReportStatusChangeDateTime) {
      report.issued = this.translateDateTime(obr.resultsReportStatusChangeDateTime);
    }

    // Performers
    if (obr.principalResultInterpreter) {
      report.performer = [this.translateExtendedPersonToReference(obr.principalResultInterpreter)];
    }

    // Clinical info as conclusion
    if (obr.relevantClinicalInfo) {
      report.conclusion = obr.relevantClinicalInfo;
    }

    return report;
  }

  private obxToObservation(obx: OBXSegment): FHIRObservation {
    const observation: FHIRObservation = {
      resourceType: 'Observation',
      id: this.generateResourceId('Observation'),
      meta: {
        source: this.sourceSystem,
        lastUpdated: new Date().toISOString(),
        profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab'],
      },
      status: this.translateObservationStatus(obx.observationResultStatus),
      code: this.translateCodedElement(obx.observationIdentifier),
    };

    // Category (lab by default)
    observation.category = [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'laboratory',
            display: 'Laboratory',
          },
        ],
      },
    ];

    // Effective time
    if (obx.dateTimeOfObservation) {
      observation.effectiveDateTime = this.translateDateTime(obx.dateTimeOfObservation);
    }

    // Issued time
    if (obx.dateTimeOfAnalysis) {
      observation.issued = this.translateDateTime(obx.dateTimeOfAnalysis);
    }

    // Value based on type
    if (obx.observationValue && obx.observationValue.length > 0) {
      const value = obx.observationValue[0];

      switch (obx.valueType) {
        case 'NM': // Numeric
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            observation.valueQuantity = {
              value: numValue,
              unit: obx.units?.text || obx.units?.identifier,
              system: 'http://unitsofmeasure.org',
              code: obx.units?.identifier,
            };
          }
          break;
        case 'ST': // String
        case 'TX': // Text
        case 'FT': // Formatted text
          observation.valueString = value;
          break;
        case 'CE': // Coded entry
        case 'CWE': // Coded with exceptions
          observation.valueCodeableConcept = this.translateCodedElement({
            identifier: value.split('^')[0],
            text: value.split('^')[1],
            nameOfCodingSystem: value.split('^')[2],
          });
          break;
        case 'SN': // Structured numeric
          // Parse structured numeric (e.g., ">^100")
          const snParts = value.split('^');
          if (snParts.length >= 2) {
            const snValue = parseFloat(snParts[1]);
            if (!isNaN(snValue)) {
              observation.valueQuantity = {
                value: snValue,
                unit: obx.units?.text,
              };
            }
          }
          break;
        default:
          observation.valueString = value;
      }
    }

    // Reference range
    if (obx.referenceRange) {
      observation.referenceRange = [{ text: obx.referenceRange }];
    }

    // Interpretation (abnormal flags)
    if (obx.abnormalFlags && obx.abnormalFlags.length > 0) {
      observation.interpretation = obx.abnormalFlags.map((flag) => ({
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
            code: this.translateAbnormalFlag(flag),
          },
        ],
      }));
    }

    // Performer
    if (obx.responsibleObserver && obx.responsibleObserver.length > 0) {
      observation.performer = obx.responsibleObserver.map((obs) =>
        this.translateExtendedPersonToReference(obs)
      );
    }

    return observation;
  }

  private orcToServiceRequest(orc: ORCSegment, obr?: OBRSegment): FHIRServiceRequest {
    const serviceRequest: FHIRServiceRequest = {
      resourceType: 'ServiceRequest',
      id: this.generateResourceId('ServiceRequest'),
      meta: {
        source: this.sourceSystem,
        lastUpdated: new Date().toISOString(),
      },
      status: this.translateOrderStatus(orc.orderStatus),
      intent: this.translateOrderIntent(orc.orderControl),
      subject: { reference: 'Patient/unknown' }, // Will be linked later
    };

    // Identifiers
    serviceRequest.identifier = [];
    if (orc.placerOrderNumber) {
      serviceRequest.identifier.push({
        use: 'official',
        type: { text: 'Placer Order Number' },
        value: orc.placerOrderNumber,
      });
    }
    if (orc.fillerOrderNumber) {
      serviceRequest.identifier.push({
        use: 'usual',
        type: { text: 'Filler Order Number' },
        value: orc.fillerOrderNumber,
      });
    }

    // Code from OBR if available
    if (obr?.universalServiceIdentifier) {
      serviceRequest.code = this.translateCodedElement(obr.universalServiceIdentifier);
    }

    // Priority
    if (obr?.priority) {
      serviceRequest.priority = this.translatePriority(obr.priority);
    }

    // Authored on
    if (orc.dateTimeOfTransaction) {
      serviceRequest.authoredOn = this.translateDateTime(orc.dateTimeOfTransaction);
    }

    // Requester (ordering provider)
    if (orc.orderingProvider && orc.orderingProvider.length > 0) {
      serviceRequest.requester = this.translateExtendedPersonToReference(orc.orderingProvider[0]);
    }

    // Reason
    if (obr?.reasonForStudy) {
      serviceRequest.reasonCode = obr.reasonForStudy.map((r) => this.translateCodedElement(r));
    }

    // Clinical info as note
    if (obr?.relevantClinicalInfo) {
      serviceRequest.note = [{ text: obr.relevantClinicalInfo }];
    }

    return serviceRequest;
  }

  private al1ToAllergyIntolerance(al1: AL1Segment): FHIRAllergyIntolerance {
    const allergy: FHIRAllergyIntolerance = {
      resourceType: 'AllergyIntolerance',
      id: this.generateResourceId('AllergyIntolerance'),
      meta: {
        source: this.sourceSystem,
        lastUpdated: new Date().toISOString(),
        profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance'],
      },
      patient: { reference: 'Patient/unknown' }, // Will be linked later
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
            code: 'active',
          },
        ],
      },
      verificationStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
            code: 'confirmed',
          },
        ],
      },
    };

    // Allergen code
    allergy.code = this.translateCodedElement(al1.allergenCode);

    // Category based on allergen type
    if (al1.allergenTypeCode?.identifier) {
      allergy.category = [this.translateAllergenCategory(al1.allergenTypeCode.identifier)];
    }

    // Criticality from severity
    if (al1.allergySeverityCode) {
      allergy.criticality = this.translateAllergySeverity(al1.allergySeverityCode);
    }

    // Onset date
    if (al1.identificationDate) {
      allergy.onsetDateTime = this.translateDate(al1.identificationDate);
    }

    // Reactions
    if (al1.allergyReaction && al1.allergyReaction.length > 0) {
      allergy.reaction = [
        {
          manifestation: al1.allergyReaction.map((r) => ({
            text: r,
          })),
        },
      ];
    }

    return allergy;
  }

  private dg1ToCondition(dg1: DG1Segment): FHIRCondition {
    const condition: FHIRCondition = {
      resourceType: 'Condition',
      id: this.generateResourceId('Condition'),
      meta: {
        source: this.sourceSystem,
        lastUpdated: new Date().toISOString(),
        profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition'],
      },
      subject: { reference: 'Patient/unknown' }, // Will be linked later
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: 'active',
          },
        ],
      },
      verificationStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
            code: 'confirmed',
          },
        ],
      },
    };

    // Diagnosis code
    if (dg1.diagnosisCode) {
      condition.code = this.translateCodedElement(dg1.diagnosisCode);
    } else if (dg1.diagnosisDescription) {
      condition.code = { text: dg1.diagnosisDescription };
    }

    // Category based on diagnosis type
    condition.category = [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-category',
            code: this.translateDiagnosisType(dg1.diagnosisType),
          },
        ],
      },
    ];

    // Onset date
    if (dg1.diagnosisDateTime) {
      condition.onsetDateTime = this.translateDateTime(dg1.diagnosisDateTime);
    }

    // Recorded date
    if (dg1.attestationDateTime) {
      condition.recordedDate = this.translateDateTime(dg1.attestationDateTime);
    }

    // Recorder
    if (dg1.diagnosingClinician && dg1.diagnosingClinician.length > 0) {
      condition.recorder = this.translateExtendedPersonToReference(dg1.diagnosingClinician[0]);
    }

    return condition;
  }

  private in1ToCoverage(in1: IN1Segment): FHIRCoverage {
    const coverage: FHIRCoverage = {
      resourceType: 'Coverage',
      id: this.generateResourceId('Coverage'),
      meta: {
        source: this.sourceSystem,
        lastUpdated: new Date().toISOString(),
      },
      status: 'active',
      beneficiary: { reference: 'Patient/unknown' }, // Will be linked later
      payor: [],
    };

    // Identifier (policy number)
    if (in1.policyNumber) {
      coverage.identifier = [
        {
          use: 'official',
          value: in1.policyNumber,
        },
      ];
    }

    // Plan type
    if (in1.planType || in1.insurancePlanId) {
      coverage.type = this.translateCodedElement(in1.insurancePlanId) || { text: in1.planType };
    }

    // Subscriber ID
    if (in1.insuredIdNumber && in1.insuredIdNumber.length > 0) {
      coverage.subscriberId = in1.insuredIdNumber[0];
    }

    // Period
    if (in1.planEffectiveDate || in1.planExpirationDate) {
      coverage.period = {
        start: in1.planEffectiveDate ? this.translateDate(in1.planEffectiveDate) : undefined,
        end: in1.planExpirationDate ? this.translateDate(in1.planExpirationDate) : undefined,
      };
    }

    // Payor (insurance company)
    if (in1.insuranceCompanyName && in1.insuranceCompanyName.length > 0) {
      coverage.payor = [
        {
          display: in1.insuranceCompanyName[0].organizationName,
        },
      ];
    }

    // Class (group info)
    if (in1.groupNumber || in1.groupName) {
      coverage.class = [
        {
          type: {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/coverage-class', code: 'group' }],
          },
          value: in1.groupNumber || '',
          name: in1.groupName?.[0]?.organizationName,
        },
      ];
    }

    // Relationship
    if (in1.insuredRelationshipToPatient) {
      coverage.relationship = this.translateCodedElement(in1.insuredRelationshipToPatient);
    }

    return coverage;
  }

  // ============================================================================
  // HELPER TRANSLATORS
  // ============================================================================

  private translatePatientIdentifiers(pid: PIDSegment): FHIRIdentifier[] {
    const identifiers: FHIRIdentifier[] = [];

    for (const id of pid.patientIdentifierList) {
      const identifier: FHIRIdentifier = {
        value: id.id,
      };

      // Determine type and system
      switch (id.identifierTypeCode) {
        case 'MR':
          identifier.use = 'usual';
          identifier.type = {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR' }],
          };
          identifier.system = `urn:oid:${id.assigningAuthority || this.tenantId}:mr`;
          break;
        case 'SS':
          identifier.use = 'official';
          identifier.type = {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'SS' }],
          };
          identifier.system = 'http://hl7.org/fhir/sid/us-ssn';
          break;
        default:
          identifier.system = `urn:oid:${id.assigningAuthority || this.tenantId}`;
      }

      if (id.assigningFacility) {
        identifier.assigner = { display: id.assigningFacility };
      }

      identifiers.push(identifier);
    }

    return identifiers;
  }

  private translateHumanNames(names: HL7HumanName[]): FHIRHumanName[] {
    return names.map((name) => ({
      use: this.translateNameType(name.nameTypeCode),
      family: name.familyName,
      given: [name.givenName, name.middleInitialOrName].filter(Boolean) as string[],
      prefix: name.prefix ? [name.prefix] : undefined,
      suffix: [name.suffix, name.degree].filter(Boolean) as string[] || undefined,
    }));
  }

  private translateAddresses(addresses?: HL7Address[]): FHIRAddress[] | undefined {
    if (!addresses) return undefined;

    return addresses.map((addr) => ({
      use: this.translateAddressType(addr.addressType),
      line: [addr.streetAddress, addr.otherDesignation].filter(Boolean) as string[],
      city: addr.city,
      district: addr.countyParishCode,
      state: addr.stateOrProvince,
      postalCode: addr.zipOrPostalCode,
      country: addr.country,
    }));
  }

  private translateTelecoms(
    homePhones?: ExtendedTelecom[],
    businessPhones?: ExtendedTelecom[]
  ): FHIRContactPoint[] {
    const telecoms: FHIRContactPoint[] = [];

    if (homePhones) {
      for (const phone of homePhones) {
        telecoms.push({
          system: this.translateTelecomType(phone.telecommunicationEquipmentType),
          value: phone.telephoneNumber || phone.communicationAddress,
          use: 'home',
        });
      }
    }

    if (businessPhones) {
      for (const phone of businessPhones) {
        telecoms.push({
          system: this.translateTelecomType(phone.telecommunicationEquipmentType),
          value: phone.telephoneNumber || phone.communicationAddress,
          use: 'work',
        });
      }
    }

    return telecoms;
  }

  private translateGender(sex?: string): FHIRPatient['gender'] {
    switch (sex) {
      case 'M':
        return 'male';
      case 'F':
        return 'female';
      case 'O':
      case 'A':
        return 'other';
      default:
        return 'unknown';
    }
  }

  private translateCodedElement(ce?: CodedElement): FHIRCodeableConcept {
    if (!ce) return { text: 'Unknown' };

    const concept: FHIRCodeableConcept = {};

    if (ce.identifier || ce.text) {
      concept.coding = [
        {
          system: this.translateCodingSystem(ce.nameOfCodingSystem),
          code: ce.identifier,
          display: ce.text,
        },
      ];
    }

    if (ce.alternateIdentifier || ce.alternateText) {
      if (!concept.coding) concept.coding = [];
      concept.coding.push({
        system: this.translateCodingSystem(ce.nameOfAlternateCodingSystem),
        code: ce.alternateIdentifier,
        display: ce.alternateText,
      });
    }

    concept.text = ce.originalText || ce.text || ce.alternateText;

    return concept;
  }

  private translateCodingSystem(system?: string): string | undefined {
    if (!system) return undefined;

    const systemMap: Record<string, string> = {
      I9C: 'http://hl7.org/fhir/sid/icd-9-cm',
      I10: 'http://hl7.org/fhir/sid/icd-10',
      I10C: 'http://hl7.org/fhir/sid/icd-10-cm',
      LN: 'http://loinc.org',
      SCT: 'http://snomed.info/sct',
      RXNORM: 'http://www.nlm.nih.gov/research/umls/rxnorm',
      CPT: 'http://www.ama-assn.org/go/cpt',
      NDC: 'http://hl7.org/fhir/sid/ndc',
      CVX: 'http://hl7.org/fhir/sid/cvx',
    };

    return systemMap[system.toUpperCase()] || `urn:oid:${system}`;
  }

  private translateExtendedPersonToReference(person: ExtendedPerson): FHIRReference {
    const ref: FHIRReference = {};

    if (person.idNumber) {
      ref.identifier = { value: person.idNumber };
    }

    const nameParts = [person.prefix, person.givenName, person.familyName, person.suffix]
      .filter(Boolean)
      .join(' ');
    if (nameParts) {
      ref.display = nameParts;
    }

    return ref;
  }

  private translateLocationToReference(location: PatientLocation): FHIRReference {
    const parts = [location.building, location.floor, location.pointOfCare, location.room, location.bed]
      .filter(Boolean)
      .join(' - ');

    return {
      display: parts || 'Unknown Location',
    };
  }

  private translateDate(hl7Date?: string): string | undefined {
    if (!hl7Date || hl7Date.length < 8) return undefined;

    // HL7 date format: YYYYMMDD
    const year = hl7Date.substring(0, 4);
    const month = hl7Date.substring(4, 6);
    const day = hl7Date.substring(6, 8);

    return `${year}-${month}-${day}`;
  }

  private translateDateTime(hl7DateTime?: string): string | undefined {
    if (!hl7DateTime || hl7DateTime.length < 8) return undefined;

    // HL7 datetime format: YYYYMMDDHHmmss[.SSSS][+/-ZZZZ]
    const year = hl7DateTime.substring(0, 4);
    const month = hl7DateTime.substring(4, 6);
    const day = hl7DateTime.substring(6, 8);
    const hour = hl7DateTime.substring(8, 10) || '00';
    const minute = hl7DateTime.substring(10, 12) || '00';
    const second = hl7DateTime.substring(12, 14) || '00';

    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  }

  private translateEncounterStatus(eventType?: string, pv1?: PV1Segment): FHIREncounter['status'] {
    // Map ADT event to encounter status
    switch (eventType) {
      case 'A01': // Admit
      case 'A04': // Register
      case 'A02': // Transfer
        return 'in-progress';
      case 'A03': // Discharge
        return 'finished';
      case 'A11': // Cancel admit
      case 'A12': // Cancel transfer
      case 'A13': // Cancel discharge
        return 'cancelled';
      case 'A05': // Pre-admit
      case 'A14': // Pending admit
        return 'planned';
      case 'A21': // Leave of absence
        return 'onleave';
      default:
        return 'in-progress';
    }
  }

  private translatePatientClass(patientClass: string): FHIRCoding {
    const classMap: Record<string, { code: string; display: string }> = {
      E: { code: 'EMER', display: 'emergency' },
      I: { code: 'IMP', display: 'inpatient' },
      O: { code: 'AMB', display: 'ambulatory' },
      P: { code: 'PRENC', display: 'pre-admission' },
      R: { code: 'SS', display: 'short stay' },
      B: { code: 'OBSENC', display: 'observation' },
      N: { code: 'HH', display: 'home health' },
    };

    const mapped = classMap[patientClass] || { code: 'AMB', display: 'ambulatory' };

    return {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: mapped.code,
      display: mapped.display,
    };
  }

  private translateResultStatus(status?: string): FHIRDiagnosticReport['status'] {
    switch (status) {
      case 'O':
        return 'registered';
      case 'I':
      case 'S':
        return 'partial';
      case 'A':
      case 'P':
        return 'preliminary';
      case 'C':
        return 'corrected';
      case 'R':
        return 'amended';
      case 'F':
        return 'final';
      case 'X':
        return 'cancelled';
      default:
        return 'unknown';
    }
  }

  private translateObservationStatus(status: string): FHIRObservation['status'] {
    switch (status) {
      case 'C':
        return 'corrected';
      case 'D':
        return 'entered-in-error';
      case 'F':
        return 'final';
      case 'I':
        return 'registered';
      case 'P':
        return 'preliminary';
      case 'R':
        return 'amended';
      case 'S':
        return 'preliminary';
      case 'X':
        return 'cancelled';
      default:
        return 'unknown';
    }
  }

  private translateOrderStatus(status?: string): FHIRServiceRequest['status'] {
    switch (status) {
      case 'A':
        return 'active';
      case 'CA':
        return 'revoked';
      case 'CM':
        return 'completed';
      case 'DC':
        return 'revoked';
      case 'ER':
        return 'entered-in-error';
      case 'HD':
        return 'on-hold';
      case 'IP':
        return 'active';
      case 'SC':
        return 'active';
      default:
        return 'unknown';
    }
  }

  private translateOrderIntent(orderControl: string): FHIRServiceRequest['intent'] {
    switch (orderControl) {
      case 'NW':
        return 'order';
      case 'XO':
        return 'order';
      case 'CA':
        return 'order';
      case 'RF':
        return 'reflex-order';
      case 'SC':
        return 'filler-order';
      default:
        return 'order';
    }
  }

  private translatePriority(priority: string): FHIRServiceRequest['priority'] {
    switch (priority.toUpperCase()) {
      case 'S':
      case 'STAT':
        return 'stat';
      case 'A':
      case 'ASAP':
        return 'asap';
      case 'U':
      case 'URGENT':
        return 'urgent';
      default:
        return 'routine';
    }
  }

  private translateAbnormalFlag(flag: string): string {
    const flagMap: Record<string, string> = {
      L: 'L',
      H: 'H',
      LL: 'LL',
      HH: 'HH',
      '<': 'L',
      '>': 'H',
      N: 'N',
      A: 'A',
      AA: 'AA',
      U: 'U',
      D: 'D',
      B: 'B',
      W: 'W',
      S: 'S',
      R: 'R',
      I: 'I',
    };

    return flagMap[flag.toUpperCase()] || flag;
  }

  private translateAllergenCategory(type: string): 'food' | 'medication' | 'environment' | 'biologic' {
    switch (type.toUpperCase()) {
      case 'DA':
      case 'DRUG':
        return 'medication';
      case 'FA':
      case 'FOOD':
        return 'food';
      case 'EA':
      case 'ENV':
        return 'environment';
      case 'PA':
      case 'POLLEN':
        return 'environment';
      case 'LA':
      case 'LATEX':
        return 'environment';
      default:
        return 'medication';
    }
  }

  private translateAllergySeverity(severity: string): 'low' | 'high' | 'unable-to-assess' {
    switch (severity.toUpperCase()) {
      case 'SV':
      case 'SEVERE':
        return 'high';
      case 'MO':
      case 'MODERATE':
        return 'high';
      case 'MI':
      case 'MILD':
        return 'low';
      default:
        return 'unable-to-assess';
    }
  }

  private translateDiagnosisType(type: string): string {
    switch (type.toUpperCase()) {
      case 'A':
        return 'encounter-diagnosis';
      case 'W':
        return 'problem-list-item';
      case 'F':
        return 'encounter-diagnosis';
      default:
        return 'encounter-diagnosis';
    }
  }

  private translateNameType(type?: string): FHIRHumanName['use'] {
    switch (type) {
      case 'L':
        return 'official';
      case 'A':
        return 'usual';
      case 'D':
        return 'official';
      case 'M':
        return 'maiden';
      case 'N':
        return 'nickname';
      case 'S':
        return 'temp';
      default:
        return 'official';
    }
  }

  private translateAddressType(type?: string): FHIRAddress['use'] {
    switch (type) {
      case 'H':
        return 'home';
      case 'B':
      case 'O':
        return 'work';
      case 'C':
        return 'temp';
      case 'M':
        return 'billing';
      default:
        return 'home';
    }
  }

  private translateTelecomType(type?: string): FHIRContactPoint['system'] {
    switch (type) {
      case 'PH':
        return 'phone';
      case 'FX':
        return 'fax';
      case 'Internet':
        return 'email';
      case 'CP':
        return 'sms';
      case 'BP':
        return 'pager';
      default:
        return 'phone';
    }
  }

  private generateResourceId(resourceType: string): string {
    return `${resourceType.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateUUID(index: number): string {
    const timestamp = Date.now().toString(16);
    const random = Math.random().toString(16).substr(2, 12);
    return `${timestamp}-${random}-${index.toString(16).padStart(4, '0')}`;
  }
}

// Export factory function
export function createHL7ToFHIRTranslator(
  tenantId: string,
  sourceSystem?: string
): HL7ToFHIRTranslator {
  return new HL7ToFHIRTranslator(tenantId, sourceSystem);
}
