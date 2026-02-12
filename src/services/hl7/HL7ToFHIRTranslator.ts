/**
 * HL7 v2.x to FHIR R4 Translator — Orchestrator
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
 *
 * Segment-to-resource translation logic is delegated to focused modules
 * in the ./translators/ directory.
 */

import type {
  HL7Message,
  HL7MessageBase,
  ADTMessage,
  ORUMessage,
  ORMMessage,
} from '../../types/hl7v2';
import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';

import type {
  FHIRResource,
  FHIRBundle,
  FHIRObservation,
  FHIRTranslationSuccess,
  TranslationResult,
} from './translators/types';

import { pidToPatient } from './translators/patientTranslator';
import { pv1ToEncounter } from './translators/encounterTranslator';
import { obrToDiagnosticReport, obxToObservation } from './translators/diagnosticTranslator';
import { orcToServiceRequest, al1ToAllergyIntolerance, dg1ToCondition, in1ToCoverage } from './translators/orderTranslator';
import { generateUUID } from './translators/commonTranslators';

// Re-export types so existing barrel imports continue to work
export type { FHIRTranslationSuccess, TranslationResult } from './translators/types';

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
          fullUrl: `urn:uuid:${generateUUID(index)}`,
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
    _warnings: string[]
  ): void {
    // Create Patient resource
    if (message.patientIdentification) {
      resources.push(pidToPatient(message.patientIdentification, this.sourceSystem, this.tenantId));
    }

    // Create Encounter resource
    if (message.patientVisit) {
      resources.push(pv1ToEncounter(
        message.patientVisit,
        message.patientVisitAdditional,
        message.header.messageType.triggerEvent,
        this.sourceSystem,
        this.tenantId
      ));
    }

    // Create AllergyIntolerance resources
    if (message.allergies) {
      for (const allergy of message.allergies) {
        resources.push(al1ToAllergyIntolerance(allergy, this.sourceSystem));
      }
    }

    // Create Condition resources from diagnoses
    if (message.diagnoses) {
      for (const diagnosis of message.diagnoses) {
        resources.push(dg1ToCondition(diagnosis, this.sourceSystem));
      }
    }

    // Create Coverage resources from insurance
    if (message.insurance) {
      for (const insurance of message.insurance) {
        resources.push(in1ToCoverage(insurance, this.sourceSystem));
      }
    }
  }

  // ============================================================================
  // ORU MESSAGE TRANSLATION (Lab Results)
  // ============================================================================

  private translateORUResources(
    message: ORUMessage,
    resources: FHIRResource[],
    _warnings: string[]
  ): void {
    // Create Patient resource
    if (message.patientIdentification) {
      resources.push(pidToPatient(message.patientIdentification, this.sourceSystem, this.tenantId));
    }

    // Create DiagnosticReport and Observation resources
    for (const obsResult of message.observationResults) {
      const diagnosticReport = obrToDiagnosticReport(obsResult.request, this.sourceSystem);
      const observations: FHIRObservation[] = [];

      for (const obx of obsResult.observations) {
        const observation = obxToObservation(obx, this.sourceSystem);
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
    _warnings: string[]
  ): void {
    // Create Patient resource if available
    if (message.patientIdentification) {
      resources.push(pidToPatient(message.patientIdentification, this.sourceSystem, this.tenantId));
    }

    // Create ServiceRequest resources
    for (const order of message.orders) {
      resources.push(orcToServiceRequest(order.commonOrder, order.orderDetail, this.sourceSystem));
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
      resources.push(pidToPatient(message.patientIdentification, this.sourceSystem, this.tenantId));
    }

    if (message.patientVisit) {
      resources.push(pv1ToEncounter(message.patientVisit, message.patientVisitAdditional, undefined, this.sourceSystem, this.tenantId));
    }

    if (message.allergies) {
      for (const allergy of message.allergies) {
        resources.push(al1ToAllergyIntolerance(allergy, this.sourceSystem));
      }
    }

    if (message.diagnoses) {
      for (const diagnosis of message.diagnoses) {
        resources.push(dg1ToCondition(diagnosis, this.sourceSystem));
      }
    }
  }
}

// Export factory function
export function createHL7ToFHIRTranslator(
  tenantId: string,
  sourceSystem?: string
): HL7ToFHIRTranslator {
  return new HL7ToFHIRTranslator(tenantId, sourceSystem);
}
