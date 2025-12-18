// Readmission Tracking Service - Frequent Flyer Prevention
// Production-grade service for tracking and preventing hospital readmissions
// White-label ready - configurable for any healthcare organization

import { supabase } from '../lib/supabaseClient';
import { PAGINATION_LIMITS, applyLimit } from '../utils/pagination';
import { claudeService } from './claudeService';
import { UserRole, RequestType, ClaudeRequestContext } from '../types/claude';
import { auditLogger } from './auditLogger';

export interface ReadmissionEvent {
  id?: string;
  patient_id: string;
  admission_date: string;
  discharge_date?: string;
  facility_name: string;
  facility_type: 'er' | 'hospital' | 'urgent_care' | 'observation';
  is_readmission?: boolean;
  days_since_last_discharge?: number;
  previous_admission_id?: string;
  readmission_category?: '7_day' | '30_day' | '90_day' | 'none';
  primary_diagnosis_code?: string;
  primary_diagnosis_description?: string;
  secondary_diagnoses?: string[];
  risk_score?: number;
  follow_up_scheduled?: boolean;
  follow_up_completed?: boolean;
  follow_up_date?: string;
  care_plan_created?: boolean;
  care_team_notified?: boolean;
  high_utilizer_flag?: boolean;
}

export interface HighUtilizerMetrics {
  patient_id: string;
  period_start: string;
  period_end: string;
  er_visits: number;
  hospital_admissions: number;
  readmissions: number;
  urgent_care_visits: number;
  total_visits: number;
  risk_score: number;
  risk_category: 'low' | 'moderate' | 'high' | 'critical';
  cms_penalty_risk: boolean;
  inpatient_days?: number;
  estimated_cost?: number;
}

export class ReadmissionTrackingService {
  /**
   * Log a new readmission event and automatically detect patterns
   */
  static async logReadmissionEvent(event: ReadmissionEvent): Promise<ReadmissionEvent> {
    try {
      // Find previous admissions for this patient
      const { data: previousAdmissions, error: queryError } = await supabase
        .from('patient_readmissions')
        .select('*')
        .eq('patient_id', event.patient_id)
        .order('admission_date', { ascending: false })
        .limit(5);

      if (queryError) throw queryError;

      // Calculate if this is a readmission
      const readmissionAnalysis = this.analyzeReadmission(event, previousAdmissions || []);

      // Merge analysis with event
      const enrichedEvent = {
        ...event,
        ...readmissionAnalysis
      };

      // Insert the event
      const { data, error } = await supabase
        .from('patient_readmissions')
        .insert(enrichedEvent)
        .select()
        .single();

      if (error) throw error;

      // Trigger automated workflows if high risk
      if (readmissionAnalysis.high_utilizer_flag || (readmissionAnalysis.risk_score !== undefined && readmissionAnalysis.risk_score >= 70)) {
        await this.triggerHighRiskWorkflow(data);
      }

      return data;
    } catch (error: any) {

      throw new Error(`Readmission logging failed: ${error.message}`);
    }
  }

  /**
   * Analyze if admission is a readmission and calculate risk
   */
  private static analyzeReadmission(
    currentEvent: ReadmissionEvent,
    previousAdmissions: any[]
  ): Partial<ReadmissionEvent> {
    if (!previousAdmissions || previousAdmissions.length === 0) {
      return {
        is_readmission: false,
        readmission_category: 'none',
        risk_score: 30,
        high_utilizer_flag: false
      };
    }

    const lastDischarge = previousAdmissions.find(a => a.discharge_date);
    if (!lastDischarge) {
      return {
        is_readmission: false,
        readmission_category: 'none',
        risk_score: 40
      };
    }

    const daysSinceDischarge = this.calculateDaysDifference(
      lastDischarge.discharge_date,
      currentEvent.admission_date
    );

    let readmissionCategory: '7_day' | '30_day' | '90_day' | 'none' = 'none';
    let isReadmission = false;
    let riskScore = 50;

    if (daysSinceDischarge <= 7) {
      readmissionCategory = '7_day';
      isReadmission = true;
      riskScore = 95;
    } else if (daysSinceDischarge <= 30) {
      readmissionCategory = '30_day';
      isReadmission = true;
      riskScore = 85;
    } else if (daysSinceDischarge <= 90) {
      readmissionCategory = '90_day';
      isReadmission = true;
      riskScore = 70;
    }

    // Check if high utilizer (3+ visits in 30 days)
    const recentVisits = previousAdmissions.filter(a => {
      const daysAgo = this.calculateDaysDifference(a.admission_date, new Date().toISOString());
      return daysAgo <= 30;
    });

    const highUtilizerFlag = recentVisits.length >= 2; // Current + 2 previous = 3 total

    if (highUtilizerFlag) {
      riskScore = Math.min(100, riskScore + 15);
    }

    return {
      is_readmission: isReadmission,
      days_since_last_discharge: daysSinceDischarge,
      previous_admission_id: lastDischarge.id,
      readmission_category: readmissionCategory,
      risk_score: riskScore,
      high_utilizer_flag: highUtilizerFlag
    };
  }

  /**
   * Trigger automated workflows for high-risk patients
   */
  private static async triggerHighRiskWorkflow(readmission: any): Promise<void> {
    try {
      // 1. Create care team alert
      await supabase.from('care_team_alerts').insert({
        patient_id: readmission.patient_id,
        alert_type: readmission.is_readmission ? 'readmission_risk_high' : 'er_visit_detected',
        severity: readmission.risk_score >= 90 ? 'critical' : 'high',
        priority: readmission.risk_score >= 90 ? 'emergency' : 'urgent',
        title: `High-Risk ${readmission.is_readmission ? 'Readmission' : 'ER Visit'} Detected`,
        description: `Patient admitted to ${readmission.facility_name} on ${readmission.admission_date}. Risk score: ${readmission.risk_score}. ${readmission.is_readmission ? `Readmission within ${readmission.readmission_category} window.` : ''}`,
        alert_data: {
          readmission_id: readmission.id,
          facility: readmission.facility_name,
          admission_date: readmission.admission_date,
          risk_score: readmission.risk_score,
          high_utilizer: readmission.high_utilizer_flag
        },
        status: 'active'
      });

      // 2. Check if patient needs care plan
      const { data: existingPlans } = await supabase
        .from('care_coordination_plans')
        .select('id')
        .eq('patient_id', readmission.patient_id)
        .eq('status', 'active')
        .limit(1);

      if (!existingPlans || existingPlans.length === 0) {
        // Auto-generate care plan using AI
        await this.generateAutomatedCarePlan(readmission);
      }

    } catch (error) {

      // Don't throw - we don't want to fail the readmission logging
    }
  }

  /**
   * Generate automated care plan using AI
   */
  private static async generateAutomatedCarePlan(readmission: any): Promise<void> {
    try {
      // Get patient profile for context
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', readmission.patient_id)
        .single();

      const context: ClaudeRequestContext = {
        userId: 'care-coordination-system',
        userRole: UserRole.ADMIN,
        requestId: `care-plan-${readmission.id}`,
        timestamp: new Date(),
        requestType: RequestType.RISK_ASSESSMENT
      };

      const prompt = `Generate a comprehensive care coordination plan for a high-risk patient.

PATIENT SITUATION:
- Recent admission to: ${readmission.facility_name}
- Admission type: ${readmission.facility_type}
- Risk score: ${readmission.risk_score}/100
- Is readmission: ${readmission.is_readmission}
${readmission.primary_diagnosis_description ? `- Primary diagnosis: ${readmission.primary_diagnosis_description}` : ''}
${readmission.high_utilizer_flag ? '- FLAGGED AS HIGH UTILIZER (multiple recent visits)' : ''}

Please generate:
1. THREE specific, measurable goals for this patient
2. FIVE concrete interventions with responsible parties and frequency
3. THREE potential barriers to care and solutions
4. Key success metrics to track

Format as JSON with this structure:
{
  "goals": [{"goal": "...", "target": "...", "timeframe": "..."}],
  "interventions": [{"intervention": "...", "frequency": "...", "responsible": "..."}],
  "barriers": [{"barrier": "...", "solution": "...", "priority": "..."}],
  "success_metrics": [{"metric": "...", "target": "..."}]
}`;

      const aiResponse = await claudeService.generateMedicalAnalytics(
        prompt,
        [],
        context
      );

      // Parse AI response
      let planData;
      try {
        // Try to extract JSON from response
        const jsonMatch = aiResponse.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          planData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in AI response');
        }
      } catch {
        // Fallback to default plan
        planData = this.getDefaultCarePlan(readmission);
      }

      // Create care plan
      await supabase.from('care_coordination_plans').insert({
        patient_id: readmission.patient_id,
        plan_type: readmission.is_readmission ? 'readmission_prevention' : 'high_utilizer',
        status: 'active',
        priority: readmission.risk_score >= 90 ? 'critical' : 'high',
        title: `Automated ${readmission.is_readmission ? 'Readmission Prevention' : 'High Utilizer'} Care Plan`,
        goals: planData.goals || [],
        interventions: planData.interventions || [],
        barriers: planData.barriers || [],
        start_date: new Date().toISOString().split('T')[0],
        next_review_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days
        success_metrics: planData.success_metrics || {},
        clinical_notes: `Automatically generated care plan based on ${readmission.is_readmission ? 'readmission' : 'ER visit'} on ${readmission.admission_date}. AI-assisted planning with ${aiResponse.model}.`
      });

    } catch (error) {

      // Create basic plan as fallback
      await supabase.from('care_coordination_plans').insert({
        patient_id: readmission.patient_id,
        plan_type: 'readmission_prevention',
        status: 'draft',
        priority: 'high',
        title: 'Care Plan - Needs Manual Review',
        goals: this.getDefaultCarePlan(readmission).goals,
        interventions: this.getDefaultCarePlan(readmission).interventions,
        start_date: new Date().toISOString().split('T')[0],
        clinical_notes: 'Automatic generation failed. Requires manual care plan development.'
      });
    }
  }

  /**
   * Identify high utilizers in the system
   */
  static async identifyHighUtilizers(
    periodDays: number = 30
  ): Promise<HighUtilizerMetrics[]> {
    try {
      const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      // Query all admissions in period with pagination limit
      const query = supabase
        .from('patient_readmissions')
        .select('*')
        .gte('admission_date', startDate)
        .lte('admission_date', endDate);

      // Apply pagination limit to prevent unbounded queries
      // Limit to recent encounters for performance
      const admissions = await applyLimit<any>(query, PAGINATION_LIMITS.ENCOUNTERS * 10); // Higher limit for analysis

      // Group by patient
      const patientMap = new Map<string, any[]>();
      admissions.forEach(admission => {
        const existing = patientMap.get(admission.patient_id) || [];
        existing.push(admission);
        patientMap.set(admission.patient_id, existing);
      });

      // Calculate metrics for each patient
      const metrics: HighUtilizerMetrics[] = [];

      for (const [patientId, visits] of patientMap.entries()) {
        if (visits.length >= 2) { // High utilizer threshold
          const erVisits = visits.filter(v => v.facility_type === 'er').length;
          const hospitalAdmissions = visits.filter(v => v.facility_type === 'hospital').length;
          const readmissions = visits.filter(v => v.is_readmission).length;
          const urgentCare = visits.filter(v => v.facility_type === 'urgent_care').length;

          const riskScore = this.calculateUtilizationRiskScore(visits);
          const riskCategory = this.categorizeRisk(riskScore);

          metrics.push({
            patient_id: patientId,
            period_start: startDate,
            period_end: endDate,
            er_visits: erVisits,
            hospital_admissions: hospitalAdmissions,
            readmissions: readmissions,
            urgent_care_visits: urgentCare,
            total_visits: visits.length,
            risk_score: riskScore,
            risk_category: riskCategory,
            cms_penalty_risk: readmissions > 0 // CMS penalizes readmissions
          });
        }
      }

      // Save analytics to database
      for (const metric of metrics) {
        await supabase.from('high_utilizer_analytics').upsert({
          patient_id: metric.patient_id,
          analysis_period_start: metric.period_start,
          analysis_period_end: metric.period_end,
          er_visits_count: metric.er_visits,
          hospital_admissions_count: metric.hospital_admissions,
          readmissions_count: metric.readmissions,
          urgent_care_visits_count: metric.urgent_care_visits,
          total_visits: metric.total_visits,
          utilization_risk_score: metric.risk_score,
          overall_risk_category: metric.risk_category,
          cms_penalty_risk: metric.cms_penalty_risk
        });
      }

      return metrics;
    } catch (error: any) {

      throw new Error(`Failed to identify high utilizers: ${error.message}`);
    }
  }

  /**
   * Get readmission events for a patient
   */
  static async getPatientReadmissions(patientId: string): Promise<ReadmissionEvent[]> {
    const query = supabase
      .from('patient_readmissions')
      .select('*')
      .eq('patient_id', patientId)
      .order('admission_date', { ascending: false });

    // Apply pagination limit to prevent unbounded queries
    // Limit to 50 most recent readmission events per patient
    return await applyLimit<ReadmissionEvent>(query, PAGINATION_LIMITS.ENCOUNTERS);
  }

  /**
   * Get all active high-risk patients
   */
  static async getActiveHighRiskPatients(): Promise<any[]> {
    const query = supabase
      .from('patient_readmissions')
      .select('*, profiles(*)')
      .eq('high_utilizer_flag', true)
      .gte('admission_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('risk_score', { ascending: false });

    // Apply pagination limit to prevent unbounded queries
    // Limit to 100 highest-risk patients for performance
    return await applyLimit<any>(query, PAGINATION_LIMITS.ALERTS);
  }

  // Helper methods
  private static calculateDaysDifference(dateStr1: string, dateStr2: string): number {
    const date1 = new Date(dateStr1);
    const date2 = new Date(dateStr2);
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  private static calculateUtilizationRiskScore(visits: any[]): number {
    let score = 0;

    // Base score on number of visits
    score += Math.min(visits.length * 15, 40);

    // Add points for ER visits (higher weight)
    const erVisits = visits.filter(v => v.facility_type === 'er').length;
    score += erVisits * 15;

    // Add points for readmissions (highest weight)
    const readmissions = visits.filter(v => v.is_readmission).length;
    score += readmissions * 25;

    // Add points for short-interval readmissions
    const sevenDayReadmissions = visits.filter(v => v.readmission_category === '7_day').length;
    score += sevenDayReadmissions * 15;

    return Math.min(score, 100);
  }

  private static categorizeRisk(score: number): 'low' | 'moderate' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'moderate';
    return 'low';
  }

  private static getDefaultCarePlan(readmission: any) {
    return {
      goals: [
        {
          goal: 'Prevent readmission within 30 days',
          target: 'Zero ER visits or hospital readmissions',
          timeframe: '30 days'
        },
        {
          goal: 'Improve medication adherence',
          target: '100% adherence to prescribed medications',
          timeframe: '14 days'
        },
        {
          goal: 'Establish regular primary care follow-up',
          target: 'Scheduled appointment within 7 days of discharge',
          timeframe: '7 days'
        }
      ],
      interventions: [
        {
          intervention: 'Daily check-in calls for first 7 days',
          frequency: 'daily',
          responsible: 'care_coordinator'
        },
        {
          intervention: 'Medication reconciliation and education',
          frequency: 'within 48 hours',
          responsible: 'pharmacist'
        },
        {
          intervention: 'Schedule follow-up with PCP',
          frequency: 'within 7 days',
          responsible: 'care_coordinator'
        },
        {
          intervention: 'Transportation assistance for appointments',
          frequency: 'as needed',
          responsible: 'social_worker'
        },
        {
          intervention: 'Weekly nurse check-ins for 30 days',
          frequency: 'weekly',
          responsible: 'registered_nurse'
        }
      ],
      barriers: [
        {
          barrier: 'Transportation to appointments',
          solution: 'Coordinate medical transport or rideshare',
          priority: 'high'
        },
        {
          barrier: 'Medication non-adherence',
          solution: 'Provide pill organizer and daily reminders',
          priority: 'high'
        },
        {
          barrier: 'Limited health literacy',
          solution: 'Use teach-back method and simplified materials',
          priority: 'medium'
        }
      ],
      success_metrics: [
        {
          metric: 'Days without ER visit',
          target: '30+ days'
        },
        {
          metric: 'Medication adherence rate',
          target: '>95%'
        },
        {
          metric: 'Follow-up appointments completed',
          target: '100%'
        }
      ]
    };
  }

  /**
   * Get patient's visit history for a given period
   * Returns all recorded visits, ER visits, and hospital admissions
   */
  static async getPatientVisitHistory(patientId: string, days: number = 90): Promise<any[]> {
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('patient_readmissions')
        .select(`
          id,
          admission_date,
          discharge_date,
          facility_name,
          facility_type,
          is_readmission,
          readmission_category,
          primary_diagnosis_description,
          risk_score,
          follow_up_scheduled,
          follow_up_completed
        `)
        .eq('patient_id', patientId)
        .gte('admission_date', cutoffDate)
        .order('admission_date', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Transform to visit history format
      return (data || []).map(visit => ({
        id: visit.id,
        visit_date: visit.admission_date,
        visit_type: visit.facility_type === 'er' ? 'Emergency Room' :
                    visit.facility_type === 'hospital' ? 'Hospital Admission' :
                    visit.facility_type === 'urgent_care' ? 'Urgent Care' :
                    visit.facility_type === 'observation' ? 'Observation' : 'Visit',
        facility_name: visit.facility_name,
        status: visit.discharge_date ? 'completed' : 'in_progress',
        is_readmission: visit.is_readmission,
        readmission_category: visit.readmission_category,
        diagnosis: visit.primary_diagnosis_description,
        risk_score: visit.risk_score,
        follow_up_scheduled: visit.follow_up_scheduled,
        follow_up_completed: visit.follow_up_completed,
        created_at: visit.admission_date
      }));
    } catch (error: any) {
      auditLogger.error('READMISSION_VISIT_HISTORY_FAILED', error, {
        patientId,
        days,
        context: 'patient_visit_history'
      });
      return [];
    }
  }
}

export default ReadmissionTrackingService;
