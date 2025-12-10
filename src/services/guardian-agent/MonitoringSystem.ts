/**
 * Monitoring System - Continuous health monitoring and anomaly detection
 */

import { DetectedIssue, ErrorContext/*, AgentState*/ } from './types';
import { AgentBrain } from './AgentBrain';
import { SecurityScanner } from './SecurityScanner';

interface HealthMetrics {
  cpu: number;
  memory: number;
  latency: number;
  errorRate: number;
  requestRate: number;
  timestamp: Date;
}

interface Anomaly {
  id: string;
  type: 'performance' | 'error_spike' | 'security' | 'memory' | 'availability';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: Date;
  metrics: HealthMetrics;
  autoHealed: boolean;
}

export class MonitoringSystem {
  private agentBrain: AgentBrain;
  private securityScanner: SecurityScanner;
  private metricsHistory: HealthMetrics[] = [];
  private anomalies: Anomaly[] = [];
  private baselines: Map<string, number> = new Map();
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private errorWindow: { error: Error; timestamp: number }[] = [];
  private performanceObserver?: PerformanceObserver;

  constructor(agentBrain: AgentBrain, securityScanner: SecurityScanner) {
    this.agentBrain = agentBrain;
    this.securityScanner = securityScanner;
    this.initializeBaselines();
  }

  /**
   * Starts continuous monitoring
   */
  start(intervalMs: number = 5000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    // Performance monitoring
    this.setupPerformanceMonitoring();

    // Periodic health checks
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, intervalMs);

    // Error event monitoring
    this.setupErrorMonitoring();

    // Resource monitoring
    this.setupResourceMonitoring();

    // API monitoring
    this.setupAPIMonitoring();
  }

  /**
   * Stops monitoring
   */
  stop(): void {
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

  }

  /**
   * Performs comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    const metrics = await this.collectMetrics();
    this.metricsHistory.push(metrics);

    // Keep last 1000 metrics (for pattern detection)
    if (this.metricsHistory.length > 1000) {
      this.metricsHistory.shift();
    }

    // Detect anomalies
    const anomalies = await this.detectAnomalies(metrics);

    for (const anomaly of anomalies) {
      this.anomalies.push(anomaly);
      await this.handleAnomaly(anomaly);
    }

    // Update baselines (adaptive learning)
    this.updateBaselines(metrics);
  }

  /**
   * Collects current system metrics
   */
  private async collectMetrics(): Promise<HealthMetrics> {
    const memory = this.getMemoryUsage();
    const latency = this.getAverageLatency();
    const errorRate = this.getErrorRate();
    const requestRate = this.getRequestRate();

    return {
      cpu: 0, // Browser doesn't expose CPU directly
      memory,
      latency,
      errorRate,
      requestRate,
      timestamp: new Date()
    };
  }

  /**
   * Detects anomalies in metrics
   */
  private async detectAnomalies(metrics: HealthMetrics): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    // Memory anomaly detection
    const memoryBaseline = this.baselines.get('memory') || 50;
    if (metrics.memory > memoryBaseline * 1.5) {
      anomalies.push({
        id: `anomaly-${Date.now()}-memory`,
        type: 'memory',
        severity: metrics.memory > memoryBaseline * 2 ? 'critical' : 'high',
        description: `Memory usage ${metrics.memory.toFixed(1)}% exceeds baseline ${memoryBaseline.toFixed(1)}%`,
        detectedAt: new Date(),
        metrics,
        autoHealed: false
      });
    }

    // Latency anomaly detection
    const latencyBaseline = this.baselines.get('latency') || 200;
    if (metrics.latency > latencyBaseline * 2) {
      anomalies.push({
        id: `anomaly-${Date.now()}-latency`,
        type: 'performance',
        severity: metrics.latency > latencyBaseline * 3 ? 'high' : 'medium',
        description: `Latency ${metrics.latency}ms exceeds baseline ${latencyBaseline}ms`,
        detectedAt: new Date(),
        metrics,
        autoHealed: false
      });
    }

    // Error rate spike detection
    const errorRateBaseline = this.baselines.get('errorRate') || 0.01;
    if (metrics.errorRate > errorRateBaseline * 5) {
      anomalies.push({
        id: `anomaly-${Date.now()}-errors`,
        type: 'error_spike',
        severity: 'critical',
        description: `Error rate ${(metrics.errorRate * 100).toFixed(2)}% is ${(metrics.errorRate / errorRateBaseline).toFixed(1)}x baseline`,
        detectedAt: new Date(),
        metrics,
        autoHealed: false
      });
    }

    // Pattern-based anomaly detection
    if (this.metricsHistory.length >= 10) {
      const patternAnomalies = this.detectPatternAnomalies(metrics);
      anomalies.push(...patternAnomalies);
    }

    return anomalies;
  }

  /**
   * Detects anomalies based on historical patterns
   */
  private detectPatternAnomalies(current: HealthMetrics): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const recentMetrics = this.metricsHistory.slice(-20);

    // Sudden memory increase
    const memoryTrend = this.calculateTrend(recentMetrics.map(m => m.memory));
    if (memoryTrend > 5) {
      // Memory increasing >5% per interval
      anomalies.push({
        id: `anomaly-${Date.now()}-memory-leak`,
        type: 'memory',
        severity: 'high',
        description: 'Potential memory leak detected (continuous memory increase)',
        detectedAt: new Date(),
        metrics: current,
        autoHealed: false
      });
    }

    // Cascading errors
    const errorTrend = this.calculateTrend(recentMetrics.map(m => m.errorRate));
    if (errorTrend > 0.05) {
      anomalies.push({
        id: `anomaly-${Date.now()}-cascade`,
        type: 'error_spike',
        severity: 'critical',
        description: 'Cascading failures detected',
        detectedAt: new Date(),
        metrics: current,
        autoHealed: false
      });
    }

    return anomalies;
  }

  /**
   * Handles detected anomaly - triggers autonomous healing
   */
  private async handleAnomaly(anomaly: Anomaly): Promise<void> {

    // Create detected issue for the agent brain
    const issue: DetectedIssue = {
      id: anomaly.id,
      timestamp: anomaly.detectedAt,
      signature: this.mapAnomalyToSignature(anomaly),
      context: this.createContextFromAnomaly(anomaly),
      severity: anomaly.severity,
      affectedResources: [anomaly.type],
      metadata: {
        anomalyType: anomaly.type,
        metrics: anomaly.metrics
      }
    };

    // Let the agent brain handle it autonomously
    const detectedIssue = await this.agentBrain.analyze(
      new Error(anomaly.description),
      issue.context
    );

    if (detectedIssue) {
      anomaly.autoHealed = true;
    }
  }

  /**
   * Sets up performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 3000) {
            // Slow operation detected
            this.handleSlowOperation(entry);
          }
        }
      });

      this.performanceObserver.observe({ entryTypes: ['measure', 'navigation'] });
    } catch (error) {
    }
  }

  /**
   * Sets up error monitoring
   */
  private setupErrorMonitoring(): void {
    // Global error handler
    const originalErrorHandler = window.onerror;

    window.onerror = (message, source, lineno, colno, error) => {
      this.handleError(error || new Error(String(message)), {
        filePath: source,
        lineNumber: lineno,
        environmentState: {},
        recentActions: []
      });

      // Call original handler
      if (originalErrorHandler) {
        return originalErrorHandler(message, source, lineno, colno, error);
      }

      return false;
    };

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        {
          environmentState: {},
          recentActions: []
        }
      );
    });
  }

  /**
   * Sets up resource monitoring
   */
  private setupResourceMonitoring(): void {
    // Monitor resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target && (event.target as any).src) {
        // Resource loading error
        this.handleResourceError(event);
      }
    }, true);
  }

  /**
   * Sets up API monitoring
   */
  private setupAPIMonitoring(): void {
    // Intercept fetch for monitoring
    const originalFetch = window.fetch;

    window.fetch = async (...args): Promise<Response> => {
      const startTime = performance.now();
      const url = args[0] instanceof Request ? args[0].url : String(args[0]);

      try {
        const response = await originalFetch(...args);
        const duration = performance.now() - startTime;

        // Monitor slow API calls
        if (duration > 5000) {
          this.handleSlowAPI(url, duration);
        }

        // Monitor failed API calls
        if (!response.ok) {
          await this.handleFailedAPI(url, response.status, args);
        }

        return response;
      } catch (error) {
        await this.handleAPIError(url, error);
        throw error;
      }
    };
  }

  /**
   * Handles detected errors autonomously
   */
  private async handleError(error: Error, context: ErrorContext): Promise<void> {
    // Add to error window with timestamp
    this.errorWindow.push({ error, timestamp: Date.now() });
    if (this.errorWindow.length > 100) {
      this.errorWindow.shift();
    }

    // Let agent brain analyze and heal autonomously
    await this.agentBrain.analyze(error, context);
  }

  /**
   * Handles slow operations
   */
  private async handleSlowOperation(entry: PerformanceEntry): Promise<void> {

    await this.agentBrain.analyze(
      new Error(`Slow operation: ${entry.name}`),
      {
        component: entry.name,
        environmentState: { duration: entry.duration },
        recentActions: []
      }
    );
  }

  /**
   * Handles slow API calls
   */
  private async handleSlowAPI(url: string, duration: number): Promise<void> {

    await this.agentBrain.analyze(
      new Error(`Slow API response`),
      {
        apiEndpoint: url,
        environmentState: { duration },
        recentActions: []
      }
    );
  }

  /**
   * Handles failed API calls
   */
  private async handleFailedAPI(url: string, status: number, args: any[]): Promise<void> {
    await this.agentBrain.analyze(
      new Error(`API request failed with status ${status}`),
      {
        apiEndpoint: url,
        environmentState: { statusCode: status },
        recentActions: []
      }
    );
  }

  /**
   * Handles API errors
   */
  private async handleAPIError(url: string, error: any): Promise<void> {
    await this.agentBrain.analyze(
      error instanceof Error ? error : new Error(String(error)),
      {
        apiEndpoint: url,
        environmentState: {},
        recentActions: []
      }
    );
  }

  /**
   * Handles resource loading errors
   */
  private async handleResourceError(event: Event): Promise<void> {
    const target = event.target as any;

    await this.agentBrain.analyze(
      new Error(`Failed to load resource: ${target.src}`),
      {
        environmentState: { resourceType: target.tagName },
        recentActions: []
      }
    );
  }

  // Helper methods
  private initializeBaselines(): void {
    this.baselines.set('memory', 50);
    this.baselines.set('latency', 200);
    this.baselines.set('errorRate', 0.01);
    this.baselines.set('requestRate', 10);
  }

  private updateBaselines(metrics: HealthMetrics): void {
    if (this.metricsHistory.length < 50) return;

    const recent = this.metricsHistory.slice(-50);

    // Calculate moving averages as new baselines
    this.baselines.set('memory', this.average(recent.map(m => m.memory)));
    this.baselines.set('latency', this.average(recent.map(m => m.latency)));
    this.baselines.set('errorRate', this.average(recent.map(m => m.errorRate)));
    this.baselines.set('requestRate', this.average(recent.map(m => m.requestRate)));
  }

  private getMemoryUsage(): number {
    if ('memory' in performance && (performance as any).memory) {
      const mem = (performance as any).memory;
      return (mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100;
    }
    return 0;
  }

  private getAverageLatency(): number {
    if (!performance.getEntriesByType) return 0;

    const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (entries.length === 0) return 0;

    return entries[0].responseEnd - entries[0].requestStart;
  }

  private getErrorRate(): number {
    if (this.errorWindow.length === 0) return 0;

    const recentErrors = this.errorWindow.filter(
      e => Date.now() - e.timestamp < 60000 // Last minute
    );

    return recentErrors.length / 60; // Errors per second
  }

  private getRequestRate(): number {
    // Simplified - would need more sophisticated tracking
    return 0;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const first = values[0];
    const last = values[values.length - 1];

    return (last - first) / values.length;
  }

  private average(values: number[]): number {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private mapAnomalyToSignature(anomaly: Anomaly): any {
    return {
      id: anomaly.type,
      category: anomaly.type === 'memory' ? 'memory_leak' : 'performance_degradation',
      pattern: anomaly.description,
      severity: anomaly.severity,
      description: anomaly.description,
      commonCauses: [],
      healingStrategies: ['resource_cleanup', 'circuit_breaker'],
      estimatedImpact: {
        usersFacing: true,
        dataIntegrity: false,
        securityRisk: false,
        availabilityImpact: 50
      }
    };
  }

  private createContextFromAnomaly(anomaly: Anomaly): ErrorContext {
    return {
      component: anomaly.type,
      environmentState: {
        metrics: anomaly.metrics
      },
      recentActions: []
    };
  }

  /**
   * Gets monitoring statistics
   */
  getStatistics() {
    return {
      isMonitoring: this.isMonitoring,
      metricsCollected: this.metricsHistory.length,
      anomaliesDetected: this.anomalies.length,
      anomaliesHealed: this.anomalies.filter(a => a.autoHealed).length,
      currentMetrics: this.metricsHistory[this.metricsHistory.length - 1],
      baselines: Object.fromEntries(this.baselines)
    };
  }
}
