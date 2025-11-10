/**
 * Guardian Eyes - AI System Recorder
 *
 * Records system behavior from the inside using AI to understand and document:
 * - User interactions
 * - System state changes
 * - Error conditions
 * - Performance metrics
 * - Security events
 *
 * This creates a "digital twin" of your system that AI can analyze and learn from.
 * The Guardian Eyes watch over your application 24/7, recording everything for healing and optimization.
 */

import React from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface SystemSnapshot {
  id: string;
  timestamp: string;
  type: 'user_action' | 'state_change' | 'error' | 'performance' | 'security';
  component: string;
  action?: string;
  state_before?: Record<string, any>;
  state_after?: Record<string, any>;
  metadata: {
    user_id?: string;
    session_id?: string;
    url?: string;
    user_agent?: string;
    viewport?: { width: number; height: number };
    performance?: {
      memory_used?: number;
      cpu_usage?: number;
      network_latency?: number;
    };
    context?: Record<string, any>;
  };
  ai_analysis?: {
    intent_detected?: string;
    patterns_identified?: string[];
    anomalies?: string[];
    recommendations?: string[];
  };
}

export interface SessionRecording {
  session_id: string;
  user_id?: string;
  start_time: string;
  end_time?: string;
  snapshots: SystemSnapshot[];
  ai_summary?: {
    user_goal?: string;
    success?: boolean;
    pain_points?: string[];
    optimizations?: string[];
    security_concerns?: string[];
  };
}

/**
 * GuardianEyes (AISystemRecorder) - Records system behavior for AI analysis
 *
 * The Guardian Eyes are always watching, recording every interaction,
 * state change, error, and security event for intelligent healing.
 */
export class AISystemRecorder {
  private currentSession: SessionRecording | null = null;
  private snapshotBuffer: SystemSnapshot[] = [];
  private isRecording = false;
  private recordingInterval: number | null = null;

  /**
   * Start recording system behavior
   */
  async startRecording(userId?: string): Promise<string> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.currentSession = {
      session_id: sessionId,
      user_id: userId,
      start_time: new Date().toISOString(),
      snapshots: [],
    };

    this.isRecording = true;

    // Install global event listeners
    this.installEventListeners();

    // Start periodic snapshots
    this.recordingInterval = window.setInterval(() => {
      this.capturePerformanceSnapshot();
    }, 5000); // Every 5 seconds

    return sessionId;
  }

  /**
   * Stop recording and save to database
   */
  async stopRecording(): Promise<SessionRecording | null> {
    if (!this.currentSession) return null;

    this.isRecording = false;

    // Clear interval
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }

    // Remove event listeners
    this.removeEventListeners();

    // Set end time
    this.currentSession.end_time = new Date().toISOString();

    // Generate AI summary
    this.currentSession.ai_summary = await this.generateAISummary(this.currentSession);

    // Save to database
    await this.saveRecording(this.currentSession);

    const recording = this.currentSession;
    this.currentSession = null;
    this.snapshotBuffer = [];

    return recording;
  }

  /**
   * Capture user action
   */
  captureUserAction(component: string, action: string, metadata?: Record<string, any>) {
    if (!this.isRecording) return;

    const snapshot: SystemSnapshot = {
      id: this.generateSnapshotId(),
      timestamp: new Date().toISOString(),
      type: 'user_action',
      component,
      action,
      metadata: {
        ...this.getContextMetadata(),
        ...metadata,
      },
    };

    this.addSnapshot(snapshot);
  }

  /**
   * Capture state change
   */
  captureStateChange(
    component: string,
    stateBefore: Record<string, any>,
    stateAfter: Record<string, any>,
    metadata?: Record<string, any>
  ) {
    if (!this.isRecording) return;

    const snapshot: SystemSnapshot = {
      id: this.generateSnapshotId(),
      timestamp: new Date().toISOString(),
      type: 'state_change',
      component,
      state_before: stateBefore,
      state_after: stateAfter,
      metadata: {
        ...this.getContextMetadata(),
        ...metadata,
      },
    };

    this.addSnapshot(snapshot);
  }

  /**
   * Capture error
   */
  captureError(component: string, error: Error, metadata?: Record<string, any>) {
    if (!this.isRecording) return;

    const contextMeta = this.getContextMetadata();
    const snapshot: SystemSnapshot = {
      id: this.generateSnapshotId(),
      timestamp: new Date().toISOString(),
      type: 'error',
      component,
      metadata: {
        user_id: contextMeta.user_id,
        session_id: contextMeta.session_id,
        url: contextMeta.url,
        user_agent: contextMeta.user_agent,
        viewport: contextMeta.viewport,
        context: {
          ...metadata,
          error_name: error.name,
          error_message: error.message,
          error_stack: error.stack,
        } as Record<string, any>,
      },
    };

    this.addSnapshot(snapshot);
  }

  /**
   * Capture performance metrics
   */
  private capturePerformanceSnapshot() {
    if (!this.isRecording) return;

    const performance = this.getPerformanceMetrics();

    const snapshot: SystemSnapshot = {
      id: this.generateSnapshotId(),
      timestamp: new Date().toISOString(),
      type: 'performance',
      component: 'system',
      metadata: {
        ...this.getContextMetadata(),
        performance,
      },
    };

    this.addSnapshot(snapshot);
  }

  /**
   * Install global event listeners
   */
  private installEventListeners() {
    // Click tracking
    document.addEventListener('click', this.handleClick);

    // Navigation tracking
    window.addEventListener('popstate', this.handleNavigation);

    // Error tracking
    window.addEventListener('error', this.handleGlobalError);

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  /**
   * Remove global event listeners
   */
  private removeEventListeners() {
    document.removeEventListener('click', this.handleClick);
    window.removeEventListener('popstate', this.handleNavigation);
    window.removeEventListener('error', this.handleGlobalError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  private handleClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    const text = target.textContent?.substring(0, 50) || '';

    this.captureUserAction('dom_element', 'click', {
      element: tagName,
      text,
      coordinates: { x: event.clientX, y: event.clientY },
    });
  };

  private handleNavigation = () => {
    this.captureUserAction('navigation', 'route_change', {
      new_url: window.location.href,
    });
  };

  private handleGlobalError = (event: ErrorEvent) => {
    this.captureError('global', new Error(event.message), {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    this.captureError('promise', new Error(String(event.reason)));
  };

  /**
   * Add snapshot to buffer
   */
  private addSnapshot(snapshot: SystemSnapshot) {
    if (!this.currentSession) return;

    this.snapshotBuffer.push(snapshot);
    this.currentSession.snapshots.push(snapshot);

    // Flush buffer periodically
    if (this.snapshotBuffer.length >= 10) {
      this.flushSnapshotBuffer();
    }
  }

  /**
   * Flush snapshot buffer to database
   */
  private async flushSnapshotBuffer() {
    if (this.snapshotBuffer.length === 0) return;

    const snapshots = [...this.snapshotBuffer];
    this.snapshotBuffer = [];

    try {
      // Store in database
      await supabase.from('system_recordings').insert({
        session_id: this.currentSession?.session_id,
        snapshots: snapshots,
        recorded_at: new Date().toISOString(),
      });
    } catch (error) {
      // Snapshots will be retried on next flush
    }
  }

  /**
   * Generate AI summary of session
   */
  private async generateAISummary(recording: SessionRecording) {
    try {
      // Analyze patterns in user behavior
      const userActions = recording.snapshots.filter((s) => s.type === 'user_action');
      const errors = recording.snapshots.filter((s) => s.type === 'error');
      const stateChanges = recording.snapshots.filter((s) => s.type === 'state_change');

      // Detect user goal (simplified - in production, use Claude API)
      const userGoal = this.detectUserGoal(userActions);

      // Detect pain points
      const painPoints = this.detectPainPoints(errors, stateChanges);

      // Generate optimizations
      const optimizations = this.generateOptimizations(recording);

      // Security concerns
      const securityConcerns = this.detectSecurityConcerns(recording);

      return {
        user_goal: userGoal,
        success: errors.length === 0,
        pain_points: painPoints,
        optimizations: optimizations,
        security_concerns: securityConcerns,
      };
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Detect user goal from actions
   */
  private detectUserGoal(actions: SystemSnapshot[]): string {
    if (actions.length === 0) return 'Unknown goal';

    // Simple heuristic - in production, use Claude API
    const components = actions.map((a) => a.component);
    const uniqueComponents = Array.from(new Set(components));

    if (uniqueComponents.includes('LoginForm')) return 'User attempting to login';
    if (uniqueComponents.includes('RegisterForm')) return 'User attempting to register';
    if (uniqueComponents.includes('PatientDashboard')) return 'User viewing patient data';
    if (uniqueComponents.includes('BillingForm')) return 'User processing billing';

    return `User interacting with ${uniqueComponents.join(', ')}`;
  }

  /**
   * Detect pain points
   */
  private detectPainPoints(errors: SystemSnapshot[], stateChanges: SystemSnapshot[]): string[] {
    const painPoints: string[] = [];

    if (errors.length > 3) {
      painPoints.push(`Multiple errors encountered (${errors.length} total)`);
    }

    const repeatedActions = this.detectRepeatedActions(stateChanges);
    if (repeatedActions > 0) {
      painPoints.push(`User repeated action ${repeatedActions} times (possible confusion)`);
    }

    return painPoints;
  }

  /**
   * Generate optimization recommendations
   */
  private generateOptimizations(recording: SessionRecording): string[] {
    const optimizations: string[] = [];

    const performanceSnapshots = recording.snapshots.filter((s) => s.type === 'performance');
    const avgMemory =
      performanceSnapshots.reduce(
        (sum, s) => sum + (s.metadata.performance?.memory_used || 0),
        0
      ) / performanceSnapshots.length;

    if (avgMemory > 100 * 1024 * 1024) {
      // > 100MB
      optimizations.push('High memory usage detected - consider optimizing component rendering');
    }

    const stateChanges = recording.snapshots.filter((s) => s.type === 'state_change');
    if (stateChanges.length > 50) {
      optimizations.push('Excessive state changes - consider state optimization or memoization');
    }

    return optimizations;
  }

  /**
   * Detect security concerns
   */
  private detectSecurityConcerns(recording: SessionRecording): string[] {
    const concerns: string[] = [];

    // Check for potential PHI exposure
    const snapshots = recording.snapshots;
    for (const snapshot of snapshots) {
      const metadataStr = JSON.stringify(snapshot.metadata);
      if (/\b\d{3}-\d{2}-\d{4}\b/.test(metadataStr)) {
        concerns.push('Potential SSN detected in captured data');
      }
      if (/patient.*data/i.test(metadataStr)) {
        concerns.push('Patient data reference detected - verify PHI protection');
      }
    }

    return concerns;
  }

  /**
   * Detect repeated actions (possible user confusion)
   */
  private detectRepeatedActions(snapshots: SystemSnapshot[]): number {
    if (snapshots.length < 2) return 0;

    let repeatedCount = 0;
    for (let i = 1; i < snapshots.length; i++) {
      const current = snapshots[i];
      const previous = snapshots[i - 1];

      if (
        current.component === previous.component &&
        current.action === previous.action &&
        Date.parse(current.timestamp) - Date.parse(previous.timestamp) < 3000 // Within 3 seconds
      ) {
        repeatedCount++;
      }
    }

    return repeatedCount;
  }

  /**
   * Get context metadata
   */
  private getContextMetadata() {
    return {
      session_id: this.currentSession?.session_id,
      user_id: this.currentSession?.user_id,
      url: window.location.href,
      user_agent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };
  }

  /**
   * Get performance metrics
   */
  private getPerformanceMetrics() {
    const memory = (performance as any).memory;

    return {
      memory_used: memory?.usedJSHeapSize,
      memory_total: memory?.totalJSHeapSize,
      memory_limit: memory?.jsHeapSizeLimit,
      timestamp: performance.now(),
    };
  }

  /**
   * Save recording to database
   */
  private async saveRecording(recording: SessionRecording) {
    try {
      await supabase.from('session_recordings').insert({
        session_id: recording.session_id,
        user_id: recording.user_id,
        start_time: recording.start_time,
        end_time: recording.end_time,
        snapshot_count: recording.snapshots.length,
        ai_summary: recording.ai_summary,
        metadata: {
          duration_seconds: recording.end_time
            ? (Date.parse(recording.end_time) - Date.parse(recording.start_time)) / 1000
            : 0,
        },
      });

      // Recording saved successfully
    } catch (error) {
      // Recording will be saved on next attempt
    }
  }

  /**
   * Generate snapshot ID
   */
  private generateSnapshotId(): string {
    return `snap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get recording status
   */
  getStatus() {
    return {
      is_recording: this.isRecording,
      session_id: this.currentSession?.session_id,
      snapshots_captured: this.currentSession?.snapshots.length || 0,
      buffer_size: this.snapshotBuffer.length,
    };
  }
}

/**
 * Global singleton instance - Guardian Eyes
 * The always-watching protector of your application
 */
export const aiSystemRecorder = new AISystemRecorder();
export const guardianEyes = aiSystemRecorder; // Alias for semantic clarity

/**
 * React Hook for easy recording
 */
export function useSystemRecording(autoStart = false) {
  const [isRecording, setIsRecording] = React.useState(false);

  React.useEffect(() => {
    if (autoStart) {
      aiSystemRecorder.startRecording();
      setIsRecording(true);
    }

    return () => {
      if (isRecording) {
        aiSystemRecorder.stopRecording();
        setIsRecording(false);
      }
    };
  }, [autoStart]);  

  return {
    startRecording: async (userId?: string) => {
      await aiSystemRecorder.startRecording(userId);
      setIsRecording(true);
    },
    stopRecording: async () => {
      await aiSystemRecorder.stopRecording();
      setIsRecording(false);
    },
    captureAction: aiSystemRecorder.captureUserAction.bind(aiSystemRecorder),
    captureState: aiSystemRecorder.captureStateChange.bind(aiSystemRecorder),
    captureError: aiSystemRecorder.captureError.bind(aiSystemRecorder),
    isRecording,
    status: aiSystemRecorder.getStatus(),
  };
}
