/**
 * Priority Scoring Logic
 *
 * Composite AI scoring for patient prioritization.
 * Weights: Location (30) + Alerts (40) + Readmission (25) + Fall Risk (15) + Engagement (10) + Vitals (10)
 */

export type PriorityLevel = 'critical' | 'high' | 'moderate' | 'low';

export interface PriorityPatient {
  patient_id: string;
  first_name: string;
  last_name: string;
  dob: string;
  location: string;
  encounter_status: string | null;
  encounter_type: string | null;
  encounter_id: string | null;
  priority_score: number;
  priority_level: PriorityLevel;
  readmission_risk: number | null;
  fall_risk: number | null;
  engagement_score: number | null;
  active_alerts: number;
  critical_alerts: number;
  latest_bp: string | null;
  latest_hr: number | null;
  latest_spo2: number | null;
  risk_flags: string[];
}

export interface EncounterRow {
  id: string;
  patient_id: string;
  status: string;
  encounter_type: string;
}

export interface AlertRow {
  patient_id: string;
  severity: string;
}

export interface RiskRow {
  patient_id: string;
  readmission_risk_30_day: number;
  risk_category: string;
}

export interface FallRiskRow {
  patient_id: string;
  overall_risk_score: number;
}

export interface EngagementRow {
  user_id: string;
  engagement_score: number;
  negative_moods_30d: number;
}

export interface CheckInRow {
  user_id: string;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  heart_rate: number | null;
  pulse_oximeter: number | null;
}

export interface CareTeamRow {
  patient_id: string;
  member_role: string;
  is_primary: boolean;
}

export interface ProfileRow {
  user_id: string;
  first_name: string;
  last_name: string;
  dob: string;
}

export function getLocationScore(encounterType: string | null, encounterStatus: string | null): number {
  if (!encounterType && !encounterStatus) return 0;
  if (encounterType === 'urgent' || encounterStatus === 'triaged') return 30;
  if (encounterStatus === 'in_progress') return 25;
  if (encounterStatus === 'arrived') return 20;
  if (encounterType === 'telehealth') return 15;
  if (encounterType === 'procedure' || encounterType === 'consultation') return 15;
  if (encounterStatus === 'scheduled') return 5;
  return 10;
}

export function getLocationLabel(encounterType: string | null, encounterStatus: string | null): string {
  if (!encounterType && !encounterStatus) return 'Home / Community';
  if (encounterType === 'urgent') return 'Urgent / ER';
  if (encounterStatus === 'triaged') return 'Triaged';
  if (encounterStatus === 'in_progress') return 'In Progress';
  if (encounterStatus === 'arrived') return 'Arrived';
  if (encounterType === 'telehealth') return 'Telehealth';
  if (encounterType === 'procedure') return 'Procedure';
  if (encounterType === 'consultation') return 'Consultation';
  if (encounterStatus === 'scheduled') return 'Scheduled';
  return encounterType || encounterStatus || 'Unknown';
}

export function calculatePriorityScore(
  locationScore: number,
  readmissionRisk: number | null,
  fallRisk: number | null,
  engagementScore: number | null,
  criticalAlerts: number,
  activeAlerts: number,
  abnormalVitals: boolean,
): number {
  let score = 0;
  score += locationScore;
  score += Math.min(criticalAlerts * 20, 40);
  score += Math.min(activeAlerts * 5, 15);
  if (readmissionRisk !== null) score += readmissionRisk * 25;
  if (fallRisk !== null) score += (fallRisk / 100) * 15;
  if (engagementScore !== null) score += ((100 - engagementScore) / 100) * 10;
  if (abnormalVitals) score += 10;
  return Math.min(100, Math.round(score));
}

export function getPriorityLevel(score: number): PriorityLevel {
  if (score >= 70) return 'critical';
  if (score >= 45) return 'high';
  if (score >= 25) return 'moderate';
  return 'low';
}

export function isAbnormalVitals(bpSys: number | null, bpDia: number | null, hr: number | null, spo2: number | null): boolean {
  if (bpSys !== null && (bpSys > 180 || bpSys < 90)) return true;
  if (bpDia !== null && (bpDia > 120 || bpDia < 60)) return true;
  if (hr !== null && (hr > 120 || hr < 50)) return true;
  if (spo2 !== null && spo2 < 92) return true;
  return false;
}

export function buildRiskFlags(p: PriorityPatient): string[] {
  const flags: string[] = [];
  if (p.critical_alerts > 0) flags.push(`${p.critical_alerts} critical alert${p.critical_alerts > 1 ? 's' : ''}`);
  if (p.readmission_risk !== null && p.readmission_risk >= 0.6) flags.push('High readmission risk');
  if (p.fall_risk !== null && p.fall_risk >= 60) flags.push('Fall risk');
  if (p.engagement_score !== null && p.engagement_score < 30) flags.push('Disengaged');
  if (p.latest_spo2 !== null && p.latest_spo2 < 92) flags.push(`SpO2 ${p.latest_spo2}%`);
  if (p.latest_hr !== null && (p.latest_hr > 120 || p.latest_hr < 50)) flags.push(`HR ${p.latest_hr}`);
  return flags;
}

export const PRIORITY_STYLES: Record<PriorityLevel, { border: string; bg: string; badge: string; text: string }> = {
  critical: { border: 'border-red-400', bg: 'bg-red-50', badge: 'bg-red-600 text-white', text: 'text-red-800' },
  high: { border: 'border-orange-300', bg: 'bg-orange-50', badge: 'bg-orange-500 text-white', text: 'text-orange-800' },
  moderate: { border: 'border-yellow-300', bg: 'bg-yellow-50', badge: 'bg-yellow-500 text-white', text: 'text-yellow-800' },
  low: { border: 'border-green-200', bg: 'bg-green-50', badge: 'bg-green-600 text-white', text: 'text-green-800' },
};
