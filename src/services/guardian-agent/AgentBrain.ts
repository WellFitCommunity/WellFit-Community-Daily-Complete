/**
 * WellFit Guardian Agent Brain
 * Core intelligence engine with adaptive learning and pattern recognition
 */

import {
  ErrorSignature,
  DetectedIssue,
  HealingAction,
  HealingResult,
  AgentState,
  AgentConfig,
  KnowledgeEntry,
  // ErrorCategory,
  SeverityLevel,
  HealingStrategy,
  ErrorContext
} from './types';
import { ErrorSignatureLibrary } from './ErrorSignatureLibrary';
import { HealingEngine } from './HealingEngine';
import { LearningSystem } from './LearningSystem';
import { AuditLogger } from './AuditLogger';
import { SafetyValidator, RateLimiter, SandboxEnvironment } from './SafetyConstraints';
import { GuardianAlertService } from './GuardianAlertService';
import { aiSystemRecorder } from './AISystemRecorder';

export class AgentBrain {
  private state: AgentState;
  private config: AgentConfig;
  private signatureLibrary: ErrorSignatureLibrary;
  private healingEngine: HealingEngine;
  private learningSystem: LearningSystem;
  private auditLogger: AuditLogger;
  private rateLimiter: RateLimiter;
  private sandbox: SandboxEnvironment;
  private observationBuffer: any[] = [];
  private patternCache: Map<string, KnowledgeEntry> = new Map();

  constructor(config: AgentConfig) {
    this.config = config;
    this.signatureLibrary = new ErrorSignatureLibrary();
    this.healingEngine = new HealingEngine(config);
    this.learningSystem = new LearningSystem();
    this.auditLogger = new AuditLogger();
    this.rateLimiter = new RateLimiter();
    this.sandbox = new SandboxEnvironment();

    this.state = {
      isActive: true,
      mode: 'monitor',
      activeIssues: [],
      healingInProgress: [],
      recentHealings: [],
      knowledgeBase: [],
      performanceMetrics: {
        uptime: 0,
        issuesDetected: 0,
        issuesHealed: 0,
        successRate: 100,
        avgTimeToDetect: 0,
        avgTimeToHeal: 0,
        falsePositives: 0,
        adaptationsApplied: 0
      }
    };
  }

  /**
   * Analyzes an error or anomaly and decides on action
   */
  async analyze(error: Error | any, context: ErrorContext): Promise<DetectedIssue | null> {
    const startTime = Date.now();

    // Extract error information
    const errorInfo = this.extractErrorInfo(error);

    // Match against known signatures
    const signature = this.matchSignature(errorInfo, context);

    if (!signature) {
      // Unknown error - create new signature through learning
      if (this.config.learningEnabled) {
        await this.learningSystem.learnNewPattern(errorInfo, context);
      }
      return null;
    }

    // Create detected issue
    const issue: DetectedIssue = {
      id: this.generateId('issue'),
      timestamp: new Date(),
      signature,
      context,
      severity: this.calculateSeverity(signature, context),
      affectedResources: this.identifyAffectedResources(context),
      stackTrace: error.stack,
      metadata: {
        ...errorInfo,
        detectionTime: Date.now() - startTime
      }
    };

    // Update metrics
    this.state.performanceMetrics.issuesDetected++;
    const detectionTime = Math.max(1, Date.now() - startTime); // Ensure at least 1ms
    this.state.performanceMetrics.avgTimeToDetect =
      (this.state.performanceMetrics.avgTimeToDetect * (this.state.performanceMetrics.issuesDetected - 1) + detectionTime) /
      this.state.performanceMetrics.issuesDetected;

    // Add to active issues
    this.state.activeIssues.push(issue);

    // Decide if immediate healing is needed
    if (this.shouldAutoHeal(issue)) {
      await this.initiateHealing(issue);
    }

    return issue;
  }

  /**
   * Matches error against known signatures using pattern recognition
   */
  private matchSignature(errorInfo: any, context: ErrorContext): ErrorSignature | null {
    // Check cache first for performance
    const cacheKey = `${errorInfo.name}-${errorInfo.message}`;
    const cached = this.patternCache.get(cacheKey);

    if (cached && cached.successRate > 0.8) {
      return this.signatureLibrary.getSignature(cached.pattern);
    }

    // Multi-dimensional pattern matching
    const signatures = this.signatureLibrary.getAllSignatures();

    for (const signature of signatures) {
      let matchScore = 0;

      // Error message matching
      if (typeof signature.pattern === 'string') {
        if (errorInfo.message.includes(signature.pattern)) {
          matchScore += 0.4;
        }
      } else if (signature.pattern.test(errorInfo.message)) {
        matchScore += 0.4;
      }

      // Stack trace matching
      if (signature.stackTracePattern && errorInfo.stack) {
        if (signature.stackTracePattern.test(errorInfo.stack)) {
          matchScore += 0.3;
        }
      }

      // Context matching
      if (this.contextMatches(signature, context)) {
        matchScore += 0.3;
      }

      // High confidence match
      if (matchScore >= 0.7) {
        // Update cache
        this.patternCache.set(cacheKey, {
          id: signature.id,
          pattern: signature.id,
          solution: signature.healingStrategies.join(','),
          successRate: 1,
          timesEncountered: 1,
          lastSeen: new Date(),
          effectiveness: matchScore * 100,
          adaptations: []
        });

        return signature;
      }
    }

    return null;
  }

  /**
   * Decides whether to auto-heal based on issue characteristics
   */
  private shouldAutoHeal(issue: DetectedIssue): boolean {
    if (!this.config.autoHealEnabled) return false;

    // Critical issues need approval if configured
    if (issue.severity === 'critical' && this.config.requireApprovalForCritical) {
      this.requestApproval(issue);
      return false;
    }

    // Check if we're at healing capacity
    if (this.state.healingInProgress.length >= this.config.maxConcurrentHealings) {
      return false;
    }

    // Security and PHI issues need immediate attention
    if (issue.signature.category === 'phi_exposure_risk' ||
        issue.signature.category === 'hipaa_violation' ||
        issue.signature.category === 'security_vulnerability') {
      return true;
    }

    // High severity issues should be auto-healed
    if (issue.severity === 'high' || issue.severity === 'critical') {
      return true;
    }

    // Medium severity issues with known healing strategies should be auto-healed
    if (issue.severity === 'medium' && issue.signature.healingStrategies.length > 0) {
      return true;
    }

    // Check if we have high confidence in healing strategies from knowledge base
    const knowledge = this.findRelevantKnowledge(issue.signature.id);
    if (knowledge && knowledge.successRate > 0.85) {
      return true;
    }

    return false;
  }

  /**
   * Initiates healing process for an issue
   */
  private async initiateHealing(issue: DetectedIssue): Promise<void> {
    this.state.mode = 'healing';

    // Select optimal healing strategy
    const strategy = this.selectOptimalStrategy(issue);

    // Create healing action
    const action: HealingAction = {
      id: this.generateId('healing'),
      issueId: issue.id,
      strategy,
      timestamp: new Date(),
      description: `Healing ${issue.signature.category} with ${strategy}`,
      steps: await this.healingEngine.generateSteps(issue, strategy),
      expectedOutcome: `Resolve ${issue.signature.category}`,
      rollbackPlan: await this.healingEngine.generateRollbackSteps(issue, strategy),
      requiresApproval: issue.severity === 'critical' && this.config.requireApprovalForCritical
    };

    // ✅ SAFETY CHECK 1: Validate action is safe to execute
    const safetyCheck = SafetyValidator.canExecuteAutonomously(action, issue);
    if (!safetyCheck.allowed) {
      await this.auditLogger.logBlockedAction(issue, action, safetyCheck.reason);
      this.sandbox.storePendingFix(action.id, action, issue);
      this.state.mode = 'monitor';
      return;
    }

    // ✅ SAFETY CHECK 2: Rate limiting to prevent action storms
    if (this.rateLimiter.isRateLimited(strategy)) {
      await this.auditLogger.logBlockedAction(issue, action, `Rate limit exceeded for ${strategy}`);
      this.state.mode = 'monitor';
      return;
    }

    // ✅ SAFETY CHECK 3: Test in sandbox first
    const sandboxTest = await this.sandbox.testFix(action, issue);
    if (!sandboxTest.success) {
      await this.auditLogger.logBlockedAction(issue, action, `Sandbox test failed: ${sandboxTest.errors.join(', ')}`);
      this.state.mode = 'monitor';
      return;
    }

    this.state.healingInProgress.push(action);

    // Record action for rate limiting
    this.rateLimiter.recordAction(strategy);

    // Execute healing
    const result = await this.healingEngine.execute(action, issue);

    // ✅ AUDIT LOG: Record every healing attempt
    await this.auditLogger.logHealingAction(issue, action, result);

    // ✅ NEW: Send alert to Security Panel with Guardian Eyes recording link
    await this.sendSecurityPanelAlert(issue, action, result);

    // Update state
    this.state.healingInProgress = this.state.healingInProgress.filter(a => a.id !== action.id);
    this.state.activeIssues = this.state.activeIssues.filter(i => i.id !== issue.id);
    this.state.recentHealings.push(result);

    // Bound recentHealings to prevent memory leak (keep last 100)
    if (this.state.recentHealings.length > 100) {
      this.state.recentHealings = this.state.recentHealings.slice(-100);
    }

    // Update metrics
    this.state.performanceMetrics.issuesHealed++;
    this.state.performanceMetrics.successRate =
      (this.state.performanceMetrics.issuesHealed / this.state.performanceMetrics.issuesDetected) * 100;
    this.state.performanceMetrics.avgTimeToHeal =
      (this.state.performanceMetrics.avgTimeToHeal * (this.state.performanceMetrics.issuesHealed - 1) + result.metrics.timeToHeal) /
      this.state.performanceMetrics.issuesHealed;

    // Learn from result
    if (this.config.learningEnabled) {
      await this.learningSystem.learn(issue, action, result);

      if (result.success) {
        this.updateKnowledgeBase(issue, action, result);
      } else {
        // Adapt strategy for next time
        await this.adaptStrategy(issue, action, result);
      }
    }

    this.state.mode = 'monitor';
  }

  /**
   * Selects optimal healing strategy based on issue and historical success
   */
  private selectOptimalStrategy(issue: DetectedIssue): HealingStrategy {
    const strategies = issue.signature.healingStrategies;

    // Find knowledge about each strategy
    const strategyScores = strategies.map(strategy => {
      const knowledge = this.state.knowledgeBase.find(k =>
        k.pattern === issue.signature.id && k.solution.includes(strategy)
      );

      return {
        strategy,
        score: knowledge ? knowledge.effectiveness : 50,
        successRate: knowledge ? knowledge.successRate : 0.5
      };
    });

    // Sort by effectiveness and success rate
    strategyScores.sort((a, b) => {
      const scoreA = a.score * a.successRate;
      const scoreB = b.score * b.successRate;
      return scoreB - scoreA;
    });

    return strategyScores[0].strategy;
  }

  /**
   * Adapts strategy when healing fails
   */
  private async adaptStrategy(
    issue: DetectedIssue,
    action: HealingAction,
    result: HealingResult
  ): Promise<void> {
    const knowledge = this.findRelevantKnowledge(issue.signature.id);

    if (knowledge) {
      // Try alternative strategy
      const alternativeStrategies = issue.signature.healingStrategies.filter(
        s => s !== action.strategy
      );

      if (alternativeStrategies.length > 0) {
        knowledge.adaptations.push(
          `Failed with ${action.strategy}, trying alternatives: ${alternativeStrategies.join(', ')}`
        );
        this.state.performanceMetrics.adaptationsApplied++;
      }
    }

    // Analyze why it failed and adapt strategy
    this.analyzeFailure(result);
  }

  /**
   * Updates knowledge base with successful healing
   */
  private updateKnowledgeBase(
    issue: DetectedIssue,
    action: HealingAction,
    result: HealingResult
  ): void {
    const existing = this.findRelevantKnowledge(issue.signature.id);

    if (existing) {
      // Update existing knowledge
      existing.timesEncountered++;
      existing.lastSeen = new Date();
      existing.successRate =
        (existing.successRate * (existing.timesEncountered - 1) + (result.success ? 1 : 0)) /
        existing.timesEncountered;
      existing.effectiveness =
        (existing.effectiveness + result.metrics.timeToHeal < 5000 ? 90 : 70) / 2;
    } else {
      // Add new knowledge
      this.state.knowledgeBase.push({
        id: this.generateId('knowledge'),
        pattern: issue.signature.id,
        solution: action.strategy,
        successRate: result.success ? 1 : 0,
        timesEncountered: 1,
        lastSeen: new Date(),
        effectiveness: result.success ? 85 : 50,
        adaptations: []
      });
    }
  }

  /**
   * Send alert to Security Panel with Guardian Eyes recording link
   */
  private async sendSecurityPanelAlert(
    issue: DetectedIssue,
    action: HealingAction,
    result: HealingResult
  ): Promise<void> {
    try {
      // Get current Guardian Eyes recording session ID
      const recordingStatus = aiSystemRecorder.getStatus();
      const sessionId = recordingStatus.session_id;

      // Send appropriate alert based on issue category
      if (issue.signature.category === 'phi_exposure_risk' ||
          issue.signature.category === 'hipaa_violation') {
        // PHI exposure - critical alert
        await GuardianAlertService.alertPHIExposure({
          location: this.getPHILocation(issue.context),
          phi_type: this.getPHIType(issue.context),
          component: issue.context.component || 'unknown',
          session_recording_id: sessionId,
          user_id: issue.context.userId,
        });
      } else if (issue.signature.category === 'security_vulnerability') {
        // Security vulnerability - warning/critical alert
        await GuardianAlertService.alertSecurityVulnerability({
          vulnerability_type: this.getVulnerabilityType(issue.signature),
          file_path: issue.context.filePath || 'unknown',
          line_number: issue.context.lineNumber || 0,
          code_snippet: issue.stackTrace || '',
          session_recording_id: sessionId,
          generated_fix: result.success ? this.extractGeneratedFix(result) : undefined,
        });
      } else if (issue.signature.category === 'memory_leak') {
        // Memory leak - warning alert
        await GuardianAlertService.alertMemoryLeak({
          component: issue.context.component || 'unknown',
          memory_usage_mb: this.getMemoryUsage(),
          leak_type: this.getLeakType(issue.context),
          session_recording_id: sessionId,
          generated_fix: result.success ? this.extractGeneratedFix(result) : undefined,
        });
      } else if (result.success && action.steps.length > 0) {
        // Generic healing fix generated - info alert
        await GuardianAlertService.alertHealingGenerated({
          issue_type: issue.signature.category,
          file_path: issue.context.filePath || 'unknown',
          line_number: issue.context.lineNumber || 0,
          original_code: issue.stackTrace || '',
          fixed_code: this.extractGeneratedFix(result) || 'Fix applied',
          session_recording_id: sessionId,
          healing_operation_id: action.id,
        });
      }
    } catch (error) {
      // Don't fail healing if alert sending fails

    }
  }

  /**
   * Helper methods for alert generation
   */
  private getPHILocation(context: ErrorContext): 'console_log' | 'error_message' | 'local_storage' | 'network_request' {
    if (context.component?.includes('console') || context.filePath?.includes('console')) {
      return 'console_log';
    }
    if (context.component?.includes('storage') || context.apiEndpoint?.includes('storage')) {
      return 'local_storage';
    }
    if (context.apiEndpoint) {
      return 'network_request';
    }
    return 'error_message';
  }

  private getPHIType(context: ErrorContext): 'ssn' | 'mrn' | 'patient_name' | 'dob' | 'diagnosis' {
    const contextStr = JSON.stringify(context).toLowerCase();
    if (contextStr.includes('ssn') || contextStr.includes('social')) return 'ssn';
    if (contextStr.includes('mrn') || contextStr.includes('medical record')) return 'mrn';
    if (contextStr.includes('patient') && contextStr.includes('name')) return 'patient_name';
    if (contextStr.includes('dob') || contextStr.includes('birth')) return 'dob';
    return 'diagnosis';
  }

  private getVulnerabilityType(signature: ErrorSignature): 'xss' | 'sql_injection' | 'phi_exposure' | 'insecure_storage' {
    const category = signature.category.toLowerCase();
    if (category.includes('xss') || category.includes('cross-site')) return 'xss';
    if (category.includes('sql') || category.includes('injection')) return 'sql_injection';
    if (category.includes('phi') || category.includes('hipaa')) return 'phi_exposure';
    return 'insecure_storage';
  }

  private getLeakType(context: ErrorContext): 'event_listener' | 'interval' | 'subscription' {
    const contextStr = JSON.stringify(context).toLowerCase();
    if (contextStr.includes('listener') || contextStr.includes('event')) return 'event_listener';
    if (contextStr.includes('interval') || contextStr.includes('timeout')) return 'interval';
    return 'subscription';
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return Math.round(memory.usedJSHeapSize / (1024 * 1024)); // Convert to MB
    }
    return 0;
  }

  private extractGeneratedFix(result: HealingResult): string | undefined {
    // Extract fix code from result if available
    if (result.outcomeDescription) {
      return result.outcomeDescription;
    }
    return undefined;
  }

  // Helper methods
  private extractErrorInfo(error: any): any {
    return {
      name: error.name || 'UnknownError',
      message: error.message || String(error),
      stack: error.stack || '',
      code: error.code,
      statusCode: error.statusCode,
      cause: error.cause
    };
  }

  private contextMatches(signature: ErrorSignature, context: ErrorContext): boolean {
    // Implement context matching logic
    return true; // Simplified
  }

  private calculateSeverity(signature: ErrorSignature, context: ErrorContext): SeverityLevel {
    let severity = signature.severity;

    // Escalate if security or PHI is involved
    if (signature.estimatedImpact.securityRisk) {
      severity = 'critical';
    }

    return severity;
  }

  private identifyAffectedResources(context: ErrorContext): string[] {
    const resources: string[] = [];

    if (context.component) resources.push(context.component);
    if (context.filePath) resources.push(context.filePath);
    if (context.apiEndpoint) resources.push(context.apiEndpoint);

    return resources;
  }

  private findRelevantKnowledge(signatureId: string): KnowledgeEntry | undefined {
    return this.state.knowledgeBase.find(k => k.pattern === signatureId);
  }

  private analyzeFailure(result: HealingResult): string {
    return result.outcomeDescription || 'Unknown failure reason';
  }

  private requestApproval(issue: DetectedIssue): void {
    // TODO: Implement approval workflow - notify admins via audit logger
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API
  getState(): AgentState {
    return { ...this.state };
  }

  getMetrics() {
    return { ...this.state.performanceMetrics };
  }

  async manualHeal(issueId: string): Promise<HealingResult | null> {
    const issue = this.state.activeIssues.find(i => i.id === issueId);
    if (!issue) return null;

    await this.initiateHealing(issue);
    return this.state.recentHealings[this.state.recentHealings.length - 1];
  }

  updateConfig(config: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ✅ AUDIT & COMPLIANCE METHODS

  /**
   * Get audit logs for compliance review
   */
  getAuditLogs(filters?: any) {
    return this.auditLogger.getAuditLogs(filters);
  }

  /**
   * Get pending review tickets
   */
  getPendingReviews() {
    return this.auditLogger.getPendingReviewTickets();
  }

  /**
   * Get sandboxed fixes awaiting approval
   */
  getPendingFixes() {
    return this.sandbox.getPendingFixes();
  }

  /**
   * Approve a review ticket
   */
  async approveReview(ticketId: string, reviewedBy: string, notes: string) {
    await this.auditLogger.approveTicket(ticketId, reviewedBy, notes);
  }

  /**
   * Reject a review ticket
   */
  async rejectReview(ticketId: string, reviewedBy: string, notes: string) {
    await this.auditLogger.rejectTicket(ticketId, reviewedBy, notes);
  }
}
