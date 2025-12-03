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
  HL7Segment,
  HL7Delimiters,
  HL7ParseError,
  HL7ParseResult,
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
  MSASegment,
  ERRSegment,
  GenericSegment,
  ADTMessage,
  ORUMessage,
  ORMMessage,
  ACKMessage,
  PatientIdentifier,
  HumanName,
  Address,
  ExtendedTelecom,
  CodedElement,
  ExtendedPerson,
  ExtendedOrganization,
  PatientLocation,
  FinancialClass,
  Quantity,
  SpecimenSource,
  HL7MessageType,
  ADTEventType,
  ORUEventType,
  OBXValueType,
} from '../../types/hl7v2';
import { auditLogger } from '../auditLogger';

// MLLP framing characters
const MLLP_START = '\x0B'; // Vertical Tab (VT)
const MLLP_END = '\x1C\x0D'; // File Separator + Carriage Return

/**
 * Core HL7 v2.x Parser
 */
export class HL7Parser {
  private delimiters: HL7Delimiters = DEFAULT_DELIMITERS;
  private parseErrors: HL7ParseError[] = [];

  /**
   * Parse a raw HL7 message string
   */
  parse(rawMessage: string): HL7ParseResult {
    this.parseErrors = [];

    try {
      // Remove MLLP framing if present
      const message = this.stripMLLPFraming(rawMessage);

      // Normalize line endings
      const normalizedMessage = this.normalizeLineEndings(message);

      // Split into segments
      const segmentStrings = normalizedMessage.split('\r').filter((s) => s.trim());

      if (segmentStrings.length === 0) {
        return {
          success: false,
          errors: [{ segmentIndex: 0, message: 'Empty message', severity: 'error' }],
          rawMessage,
        };
      }

      // First segment must be MSH
      if (!segmentStrings[0].startsWith('MSH')) {
        return {
          success: false,
          errors: [
            { segmentIndex: 0, message: 'Message must start with MSH segment', severity: 'error' },
          ],
          rawMessage,
        };
      }

      // Extract delimiters from MSH segment
      this.extractDelimiters(segmentStrings[0]);

      // Parse MSH segment first
      const mshSegment = this.parseMSHSegment(segmentStrings[0], 0);
      if (!mshSegment) {
        return {
          success: false,
          errors: this.parseErrors,
          rawMessage,
        };
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

      return {
        success: this.parseErrors.filter((e) => e.severity === 'error').length === 0,
        message: parsedMessage,
        errors: this.parseErrors,
        rawMessage,
      };
    } catch (error) {
      auditLogger.logSecurityEvent({
        eventType: 'HL7_PARSE_ERROR',
        severity: 'HIGH',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });

      return {
        success: false,
        errors: [
          {
            segmentIndex: 0,
            message: `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            severity: 'error',
          },
        ],
        rawMessage,
      };
    }
  }

  /**
   * Parse specifically as ADT message
   */
  parseADT(rawMessage: string): HL7ParseResult<ADTMessage> {
    const result = this.parse(rawMessage);
    if (!result.success || !result.message) {
      return result as HL7ParseResult<ADTMessage>;
    }

    if (result.message.header.messageType.messageCode !== 'ADT') {
      return {
        success: false,
        errors: [
          {
            segmentIndex: 0,
            message: `Expected ADT message, got ${result.message.header.messageType.messageCode}`,
            severity: 'error',
          },
        ],
        rawMessage,
      };
    }

    const adtMessage: ADTMessage = {
      ...result.message,
      messageType: 'ADT',
      eventType: result.message.header.messageType.triggerEvent as ADTEventType,
      patientIdentification: result.message.patientIdentification!,
      patientVisit: result.message.patientVisit!,
    };

    return {
      success: true,
      message: adtMessage,
      errors: result.errors,
      rawMessage,
    };
  }

  /**
   * Parse specifically as ORU message (lab results)
   */
  parseORU(rawMessage: string): HL7ParseResult<ORUMessage> {
    const result = this.parse(rawMessage);
    if (!result.success || !result.message) {
      return result as HL7ParseResult<ORUMessage>;
    }

    if (result.message.header.messageType.messageCode !== 'ORU') {
      return {
        success: false,
        errors: [
          {
            segmentIndex: 0,
            message: `Expected ORU message, got ${result.message.header.messageType.messageCode}`,
            severity: 'error',
          },
        ],
        rawMessage,
      };
    }

    // Group OBX segments under their parent OBR
    const observationResults: ORUMessage['observationResults'] = [];
    let currentOBR: OBRSegment | null = null;
    let currentOBXList: OBXSegment[] = [];
    let currentNTEList: NTESegment[] = [];

    for (const segment of result.message.segments) {
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
      ...result.message,
      messageType: 'ORU',
      eventType: result.message.header.messageType.triggerEvent as ORUEventType,
      patientIdentification: result.message.patientIdentification!,
      observationResults,
    };

    return {
      success: true,
      message: oruMessage,
      errors: result.errors,
      rawMessage,
    };
  }

  /**
   * Parse specifically as ORM message (orders)
   */
  parseORM(rawMessage: string): HL7ParseResult<ORMMessage> {
    const result = this.parse(rawMessage);
    if (!result.success || !result.message) {
      return result as HL7ParseResult<ORMMessage>;
    }

    if (result.message.header.messageType.messageCode !== 'ORM') {
      return {
        success: false,
        errors: [
          {
            segmentIndex: 0,
            message: `Expected ORM message, got ${result.message.header.messageType.messageCode}`,
            severity: 'error',
          },
        ],
        rawMessage,
      };
    }

    // Group order segments
    const orders: ORMMessage['orders'] = [];
    let currentORC: ORCSegment | null = null;
    let currentOBR: OBRSegment | undefined;
    let currentOBXList: OBXSegment[] = [];

    for (const segment of result.message.segments) {
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
      ...result.message,
      messageType: 'ORM',
      eventType: result.message.header.messageType.triggerEvent as 'O01' | 'O02',
      patientIdentification: result.message.patientIdentification,
      orders,
    };

    return {
      success: true,
      message: ormMessage,
      errors: result.errors,
      rawMessage,
    };
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

    switch (segmentType) {
      case 'MSH':
        return this.parseMSHSegment(segmentString, index);
      case 'PID':
        return this.parsePIDSegment(segmentString, index);
      case 'PV1':
        return this.parsePV1Segment(segmentString, index);
      case 'PV2':
        return this.parsePV2Segment(segmentString, index);
      case 'OBR':
        return this.parseOBRSegment(segmentString, index);
      case 'OBX':
        return this.parseOBXSegment(segmentString, index);
      case 'ORC':
        return this.parseORCSegment(segmentString, index);
      case 'DG1':
        return this.parseDG1Segment(segmentString, index);
      case 'AL1':
        return this.parseAL1Segment(segmentString, index);
      case 'IN1':
        return this.parseIN1Segment(segmentString, index);
      case 'NTE':
        return this.parseNTESegment(segmentString, index);
      case 'MSA':
        return this.parseMSASegment(segmentString, index);
      case 'ERR':
        return this.parseERRSegment(segmentString, index);
      default:
        return this.parseGenericSegment(segmentString, index);
    }
  }

  private parseMSHSegment(segmentString: string, index: number): MSHSegment | null {
    // MSH is special - field separator IS field 1
    const fields = segmentString.split(this.delimiters.field);

    const messageTypeField = fields[8] || '';
    const messageTypeParts = messageTypeField.split(this.delimiters.component);

    return {
      segmentType: 'MSH',
      fieldSeparator: this.delimiters.field,
      encodingCharacters: fields[1] || '^~\\&',
      sendingApplication: fields[2] || '',
      sendingFacility: fields[3] || '',
      receivingApplication: fields[4] || '',
      receivingFacility: fields[5] || '',
      dateTimeOfMessage: fields[6] || '',
      security: fields[7] || undefined,
      messageType: {
        messageCode: (messageTypeParts[0] || 'UNK') as HL7MessageType,
        triggerEvent: messageTypeParts[1] || '',
        messageStructure: messageTypeParts[2],
      },
      messageControlId: fields[9] || '',
      processingId: (fields[10] || 'P') as 'P' | 'T' | 'D',
      versionId: fields[11] || '2.5.1',
      sequenceNumber: fields[12] ? parseInt(fields[12], 10) : undefined,
      continuationPointer: fields[13] || undefined,
      acceptAckType: fields[14] || undefined,
      applicationAckType: fields[15] || undefined,
      countryCode: fields[16] || undefined,
      characterSet: fields[17] ? fields[17].split(this.delimiters.repetition) : undefined,
      principalLanguage: fields[18] || undefined,
      alternateCharacterSet: fields[19] || undefined,
      messageProfileId: fields[20] ? fields[20].split(this.delimiters.repetition) : undefined,
    };
  }

  private parsePIDSegment(segmentString: string, index: number): PIDSegment {
    const fields = this.splitFields(segmentString);

    return {
      segmentType: 'PID',
      setId: fields[1] ? parseInt(fields[1], 10) : undefined,
      patientId: fields[2] || undefined,
      patientIdentifierList: this.parsePatientIdentifiers(fields[3]),
      alternatePatientId: fields[4] || undefined,
      patientName: this.parseHumanNames(fields[5]),
      mothersMaidenName: fields[6] ? this.parseHumanName(fields[6]) : undefined,
      dateOfBirth: fields[7] || undefined,
      administrativeSex: fields[8] as PIDSegment['administrativeSex'],
      patientAlias: fields[9] ? this.parseHumanNames(fields[9]) : undefined,
      race: fields[10] ? this.parseCodedElements(fields[10]) : undefined,
      patientAddress: fields[11] ? this.parseAddresses(fields[11]) : undefined,
      countyCode: fields[12] || undefined,
      homePhone: fields[13] ? this.parseExtendedTelecoms(fields[13]) : undefined,
      businessPhone: fields[14] ? this.parseExtendedTelecoms(fields[14]) : undefined,
      primaryLanguage: fields[15] ? this.parseCodedElement(fields[15]) : undefined,
      maritalStatus: fields[16] ? this.parseCodedElement(fields[16]) : undefined,
      religion: fields[17] ? this.parseCodedElement(fields[17]) : undefined,
      patientAccountNumber: fields[18] || undefined,
      ssn: fields[19] || undefined, // PHI - handle carefully
      driversLicense: fields[20] || undefined,
      mothersIdentifier: fields[21] ? this.parsePatientIdentifier(fields[21]) : undefined,
      ethnicGroup: fields[22] ? this.parseCodedElements(fields[22]) : undefined,
      birthPlace: fields[23] || undefined,
      multipleBirthIndicator: fields[24] as 'Y' | 'N' | undefined,
      birthOrder: fields[25] ? parseInt(fields[25], 10) : undefined,
      citizenship: fields[26] ? this.parseCodedElements(fields[26]) : undefined,
      veteransMilitaryStatus: fields[27] ? this.parseCodedElement(fields[27]) : undefined,
      nationality: fields[28] ? this.parseCodedElement(fields[28]) : undefined,
      patientDeathDateTime: fields[29] || undefined,
      patientDeathIndicator: fields[30] as 'Y' | 'N' | undefined,
      identityUnknownIndicator: fields[31] as 'Y' | 'N' | undefined,
      identityReliabilityCode: fields[32]
        ? fields[32].split(this.delimiters.repetition)
        : undefined,
      lastUpdateDateTime: fields[33] || undefined,
      lastUpdateFacility: fields[34] || undefined,
      taxonomicClassificationCode: fields[35] ? this.parseCodedElement(fields[35]) : undefined,
      breedCode: fields[36] ? this.parseCodedElement(fields[36]) : undefined,
      strain: fields[37] || undefined,
      productionClassCode: fields[38] ? this.parseCodedElements(fields[38]) : undefined,
      tribalCitizenship: fields[39] ? this.parseCodedElements(fields[39]) : undefined,
      patientTelecommunication: fields[40] ? this.parseExtendedTelecoms(fields[40]) : undefined,
    };
  }

  private parsePV1Segment(segmentString: string, index: number): PV1Segment {
    const fields = this.splitFields(segmentString);

    return {
      segmentType: 'PV1',
      setId: fields[1] ? parseInt(fields[1], 10) : undefined,
      patientClass: (fields[2] || 'U') as PV1Segment['patientClass'],
      assignedPatientLocation: fields[3] ? this.parsePatientLocation(fields[3]) : undefined,
      admissionType: fields[4] || undefined,
      preadmitNumber: fields[5] || undefined,
      priorPatientLocation: fields[6] ? this.parsePatientLocation(fields[6]) : undefined,
      attendingDoctor: fields[7] ? this.parseExtendedPersons(fields[7]) : undefined,
      referringDoctor: fields[8] ? this.parseExtendedPersons(fields[8]) : undefined,
      consultingDoctor: fields[9] ? this.parseExtendedPersons(fields[9]) : undefined,
      hospitalService: fields[10] || undefined,
      temporaryLocation: fields[11] ? this.parsePatientLocation(fields[11]) : undefined,
      preadmitTestIndicator: fields[12] || undefined,
      readmissionIndicator: fields[13] || undefined,
      admitSource: fields[14] || undefined,
      ambulatoryStatus: fields[15] ? fields[15].split(this.delimiters.repetition) : undefined,
      vipIndicator: fields[16] || undefined,
      admittingDoctor: fields[17] ? this.parseExtendedPersons(fields[17]) : undefined,
      patientType: fields[18] || undefined,
      visitNumber: fields[19] || undefined,
      financialClass: fields[20] ? this.parseFinancialClasses(fields[20]) : undefined,
      chargePriceIndicator: fields[21] || undefined,
      courtesyCode: fields[22] || undefined,
      creditRating: fields[23] || undefined,
      contractCode: fields[24] ? fields[24].split(this.delimiters.repetition) : undefined,
      contractEffectiveDate: fields[25] ? fields[25].split(this.delimiters.repetition) : undefined,
      contractAmount: fields[26]
        ? fields[26].split(this.delimiters.repetition).map((v) => parseFloat(v))
        : undefined,
      contractPeriod: fields[27]
        ? fields[27].split(this.delimiters.repetition).map((v) => parseInt(v, 10))
        : undefined,
      interestCode: fields[28] || undefined,
      transferToBadDebtCode: fields[29] || undefined,
      transferToBadDebtDate: fields[30] || undefined,
      badDebtAgencyCode: fields[31] || undefined,
      badDebtTransferAmount: fields[32] ? parseFloat(fields[32]) : undefined,
      badDebtRecoveryAmount: fields[33] ? parseFloat(fields[33]) : undefined,
      deleteAccountIndicator: fields[34] || undefined,
      deleteAccountDate: fields[35] || undefined,
      dischargeDisposition: fields[36] || undefined,
      dischargeToLocation: fields[37]
        ? {
            dischargeToLocation: this.getComponent(fields[37], 0),
            effectiveDate: this.getComponent(fields[37], 1),
          }
        : undefined,
      dietType: fields[38] ? this.parseCodedElement(fields[38]) : undefined,
      servicingFacility: fields[39] || undefined,
      bedStatus: fields[40] as PV1Segment['bedStatus'],
      accountStatus: fields[41] || undefined,
      pendingLocation: fields[42] ? this.parsePatientLocation(fields[42]) : undefined,
      priorTemporaryLocation: fields[43] ? this.parsePatientLocation(fields[43]) : undefined,
      admitDateTime: fields[44] || undefined,
      dischargeDateTime: fields[45] || undefined,
      currentPatientBalance: fields[46] ? parseFloat(fields[46]) : undefined,
      totalCharges: fields[47] ? parseFloat(fields[47]) : undefined,
      totalAdjustments: fields[48] ? parseFloat(fields[48]) : undefined,
      totalPayments: fields[49] ? parseFloat(fields[49]) : undefined,
      alternateVisitId: fields[50] || undefined,
      visitIndicator: fields[51] as 'A' | 'V' | undefined,
      otherHealthcareProvider: fields[52] ? this.parseExtendedPersons(fields[52]) : undefined,
    };
  }

  private parsePV2Segment(segmentString: string, index: number): PV2Segment {
    const fields = this.splitFields(segmentString);

    return {
      segmentType: 'PV2',
      priorPendingLocation: fields[1] ? this.parsePatientLocation(fields[1]) : undefined,
      accommodationCode: fields[2] ? this.parseCodedElement(fields[2]) : undefined,
      admitReason: fields[3] ? this.parseCodedElement(fields[3]) : undefined,
      transferReason: fields[4] ? this.parseCodedElement(fields[4]) : undefined,
      patientValuables: fields[5] ? fields[5].split(this.delimiters.repetition) : undefined,
      patientValuablesLocation: fields[6] || undefined,
      visitUserCode: fields[7] ? fields[7].split(this.delimiters.repetition) : undefined,
      expectedAdmitDateTime: fields[8] || undefined,
      expectedDischargeDateTime: fields[9] || undefined,
      estimatedLengthOfStay: fields[10] ? parseInt(fields[10], 10) : undefined,
      actualLengthOfStay: fields[11] ? parseInt(fields[11], 10) : undefined,
      visitDescription: fields[12] || undefined,
      referralSourceCode: fields[13] ? this.parseExtendedPersons(fields[13]) : undefined,
      previousServiceDate: fields[14] || undefined,
      employmentIllnessRelated: fields[15] as 'Y' | 'N' | 'U' | undefined,
      purgeStatusCode: fields[16] || undefined,
      purgeStatusDate: fields[17] || undefined,
      specialProgramCode: fields[18] || undefined,
      retentionIndicator: fields[19] as 'Y' | 'N' | undefined,
      expectedNumberOfInsurancePlans: fields[20] ? parseInt(fields[20], 10) : undefined,
      visitPublicityCode: fields[21] || undefined,
      visitProtectionIndicator: fields[22] as 'Y' | 'N' | undefined,
      clinicOrganizationName: fields[23] ? this.parseExtendedOrganizations(fields[23]) : undefined,
      patientStatusCode: fields[24] || undefined,
      visitPriorityCode: fields[25] || undefined,
      previousTreatmentDate: fields[26] || undefined,
      expectedDischargeDisposition: fields[27] || undefined,
      signatureOnFileDate: fields[28] || undefined,
      firstSimilarIllnessDate: fields[29] || undefined,
      patientChargeAdjustmentCode: fields[30] ? this.parseCodedElement(fields[30]) : undefined,
      recurringServiceCode: fields[31] || undefined,
      billingMediaCode: fields[32] as 'Y' | 'N' | undefined,
      expectedSurgeryDateTime: fields[33] || undefined,
      militaryPartnershipCode: fields[34] as 'Y' | 'N' | undefined,
      militaryNonAvailabilityCode: fields[35] as 'Y' | 'N' | undefined,
      newbornBabyIndicator: fields[36] as 'Y' | 'N' | undefined,
      babyDetainedIndicator: fields[37] as 'Y' | 'N' | undefined,
      modeOfArrivalCode: fields[38] ? this.parseCodedElement(fields[38]) : undefined,
      recreationalDrugUseCode: fields[39] ? this.parseCodedElements(fields[39]) : undefined,
      admissionLevelOfCareCode: fields[40] ? this.parseCodedElement(fields[40]) : undefined,
      precautionCode: fields[41] ? this.parseCodedElements(fields[41]) : undefined,
      patientConditionCode: fields[42] ? this.parseCodedElement(fields[42]) : undefined,
      livingWillCode: fields[43] as 'Y' | 'N' | 'U' | 'F' | 'I' | undefined,
      organDonorCode: fields[44] as 'Y' | 'N' | 'U' | 'F' | 'I' | 'P' | 'R' | undefined,
      advanceDirectiveCode: fields[45] ? this.parseCodedElements(fields[45]) : undefined,
      patientStatusEffectiveDate: fields[46] || undefined,
      expectedLoaReturnDateTime: fields[47] || undefined,
      expectedPreadmitTestDateTime: fields[48] || undefined,
      notifyClergyCode: fields[49] ? fields[49].split(this.delimiters.repetition) : undefined,
    };
  }

  private parseOBRSegment(segmentString: string, index: number): OBRSegment {
    const fields = this.splitFields(segmentString);

    return {
      segmentType: 'OBR',
      setId: fields[1] ? parseInt(fields[1], 10) : undefined,
      placerOrderNumber: fields[2] || undefined,
      fillerOrderNumber: fields[3] || undefined,
      universalServiceIdentifier: this.parseCodedElement(fields[4]) || {
        identifier: '',
        text: 'Unknown',
      },
      priority: fields[5] || undefined,
      requestedDateTime: fields[6] || undefined,
      observationDateTime: fields[7] || undefined,
      observationEndDateTime: fields[8] || undefined,
      collectionVolume: fields[9] ? this.parseQuantity(fields[9]) : undefined,
      collectorIdentifier: fields[10] ? this.parseExtendedPersons(fields[10]) : undefined,
      specimenActionCode: fields[11] || undefined,
      dangerCode: fields[12] ? this.parseCodedElement(fields[12]) : undefined,
      relevantClinicalInfo: fields[13] || undefined,
      specimenReceivedDateTime: fields[14] || undefined,
      specimenSource: fields[15] ? this.parseSpecimenSource(fields[15]) : undefined,
      orderingProvider: fields[16] ? this.parseExtendedPersons(fields[16]) : undefined,
      orderCallbackPhone: fields[17] ? this.parseExtendedTelecoms(fields[17]) : undefined,
      placerField1: fields[18] || undefined,
      placerField2: fields[19] || undefined,
      fillerField1: fields[20] || undefined,
      fillerField2: fields[21] || undefined,
      resultsReportStatusChangeDateTime: fields[22] || undefined,
      chargeToPractice: fields[23] || undefined,
      diagnosticServiceSectionId: fields[24] || undefined,
      resultStatus: fields[25] as OBRSegment['resultStatus'],
      parentResult: fields[26]
        ? {
            parentObservationIdentifier: this.parseCodedElement(
              this.getComponent(fields[26], 0) || ''
            ),
            parentObservationSubIdentifier: this.getComponent(fields[26], 1),
            parentObservationValueDescriptor: this.getComponent(fields[26], 2),
          }
        : undefined,
      quantityTiming: fields[27] ? fields[27].split(this.delimiters.repetition) : undefined,
      resultCopiesTo: fields[28] ? this.parseExtendedPersons(fields[28]) : undefined,
      parent: fields[29]
        ? {
            placerAssignedIdentifier: this.getComponent(fields[29], 0),
            fillerAssignedIdentifier: this.getComponent(fields[29], 1),
          }
        : undefined,
      transportationMode: fields[30] || undefined,
      reasonForStudy: fields[31] ? this.parseCodedElements(fields[31]) : undefined,
      principalResultInterpreter: fields[32] ? this.parseExtendedPerson(fields[32]) : undefined,
      assistantResultInterpreter: fields[33] ? this.parseExtendedPersons(fields[33]) : undefined,
      technician: fields[34] ? this.parseExtendedPersons(fields[34]) : undefined,
      transcriptionist: fields[35] ? this.parseExtendedPersons(fields[35]) : undefined,
      scheduledDateTime: fields[36] || undefined,
      numberOfSampleContainers: fields[37] ? parseInt(fields[37], 10) : undefined,
      transportLogisticsOfCollectedSample: fields[38]
        ? this.parseCodedElements(fields[38])
        : undefined,
      collectorsComment: fields[39] ? this.parseCodedElements(fields[39]) : undefined,
      transportArrangementResponsibility: fields[40]
        ? this.parseCodedElement(fields[40])
        : undefined,
      transportArranged: fields[41] as 'A' | 'N' | 'U' | undefined,
      escortRequired: fields[42] as 'Y' | 'N' | 'U' | undefined,
      plannedPatientTransportComment: fields[43] ? this.parseCodedElements(fields[43]) : undefined,
      procedureCode: fields[44] ? this.parseCodedElement(fields[44]) : undefined,
      procedureCodeModifier: fields[45] ? this.parseCodedElements(fields[45]) : undefined,
      placerSupplementalServiceInfo: fields[46] ? this.parseCodedElements(fields[46]) : undefined,
      fillerSupplementalServiceInfo: fields[47] ? this.parseCodedElements(fields[47]) : undefined,
      medicallyNecessaryDuplicateProcedureReason: fields[48]
        ? this.parseCodedElement(fields[48])
        : undefined,
      resultHandling: fields[49] || undefined,
      parentUniversalServiceIdentifier: fields[50]
        ? this.parseCodedElement(fields[50])
        : undefined,
    };
  }

  private parseOBXSegment(segmentString: string, index: number): OBXSegment {
    const fields = this.splitFields(segmentString);

    return {
      segmentType: 'OBX',
      setId: fields[1] ? parseInt(fields[1], 10) : undefined,
      valueType: fields[2] as OBXValueType,
      observationIdentifier: this.parseCodedElement(fields[3]) || {
        identifier: '',
        text: 'Unknown',
      },
      observationSubId: fields[4] || undefined,
      observationValue: fields[5] ? fields[5].split(this.delimiters.repetition) : undefined,
      units: fields[6] ? this.parseCodedElement(fields[6]) : undefined,
      referenceRange: fields[7] || undefined,
      abnormalFlags: fields[8] ? fields[8].split(this.delimiters.repetition) : undefined,
      probability: fields[9] ? parseFloat(fields[9]) : undefined,
      natureOfAbnormalTest: fields[10] ? fields[10].split(this.delimiters.repetition) : undefined,
      observationResultStatus: (fields[11] || 'F') as OBXSegment['observationResultStatus'],
      effectiveDateOfReferenceRange: fields[12] || undefined,
      userDefinedAccessChecks: fields[13] || undefined,
      dateTimeOfObservation: fields[14] || undefined,
      producersId: fields[15] ? this.parseCodedElement(fields[15]) : undefined,
      responsibleObserver: fields[16] ? this.parseExtendedPersons(fields[16]) : undefined,
      observationMethod: fields[17] ? this.parseCodedElements(fields[17]) : undefined,
      equipmentInstanceIdentifier: fields[18]
        ? fields[18].split(this.delimiters.repetition)
        : undefined,
      dateTimeOfAnalysis: fields[19] || undefined,
      observationSite: fields[20] ? this.parseCodedElements(fields[20]) : undefined,
      observationInstanceIdentifier: fields[21] || undefined,
      moodCode: fields[22] as OBXSegment['moodCode'],
      performingOrganizationName: fields[23]
        ? this.parseExtendedOrganization(fields[23])
        : undefined,
      performingOrganizationAddress: fields[24] ? this.parseAddress(fields[24]) : undefined,
      performingOrganizationMedicalDirector: fields[25]
        ? this.parseExtendedPerson(fields[25])
        : undefined,
    };
  }

  private parseORCSegment(segmentString: string, index: number): ORCSegment {
    const fields = this.splitFields(segmentString);

    return {
      segmentType: 'ORC',
      orderControl: fields[1] || '',
      placerOrderNumber: fields[2] || undefined,
      fillerOrderNumber: fields[3] || undefined,
      placerGroupNumber: fields[4] || undefined,
      orderStatus: fields[5] as ORCSegment['orderStatus'],
      responseFlag: fields[6] as ORCSegment['responseFlag'],
      quantityTiming: fields[7] ? fields[7].split(this.delimiters.repetition) : undefined,
      parent: fields[8]
        ? {
            placerAssignedIdentifier: this.getComponent(fields[8], 0),
            fillerAssignedIdentifier: this.getComponent(fields[8], 1),
          }
        : undefined,
      dateTimeOfTransaction: fields[9] || undefined,
      enteredBy: fields[10] ? this.parseExtendedPersons(fields[10]) : undefined,
      verifiedBy: fields[11] ? this.parseExtendedPersons(fields[11]) : undefined,
      orderingProvider: fields[12] ? this.parseExtendedPersons(fields[12]) : undefined,
      enterersLocation: fields[13] ? this.parsePatientLocation(fields[13]) : undefined,
      callBackPhoneNumber: fields[14] ? this.parseExtendedTelecoms(fields[14]) : undefined,
      orderEffectiveDateTime: fields[15] || undefined,
      orderControlCodeReason: fields[16] ? this.parseCodedElement(fields[16]) : undefined,
      enteringOrganization: fields[17] ? this.parseCodedElement(fields[17]) : undefined,
      enteringDevice: fields[18] ? this.parseCodedElement(fields[18]) : undefined,
      actionBy: fields[19] ? this.parseExtendedPersons(fields[19]) : undefined,
      advancedBeneficiaryNoticeCode: fields[20] ? this.parseCodedElement(fields[20]) : undefined,
      orderingFacilityName: fields[21] ? this.parseExtendedOrganizations(fields[21]) : undefined,
      orderingFacilityAddress: fields[22] ? this.parseAddresses(fields[22]) : undefined,
      orderingFacilityPhoneNumber: fields[23] ? this.parseExtendedTelecoms(fields[23]) : undefined,
      orderingProviderAddress: fields[24] ? this.parseAddresses(fields[24]) : undefined,
      orderStatusModifier: fields[25] ? this.parseCodedElement(fields[25]) : undefined,
      advancedBeneficiaryNoticeOverrideReason: fields[26]
        ? this.parseCodedElement(fields[26])
        : undefined,
      fillersExpectedAvailabilityDateTime: fields[27] || undefined,
      confidentialityCode: fields[28] ? this.parseCodedElement(fields[28]) : undefined,
      orderType: fields[29] ? this.parseCodedElement(fields[29]) : undefined,
      entererAuthorizationMode: fields[30] ? this.parseCodedElement(fields[30]) : undefined,
      parentUniversalServiceIdentifier: fields[31]
        ? this.parseCodedElement(fields[31])
        : undefined,
    };
  }

  private parseDG1Segment(segmentString: string, index: number): DG1Segment {
    const fields = this.splitFields(segmentString);

    return {
      segmentType: 'DG1',
      setId: parseInt(fields[1] || '1', 10),
      diagnosisCodingMethod: fields[2] || undefined,
      diagnosisCode: fields[3] ? this.parseCodedElement(fields[3]) : undefined,
      diagnosisDescription: fields[4] || undefined,
      diagnosisDateTime: fields[5] || undefined,
      diagnosisType: fields[6] || '',
      majorDiagnosticCategory: fields[7] ? this.parseCodedElement(fields[7]) : undefined,
      diagnosticRelatedGroup: fields[8] ? this.parseCodedElement(fields[8]) : undefined,
      drgApprovalIndicator: fields[9] as 'Y' | 'N' | undefined,
      drgGrouperReviewCode: fields[10] || undefined,
      outlierType: fields[11] ? this.parseCodedElement(fields[11]) : undefined,
      outlierDays: fields[12] ? parseInt(fields[12], 10) : undefined,
      outlierCost: fields[13] ? parseFloat(fields[13]) : undefined,
      grouperVersionAndType: fields[14] || undefined,
      diagnosisPriority: fields[15] ? parseInt(fields[15], 10) : undefined,
      diagnosingClinician: fields[16] ? this.parseExtendedPersons(fields[16]) : undefined,
      diagnosisClassification: fields[17] || undefined,
      confidentialIndicator: fields[18] as 'Y' | 'N' | undefined,
      attestationDateTime: fields[19] || undefined,
      diagnosisIdentifier: fields[20] || undefined,
      diagnosisActionCode: fields[21] as 'A' | 'D' | 'U' | undefined,
      parentDiagnosis: fields[22] || undefined,
      drgCclValueCode: fields[23] ? this.parseCodedElement(fields[23]) : undefined,
      drgGroupingUsage: fields[24] || undefined,
      drgDiagnosisDeterminationStatus: fields[25]
        ? this.parseCodedElement(fields[25])
        : undefined,
      presentOnAdmissionIndicator: fields[26] || undefined,
    };
  }

  private parseAL1Segment(segmentString: string, index: number): AL1Segment {
    const fields = this.splitFields(segmentString);

    return {
      segmentType: 'AL1',
      setId: parseInt(fields[1] || '1', 10),
      allergenTypeCode: fields[2] ? this.parseCodedElement(fields[2]) : undefined,
      allergenCode: this.parseCodedElement(fields[3]) || { identifier: '', text: 'Unknown' },
      allergySeverityCode: fields[4] || undefined,
      allergyReaction: fields[5] ? fields[5].split(this.delimiters.repetition) : undefined,
      identificationDate: fields[6] || undefined,
    };
  }

  private parseIN1Segment(segmentString: string, index: number): IN1Segment {
    const fields = this.splitFields(segmentString);

    return {
      segmentType: 'IN1',
      setId: parseInt(fields[1] || '1', 10),
      insurancePlanId: fields[2] ? this.parseCodedElement(fields[2]) : undefined,
      insuranceCompanyId: fields[3] ? fields[3].split(this.delimiters.repetition) : undefined,
      insuranceCompanyName: fields[4] ? this.parseExtendedOrganizations(fields[4]) : undefined,
      insuranceCompanyAddress: fields[5] ? this.parseAddresses(fields[5]) : undefined,
      insuranceCompanyContactPerson: fields[6] ? this.parseExtendedPersons(fields[6]) : undefined,
      insuranceCompanyPhoneNumber: fields[7] ? this.parseExtendedTelecoms(fields[7]) : undefined,
      groupNumber: fields[8] || undefined,
      groupName: fields[9] ? this.parseExtendedOrganizations(fields[9]) : undefined,
      insuredGroupEmployerId: fields[10]
        ? fields[10].split(this.delimiters.repetition)
        : undefined,
      insuredGroupEmployerName: fields[11]
        ? this.parseExtendedOrganizations(fields[11])
        : undefined,
      planEffectiveDate: fields[12] || undefined,
      planExpirationDate: fields[13] || undefined,
      authorizationInformation: fields[14] || undefined,
      planType: fields[15] || undefined,
      nameOfInsured: fields[16] ? this.parseExtendedPersons(fields[16]) : undefined,
      insuredRelationshipToPatient: fields[17] ? this.parseCodedElement(fields[17]) : undefined,
      insuredDateOfBirth: fields[18] || undefined,
      insuredAddress: fields[19] ? this.parseAddresses(fields[19]) : undefined,
      assignmentOfBenefits: fields[20] || undefined,
      coordinationOfBenefits: fields[21] || undefined,
      coordinationOfBenefitsPriority: fields[22] || undefined,
      noticeOfAdmissionFlag: fields[23] as 'Y' | 'N' | undefined,
      noticeOfAdmissionDate: fields[24] || undefined,
      reportOfEligibilityFlag: fields[25] as 'Y' | 'N' | undefined,
      reportOfEligibilityDate: fields[26] || undefined,
      releaseInformationCode: fields[27] || undefined,
      preAdmitCertification: fields[28] || undefined,
      verificationDateTime: fields[29] || undefined,
      verificationBy: fields[30] ? this.parseExtendedPersons(fields[30]) : undefined,
      typeOfAgreementCode: fields[31] || undefined,
      billingStatus: fields[32] || undefined,
      lifetimeReserveDays: fields[33] ? parseInt(fields[33], 10) : undefined,
      delayBeforeLifetimeReserveDays: fields[34] ? parseInt(fields[34], 10) : undefined,
      companyPlanCode: fields[35] || undefined,
      policyNumber: fields[36] || undefined,
      policyDeductible: fields[37] ? parseFloat(fields[37]) : undefined,
      policyLimitAmount: fields[38] ? parseFloat(fields[38]) : undefined,
      policyLimitDays: fields[39] ? parseInt(fields[39], 10) : undefined,
      roomRateSemiPrivate: fields[40] ? parseFloat(fields[40]) : undefined,
      roomRatePrivate: fields[41] ? parseFloat(fields[41]) : undefined,
      insuredEmploymentStatus: fields[42] ? this.parseCodedElement(fields[42]) : undefined,
      insuredAdministrativeSex: fields[43] as 'M' | 'F' | 'O' | 'U' | undefined,
      insuredEmployerAddress: fields[44] ? this.parseAddresses(fields[44]) : undefined,
      verificationStatus: fields[45] || undefined,
      priorInsurancePlanId: fields[46] || undefined,
      coverageType: fields[47] || undefined,
      handicap: fields[48] || undefined,
      insuredIdNumber: fields[49] ? fields[49].split(this.delimiters.repetition) : undefined,
      signatureCode: fields[50] || undefined,
      signatureCodeDate: fields[51] || undefined,
      insuredBirthPlace: fields[52] || undefined,
      vipIndicator: fields[53] || undefined,
    };
  }

  private parseNTESegment(segmentString: string, index: number): NTESegment {
    const fields = this.splitFields(segmentString);

    return {
      segmentType: 'NTE',
      setId: fields[1] ? parseInt(fields[1], 10) : undefined,
      sourceOfComment: fields[2] || undefined,
      comment: fields[3] ? fields[3].split(this.delimiters.repetition) : undefined,
      commentType: fields[4] ? this.parseCodedElement(fields[4]) : undefined,
      enteredBy: fields[5] ? this.parseExtendedPerson(fields[5]) : undefined,
      enteredDateTime: fields[6] || undefined,
      effectiveStartDate: fields[7] || undefined,
      expirationDate: fields[8] || undefined,
    };
  }

  private parseMSASegment(segmentString: string, index: number): MSASegment {
    const fields = this.splitFields(segmentString);

    return {
      segmentType: 'MSA',
      acknowledgmentCode: (fields[1] || 'AA') as MSASegment['acknowledgmentCode'],
      messageControlId: fields[2] || '',
      textMessage: fields[3] || undefined,
      expectedSequenceNumber: fields[4] ? parseInt(fields[4], 10) : undefined,
      delayedAcknowledgmentType: fields[5] || undefined,
      errorCondition: fields[6] ? this.parseCodedElement(fields[6]) : undefined,
    };
  }

  private parseERRSegment(segmentString: string, index: number): ERRSegment {
    const fields = this.splitFields(segmentString);

    return {
      segmentType: 'ERR',
      errorCodeAndLocation: fields[1] || undefined,
      errorLocation: fields[2] ? this.parseErrorLocations(fields[2]) : undefined,
      hl7ErrorCode: this.parseCodedElement(fields[3]) || { identifier: '0', text: 'Unknown' },
      severity: (fields[4] || 'E') as 'E' | 'I' | 'W',
      applicationErrorCode: fields[5] ? this.parseCodedElement(fields[5]) : undefined,
      applicationErrorParameter: fields[6]
        ? fields[6].split(this.delimiters.repetition)
        : undefined,
      diagnosticInformation: fields[7] || undefined,
      userMessage: fields[8] || undefined,
      informPersonIndicator: fields[9] ? fields[9].split(this.delimiters.repetition) : undefined,
      overrideType: fields[10] ? this.parseCodedElement(fields[10]) : undefined,
      overrideReasonCode: fields[11] ? this.parseCodedElements(fields[11]) : undefined,
      helpDeskContactPoint: fields[12] ? this.parseExtendedTelecoms(fields[12]) : undefined,
    };
  }

  private parseGenericSegment(segmentString: string, index: number): GenericSegment {
    const fields = this.splitFields(segmentString);

    return {
      segmentType: fields[0] || 'UNK',
      fields: fields.slice(1),
    };
  }

  // ============================================================================
  // COMPONENT PARSERS
  // ============================================================================

  private splitFields(segmentString: string): string[] {
    return segmentString.split(this.delimiters.field);
  }

  private getComponent(field: string, index: number): string | undefined {
    const components = field.split(this.delimiters.component);
    return components[index] || undefined;
  }

  private parsePatientIdentifier(field: string): PatientIdentifier {
    const components = field.split(this.delimiters.component);
    return {
      id: components[0] || '',
      checkDigit: components[1] || undefined,
      checkDigitScheme: components[2] || undefined,
      assigningAuthority: components[3] || undefined,
      identifierTypeCode: components[4] || undefined,
      assigningFacility: components[5] || undefined,
      effectiveDate: components[6] || undefined,
      expirationDate: components[7] || undefined,
    };
  }

  private parsePatientIdentifiers(field: string | undefined): PatientIdentifier[] {
    if (!field) return [];
    const repetitions = field.split(this.delimiters.repetition);
    return repetitions.map((r) => this.parsePatientIdentifier(r));
  }

  private parseHumanName(field: string): HumanName {
    const components = field.split(this.delimiters.component);
    return {
      familyName: components[0] || undefined,
      givenName: components[1] || undefined,
      middleInitialOrName: components[2] || undefined,
      suffix: components[3] || undefined,
      prefix: components[4] || undefined,
      degree: components[5] || undefined,
      nameTypeCode: components[6] as HumanName['nameTypeCode'],
      nameRepresentationCode: components[7] || undefined,
    };
  }

  private parseHumanNames(field: string | undefined): HumanName[] {
    if (!field) return [];
    const repetitions = field.split(this.delimiters.repetition);
    return repetitions.map((r) => this.parseHumanName(r));
  }

  private parseAddress(field: string): Address {
    const components = field.split(this.delimiters.component);
    return {
      streetAddress: components[0] || undefined,
      otherDesignation: components[1] || undefined,
      city: components[2] || undefined,
      stateOrProvince: components[3] || undefined,
      zipOrPostalCode: components[4] || undefined,
      country: components[5] || undefined,
      addressType: components[6] as Address['addressType'],
      otherGeographicDesignation: components[7] || undefined,
      countyParishCode: components[8] || undefined,
      censusTract: components[9] || undefined,
    };
  }

  private parseAddresses(field: string | undefined): Address[] {
    if (!field) return [];
    const repetitions = field.split(this.delimiters.repetition);
    return repetitions.map((r) => this.parseAddress(r));
  }

  private parseExtendedTelecom(field: string): ExtendedTelecom {
    const components = field.split(this.delimiters.component);
    return {
      telephoneNumber: components[0] || undefined,
      telecommunicationUseCode: components[1] as ExtendedTelecom['telecommunicationUseCode'],
      telecommunicationEquipmentType:
        components[2] as ExtendedTelecom['telecommunicationEquipmentType'],
      communicationAddress: components[3] || undefined,
      countryCode: components[4] ? parseInt(components[4], 10) : undefined,
      areaCityCode: components[5] ? parseInt(components[5], 10) : undefined,
      localNumber: components[6] ? parseInt(components[6], 10) : undefined,
      extension: components[7] ? parseInt(components[7], 10) : undefined,
      anyText: components[8] || undefined,
    };
  }

  private parseExtendedTelecoms(field: string | undefined): ExtendedTelecom[] {
    if (!field) return [];
    const repetitions = field.split(this.delimiters.repetition);
    return repetitions.map((r) => this.parseExtendedTelecom(r));
  }

  private parseCodedElement(field: string | undefined): CodedElement | undefined {
    if (!field) return undefined;
    const components = field.split(this.delimiters.component);
    return {
      identifier: components[0] || undefined,
      text: components[1] || undefined,
      nameOfCodingSystem: components[2] || undefined,
      alternateIdentifier: components[3] || undefined,
      alternateText: components[4] || undefined,
      nameOfAlternateCodingSystem: components[5] || undefined,
      codingSystemVersionId: components[6] || undefined,
      alternateCodingSystemVersionId: components[7] || undefined,
      originalText: components[8] || undefined,
    };
  }

  private parseCodedElements(field: string | undefined): CodedElement[] {
    if (!field) return [];
    const repetitions = field.split(this.delimiters.repetition);
    return repetitions.map((r) => this.parseCodedElement(r)).filter((c) => c !== undefined);
  }

  private parseExtendedPerson(field: string): ExtendedPerson {
    const components = field.split(this.delimiters.component);
    return {
      idNumber: components[0] || undefined,
      familyName: components[1] || undefined,
      givenName: components[2] || undefined,
      middleInitialOrName: components[3] || undefined,
      suffix: components[4] || undefined,
      prefix: components[5] || undefined,
      degree: components[6] || undefined,
      sourceTable: components[7] || undefined,
      assigningAuthority: components[8] || undefined,
      nameTypeCode: components[9] || undefined,
      identifierCheckDigit: components[10] || undefined,
      checkDigitScheme: components[11] || undefined,
      identifierTypeCode: components[12] || undefined,
      assigningFacility: components[13] || undefined,
    };
  }

  private parseExtendedPersons(field: string | undefined): ExtendedPerson[] {
    if (!field) return [];
    const repetitions = field.split(this.delimiters.repetition);
    return repetitions.map((r) => this.parseExtendedPerson(r));
  }

  private parseExtendedOrganization(field: string): ExtendedOrganization {
    const components = field.split(this.delimiters.component);
    return {
      organizationName: components[0] || undefined,
      organizationNameTypeCode: components[1] || undefined,
      idNumber: components[2] ? parseInt(components[2], 10) : undefined,
      identifierCheckDigit: components[3] || undefined,
      checkDigitScheme: components[4] || undefined,
      assigningAuthority: components[5] || undefined,
      identifierTypeCode: components[6] || undefined,
      assigningFacility: components[7] || undefined,
      nameRepresentationCode: components[8] || undefined,
      organizationIdentifier: components[9] || undefined,
    };
  }

  private parseExtendedOrganizations(field: string | undefined): ExtendedOrganization[] {
    if (!field) return [];
    const repetitions = field.split(this.delimiters.repetition);
    return repetitions.map((r) => this.parseExtendedOrganization(r));
  }

  private parsePatientLocation(field: string): PatientLocation {
    const components = field.split(this.delimiters.component);
    return {
      pointOfCare: components[0] || undefined,
      room: components[1] || undefined,
      bed: components[2] || undefined,
      facility: components[3] || undefined,
      locationStatus: components[4] || undefined,
      personLocationType: components[5] || undefined,
      building: components[6] || undefined,
      floor: components[7] || undefined,
      locationDescription: components[8] || undefined,
    };
  }

  private parseFinancialClass(field: string): FinancialClass {
    const components = field.split(this.delimiters.component);
    return {
      financialClassCode: components[0] || '',
      effectiveDate: components[1] || undefined,
    };
  }

  private parseFinancialClasses(field: string | undefined): FinancialClass[] {
    if (!field) return [];
    const repetitions = field.split(this.delimiters.repetition);
    return repetitions.map((r) => this.parseFinancialClass(r));
  }

  private parseQuantity(field: string): Quantity {
    const components = field.split(this.delimiters.component);
    return {
      quantity: components[0] ? parseFloat(components[0]) : undefined,
      units: components[1] ? this.parseCodedElement(components[1]) : undefined,
    };
  }

  private parseSpecimenSource(field: string): SpecimenSource {
    const components = field.split(this.delimiters.component);
    return {
      specimenSourceNameOrCode: components[0] ? this.parseCodedElement(components[0]) : undefined,
      additives: components[1] ? this.parseCodedElement(components[1]) : undefined,
      specimenCollectionMethod: components[2] || undefined,
      bodySite: components[3] ? this.parseCodedElement(components[3]) : undefined,
      siteModifier: components[4] ? this.parseCodedElement(components[4]) : undefined,
      collectionMethodModifierCode: components[5]
        ? this.parseCodedElement(components[5])
        : undefined,
      specimenRole: components[6] || undefined,
    };
  }

  private parseErrorLocations(field: string): ERRSegment['errorLocation'] {
    const repetitions = field.split(this.delimiters.repetition);
    return repetitions.map((r) => {
      const components = r.split(this.delimiters.component);
      return {
        segmentId: components[0] || undefined,
        segmentSequence: components[1] ? parseInt(components[1], 10) : undefined,
        fieldPosition: components[2] ? parseInt(components[2], 10) : undefined,
        componentNumber: components[3] ? parseInt(components[3], 10) : undefined,
        subComponentNumber: components[4] ? parseInt(components[4], 10) : undefined,
      };
    });
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
