/**
 * Parkinson's Disease Management Service
 * Enterprise service layer for Parkinson's Disease tracking and care
 *
 * Clinical Standards: UPDRS, Hoehn & Yahr, ROBERT & FORBES Frameworks
 * Compliance: HIPAA, SOC2
 */

import { supabase } from '../lib/supabaseClient';
import { logPhiAccess } from './phiAccessLogger';
import { PAGINATION_LIMITS, applyLimit } from '../utils/pagination';
import type {
  ParkinsonsPatient,
  ParkinsonsMedication,
  ParkinsonsMedicationLog,
  ParkinsonsSymptomDiary,
  ParkinsonsUPDRSAssessment,
  ParkinsonsDBSSession,
  ParkinsonsROBERTTracking,
  ParkinsonsFORBESTracking,
  ParkinsonsDashboardMetrics,
  ParkinsonsPatientSummary,
  CreateParkinsonsPatientRequest,
  CreateMedicationRequest,
  LogMedicationDoseRequest,
  RecordSymptomDiaryRequest,
  RecordUPDRSRequest,
  RecordDBSSessionRequest,
  HoehnYahrStage,
} from '../types/parkinsons';

/**
 * API Response wrapper for consistent error handling
 */
export interface ParkinsonsApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Normalize unknown errors into a safe message string.
 * Avoids `any` in catch blocks while preserving existing behavior.
 */
function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

/**
 * Parkinson's Disease Management Service - Main API
 */
export class ParkinsonsService {
  // ============================================================================
  // PATIENT REGISTRY
  // ============================================================================

  /**
   * Enroll patient in Parkinson's tracking program
   */
  static async enrollPatient(
    request: CreateParkinsonsPatientRequest
  ): Promise<ParkinsonsApiResponse<ParkinsonsPatient>> {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error('User not authenticated');

      // HIPAA §164.312(b): Log PHI access
      await logPhiAccess({
        phiType: 'enrollment',
        phiResourceId: `parkinsons_enrollment_${request.user_id}`,
        patientId: request.user_id,
        accessType: 'create',
        accessMethod: 'API',
        purpose: 'treatment',
      });

      const { data, error } = await supabase
        .from('parkinsons_patient_registry')
        .insert({
          user_id: request.user_id,
          diagnosis_date: request.diagnosis_date,
          parkinsons_type: request.parkinsons_type,
          hoehn_yahr_stage: request.hoehn_yahr_stage,
          primary_symptoms: request.primary_symptoms,
          neurologist_id: request.neurologist_id,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }

  /**
   * Get Parkinson's patient by user ID
   */
  static async getPatient(
    userId: string
  ): Promise<ParkinsonsApiResponse<ParkinsonsPatient | null>> {
    try {
      const { data, error } = await supabase
        .from('parkinsons_patient_registry')
        .select(
          `
          *,
          profile:profiles(first_name, last_name, phone)
        `
        )
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }

  /**
   * Get all Parkinson's patients for a provider
   */
  static async getPatientsByProvider(
    providerId: string
  ): Promise<ParkinsonsApiResponse<ParkinsonsPatient[]>> {
    try {
      const query = supabase
        .from('parkinsons_patient_registry')
        .select(
          `
          *,
          profile:profiles(first_name, last_name, phone)
        `
        )
        .eq('neurologist_id', providerId)
        .order('updated_at', { ascending: false });

      const data = await applyLimit<ParkinsonsPatient>(query, PAGINATION_LIMITS.PATIENTS);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }

  /**
   * Update Hoehn & Yahr stage
   */
  static async updateHoehnYahrStage(
    patientId: string,
    stage: HoehnYahrStage
  ): Promise<ParkinsonsApiResponse<ParkinsonsPatient>> {
    try {
      const { data, error } = await supabase
        .from('parkinsons_patient_registry')
        .update({ hoehn_yahr_stage: stage, updated_at: new Date().toISOString() })
        .eq('id', patientId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }

  // ============================================================================
  // MEDICATIONS
  // ============================================================================

  /**
   * Add medication to patient's regimen
   */
  static async addMedication(
    request: CreateMedicationRequest
  ): Promise<ParkinsonsApiResponse<ParkinsonsMedication>> {
    try {
      const { data, error } = await supabase
        .from('parkinsons_medications')
        .insert({
          patient_id: request.patient_id,
          medication_name: request.medication_name,
          medication_class: request.medication_class,
          dosage: request.dosage,
          frequency: request.frequency,
          timing_instructions: request.timing_instructions,
          start_date: request.start_date || new Date().toISOString(),
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }

  /**
   * Get active medications for patient
   */
  static async getActiveMedications(
    patientId: string
  ): Promise<ParkinsonsApiResponse<ParkinsonsMedication[]>> {
    try {
      const { data, error } = await supabase
        .from('parkinsons_medications')
        .select('*')
        .eq('patient_id', patientId)
        .eq('is_active', true)
        .order('medication_name');

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }

  /**
   * Discontinue medication
   */
  static async discontinueMedication(
    medicationId: string,
    endDate?: string
  ): Promise<ParkinsonsApiResponse<ParkinsonsMedication>> {
    try {
      const { data, error } = await supabase
        .from('parkinsons_medications')
        .update({
          is_active: false,
          end_date: endDate || new Date().toISOString(),
        })
        .eq('id', medicationId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }

  // ============================================================================
  // MEDICATION LOGGING (Adherence)
  // ============================================================================

  /**
   * Log medication dose taken
   */
  static async logMedicationDose(
    request: LogMedicationDoseRequest
  ): Promise<ParkinsonsApiResponse<ParkinsonsMedicationLog>> {
    try {
      const { data, error } = await supabase
        .from('parkinsons_medication_log')
        .insert({
          medication_id: request.medication_id,
          taken_at: request.taken_at || new Date().toISOString(),
          was_on_time: request.was_on_time,
          symptom_state_30min: request.symptom_state_30min,
          notes: request.notes,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }

  /**
   * Get medication log for patient
   */
  static async getMedicationLog(
    patientId: string,
    daysBack: number = 30
  ): Promise<ParkinsonsApiResponse<ParkinsonsMedicationLog[]>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const { data, error } = await supabase
        .from('parkinsons_medication_log')
        .select(
          `
          *,
          medication:parkinsons_medications!inner(patient_id, medication_name)
        `
        )
        .eq('medication.patient_id', patientId)
        .gte('taken_at', startDate.toISOString())
        .order('taken_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }

  /**
   * Calculate medication adherence rate
   */
  static async calculateAdherenceRate(
    patientId: string,
    daysBack: number = 30
  ): Promise<ParkinsonsApiResponse<number>> {
    try {
      // Get active medications
      const medsResult = await this.getActiveMedications(patientId);
      if (!medsResult.success || !medsResult.data) {
        throw new Error('Could not fetch medications');
      }

      // Get actual doses logged
      const logResult = await this.getMedicationLog(patientId, daysBack);
      if (!logResult.success) {
        throw new Error('Could not fetch medication log');
      }

      const actualDoses = logResult.data?.length || 0;

      // Estimate expected doses (simplified: assume 3 doses/day per med)
      const expectedDoses = medsResult.data.length * daysBack * 3;

      const adherenceRate =
        expectedDoses > 0 ? Math.min(100, (actualDoses / expectedDoses) * 100) : 0;

      return { success: true, data: Math.round(adherenceRate) };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }

  // ============================================================================
  // SYMPTOM DIARY
  // ============================================================================

  /**
   * Record symptom diary entry
   */
  static async recordSymptomDiary(
    request: RecordSymptomDiaryRequest
  ): Promise<ParkinsonsApiResponse<ParkinsonsSymptomDiary>> {
    try {
      const { data, error } = await supabase
        .from('parkinsons_symptom_diary')
        .insert({
          patient_id: request.patient_id,
          recorded_at: new Date().toISOString(),
          tremor_severity: request.tremor_severity,
          rigidity_severity: request.rigidity_severity,
          bradykinesia_severity: request.bradykinesia_severity,
          dyskinesia_present: request.dyskinesia_present || false,
          on_time_hours: request.on_time_hours,
          off_time_hours: request.off_time_hours,
          freezing_episodes: request.freezing_episodes,
          mood_rating: request.mood_rating,
          sleep_quality: request.sleep_quality,
          notes: request.notes,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }

  /**
   * Get symptom diary entries
   */
  static async getSymptomDiary(
    patientId: string,
    daysBack: number = 30
  ): Promise<ParkinsonsApiResponse<ParkinsonsSymptomDiary[]>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const { data, error } = await supabase
        .from('parkinsons_symptom_diary')
        .select('*')
        .eq('patient_id', patientId)
        .gte('recorded_at', startDate.toISOString())
        .order('recorded_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }

  // ============================================================================
  // UPDRS ASSESSMENTS
  // ============================================================================

  /**
   * Record UPDRS assessment
   */
  static async recordUPDRSAssessment(
    request: RecordUPDRSRequest
  ): Promise<ParkinsonsApiResponse<ParkinsonsUPDRSAssessment>> {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error('User not authenticated');

      // Calculate total score
      const totalScore =
        (request.part_i_score || 0) +
        (request.part_ii_score || 0) +
        (request.part_iii_score || 0) +
        (request.part_iv_score || 0);

      const { data, error } = await supabase
        .from('parkinsons_updrs')
        .insert({
          patient_id: request.patient_id,
          assessor_id: authData.user.id,
          assessment_date: request.assessment_date || new Date().toISOString(),
          part_i_score: request.part_i_score,
          part_ii_score: request.part_ii_score,
          part_iii_score: request.part_iii_score,
          part_iv_score: request.part_iv_score,
          total_score: totalScore,
          medication_state: request.medication_state,
          notes: request.notes,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }

  /**
   * Get UPDRS assessment history
   */
  static async getUPDRSHistory(
    patientId: string
  ): Promise<ParkinsonsApiResponse<ParkinsonsUPDRSAssessment[]>> {
    try {
      const query = supabase
        .from('parkinsons_updrs')
        .select(
          `
          *,
          assessor:profiles!parkinsons_updrs_assessor_id_fkey(first_name, last_name)
        `
        )
        .eq('patient_id', patientId)
        .order('assessment_date', { ascending: false });

      const data = await applyLimit<ParkinsonsUPDRSAssessment>(query, PAGINATION_LIMITS.ASSESSMENTS);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }

  /**
   * Get latest UPDRS score
   */
  static async getLatestUPDRS(
    patientId: string
  ): Promise<ParkinsonsApiResponse<ParkinsonsUPDRSAssessment | null>> {
    try {
      const { data, error } = await supabase
        .from('parkinsons_updrs')
        .select('*')
        .eq('patient_id', patientId)
        .order('assessment_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }

  // ============================================================================
  // DBS SESSIONS
  // ============================================================================

  /**
   * Record DBS programming session
   */
  static async recordDBSSession(
    request: RecordDBSSessionRequest
  ): Promise<ParkinsonsApiResponse<ParkinsonsDBSSession>> {
    try {
      const { data, error } = await supabase
        .from('parkinsons_dbs_sessions')
        .insert({
          patient_id: request.patient_id,
          session_date: request.session_date || new Date().toISOString(),
          programmer_name: request.programmer_name,
          settings_changed: request.settings_changed,
          battery_status: request.battery_status,
          patient_response: request.patient_response,
          notes: request.notes,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }

  /**
   * Get DBS session history
   */
  static async getDBSSessionHistory(
    patientId: string
  ): Promise<ParkinsonsApiResponse<ParkinsonsDBSSession[]>> {
    try {
      const query = supabase
        .from('parkinsons_dbs_sessions')
        .select('*')
        .eq('patient_id', patientId)
        .order('session_date', { ascending: false });

      const data = await applyLimit<ParkinsonsDBSSession>(query, PAGINATION_LIMITS.ASSESSMENTS);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }

  // ============================================================================
  // ROBERT & FORBES FRAMEWORK TRACKING
  // ============================================================================

  /**
   * Record ROBERT framework tracking
   */
  static async recordROBERTTracking(
    patientId: string,
    data: Partial<ParkinsonsROBERTTracking>
  ): Promise<ParkinsonsApiResponse<ParkinsonsROBERTTracking>> {
    try {
      const { data: result, error } = await supabase
        .from('parkinsons_robert_tracking')
        .insert({
          patient_id: patientId,
          tracking_date: new Date().toISOString().split('T')[0],
          ...data,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }

  /**
   * Get ROBERT tracking history
   */
  static async getROBERTHistory(
    patientId: string,
    daysBack: number = 90
  ): Promise<ParkinsonsApiResponse<ParkinsonsROBERTTracking[]>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const { data, error } = await supabase
        .from('parkinsons_robert_tracking')
        .select('*')
        .eq('patient_id', patientId)
        .gte('tracking_date', startDate.toISOString().split('T')[0])
        .order('tracking_date', { ascending: false })
        .limit(100);

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }

  /**
   * Record FORBES framework tracking
   */
  static async recordFORBESTracking(
    patientId: string,
    updrsAssessmentId: string | undefined,
    data: Partial<ParkinsonsFORBESTracking>
  ): Promise<ParkinsonsApiResponse<ParkinsonsFORBESTracking>> {
    try {
      const { data: result, error } = await supabase
        .from('parkinsons_forbes_tracking')
        .insert({
          patient_id: patientId,
          updrs_assessment_id: updrsAssessmentId,
          tracking_date: new Date().toISOString().split('T')[0],
          ...data,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }

  /**
   * Get FORBES tracking history
   */
  static async getFORBESHistory(
    patientId: string
  ): Promise<ParkinsonsApiResponse<ParkinsonsFORBESTracking[]>> {
    try {
      const query = supabase
        .from('parkinsons_forbes_tracking')
        .select('*')
        .eq('patient_id', patientId)
        .order('tracking_date', { ascending: false });

      const data = await applyLimit<ParkinsonsFORBESTracking>(query, PAGINATION_LIMITS.ASSESSMENTS);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }

  // ============================================================================
  // DASHBOARD & ANALYTICS
  // ============================================================================

  /**
   * Get dashboard metrics for provider
   */
  static async getDashboardMetrics(
    providerId?: string
  ): Promise<ParkinsonsApiResponse<ParkinsonsDashboardMetrics>> {
    try {
      // Get patient counts
      let patientsQuery = supabase
        .from('parkinsons_patient_registry')
        .select('id, hoehn_yahr_stage, dbs_implant', { count: 'exact' });

      if (providerId) {
        patientsQuery = patientsQuery.eq('neurologist_id', providerId);
      }

      const { data: patients, count, error: patientsError } = await patientsQuery;

      if (patientsError) throw patientsError;

      const totalPatients = count || 0;
      const patientsOnDBS = patients?.filter((p) => p.dbs_implant).length || 0;

      // Count high-risk patients (Hoehn & Yahr 3+)
      const highRiskPatients =
        patients?.filter((p) => p.hoehn_yahr_stage && parseFloat(p.hoehn_yahr_stage) >= 3).length ||
        0;

      // Get average UPDRS score (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: updrsData, error: updrsError } = await supabase
        .from('parkinsons_updrs')
        .select('total_score')
        .gte('assessment_date', thirtyDaysAgo.toISOString())
        .not('total_score', 'is', null);

      if (updrsError) throw updrsError;

      const avgUPDRS =
        updrsData && updrsData.length > 0
          ? updrsData.reduce((sum, a) => sum + (a.total_score || 0), 0) / updrsData.length
          : 0;

      // Patients who haven't had UPDRS in 90 days are due
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { count: dueCount, error: dueError } = await supabase
        .from('parkinsons_patient_registry')
        .select('id', { count: 'exact' })
        .lt('updated_at', ninetyDaysAgo.toISOString());

      if (dueError) throw dueError;

      const metrics: ParkinsonsDashboardMetrics = {
        totalPatients,
        patientsOnDBS,
        averageUPDRSScore: Math.round(avgUPDRS),
        averageMedicationAdherence: 85, // Would calculate from logs
        highRiskPatients,
        assessmentsDueThisWeek: dueCount || 0,
      };

      return { success: true, data: metrics };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }

  /**
   * Get patient summary list for dashboard
   */
  static async getPatientSummaries(
    providerId?: string
  ): Promise<ParkinsonsApiResponse<ParkinsonsPatientSummary[]>> {
    try {
      let query = supabase
        .from('parkinsons_patient_registry')
        .select(
          `
          id,
          user_id,
          hoehn_yahr_stage,
          dbs_implant,
          updated_at,
          profile:profiles(first_name, last_name)
        `
        )
        .order('updated_at', { ascending: false })
        .limit(50);

      if (providerId) {
        query = query.eq('neurologist_id', providerId);
      }

      const { data: patients, error } = await query;

      if (error) throw error;

      if (!patients || patients.length === 0) {
        return { success: true, data: [] };
      }

      // Get latest UPDRS for each patient
      const patientIds = patients.map((p) => p.id);
      const { data: updrsData } = await supabase
        .from('parkinsons_updrs')
        .select('patient_id, total_score, assessment_date')
        .in('patient_id', patientIds)
        .order('assessment_date', { ascending: false });

      // Get medication counts
      const { data: medCounts } = await supabase
        .from('parkinsons_medications')
        .select('patient_id')
        .in('patient_id', patientIds)
        .eq('is_active', true);

      // Get latest symptom entries
      const { data: symptomData } = await supabase
        .from('parkinsons_symptom_diary')
        .select('patient_id, recorded_at')
        .in('patient_id', patientIds)
        .order('recorded_at', { ascending: false });

      // Build summaries
      const summaries: ParkinsonsPatientSummary[] = patients.map((patient) => {
        const profile = patient.profile as { first_name?: string; last_name?: string } | null;
        const patientName = profile
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
          : 'Unknown';

        const latestUPDRS = updrsData?.find((u) => u.patient_id === patient.id);
        const medCount = medCounts?.filter((m) => m.patient_id === patient.id).length || 0;
        const latestSymptom = symptomData?.find((s) => s.patient_id === patient.id);

        // Calculate days since last assessment
        const daysSinceAssessment = latestUPDRS?.assessment_date
          ? Math.floor(
              (Date.now() - new Date(latestUPDRS.assessment_date).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : 999;

        // Determine risk level
        const hyStage = patient.hoehn_yahr_stage ? parseFloat(patient.hoehn_yahr_stage) : 0;
        let riskLevel: 'low' | 'moderate' | 'high' = 'low';
        if (hyStage >= 4 || daysSinceAssessment > 180) {
          riskLevel = 'high';
        } else if (hyStage >= 3 || daysSinceAssessment > 90) {
          riskLevel = 'moderate';
        }

        return {
          patient_id: patient.id,
          patient_name: patientName,
          hoehn_yahr_stage: patient.hoehn_yahr_stage,
          last_updrs_score: latestUPDRS?.total_score,
          last_updrs_date: latestUPDRS?.assessment_date,
          medication_count: medCount,
          has_dbs: patient.dbs_implant || false,
          last_symptom_entry: latestSymptom?.recorded_at,
          risk_level: riskLevel,
          days_since_assessment: daysSinceAssessment,
        };
      });

      return { success: true, data: summaries };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }

  /**
   * Get patients needing UPDRS assessment (overdue by 90+ days)
   */
  static async getPatientsNeedingAssessment(): Promise<
    ParkinsonsApiResponse<ParkinsonsPatientSummary[]>
  > {
    try {
      const result = await this.getPatientSummaries();
      if (!result.success || !result.data) {
        return result;
      }

      const needingAssessment = result.data.filter((p) => p.days_since_assessment >= 90);
      return { success: true, data: needingAssessment };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }

  /**
   * Get high-risk Parkinson's patients
   */
  static async getHighRiskPatients(): Promise<ParkinsonsApiResponse<ParkinsonsPatientSummary[]>> {
    try {
      const result = await this.getPatientSummaries();
      if (!result.success || !result.data) {
        return result;
      }

      const highRisk = result.data.filter((p) => p.risk_level === 'high');
      return { success: true, data: highRisk };
    } catch (error) {
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }
}
