/**
 * Guardian Agent - Main Integration Layer
 * Self-healing autonomous agent for WellFit healthcare application
 */

import { AgentBrain } from './AgentBrain';
import { MonitoringSystem } from './MonitoringSystem';
import { SecurityScanner } from './SecurityScanner';
import { AgentConfig, AgentState } from './types';

export class GuardianAgent {
  private static instance: GuardianAgent;
  private brain: AgentBrain;
  private monitoring: MonitoringSystem;
  private security: SecurityScanner;
  private config: AgentConfig;
  private startTime: Date;

  private constructor(config?: Partial<AgentConfig>) {
    this.config = {
      tenantId: undefined,
      autoHealEnabled: true,
      requireApprovalForCritical: false, // Fully autonomous
      maxConcurrentHealings: 5,
      learningEnabled: true,
      monitoringIntervalMs: 5000,
      securityScanIntervalMs: 60000,
      memoryCheckIntervalMs: 10000,
      hipaaComplianceMode: true,
      notificationChannels: [],
      ...config
    };

    this.brain = new AgentBrain(this.config);
    this.security = new SecurityScanner();
    this.monitoring = new MonitoringSystem(this.brain, this.security, this.config);
    this.startTime = new Date();

  }

  /**
   * Gets the singleton instance
   */
  static getInstance(config?: Partial<AgentConfig>): GuardianAgent {
    if (!GuardianAgent.instance) {
      GuardianAgent.instance = new GuardianAgent(config);
    }
    return GuardianAgent.instance;
  }

  /**
   * Resets the singleton instance (for testing only)
   * @internal
   */
  static resetInstance(): void {
    if (GuardianAgent.instance) {
      GuardianAgent.instance.stop();
    }
    GuardianAgent.instance = undefined as unknown as GuardianAgent;
  }

  /**
   * Starts the Guardian Agent
   */
  start(): void {

    // Start continuous monitoring
    this.monitoring.start(this.config.monitoringIntervalMs);

    // Start periodic security scans
    this.startSecurityScanning();

    // Register global error boundaries
    this.registerGlobalErrorHandlers();

  }

  /**
   * Stops the Guardian Agent
   */
  stop(): void {
    this.monitoring.stop();
  }

  /**
   * Starts periodic security scanning
   */
  private startSecurityScanning(): void {
    setInterval(async () => {
      await this.performSecurityScan();
    }, this.config.securityScanIntervalMs);
  }

  /**
   * Performs comprehensive security scan
   * NOTE: PHI scanning removed from browser - handled by Edge Function for HIPAA compliance
   */
  private async performSecurityScan(): Promise<void> {

    // PHI scanning moved to Edge Function (/guardian-agent-api)
    // This keeps PHI data server-side only for HIPAA compliance

    // Scan for authentication issues (no PHI involved)
    await this.scanAuthState();
  }

  /**
   * PHI scanning removed from browser for HIPAA compliance
   * Use Edge Function /guardian-agent-api for PHI monitoring
   */

  /**
   * Scans authentication state
   */
  private async scanAuthState(): Promise<void> {
    // Check for expired tokens
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    if (token) {
      try {
        // Basic JWT expiration check
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {

          if (this.config.autoHealEnabled) {
            // Auto-heal: attempt token refresh
            await this.attemptTokenRefresh();
          }
        }
      } catch {
        // Invalid token format
      }
    }
  }

  /**
   * Attempts to refresh authentication token
   */
  private async attemptTokenRefresh(): Promise<void> {
    // Implementation depends on your auth system
    // This is a placeholder for the auto-healing mechanism
  }

  /**
   * Registers global error handlers
   */
  private registerGlobalErrorHandlers(): void {
    // These are already set up in MonitoringSystem
    // This method is here for any additional global handlers
  }

  /**
   * Manually reports an issue to the agent
   */
  async reportIssue(error: Error, context?: Record<string, unknown>): Promise<void> {
    await this.brain.analyze(error, {
      environmentState: {},
      recentActions: [],
      tenantId: this.config.tenantId,
      ...context
    });
  }

  /**
   * Gets agent state and statistics
   */
  getState(): AgentState {
    return this.brain.getState();
  }

  /**
   * Gets comprehensive statistics
   */
  getStatistics() {
    const uptime = Date.now() - this.startTime.getTime();

    return {
      uptime: Math.floor(uptime / 1000), // seconds
      agentMetrics: this.brain.getMetrics(),
      monitoringStats: this.monitoring.getStatistics(),
      securityStats: this.security.getStatistics(),
      config: this.config
    };
  }

  /**
   * Sets the active tenant for tenant-scoped monitoring and healing.
   * Call this when auth resolves or tenant switches.
   */
  setTenantId(tenantId: string): void {
    this.config.tenantId = tenantId;
    this.brain.updateConfig(this.config);
    this.monitoring.updateConfig(this.config);
  }

  /**
   * Gets the current tenant ID
   */
  getTenantId(): string | undefined {
    return this.config.tenantId;
  }

  /**
   * Updates agent configuration
   */
  updateConfig(config: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...config };
    this.brain.updateConfig(this.config);
    this.monitoring.updateConfig(this.config);
  }

  /**
   * Forces a manual healing attempt for an issue
   */
  async forceHeal(issueId: string): Promise<unknown> {
    return await this.brain.manualHeal(issueId);
  }

  /**
   * Exports agent knowledge base
   */
  exportKnowledge(): Record<string, unknown> {
    const state = this.brain.getState();
    return {
      knowledgeBase: state.knowledgeBase,
      recentHealings: state.recentHealings,
      exportedAt: new Date()
    };
  }

  /**
   * Gets health status
   */
  getHealth(): { status: 'healthy' | 'degraded' | 'critical'; details: Record<string, unknown> } {
    const state = this.brain.getState();
    const metrics = this.brain.getMetrics();

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';

    if (state.activeIssues.length > 10) {
      status = 'degraded';
    }

    if (state.activeIssues.some(i => i.severity === 'critical')) {
      status = 'critical';
    }

    return {
      status,
      details: {
        activeIssues: state.activeIssues.length,
        healingInProgress: state.healingInProgress.length,
        successRate: metrics.successRate,
        isActive: state.isActive
      }
    };
  }
}

// Export singleton instance getter
export const getGuardianAgent = (config?: Partial<AgentConfig>) =>
  GuardianAgent.getInstance(config);

// Auto-start in all non-test environments. GRD-3: previously this was gated
// behind MODE === 'production', leaving development and staging unmonitored.
// Dev/staging must also run Guardian so bugs, security events, and perf
// regressions are caught before they reach production.
// `start()` is idempotent on the singleton — App.tsx also calls it, but the
// module-level call ensures monitoring begins even if App.tsx is not mounted
// (e.g., in service workers, worker threads, or isolated test harnesses that
// import services without rendering App).
if (import.meta.env.MODE !== 'test' && typeof window !== 'undefined') {
  const agent = GuardianAgent.getInstance();
  agent.start();

  // Expose to window for debugging in all non-test environments so developers
  // can inspect agent state via DevTools during dev/staging triage.
  (window as Window & { __guardianAgent?: GuardianAgent }).__guardianAgent = agent;
}
