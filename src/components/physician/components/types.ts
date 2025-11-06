/**
 * Physician Panel Type Definitions
 * Shared interfaces for physician dashboard components
 */

export interface PatientListItem {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  dob: string;
  phone?: string;
  email?: string;
  risk_score?: number;
  ccm_eligible?: boolean;
  active_conditions_count?: number;
  last_visit?: string;
}

export interface PatientVitals {
  bloodPressure?: string;
  heartRate?: number;
  oxygenSaturation?: number;
  temperature?: number;
  weight?: number;
  bmi?: number;
  lastUpdated?: string;
}

export interface PatientSummary {
  demographics: PatientListItem;
  vitals: PatientVitals;
  activeConditions: number;
  activeMedications: number;
  upcomingAppointments: number;
  pendingLabs: number;
  sdohComplexity: number;
  ccmEligible: boolean;
}

export interface QuickStat {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: { value: string; positive: boolean };
  action?: () => void;
}
