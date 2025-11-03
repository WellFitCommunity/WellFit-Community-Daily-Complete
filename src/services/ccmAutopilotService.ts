// CCM Autopilot Service - Chronic Care Management billing automation
// Tracks patient time from check-ins and scribe sessions

import { supabase } from '../lib/supabaseClient';

interface CCMEligiblePatient {
  patient_id: string;
  patient_name?: string;
  total_minutes: number;
  billable_code: '99490' | '99439' | null;
  activities: Array<{
    type: 'check_in' | 'scribe_session' | 'portal_message';
    timestamp: string;
    duration_minutes: number;
  }>;
}

export class CCMAutopilotService {
  /**
   * Get CCM-eligible patients for current month
   * 99490: First 20 minutes (billable once per month)
   * 99439: Each additional 20 minutes (can bill multiple times)
   */
  static async getEligiblePatients(month?: Date): Promise<CCMEligiblePatient[]> {
    const targetMonth = month || new Date();
    const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59);

    try {
      // Get all patients with check-ins this month
      const { data: checkIns, error: checkInError } = await supabase
        .from('check_ins')
        .select('user_id, timestamp, created_at')
        .gte('timestamp', monthStart.toISOString())
        .lte('timestamp', monthEnd.toISOString())
        .order('timestamp', { ascending: true });

      if (checkInError) throw checkInError;

      // Get all scribe sessions this month
      const { data: scribeSessions, error: scribeError } = await supabase
        .from('scribe_sessions')
        .select('patient_id, provider_id, recording_duration_seconds, created_at')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      if (scribeError) throw scribeError;

      // Aggregate by patient
      const patientMap = new Map<string, CCMEligiblePatient>();

      // Process check-ins (assume 5 minutes per check-in)
      checkIns?.forEach((checkIn) => {
        const patientId = checkIn.user_id;
        if (!patientMap.has(patientId)) {
          patientMap.set(patientId, {
            patient_id: patientId,
            total_minutes: 0,
            billable_code: null,
            activities: [],
          });
        }

        const patient = patientMap.get(patientId);
        if (patient) {
          patient.total_minutes += 5;
          patient.activities.push({
            type: 'check_in',
            timestamp: checkIn.timestamp || checkIn.created_at,
            duration_minutes: 5,
          });
        }
      });

      // Process scribe sessions
      scribeSessions?.forEach((session) => {
        if (!session.patient_id) return;

        const patientId = session.patient_id;
        if (!patientMap.has(patientId)) {
          patientMap.set(patientId, {
            patient_id: patientId,
            total_minutes: 0,
            billable_code: null,
            activities: [],
          });
        }

        const patient = patientMap.get(patientId);
        if (patient) {
          const minutes = Math.round((session.recording_duration_seconds || 0) / 60);
          patient.total_minutes += minutes;
          patient.activities.push({
            type: 'scribe_session',
            timestamp: session.created_at,
            duration_minutes: minutes,
          });
        }
      });

      // Determine billable codes
      const eligiblePatients: CCMEligiblePatient[] = [];
      for (const patient of patientMap.values()) {
        if (patient.total_minutes >= 20) {
          if (patient.total_minutes >= 40) {
            patient.billable_code = '99439'; // Additional 20 minutes
          } else {
            patient.billable_code = '99490'; // First 20 minutes
          }
          eligiblePatients.push(patient);
        }
      }

      // Sort by total minutes (highest first)
      eligiblePatients.sort((a, b) => b.total_minutes - a.total_minutes);

      return eligiblePatients;
    } catch (error) {

      throw error;
    }
  }

  /**
   * Get detailed CCM breakdown for a specific patient
   */
  static async getPatientCCMDetails(
    patientId: string,
    month?: Date
  ): Promise<CCMEligiblePatient | null> {
    const patients = await this.getEligiblePatients(month);
    return patients.find((p) => p.patient_id === patientId) || null;
  }

  /**
   * Calculate CCM revenue potential for the month
   */
  static calculateCCMRevenue(patients: CCMEligiblePatient[]): {
    total: number;
    breakdown: { code: string; count: number; revenue: number }[];
  } {
    const fees = {
      '99490': 42.0, // Medicare 2024 national average
      '99439': 31.0,
    };

    let code99490Count = 0;
    let code99439Count = 0;

    patients.forEach((patient) => {
      if (patient.billable_code === '99490') {
        code99490Count++;
      } else if (patient.billable_code === '99439') {
        code99439Count++;
      }
    });

    const revenue99490 = code99490Count * fees['99490'];
    const revenue99439 = code99439Count * fees['99439'];

    return {
      total: revenue99490 + revenue99439,
      breakdown: [
        { code: '99490', count: code99490Count, revenue: revenue99490 },
        { code: '99439', count: code99439Count, revenue: revenue99439 },
      ],
    };
  }

  /**
   * Check if patient has already been billed for CCM this month
   */
  static async hasBeenBilled(patientId: string, month?: Date): Promise<boolean> {
    const targetMonth = month || new Date();
    const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);

    try {
      // Check if there's a claim with CCM codes for this patient this month
      const { data, error } = await supabase
        .from('claims')
        .select('id, claim_lines(procedure_code)')
        .eq('encounter_id', patientId) // Assuming encounter_id links to patient
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      if (error) throw error;

      if (!data || data.length === 0) return false;

      // Check if any claim has CCM codes
      for (const claim of data) {
        const lines = (claim as any).claim_lines || [];
        for (const line of lines) {
          if (line.procedure_code === '99490' || line.procedure_code === '99439') {
            return true;
          }
        }
      }

      return false;
    } catch (error) {

      return false;
    }
  }
}

export default CCMAutopilotService;
