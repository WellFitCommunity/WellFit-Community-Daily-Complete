/**
 * =====================================================
 * DENTAL HEALTH SERVICE
 * =====================================================
 * Purpose: Comprehensive dental health management service
 * Integration: FHIR mapping, CDT billing, chronic disease links
 * =====================================================
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { DentalObservationService } from './fhir/DentalObservationService';
import type {
  DentalAssessment,
  DentalProcedure,
  DentalTreatmentPlan,
  ToothChartEntry,
  PatientDentalHealthTracking,
  CDTCode,
  DentalHealthDashboardSummary,
  ToothChartSummary,
  ProcedureHistorySummary,
  DentalApiResponse,
  CreateDentalAssessmentRequest,
  UpdateDentalAssessmentRequest,
  CreateToothChartEntryRequest,
  CreateDentalProcedureRequest,
  CreateTreatmentPlanRequest,
  CreatePatientTrackingRequest,
  DentalRiskAlert,
} from '../types/dentalHealth';

/**
 * Dental Health Service - Main service class
 */
export class DentalHealthService {
  // =====================================================
  // DENTAL ASSESSMENTS
  // =====================================================

  /**
   * Create a new dental assessment
   */
  static async createAssessment(
    request: CreateDentalAssessmentRequest
  ): Promise<DentalApiResponse<DentalAssessment>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const assessmentData = {
        patient_id: request.patient_id,
        provider_id: user.id,
        visit_type: request.visit_type,
        visit_date: request.visit_date || new Date().toISOString(),
        status: 'draft' as const,
        chief_complaint: request.chief_complaint,
        pain_level: request.pain_level,
        clinical_notes: request.clinical_notes,
        created_by: user.id,
      };

      const { data, error } = await supabase
        .from('dental_assessments')
        .insert(assessmentData)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await auditLogger.error('DENTAL_ASSESSMENT_CREATE_FAILED', errorMessage, {
        patientId: request.patient_id,
        resource_type: 'dental_assessment',
        operation: 'create'
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Update an existing dental assessment
   */
  static async updateAssessment(
    request: UpdateDentalAssessmentRequest
  ): Promise<DentalApiResponse<DentalAssessment>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('dental_assessments')
        .update({
          ...request,
          updated_by: user.id,
        })
        .eq('id', request.id)
        .select()
        .single();

      if (error) throw error;

      // If assessment is marked as completed, create FHIR observations
      if (request.status === 'completed' && data) {
        await DentalObservationService.createObservationFromAssessment(data);
        await DentalObservationService.createConditionFromAssessment(data);
      }

      return { success: true, data };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await auditLogger.error('DENTAL_ASSESSMENT_UPDATE_FAILED', errorMessage, { operation: 'update' });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get dental assessment by ID
   */
  static async getAssessmentById(id: string): Promise<DentalApiResponse<DentalAssessment>> {
    try {
      const { data, error } = await supabase
        .from('dental_assessments')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await auditLogger.error('DENTAL_ASSESSMENT_FETCH_FAILED', errorMessage, {
        assessmentId: id,
        resource_type: 'dental_assessment',
        operation: 'read'
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get all assessments for a patient
   */
  static async getAssessmentsByPatient(
    patientId: string,
    limit: number = 50
  ): Promise<DentalApiResponse<DentalAssessment[]>> {
    try {
      const { data, error } = await supabase
        .from('dental_assessments')
        .select('*')
        .eq('patient_id', patientId)
        .order('visit_date', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await auditLogger.error('DENTAL_ASSESSMENTS_FETCH_FAILED', errorMessage, { patientId, operation: 'list' });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get latest assessment for a patient
   */
  static async getLatestAssessment(
    patientId: string
  ): Promise<DentalApiResponse<DentalAssessment | null>> {
    try {
      const { data, error } = await supabase
        .from('dental_assessments')
        .select('*')
        .eq('patient_id', patientId)
        .order('visit_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return { success: true, data };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await auditLogger.error('DENTAL_ASSESSMENT_LATEST_FETCH_FAILED', errorMessage, { patientId, operation: 'read_latest' });
      return { success: false, error: errorMessage };
    }
  }

  // =====================================================
  // TOOTH CHART
  // =====================================================

  /**
   * Create tooth chart entry
   */
  static async createToothChartEntry(
    request: CreateToothChartEntryRequest
  ): Promise<DentalApiResponse<ToothChartEntry>> {
    try {
      const entryData: any = {
        assessment_id: request.assessment_id,
        patient_id: request.patient_id,
        tooth_number: request.tooth_number,
        condition: request.condition,
        surface_conditions: request.surface_conditions,
        notes: request.notes,
      };

      // Add probing depths if provided
      if (request.probing_depths) {
        entryData.probing_depth_mb = request.probing_depths.mb;
        entryData.probing_depth_b = request.probing_depths.b;
        entryData.probing_depth_db = request.probing_depths.db;
        entryData.probing_depth_ml = request.probing_depths.ml;
        entryData.probing_depth_l = request.probing_depths.l;
        entryData.probing_depth_dl = request.probing_depths.dl;
      }

      const { data, error } = await supabase
        .from('dental_tooth_chart')
        .insert(entryData)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await auditLogger.error('TOOTH_CHART_CREATE_FAILED', errorMessage, {
        patientId: request.patient_id,
        toothNumber: request.tooth_number,
        resource_type: 'tooth_chart',
        operation: 'create'
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get tooth chart for an assessment
   */
  static async getToothChartByAssessment(
    assessmentId: string
  ): Promise<DentalApiResponse<ToothChartEntry[]>> {
    try {
      const { data, error } = await supabase
        .from('dental_tooth_chart')
        .select('*')
        .eq('assessment_id', assessmentId)
        .order('tooth_number', { ascending: true });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await auditLogger.error('SERVICE_ERROR', errorMessage, { service: 'dental', operation: 'unknown' });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get tooth chart summary for a patient
   */
  static async getToothChartSummary(
    assessmentId: string
  ): Promise<DentalApiResponse<ToothChartSummary>> {
    try {
      const teethResponse = await this.getToothChartByAssessment(assessmentId);
      if (!teethResponse.success || !teethResponse.data) {
        throw new Error('Failed to fetch tooth chart');
      }

      const teeth = teethResponse.data;
      const assessmentResponse = await this.getAssessmentById(assessmentId);
      const assessment = assessmentResponse.data;

      // Calculate statistics
      const totalHealthy = teeth.filter(t => t.condition === 'healthy').length;
      const totalCavities = teeth.filter(t => t.condition === 'cavity').length;
      const totalMissing = teeth.filter(t => t.condition === 'missing' || t.condition === 'extraction').length;
      const totalRestored = teeth.filter(t =>
        ['filling', 'crown', 'bridge', 'implant', 'root_canal'].includes(t.condition)
      ).length;

      // Calculate average probing depth
      const probingDepths = teeth.flatMap(t => [
        t.probing_depth_mb,
        t.probing_depth_b,
        t.probing_depth_db,
        t.probing_depth_ml,
        t.probing_depth_l,
        t.probing_depth_dl,
      ]).filter(d => d !== null && d !== undefined) as number[];

      const avgProbingDepth = probingDepths.length > 0
        ? probingDepths.reduce((sum, d) => sum + d, 0) / probingDepths.length
        : undefined;

      // Count bleeding points
      const bleedingPoints = teeth.filter(t => t.bleeding_on_probing).length;

      // Determine overall health
      let overallHealth: ToothChartSummary['overall_periodontal_health'] = 'excellent';
      if (avgProbingDepth && avgProbingDepth > 5) {
        overallHealth = 'critical';
      } else if (avgProbingDepth && avgProbingDepth > 4) {
        overallHealth = 'poor';
      } else if (totalCavities > 3 || bleedingPoints > 10) {
        overallHealth = 'fair';
      } else if (totalCavities > 0 || bleedingPoints > 5) {
        overallHealth = 'good';
      }

      const summary: ToothChartSummary = {
        patient_id: assessment?.patient_id || '',
        assessment_id: assessmentId,
        teeth,
        overall_periodontal_health: overallHealth,
        total_healthy_teeth: totalHealthy,
        total_cavities: totalCavities,
        total_missing: totalMissing,
        total_restored: totalRestored,
        average_probing_depth: avgProbingDepth,
        bleeding_points_count: bleedingPoints,
      };

      return { success: true, data: summary };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await auditLogger.error('SERVICE_ERROR', errorMessage, { service: 'dental', operation: 'unknown' });
      return { success: false, error: errorMessage };
    }
  }

  // =====================================================
  // DENTAL PROCEDURES
  // =====================================================

  /**
   * Create a dental procedure
   */
  static async createProcedure(
    request: CreateDentalProcedureRequest
  ): Promise<DentalApiResponse<DentalProcedure>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const procedureData = {
        patient_id: request.patient_id,
        assessment_id: request.assessment_id,
        provider_id: user.id,
        procedure_name: request.procedure_name,
        cdt_code: request.cdt_code,
        procedure_date: request.procedure_date || new Date().toISOString(),
        tooth_numbers: request.tooth_numbers,
        procedure_description: request.procedure_description,
        estimated_cost: request.estimated_cost,
        priority: request.priority,
        procedure_status: 'completed',
        created_by: user.id,
      };

      const { data, error } = await supabase
        .from('dental_procedures')
        .insert(procedureData)
        .select()
        .single();

      if (error) throw error;

      // Create FHIR Procedure resource
      if (data) {
        await DentalObservationService.createFHIRProcedure(data);
      }

      return { success: true, data };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await auditLogger.error('DENTAL_PROCEDURE_CREATE_FAILED', errorMessage, {
        patientId: request.patient_id,
        resource_type: 'dental_procedure',
        operation: 'create'
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get procedures for a patient
   */
  static async getProceduresByPatient(
    patientId: string,
    limit: number = 100
  ): Promise<DentalApiResponse<DentalProcedure[]>> {
    try {
      const { data, error } = await supabase
        .from('dental_procedures')
        .select('*')
        .eq('patient_id', patientId)
        .order('procedure_date', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await auditLogger.error('SERVICE_ERROR', errorMessage, { service: 'dental', operation: 'unknown' });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get procedure history summary
   */
  static async getProcedureHistorySummary(
    patientId: string
  ): Promise<DentalApiResponse<ProcedureHistorySummary>> {
    try {
      const proceduresResponse = await this.getProceduresByPatient(patientId);
      if (!proceduresResponse.success || !proceduresResponse.data) {
        throw new Error('Failed to fetch procedures');
      }

      const procedures = proceduresResponse.data;
      const currentYear = new Date().getFullYear();

      // Get CDT codes to determine procedure categories
      const preventiveCodes = ['D1110', 'D1120', 'D1206', 'D1208', 'D1351', 'D0120', 'D0140', 'D0150'];
      const surgicalCodes = ['D7140', 'D7210', 'D7240', 'D6010'];

      const preventiveCount = procedures.filter(p => p.cdt_code && preventiveCodes.includes(p.cdt_code)).length;
      const surgicalCount = procedures.filter(p => p.cdt_code && surgicalCodes.includes(p.cdt_code)).length;
      const restorativeCount = procedures.length - preventiveCount - surgicalCount;

      // Find last cleaning and exam
      const lastCleaning = procedures.find(p => p.cdt_code && ['D1110', 'D1120'].includes(p.cdt_code));
      const lastExam = procedures.find(p => p.cdt_code && ['D0120', 'D0140', 'D0150'].includes(p.cdt_code));

      // Calculate YTD costs
      const ytdProcedures = procedures.filter(p => {
        const procYear = new Date(p.procedure_date).getFullYear();
        return procYear === currentYear;
      });
      const totalCostYtd = ytdProcedures.reduce((sum, p) => sum + (p.estimated_cost || 0), 0);

      // Count upcoming scheduled
      const upcomingCount = procedures.filter(p => p.procedure_status === 'scheduled').length;

      const summary: ProcedureHistorySummary = {
        patient_id: patientId,
        total_procedures: procedures.length,
        preventive_procedures: preventiveCount,
        restorative_procedures: restorativeCount,
        surgical_procedures: surgicalCount,
        last_cleaning_date: lastCleaning?.procedure_date,
        last_exam_date: lastExam?.procedure_date,
        upcoming_scheduled_count: upcomingCount,
        total_cost_ytd: totalCostYtd,
      };

      return { success: true, data: summary };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await auditLogger.error('SERVICE_ERROR', errorMessage, { service: 'dental', operation: 'unknown' });
      return { success: false, error: errorMessage };
    }
  }

  // =====================================================
  // TREATMENT PLANS
  // =====================================================

  /**
   * Create a treatment plan
   */
  static async createTreatmentPlan(
    request: CreateTreatmentPlanRequest
  ): Promise<DentalApiResponse<DentalTreatmentPlan>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const planData = {
        patient_id: request.patient_id,
        assessment_id: request.assessment_id,
        provider_id: user.id,
        plan_name: request.plan_name,
        plan_date: new Date().toISOString().split('T')[0],
        status: 'proposed' as const,
        treatment_goals: request.treatment_goals,
        phases: request.phases,
        total_estimated_cost: request.total_estimated_cost,
        created_by: user.id,
      };

      const { data, error } = await supabase
        .from('dental_treatment_plans')
        .insert(planData)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await auditLogger.error('TREATMENT_PLAN_CREATE_FAILED', errorMessage, {
        patientId: request.patient_id,
        planName: request.plan_name,
        resource_type: 'treatment_plan',
        operation: 'create'
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get treatment plans for a patient
   */
  static async getTreatmentPlansByPatient(
    patientId: string
  ): Promise<DentalApiResponse<DentalTreatmentPlan[]>> {
    try {
      const { data, error } = await supabase
        .from('dental_treatment_plans')
        .select('*')
        .eq('patient_id', patientId)
        .order('plan_date', { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await auditLogger.error('SERVICE_ERROR', errorMessage, { service: 'dental', operation: 'unknown' });
      return { success: false, error: errorMessage };
    }
  }

  // =====================================================
  // PATIENT SELF-TRACKING
  // =====================================================

  /**
   * Create patient dental health tracking entry
   */
  static async createPatientTracking(
    request: CreatePatientTrackingRequest
  ): Promise<DentalApiResponse<PatientDentalHealthTracking>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const trackingData = {
        patient_id: user.id,
        report_date: new Date().toISOString().split('T')[0],
        ...request,
      };

      const { data, error } = await supabase
        .from('patient_dental_health_tracking')
        .insert(trackingData)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await auditLogger.error('PATIENT_TRACKING_CREATE_FAILED', errorMessage, {
        resource_type: 'patient_tracking',
        operation: 'create'
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get patient tracking history
   */
  static async getPatientTrackingHistory(
    patientId: string,
    days: number = 30
  ): Promise<DentalApiResponse<PatientDentalHealthTracking[]>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('patient_dental_health_tracking')
        .select('*')
        .eq('patient_id', patientId)
        .gte('report_date', startDate.toISOString().split('T')[0])
        .order('report_date', { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await auditLogger.error('SERVICE_ERROR', errorMessage, { service: 'dental', operation: 'unknown' });
      return { success: false, error: errorMessage };
    }
  }

  // =====================================================
  // DASHBOARD & SUMMARIES
  // =====================================================

  /**
   * Get comprehensive dashboard summary for a patient
   */
  static async getDashboardSummary(
    patientId?: string
  ): Promise<DentalApiResponse<DentalHealthDashboardSummary>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const targetPatientId = patientId || user.id;

      // Get patient profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', targetPatientId)
        .single();

      // Get latest assessment
      const latestAssessmentResponse = await this.getLatestAssessment(targetPatientId);
      const latestAssessment = latestAssessmentResponse.data || undefined;

      // Get active treatment plans
      const treatmentPlansResponse = await this.getTreatmentPlansByPatient(targetPatientId);
      const activePlans = treatmentPlansResponse.data?.filter(
        plan => ['proposed', 'approved', 'in_progress'].includes(plan.status)
      ) || [];

      // Get procedures
      const proceduresResponse = await this.getProceduresByPatient(targetPatientId);
      const procedures = proceduresResponse.data || [];

      const currentYear = new Date().getFullYear();
      const completedThisYear = procedures.filter(p => {
        const procYear = new Date(p.procedure_date).getFullYear();
        return procYear === currentYear && p.procedure_status === 'completed';
      }).length;

      const pendingProcedures = procedures.filter(p => p.procedure_status === 'scheduled').length;

      // Get referrals
      const { data: referrals } = await supabase
        .from('dental_referrals')
        .select('*')
        .eq('patient_id', targetPatientId);

      const pendingReferrals = referrals?.filter(r => r.status === 'pending').length || 0;

      // Get recent self-reports
      const trackingResponse = await this.getPatientTrackingHistory(targetPatientId, 7);
      const recentReports = trackingResponse.data || [];

      // Extract current symptoms from latest report
      const latestReport = recentReports[0];
      const currentSymptoms: string[] = [];
      if (latestReport) {
        if (latestReport.tooth_pain) currentSymptoms.push('Tooth pain');
        if (latestReport.gum_bleeding) currentSymptoms.push('Bleeding gums');
        if (latestReport.dry_mouth) currentSymptoms.push('Dry mouth');
        if (latestReport.sensitive_teeth) currentSymptoms.push('Sensitive teeth');
        if (latestReport.jaw_pain) currentSymptoms.push('Jaw pain');
      }

      // Generate risk alerts
      const riskAlerts = this.generateRiskAlerts(latestAssessment, latestReport);

      // Calculate next recommended visit
      let nextRecommendedVisit: string | undefined;
      if (latestAssessment?.next_appointment_recommended_in_months) {
        const lastVisit = new Date(latestAssessment.visit_date);
        lastVisit.setMonth(lastVisit.getMonth() + latestAssessment.next_appointment_recommended_in_months);
        nextRecommendedVisit = lastVisit.toISOString().split('T')[0];
      }

      // Count active conditions from tooth chart
      let activeConditionsCount = 0;
      if (latestAssessment) {
        const toothChartResponse = await this.getToothChartByAssessment(latestAssessment.id);
        const teeth = toothChartResponse.data || [];
        activeConditionsCount = teeth.filter(
          t => !['healthy', 'missing', 'extraction'].includes(t.condition)
        ).length;
      }

      const summary: DentalHealthDashboardSummary = {
        patient_id: targetPatientId,
        patient_name: profile ? ((profile.first_name || '') + ' ' + (profile.last_name || '')).trim() || 'Unknown' : 'Unknown',
        latest_assessment: latestAssessment,
        last_visit_date: latestAssessment?.visit_date,
        next_recommended_visit: nextRecommendedVisit,
        overall_oral_health_rating: latestAssessment?.overall_oral_health_rating,
        periodontal_status: latestAssessment?.periodontal_status,
        active_conditions_count: activeConditionsCount,
        active_treatment_plans_count: activePlans.length,
        pending_procedures_count: pendingProcedures,
        completed_procedures_this_year: completedThisYear,
        pending_referrals_count: pendingReferrals,
        overdue_followups_count: (() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          let overdueCount = 0;

          // Count treatment plan phases with past start dates still pending
          activePlans.forEach((plan: any) => {
            if (plan.phases) {
              plan.phases.forEach((phase: any) => {
                if (phase.status === 'pending' && phase.start_date) {
                  const phaseDate = new Date(phase.start_date);
                  if (phaseDate < today) overdueCount++;
                }
              });
            }
          });

          // Count referrals with past scheduled appointments still pending
          referrals?.forEach((referral: any) => {
            if (referral.status === 'pending' && referral.appointment_scheduled_date) {
              const apptDate = new Date(referral.appointment_scheduled_date);
              if (apptDate < today) overdueCount++;
            }
          });

          // Count overdue recommended visits (past due for check-up)
          if (nextRecommendedVisit) {
            const recommendedDate = new Date(nextRecommendedVisit);
            if (recommendedDate < today) overdueCount++;
          }

          return overdueCount;
        })(),
        recent_self_reports: recentReports,
        current_symptoms: currentSymptoms,
        risk_alerts: riskAlerts,
      };

      return { success: true, data: summary };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await auditLogger.error('DENTAL_ASSESSMENT_LATEST_FETCH_FAILED', errorMessage, { patientId, operation: 'read_latest' });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Generate risk alerts based on assessment and self-tracking data
   */
  private static generateRiskAlerts(
    assessment?: DentalAssessment,
    latestReport?: PatientDentalHealthTracking
  ): DentalRiskAlert[] {
    const alerts: DentalRiskAlert[] = [];

    if (!assessment) return alerts;

    // Periodontal disease alert
    if (assessment.periodontal_status) {
      if (['severe_periodontitis', 'advanced_periodontitis'].includes(assessment.periodontal_status)) {
        alerts.push({
          severity: 'critical',
          category: 'periodontal',
          message: 'Severe periodontal disease detected - linked to increased risk of heart disease and diabetes complications',
          recommended_action: 'Schedule immediate specialist consultation and increase monitoring frequency',
          related_condition: 'Cardiovascular & Diabetes Risk',
        });
      } else if (assessment.periodontal_status === 'moderate_periodontitis') {
        alerts.push({
          severity: 'high',
          category: 'periodontal',
          message: 'Moderate gum disease present - may impact chronic disease management',
          recommended_action: 'Schedule periodontal treatment and coordinate with primary care physician',
          related_condition: 'Chronic Disease Management',
        });
      }
    }

    // Diabetes-related oral health risk
    if (assessment.diabetes_present && assessment.gingival_index && assessment.gingival_index > 2) {
      alerts.push({
        severity: 'high',
        category: 'chronic-disease-link',
        message: 'Poor gingival health in diabetic patient - bidirectional relationship with glucose control',
        recommended_action: 'Coordinate care with endocrinologist, increase dental visit frequency',
        related_condition: 'Diabetes',
      });
    }

    // Dry mouth (common in elderly and medication users)
    if (latestReport?.dry_mouth || assessment.dry_mouth) {
      alerts.push({
        severity: 'medium',
        category: 'medication-side-effect',
        message: 'Dry mouth detected - increases cavity risk and may indicate medication side effects',
        recommended_action: 'Review medications with physician, use saliva substitutes, increase fluoride treatments',
        related_condition: 'Medication Management',
      });
    }

    // Pain alert
    if (latestReport?.tooth_pain && latestReport.tooth_pain_severity && latestReport.tooth_pain_severity >= 7) {
      alerts.push({
        severity: 'critical',
        category: 'infection',
        message: 'Severe dental pain reported - possible infection requiring immediate attention',
        recommended_action: 'Schedule emergency dental visit',
      });
    }

    // Nutrition impact
    if (latestReport?.difficulty_chewing || latestReport?.dental_health_affects_nutrition) {
      alerts.push({
        severity: 'high',
        category: 'nutrition',
        message: 'Dental issues impacting nutrition - may affect overall health and chronic disease management',
        recommended_action: 'Nutritional counseling and expedited dental treatment',
        related_condition: 'Malnutrition Risk',
      });
    }

    return alerts;
  }

  // =====================================================
  // CDT CODES
  // =====================================================

  /**
   * Search CDT codes
   */
  static async searchCDTCodes(searchTerm: string): Promise<DentalApiResponse<CDTCode[]>> {
    try {
      const { data, error } = await supabase
        .from('dental_cdt_codes')
        .select('*')
        .or(`code.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .eq('active', true)
        .order('code')
        .limit(20);

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await auditLogger.error('CDT_CODE_SEARCH_FAILED', errorMessage, {
        searchTerm,
        resource_type: 'cdt_code',
        operation: 'search'
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get CDT code by code
   */
  static async getCDTCode(code: string): Promise<DentalApiResponse<CDTCode>> {
    try {
      const { data, error } = await supabase
        .from('dental_cdt_codes')
        .select('*')
        .eq('code', code)
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await auditLogger.error('SERVICE_ERROR', errorMessage, { service: 'dental', operation: 'unknown' });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get preventive CDT codes
   */
  static async getPreventiveCDTCodes(): Promise<DentalApiResponse<CDTCode[]>> {
    try {
      const { data, error } = await supabase
        .from('dental_cdt_codes')
        .select('*')
        .eq('preventive', true)
        .eq('active', true)
        .order('code');

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await auditLogger.error('PREVENTIVE_CDT_FETCH_FAILED', errorMessage, {
        resource_type: 'cdt_code',
        operation: 'list_preventive'
      });
      return { success: false, error: errorMessage };
    }
  }
}
