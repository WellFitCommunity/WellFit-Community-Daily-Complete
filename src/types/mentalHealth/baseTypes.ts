/**
 * Mental Health Base Types
 * Union types and type aliases for the mental health intervention system.
 *
 * Clinical Standards: Joint Commission, CMS CoP, Evidence-based suicide prevention
 * Compliance: HIPAA, Texas Health & Safety Code SS161.0075
 */

/** Mental health risk level -- 3-tier, no 'critical' (distinct from clinical/security RiskLevel) */
export type RiskLevel = 'low' | 'moderate' | 'high';
export type SessionType = 'inpatient' | 'outpatient' | 'telehealth';
export type SessionStatus = 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
export type ServiceRequestStatus = 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
export type ServiceRequestIntent = 'proposal' | 'plan' | 'directive' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
/** Mental health clinical priority -- HL7 request priority values (distinct from riskAssessment.Priority) */
export type Priority = 'routine' | 'urgent' | 'asap' | 'stat';

export type SuicidalIdeation = 'none' | 'passive' | 'active';
export type SuicidalPlan = 'none' | 'vague' | 'specific';
export type SuicidalIntent = 'none' | 'uncertain' | 'present';
export type MeansAccess = 'no_access' | 'potential_access' | 'immediate_access';

export type PHQ9Severity = 'none' | 'mild' | 'moderate' | 'moderately_severe' | 'severe';
export type GAD7Severity = 'none' | 'mild' | 'moderate' | 'severe';
export type AdjustmentResponse = 'adaptive' | 'maladaptive' | 'mixed';
export type PatientEngagement = 'engaged' | 'ambivalent' | 'resistant';

/** Mental health crisis escalation -- distinct from EDEscalationLevel */
export type MentalHealthEscalationLevel = 'moderate' | 'high' | 'stat';
/** @deprecated Use MentalHealthEscalationLevel */
export type EscalationLevel = MentalHealthEscalationLevel;
export type EscalationStatus = 'active' | 'in-progress' | 'resolved' | 'cancelled';

export type FlagType = 'suicide_risk' | 'active_monitoring' | 'psychiatric_consult_pending' | 'discharge_hold' | 'safety_plan_required' | 'high_risk_alert';
export type FlagStatus = 'active' | 'inactive' | 'entered-in-error';

export type Modality = 'in-person' | 'telehealth-video' | 'telehealth-phone';
export type OutcomeStatus = 'completed' | 'incomplete' | 'refused' | 'rescheduled';
export type DurationExceptionCode = 'patient_unstable' | 'patient_refused' | 'patient_distress' | 'emergency_intervention' | 'other';
