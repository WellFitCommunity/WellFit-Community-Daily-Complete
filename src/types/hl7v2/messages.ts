/**
 * HL7 v2.x Message Structure & Service Types
 *
 * Composed message types (ADT, ORU, ORM, ACK), the HL7Segment union,
 * parse/transform result types, and connection/log configuration.
 */

import type { HL7Delimiters, ADTEventType, ORUEventType, ORMEventType } from './core';
import type {
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

// ============================================================================
// GENERIC / UNION SEGMENT TYPE
// ============================================================================

export interface GenericSegment {
  segmentType: string;
  fields: string[];
}

export type HL7Segment =
  | MSHSegment
  | PIDSegment
  | PV1Segment
  | PV2Segment
  | OBRSegment
  | OBXSegment
  | ORCSegment
  | DG1Segment
  | AL1Segment
  | IN1Segment
  | NTESegment
  | MSASegment
  | ERRSegment
  | GenericSegment;

export interface HL7ParseError {
  segmentIndex: number;
  fieldIndex?: number;
  message: string;
  severity: 'warning' | 'error';
}

// ============================================================================
// MESSAGE STRUCTURES
// ============================================================================

/**
 * Base HL7 v2.x Message (without orders - allows ORM to override)
 */
export interface HL7MessageBase {
  raw: string;
  delimiters: HL7Delimiters;
  header: MSHSegment;
  segments: HL7Segment[];
  parseErrors: HL7ParseError[];

  // Typed segment accessors
  patientIdentification?: PIDSegment;
  patientVisit?: PV1Segment;
  patientVisitAdditional?: PV2Segment;
  observations?: OBXSegment[];
  observationRequests?: OBRSegment[];
  diagnoses?: DG1Segment[];
  allergies?: AL1Segment[];
  insurance?: IN1Segment[];
  notes?: NTESegment[];
}

/**
 * Parsed HL7 v2.x Message
 */
export interface HL7Message extends HL7MessageBase {
  orders?: ORCSegment[];
}

/**
 * ADT Message Structure
 */
export interface ADTMessage extends HL7Message {
  messageType: 'ADT';
  eventType: ADTEventType;
  patientIdentification: PIDSegment;
  patientVisit: PV1Segment;
}

/**
 * ORU Message Structure (Lab Results)
 */
export interface ORUMessage extends HL7Message {
  messageType: 'ORU';
  eventType: ORUEventType;
  patientIdentification: PIDSegment;
  observationResults: Array<{
    request: OBRSegment;
    observations: OBXSegment[];
    notes?: NTESegment[];
  }>;
}

/**
 * ORM Message Structure (Orders)
 * Extends HL7MessageBase to allow different orders structure
 */
export interface ORMMessage extends HL7MessageBase {
  messageType: 'ORM';
  eventType: ORMEventType;
  patientIdentification?: PIDSegment;
  orders: Array<{
    commonOrder: ORCSegment;
    orderDetail?: OBRSegment;
    observations?: OBXSegment[];
  }>;
}

/**
 * ACK Message Structure
 */
export interface ACKMessage extends HL7Message {
  messageType: 'ACK';
  acknowledgment: MSASegment;
  errors?: ERRSegment[];
}

// ============================================================================
// SERVICE TYPES
// ============================================================================

export interface HL7ParseResult<T extends HL7Message = HL7Message> {
  success: boolean;
  message?: T;
  errors: HL7ParseError[];
  rawMessage: string;
}

export interface HL7TransformResult {
  success: boolean;
  fhirResources?: Record<string, unknown>[];
  errors: string[];
}

export interface HL7ConnectionConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: 'MLLP' | 'HTTP' | 'HTTPS';
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  hl7Version: '2.3' | '2.3.1' | '2.4' | '2.5' | '2.5.1' | '2.6' | '2.7' | '2.8';
  enabled: boolean;
  lastConnected?: string;
  lastError?: string;
  tenantId: string;
}

export interface HL7MessageLog {
  id: string;
  connectionId: string;
  direction: 'inbound' | 'outbound';
  messageType: string;
  eventType: string;
  messageControlId: string;
  patientId?: string;
  status: 'received' | 'processed' | 'error' | 'ack_sent';
  rawMessage?: string;              // Stored encrypted
  processedAt?: string;
  errors?: string[];
  tenantId: string;
  createdAt: string;
}
