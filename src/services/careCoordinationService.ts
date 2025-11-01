// Care Coordination Service - Manage care plans and team coordination
// Production-grade service for coordinating care across teams
// White-label ready - configurable for any healthcare organization

import { supabase } from '../lib/supabaseClient';
import { PAGINATION_LIMITS, applyLimit } from '../utils/pagination';
import { claudeService } from './claudeService';
import { UserRole, RequestType, ClaudeRequestContext } from '../types/claude';

export interface CarePlan {
  id?: string;
  patient_id: string;
  plan_type: 'readmission_prevention' | 'chronic_care' | 'transitional_care' | 'high_utilizer';
  status: 'draft' | 'active' | 'completed' | 'discontinued';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  goals: CarePlanGoal[];
  interventions: CarePlanIntervention[];
  barriers?: CarePlanBarrier[];
  sdoh_factors?: Record<string, any>;
  sdoh_assessment_id?: string;
  care_team_members?: CarePlanTeamMember[];
  primary_coordinator_id?: string;
  start_date: string;
  end_date?: string;
  last_reviewed_date?: string;
  next_review_date?: string;
  outcome_measures?: Record<string, any>;
  success_metrics?: Record<string, any>;
  clinical_notes?: string;
}

export interface CarePlanGoal {
  goal: string;
  target: string;
  timeframe: string;
  progress?: string;
  status?: 'not_started' | 'in_progress' | 'achieved' | 'discontinued';
}

export interface CarePlanIntervention {
  intervention: string;
  frequency: string;
  responsible: string;
  status?: 'pending' | 'active' | 'completed' | 'discontinued';
  last_performed?: string;
  next_due?: string;
}

export interface CarePlanBarrier {
  barrier: string;
  solution: string;
  priority: 'low' | 'medium' | 'high';
  status?: 'identified' | 'addressing' | 'resolved';
}

export interface CarePlanTeamMember {
  role: string;
  user_id?: string;
  name: string;
  contact?: string;
}

export interface CareTeamAlert {
  id?: string;
  patient_id: string;
  care_plan_id?: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  priority: 'routine' | 'urgent' | 'emergency';
  title: string;
  description: string;
  alert_data?: Record<string, any>;
  assigned_to?: string;
  status: 'active' | 'acknowledged' | 'in_progress' | 'resolved' | 'dismissed';
  actions_taken?: any[];
}

export class CareCoordinationService {
  /**
   * Create a new care plan
   */
  static async createCarePlan(plan: CarePlan): Promise<CarePlan> {
    try {
      const { data, error } = await supabase
        .from('care_coordination_plans')
        .insert({
          patient_id: plan.patient_id,
          plan_type: plan.plan_type,
          status: plan.status || 'draft',
          priority: plan.priority,
          title: plan.title,
          goals: plan.goals,
          interventions: plan.interventions,
          barriers: plan.barriers || [],
          sdoh_factors: plan.sdoh_factors || {},
          sdoh_assessment_id: plan.sdoh_assessment_id,
          care_team_members: plan.care_team_members || [],
          primary_coordinator_id: plan.primary_coordinator_id,
          start_date: plan.start_date,
          end_date: plan.end_date,
          next_review_date: plan.next_review_date,
          outcome_measures: plan.outcome_measures || {},
          success_metrics: plan.success_metrics || {},
          clinical_notes: plan.clinical_notes
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {

      throw new Error(`Care plan creation failed: ${error.message}`);
    }
  }

  /**
   * Update an existing care plan
   */
  static async updateCarePlan(planId: string, updates: Partial<CarePlan>): Promise<CarePlan> {
    try {
      const { data, error } = await supabase
        .from('care_coordination_plans')
        .update({
          ...updates,
          last_reviewed_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', planId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {

      throw new Error(`Care plan update failed: ${error.message}`);
    }
  }

  /**
   * Get care plan by ID
   */
  static async getCarePlan(planId: string): Promise<CarePlan> {
    const { data, error } = await supabase
      .from('care_coordination_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (error) throw new Error(`Failed to fetch care plan: ${error.message}`);
    return data;
  }

  /**
   * Get all care plans for a patient
   */
  static async getPatientCarePlans(patientId: string, activeOnly: boolean = true): Promise<CarePlan[]> {
    let query = supabase
      .from('care_coordination_plans')
      .select('*')
      .eq('patient_id', patientId);

    if (activeOnly) {
      query = query.eq('status', 'active');
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch care plans: ${error.message}`);
    return data || [];
  }

  /**
   * Get care plans that need review
   */
  static async getCarePlansNeedingReview(): Promise<CarePlan[]> {
    const today = new Date().toISOString().split('T')[0];

    const query = supabase
      .from('care_coordination_plans')
      .select('*, profiles(*)')
      .eq('status', 'active')
      .lte('next_review_date', today)
      .order('next_review_date', { ascending: true });

    // Apply pagination limit to prevent unbounded queries
    // Limit to 50 care plans needing review for performance
    return await applyLimit<CarePlan>(query, PAGINATION_LIMITS.CARE_PLANS);
  }

  /**
   * Complete a care plan
   */
  static async completeCarePlan(
    planId: string,
    outcomeNotes: string,
    successMetrics?: Record<string, any>
  ): Promise<CarePlan> {
    return this.updateCarePlan(planId, {
      status: 'completed',
      end_date: new Date().toISOString().split('T')[0],
      clinical_notes: outcomeNotes,
      success_metrics: successMetrics
    });
  }

  /**
   * Create a care team alert
   */
  static async createAlert(alert: CareTeamAlert): Promise<CareTeamAlert> {
    try {
      const { data, error } = await supabase
        .from('care_team_alerts')
        .insert({
          patient_id: alert.patient_id,
          care_plan_id: alert.care_plan_id,
          alert_type: alert.alert_type,
          severity: alert.severity,
          priority: alert.priority,
          title: alert.title,
          description: alert.description,
          alert_data: alert.alert_data || {},
          assigned_to: alert.assigned_to,
          status: alert.status || 'active',
          actions_taken: alert.actions_taken || []
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {

      throw new Error(`Alert creation failed: ${error.message}`);
    }
  }

  /**
   * Update alert status
   */
  static async updateAlertStatus(
    alertId: string,
    status: CareTeamAlert['status'],
    actionNotes?: string
  ): Promise<CareTeamAlert> {
    try {
      const updateData: any = { status };

      if (status === 'acknowledged') {
        updateData.acknowledged_at = new Date().toISOString();
        updateData.acknowledged_by = (await supabase.auth.getUser()).data.user?.id;
      }

      if (status === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by = (await supabase.auth.getUser()).data.user?.id;
        if (actionNotes) {
          updateData.resolution_notes = actionNotes;
        }
      }

      // Add action to history
      if (actionNotes) {
        const { data: currentAlert } = await supabase
          .from('care_team_alerts')
          .select('actions_taken')
          .eq('id', alertId)
          .single();

        const actions = currentAlert?.actions_taken || [];
        actions.push({
          action: actionNotes,
          time: new Date().toISOString(),
          status: status
        });
        updateData.actions_taken = actions;
      }

      const { data, error } = await supabase
        .from('care_team_alerts')
        .update(updateData)
        .eq('id', alertId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {

      throw new Error(`Alert update failed: ${error.message}`);
    }
  }

  /**
   * Get active alerts for care team
   */
  static async getActiveAlerts(assignedToUserId?: string): Promise<CareTeamAlert[]> {
    let query = supabase
      .from('care_team_alerts')
      .select('*, profiles(*)')
      .eq('status', 'active')
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false });

    if (assignedToUserId) {
      query = query.eq('assigned_to', assignedToUserId);
    }

    // Apply pagination limit to prevent unbounded queries
    // Limit to 100 most critical alerts for performance
    return await applyLimit<CareTeamAlert>(query, PAGINATION_LIMITS.ALERTS);
  }

  /**
   * Assign alert to team member
   */
  static async assignAlert(alertId: string, userId: string): Promise<CareTeamAlert> {
    const { data, error } = await supabase
      .from('care_team_alerts')
      .update({
        assigned_to: userId,
        assigned_at: new Date().toISOString(),
        status: 'acknowledged'
      })
      .eq('id', alertId)
      .select()
      .single();

    if (error) throw new Error(`Failed to assign alert: ${error.message}`);
    return data;
  }

  /**
   * Generate AI-powered care plan recommendations
   */
  static async generateCarePlanRecommendations(
    patientId: string,
    planType: CarePlan['plan_type']
  ): Promise<Partial<CarePlan>> {
    try {
      // Gather patient data
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', patientId)
        .single();

      const { data: readmissions } = await supabase
        .from('patient_readmissions')
        .select('*')
        .eq('patient_id', patientId)
        .order('admission_date', { ascending: false })
        .limit(5);

      const { data: sdohAssessment } = await supabase
        .from('sdoh_assessments')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Build comprehensive prompt
      const context: ClaudeRequestContext = {
        userId: 'care-coordination-ai',
        userRole: UserRole.ADMIN,
        requestId: `care-plan-rec-${patientId}`,
        timestamp: new Date(),
        requestType: RequestType.RISK_ASSESSMENT
      };

      const prompt = `Generate a comprehensive care coordination plan recommendation for a patient.

PLAN TYPE: ${planType}

PATIENT PROFILE:
- Age: ${profile?.age || 'Unknown'}
- Recent visits: ${readmissions?.length || 0} in past 90 days
${readmissions?.length ? `- Most recent: ${readmissions[0].facility_type} on ${readmissions[0].admission_date}` : ''}

${sdohAssessment ? `
SOCIAL DETERMINANTS:
- Complexity Score: ${sdohAssessment.overall_complexity_score}
- Housing: ${sdohAssessment.housing_instability ? 'Concerns identified' : 'Stable'}
- Food: ${sdohAssessment.food_insecurity ? 'Concerns identified' : 'Secure'}
- Transportation: ${sdohAssessment.transportation_barriers ? 'Barriers present' : 'No barriers'}
- Social: ${sdohAssessment.social_isolation ? 'Isolated' : 'Supported'}
` : ''}

Generate specific, actionable recommendations in JSON format:
{
  "title": "Descriptive plan title",
  "priority": "low|medium|high|critical",
  "goals": [
    {"goal": "Specific goal", "target": "Measurable target", "timeframe": "Timeline"}
  ],
  "interventions": [
    {"intervention": "Action to take", "frequency": "How often", "responsible": "Who does it"}
  ],
  "barriers": [
    {"barrier": "Potential obstacle", "solution": "How to overcome", "priority": "low|medium|high"}
  ]
}

Make recommendations specific to the patient's situation and plan type.`;

      const aiResponse = await claudeService.generateMedicalAnalytics(
        prompt,
        [],
        context
      );

      // Parse AI response
      try {
        const jsonMatch = aiResponse.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const recommendations = JSON.parse(jsonMatch[0]);
          return {
            title: recommendations.title,
            priority: recommendations.priority,
            goals: recommendations.goals,
            interventions: recommendations.interventions,
            barriers: recommendations.barriers,
            clinical_notes: `AI-generated recommendations using ${aiResponse.model}. Cost: $${aiResponse.cost.toFixed(4)}`
          };
        }
      } catch (parseError) {

      }

      // Fallback to template-based plan
      return this.getTemplatePlan(planType);

    } catch (error: any) {

      return this.getTemplatePlan(planType);
    }
  }

  /**
   * Get template care plan based on type
   */
  private static getTemplatePlan(planType: CarePlan['plan_type']): Partial<CarePlan> {
    const templates = {
      readmission_prevention: {
        title: 'Readmission Prevention Plan',
        priority: 'high' as const,
        goals: [
          { goal: 'Prevent 30-day readmission', target: 'Zero readmissions', timeframe: '30 days' },
          { goal: 'Attend all follow-up appointments', target: '100% attendance', timeframe: '30 days' }
        ],
        interventions: [
          { intervention: 'Daily check-in calls', frequency: 'daily for 7 days', responsible: 'nurse' },
          { intervention: 'Medication reconciliation', frequency: 'within 48 hours', responsible: 'pharmacist' }
        ]
      },
      high_utilizer: {
        title: 'High Utilizer Care Management Plan',
        priority: 'high' as const,
        goals: [
          { goal: 'Reduce ER visits', target: 'Less than 2 per month', timeframe: '90 days' },
          { goal: 'Establish primary care relationship', target: 'Monthly PCP visits', timeframe: '90 days' }
        ],
        interventions: [
          { intervention: 'Care coordinator assignment', frequency: 'ongoing', responsible: 'care_coordinator' },
          { intervention: 'Weekly check-ins', frequency: 'weekly', responsible: 'nurse' }
        ]
      },
      chronic_care: {
        title: 'Chronic Care Management Plan',
        priority: 'medium' as const,
        goals: [
          { goal: 'Improve chronic condition control', target: 'Within target ranges', timeframe: '90 days' }
        ],
        interventions: [
          { intervention: 'Monthly care coordination', frequency: 'monthly', responsible: 'care_team' }
        ]
      },
      transitional_care: {
        title: 'Transitional Care Plan',
        priority: 'high' as const,
        goals: [
          { goal: 'Safe transition to home', target: 'No complications', timeframe: '14 days' }
        ],
        interventions: [
          { intervention: 'Post-discharge follow-up', frequency: 'within 48 hours', responsible: 'nurse' }
        ]
      }
    };

    return templates[planType] || templates.chronic_care;
  }
}

export default CareCoordinationService;
