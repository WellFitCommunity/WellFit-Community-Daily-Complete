/**
 * HL7 v2.x Message Parser
 *
 * Parses HL7 v2.x messages (v2.3 - v2.8) into structured TypeScript objects.
 * Supports ADT, ORU, ORM, and ACK message types.
 *
 * HL7 v2.x Message Structure:
 * - Messages are delimited by carriage returns (\r)
 * - Fields within segments are delimited by | (pipe)
 * - Components within fields are delimited by ^ (caret)
 * - Subcomponents are delimited by & (ampersand)
 * - Repetitions are delimited by ~ (tilde)
 *
 * MLLP Framing (for TCP transport):
 * - Start: 0x0B (vertical tab)
 * - End: 0x1C 0x0D (file separator + carriage return)
 */

import {
  HL7Message,
  HL7MessageBase,
  HL7Segment,
  HL7Delimiters,
  HL7ParseError,
  DEFAULT_DELIMITERS,
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
  ADTMessage,
  ORUMessage,
  ORMMessage,
  ADTEventType,
  ORUEventType,
} from '../../types/hl7v2';
import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import { SegmentParsers } from './parsers/segmentParsers';

// MLLP framing characters
const MLLP_START = '\x0B'; // Vertical Tab (VT)
const MLLP_END = '\x1C\x0D'; // File Separator + Carriage Return

/**
 * Extended success data that includes parse warnings
 */
export interface HL7ParseSuccess<T extends HL7MessageBase = HL7Message> {
  message: T;
  warnings: HL7ParseError[];
  rawMessage: string;
}

/**
 * Core HL7 v2.x Parser
 *
 * Uses ServiceResult<T> pattern for consistent error handling.
 */
export class HL7Parser {
  private delimiters: HL7Delimiters = DEFAULT_DELIMITERS;
  private parseErrors: HL7ParseError[] = [];
  private segmentParsers: SegmentParsers;

  constructor() {
    this.segmentParsers = new SegmentParsers(this.delimiters);
  }

  /**
   * Parse a raw HL7 message string
   * @returns ServiceResult with parsed message or error details
   */
  parse(rawMessage: string): ServiceResult<HL7ParseSuccess> {
    this.parseErrors = [];

    try {
      // Remove MLLP framing if present
      const message = this.stripMLLPFraming(rawMessage);

      // Normalize line endings
      const normalizedMessage = this.normalizeLineEndings(message);

      // Split into segments
      const segmentStrings = normalizedMessage.split('\r').filter((s) => s.trim());

      if (segmentStrings.length === 0) {
        return failure(
          'VALIDATION_ERROR',
          'Empty message',
          undefined,
          { rawMessage, errors: [{ segmentIndex: 0, message: 'Empty message', severity: 'error' }] }
        );
      }

      // First segment must be MSH
      if (!segmentStrings[0].startsWith('MSH')) {
        return failure(
          'VALIDATION_ERROR',
          'Message must start with MSH segment',
          undefined,
          {
            rawMessage,
            errors: [{ segmentIndex: 0, message: 'Message must start with MSH segment', severity: 'error' }],
          }
        );
      }

      // Extract delimiters from MSH segment
      this.extractDelimiters(segmentStrings[0]);
      this.segmentParsers.updateDelimiters(this.delimiters);

      // Parse MSH segment first
      const mshSegment = this.segmentParsers.parseMSHSegment(segmentStrings[0]);
      if (!mshSegment) {
        return failure(
          'VALIDATION_ERROR',
          'Failed to parse MSH segment',
          undefined,
          { rawMessage, errors: this.parseErrors }
        );
      }

      // Parse remaining segments
      const segments: HL7Segment[] = [mshSegment];
      for (let i = 1; i < segmentStrings.length; i++) {
        const segment = this.parseSegment(segmentStrings[i], i);
        if (segment) {
          segments.push(segment);
        }
      }

      // Build structured message
      const parsedMessage = this.buildMessage(rawMessage, mshSegment, segments);

      // Check for critical parse errors
      const criticalErrors = this.parseErrors.filter((e) => e.severity === 'error');
      if (criticalErrors.length > 0) {
        return failure(
          'VALIDATION_ERROR',
          `Parse failed with ${criticalErrors.length} error(s)`,
          undefined,
          { rawMessage, errors: this.parseErrors }
        );
      }

      return success({
        message: parsedMessage,
        warnings: this.parseErrors.filter((e) => e.severity === 'warning'),
        rawMessage,
      });
    } catch (error) {
      auditLogger.security('HL7_PARSE_ERROR', 'high', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return failure(
        'UNKNOWN_ERROR',
        `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
        { rawMessage }
      );
    }
  }

  /**
   * Parse specifically as ADT message
   */
  parseADT(rawMessage: string): ServiceResult<HL7ParseSuccess<ADTMessage>> {
    const result = this.parse(rawMessage);
    if (!result.success) {
      return result;
    }

    const { message } = result.data;

    if (message.header.messageType.messageCode !== 'ADT') {
      return failure(
        'VALIDATION_ERROR',
        `Expected ADT message, got ${message.header.messageType.messageCode}`,
        undefined,
        { rawMessage }
      );
    }

    if (!message.patientIdentification) {
      return failure(
        'VALIDATION_ERROR',
        'ADT message missing required PID segment',
        undefined,
        { rawMessage }
      );
    }

    const adtMessage: ADTMessage = {
      ...message,
      messageType: 'ADT',
      eventType: message.header.messageType.triggerEvent as ADTEventType,
      patientIdentification: message.patientIdentification,
      patientVisit: message.patientVisit!,
    };

    return success({
      message: adtMessage,
      warnings: result.data.warnings,
      rawMessage,
    });
  }

  /**
   * Parse specifically as ORU message (lab results)
   */
  parseORU(rawMessage: string): ServiceResult<HL7ParseSuccess<ORUMessage>> {
    const result = this.parse(rawMessage);
    if (!result.success) {
      return result;
    }

    const { message } = result.data;

    if (message.header.messageType.messageCode !== 'ORU') {
      return failure(
        'VALIDATION_ERROR',
        `Expected ORU message, got ${message.header.messageType.messageCode}`,
        undefined,
        { rawMessage }
      );
    }

    // Group OBX segments under their parent OBR
    const observationResults: ORUMessage['observationResults'] = [];
    let currentOBR: OBRSegment | null = null;
    let currentOBXList: OBXSegment[] = [];
    let currentNTEList: NTESegment[] = [];

    for (const segment of message.segments) {
      if (segment.segmentType === 'OBR') {
        // Save previous group
        if (currentOBR) {
          observationResults.push({
            request: currentOBR,
            observations: currentOBXList,
            notes: currentNTEList.length > 0 ? currentNTEList : undefined,
          });
        }
        currentOBR = segment as OBRSegment;
        currentOBXList = [];
        currentNTEList = [];
      } else if (segment.segmentType === 'OBX') {
        currentOBXList.push(segment as OBXSegment);
      } else if (segment.segmentType === 'NTE') {
        currentNTEList.push(segment as NTESegment);
      }
    }

    // Don't forget the last group
    if (currentOBR) {
      observationResults.push({
        request: currentOBR,
        observations: currentOBXList,
        notes: currentNTEList.length > 0 ? currentNTEList : undefined,
      });
    }

    const oruMessage: ORUMessage = {
      ...message,
      messageType: 'ORU',
      eventType: message.header.messageType.triggerEvent as ORUEventType,
      patientIdentification: message.patientIdentification!,
      observationResults,
    };

    return success({
      message: oruMessage,
      warnings: result.data.warnings,
      rawMessage,
    });
  }

  /**
   * Parse specifically as ORM message (orders)
   */
  parseORM(rawMessage: string): ServiceResult<HL7ParseSuccess<ORMMessage>> {
    const result = this.parse(rawMessage);
    if (!result.success) {
      return result;
    }

    const { message } = result.data;

    if (message.header.messageType.messageCode !== 'ORM') {
      return failure(
        'VALIDATION_ERROR',
        `Expected ORM message, got ${message.header.messageType.messageCode}`,
        undefined,
        { rawMessage }
      );
    }

    // Group order segments
    const orders: ORMMessage['orders'] = [];
    let currentORC: ORCSegment | null = null;
    let currentOBR: OBRSegment | undefined;
    let currentOBXList: OBXSegment[] = [];

    for (const segment of message.segments) {
      if (segment.segmentType === 'ORC') {
        // Save previous order
        if (currentORC) {
          orders.push({
            commonOrder: currentORC,
            orderDetail: currentOBR,
            observations: currentOBXList.length > 0 ? currentOBXList : undefined,
          });
        }
        currentORC = segment as ORCSegment;
        currentOBR = undefined;
        currentOBXList = [];
      } else if (segment.segmentType === 'OBR') {
        currentOBR = segment as OBRSegment;
      } else if (segment.segmentType === 'OBX') {
        currentOBXList.push(segment as OBXSegment);
      }
    }

    // Don't forget the last order
    if (currentORC) {
      orders.push({
        commonOrder: currentORC,
        orderDetail: currentOBR,
        observations: currentOBXList.length > 0 ? currentOBXList : undefined,
      });
    }

    const ormMessage: ORMMessage = {
      ...message,
      messageType: 'ORM',
      eventType: message.header.messageType.triggerEvent as 'O01' | 'O02',
      patientIdentification: message.patientIdentification,
      orders,
    };

    return success({
      message: ormMessage,
      warnings: result.data.warnings,
      rawMessage,
    });
  }

  /**
   * Generate an ACK message in response to a received message
   */
  generateACK(
    originalMessage: HL7Message,
    ackCode: 'AA' | 'AE' | 'AR',
    errorMessage?: string
  ): string {
    const now = new Date();
    const timestamp = this.formatDateTime(now);
    const controlId = `ACK${Date.now()}`;

    let ack = `MSH|^~\\&|${originalMessage.header.receivingApplication}|${originalMessage.header.receivingFacility}|${originalMessage.header.sendingApplication}|${originalMessage.header.sendingFacility}|${timestamp}||ACK^${originalMessage.header.messageType.triggerEvent}^ACK|${controlId}|P|${originalMessage.header.versionId}\r`;
    ack += `MSA|${ackCode}|${originalMessage.header.messageControlId}`;

    if (errorMessage) {
      ack += `|${this.escapeHL7(errorMessage)}`;
    }
    ack += '\r';

    if (ackCode !== 'AA' && errorMessage) {
      ack += `ERR|||207^Application internal error^HL70357|E|||${this.escapeHL7(errorMessage)}\r`;
    }

    return ack;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private stripMLLPFraming(message: string): string {
    let result = message;
    if (result.startsWith(MLLP_START)) {
      result = result.substring(1);
    }
    if (result.endsWith(MLLP_END)) {
      result = result.substring(0, result.length - 2);
    }
    return result;
  }

  private normalizeLineEndings(message: string): string {
    return message.replace(/\r\n/g, '\r').replace(/\n/g, '\r');
  }

  private extractDelimiters(mshSegment: string): void {
    // MSH segment defines delimiters in first 8 characters
    // MSH|^~\&|...
    if (mshSegment.length < 8) {
      this.addError(0, 'MSH segment too short to extract delimiters', 'error');
      return;
    }

    this.delimiters = {
      field: mshSegment[3], // Usually |
      component: mshSegment[4], // Usually ^
      repetition: mshSegment[5], // Usually ~
      escape: mshSegment[6], // Usually \
      subComponent: mshSegment[7], // Usually &
    };
  }

  private parseSegment(segmentString: string, index: number): HL7Segment | null {
    const segmentType = segmentString.substring(0, 3);

    try {
      switch (segmentType) {
        case 'MSH':
          return this.segmentParsers.parseMSHSegment(segmentString);
        case 'PID':
          return this.segmentParsers.parsePIDSegment(segmentString);
        case 'PV1':
          return this.segmentParsers.parsePV1Segment(segmentString);
        case 'PV2':
          return this.segmentParsers.parsePV2Segment(segmentString);
        case 'OBR':
          return this.segmentParsers.parseOBRSegment(segmentString);
        case 'OBX':
          return this.segmentParsers.parseOBXSegment(segmentString);
        case 'ORC':
          return this.segmentParsers.parseORCSegment(segmentString);
        case 'DG1':
          return this.segmentParsers.parseDG1Segment(segmentString);
        case 'AL1':
          return this.segmentParsers.parseAL1Segment(segmentString);
        case 'IN1':
          return this.segmentParsers.parseIN1Segment(segmentString);
        case 'NTE':
          return this.segmentParsers.parseNTESegment(segmentString);
        case 'MSA':
          return this.segmentParsers.parseMSASegment(segmentString);
        case 'ERR':
          return this.segmentParsers.parseERRSegment(segmentString);
        default:
          return this.segmentParsers.parseGenericSegment(segmentString);
      }
    } catch (error) {
      this.addError(
        index,
        `Failed to parse ${segmentType} segment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'warning'
      );
      return this.segmentParsers.parseGenericSegment(segmentString);
    }
  }

  // ============================================================================
  // MESSAGE BUILDER
  // ============================================================================

  private buildMessage(raw: string, header: MSHSegment, segments: HL7Segment[]): HL7Message {
    const message: HL7Message = {
      raw,
      delimiters: this.delimiters,
      header,
      segments,
      parseErrors: this.parseErrors,
    };

    // Extract typed segments
    for (const segment of segments) {
      switch (segment.segmentType) {
        case 'PID':
          message.patientIdentification = segment as PIDSegment;
          break;
        case 'PV1':
          message.patientVisit = segment as PV1Segment;
          break;
        case 'PV2':
          message.patientVisitAdditional = segment as PV2Segment;
          break;
        case 'OBX':
          if (!message.observations) message.observations = [];
          message.observations.push(segment as OBXSegment);
          break;
        case 'OBR':
          if (!message.observationRequests) message.observationRequests = [];
          message.observationRequests.push(segment as OBRSegment);
          break;
        case 'ORC':
          if (!message.orders) message.orders = [];
          message.orders.push(segment as ORCSegment);
          break;
        case 'DG1':
          if (!message.diagnoses) message.diagnoses = [];
          message.diagnoses.push(segment as DG1Segment);
          break;
        case 'AL1':
          if (!message.allergies) message.allergies = [];
          message.allergies.push(segment as AL1Segment);
          break;
        case 'IN1':
          if (!message.insurance) message.insurance = [];
          message.insurance.push(segment as IN1Segment);
          break;
        case 'NTE':
          if (!message.notes) message.notes = [];
          message.notes.push(segment as NTESegment);
          break;
      }
    }

    return message;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private addError(segmentIndex: number, message: string, severity: 'warning' | 'error'): void {
    this.parseErrors.push({ segmentIndex, message, severity });
  }

  private formatDateTime(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return (
      `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
      `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
    );
  }

  private escapeHL7(text: string): string {
    return text
      .replace(/\\/g, '\\E\\')
      .replace(/\|/g, '\\F\\')
      .replace(/\^/g, '\\S\\')
      .replace(/&/g, '\\T\\')
      .replace(/~/g, '\\R\\')
      .replace(/\r/g, '\\X0D\\')
      .replace(/\n/g, '\\X0A\\');
  }
}

// Export singleton instance
export const hl7Parser = new HL7Parser();
