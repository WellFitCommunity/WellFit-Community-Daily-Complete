/**
 * Guardian Approval Service
 *
 * Service for managing Guardian Agent review tickets (pool reports).
 * Provides methods to:
 * - Create review tickets
 * - List pending tickets
 * - Approve/reject tickets
 * - Track application status
 * - Subscribe to real-time updates
 */

import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';
import {
  GuardianReviewTicket,
  TicketListItem,
  TicketStats,
  TicketFilters,
  ApprovalFormData,
  RejectionFormData,
  ApprovalResult,
  CreateTicketParams,
  TicketStatus,
} from '../types/guardianApproval';

// ============================================================================
// Service Class
// ============================================================================

export class GuardianApprovalService {
  private supabase: SupabaseClient;
  private ticketChannel: RealtimeChannel | null = null;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  // ==========================================================================
  // Create Ticket
  // ==========================================================================

  async createTicket(params: CreateTicketParams): Promise<ServiceResult<string>> {
    try {
      const { data, error } = await this.supabase.rpc('create_guardian_review_ticket', {
        p_issue_id: params.issue_id,
        p_issue_category: params.issue_category,
        p_issue_severity: params.issue_severity,
        p_issue_description: params.issue_description || null,
        p_affected_component: params.affected_component || null,
        p_affected_resources: params.affected_resources || null,
        p_stack_trace: params.stack_trace || null,
        p_detection_context: params.detection_context || {},
        p_action_id: params.action_id,
        p_healing_strategy: params.healing_strategy,
        p_healing_description: params.healing_description,
        p_healing_steps: params.healing_steps || [],
        p_rollback_plan: params.rollback_plan || [],
        p_expected_outcome: params.expected_outcome || null,
        p_sandbox_tested: params.sandbox_tested || false,
        p_sandbox_results: params.sandbox_results || {},
        p_sandbox_passed: params.sandbox_passed ?? null,
      });

      if (error) {
        auditLogger.error('GUARDIAN_CREATE_TICKET_ERROR', error.message, {
          issue_id: params.issue_id,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      auditLogger.info('GUARDIAN_TICKET_CREATED', 'Review ticket created', {
        ticket_id: data,
        issue_id: params.issue_id,
        healing_strategy: params.healing_strategy,
      });

      return success(data as string);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      auditLogger.error('GUARDIAN_CREATE_TICKET_EXCEPTION', message, {});
      return failure('UNKNOWN_ERROR', message, err);
    }
  }

  // ==========================================================================
  // Get Tickets
  // ==========================================================================

  async getPendingTickets(): Promise<ServiceResult<TicketListItem[]>> {
    try {
      const { data, error } = await this.supabase.rpc('get_pending_guardian_tickets');

      if (error) {
        auditLogger.error('GUARDIAN_GET_PENDING_ERROR', error.message, {});
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success((data || []) as TicketListItem[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      auditLogger.error('GUARDIAN_GET_PENDING_EXCEPTION', message, {});
      return failure('UNKNOWN_ERROR', message, err);
    }
  }

  async getTicketById(ticketId: string): Promise<ServiceResult<GuardianReviewTicket>> {
    try {
      const { data, error } = await this.supabase
        .from('guardian_review_tickets')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (error) {
        auditLogger.error('GUARDIAN_GET_TICKET_ERROR', error.message, { ticketId });
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data as GuardianReviewTicket);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      auditLogger.error('GUARDIAN_GET_TICKET_EXCEPTION', message, { ticketId });
      return failure('UNKNOWN_ERROR', message, err);
    }
  }

  async getTickets(filters?: TicketFilters): Promise<ServiceResult<GuardianReviewTicket[]>> {
    try {
      let query = this.supabase
        .from('guardian_review_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.status?.length) {
        query = query.in('status', filters.status);
      }

      if (filters?.severity?.length) {
        query = query.in('issue_severity', filters.severity);
      }

      if (filters?.strategy?.length) {
        query = query.in('healing_strategy', filters.strategy);
      }

      if (filters?.date_range) {
        query = query
          .gte('created_at', filters.date_range.start)
          .lte('created_at', filters.date_range.end);
      }

      if (filters?.search) {
        query = query.or(
          `issue_description.ilike.%${filters.search}%,healing_description.ilike.%${filters.search}%,affected_component.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query.limit(100);

      if (error) {
        auditLogger.error('GUARDIAN_GET_TICKETS_ERROR', error.message, {});
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success((data || []) as GuardianReviewTicket[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      auditLogger.error('GUARDIAN_GET_TICKETS_EXCEPTION', message, {});
      return failure('UNKNOWN_ERROR', message, err);
    }
  }

  async getTicketStats(): Promise<ServiceResult<TicketStats>> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      // Get counts by status
      const { data: tickets, error } = await this.supabase
        .from('guardian_review_tickets')
        .select('status, created_at, reviewed_at, applied_at');

      if (error) {
        auditLogger.error('GUARDIAN_GET_STATS_ERROR', error.message, {});
        return failure('DATABASE_ERROR', error.message, error);
      }

      const stats: TicketStats = {
        pending_count: 0,
        in_review_count: 0,
        approved_today: 0,
        rejected_today: 0,
        applied_today: 0,
        failed_today: 0,
      };

      for (const ticket of tickets || []) {
        if (ticket.status === 'pending') stats.pending_count++;
        if (ticket.status === 'in_review') stats.in_review_count++;

        // Today's actions
        if (ticket.reviewed_at && ticket.reviewed_at >= todayISO) {
          if (ticket.status === 'approved') stats.approved_today++;
          if (ticket.status === 'rejected') stats.rejected_today++;
        }
        if (ticket.applied_at && ticket.applied_at >= todayISO) {
          if (ticket.status === 'applied') stats.applied_today++;
          if (ticket.status === 'failed') stats.failed_today++;
        }
      }

      return success(stats);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      auditLogger.error('GUARDIAN_GET_STATS_EXCEPTION', message, {});
      return failure('UNKNOWN_ERROR', message, err);
    }
  }

  // ==========================================================================
  // Ticket Actions
  // ==========================================================================

  async markInReview(ticketId: string): Promise<ServiceResult<boolean>> {
    try {
      const { error } = await this.supabase
        .from('guardian_review_tickets')
        .update({ status: 'in_review' })
        .eq('id', ticketId)
        .eq('status', 'pending');

      if (error) {
        auditLogger.error('GUARDIAN_MARK_IN_REVIEW_ERROR', error.message, { ticketId });
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      auditLogger.error('GUARDIAN_MARK_IN_REVIEW_EXCEPTION', message, { ticketId });
      return failure('UNKNOWN_ERROR', message, err);
    }
  }

  async approveTicket(
    ticketId: string,
    formData: ApprovalFormData
  ): Promise<ServiceResult<ApprovalResult>> {
    try {
      const { data, error } = await this.supabase.rpc('approve_guardian_ticket', {
        p_ticket_id: ticketId,
        p_code_reviewed: formData.code_reviewed,
        p_impact_understood: formData.impact_understood,
        p_rollback_understood: formData.rollback_understood,
        p_review_notes: formData.review_notes,
      });

      if (error) {
        auditLogger.error('GUARDIAN_APPROVE_ERROR', error.message, { ticketId });
        return failure('DATABASE_ERROR', error.message, error);
      }

      const result = data as ApprovalResult;

      if (!result.success) {
        return failure('VALIDATION_ERROR', result.error || 'Approval failed', null);
      }

      auditLogger.info('GUARDIAN_TICKET_APPROVED', 'Ticket approved', {
        ticket_id: ticketId,
        review_notes: formData.review_notes,
      });

      return success(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      auditLogger.error('GUARDIAN_APPROVE_EXCEPTION', message, { ticketId });
      return failure('UNKNOWN_ERROR', message, err);
    }
  }

  async rejectTicket(
    ticketId: string,
    formData: RejectionFormData
  ): Promise<ServiceResult<ApprovalResult>> {
    try {
      const { data, error } = await this.supabase.rpc('reject_guardian_ticket', {
        p_ticket_id: ticketId,
        p_review_notes: formData.review_notes,
      });

      if (error) {
        auditLogger.error('GUARDIAN_REJECT_ERROR', error.message, { ticketId });
        return failure('DATABASE_ERROR', error.message, error);
      }

      const result = data as ApprovalResult;

      if (!result.success) {
        return failure('VALIDATION_ERROR', result.error || 'Rejection failed', null);
      }

      auditLogger.info('GUARDIAN_TICKET_REJECTED', 'Ticket rejected', {
        ticket_id: ticketId,
        rejection_reason: formData.review_notes,
      });

      return success(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      auditLogger.error('GUARDIAN_REJECT_EXCEPTION', message, { ticketId });
      return failure('UNKNOWN_ERROR', message, err);
    }
  }

  async markApplied(
    ticketId: string,
    result: Record<string, unknown>,
    error?: string
  ): Promise<ServiceResult<boolean>> {
    try {
      const { data, error: dbError } = await this.supabase.rpc('mark_guardian_ticket_applied', {
        p_ticket_id: ticketId,
        p_result: result,
        p_error: error || null,
      });

      if (dbError) {
        auditLogger.error('GUARDIAN_MARK_APPLIED_ERROR', dbError.message, { ticketId });
        return failure('DATABASE_ERROR', dbError.message, dbError);
      }

      const response = data as { success: boolean; status?: string };

      if (!response.success) {
        return failure('VALIDATION_ERROR', 'Failed to mark ticket as applied', null);
      }

      auditLogger.info('GUARDIAN_TICKET_APPLIED', `Ticket marked as ${response.status}`, {
        ticket_id: ticketId,
        status: response.status,
        had_error: !!error,
      });

      return success(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      auditLogger.error('GUARDIAN_MARK_APPLIED_EXCEPTION', message, { ticketId });
      return failure('UNKNOWN_ERROR', message, err);
    }
  }

  // ==========================================================================
  // Get Approved Tickets Ready for Application
  // ==========================================================================

  async getApprovedTickets(): Promise<ServiceResult<GuardianReviewTicket[]>> {
    try {
      const { data, error } = await this.supabase
        .from('guardian_review_tickets')
        .select('*')
        .eq('status', 'approved')
        .order('reviewed_at', { ascending: true });

      if (error) {
        auditLogger.error('GUARDIAN_GET_APPROVED_ERROR', error.message, {});
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success((data || []) as GuardianReviewTicket[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      auditLogger.error('GUARDIAN_GET_APPROVED_EXCEPTION', message, {});
      return failure('UNKNOWN_ERROR', message, err);
    }
  }

  // ==========================================================================
  // Get Ticket by Security Alert ID
  // ==========================================================================

  async getTicketByAlertId(alertId: string): Promise<ServiceResult<GuardianReviewTicket | null>> {
    try {
      const { data, error } = await this.supabase
        .from('guardian_review_tickets')
        .select('*')
        .eq('security_alert_id', alertId)
        .maybeSingle();

      if (error) {
        auditLogger.error('GUARDIAN_GET_BY_ALERT_ERROR', error.message, { alertId });
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data as GuardianReviewTicket | null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      auditLogger.error('GUARDIAN_GET_BY_ALERT_EXCEPTION', message, { alertId });
      return failure('UNKNOWN_ERROR', message, err);
    }
  }

  // ==========================================================================
  // Realtime Subscriptions
  // ==========================================================================

  subscribeToTickets(
    onInsert: (ticket: GuardianReviewTicket) => void,
    onUpdate: (ticket: GuardianReviewTicket) => void
  ): void {
    this.ticketChannel = this.supabase
      .channel('guardian-tickets')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'guardian_review_tickets',
        },
        (payload) => {
          onInsert(payload.new as GuardianReviewTicket);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'guardian_review_tickets',
        },
        (payload) => {
          onUpdate(payload.new as GuardianReviewTicket);
        }
      )
      .subscribe();
  }

  unsubscribeFromTickets(): void {
    if (this.ticketChannel) {
      this.supabase.removeChannel(this.ticketChannel);
      this.ticketChannel = null;
    }
  }
}

// ============================================================================
// Singleton Instance Creator
// ============================================================================

let guardianApprovalServiceInstance: GuardianApprovalService | null = null;

export function getGuardianApprovalService(supabase: SupabaseClient): GuardianApprovalService {
  if (!guardianApprovalServiceInstance) {
    guardianApprovalServiceInstance = new GuardianApprovalService(supabase);
  }
  return guardianApprovalServiceInstance;
}

export function resetGuardianApprovalService(): void {
  if (guardianApprovalServiceInstance) {
    guardianApprovalServiceInstance.unsubscribeFromTickets();
  }
  guardianApprovalServiceInstance = null;
}
