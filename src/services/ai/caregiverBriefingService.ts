/**
 * Caregiver Briefing AI Service
 *
 * Generates automated briefings for family caregivers about their loved one's status.
 * Respects PHI boundaries while providing meaningful updates.
 *
 * @module CaregiverBriefingService
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';

export interface BriefingRequest {
  patientId: string;
  caregiverId: string;
  caregiverName?: string;
  briefingType?: 'daily' | 'weekly' | 'urgent';
  language?: string;
}

export interface CaregiverBriefing {
  greeting: string;
  summary: string;
  health_highlights: string[];
  check_in_summary: {
    total: number;
    completed: number;
    average_wellness: number | null;
    concerns: string[];
  };
  care_plan_progress: string;
  upcoming_items: string[];
  action_items: string[];
  encouragement: string;
}

export interface BriefingResponse {
  briefing: CaregiverBriefing;
  metadata: {
    generated_at: string;
    briefing_type: string;
    language: string;
    response_time_ms: number;
  };
}

export class CaregiverBriefingService {
  /**
   * Generate a caregiver briefing
   */
  static async generateBriefing(
    request: BriefingRequest
  ): Promise<ServiceResult<BriefingResponse>> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-caregiver-briefing', {
        body: {
          patientId: request.patientId,
          caregiverId: request.caregiverId,
          caregiverName: request.caregiverName || 'Caregiver',
          briefingType: request.briefingType || 'daily',
          language: request.language || 'English',
        },
      });

      if (error) throw error;

      return success(data as BriefingResponse);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('BRIEFING_GENERATION_FAILED', error.message, error);
    }
  }

  /**
   * Generate a daily briefing
   */
  static async generateDailyBriefing(
    patientId: string,
    caregiverId: string,
    caregiverName?: string
  ): Promise<ServiceResult<BriefingResponse>> {
    return this.generateBriefing({
      patientId,
      caregiverId,
      caregiverName,
      briefingType: 'daily',
    });
  }

  /**
   * Generate a weekly summary briefing
   */
  static async generateWeeklySummary(
    patientId: string,
    caregiverId: string,
    caregiverName?: string
  ): Promise<ServiceResult<BriefingResponse>> {
    return this.generateBriefing({
      patientId,
      caregiverId,
      caregiverName,
      briefingType: 'weekly',
    });
  }

  /**
   * Generate an urgent update briefing
   */
  static async generateUrgentUpdate(
    patientId: string,
    caregiverId: string,
    caregiverName?: string
  ): Promise<ServiceResult<BriefingResponse>> {
    return this.generateBriefing({
      patientId,
      caregiverId,
      caregiverName,
      briefingType: 'urgent',
    });
  }

  /**
   * Format briefing for SMS delivery
   */
  static formatForSMS(briefing: CaregiverBriefing): string {
    const lines = [
      briefing.greeting,
      '',
      briefing.summary,
      '',
    ];

    if (briefing.upcoming_items.length > 0) {
      lines.push('Upcoming:');
      briefing.upcoming_items.slice(0, 2).forEach((item) => {
        lines.push(`- ${item}`);
      });
      lines.push('');
    }

    lines.push(briefing.encouragement);

    return lines.join('\n').slice(0, 480); // SMS limit with buffer
  }

  /**
   * Format briefing for email delivery
   */
  static formatForEmail(briefing: CaregiverBriefing): {
    subject: string;
    body: string;
  } {
    const subject = `Daily Update: ${briefing.summary.split('.')[0]}`;

    const body = `
${briefing.greeting}

${briefing.summary}

Health Highlights:
${briefing.health_highlights.map((h) => `• ${h}`).join('\n')}

Check-In Summary:
• ${briefing.check_in_summary.completed} of ${briefing.check_in_summary.total} check-ins completed
${briefing.check_in_summary.average_wellness ? `• Average wellness score: ${briefing.check_in_summary.average_wellness.toFixed(1)}/10` : ''}

Care Plan Progress:
${briefing.care_plan_progress}

${briefing.upcoming_items.length > 0 ? `Upcoming:\n${briefing.upcoming_items.map((i) => `• ${i}`).join('\n')}\n` : ''}

What You Can Do:
${briefing.action_items.map((a) => `• ${a}`).join('\n')}

${briefing.encouragement}

---
This is an automated briefing from the WellFit care team.
    `.trim();

    return { subject, body };
  }
}

export default CaregiverBriefingService;
