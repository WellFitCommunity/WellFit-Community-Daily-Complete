/**
 * HL7 v2.x Type Definitions — Barrel Re-export
 *
 * Supports parsing of legacy HL7 v2.x messages (v2.3 - v2.8)
 * Primary message types: ADT (Admit/Discharge/Transfer), ORU (Results), ORM (Orders)
 *
 * This is NOT a replacement for FHIR - it's a bridge to legacy systems.
 * 80%+ of hospital interfaces still use HL7 v2.x.
 *
 * Decomposed from a single 975-line file into focused modules:
 * - core.ts: Core types, event types, constants
 * - dataTypes.ts: Reusable data type interfaces
 * - segments.ts: HL7 segment interfaces (MSH, PID, PV1, etc.)
 * - messages.ts: Composed message structures and service types
 */

// Core types & event types
export type {
  HL7Delimiters,
  HL7MessageType,
  ADTEventType,
  ORUEventType,
  ORMEventType,
  OBXValueType,
} from './core';
export { DEFAULT_DELIMITERS } from './core';

// Supporting data types
export type {
  PatientIdentifier,
  HumanName,
  Address,
  ExtendedTelecom,
  CodedElement,
  ExtendedPerson,
  ExtendedOrganization,
  PatientLocation,
  DischargeLocation,
  FinancialClass,
  Quantity,
  SpecimenSource,
  ParentResult,
  ParentOrder,
  DateRange,
  ErrorLocation,
} from './dataTypes';

// Segment types
export type {
  MSHSegment,
  PIDSegment,
  PV1Segment,
  PV2Segment,
  OBRSegment,
  OBXSegment,
  ORCSegment,
  DG1Segment,
  AL1Segment,
  IN1Segment,
  NTESegment,
  MSASegment,
  ERRSegment,
} from './segments';

// Message structures & service types
export type {
  GenericSegment,
  HL7Segment,
  HL7ParseError,
  HL7MessageBase,
  HL7Message,
  ADTMessage,
  ORUMessage,
  ORMMessage,
  ACKMessage,
  HL7ParseResult,
  HL7TransformResult,
  HL7ConnectionConfig,
  HL7MessageLog,
} from './messages';
