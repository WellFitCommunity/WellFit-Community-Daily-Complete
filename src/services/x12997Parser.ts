/**
 * X12 997 Functional Acknowledgment Parser
 *
 * Purpose: Parse X12 997 EDI content into structured data
 * Features: Segment parsing, error extraction, validation
 * Standards: X12 997 (005010X231A1)
 *
 * @module services/x12997Parser
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Acknowledgment status codes per X12 997 standard
 */
export type AcknowledgmentStatusCode = 'A' | 'E' | 'R' | 'P' | 'M' | 'W' | 'X';

/**
 * Transaction set acknowledgment codes (AK501)
 */
export type TransactionAckCode = 'A' | 'E' | 'M' | 'R' | 'W' | 'X';

/**
 * ISA Envelope information
 */
export interface ISAEnvelope {
  authorizationInfoQualifier: string;
  authorizationInfo: string;
  securityInfoQualifier: string;
  securityInfo: string;
  interchangeSenderIdQualifier: string;
  interchangeSenderId: string;
  interchangeReceiverIdQualifier: string;
  interchangeReceiverId: string;
  interchangeDate: string;
  interchangeTime: string;
  repetitionSeparator: string;
  interchangeControlVersionNumber: string;
  interchangeControlNumber: string;
  acknowledgmentRequested: string;
  usageIndicator: string;
  componentElementSeparator: string;
}

/**
 * GS Functional Group header
 */
export interface GSHeader {
  functionalIdCode: string;
  applicationSenderCode: string;
  applicationReceiverCode: string;
  date: string;
  time: string;
  groupControlNumber: string;
  responsibleAgencyCode: string;
  versionCode: string;
}

/**
 * AK1 - Functional Group Response Header
 */
export interface AK1Segment {
  functionalIdCode: string;
  groupControlNumber: string;
  versionCode?: string;
}

/**
 * AK2 - Transaction Set Response Header
 */
export interface AK2Segment {
  transactionSetIdCode: string;
  transactionSetControlNumber: string;
  implementationConventionReference?: string;
}

/**
 * AK3 - Data Segment Note
 */
export interface AK3Segment {
  segmentIdCode: string;
  segmentPositionInTransactionSet: number;
  loopIdentifierCode?: string;
  segmentSyntaxErrorCode?: string;
}

/**
 * AK4 - Data Element Note
 */
export interface AK4Segment {
  positionInSegment: number;
  componentDataElementPositionInComposite?: number;
  dataElementReferenceNumber?: string;
  dataElementSyntaxErrorCode: string;
  copyOfBadDataElement?: string;
}

/**
 * AK5 - Transaction Set Response Trailer
 */
export interface AK5Segment {
  transactionSetAcknowledgmentCode: TransactionAckCode;
  transactionSetSyntaxErrorCode1?: string;
  transactionSetSyntaxErrorCode2?: string;
  transactionSetSyntaxErrorCode3?: string;
  transactionSetSyntaxErrorCode4?: string;
  transactionSetSyntaxErrorCode5?: string;
}

/**
 * AK9 - Functional Group Response Trailer
 */
export interface AK9Segment {
  functionalGroupAcknowledgeCode: AcknowledgmentStatusCode;
  numberOfTransactionSetsIncluded: number;
  numberOfReceivedTransactionSets: number;
  numberOfAcceptedTransactionSets: number;
  functionalGroupSyntaxErrorCode1?: string;
  functionalGroupSyntaxErrorCode2?: string;
  functionalGroupSyntaxErrorCode3?: string;
  functionalGroupSyntaxErrorCode4?: string;
  functionalGroupSyntaxErrorCode5?: string;
}

/**
 * Segment-level error with optional element errors
 */
export interface SegmentError {
  ak3: AK3Segment;
  ak4Errors: AK4Segment[];
}

/**
 * Transaction set acknowledgment with errors
 */
export interface TransactionSetAcknowledgment {
  ak2: AK2Segment;
  segmentErrors: SegmentError[];
  ak5: AK5Segment;
}

/**
 * Parsed 997 acknowledgment
 */
export interface Parsed997 {
  isa: ISAEnvelope;
  gs: GSHeader;
  ak1: AK1Segment;
  transactionSets: TransactionSetAcknowledgment[];
  ak9: AK9Segment;
  rawContent: string;
  parseErrors: string[];
}

/**
 * Parse result with success/failure indication
 */
export interface ParseResult {
  success: boolean;
  data?: Parsed997;
  error?: string;
  parseErrors?: string[];
}

// =============================================================================
// ERROR CODE DESCRIPTIONS
// =============================================================================

/**
 * Segment syntax error code descriptions (AK304)
 */
export const SEGMENT_ERROR_CODES: Record<string, string> = {
  '1': 'Unrecognized segment ID',
  '2': 'Unexpected segment',
  '3': 'Mandatory segment missing',
  '4': 'Loop occurs over maximum times',
  '5': 'Segment exceeds maximum use',
  '6': 'Segment not in defined transaction set',
  '7': 'Segment not in proper sequence',
  '8': 'Segment has data element errors',
};

/**
 * Element syntax error code descriptions (AK403)
 */
export const ELEMENT_ERROR_CODES: Record<string, string> = {
  '1': 'Mandatory data element missing',
  '2': 'Conditional required data element missing',
  '3': 'Too many data elements',
  '4': 'Data element too short',
  '5': 'Data element too long',
  '6': 'Invalid character in data element',
  '7': 'Invalid code value',
  '8': 'Invalid date',
  '9': 'Invalid time',
  '10': 'Exclusion condition violated',
  '12': 'Too many repetitions',
  '13': 'Too many components',
};

/**
 * Transaction set acknowledgment code descriptions (AK501)
 */
export const TRANSACTION_ACK_CODES: Record<string, string> = {
  'A': 'Accepted',
  'E': 'Accepted, but errors were noted',
  'M': 'Rejected, message authentication code failed',
  'R': 'Rejected',
  'W': 'Rejected, assurance failed',
  'X': 'Rejected, content decryption failed',
};

/**
 * Functional group acknowledgment code descriptions (AK901)
 */
export const GROUP_ACK_CODES: Record<string, string> = {
  'A': 'Accepted',
  'E': 'Accepted, but errors were noted',
  'M': 'Rejected, message authentication code failed',
  'P': 'Partially accepted, at least one transaction set was rejected',
  'R': 'Rejected',
  'W': 'Rejected, assurance failed',
  'X': 'Rejected, content decryption failed',
};

/**
 * Transaction set syntax error code descriptions (AK502-AK506)
 */
export const TRANSACTION_SYNTAX_ERROR_CODES: Record<string, string> = {
  '1': 'Transaction set not supported',
  '2': 'Transaction set trailer missing',
  '3': 'Transaction set control number mismatch',
  '4': 'Number of included segments does not match actual count',
  '5': 'One or more segments in error',
  '6': 'Missing or invalid transaction set identifier',
  '7': 'Missing or invalid transaction set control number',
  '8': 'Missing or invalid transaction set control number in header',
  '9': 'Unknown transaction set trailer',
  '10': 'Missing or invalid transaction set header',
  '11': 'Missing or invalid transaction set header control number',
  '12': 'Missing or invalid transaction set trailer control number',
  '13': 'Invalid transaction set identifier code',
  '15': 'Transaction set trailer control number mismatch',
  '16': 'Duplicate transaction set control number in group',
  '17': 'S3E security end segment missing for S3S security start segment',
  '18': 'S3S security start segment missing for S3E security end segment',
  '19': 'S4E security end segment missing for S4S security start segment',
  '20': 'S4S security start segment missing for S4E security end segment',
  '23': 'Transaction set control number not unique within group',
  '24': 'S3E security end segment not valid for position',
  '25': 'S3S security start segment not valid for position',
  '26': 'S4E security end segment not valid for position',
  '27': 'S4S security start segment not valid for position',
};

// =============================================================================
// PARSER CLASS
// =============================================================================

/**
 * X12 997 Parser
 *
 * Parses raw X12 997 content into structured data
 */
export class X12997Parser {
  private segments: string[] = [];
  private elementSeparator = '*';
  private segmentTerminator = '~';
  private componentSeparator = ':';
  private parseErrors: string[] = [];

  /**
   * Parse X12 997 content
   */
  parse(x12Content: string): ParseResult {
    try {
      this.parseErrors = [];

      // Clean and split content
      const cleanContent = this.cleanContent(x12Content);
      if (!cleanContent) {
        return { success: false, error: 'Empty or invalid X12 content' };
      }

      // Detect delimiters from ISA segment
      if (!this.detectDelimiters(cleanContent)) {
        return { success: false, error: 'Could not detect X12 delimiters from ISA segment' };
      }

      // Split into segments
      this.segments = cleanContent
        .split(this.segmentTerminator)
        .map(s => s.trim())
        .filter(s => s.length > 0);

      if (this.segments.length < 6) {
        return { success: false, error: 'Invalid 997: too few segments' };
      }

      // Parse ISA envelope
      const isa = this.parseISA();
      if (!isa) {
        return { success: false, error: 'Failed to parse ISA segment' };
      }

      // Parse GS header
      const gs = this.parseGS();
      if (!gs) {
        return { success: false, error: 'Failed to parse GS segment' };
      }

      // Verify this is a 997 transaction
      const stSegment = this.findSegment('ST');
      if (!stSegment) {
        return { success: false, error: 'ST segment not found' };
      }
      const stElements = stSegment.split(this.elementSeparator);
      if (stElements[1] !== '997') {
        return { success: false, error: `Not a 997 transaction: ${stElements[1]}` };
      }

      // Parse AK1
      const ak1 = this.parseAK1();
      if (!ak1) {
        return { success: false, error: 'Failed to parse AK1 segment' };
      }

      // Parse transaction set acknowledgments
      const transactionSets = this.parseTransactionSets();

      // Parse AK9
      const ak9 = this.parseAK9();
      if (!ak9) {
        return { success: false, error: 'Failed to parse AK9 segment' };
      }

      const parsed: Parsed997 = {
        isa,
        gs,
        ak1,
        transactionSets,
        ak9,
        rawContent: x12Content,
        parseErrors: this.parseErrors,
      };

      return {
        success: true,
        data: parsed,
        parseErrors: this.parseErrors.length > 0 ? this.parseErrors : undefined,
      };
    } catch (err) {
      return {
        success: false,
        error: `Parse error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Clean X12 content
   */
  private cleanContent(content: string): string {
    // Remove line breaks and carriage returns within the X12 content
    // but preserve the structure
    return content
      .replace(/\r\n/g, '')
      .replace(/\n/g, '')
      .replace(/\r/g, '')
      .trim();
  }

  /**
   * Detect X12 delimiters from ISA segment
   */
  private detectDelimiters(content: string): boolean {
    // ISA is always 106 characters (including segment terminator)
    // Element separator is always position 3
    // Component separator is position 104
    // Segment terminator is position 105

    if (!content.startsWith('ISA')) {
      return false;
    }

    if (content.length < 106) {
      // Try to use standard delimiters
      this.elementSeparator = '*';
      this.componentSeparator = ':';
      this.segmentTerminator = '~';
      return true;
    }

    this.elementSeparator = content[3];
    this.componentSeparator = content[104];
    this.segmentTerminator = content[105];

    return true;
  }

  /**
   * Find a segment by ID
   */
  private findSegment(segmentId: string): string | undefined {
    return this.segments.find(s =>
      s.split(this.elementSeparator)[0] === segmentId
    );
  }

  /**
   * Find all segments by ID
   */
  private findAllSegments(segmentId: string): string[] {
    return this.segments.filter(s =>
      s.split(this.elementSeparator)[0] === segmentId
    );
  }

  /**
   * Parse ISA envelope
   */
  private parseISA(): ISAEnvelope | null {
    const segment = this.findSegment('ISA');
    if (!segment) {
      this.parseErrors.push('ISA segment not found');
      return null;
    }

    const elements = segment.split(this.elementSeparator);
    if (elements.length < 17) {
      this.parseErrors.push(`ISA segment has ${elements.length} elements, expected 17`);
      return null;
    }

    return {
      authorizationInfoQualifier: elements[1],
      authorizationInfo: elements[2],
      securityInfoQualifier: elements[3],
      securityInfo: elements[4],
      interchangeSenderIdQualifier: elements[5],
      interchangeSenderId: elements[6].trim(),
      interchangeReceiverIdQualifier: elements[7],
      interchangeReceiverId: elements[8].trim(),
      interchangeDate: elements[9],
      interchangeTime: elements[10],
      repetitionSeparator: elements[11],
      interchangeControlVersionNumber: elements[12],
      interchangeControlNumber: elements[13],
      acknowledgmentRequested: elements[14],
      usageIndicator: elements[15],
      componentElementSeparator: elements[16],
    };
  }

  /**
   * Parse GS header
   */
  private parseGS(): GSHeader | null {
    const segment = this.findSegment('GS');
    if (!segment) {
      this.parseErrors.push('GS segment not found');
      return null;
    }

    const elements = segment.split(this.elementSeparator);
    if (elements.length < 9) {
      this.parseErrors.push(`GS segment has ${elements.length} elements, expected 9`);
      return null;
    }

    return {
      functionalIdCode: elements[1],
      applicationSenderCode: elements[2],
      applicationReceiverCode: elements[3],
      date: elements[4],
      time: elements[5],
      groupControlNumber: elements[6],
      responsibleAgencyCode: elements[7],
      versionCode: elements[8],
    };
  }

  /**
   * Parse AK1 segment
   */
  private parseAK1(): AK1Segment | null {
    const segment = this.findSegment('AK1');
    if (!segment) {
      this.parseErrors.push('AK1 segment not found');
      return null;
    }

    const elements = segment.split(this.elementSeparator);
    if (elements.length < 3) {
      this.parseErrors.push(`AK1 segment has ${elements.length} elements, expected at least 3`);
      return null;
    }

    return {
      functionalIdCode: elements[1],
      groupControlNumber: elements[2],
      versionCode: elements[3] || undefined,
    };
  }

  /**
   * Parse all transaction set acknowledgments (AK2/AK5 pairs)
   */
  private parseTransactionSets(): TransactionSetAcknowledgment[] {
    const transactionSets: TransactionSetAcknowledgment[] = [];

    // Find segment indices
    let inTransactionSet = false;
    let currentTx: Partial<TransactionSetAcknowledgment> | null = null;
    let currentSegmentError: Partial<SegmentError> | null = null;

    for (const segment of this.segments) {
      const elements = segment.split(this.elementSeparator);
      const segmentId = elements[0];

      switch (segmentId) {
        case 'AK2':
          // Start of transaction set acknowledgment
          if (currentTx && currentTx.ak2 && currentTx.ak5) {
            transactionSets.push(currentTx as TransactionSetAcknowledgment);
          }
          currentTx = {
            ak2: this.parseAK2Elements(elements),
            segmentErrors: [],
          };
          inTransactionSet = true;
          break;

        case 'AK3':
          // Segment error
          if (currentSegmentError?.ak3) {
            currentTx?.segmentErrors?.push(currentSegmentError as SegmentError);
          }
          currentSegmentError = {
            ak3: this.parseAK3Elements(elements),
            ak4Errors: [],
          };
          break;

        case 'AK4':
          // Element error
          if (currentSegmentError) {
            currentSegmentError.ak4Errors?.push(this.parseAK4Elements(elements));
          }
          break;

        case 'AK5':
          // End of transaction set acknowledgment
          if (currentSegmentError?.ak3) {
            currentTx?.segmentErrors?.push(currentSegmentError as SegmentError);
            currentSegmentError = null;
          }
          if (currentTx) {
            currentTx.ak5 = this.parseAK5Elements(elements);
            transactionSets.push(currentTx as TransactionSetAcknowledgment);
            currentTx = null;
          }
          inTransactionSet = false;
          break;

        default:
          break;
      }
    }

    return transactionSets;
  }

  /**
   * Parse AK2 elements
   */
  private parseAK2Elements(elements: string[]): AK2Segment {
    return {
      transactionSetIdCode: elements[1] || '',
      transactionSetControlNumber: elements[2] || '',
      implementationConventionReference: elements[3] || undefined,
    };
  }

  /**
   * Parse AK3 elements
   */
  private parseAK3Elements(elements: string[]): AK3Segment {
    return {
      segmentIdCode: elements[1] || '',
      segmentPositionInTransactionSet: parseInt(elements[2] || '0', 10),
      loopIdentifierCode: elements[3] || undefined,
      segmentSyntaxErrorCode: elements[4] || undefined,
    };
  }

  /**
   * Parse AK4 elements
   */
  private parseAK4Elements(elements: string[]): AK4Segment {
    // AK401 can be composite: position:component:data element ref
    const positionElement = elements[1] || '0';
    const positionParts = positionElement.split(this.componentSeparator);

    return {
      positionInSegment: parseInt(positionParts[0] || '0', 10),
      componentDataElementPositionInComposite: positionParts[1]
        ? parseInt(positionParts[1], 10)
        : undefined,
      dataElementReferenceNumber: positionParts[2] || elements[2] || undefined,
      dataElementSyntaxErrorCode: elements[3] || '',
      copyOfBadDataElement: elements[4] || undefined,
    };
  }

  /**
   * Parse AK5 elements
   */
  private parseAK5Elements(elements: string[]): AK5Segment {
    return {
      transactionSetAcknowledgmentCode: (elements[1] || 'R') as TransactionAckCode,
      transactionSetSyntaxErrorCode1: elements[2] || undefined,
      transactionSetSyntaxErrorCode2: elements[3] || undefined,
      transactionSetSyntaxErrorCode3: elements[4] || undefined,
      transactionSetSyntaxErrorCode4: elements[5] || undefined,
      transactionSetSyntaxErrorCode5: elements[6] || undefined,
    };
  }

  /**
   * Parse AK9 segment
   */
  private parseAK9(): AK9Segment | null {
    const segment = this.findSegment('AK9');
    if (!segment) {
      this.parseErrors.push('AK9 segment not found');
      return null;
    }

    const elements = segment.split(this.elementSeparator);
    if (elements.length < 5) {
      this.parseErrors.push(`AK9 segment has ${elements.length} elements, expected at least 5`);
      return null;
    }

    return {
      functionalGroupAcknowledgeCode: (elements[1] || 'R') as AcknowledgmentStatusCode,
      numberOfTransactionSetsIncluded: parseInt(elements[2] || '0', 10),
      numberOfReceivedTransactionSets: parseInt(elements[3] || '0', 10),
      numberOfAcceptedTransactionSets: parseInt(elements[4] || '0', 10),
      functionalGroupSyntaxErrorCode1: elements[5] || undefined,
      functionalGroupSyntaxErrorCode2: elements[6] || undefined,
      functionalGroupSyntaxErrorCode3: elements[7] || undefined,
      functionalGroupSyntaxErrorCode4: elements[8] || undefined,
      functionalGroupSyntaxErrorCode5: elements[9] || undefined,
    };
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get description for segment error code
 */
export function getSegmentErrorDescription(code: string): string {
  return SEGMENT_ERROR_CODES[code] || `Unknown segment error code: ${code}`;
}

/**
 * Get description for element error code
 */
export function getElementErrorDescription(code: string): string {
  return ELEMENT_ERROR_CODES[code] || `Unknown element error code: ${code}`;
}

/**
 * Get description for transaction acknowledgment code
 */
export function getTransactionAckDescription(code: string): string {
  return TRANSACTION_ACK_CODES[code] || `Unknown transaction acknowledgment code: ${code}`;
}

/**
 * Get description for group acknowledgment code
 */
export function getGroupAckDescription(code: string): string {
  return GROUP_ACK_CODES[code] || `Unknown group acknowledgment code: ${code}`;
}

/**
 * Get description for transaction syntax error code
 */
export function getTransactionSyntaxErrorDescription(code: string): string {
  return TRANSACTION_SYNTAX_ERROR_CODES[code] || `Unknown syntax error code: ${code}`;
}

/**
 * Check if acknowledgment indicates success
 */
export function isAccepted(code: AcknowledgmentStatusCode | TransactionAckCode): boolean {
  return code === 'A' || code === 'E';
}

/**
 * Check if acknowledgment indicates rejection
 */
export function isRejected(code: AcknowledgmentStatusCode | TransactionAckCode): boolean {
  return ['R', 'M', 'W', 'X'].includes(code);
}

/**
 * Format date from X12 format (YYMMDD or CCYYMMDD) to ISO
 */
export function formatX12Date(dateStr: string): string {
  if (!dateStr) return '';

  if (dateStr.length === 6) {
    // YYMMDD
    const year = parseInt(dateStr.substring(0, 2), 10);
    const fullYear = year > 50 ? 1900 + year : 2000 + year;
    return `${fullYear}-${dateStr.substring(2, 4)}-${dateStr.substring(4, 6)}`;
  } else if (dateStr.length === 8) {
    // CCYYMMDD
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
  }

  return dateStr;
}

/**
 * Format time from X12 format (HHMM or HHMMSS) to HH:MM:SS
 */
export function formatX12Time(timeStr: string): string {
  if (!timeStr) return '';

  if (timeStr.length >= 4) {
    const hours = timeStr.substring(0, 2);
    const minutes = timeStr.substring(2, 4);
    const seconds = timeStr.length >= 6 ? timeStr.substring(4, 6) : '00';
    return `${hours}:${minutes}:${seconds}`;
  }

  return timeStr;
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const x12997Parser = new X12997Parser();

export default x12997Parser;
