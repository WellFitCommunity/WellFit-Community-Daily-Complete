/**
 * HL7 v2.x Core Type Definitions
 *
 * Core types, constants, and event type enumerations for HL7 v2.x messaging.
 * Supports v2.3 - v2.8.
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
