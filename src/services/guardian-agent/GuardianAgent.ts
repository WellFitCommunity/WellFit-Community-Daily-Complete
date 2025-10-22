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
    this.monitoring = new MonitoringSystem(this.brain, this.security);
    this.startTime = new Date();

    console.log('🛡️ [Guardian Agent] Initialized and ready to protect your application');
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
   * Starts the Guardian Agent
   */
  start(): void {
    console.log('🚀 [Guardian Agent] Starting autonomous protection...');

    // Start continuous monitoring
    this.monitoring.start(this.config.monitoringIntervalMs);

    // Start periodic security scans
    this.startSecurityScanning();

    // Register global error boundaries
    this.registerGlobalErrorHandlers();

    console.log('✅ [Guardian Agent] Active and monitoring');
  }

  /**
   * Stops the Guardian Agent
   */
  stop(): void {
    console.log('🛑 [Guardian Agent] Stopping...');
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
   */
  private async performSecurityScan(): Promise<void> {
    console.log('[Guardian Agent] Performing security scan...');

    // Scan for PHI exposure in console logs
    this.scanConsoleLogs();

    // Scan localStorage for insecure data storage
    await this.scanLocalStorage();

    // Scan for authentication issues
    await this.scanAuthState();
  }

  /**
   * Scans console logs for PHI exposure
   */
  private scanConsoleLogs(): void {
    // Override console methods to scan for PHI
    const originalConsoleLog = console.log;
    const agent = this;

    console.log = function(...args) {
      // Scan arguments for PHI patterns
      const argsString = args.map(a =>
        typeof a === 'object' ? JSON.stringify(a) : String(a)
      ).join(' ');

      agent.security.scanForPHI(argsString, {
        component: 'console',
        environmentState: {},
        recentActions: []
      }).then(vulnerabilities => {
        if (vulnerabilities.length > 0) {
          console.error('[Guardian Agent] PHI detected in console.log - blocking output');
          return; // Don't log PHI
        }
        originalConsoleLog.apply(console, args);
      });
    };
  }

  /**
   * Scans localStorage for insecure data
   */
  private async scanLocalStorage(): Promise<void> {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        const value = localStorage.getItem(key);
        if (!value) continue;

        const vulnerabilities = await this.security.scanForPHI(
          { key, value },
          {
            component: 'localStorage',
            environmentState: {},
            recentActions: []
          }
        );

        if (vulnerabilities.length > 0) {
          console.warn(`[Guardian Agent] Insecure data in localStorage: ${key}`);
          // Auto-heal: encrypt or remove
          if (this.config.autoHealEnabled) {
            localStorage.removeItem(key);
            console.log(`[Guardian Agent] Removed insecure data from localStorage`);
          }
        }
      }
    } catch (error) {
      console.error('[Guardian Agent] Error scanning localStorage:', error);
    }
  }

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
          console.warn('[Guardian Agent] Expired token detected');

          if (this.config.autoHealEnabled) {
            // Auto-heal: attempt token refresh
            await this.attemptTokenRefresh();
          }
        }
      } catch (error) {
        // Invalid token format
        console.error('[Guardian Agent] Invalid token format detected');
      }
    }
  }

  /**
   * Attempts to refresh authentication token
   */
  private async attemptTokenRefresh(): Promise<void> {
    console.log('[Guardian Agent] Attempting token refresh...');
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
  async reportIssue(error: Error, context?: Partial<any>): Promise<void> {
    await this.brain.analyze(error, {
      environmentState: {},
      recentActions: [],
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
   * Updates agent configuration
   */
  updateConfig(config: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...config };
    this.brain.updateConfig(this.config);
    console.log('[Guardian Agent] Configuration updated');
  }

  /**
   * Forces a manual healing attempt for an issue
   */
  async forceHeal(issueId: string): Promise<any> {
    return await this.brain.manualHeal(issueId);
  }

  /**
   * Exports agent knowledge base
   */
  exportKnowledge(): any {
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
  getHealth(): { status: 'healthy' | 'degraded' | 'critical'; details: any } {
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

// Auto-start in production
if (process.env.NODE_ENV === 'production') {
  const agent = GuardianAgent.getInstance();
  agent.start();

  // Expose to window for debugging (only in dev tools)
  if (typeof window !== 'undefined') {
    (window as any).__guardianAgent = agent;
  }
}
