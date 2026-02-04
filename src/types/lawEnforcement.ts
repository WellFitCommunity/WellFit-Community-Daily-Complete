/**
 * Law Enforcement Types
 *
 * Types for The SHIELD Program (Senior & Health-Impaired Emergency Liaison Dispatch)
 * Emergency response information for constable dispatch
 */

/**
 * Response priority levels
 */
export type ResponsePriority = 'standard' | 'high' | 'critical';

/**
 * Emergency response information for senior welfare checks
 */
export interface EmergencyResponseInfo {
  id: string;
  tenantId: string;
  patientId: string;

  // Mobility Status
  bedBound: boolean;
  wheelchairBound: boolean;
  walkerRequired: boolean;
  caneRequired: boolean;
  mobilityNotes?: string;

  // Medical Equipment
  oxygenDependent: boolean;
  oxygenTankLocation?: string;
  dialysisRequired: boolean;
  dialysisSchedule?: string;
  medicalEquipment: string[];

  // Disability & Communication
  hearingImpaired: boolean;
  hearingImpairedNotes?: string;
  visionImpaired: boolean;
  visionImpairedNotes?: string;
  cognitiveImpairment: boolean;
  cognitiveImpairmentType?: string;
  cognitiveImpairmentNotes?: string;
  nonVerbal: boolean;
  languageBarrier?: string;

  // Building Location
  floorNumber?: string;
  buildingQuadrant?: string;
  elevatorRequired: boolean;
  elevatorAccessCode?: string;
  buildingType?: string;
  stairsToUnit?: number;

  // Emergency Access
  doorCode?: string;
  keyLocation?: string;
  accessInstructions?: string;
  doorOpensInward: boolean;
  securitySystem: boolean;
  securitySystemCode?: string;
  petsInHome?: string;
  parkingInstructions?: string;
  gatedCommunityCode?: string;
  lobbyAccessInstructions?: string;
  bestEntrance?: string;
  intercomInstructions?: string;

  // Fall Risk & Hazards
  fallRiskHigh: boolean;
  fallHistory?: string;
  homeHazards?: string;

  // Emergency Contacts (additional)
  neighborName?: string;
  neighborAddress?: string;
  neighborPhone?: string;
  buildingManagerName?: string;
  buildingManagerPhone?: string;

  // Response Priority
  responsePriority: ResponsePriority;
  escalationDelayHours: number;
  specialInstructions?: string;

  // Medications & Medical Conditions
  criticalMedications: string[];
  medicationLocation?: string;
  medicalConditionsSummary?: string;

  // Consent & Legal
  consentObtained: boolean;
  consentDate?: string;
  consentGivenBy?: string;
  hipaaAuthorization: boolean;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  lastVerifiedDate?: string;
}

/**
 * Welfare check dispatch information
 * Complete view shown to constables responding to missed check-in
 */
export interface WelfareCheckInfo {
  // Senior Demographics
  patientId: string;
  patientName: string;
  patientAge: number;
  patientPhone: string;
  patientAddress: string;

  // Building Location
  buildingLocation?: string;
  floorNumber?: string;
  elevatorRequired: boolean;
  parkingInstructions?: string;

  // Mobility & Equipment
  mobilityStatus: string;
  medicalEquipment: string[];

  // Communication Needs
  communicationNeeds: string;

  // Access Information
  accessInstructions: string;
  pets?: string;

  // Priority & Instructions
  responsePriority: ResponsePriority;
  specialInstructions?: string;

  // Emergency Contacts
  emergencyContacts: EmergencyContact[];
  neighborInfo?: NeighborInfo;

  // Risk Factors
  fallRisk: boolean;
  cognitiveImpairment: boolean;
  oxygenDependent: boolean;

  // Check-in Status
  lastCheckInTime?: string;
  hoursSinceCheckIn?: number;
}

/**
 * Emergency contact information
 */
export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  isPrimary: boolean;
}

/**
 * Neighbor information for emergency access
 */
export interface NeighborInfo {
  name: string;
  address: string;
  phone: string;
}

/**
 * Missed check-in alert for dispatch queue
 */
export interface MissedCheckInAlert {
  patientId: string;
  patientName: string;
  patientAddress: string;
  patientPhone: string;
  hoursSinceCheckIn: number;
  responsePriority: ResponsePriority;
  mobilityStatus: string;
  specialNeeds: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  urgencyScore: number;
}

/**
 * Senior check-in status for real-time monitoring
 */
export interface SeniorCheckInStatus {
  patientId: string;
  patientName: string;
  patientAddress: string;
  lastCheckIn?: string;
  status: 'ok' | 'pending' | 'overdue' | 'critical';
  hoursSinceCheckIn?: number;
  responsePriority: ResponsePriority;
  requiresAction: boolean;
}

/**
 * Welfare check outcome values (7-value enum matching database)
 */
export type WelfareCheckOutcome =
  | 'senior_ok'
  | 'senior_ok_needs_followup'
  | 'senior_not_home'
  | 'medical_emergency'
  | 'non_medical_emergency'
  | 'unable_to_contact'
  | 'refused_check';

/**
 * Welfare check report (after officer completes check)
 */
export interface WelfareCheckReport {
  id: string;
  tenantId: string;
  patientId: string;
  officerId: string;
  officerName: string;

  checkInitiatedAt: string;
  checkCompletedAt: string;
  responseTimeMinutes: number;

  outcome: WelfareCheckOutcome;
  outcomeNotes?: string;

  emsCalled: boolean;
  familyNotified: boolean;
  actionsTaken: string[];

  transportedTo?: string;
  transportReason?: string;

  followupRequired: boolean;
  followupDate?: string;
  followupNotes?: string;

  createdAt: string;
  updatedAt: string;
}

/**
 * Form data for filing a welfare check report
 */
export interface WelfareCheckReportFormData {
  tenantId: string;
  patientId: string;
  officerId: string;
  officerName: string;

  checkInitiatedAt: string;
  checkCompletedAt: string;

  outcome: WelfareCheckOutcome;
  outcomeNotes?: string;

  emsCalled: boolean;
  familyNotified: boolean;
  actionsTaken: string[];

  transportedTo?: string;
  transportReason?: string;

  followupRequired: boolean;
  followupDate?: string;
  followupNotes?: string;
}

/**
 * Get human-readable label for a welfare check outcome
 */
export function getOutcomeLabel(outcome: WelfareCheckOutcome): string {
  switch (outcome) {
    case 'senior_ok': return 'Senior OK';
    case 'senior_ok_needs_followup': return 'OK - Needs Follow-up';
    case 'senior_not_home': return 'Not Home';
    case 'medical_emergency': return 'Medical Emergency';
    case 'non_medical_emergency': return 'Non-Medical Emergency';
    case 'unable_to_contact': return 'Unable to Contact';
    case 'refused_check': return 'Refused Check';
    default: return 'Unknown';
  }
}

/**
 * Get severity level for outcome color coding
 */
export function getOutcomeSeverity(outcome: WelfareCheckOutcome): 'success' | 'warning' | 'error' {
  switch (outcome) {
    case 'senior_ok':
      return 'success';
    case 'senior_ok_needs_followup':
    case 'senior_not_home':
    case 'unable_to_contact':
    case 'refused_check':
      return 'warning';
    case 'medical_emergency':
    case 'non_medical_emergency':
      return 'error';
    default:
      return 'warning';
  }
}

/**
 * Form data for creating/updating emergency response info
 */
export interface EmergencyResponseFormData {
  // Mobility
  bedBound: boolean;
  wheelchairBound: boolean;
  walkerRequired: boolean;
  caneRequired: boolean;
  mobilityNotes: string;

  // Equipment
  oxygenDependent: boolean;
  oxygenTankLocation: string;
  dialysisRequired: boolean;
  dialysisSchedule: string;
  medicalEquipment: string[];

  // Communication
  hearingImpaired: boolean;
  hearingImpairedNotes: string;
  visionImpaired: boolean;
  visionImpairedNotes: string;
  cognitiveImpairment: boolean;
  cognitiveImpairmentType: string;
  cognitiveImpairmentNotes: string;
  nonVerbal: boolean;
  languageBarrier: string;

  // Building Location
  floorNumber: string;
  buildingQuadrant: string;
  elevatorRequired: boolean;
  elevatorAccessCode: string;
  buildingType: string;
  stairsToUnit: number;

  // Access
  doorCode: string;
  keyLocation: string;
  accessInstructions: string;
  doorOpensInward: boolean;
  securitySystem: boolean;
  securitySystemCode: string;
  petsInHome: string;
  parkingInstructions: string;
  gatedCommunityCode: string;
  lobbyAccessInstructions: string;
  bestEntrance: string;
  intercomInstructions: string;

  // Risk
  fallRiskHigh: boolean;
  fallHistory: string;
  homeHazards: string;

  // Contacts
  neighborName: string;
  neighborAddress: string;
  neighborPhone: string;
  buildingManagerName: string;
  buildingManagerPhone: string;

  // Priority
  responsePriority: ResponsePriority;
  escalationDelayHours: number;
  specialInstructions: string;

  // Medical
  criticalMedications: string[];
  medicationLocation: string;
  medicalConditionsSummary: string;

  // Consent
  consentObtained: boolean;
  consentDate: string;
  consentGivenBy: string;
  hipaaAuthorization: boolean;
}

/**
 * Tenant module configuration for law enforcement features
 */
export interface LawEnforcementModuleConfig {
  lawEnforcementEnabled: boolean;
  seniorResponseEnabled: boolean;
  welfareCheckEnabled: boolean;
  emergencyResponseInfoEnabled: boolean;
  dispatchIntegrationEnabled: boolean;

  // Configuration
  defaultEscalationDelayHours: number;
  checkInReminderEnabled: boolean;
  checkInReminderTime: string; // "10:00"
  familyNotificationEnabled: boolean;

  // Branding
  organizationName: string; // e.g. "County Sheriff", "City Police"
  organizationType: 'police' | 'sheriffs' | 'constables';
}

/**
 * Helper function to get mobility status display text
 */
export function getMobilityStatusText(info: EmergencyResponseInfo): string {
  if (info.bedBound) return 'Bed-bound';
  if (info.wheelchairBound) return 'Wheelchair user';
  if (info.walkerRequired) return 'Walker required';
  if (info.caneRequired) return 'Cane required';
  return 'Ambulatory';
}

/**
 * Helper function to get urgency level color
 */
export function getUrgencyColor(priority: ResponsePriority): string {
  switch (priority) {
    case 'critical': return 'red';
    case 'high': return 'orange';
    case 'standard': return 'blue';
    default: return 'gray';
  }
}

/**
 * Helper function to determine if welfare check is needed
 */
export function needsWelfareCheck(
  hoursSinceCheckIn: number,
  escalationDelayHours: number,
  priority: ResponsePriority
): boolean {
  // Critical priority: check after 2 hours regardless of configured delay
  if (priority === 'critical' && hoursSinceCheckIn >= 2) {
    return true;
  }

  // High priority: check after 4 hours regardless of configured delay
  if (priority === 'high' && hoursSinceCheckIn >= 4) {
    return true;
  }

  // Standard: use configured escalation delay
  return hoursSinceCheckIn >= escalationDelayHours;
}
