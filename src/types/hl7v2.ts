/**
 * HL7 v2.x Type Definitions
 *
 * Supports parsing of legacy HL7 v2.x messages (v2.3 - v2.8)
 * Primary message types: ADT (Admit/Discharge/Transfer), ORU (Results), ORM (Orders)
 *
 * This is NOT a replacement for FHIR - it's a bridge to legacy systems.
 * 80%+ of hospital interfaces still use HL7 v2.x.
 */

// ============================================================================
// CORE HL7 v2.x TYPES
// ============================================================================

/**
 * HL7 field delimiters (from MSH segment)
 */
export interface HL7Delimiters {
  field: string;        // Usually |
  component: string;    // Usually ^
  repetition: string;   // Usually ~
  escape: string;       // Usually \
  subComponent: string; // Usually &
}

export const DEFAULT_DELIMITERS: HL7Delimiters = {
  field: '|',
  component: '^',
  repetition: '~',
  escape: '\\',
  subComponent: '&',
};

/**
 * HL7 Message Types we support
 */
export type HL7MessageType =
  | 'ADT' // Admit/Discharge/Transfer
  | 'ORU' // Observation Result (lab/imaging)
  | 'ORM' // Order Message
  | 'RDE' // Pharmacy/Treatment Encoded Order
  | 'MDM' // Medical Document Management
  | 'SIU' // Scheduling Information Unsolicited
  | 'ACK'; // Acknowledgment

/**
 * ADT Event Types (A01-A62)
 */
export type ADTEventType =
  | 'A01' // Admit/Visit Notification
  | 'A02' // Transfer a Patient
  | 'A03' // Discharge/End Visit
  | 'A04' // Register a Patient
  | 'A05' // Pre-Admit a Patient
  | 'A06' // Change Outpatient to Inpatient
  | 'A07' // Change Inpatient to Outpatient
  | 'A08' // Update Patient Information
  | 'A09' // Patient Departing - Tracking
  | 'A10' // Patient Arriving - Tracking
  | 'A11' // Cancel Admit/Visit
  | 'A12' // Cancel Transfer
  | 'A13' // Cancel Discharge
  | 'A14' // Pending Admit
  | 'A15' // Pending Transfer
  | 'A16' // Pending Discharge
  | 'A17' // Swap Patients
  | 'A18' // Merge Patient Information
  | 'A19' // Patient Query
  | 'A20' // Bed Status Update
  | 'A21' // Patient Goes on Leave of Absence
  | 'A22' // Patient Returns from Leave of Absence
  | 'A23' // Delete a Patient Record
  | 'A24' // Link Patient Information
  | 'A25' // Cancel Pending Discharge
  | 'A26' // Cancel Pending Transfer
  | 'A27' // Cancel Pending Admit
  | 'A28' // Add Person Information
  | 'A29' // Delete Person Information
  | 'A30' // Merge Person Information
  | 'A31' // Update Person Information
  | 'A32' // Cancel Patient Arriving
  | 'A33' // Cancel Patient Departing
  | 'A34' // Merge Patient Info - Patient ID Only
  | 'A35' // Merge Patient Info - Account Number Only
  | 'A36' // Merge Patient Info - Patient ID & Account Number
  | 'A37' // Unlink Patient Information
  | 'A38' // Cancel Pre-Admit
  | 'A39' // Merge Person - Patient ID
  | 'A40' // Merge Patient - Patient ID List
  | 'A41' // Merge Account - Patient Account Number
  | 'A42' // Merge Visit - Visit Number
  | 'A43' // Move Patient Info - Patient ID List
  | 'A44' // Move Account Info - Patient Account Number
  | 'A45' // Move Visit Info - Visit Number
  | 'A46' // Change Patient ID
  | 'A47' // Change Patient ID List
  | 'A48' // Change Alternate Patient ID
  | 'A49' // Change Patient Account Number
  | 'A50' // Change Visit Number
  | 'A51' // Change Alternate Visit ID
  | 'A52' // Cancel Leave of Absence for Patient
  | 'A53' // Cancel Patient Returns from Leave of Absence
  | 'A54' // Change Attending Doctor
  | 'A55' // Cancel Change Attending Doctor
  | 'A60' // Update Adverse Reaction Info
  | 'A61' // Change Consulting Doctor
  | 'A62'; // Cancel Change Consulting Doctor

/**
 * ORU Event Types
 */
export type ORUEventType =
  | 'R01' // Unsolicited Observation Message
  | 'R03' // Display Oriented Results, Query/Unsolicited
  | 'R30' // Unsolicited Point-of-Care Observation
  | 'R31' // Unsolicited New Point-of-Care Observation
  | 'R32'; // Unsolicited Pre-Ordered Point-of-Care Observation

/**
 * ORM Event Types
 */
export type ORMEventType =
  | 'O01' // Order Message
  | 'O02'; // Order Response

// ============================================================================
// SEGMENT TYPES
// ============================================================================

/**
 * MSH - Message Header Segment
 * Required in every HL7 message
 */
export interface MSHSegment {
  segmentType: 'MSH';
  fieldSeparator: string;           // MSH.1
  encodingCharacters: string;       // MSH.2
  sendingApplication: string;       // MSH.3
  sendingFacility: string;          // MSH.4
  receivingApplication: string;     // MSH.5
  receivingFacility: string;        // MSH.6
  dateTimeOfMessage: string;        // MSH.7 (yyyyMMddHHmmss)
  security?: string;                // MSH.8
  messageType: {                    // MSH.9
    messageCode: HL7MessageType;
    triggerEvent: string;
    messageStructure?: string;
  };
  messageControlId: string;         // MSH.10 (unique ID)
  processingId: 'P' | 'T' | 'D';    // MSH.11 (Production/Training/Debug)
  versionId: string;                // MSH.12 (e.g., "2.5.1")
  sequenceNumber?: number;          // MSH.13
  continuationPointer?: string;     // MSH.14
  acceptAckType?: string;           // MSH.15
  applicationAckType?: string;      // MSH.16
  countryCode?: string;             // MSH.17
  characterSet?: string[];          // MSH.18
  principalLanguage?: string;       // MSH.19
  alternateCharacterSet?: string;   // MSH.20
  messageProfileId?: string[];      // MSH.21
}

/**
 * PID - Patient Identification Segment
 */
export interface PIDSegment {
  segmentType: 'PID';
  setId?: number;                   // PID.1
  patientId?: string;               // PID.2 (deprecated, use PID.3)
  patientIdentifierList: PatientIdentifier[]; // PID.3
  alternatePatientId?: string;      // PID.4
  patientName: HumanName[];         // PID.5
  mothersMaidenName?: HumanName;    // PID.6
  dateOfBirth?: string;             // PID.7 (yyyyMMdd)
  administrativeSex?: 'M' | 'F' | 'O' | 'U' | 'A' | 'N'; // PID.8
  patientAlias?: HumanName[];       // PID.9
  race?: CodedElement[];            // PID.10
  patientAddress?: Address[];       // PID.11
  countyCode?: string;              // PID.12
  homePhone?: ExtendedTelecom[];    // PID.13
  businessPhone?: ExtendedTelecom[];// PID.14
  primaryLanguage?: CodedElement;   // PID.15
  maritalStatus?: CodedElement;     // PID.16
  religion?: CodedElement;          // PID.17
  patientAccountNumber?: string;    // PID.18
  ssn?: string;                     // PID.19 (DO NOT LOG - PHI)
  driversLicense?: string;          // PID.20
  mothersIdentifier?: PatientIdentifier; // PID.21
  ethnicGroup?: CodedElement[];     // PID.22
  birthPlace?: string;              // PID.23
  multipleBirthIndicator?: 'Y' | 'N'; // PID.24
  birthOrder?: number;              // PID.25
  citizenship?: CodedElement[];     // PID.26
  veteransMilitaryStatus?: CodedElement; // PID.27
  nationality?: CodedElement;       // PID.28
  patientDeathDateTime?: string;    // PID.29
  patientDeathIndicator?: 'Y' | 'N'; // PID.30
  identityUnknownIndicator?: 'Y' | 'N'; // PID.31
  identityReliabilityCode?: string[];   // PID.32
  lastUpdateDateTime?: string;      // PID.33
  lastUpdateFacility?: string;      // PID.34
  taxonomicClassificationCode?: CodedElement; // PID.35
  breedCode?: CodedElement;         // PID.36
  strain?: string;                  // PID.37
  productionClassCode?: CodedElement[]; // PID.38
  tribalCitizenship?: CodedElement[]; // PID.39
  patientTelecommunication?: ExtendedTelecom[]; // PID.40
}

/**
 * PV1 - Patient Visit Segment
 */
export interface PV1Segment {
  segmentType: 'PV1';
  setId?: number;                   // PV1.1
  patientClass: 'E' | 'I' | 'O' | 'P' | 'R' | 'B' | 'C' | 'N' | 'U'; // PV1.2
  assignedPatientLocation?: PatientLocation; // PV1.3
  admissionType?: string;           // PV1.4
  preadmitNumber?: string;          // PV1.5
  priorPatientLocation?: PatientLocation; // PV1.6
  attendingDoctor?: ExtendedPerson[]; // PV1.7
  referringDoctor?: ExtendedPerson[]; // PV1.8
  consultingDoctor?: ExtendedPerson[]; // PV1.9
  hospitalService?: string;         // PV1.10
  temporaryLocation?: PatientLocation; // PV1.11
  preadmitTestIndicator?: string;   // PV1.12
  readmissionIndicator?: string;    // PV1.13
  admitSource?: string;             // PV1.14
  ambulatoryStatus?: string[];      // PV1.15
  vipIndicator?: string;            // PV1.16
  admittingDoctor?: ExtendedPerson[]; // PV1.17
  patientType?: string;             // PV1.18
  visitNumber?: string;             // PV1.19
  financialClass?: FinancialClass[]; // PV1.20
  chargePriceIndicator?: string;    // PV1.21
  courtesyCode?: string;            // PV1.22
  creditRating?: string;            // PV1.23
  contractCode?: string[];          // PV1.24
  contractEffectiveDate?: string[]; // PV1.25
  contractAmount?: number[];        // PV1.26
  contractPeriod?: number[];        // PV1.27
  interestCode?: string;            // PV1.28
  transferToBadDebtCode?: string;   // PV1.29
  transferToBadDebtDate?: string;   // PV1.30
  badDebtAgencyCode?: string;       // PV1.31
  badDebtTransferAmount?: number;   // PV1.32
  badDebtRecoveryAmount?: number;   // PV1.33
  deleteAccountIndicator?: string;  // PV1.34
  deleteAccountDate?: string;       // PV1.35
  dischargeDisposition?: string;    // PV1.36
  dischargeToLocation?: DischargeLocation; // PV1.37
  dietType?: CodedElement;          // PV1.38
  servicingFacility?: string;       // PV1.39
  bedStatus?: 'C' | 'H' | 'I' | 'K' | 'O' | 'U'; // PV1.40
  accountStatus?: string;           // PV1.41
  pendingLocation?: PatientLocation; // PV1.42
  priorTemporaryLocation?: PatientLocation; // PV1.43
  admitDateTime?: string;           // PV1.44
  dischargeDateTime?: string;       // PV1.45
  currentPatientBalance?: number;   // PV1.46
  totalCharges?: number;            // PV1.47
  totalAdjustments?: number;        // PV1.48
  totalPayments?: number;           // PV1.49
  alternateVisitId?: string;        // PV1.50
  visitIndicator?: 'A' | 'V';       // PV1.51
  otherHealthcareProvider?: ExtendedPerson[]; // PV1.52
}

/**
 * PV2 - Patient Visit Additional Information
 */
export interface PV2Segment {
  segmentType: 'PV2';
  priorPendingLocation?: PatientLocation; // PV2.1
  accommodationCode?: CodedElement; // PV2.2
  admitReason?: CodedElement;       // PV2.3
  transferReason?: CodedElement;    // PV2.4
  patientValuables?: string[];      // PV2.5
  patientValuablesLocation?: string; // PV2.6
  visitUserCode?: string[];         // PV2.7
  expectedAdmitDateTime?: string;   // PV2.8
  expectedDischargeDateTime?: string; // PV2.9
  estimatedLengthOfStay?: number;   // PV2.10
  actualLengthOfStay?: number;      // PV2.11
  visitDescription?: string;        // PV2.12
  referralSourceCode?: ExtendedPerson[]; // PV2.13
  previousServiceDate?: string;     // PV2.14
  employmentIllnessRelated?: 'Y' | 'N' | 'U'; // PV2.15
  purgeStatusCode?: string;         // PV2.16
  purgeStatusDate?: string;         // PV2.17
  specialProgramCode?: string;      // PV2.18
  retentionIndicator?: 'Y' | 'N';   // PV2.19
  expectedNumberOfInsurancePlans?: number; // PV2.20
  visitPublicityCode?: string;      // PV2.21
  visitProtectionIndicator?: 'Y' | 'N'; // PV2.22
  clinicOrganizationName?: ExtendedOrganization[]; // PV2.23
  patientStatusCode?: string;       // PV2.24
  visitPriorityCode?: string;       // PV2.25
  previousTreatmentDate?: string;   // PV2.26
  expectedDischargeDisposition?: string; // PV2.27
  signatureOnFileDate?: string;     // PV2.28
  firstSimilarIllnessDate?: string; // PV2.29
  patientChargeAdjustmentCode?: CodedElement; // PV2.30
  recurringServiceCode?: string;    // PV2.31
  billingMediaCode?: 'Y' | 'N';     // PV2.32
  expectedSurgeryDateTime?: string; // PV2.33
  militaryPartnershipCode?: 'Y' | 'N'; // PV2.34
  militaryNonAvailabilityCode?: 'Y' | 'N'; // PV2.35
  newbornBabyIndicator?: 'Y' | 'N'; // PV2.36
  babyDetainedIndicator?: 'Y' | 'N'; // PV2.37
  modeOfArrivalCode?: CodedElement; // PV2.38
  recreationalDrugUseCode?: CodedElement[]; // PV2.39
  admissionLevelOfCareCode?: CodedElement; // PV2.40
  precautionCode?: CodedElement[];  // PV2.41
  patientConditionCode?: CodedElement; // PV2.42
  livingWillCode?: 'Y' | 'N' | 'U' | 'F' | 'I'; // PV2.43
  organDonorCode?: 'Y' | 'N' | 'U' | 'F' | 'I' | 'P' | 'R'; // PV2.44
  advanceDirectiveCode?: CodedElement[]; // PV2.45
  patientStatusEffectiveDate?: string; // PV2.46
  expectedLoaReturnDateTime?: string; // PV2.47
  expectedPreadmitTestDateTime?: string; // PV2.48
  notifyClergyCode?: string[];      // PV2.49
}

/**
 * OBR - Observation Request Segment (for ORU/ORM)
 */
export interface OBRSegment {
  segmentType: 'OBR';
  setId?: number;                   // OBR.1
  placerOrderNumber?: string;       // OBR.2
  fillerOrderNumber?: string;       // OBR.3
  universalServiceIdentifier: CodedElement; // OBR.4
  priority?: string;                // OBR.5
  requestedDateTime?: string;       // OBR.6
  observationDateTime?: string;     // OBR.7
  observationEndDateTime?: string;  // OBR.8
  collectionVolume?: Quantity;      // OBR.9
  collectorIdentifier?: ExtendedPerson[]; // OBR.10
  specimenActionCode?: string;      // OBR.11
  dangerCode?: CodedElement;        // OBR.12
  relevantClinicalInfo?: string;    // OBR.13
  specimenReceivedDateTime?: string; // OBR.14
  specimenSource?: SpecimenSource;  // OBR.15
  orderingProvider?: ExtendedPerson[]; // OBR.16
  orderCallbackPhone?: ExtendedTelecom[]; // OBR.17
  placerField1?: string;            // OBR.18
  placerField2?: string;            // OBR.19
  fillerField1?: string;            // OBR.20
  fillerField2?: string;            // OBR.21
  resultsReportStatusChangeDateTime?: string; // OBR.22
  chargeToPractice?: string;        // OBR.23
  diagnosticServiceSectionId?: string; // OBR.24
  resultStatus?: 'O' | 'I' | 'S' | 'A' | 'P' | 'C' | 'R' | 'F' | 'X' | 'Y' | 'Z'; // OBR.25
  parentResult?: ParentResult;      // OBR.26
  quantityTiming?: string[];        // OBR.27
  resultCopiesTo?: ExtendedPerson[]; // OBR.28
  parent?: ParentOrder;             // OBR.29
  transportationMode?: string;      // OBR.30
  reasonForStudy?: CodedElement[];  // OBR.31
  principalResultInterpreter?: ExtendedPerson; // OBR.32
  assistantResultInterpreter?: ExtendedPerson[]; // OBR.33
  technician?: ExtendedPerson[];    // OBR.34
  transcriptionist?: ExtendedPerson[]; // OBR.35
  scheduledDateTime?: string;       // OBR.36
  numberOfSampleContainers?: number; // OBR.37
  transportLogisticsOfCollectedSample?: CodedElement[]; // OBR.38
  collectorsComment?: CodedElement[]; // OBR.39
  transportArrangementResponsibility?: CodedElement; // OBR.40
  transportArranged?: 'A' | 'N' | 'U'; // OBR.41
  escortRequired?: 'Y' | 'N' | 'U'; // OBR.42
  plannedPatientTransportComment?: CodedElement[]; // OBR.43
  procedureCode?: CodedElement;     // OBR.44
  procedureCodeModifier?: CodedElement[]; // OBR.45
  placerSupplementalServiceInfo?: CodedElement[]; // OBR.46
  fillerSupplementalServiceInfo?: CodedElement[]; // OBR.47
  medicallyNecessaryDuplicateProcedureReason?: CodedElement; // OBR.48
  resultHandling?: string;          // OBR.49
  parentUniversalServiceIdentifier?: CodedElement; // OBR.50
}

/**
 * OBX - Observation Result Segment
 */
export interface OBXSegment {
  segmentType: 'OBX';
  setId?: number;                   // OBX.1
  valueType?: OBXValueType;         // OBX.2
  observationIdentifier: CodedElement; // OBX.3
  observationSubId?: string;        // OBX.4
  observationValue?: string[];      // OBX.5 (interpretation depends on valueType)
  units?: CodedElement;             // OBX.6
  referenceRange?: string;          // OBX.7
  abnormalFlags?: string[];         // OBX.8
  probability?: number;             // OBX.9
  natureOfAbnormalTest?: string[];  // OBX.10
  observationResultStatus: 'C' | 'D' | 'F' | 'I' | 'N' | 'O' | 'P' | 'R' | 'S' | 'U' | 'W' | 'X'; // OBX.11
  effectiveDateOfReferenceRange?: string; // OBX.12
  userDefinedAccessChecks?: string; // OBX.13
  dateTimeOfObservation?: string;   // OBX.14
  producersId?: CodedElement;       // OBX.15
  responsibleObserver?: ExtendedPerson[]; // OBX.16
  observationMethod?: CodedElement[]; // OBX.17
  equipmentInstanceIdentifier?: string[]; // OBX.18
  dateTimeOfAnalysis?: string;      // OBX.19
  observationSite?: CodedElement[]; // OBX.20
  observationInstanceIdentifier?: string; // OBX.21
  moodCode?: 'EVN' | 'GOL' | 'INT' | 'PRMS' | 'PRP' | 'RQO'; // OBX.22
  performingOrganizationName?: ExtendedOrganization; // OBX.23
  performingOrganizationAddress?: Address; // OBX.24
  performingOrganizationMedicalDirector?: ExtendedPerson; // OBX.25
}

/**
 * OBX Value Types
 */
export type OBXValueType =
  | 'AD'  // Address
  | 'CE'  // Coded Entry
  | 'CF'  // Coded Element with Formatted Values
  | 'CK'  // Composite ID with Check Digit
  | 'CN'  // Composite ID and Name
  | 'CP'  // Composite Price
  | 'CWE' // Coded with Exceptions
  | 'CX'  // Extended Composite ID
  | 'DT'  // Date
  | 'ED'  // Encapsulated Data
  | 'FT'  // Formatted Text
  | 'MO'  // Money
  | 'NM'  // Numeric
  | 'PN'  // Person Name
  | 'RP'  // Reference Pointer
  | 'SN'  // Structured Numeric
  | 'ST'  // String
  | 'TM'  // Time
  | 'TN'  // Telephone Number
  | 'TS'  // Time Stamp
  | 'TX'  // Text Data
  | 'XAD' // Extended Address
  | 'XCN' // Extended Composite Name
  | 'XON' // Extended Composite Organization Name
  | 'XPN' // Extended Person Name
  | 'XTN'; // Extended Telephone Number

/**
 * ORC - Common Order Segment
 */
export interface ORCSegment {
  segmentType: 'ORC';
  orderControl: string;             // ORC.1 (NW, OK, CA, DC, etc.)
  placerOrderNumber?: string;       // ORC.2
  fillerOrderNumber?: string;       // ORC.3
  placerGroupNumber?: string;       // ORC.4
  orderStatus?: 'A' | 'CA' | 'CM' | 'DC' | 'ER' | 'HD' | 'IP' | 'RP' | 'SC'; // ORC.5
  responseFlag?: 'E' | 'D' | 'F' | 'N' | 'R'; // ORC.6
  quantityTiming?: string[];        // ORC.7
  parent?: ParentOrder;             // ORC.8
  dateTimeOfTransaction?: string;   // ORC.9
  enteredBy?: ExtendedPerson[];     // ORC.10
  verifiedBy?: ExtendedPerson[];    // ORC.11
  orderingProvider?: ExtendedPerson[]; // ORC.12
  enterersLocation?: PatientLocation; // ORC.13
  callBackPhoneNumber?: ExtendedTelecom[]; // ORC.14
  orderEffectiveDateTime?: string;  // ORC.15
  orderControlCodeReason?: CodedElement; // ORC.16
  enteringOrganization?: CodedElement; // ORC.17
  enteringDevice?: CodedElement;    // ORC.18
  actionBy?: ExtendedPerson[];      // ORC.19
  advancedBeneficiaryNoticeCode?: CodedElement; // ORC.20
  orderingFacilityName?: ExtendedOrganization[]; // ORC.21
  orderingFacilityAddress?: Address[]; // ORC.22
  orderingFacilityPhoneNumber?: ExtendedTelecom[]; // ORC.23
  orderingProviderAddress?: Address[]; // ORC.24
  orderStatusModifier?: CodedElement; // ORC.25
  advancedBeneficiaryNoticeOverrideReason?: CodedElement; // ORC.26
  fillersExpectedAvailabilityDateTime?: string; // ORC.27
  confidentialityCode?: CodedElement; // ORC.28
  orderType?: CodedElement;         // ORC.29
  entererAuthorizationMode?: CodedElement; // ORC.30
  parentUniversalServiceIdentifier?: CodedElement; // ORC.31
}

/**
 * DG1 - Diagnosis Segment
 */
export interface DG1Segment {
  segmentType: 'DG1';
  setId: number;                    // DG1.1
  diagnosisCodingMethod?: string;   // DG1.2
  diagnosisCode?: CodedElement;     // DG1.3
  diagnosisDescription?: string;    // DG1.4
  diagnosisDateTime?: string;       // DG1.5
  diagnosisType: string;            // DG1.6 (A=Admitting, W=Working, F=Final)
  majorDiagnosticCategory?: CodedElement; // DG1.7
  diagnosticRelatedGroup?: CodedElement; // DG1.8
  drgApprovalIndicator?: 'Y' | 'N'; // DG1.9
  drgGrouperReviewCode?: string;    // DG1.10
  outlierType?: CodedElement;       // DG1.11
  outlierDays?: number;             // DG1.12
  outlierCost?: number;             // DG1.13
  grouperVersionAndType?: string;   // DG1.14
  diagnosisPriority?: number;       // DG1.15
  diagnosingClinician?: ExtendedPerson[]; // DG1.16
  diagnosisClassification?: string; // DG1.17
  confidentialIndicator?: 'Y' | 'N'; // DG1.18
  attestationDateTime?: string;     // DG1.19
  diagnosisIdentifier?: string;     // DG1.20
  diagnosisActionCode?: 'A' | 'D' | 'U'; // DG1.21
  parentDiagnosis?: string;         // DG1.22
  drgCclValueCode?: CodedElement;   // DG1.23
  drgGroupingUsage?: string;        // DG1.24
  drgDiagnosisDeterminationStatus?: CodedElement; // DG1.25
  presentOnAdmissionIndicator?: string; // DG1.26
}

/**
 * AL1 - Patient Allergy Information Segment
 */
export interface AL1Segment {
  segmentType: 'AL1';
  setId: number;                    // AL1.1
  allergenTypeCode?: CodedElement;  // AL1.2 (DA=Drug, FA=Food, MA=Misc, etc.)
  allergenCode: CodedElement;       // AL1.3
  allergySeverityCode?: string;     // AL1.4 (SV=Severe, MO=Moderate, MI=Mild)
  allergyReaction?: string[];       // AL1.5
  identificationDate?: string;      // AL1.6
}

/**
 * IN1 - Insurance Segment
 */
export interface IN1Segment {
  segmentType: 'IN1';
  setId: number;                    // IN1.1
  insurancePlanId?: CodedElement;   // IN1.2
  insuranceCompanyId?: string[];    // IN1.3
  insuranceCompanyName?: ExtendedOrganization[]; // IN1.4
  insuranceCompanyAddress?: Address[]; // IN1.5
  insuranceCompanyContactPerson?: ExtendedPerson[]; // IN1.6
  insuranceCompanyPhoneNumber?: ExtendedTelecom[]; // IN1.7
  groupNumber?: string;             // IN1.8
  groupName?: ExtendedOrganization[]; // IN1.9
  insuredGroupEmployerId?: string[]; // IN1.10
  insuredGroupEmployerName?: ExtendedOrganization[]; // IN1.11
  planEffectiveDate?: string;       // IN1.12
  planExpirationDate?: string;      // IN1.13
  authorizationInformation?: string; // IN1.14
  planType?: string;                // IN1.15
  nameOfInsured?: ExtendedPerson[]; // IN1.16
  insuredRelationshipToPatient?: CodedElement; // IN1.17
  insuredDateOfBirth?: string;      // IN1.18
  insuredAddress?: Address[];       // IN1.19
  assignmentOfBenefits?: string;    // IN1.20
  coordinationOfBenefits?: string;  // IN1.21
  coordinationOfBenefitsPriority?: string; // IN1.22
  noticeOfAdmissionFlag?: 'Y' | 'N'; // IN1.23
  noticeOfAdmissionDate?: string;   // IN1.24
  reportOfEligibilityFlag?: 'Y' | 'N'; // IN1.25
  reportOfEligibilityDate?: string; // IN1.26
  releaseInformationCode?: string;  // IN1.27
  preAdmitCertification?: string;   // IN1.28
  verificationDateTime?: string;    // IN1.29
  verificationBy?: ExtendedPerson[]; // IN1.30
  typeOfAgreementCode?: string;     // IN1.31
  billingStatus?: string;           // IN1.32
  lifetimeReserveDays?: number;     // IN1.33
  delayBeforeLifetimeReserveDays?: number; // IN1.34
  companyPlanCode?: string;         // IN1.35
  policyNumber?: string;            // IN1.36
  policyDeductible?: number;        // IN1.37
  policyLimitAmount?: number;       // IN1.38
  policyLimitDays?: number;         // IN1.39
  roomRateSemiPrivate?: number;     // IN1.40
  roomRatePrivate?: number;         // IN1.41
  insuredEmploymentStatus?: CodedElement; // IN1.42
  insuredAdministrativeSex?: 'M' | 'F' | 'O' | 'U'; // IN1.43
  insuredEmployerAddress?: Address[]; // IN1.44
  verificationStatus?: string;      // IN1.45
  priorInsurancePlanId?: string;    // IN1.46
  coverageType?: string;            // IN1.47
  handicap?: string;                // IN1.48
  insuredIdNumber?: string[];       // IN1.49
  signatureCode?: string;           // IN1.50
  signatureCodeDate?: string;       // IN1.51
  insuredBirthPlace?: string;       // IN1.52
  vipIndicator?: string;            // IN1.53
}

/**
 * NTE - Notes and Comments Segment
 */
export interface NTESegment {
  segmentType: 'NTE';
  setId?: number;                   // NTE.1
  sourceOfComment?: string;         // NTE.2 (L=Lab, P=Practitioner, etc.)
  comment?: string[];               // NTE.3
  commentType?: CodedElement;       // NTE.4
  enteredBy?: ExtendedPerson;       // NTE.5
  enteredDateTime?: string;         // NTE.6
  effectiveStartDate?: string;      // NTE.7
  expirationDate?: string;          // NTE.8
}

// ============================================================================
// SUPPORTING DATA TYPES
// ============================================================================

export interface PatientIdentifier {
  id: string;
  checkDigit?: string;
  checkDigitScheme?: string;
  assigningAuthority?: string;
  identifierTypeCode?: string;      // MR=Medical Record, SS=SSN, DL=Driver's License, etc.
  assigningFacility?: string;
  effectiveDate?: string;
  expirationDate?: string;
}

export interface HumanName {
  familyName?: string;
  givenName?: string;
  middleInitialOrName?: string;
  suffix?: string;
  prefix?: string;
  degree?: string;
  nameTypeCode?: 'A' | 'B' | 'C' | 'D' | 'L' | 'M' | 'N' | 'S' | 'T';
  nameRepresentationCode?: string;
  nameContext?: CodedElement;
  nameValidityRange?: DateRange;
  nameAssemblyOrder?: 'F' | 'G';
}

export interface Address {
  streetAddress?: string;
  otherDesignation?: string;
  city?: string;
  stateOrProvince?: string;
  zipOrPostalCode?: string;
  country?: string;
  addressType?: 'B' | 'C' | 'F' | 'H' | 'L' | 'M' | 'N' | 'O' | 'P' | 'RH' | 'S' | 'V';
  otherGeographicDesignation?: string;
  countyParishCode?: string;
  censusTract?: string;
  addressRepresentationCode?: string;
  addressValidityRange?: DateRange;
  effectiveDate?: string;
  expirationDate?: string;
}

export interface ExtendedTelecom {
  telephoneNumber?: string;
  telecommunicationUseCode?: 'ASN' | 'BPN' | 'EMR' | 'NET' | 'ORN' | 'PRN' | 'VHN' | 'WPN';
  telecommunicationEquipmentType?: 'BP' | 'CP' | 'FX' | 'Internet' | 'MD' | 'PH' | 'SAT' | 'TDD' | 'TTY' | 'X.400';
  communicationAddress?: string;    // email, URL, etc.
  countryCode?: number;
  areaCityCode?: number;
  localNumber?: number;
  extension?: number;
  anyText?: string;
  extensionPrefix?: string;
  speedDialCode?: string;
  unformattedTelephoneNumber?: string;
  effectiveStartDate?: string;
  expirationDate?: string;
  expirationReason?: CodedElement;
  protectionCode?: CodedElement;
  sharedTelecommunicationIdentifier?: string;
  preferenceOrder?: number;
}

export interface CodedElement {
  identifier?: string;
  text?: string;
  nameOfCodingSystem?: string;      // ICD10, SNOMED, LOINC, etc.
  alternateIdentifier?: string;
  alternateText?: string;
  nameOfAlternateCodingSystem?: string;
  codingSystemVersionId?: string;
  alternateCodingSystemVersionId?: string;
  originalText?: string;
}

export interface ExtendedPerson {
  idNumber?: string;
  familyName?: string;
  givenName?: string;
  middleInitialOrName?: string;
  suffix?: string;
  prefix?: string;
  degree?: string;
  sourceTable?: string;
  assigningAuthority?: string;
  nameTypeCode?: string;
  identifierCheckDigit?: string;
  checkDigitScheme?: string;
  identifierTypeCode?: string;
  assigningFacility?: string;
  nameRepresentationCode?: string;
  nameContext?: CodedElement;
  nameValidityRange?: DateRange;
  nameAssemblyOrder?: string;
  effectiveDate?: string;
  expirationDate?: string;
  professionalSuffix?: string;
  assigningJurisdiction?: CodedElement;
  assigningAgencyOrDepartment?: CodedElement;
}

export interface ExtendedOrganization {
  organizationName?: string;
  organizationNameTypeCode?: string;
  idNumber?: number;
  identifierCheckDigit?: string;
  checkDigitScheme?: string;
  assigningAuthority?: string;
  identifierTypeCode?: string;
  assigningFacility?: string;
  nameRepresentationCode?: string;
  organizationIdentifier?: string;
}

export interface PatientLocation {
  pointOfCare?: string;             // Nursing unit, ward
  room?: string;
  bed?: string;
  facility?: string;
  locationStatus?: string;
  personLocationType?: string;
  building?: string;
  floor?: string;
  locationDescription?: string;
  comprehensiveLocationIdentifier?: string;
  assigningAuthorityForLocation?: string;
}

export interface DischargeLocation {
  dischargeToLocation?: string;
  effectiveDate?: string;
}

export interface FinancialClass {
  financialClassCode: string;
  effectiveDate?: string;
}

export interface Quantity {
  quantity?: number;
  units?: CodedElement;
}

export interface SpecimenSource {
  specimenSourceNameOrCode?: CodedElement;
  additives?: CodedElement;
  specimenCollectionMethod?: string;
  bodySite?: CodedElement;
  siteModifier?: CodedElement;
  collectionMethodModifierCode?: CodedElement;
  specimenRole?: string;
}

export interface ParentResult {
  parentObservationIdentifier?: CodedElement;
  parentObservationSubIdentifier?: string;
  parentObservationValueDescriptor?: string;
}

export interface ParentOrder {
  placerAssignedIdentifier?: string;
  fillerAssignedIdentifier?: string;
}

export interface DateRange {
  rangeStartDateTime?: string;
  rangeEndDateTime?: string;
}

// ============================================================================
// MESSAGE STRUCTURES
// ============================================================================

/**
 * Parsed HL7 v2.x Message
 */
export interface HL7Message {
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
  orders?: ORCSegment[];
  diagnoses?: DG1Segment[];
  allergies?: AL1Segment[];
  insurance?: IN1Segment[];
  notes?: NTESegment[];
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
  | GenericSegment;

export interface GenericSegment {
  segmentType: string;
  fields: string[];
}

export interface HL7ParseError {
  segmentIndex: number;
  fieldIndex?: number;
  message: string;
  severity: 'warning' | 'error';
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
 */
export interface ORMMessage extends HL7Message {
  messageType: 'ORM';
  eventType: ORMEventType;
  patientIdentification?: PIDSegment;
  orders: Array<{
    commonOrder: ORCSegment;
    orderDetail?: OBRSegment;
    observations?: OBXSegment[];
  }>;
}

// ============================================================================
// ACK (ACKNOWLEDGMENT) MESSAGE
// ============================================================================

/**
 * MSA - Message Acknowledgment Segment
 */
export interface MSASegment {
  segmentType: 'MSA';
  acknowledgmentCode: 'AA' | 'AE' | 'AR' | 'CA' | 'CE' | 'CR'; // AA=Accept, AE=Error, AR=Reject
  messageControlId: string;
  textMessage?: string;
  expectedSequenceNumber?: number;
  delayedAcknowledgmentType?: string;
  errorCondition?: CodedElement;
}

/**
 * ERR - Error Segment
 */
export interface ERRSegment {
  segmentType: 'ERR';
  errorCodeAndLocation?: string;    // ERR.1 (deprecated)
  errorLocation?: ErrorLocation[];  // ERR.2
  hl7ErrorCode: CodedElement;       // ERR.3
  severity: 'E' | 'I' | 'W';        // ERR.4 (Error/Information/Warning)
  applicationErrorCode?: CodedElement; // ERR.5
  applicationErrorParameter?: string[]; // ERR.6
  diagnosticInformation?: string;   // ERR.7
  userMessage?: string;             // ERR.8
  informPersonIndicator?: string[]; // ERR.9
  overrideType?: CodedElement;      // ERR.10
  overrideReasonCode?: CodedElement[]; // ERR.11
  helpDeskContactPoint?: ExtendedTelecom[]; // ERR.12
}

export interface ErrorLocation {
  segmentId?: string;
  segmentSequence?: number;
  fieldPosition?: number;
  componentNumber?: number;
  subComponentNumber?: number;
}

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
