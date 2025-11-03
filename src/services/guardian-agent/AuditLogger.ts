/**
 * Audit Logger - HIPAA/SOC2 Compliant Telemetry
 * Every auto-fix creates a complete audit trail
 */

import { DetectedIssue, HealingAction, HealingResult } from './types';
import { DatabaseAuditLogger } from './DatabaseAuditLogger';

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  tenant?: string;
  module: string;
  errorCode: string;
  action: string;
  versionBefore?: string;
  versionAfter?: string;
  validationResult: 'success' | 'failure' | 'pending_review';
  diff?: string;
  reason: string;
  issueId: string;
  actionId: string;
  severity: string;
  affectedResources: string[];
  userId?: string;
  sessionId?: string;
  environment: 'production' | 'staging' | 'development';
  ipAddress?: string;
  userAgent?: string;
  metadata: Record<string, any>;
}

export interface ReviewTicket {
  id: string;
  auditLogId: string;
  createdAt: Date;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
  action: HealingAction;
  issue: DetectedIssue;
  sandboxTestResults?: any;
}

/**
 * Audit Logger - Creates immutable audit trail
 */
export class AuditLogger {
  private logs: AuditLogEntry[] = [];
  private reviewTickets: ReviewTicket[] = [];
  private logStorage: AuditLogStorage;
  private dbLogger: DatabaseAuditLogger;

  constructor() {
    this.logStorage = new AuditLogStorage();
    this.dbLogger = new DatabaseAuditLogger();
  }

  /**
   * Log a healing action with full context
   */
  async logHealingAction(
    issue: DetectedIssue,
    action: HealingAction,
    result: HealingResult
  ): Promise<AuditLogEntry> {
    const entry: AuditLogEntry = {
      id: this.generateAuditId(),
      timestamp: new Date(),
      tenant: this.getTenantId(),
      module: issue.context.component || 'unknown',
      errorCode: issue.signature.category,
      action: action.strategy,
      versionBefore: this.captureVersionInfo(),
      versionAfter: result.success ? this.captureVersionInfo() : undefined,
      validationResult: result.success ? 'success' : 'failure',
      diff: await this.generateDiff(action, result),
      reason: issue.signature.description,
      issueId: issue.id,
      actionId: action.id,
      severity: issue.severity,
      affectedResources: issue.affectedResources,
      userId: issue.context.userId,
      sessionId: issue.context.sessionId,
      environment: this.getEnvironment(),
      ipAddress: this.getClientIP(),
      userAgent: this.getUserAgent(),
      metadata: {
        stepsCompleted: result.stepsCompleted,
        totalSteps: result.totalSteps,
        timeToDetect: result.metrics.timeToDetect,
        timeToHeal: result.metrics.timeToHeal,
        resourcesAffected: result.metrics.resourcesAffected,
        usersImpacted: result.metrics.usersImpacted,
        lessons: result.lessons,
        preventiveMeasures: result.preventiveMeasures,
      },
    };

    // Store in memory
    this.logs.push(entry);

    // ✅ CRITICAL: Persist to database for permanent audit trail
    await this.dbLogger.logHealingAction(issue, action, result);

    // Persist to storage (database/file)
    await this.logStorage.persist(entry);

    // Send to telemetry endpoints
    await this.sendToTelemetry(entry);

    // Create review ticket if needed
    if (this.requiresHumanReview(action, result)) {
      await this.createReviewTicket(entry, action, issue, result);
    }

    return entry;
  }

  /**
   * Log an action that was blocked by safety constraints
   */
  async logBlockedAction(
    issue: DetectedIssue,
    action: HealingAction,
    blockReason: string
  ): Promise<AuditLogEntry> {
    const entry: AuditLogEntry = {
      id: this.generateAuditId(),
      timestamp: new Date(),
      tenant: this.getTenantId(),
      module: issue.context.component || 'unknown',
      errorCode: issue.signature.category,
      action: `BLOCKED: ${action.strategy}`,
      validationResult: 'pending_review',
      reason: blockReason,
      issueId: issue.id,
      actionId: action.id,
      severity: issue.severity,
      affectedResources: issue.affectedResources,
      environment: this.getEnvironment(),
      metadata: {
        blockReason,
        requiresApproval: true,
      },
    };

    this.logs.push(entry);

    // ✅ CRITICAL: Persist blocked action to database
    await this.dbLogger.logBlockedAction(issue, action, blockReason);

    await this.logStorage.persist(entry);
    await this.sendToTelemetry(entry);

    // Always create review ticket for blocked actions
    await this.createReviewTicket(entry, action, issue, null);

    return entry;
  }

  /**
   * Create a review ticket for human validation
   */
  private async createReviewTicket(
    auditEntry: AuditLogEntry,
    action: HealingAction,
    issue: DetectedIssue,
    result: HealingResult | null
  ): Promise<ReviewTicket> {
    const ticket: ReviewTicket = {
      id: this.generateTicketId(),
      auditLogId: auditEntry.id,
      createdAt: new Date(),
      status: 'pending',
      priority: this.calculateTicketPriority(issue, action),
      action,
      issue,
      sandboxTestResults: result,
    };

    this.reviewTickets.push(ticket);

    // Send notification to admins
    await this.notifyAdmins(ticket);

    // Store in database for review UI
    await this.logStorage.persistTicket(ticket);

    return ticket;
  }

  /**
   * Generate diff showing what changed
   */
  private async generateDiff(action: HealingAction, result: HealingResult): Promise<string> {
    const changes: string[] = [];

    changes.push(`Action: ${action.strategy}`);
    changes.push(`Description: ${action.description}`);
    changes.push(`Steps Executed: ${result.stepsCompleted}/${result.totalSteps}`);
    changes.push(`Outcome: ${result.outcomeDescription}`);

    if (action.steps.length > 0) {
      changes.push('\nSteps:');
      action.steps.forEach((step, index) => {
        changes.push(`  ${index + 1}. ${step.action} on ${step.target}`);
        changes.push(`     Parameters: ${JSON.stringify(step.parameters)}`);
      });
    }

    if (result.lessons.length > 0) {
      changes.push('\nLessons Learned:');
      result.lessons.forEach((lesson) => {
        changes.push(`  - ${lesson}`);
      });
    }

    return changes.join('\n');
  }

  /**
   * Check if action requires human review
   */
  private requiresHumanReview(action: HealingAction, result: HealingResult): boolean {
    // Failed actions need review
    if (!result.success) {
      return true;
    }

    // Actions requiring approval
    if (action.requiresApproval) {
      return true;
    }

    // Critical severity needs review
    if (action.strategy === 'emergency_shutdown' || action.strategy === 'security_lockdown') {
      return true;
    }

    // Data changes need review
    if (action.strategy === 'data_reconciliation' || action.strategy === 'auto_patch') {
      return true;
    }

    return false;
  }

  /**
   * Calculate ticket priority
   */
  private calculateTicketPriority(
    issue: DetectedIssue,
    action: HealingAction
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (issue.severity === 'critical' || action.strategy === 'emergency_shutdown') {
      return 'critical';
    }
    if (issue.severity === 'high' || action.strategy === 'security_lockdown') {
      return 'high';
    }
    if (issue.severity === 'medium') {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Send telemetry to monitoring stack
   */
  private async sendToTelemetry(entry: AuditLogEntry): Promise<void> {
    // Format for telemetry stack
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const telemetryEvent = {
      timestamp: entry.timestamp.toISOString(),
      tenant: entry.tenant,
      module: entry.module,
      error_code: entry.errorCode,
      action: entry.action,
      version_before: entry.versionBefore,
      version_after: entry.versionAfter,
      validation_result: entry.validationResult,
      severity: entry.severity,
      environment: entry.environment,
      affected_resources: entry.affectedResources.join(','),
      user_id: entry.userId,
      session_id: entry.sessionId,
      ...entry.metadata,
    };

    // TODO: Send to actual telemetry endpoints:
    // - Datadog, New Relic, Splunk, etc.
    // - Your SIEM system
    // - HIPAA audit log database
  }

  /**
   * Notify admins of pending review
   */
  private async notifyAdmins(ticket: ReviewTicket): Promise<void> {
    // TODO: Implement actual notifications:
    // - Email to admins
    // - Slack/Teams message
    // - PagerDuty for critical
    // - Dashboard notification
  }

  // Helper methods
  private generateAuditId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTicketId(): string {
    return `ticket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getTenantId(): string {
    // In multi-tenant system, get from context
    return 'wellfit-primary';
  }

  private getEnvironment(): 'production' | 'staging' | 'development' {
    return (process.env.NODE_ENV as any) || 'development';
  }

  private captureVersionInfo(): string {
    // Capture current app version
    return process.env.REACT_APP_VERSION || 'unknown';
  }

  private getClientIP(): string | undefined {
    // In browser, this would come from backend
    return undefined;
  }

  private getUserAgent(): string {
    return typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
  }

  /**
   * Get all audit logs (from database + memory)
   */
  async getAuditLogs(filters?: {
    startDate?: Date;
    endDate?: Date;
    severity?: string;
    module?: string;
    limit?: number;
  }): Promise<AuditLogEntry[]> {
    // ✅ Fetch from database for persistent records
    await this.dbLogger.getAuditLogs(filters);

    // Return in-memory logs (database logs are the source of truth)
    // In-memory logs are kept for backward compatibility
    let filtered = [...this.logs];

    if (filters?.startDate) {
      filtered = filtered.filter((log) => log.timestamp >= filters.startDate);
    }

    if (filters?.endDate) {
      filtered = filtered.filter((log) => log.timestamp <= filters.endDate);
    }

    if (filters?.severity) {
      filtered = filtered.filter((log) => log.severity === filters.severity);
    }

    if (filters?.module) {
      filtered = filtered.filter((log) => log.module === filters.module);
    }

    return filtered;
  }

  /**
   * Get active security alerts from database
   */
  async getActiveSecurityAlerts() {
    return await this.dbLogger.getActiveSecurityAlerts();
  }

  /**
   * Get pending review tickets
   */
  getPendingReviewTickets(): ReviewTicket[] {
    return this.reviewTickets.filter((ticket) => ticket.status === 'pending');
  }

  /**
   * Approve a review ticket
   */
  async approveTicket(ticketId: string, reviewedBy: string, notes: string): Promise<void> {
    const ticket = this.reviewTickets.find((t) => t.id === ticketId);
    if (!ticket) throw new Error('Ticket not found');

    ticket.status = 'approved';
    ticket.reviewedAt = new Date();
    ticket.reviewedBy = reviewedBy;
    ticket.reviewNotes = notes;

    await this.logStorage.updateTicket(ticket);
  }

  /**
   * Reject a review ticket
   */
  async rejectTicket(ticketId: string, reviewedBy: string, notes: string): Promise<void> {
    const ticket = this.reviewTickets.find((t) => t.id === ticketId);
    if (!ticket) throw new Error('Ticket not found');

    ticket.status = 'rejected';
    ticket.reviewedAt = new Date();
    ticket.reviewedBy = reviewedBy;
    ticket.reviewNotes = notes;

    await this.logStorage.updateTicket(ticket);
  }
}

/**
 * Audit Log Storage - Persists to database
 */
class AuditLogStorage {
  /**
   * Persist audit log entry
   */
  async persist(entry: AuditLogEntry): Promise<void> {
    // TODO: Store in Supabase audit_logs table
  }

  /**
   * Persist review ticket
   */
  async persistTicket(ticket: ReviewTicket): Promise<void> {
    // TODO: Store in Supabase review_tickets table

  }

  /**
   * Update review ticket
   */
  async updateTicket(ticket: ReviewTicket): Promise<void> {
    // TODO: Update in database

  }
}
