/**
 * HL7 v2.x Segment Parsers
 *
 * Parses individual HL7 segments (PID, PV1, OBR, OBX, etc.)
 */

import {
  HL7Delimiters,
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
  HL7MessageType,
  OBXValueType,
} from '../../../types/hl7v2';
import { ComponentParsers } from './componentParsers';

/**
 * Segment parser for all HL7 segment types
 */
export class SegmentParsers {
  private cp: ComponentParsers;

  constructor(private delimiters: HL7Delimiters) {
    this.cp = new ComponentParsers(delimiters);
  }

  updateDelimiters(delimiters: HL7Delimiters): void {
    this.delimiters = delimiters;
    this.cp.updateDelimiters(delimiters);
  }

  parseMSHSegment(segmentString: string): MSHSegment | null {
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
      characterSet: fields[17] ? this.cp.parseRepetitions(fields[17]) : undefined,
      principalLanguage: fields[18] || undefined,
      alternateCharacterSet: fields[19] || undefined,
      messageProfileId: fields[20] ? this.cp.parseRepetitions(fields[20]) : undefined,
    };
  }

  parsePIDSegment(segmentString: string): PIDSegment {
    const fields = this.cp.splitFields(segmentString);

    return {
      segmentType: 'PID',
      setId: fields[1] ? parseInt(fields[1], 10) : undefined,
      patientId: fields[2] || undefined,
      patientIdentifierList: this.cp.parsePatientIdentifiers(fields[3]),
      alternatePatientId: fields[4] || undefined,
      patientName: this.cp.parseHumanNames(fields[5]),
      mothersMaidenName: fields[6] ? this.cp.parseHumanName(fields[6]) : undefined,
      dateOfBirth: fields[7] || undefined,
      administrativeSex: fields[8] as PIDSegment['administrativeSex'],
      patientAlias: fields[9] ? this.cp.parseHumanNames(fields[9]) : undefined,
      race: fields[10] ? this.cp.parseCodedElements(fields[10]) : undefined,
      patientAddress: fields[11] ? this.cp.parseAddresses(fields[11]) : undefined,
      countyCode: fields[12] || undefined,
      homePhone: fields[13] ? this.cp.parseExtendedTelecoms(fields[13]) : undefined,
      businessPhone: fields[14] ? this.cp.parseExtendedTelecoms(fields[14]) : undefined,
      primaryLanguage: fields[15] ? this.cp.parseCodedElement(fields[15]) : undefined,
      maritalStatus: fields[16] ? this.cp.parseCodedElement(fields[16]) : undefined,
      religion: fields[17] ? this.cp.parseCodedElement(fields[17]) : undefined,
      patientAccountNumber: fields[18] || undefined,
      ssn: fields[19] || undefined,
      driversLicense: fields[20] || undefined,
      mothersIdentifier: fields[21] ? this.cp.parsePatientIdentifier(fields[21]) : undefined,
      ethnicGroup: fields[22] ? this.cp.parseCodedElements(fields[22]) : undefined,
      birthPlace: fields[23] || undefined,
      multipleBirthIndicator: fields[24] as 'Y' | 'N' | undefined,
      birthOrder: fields[25] ? parseInt(fields[25], 10) : undefined,
      citizenship: fields[26] ? this.cp.parseCodedElements(fields[26]) : undefined,
      veteransMilitaryStatus: fields[27] ? this.cp.parseCodedElement(fields[27]) : undefined,
      nationality: fields[28] ? this.cp.parseCodedElement(fields[28]) : undefined,
      patientDeathDateTime: fields[29] || undefined,
      patientDeathIndicator: fields[30] as 'Y' | 'N' | undefined,
      identityUnknownIndicator: fields[31] as 'Y' | 'N' | undefined,
      identityReliabilityCode: fields[32] ? this.cp.parseRepetitions(fields[32]) : undefined,
      lastUpdateDateTime: fields[33] || undefined,
      lastUpdateFacility: fields[34] || undefined,
      taxonomicClassificationCode: fields[35] ? this.cp.parseCodedElement(fields[35]) : undefined,
      breedCode: fields[36] ? this.cp.parseCodedElement(fields[36]) : undefined,
      strain: fields[37] || undefined,
      productionClassCode: fields[38] ? this.cp.parseCodedElements(fields[38]) : undefined,
      tribalCitizenship: fields[39] ? this.cp.parseCodedElements(fields[39]) : undefined,
      patientTelecommunication: fields[40] ? this.cp.parseExtendedTelecoms(fields[40]) : undefined,
    };
  }

  parsePV1Segment(segmentString: string): PV1Segment {
    const fields = this.cp.splitFields(segmentString);

    return {
      segmentType: 'PV1',
      setId: fields[1] ? parseInt(fields[1], 10) : undefined,
      patientClass: (fields[2] || 'U') as PV1Segment['patientClass'],
      assignedPatientLocation: fields[3] ? this.cp.parsePatientLocation(fields[3]) : undefined,
      admissionType: fields[4] || undefined,
      preadmitNumber: fields[5] || undefined,
      priorPatientLocation: fields[6] ? this.cp.parsePatientLocation(fields[6]) : undefined,
      attendingDoctor: fields[7] ? this.cp.parseExtendedPersons(fields[7]) : undefined,
      referringDoctor: fields[8] ? this.cp.parseExtendedPersons(fields[8]) : undefined,
      consultingDoctor: fields[9] ? this.cp.parseExtendedPersons(fields[9]) : undefined,
      hospitalService: fields[10] || undefined,
      temporaryLocation: fields[11] ? this.cp.parsePatientLocation(fields[11]) : undefined,
      preadmitTestIndicator: fields[12] || undefined,
      readmissionIndicator: fields[13] || undefined,
      admitSource: fields[14] || undefined,
      ambulatoryStatus: fields[15] ? this.cp.parseRepetitions(fields[15]) : undefined,
      vipIndicator: fields[16] || undefined,
      admittingDoctor: fields[17] ? this.cp.parseExtendedPersons(fields[17]) : undefined,
      patientType: fields[18] || undefined,
      visitNumber: fields[19] || undefined,
      financialClass: fields[20] ? this.cp.parseFinancialClasses(fields[20]) : undefined,
      chargePriceIndicator: fields[21] || undefined,
      courtesyCode: fields[22] || undefined,
      creditRating: fields[23] || undefined,
      contractCode: fields[24] ? this.cp.parseRepetitions(fields[24]) : undefined,
      contractEffectiveDate: fields[25] ? this.cp.parseRepetitions(fields[25]) : undefined,
      contractAmount: fields[26]
        ? this.cp.parseRepetitions(fields[26]).map((v) => parseFloat(v))
        : undefined,
      contractPeriod: fields[27]
        ? this.cp.parseRepetitions(fields[27]).map((v) => parseInt(v, 10))
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
            dischargeToLocation: this.cp.getComponent(fields[37], 0),
            effectiveDate: this.cp.getComponent(fields[37], 1),
          }
        : undefined,
      dietType: fields[38] ? this.cp.parseCodedElement(fields[38]) : undefined,
      servicingFacility: fields[39] || undefined,
      bedStatus: fields[40] as PV1Segment['bedStatus'],
      accountStatus: fields[41] || undefined,
      pendingLocation: fields[42] ? this.cp.parsePatientLocation(fields[42]) : undefined,
      priorTemporaryLocation: fields[43] ? this.cp.parsePatientLocation(fields[43]) : undefined,
      admitDateTime: fields[44] || undefined,
      dischargeDateTime: fields[45] || undefined,
      currentPatientBalance: fields[46] ? parseFloat(fields[46]) : undefined,
      totalCharges: fields[47] ? parseFloat(fields[47]) : undefined,
      totalAdjustments: fields[48] ? parseFloat(fields[48]) : undefined,
      totalPayments: fields[49] ? parseFloat(fields[49]) : undefined,
      alternateVisitId: fields[50] || undefined,
      visitIndicator: fields[51] as 'A' | 'V' | undefined,
      otherHealthcareProvider: fields[52] ? this.cp.parseExtendedPersons(fields[52]) : undefined,
    };
  }

  parsePV2Segment(segmentString: string): PV2Segment {
    const fields = this.cp.splitFields(segmentString);

    return {
      segmentType: 'PV2',
      priorPendingLocation: fields[1] ? this.cp.parsePatientLocation(fields[1]) : undefined,
      accommodationCode: fields[2] ? this.cp.parseCodedElement(fields[2]) : undefined,
      admitReason: fields[3] ? this.cp.parseCodedElement(fields[3]) : undefined,
      transferReason: fields[4] ? this.cp.parseCodedElement(fields[4]) : undefined,
      patientValuables: fields[5] ? this.cp.parseRepetitions(fields[5]) : undefined,
      patientValuablesLocation: fields[6] || undefined,
      visitUserCode: fields[7] ? this.cp.parseRepetitions(fields[7]) : undefined,
      expectedAdmitDateTime: fields[8] || undefined,
      expectedDischargeDateTime: fields[9] || undefined,
      estimatedLengthOfStay: fields[10] ? parseInt(fields[10], 10) : undefined,
      actualLengthOfStay: fields[11] ? parseInt(fields[11], 10) : undefined,
      visitDescription: fields[12] || undefined,
      referralSourceCode: fields[13] ? this.cp.parseExtendedPersons(fields[13]) : undefined,
      previousServiceDate: fields[14] || undefined,
      employmentIllnessRelated: fields[15] as 'Y' | 'N' | 'U' | undefined,
      purgeStatusCode: fields[16] || undefined,
      purgeStatusDate: fields[17] || undefined,
      specialProgramCode: fields[18] || undefined,
      retentionIndicator: fields[19] as 'Y' | 'N' | undefined,
      expectedNumberOfInsurancePlans: fields[20] ? parseInt(fields[20], 10) : undefined,
      visitPublicityCode: fields[21] || undefined,
      visitProtectionIndicator: fields[22] as 'Y' | 'N' | undefined,
      clinicOrganizationName: fields[23] ? this.cp.parseExtendedOrganizations(fields[23]) : undefined,
      patientStatusCode: fields[24] || undefined,
      visitPriorityCode: fields[25] || undefined,
      previousTreatmentDate: fields[26] || undefined,
      expectedDischargeDisposition: fields[27] || undefined,
      signatureOnFileDate: fields[28] || undefined,
      firstSimilarIllnessDate: fields[29] || undefined,
      patientChargeAdjustmentCode: fields[30] ? this.cp.parseCodedElement(fields[30]) : undefined,
      recurringServiceCode: fields[31] || undefined,
      billingMediaCode: fields[32] as 'Y' | 'N' | undefined,
      expectedSurgeryDateTime: fields[33] || undefined,
      militaryPartnershipCode: fields[34] as 'Y' | 'N' | undefined,
      militaryNonAvailabilityCode: fields[35] as 'Y' | 'N' | undefined,
      newbornBabyIndicator: fields[36] as 'Y' | 'N' | undefined,
      babyDetainedIndicator: fields[37] as 'Y' | 'N' | undefined,
      modeOfArrivalCode: fields[38] ? this.cp.parseCodedElement(fields[38]) : undefined,
      recreationalDrugUseCode: fields[39] ? this.cp.parseCodedElements(fields[39]) : undefined,
      admissionLevelOfCareCode: fields[40] ? this.cp.parseCodedElement(fields[40]) : undefined,
      precautionCode: fields[41] ? this.cp.parseCodedElements(fields[41]) : undefined,
      patientConditionCode: fields[42] ? this.cp.parseCodedElement(fields[42]) : undefined,
      livingWillCode: fields[43] as 'Y' | 'N' | 'U' | 'F' | 'I' | undefined,
      organDonorCode: fields[44] as 'Y' | 'N' | 'U' | 'F' | 'I' | 'P' | 'R' | undefined,
      advanceDirectiveCode: fields[45] ? this.cp.parseCodedElements(fields[45]) : undefined,
      patientStatusEffectiveDate: fields[46] || undefined,
      expectedLoaReturnDateTime: fields[47] || undefined,
      expectedPreadmitTestDateTime: fields[48] || undefined,
      notifyClergyCode: fields[49] ? this.cp.parseRepetitions(fields[49]) : undefined,
    };
  }

  parseOBRSegment(segmentString: string): OBRSegment {
    const fields = this.cp.splitFields(segmentString);

    return {
      segmentType: 'OBR',
      setId: fields[1] ? parseInt(fields[1], 10) : undefined,
      placerOrderNumber: fields[2] || undefined,
      fillerOrderNumber: fields[3] || undefined,
      universalServiceIdentifier: this.cp.parseCodedElement(fields[4]) || {
        identifier: '',
        text: 'Unknown',
      },
      priority: fields[5] || undefined,
      requestedDateTime: fields[6] || undefined,
      observationDateTime: fields[7] || undefined,
      observationEndDateTime: fields[8] || undefined,
      collectionVolume: fields[9] ? this.cp.parseQuantity(fields[9]) : undefined,
      collectorIdentifier: fields[10] ? this.cp.parseExtendedPersons(fields[10]) : undefined,
      specimenActionCode: fields[11] || undefined,
      dangerCode: fields[12] ? this.cp.parseCodedElement(fields[12]) : undefined,
      relevantClinicalInfo: fields[13] || undefined,
      specimenReceivedDateTime: fields[14] || undefined,
      specimenSource: fields[15] ? this.cp.parseSpecimenSource(fields[15]) : undefined,
      orderingProvider: fields[16] ? this.cp.parseExtendedPersons(fields[16]) : undefined,
      orderCallbackPhone: fields[17] ? this.cp.parseExtendedTelecoms(fields[17]) : undefined,
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
            parentObservationIdentifier: this.cp.parseCodedElement(
              this.cp.getComponent(fields[26], 0) || ''
            ),
            parentObservationSubIdentifier: this.cp.getComponent(fields[26], 1),
            parentObservationValueDescriptor: this.cp.getComponent(fields[26], 2),
          }
        : undefined,
      quantityTiming: fields[27] ? this.cp.parseRepetitions(fields[27]) : undefined,
      resultCopiesTo: fields[28] ? this.cp.parseExtendedPersons(fields[28]) : undefined,
      parent: fields[29]
        ? {
            placerAssignedIdentifier: this.cp.getComponent(fields[29], 0),
            fillerAssignedIdentifier: this.cp.getComponent(fields[29], 1),
          }
        : undefined,
      transportationMode: fields[30] || undefined,
      reasonForStudy: fields[31] ? this.cp.parseCodedElements(fields[31]) : undefined,
      principalResultInterpreter: fields[32] ? this.cp.parseExtendedPerson(fields[32]) : undefined,
      assistantResultInterpreter: fields[33] ? this.cp.parseExtendedPersons(fields[33]) : undefined,
      technician: fields[34] ? this.cp.parseExtendedPersons(fields[34]) : undefined,
      transcriptionist: fields[35] ? this.cp.parseExtendedPersons(fields[35]) : undefined,
      scheduledDateTime: fields[36] || undefined,
      numberOfSampleContainers: fields[37] ? parseInt(fields[37], 10) : undefined,
      transportLogisticsOfCollectedSample: fields[38]
        ? this.cp.parseCodedElements(fields[38])
        : undefined,
      collectorsComment: fields[39] ? this.cp.parseCodedElements(fields[39]) : undefined,
      transportArrangementResponsibility: fields[40]
        ? this.cp.parseCodedElement(fields[40])
        : undefined,
      transportArranged: fields[41] as 'A' | 'N' | 'U' | undefined,
      escortRequired: fields[42] as 'Y' | 'N' | 'U' | undefined,
      plannedPatientTransportComment: fields[43] ? this.cp.parseCodedElements(fields[43]) : undefined,
      procedureCode: fields[44] ? this.cp.parseCodedElement(fields[44]) : undefined,
      procedureCodeModifier: fields[45] ? this.cp.parseCodedElements(fields[45]) : undefined,
      placerSupplementalServiceInfo: fields[46] ? this.cp.parseCodedElements(fields[46]) : undefined,
      fillerSupplementalServiceInfo: fields[47] ? this.cp.parseCodedElements(fields[47]) : undefined,
      medicallyNecessaryDuplicateProcedureReason: fields[48]
        ? this.cp.parseCodedElement(fields[48])
        : undefined,
      resultHandling: fields[49] || undefined,
      parentUniversalServiceIdentifier: fields[50]
        ? this.cp.parseCodedElement(fields[50])
        : undefined,
    };
  }

  parseOBXSegment(segmentString: string): OBXSegment {
    const fields = this.cp.splitFields(segmentString);

    return {
      segmentType: 'OBX',
      setId: fields[1] ? parseInt(fields[1], 10) : undefined,
      valueType: fields[2] as OBXValueType,
      observationIdentifier: this.cp.parseCodedElement(fields[3]) || {
        identifier: '',
        text: 'Unknown',
      },
      observationSubId: fields[4] || undefined,
      observationValue: fields[5] ? this.cp.parseRepetitions(fields[5]) : undefined,
      units: fields[6] ? this.cp.parseCodedElement(fields[6]) : undefined,
      referenceRange: fields[7] || undefined,
      abnormalFlags: fields[8] ? this.cp.parseRepetitions(fields[8]) : undefined,
      probability: fields[9] ? parseFloat(fields[9]) : undefined,
      natureOfAbnormalTest: fields[10] ? this.cp.parseRepetitions(fields[10]) : undefined,
      observationResultStatus: (fields[11] || 'F') as OBXSegment['observationResultStatus'],
      effectiveDateOfReferenceRange: fields[12] || undefined,
      userDefinedAccessChecks: fields[13] || undefined,
      dateTimeOfObservation: fields[14] || undefined,
      producersId: fields[15] ? this.cp.parseCodedElement(fields[15]) : undefined,
      responsibleObserver: fields[16] ? this.cp.parseExtendedPersons(fields[16]) : undefined,
      observationMethod: fields[17] ? this.cp.parseCodedElements(fields[17]) : undefined,
      equipmentInstanceIdentifier: fields[18] ? this.cp.parseRepetitions(fields[18]) : undefined,
      dateTimeOfAnalysis: fields[19] || undefined,
      observationSite: fields[20] ? this.cp.parseCodedElements(fields[20]) : undefined,
      observationInstanceIdentifier: fields[21] || undefined,
      moodCode: fields[22] as OBXSegment['moodCode'],
      performingOrganizationName: fields[23]
        ? this.cp.parseExtendedOrganization(fields[23])
        : undefined,
      performingOrganizationAddress: fields[24] ? this.cp.parseAddress(fields[24]) : undefined,
      performingOrganizationMedicalDirector: fields[25]
        ? this.cp.parseExtendedPerson(fields[25])
        : undefined,
    };
  }

  parseORCSegment(segmentString: string): ORCSegment {
    const fields = this.cp.splitFields(segmentString);

    return {
      segmentType: 'ORC',
      orderControl: fields[1] || '',
      placerOrderNumber: fields[2] || undefined,
      fillerOrderNumber: fields[3] || undefined,
      placerGroupNumber: fields[4] || undefined,
      orderStatus: fields[5] as ORCSegment['orderStatus'],
      responseFlag: fields[6] as ORCSegment['responseFlag'],
      quantityTiming: fields[7] ? this.cp.parseRepetitions(fields[7]) : undefined,
      parent: fields[8]
        ? {
            placerAssignedIdentifier: this.cp.getComponent(fields[8], 0),
            fillerAssignedIdentifier: this.cp.getComponent(fields[8], 1),
          }
        : undefined,
      dateTimeOfTransaction: fields[9] || undefined,
      enteredBy: fields[10] ? this.cp.parseExtendedPersons(fields[10]) : undefined,
      verifiedBy: fields[11] ? this.cp.parseExtendedPersons(fields[11]) : undefined,
      orderingProvider: fields[12] ? this.cp.parseExtendedPersons(fields[12]) : undefined,
      enterersLocation: fields[13] ? this.cp.parsePatientLocation(fields[13]) : undefined,
      callBackPhoneNumber: fields[14] ? this.cp.parseExtendedTelecoms(fields[14]) : undefined,
      orderEffectiveDateTime: fields[15] || undefined,
      orderControlCodeReason: fields[16] ? this.cp.parseCodedElement(fields[16]) : undefined,
      enteringOrganization: fields[17] ? this.cp.parseCodedElement(fields[17]) : undefined,
      enteringDevice: fields[18] ? this.cp.parseCodedElement(fields[18]) : undefined,
      actionBy: fields[19] ? this.cp.parseExtendedPersons(fields[19]) : undefined,
      advancedBeneficiaryNoticeCode: fields[20] ? this.cp.parseCodedElement(fields[20]) : undefined,
      orderingFacilityName: fields[21] ? this.cp.parseExtendedOrganizations(fields[21]) : undefined,
      orderingFacilityAddress: fields[22] ? this.cp.parseAddresses(fields[22]) : undefined,
      orderingFacilityPhoneNumber: fields[23] ? this.cp.parseExtendedTelecoms(fields[23]) : undefined,
      orderingProviderAddress: fields[24] ? this.cp.parseAddresses(fields[24]) : undefined,
      orderStatusModifier: fields[25] ? this.cp.parseCodedElement(fields[25]) : undefined,
      advancedBeneficiaryNoticeOverrideReason: fields[26]
        ? this.cp.parseCodedElement(fields[26])
        : undefined,
      fillersExpectedAvailabilityDateTime: fields[27] || undefined,
      confidentialityCode: fields[28] ? this.cp.parseCodedElement(fields[28]) : undefined,
      orderType: fields[29] ? this.cp.parseCodedElement(fields[29]) : undefined,
      entererAuthorizationMode: fields[30] ? this.cp.parseCodedElement(fields[30]) : undefined,
      parentUniversalServiceIdentifier: fields[31]
        ? this.cp.parseCodedElement(fields[31])
        : undefined,
    };
  }

  parseDG1Segment(segmentString: string): DG1Segment {
    const fields = this.cp.splitFields(segmentString);

    return {
      segmentType: 'DG1',
      setId: parseInt(fields[1] || '1', 10),
      diagnosisCodingMethod: fields[2] || undefined,
      diagnosisCode: fields[3] ? this.cp.parseCodedElement(fields[3]) : undefined,
      diagnosisDescription: fields[4] || undefined,
      diagnosisDateTime: fields[5] || undefined,
      diagnosisType: fields[6] || '',
      majorDiagnosticCategory: fields[7] ? this.cp.parseCodedElement(fields[7]) : undefined,
      diagnosticRelatedGroup: fields[8] ? this.cp.parseCodedElement(fields[8]) : undefined,
      drgApprovalIndicator: fields[9] as 'Y' | 'N' | undefined,
      drgGrouperReviewCode: fields[10] || undefined,
      outlierType: fields[11] ? this.cp.parseCodedElement(fields[11]) : undefined,
      outlierDays: fields[12] ? parseInt(fields[12], 10) : undefined,
      outlierCost: fields[13] ? parseFloat(fields[13]) : undefined,
      grouperVersionAndType: fields[14] || undefined,
      diagnosisPriority: fields[15] ? parseInt(fields[15], 10) : undefined,
      diagnosingClinician: fields[16] ? this.cp.parseExtendedPersons(fields[16]) : undefined,
      diagnosisClassification: fields[17] || undefined,
      confidentialIndicator: fields[18] as 'Y' | 'N' | undefined,
      attestationDateTime: fields[19] || undefined,
      diagnosisIdentifier: fields[20] || undefined,
      diagnosisActionCode: fields[21] as 'A' | 'D' | 'U' | undefined,
      parentDiagnosis: fields[22] || undefined,
      drgCclValueCode: fields[23] ? this.cp.parseCodedElement(fields[23]) : undefined,
      drgGroupingUsage: fields[24] || undefined,
      drgDiagnosisDeterminationStatus: fields[25] ? this.cp.parseCodedElement(fields[25]) : undefined,
      presentOnAdmissionIndicator: fields[26] || undefined,
    };
  }

  parseAL1Segment(segmentString: string): AL1Segment {
    const fields = this.cp.splitFields(segmentString);

    return {
      segmentType: 'AL1',
      setId: parseInt(fields[1] || '1', 10),
      allergenTypeCode: fields[2] ? this.cp.parseCodedElement(fields[2]) : undefined,
      allergenCode: this.cp.parseCodedElement(fields[3]) || { identifier: '', text: 'Unknown' },
      allergySeverityCode: fields[4] || undefined,
      allergyReaction: fields[5] ? this.cp.parseRepetitions(fields[5]) : undefined,
      identificationDate: fields[6] || undefined,
    };
  }

  parseIN1Segment(segmentString: string): IN1Segment {
    const fields = this.cp.splitFields(segmentString);

    return {
      segmentType: 'IN1',
      setId: parseInt(fields[1] || '1', 10),
      insurancePlanId: fields[2] ? this.cp.parseCodedElement(fields[2]) : undefined,
      insuranceCompanyId: fields[3] ? this.cp.parseRepetitions(fields[3]) : undefined,
      insuranceCompanyName: fields[4] ? this.cp.parseExtendedOrganizations(fields[4]) : undefined,
      insuranceCompanyAddress: fields[5] ? this.cp.parseAddresses(fields[5]) : undefined,
      insuranceCompanyContactPerson: fields[6] ? this.cp.parseExtendedPersons(fields[6]) : undefined,
      insuranceCompanyPhoneNumber: fields[7] ? this.cp.parseExtendedTelecoms(fields[7]) : undefined,
      groupNumber: fields[8] || undefined,
      groupName: fields[9] ? this.cp.parseExtendedOrganizations(fields[9]) : undefined,
      insuredGroupEmployerId: fields[10] ? this.cp.parseRepetitions(fields[10]) : undefined,
      insuredGroupEmployerName: fields[11] ? this.cp.parseExtendedOrganizations(fields[11]) : undefined,
      planEffectiveDate: fields[12] || undefined,
      planExpirationDate: fields[13] || undefined,
      authorizationInformation: fields[14] || undefined,
      planType: fields[15] || undefined,
      nameOfInsured: fields[16] ? this.cp.parseExtendedPersons(fields[16]) : undefined,
      insuredRelationshipToPatient: fields[17] ? this.cp.parseCodedElement(fields[17]) : undefined,
      insuredDateOfBirth: fields[18] || undefined,
      insuredAddress: fields[19] ? this.cp.parseAddresses(fields[19]) : undefined,
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
      verificationBy: fields[30] ? this.cp.parseExtendedPersons(fields[30]) : undefined,
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
      insuredEmploymentStatus: fields[42] ? this.cp.parseCodedElement(fields[42]) : undefined,
      insuredAdministrativeSex: fields[43] as 'M' | 'F' | 'O' | 'U' | undefined,
      insuredEmployerAddress: fields[44] ? this.cp.parseAddresses(fields[44]) : undefined,
      verificationStatus: fields[45] || undefined,
      priorInsurancePlanId: fields[46] || undefined,
      coverageType: fields[47] || undefined,
      handicap: fields[48] || undefined,
      insuredIdNumber: fields[49] ? this.cp.parseRepetitions(fields[49]) : undefined,
      signatureCode: fields[50] || undefined,
      signatureCodeDate: fields[51] || undefined,
      insuredBirthPlace: fields[52] || undefined,
      vipIndicator: fields[53] || undefined,
    };
  }

  parseNTESegment(segmentString: string): NTESegment {
    const fields = this.cp.splitFields(segmentString);

    return {
      segmentType: 'NTE',
      setId: fields[1] ? parseInt(fields[1], 10) : undefined,
      sourceOfComment: fields[2] || undefined,
      comment: fields[3] ? this.cp.parseRepetitions(fields[3]) : undefined,
      commentType: fields[4] ? this.cp.parseCodedElement(fields[4]) : undefined,
      enteredBy: fields[5] ? this.cp.parseExtendedPerson(fields[5]) : undefined,
      enteredDateTime: fields[6] || undefined,
      effectiveStartDate: fields[7] || undefined,
      expirationDate: fields[8] || undefined,
    };
  }

  parseMSASegment(segmentString: string): MSASegment {
    const fields = this.cp.splitFields(segmentString);

    return {
      segmentType: 'MSA',
      acknowledgmentCode: (fields[1] || 'AA') as MSASegment['acknowledgmentCode'],
      messageControlId: fields[2] || '',
      textMessage: fields[3] || undefined,
      expectedSequenceNumber: fields[4] ? parseInt(fields[4], 10) : undefined,
      delayedAcknowledgmentType: fields[5] || undefined,
      errorCondition: fields[6] ? this.cp.parseCodedElement(fields[6]) : undefined,
    };
  }

  parseERRSegment(segmentString: string): ERRSegment {
    const fields = this.cp.splitFields(segmentString);

    return {
      segmentType: 'ERR',
      errorCodeAndLocation: fields[1] || undefined,
      errorLocation: fields[2] ? this.cp.parseErrorLocations(fields[2]) : undefined,
      hl7ErrorCode: this.cp.parseCodedElement(fields[3]) || { identifier: '0', text: 'Unknown' },
      severity: (fields[4] || 'E') as 'E' | 'I' | 'W',
      applicationErrorCode: fields[5] ? this.cp.parseCodedElement(fields[5]) : undefined,
      applicationErrorParameter: fields[6] ? this.cp.parseRepetitions(fields[6]) : undefined,
      diagnosticInformation: fields[7] || undefined,
      userMessage: fields[8] || undefined,
      informPersonIndicator: fields[9] ? this.cp.parseRepetitions(fields[9]) : undefined,
      overrideType: fields[10] ? this.cp.parseCodedElement(fields[10]) : undefined,
      overrideReasonCode: fields[11] ? this.cp.parseCodedElements(fields[11]) : undefined,
      helpDeskContactPoint: fields[12] ? this.cp.parseExtendedTelecoms(fields[12]) : undefined,
    };
  }

  parseGenericSegment(segmentString: string): GenericSegment {
    const fields = this.cp.splitFields(segmentString);

    return {
      segmentType: fields[0] || 'UNK',
      fields: fields.slice(1),
    };
  }
}
