// TypeScript types for Patient Handoff System
// HIPAA-compliant transfer of care between facilities

export type HandoffStatus = 'draft' | 'sent' | 'acknowledged' | 'cancelled';

export type UrgencyLevel = 'routine' | 'urgent' | 'emergent' | 'critical';

export type HandoffSectionType =
  | 'demographics'
  | 'reason_for_transfer'
  | 'clinical_snapshot'
  | 'medications'
  | 'allergies'
  | 'vitals'
  | 'custom';

export type HandoffEventType =
  | 'created'
  | 'updated'
  | 'sent'
  | 'viewed'
  | 'acknowledged'
  | 'cancelled'
  | 'attachment_uploaded'
  | 'attachment_viewed'
  | 'access_token_generated'
  | 'access_denied';

// ============================================================================
// Core Handoff Packet
// ============================================================================

export interface HandoffPacket {
  id: string;
  packet_number: string;

  // Patient information (minimal PHI)
  patient_mrn?: string;
  patient_name_encrypted?: string;
  patient_dob_encrypted?: string;
  patient_gender?: 'M' | 'F' | 'X' | 'U';

  // Transfer details
  sending_facility: string;
  receiving_facility: string;
  urgency_level: UrgencyLevel;
  reason_for_transfer: string;

  // Clinical snapshot
  clinical_data: ClinicalData;

  // Sender information
  sender_provider_name: string;
  sender_callback_number: string;
  sender_notes?: string;
  sender_user_id?: string;

  // Receiver contact information (for Twilio SMS and MailerSend email)
  receiver_contact_name?: string;
  receiver_contact_email?: string;
  receiver_contact_phone?: string; // E.164 format: +1234567890
  notification_preferences?: {
    send_email?: boolean;
    send_sms?: boolean;
    email_sent?: boolean;
    sms_sent?: boolean;
    email_sent_at?: string;
    sms_sent_at?: string;
  };

  // Status tracking
  status: HandoffStatus;

  // Access control
  access_token: string;
  access_expires_at: string;

  // Acknowledgement
  acknowledged_by?: string;
  acknowledged_at?: string;
  acknowledgement_notes?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
  sent_at?: string;

  // Audit
  created_by: string;
  ip_address?: string;
  user_agent?: string;
}

// ============================================================================
// Clinical Data Structure
// ============================================================================

export interface ClinicalData {
  vitals?: VitalSigns;
  medications_given?: Medication[]; // Medications administered during visit
  medications_prescribed?: Medication[]; // Currently prescribed medications
  medications_current?: Medication[]; // Medications patient is currently taking (including OTC)
  allergies?: Allergy[];
  labs?: LabResult[]; // Structured lab data for analytics
  notes?: string;
}

export interface VitalSigns {
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  heart_rate?: number;
  respiratory_rate?: number;
  temperature?: number;
  temperature_unit?: 'F' | 'C';
  oxygen_saturation?: number;
  weight?: number;
  weight_unit?: 'lbs' | 'kg';
  recorded_at?: string;
}

export interface Medication {
  name: string;
  dosage: string;
  route?: string;
  frequency?: string;
  last_given?: string;
  notes?: string;
  // Medication categories for handoff
  category?: 'given' | 'prescribed' | 'current'; // given = meds given during visit, prescribed = currently prescribed, current = patient taking (including OTC)
}

export interface Allergy {
  allergen: string;
  reaction: string;
  severity?: 'mild' | 'moderate' | 'severe' | 'life-threatening';
}

export interface LabResult {
  test_name: string;
  value: string;
  unit?: string;
  reference_range?: string;
  abnormal?: boolean;
  performed_at?: string;
}

// ============================================================================
// Handoff Sections
// ============================================================================

export interface HandoffSection {
  id: string;
  handoff_packet_id: string;
  section_type: HandoffSectionType;
  section_data: Record<string, string | number | boolean | null>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Attachments
// ============================================================================

export interface HandoffAttachment {
  id: string;
  handoff_packet_id: string;
  file_name: string;
  file_type: string;
  file_size_bytes?: number;
  storage_bucket: string;
  storage_path: string;
  mime_type?: string;
  uploaded_by?: string;
  is_encrypted: boolean;
  created_at: string;
}

export interface AttachmentUpload {
  file: File;
  handoff_packet_id: string;
}

// ============================================================================
// Audit Logs
// ============================================================================

export interface HandoffLog {
  id: number;
  handoff_packet_id: string;
  event_type: HandoffEventType;
  event_description: string;
  user_id?: string;
  user_email?: string;
  user_role?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, string | number | boolean | null>;
  timestamp: string;
}

// ============================================================================
// Form Data Types for Lite Sender Portal
// ============================================================================

export interface DemographicsFormData {
  patient_name: string;
  patient_dob: string;
  patient_mrn?: string;
  patient_gender?: 'M' | 'F' | 'X' | 'U';
  sending_facility: string;
}

export interface TransferReasonFormData {
  reason_for_transfer: string;
  urgency_level: UrgencyLevel;
}

export interface ClinicalSnapshotFormData {
  vitals?: VitalSigns;
  medications_given?: Medication[];
  medications_prescribed?: Medication[];
  medications_current?: Medication[];
  allergies?: Allergy[];
  labs?: LabResult[];
  notes?: string;
}

export interface SenderInfoFormData {
  sender_provider_name: string;
  sender_callback_number: string;
  sender_notes?: string;
}

export interface CompleteHandoffFormData
  extends DemographicsFormData,
    TransferReasonFormData,
    ClinicalSnapshotFormData,
    SenderInfoFormData {
  receiving_facility: string;
  attachments?: File[];
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CreateHandoffPacketRequest {
  // Demographics
  patient_name: string; // Will be encrypted
  patient_dob: string; // Will be encrypted
  patient_mrn?: string;
  patient_gender?: 'M' | 'F' | 'X' | 'U';

  // Transfer details
  sending_facility: string;
  receiving_facility: string;
  urgency_level: UrgencyLevel;
  reason_for_transfer: string;

  // Clinical data
  clinical_data: ClinicalData;

  // Sender info
  sender_provider_name: string;
  sender_callback_number: string;
  sender_notes?: string;

  // Receiver contact info (for Twilio SMS and MailerSend email notifications)
  receiver_contact_name?: string;
  receiver_contact_email?: string;
  receiver_contact_phone?: string; // E.164 format: +1234567890
}

export interface CreateHandoffPacketResponse {
  packet: HandoffPacket;
  access_url: string; // Full URL with token for receiving facility
}

export interface SendHandoffPacketRequest {
  packet_id: string;
  send_confirmation_sms?: boolean;
  send_confirmation_email?: boolean;
}

export interface AcknowledgeHandoffPacketRequest {
  packet_id: string;
  acknowledgement_notes?: string;
}

export interface HandoffPacketListFilters {
  status?: HandoffStatus;
  sending_facility?: string;
  receiving_facility?: string;
  urgency_level?: UrgencyLevel;
  date_from?: string;
  date_to?: string;
  search?: string; // Search packet_number or patient_mrn
}

export interface HandoffPacketStats {
  total_packets: number;
  sent_packets: number;
  acknowledged_packets: number;
  pending_acknowledgement: number;
  average_acknowledgement_time_minutes?: number;
  packets_by_status: Record<HandoffStatus, number>;
  packets_by_urgency: Record<UrgencyLevel, number>;
}

// ============================================================================
// Component Props Types
// ============================================================================

export interface LiteSenderPortalProps {
  facilityName?: string;
  onPacketCreated?: (packet: HandoffPacket, accessUrl: string) => void;
}

export interface ReceivingFacilityDashboardProps {
  facilityName: string;
}

export interface AdminTransferLogsProps {
  showExportButton?: boolean;
  defaultFilters?: HandoffPacketListFilters;
}

export interface HandoffPacketViewerProps {
  packetId: string;
  allowAcknowledge?: boolean;
  onAcknowledged?: (packet: HandoffPacket) => void;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface EncryptionResult {
  encrypted: string;
  iv: string;
  tag: string;
}

export interface DecryptionParams {
  encrypted: string;
  iv: string;
  tag: string;
}

export interface TokenValidationResult {
  isValid: boolean;
  packet?: HandoffPacket;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  routine: 'Routine',
  urgent: 'Urgent',
  emergent: 'Emergent',
  critical: 'Critical',
};

export const URGENCY_COLORS: Record<UrgencyLevel, string> = {
  routine: 'bg-blue-100 text-blue-800',
  urgent: 'bg-yellow-100 text-yellow-800',
  emergent: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

export const STATUS_LABELS: Record<HandoffStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  acknowledged: 'Acknowledged',
  cancelled: 'Cancelled',
};

export const STATUS_COLORS: Record<HandoffStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  acknowledged: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
  // Note: DICOM support requires additional libraries
  // 'application/dicom',
];

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export const DEFAULT_ACCESS_EXPIRY_HOURS = 72;
