/**
 * HL7 OBR/OBX Segment to FHIR DiagnosticReport/Observation Translators
 *
 * Converts HL7 v2.x OBR (Observation Request) segments to FHIR DiagnosticReport
 * and OBX (Observation Result) segments to FHIR Observation resources.
 */

import type { OBRSegment, OBXSegment } from '../../../types/hl7v2';
import type { FHIRDiagnosticReport, FHIRObservation } from './types';
import { translateResultStatus, translateObservationStatus, translateAbnormalFlag } from './statusMaps';
import {
  translateDateTime,
  translateCodedElement,
  translateExtendedPersonToReference,
  generateResourceId,
} from './commonTranslators';

/**
 * Translate an OBR segment to a FHIR DiagnosticReport resource
 */
export function obrToDiagnosticReport(
  obr: OBRSegment,
  sourceSystem: string
): FHIRDiagnosticReport {
  const report: FHIRDiagnosticReport = {
    resourceType: 'DiagnosticReport',
    id: generateResourceId('DiagnosticReport'),
    meta: {
      source: sourceSystem,
      lastUpdated: new Date().toISOString(),
      profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-diagnosticreport-lab'],
    },
    status: translateResultStatus(obr.resultStatus),
    code: translateCodedElement(obr.universalServiceIdentifier),
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
  if (obr.observationDateTime && obr.observationEndDateTime) {
    report.effectivePeriod = {
      start: translateDateTime(obr.observationDateTime),
      end: translateDateTime(obr.observationEndDateTime),
    };
  } else if (obr.observationDateTime) {
    report.effectiveDateTime = translateDateTime(obr.observationDateTime);
  }

  // Issued time
  if (obr.resultsReportStatusChangeDateTime) {
    report.issued = translateDateTime(obr.resultsReportStatusChangeDateTime);
  }

  // Performers
  if (obr.principalResultInterpreter) {
    report.performer = [translateExtendedPersonToReference(obr.principalResultInterpreter)];
  }

  // Clinical info as conclusion
  if (obr.relevantClinicalInfo) {
    report.conclusion = obr.relevantClinicalInfo;
  }

  return report;
}

/**
 * Translate an OBX segment to a FHIR Observation resource
 */
export function obxToObservation(
  obx: OBXSegment,
  sourceSystem: string
): FHIRObservation {
  const observation: FHIRObservation = {
    resourceType: 'Observation',
    id: generateResourceId('Observation'),
    meta: {
      source: sourceSystem,
      lastUpdated: new Date().toISOString(),
      profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab'],
    },
    status: translateObservationStatus(obx.observationResultStatus),
    code: translateCodedElement(obx.observationIdentifier),
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
    observation.effectiveDateTime = translateDateTime(obx.dateTimeOfObservation);
  }

  // Issued time
  if (obx.dateTimeOfAnalysis) {
    observation.issued = translateDateTime(obx.dateTimeOfAnalysis);
  }

  // Value based on type
  if (obx.observationValue && obx.observationValue.length > 0) {
    const value = obx.observationValue[0];

    switch (obx.valueType) {
      case 'NM': { // Numeric
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
      }
      case 'ST': // String
      case 'TX': // Text
      case 'FT': // Formatted text
        observation.valueString = value;
        break;
      case 'CE': // Coded entry
      case 'CWE': // Coded with exceptions
        observation.valueCodeableConcept = translateCodedElement({
          identifier: value.split('^')[0],
          text: value.split('^')[1],
          nameOfCodingSystem: value.split('^')[2],
        });
        break;
      case 'SN': { // Structured numeric
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
      }
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
          code: translateAbnormalFlag(flag),
        },
      ],
    }));
  }

  // Performer
  if (obx.responsibleObserver && obx.responsibleObserver.length > 0) {
    observation.performer = obx.responsibleObserver.map((obs) =>
      translateExtendedPersonToReference(obs)
    );
  }

  return observation;
}
