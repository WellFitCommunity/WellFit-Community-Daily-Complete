/**
 * Encounter Visit State Machine Types
 *
 * Defines the clinical visit lifecycle for doctor's office workflow.
 * States flow: draft → scheduled → arrived → triaged → in_progress →
 *              ready_for_sign → signed → ready_for_billing → billed → completed
 *
 * Terminal states: completed, cancelled, no_show
 */

/** All valid encounter statuses */
export const ENCOUNTER_STATUSES = [
  'draft',
  'scheduled',
  'arrived',
  'triaged',
  'in_progress',
  'ready_for_sign',
  'signed',
  'ready_for_billing',
  'billed',
  'completed',
  'cancelled',
  'no_show',
] as const;

export type EncounterStatus = (typeof ENCOUNTER_STATUSES)[number];

/** States where encounter data can still be edited */
export const EDITABLE_STATUSES: readonly EncounterStatus[] = [
  'draft',
  'scheduled',
  'arrived',
  'triaged',
  'in_progress',
  'ready_for_sign',
] as const;

/** Terminal states — no further transitions allowed */
export const TERMINAL_STATUSES: readonly EncounterStatus[] = [
  'completed',
  'cancelled',
  'no_show',
] as const;

/** States that indicate the visit is finalized (immutable clinical data) */
export const FINALIZED_STATUSES: readonly EncounterStatus[] = [
  'signed',
  'ready_for_billing',
  'billed',
  'completed',
] as const;

/** Valid transitions map — source of truth matches DB table */
export const VALID_TRANSITIONS: Record<EncounterStatus, readonly EncounterStatus[]> = {
  draft:              ['scheduled', 'arrived', 'in_progress', 'cancelled'],
  scheduled:          ['arrived', 'cancelled', 'no_show'],
  arrived:            ['triaged', 'cancelled'],
  triaged:            ['in_progress'],
  in_progress:        ['ready_for_sign'],
  ready_for_sign:     ['in_progress', 'signed'],
  signed:             ['ready_for_billing', 'ready_for_sign'],
  ready_for_billing:  ['billed'],
  billed:             ['completed'],
  completed:          [],
  cancelled:          [],
  no_show:            [],
};

/** Encounter type values */
export const ENCOUNTER_TYPES = [
  'office_visit',
  'follow_up',
  'new_patient',
  'annual_wellness',
  'urgent',
  'telehealth',
  'procedure',
  'consultation',
  'pre_op',
  'post_op',
] as const;

export type EncounterType = (typeof ENCOUNTER_TYPES)[number];

/** Status display metadata for UI */
export interface EncounterStatusMeta {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
  description: string;
}

export const STATUS_DISPLAY: Record<EncounterStatus, EncounterStatusMeta> = {
  draft:              { label: 'Draft',             color: 'text-gray-600',   bgColor: 'bg-gray-100',   icon: 'FileText',    description: 'Encounter created, not yet scheduled' },
  scheduled:          { label: 'Scheduled',         color: 'text-blue-600',   bgColor: 'bg-blue-100',   icon: 'Calendar',    description: 'Appointment booked' },
  arrived:            { label: 'Arrived',           color: 'text-cyan-600',   bgColor: 'bg-cyan-100',   icon: 'UserCheck',   description: 'Patient checked in' },
  triaged:            { label: 'Triaged',           color: 'text-teal-600',   bgColor: 'bg-teal-100',   icon: 'Activity',    description: 'Vitals taken, patient roomed' },
  in_progress:        { label: 'In Progress',       color: 'text-amber-600',  bgColor: 'bg-amber-100',  icon: 'Stethoscope', description: 'Provider seeing patient' },
  ready_for_sign:     { label: 'Ready for Sign',    color: 'text-orange-600', bgColor: 'bg-orange-100', icon: 'PenTool',     description: 'Documentation complete, awaiting signature' },
  signed:             { label: 'Signed',            color: 'text-purple-600', bgColor: 'bg-purple-100', icon: 'CheckSquare', description: 'Provider attested documentation' },
  ready_for_billing:  { label: 'Ready for Billing', color: 'text-indigo-600', bgColor: 'bg-indigo-100', icon: 'DollarSign',  description: 'Codes confirmed, ready for claim' },
  billed:             { label: 'Billed',            color: 'text-emerald-600',bgColor: 'bg-emerald-100',icon: 'Send',        description: 'Claim submitted' },
  completed:          { label: 'Completed',         color: 'text-green-600',  bgColor: 'bg-green-100',  icon: 'CheckCircle', description: 'Visit fully resolved' },
  cancelled:          { label: 'Cancelled',         color: 'text-red-600',    bgColor: 'bg-red-100',    icon: 'XCircle',     description: 'Visit cancelled' },
  no_show:            { label: 'No Show',           color: 'text-rose-600',   bgColor: 'bg-rose-100',   icon: 'UserX',       description: 'Patient did not show' },
};

/** Status history entry */
export interface EncounterStatusHistoryEntry {
  id: string;
  encounter_id: string;
  from_status: EncounterStatus | null;
  to_status: EncounterStatus;
  changed_by: string | null;
  changed_at: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  tenant_id: string;
}

/** Transition result from the database function */
export interface TransitionResult {
  valid: boolean;
  from_status?: EncounterStatus;
  to_status?: EncounterStatus;
  encounter_id?: string;
  changed_at?: string;
  error?: string;
  code?: string;
  no_op?: boolean;
  message?: string;
}

// Type guards
export function isEncounterStatus(value: unknown): value is EncounterStatus {
  return typeof value === 'string' && ENCOUNTER_STATUSES.includes(value as EncounterStatus);
}

export function isEditable(status: EncounterStatus): boolean {
  return (EDITABLE_STATUSES as readonly string[]).includes(status);
}

export function isFinalized(status: EncounterStatus): boolean {
  return (FINALIZED_STATUSES as readonly string[]).includes(status);
}

export function isTerminal(status: EncounterStatus): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

export function canTransitionTo(from: EncounterStatus, to: EncounterStatus): boolean {
  return (VALID_TRANSITIONS[from] as readonly string[]).includes(to);
}

export function getAvailableTransitions(status: EncounterStatus): readonly EncounterStatus[] {
  return VALID_TRANSITIONS[status] ?? [];
}
