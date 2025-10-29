// Patient Outreach Service - SMS/App check-ins and automated communication
// Production-grade service for daily patient monitoring
// White-label ready - supports Twilio for SMS, configurable for any provider

import { supabase } from '../lib/supabaseClient';
import { claudeService } from './claudeService';
import { UserRole, RequestType, ClaudeRequestContext } from '../types/claude';
import { CareCoordinationService } from './careCoordinationService';

export interface CheckInQuestion {
  question: string;
  type: 'yes_no' | 'scale' | 'text' | 'multiple_choice';
  scale?: { min: number; max: number; label_min?: string; label_max?: string };
  choices?: string[];
  required?: boolean;
}

export interface CheckInResponse {
  question_id: string;
  answer: string | number | boolean;
  timestamp: string;
}

export interface DailyCheckIn {
  id?: string;
  patient_id: string;
  care_plan_id?: string;
  check_in_date: string;
  check_in_method: 'sms' | 'app' | 'phone_call' | 'automated';
  status: 'pending' | 'completed' | 'missed' | 'escalated';
  questions_asked: CheckInQuestion[];
  responses?: Record<string, any>;
  alert_triggered?: boolean;
  alert_type?: string;
  alert_severity?: 'low' | 'medium' | 'high' | 'critical';
  requires_follow_up?: boolean;
  follow_up_notes?: string;
  concern_flags?: string[];
  ai_analysis_summary?: string;
}

export interface OutreachCampaign {
  name: string;
  target_patient_ids?: string[];
  target_criteria?: Record<string, any>;
  message_template: string;
  send_method: 'sms' | 'app_notification' | 'both';
  scheduled_time?: string;
}

export class PatientOutreachService {
  /**
   * Send daily check-in to a patient via SMS or app
   */
  static async sendDailyCheckIn(
    patientId: string,
    method: 'sms' | 'app' = 'sms',
    customQuestions?: CheckInQuestion[]
  ): Promise<DailyCheckIn> {
    try {
      // Get patient profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('phone, first_name')
        .eq('id', patientId)
        .single();

      if (profileError) throw profileError;

      // Get active care plan to customize questions
      const carePlans = await supabase
        .from('care_coordination_plans')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', 'active')
        .limit(1);

      const activePlan = carePlans.data?.[0];

      // Generate check-in questions
      const questions = customQuestions || this.generateDefaultQuestions(activePlan);

      // Create check-in record
      const checkIn: DailyCheckIn = {
        patient_id: patientId,
        care_plan_id: activePlan?.id,
        check_in_date: new Date().toISOString().split('T')[0],
        check_in_method: method,
        status: 'pending',
        questions_asked: questions,
        responses: {}
      };

      const { data: savedCheckIn, error: saveError } = await supabase
        .from('patient_daily_check_ins')
        .insert(checkIn)
        .select()
        .single();

      if (saveError) throw saveError;

      // Send the check-in message
      if (method === 'sms' && profile.phone) {
        await this.sendSMS(
          profile.phone,
          this.formatCheckInMessage(profile.first_name, questions),
          savedCheckIn.id
        );
      }

      return savedCheckIn;

    } catch (error: any) {

      throw new Error(`Check-in failed: ${error.message}`);
    }
  }

  /**
   * Record patient response to check-in
   */
  static async recordCheckInResponse(
    checkInId: string,
    responses: Record<string, any>
  ): Promise<DailyCheckIn> {
    try {
      // Get existing check-in
      const { data: checkIn, error: fetchError } = await supabase
        .from('patient_daily_check_ins')
        .select('*')
        .eq('id', checkInId)
        .single();

      if (fetchError) throw fetchError;

      // Analyze responses for concerning patterns
      const analysis = await this.analyzeCheckInResponses(checkIn, responses);

      // Update check-in record
      const { data: updatedCheckIn, error: updateError } = await supabase
        .from('patient_daily_check_ins')
        .update({
          responses: responses,
          response_time: new Date().toISOString(),
          status: 'completed',
          alert_triggered: analysis.alert_triggered,
          alert_type: analysis.alert_type,
          alert_severity: analysis.alert_severity,
          requires_follow_up: analysis.requires_follow_up,
          concern_flags: analysis.concern_flags,
          ai_analysis_summary: analysis.summary
        })
        .eq('id', checkInId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Create alert if needed
      if (analysis.alert_triggered) {
        await CareCoordinationService.createAlert({
          patient_id: checkIn.patient_id,
          care_plan_id: checkIn.care_plan_id,
          alert_type: analysis.alert_type || 'pattern_concerning',
          severity: analysis.alert_severity || 'medium',
          priority: analysis.alert_severity === 'critical' ? 'emergency' : 'urgent',
          title: 'Concerning Daily Check-In Response',
          description: analysis.summary || 'Patient check-in shows concerning patterns',
          alert_data: {
            check_in_id: checkInId,
            responses: responses,
            concerns: analysis.concern_flags
          },
          status: 'active'
        });
      }

      return updatedCheckIn;

    } catch (error: any) {

      throw new Error(`Response recording failed: ${error.message}`);
    }
  }

  /**
   * Analyze check-in responses for alerts
   */
  private static async analyzeCheckInResponses(
    checkIn: DailyCheckIn,
    responses: Record<string, any>
  ): Promise<{
    alert_triggered: boolean;
    alert_type?: string;
    alert_severity?: 'low' | 'medium' | 'high' | 'critical';
    requires_follow_up: boolean;
    concern_flags: string[];
    summary?: string;
  }> {
    const concernFlags: string[] = [];
    let alertTriggered = false;
    let alertSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let alertType: string | undefined;

    // Check for concerning patterns
    if (responses.feeling && typeof responses.feeling === 'number' && responses.feeling <= 3) {
      concernFlags.push('low_wellness_score');
      alertTriggered = true;
      alertSeverity = responses.feeling <= 2 ? 'high' : 'medium';
      alertType = 'health_decline';
    }

    if (responses.pain_level && typeof responses.pain_level === 'number' && responses.pain_level >= 7) {
      concernFlags.push('high_pain_level');
      alertTriggered = true;
      alertSeverity = responses.pain_level >= 9 ? 'critical' : 'high';
      alertType = 'health_decline';
    }

    if (responses.medication_taken === false || responses.medication_taken === 'no') {
      concernFlags.push('medication_non_adherence');
      alertTriggered = true;
      alertSeverity = 'medium';
      alertType = 'medication_non_adherence';
    }

    if (responses.emergency_symptoms === true || responses.emergency_symptoms === 'yes') {
      concernFlags.push('emergency_symptoms');
      alertTriggered = true;
      alertSeverity = 'critical';
      alertType = 'emergency';
    }

    // Check for multiple missed check-ins
    const { data: recentCheckIns } = await supabase
      .from('patient_daily_check_ins')
      .select('status')
      .eq('patient_id', checkIn.patient_id)
      .gte('check_in_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('check_in_date', { ascending: false })
      .limit(7);

    const missedCount = recentCheckIns?.filter(c => c.status === 'missed').length || 0;
    if (missedCount >= 3) {
      concernFlags.push('missed_check_ins');
      alertTriggered = true;
      alertSeverity = 'high';
      alertType = 'patient_stopped_responding';
    }

    // Use AI to generate analysis summary if alert triggered
    let summary: string | undefined;
    if (alertTriggered) {
      try {
        const context: ClaudeRequestContext = {
          userId: 'check-in-analyzer',
          userRole: UserRole.ADMIN,
          requestId: `check-in-analysis-${checkIn.id}`,
          timestamp: new Date(),
          requestType: RequestType.HEALTH_QUESTION
        };

        const prompt = `Analyze this patient's daily check-in response and provide a brief clinical summary.

PATIENT RESPONSES:
${JSON.stringify(responses, null, 2)}

IDENTIFIED CONCERNS:
${concernFlags.join(', ')}

Provide a 2-3 sentence clinical summary suitable for the care team. Focus on what action they should take.`;

        const aiResponse = await claudeService.generateSeniorHealthGuidance(prompt, context);
        summary = aiResponse.content;
      } catch {
        summary = `Patient check-in shows concerning patterns: ${concernFlags.join(', ')}. Immediate review recommended.`;
      }
    }

    return {
      alert_triggered: alertTriggered,
      alert_type: alertType,
      alert_severity: alertSeverity,
      requires_follow_up: alertTriggered || concernFlags.length > 0,
      concern_flags: concernFlags,
      summary
    };
  }

  /**
   * Get check-in history for patient
   */
  static async getPatientCheckInHistory(
    patientId: string,
    days: number = 30
  ): Promise<DailyCheckIn[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const { data, error } = await supabase
      .from('patient_daily_check_ins')
      .select('*')
      .eq('patient_id', patientId)
      .gte('check_in_date', startDate)
      .order('check_in_date', { ascending: false });

    if (error) throw new Error(`Failed to fetch check-in history: ${error.message}`);
    return data || [];
  }

  /**
   * Mark check-in as missed
   */
  static async markCheckInMissed(checkInId: string): Promise<void> {
    await supabase
      .from('patient_daily_check_ins')
      .update({ status: 'missed' })
      .eq('id', checkInId);
  }

  /**
   * Send SMS via Twilio (production implementation)
   * Note: Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in env
   */
  private static async sendSMS(
    phoneNumber: string,
    message: string,
    checkInId?: string
  ): Promise<void> {
    try {
      // Check if Twilio is configured
      const twilioConfigured = process.env.REACT_APP_TWILIO_ENABLED === 'true';

      if (!twilioConfigured) {

        return;
      }

      // Call Twilio edge function
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          to: phoneNumber,
          message: message,
          checkInId: checkInId
        }
      });

      if (error) throw error;



    } catch (error: any) {

      // Don't throw - SMS failure shouldn't break the check-in creation
      // Log to monitoring system instead
    }
  }

  /**
   * Send outreach campaign to multiple patients
   */
  static async sendOutreachCampaign(campaign: OutreachCampaign): Promise<{
    sent: number;
    failed: number;
    errors: any[];
  }> {
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as any[]
    };

    try {
      // Get target patients
      let targetPatients: string[] = [];

      if (campaign.target_patient_ids) {
        targetPatients = campaign.target_patient_ids;
      } else if (campaign.target_criteria) {
        // Query patients based on criteria
        // This is a simplified example - expand based on your criteria structure
        const { data: patients } = await supabase
          .from('profiles')
          .select('id')
          .limit(100);

        targetPatients = patients?.map(p => p.id) || [];
      }

      // Send to each patient
      for (const patientId of targetPatients) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('phone, first_name')
            .eq('id', patientId)
            .single();

          if (!profile?.phone) {
            results.failed++;
            continue;
          }

          // Personalize message
          const personalizedMessage = campaign.message_template
            .replace('{name}', profile.first_name || 'there');

          if (campaign.send_method === 'sms' || campaign.send_method === 'both') {
            await this.sendSMS(profile.phone, personalizedMessage);
          }

          results.sent++;

        } catch (error: any) {
          results.failed++;
          results.errors.push({ patientId, error: error.message });
        }
      }

      return results;

    } catch (error: any) {

      throw new Error(`Campaign failed: ${error.message}`);
    }
  }

  /**
   * Generate default check-in questions
   */
  private static generateDefaultQuestions(carePlan?: any): CheckInQuestion[] {
    const defaultQuestions: CheckInQuestion[] = [
      {
        question: 'How are you feeling today overall?',
        type: 'scale',
        scale: { min: 1, max: 10, label_min: 'Very Poor', label_max: 'Excellent' },
        required: true
      },
      {
        question: 'Did you take all your medications today?',
        type: 'yes_no',
        required: true
      },
      {
        question: 'On a scale of 1-10, how would you rate your pain level?',
        type: 'scale',
        scale: { min: 0, max: 10, label_min: 'No Pain', label_max: 'Worst Pain' },
        required: true
      },
      {
        question: 'Are you experiencing any emergency symptoms (chest pain, difficulty breathing, severe bleeding)?',
        type: 'yes_no',
        required: true
      },
      {
        question: 'Do you have any concerns you want to share with your care team?',
        type: 'text',
        required: false
      }
    ];

    // Add plan-specific questions based on care plan type
    if (carePlan?.plan_type === 'readmission_prevention') {
      defaultQuestions.splice(2, 0, {
        question: 'Have you had any new or worsening symptoms since discharge?',
        type: 'yes_no',
        required: true
      });
    }

    return defaultQuestions;
  }

  /**
   * Format check-in message for SMS
   */
  private static formatCheckInMessage(patientName: string, questions: CheckInQuestion[]): string {
    const greeting = `Hi ${patientName || 'there'}! Time for your daily check-in.`;

    const questionSummary = `Please answer ${questions.length} quick questions about your health today.`;

    const link = `Click here to complete: [Your-App-URL]/check-in`;

    const support = `Questions? Call your care team anytime.`;

    return `${greeting}\n\n${questionSummary}\n\n${link}\n\n${support}`;
  }

  /**
   * Schedule automated check-ins for high-risk patients
   */
  static async scheduleAutomatedCheckIns(): Promise<void> {
    try {
      // Get all patients with active care plans that need daily check-ins
      const { data: activePlans } = await supabase
        .from('care_coordination_plans')
        .select('*, profiles(id, phone, first_name)')
        .eq('status', 'active')
        .in('priority', ['high', 'critical']);

      if (!activePlans || activePlans.length === 0) {

        return;
      }

      // Check if check-in already sent today
      const today = new Date().toISOString().split('T')[0];

      for (const plan of activePlans) {
        if (!plan.profiles?.id) continue;

        // Check if already sent today
        const { data: existingCheckIn } = await supabase
          .from('patient_daily_check_ins')
          .select('id')
          .eq('patient_id', plan.profiles.id)
          .eq('check_in_date', today)
          .limit(1);

        if (!existingCheckIn || existingCheckIn.length === 0) {
          // Send check-in
          await this.sendDailyCheckIn(plan.profiles.id, 'sms');

        }
      }

    } catch (error: any) {

    }
  }
}

export default PatientOutreachService;
