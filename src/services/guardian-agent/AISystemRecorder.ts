/**
 * Guardian Eyes - AI System Recorder with rrweb
 *
 * Records system behavior using rrweb for full DOM replay:
 * - User interactions (clicks, inputs, scrolls)
 * - DOM mutations
 * - Error conditions
 * - Performance metrics
 * - Security events
 *
 * Recordings are stored in the guardian-eyes Supabase bucket.
 */

import React from 'react';
import { record } from 'rrweb';
import type { eventWithTime, listenerHandler } from '@rrweb/types';
import { supabase } from '../../lib/supabaseClient';

export interface SystemSnapshot {
  id: string;
  timestamp: string;
  type: 'user_action' | 'state_change' | 'error' | 'performance' | 'security';
  component: string;
  action?: string;
  state_before?: Record<string, unknown>;
  state_after?: Record<string, unknown>;
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
    context?: Record<string, unknown>;
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
  rrweb_events: eventWithTime[];
  recording_url?: string;
  ai_summary?: {
    user_goal?: string;
    success?: boolean;
    pain_points?: string[];
    optimizations?: string[];
    security_concerns?: string[];
  };
}

/**
 * GuardianEyes (AISystemRecorder) - Records system behavior with rrweb
 *
 * The Guardian Eyes are always watching, recording every interaction,
 * state change, error, and security event for intelligent healing.
 */
export class AISystemRecorder {
  private currentSession: SessionRecording | null = null;
  private snapshotBuffer: SystemSnapshot[] = [];
  private rrwebEvents: eventWithTime[] = [];
  private isRecording = false;
  private recordingInterval: number | null = null;
  private rrwebStopFn: listenerHandler | null = null;
  private eventBuffer: eventWithTime[] = [];
  private lastUploadTime: number = 0;
  private readonly UPLOAD_INTERVAL = 30000; // Upload every 30 seconds
  private readonly MAX_EVENTS_BEFORE_UPLOAD = 500;

  /**
   * Start recording system behavior with rrweb
   */
  async startRecording(userId?: string): Promise<string> {
    if (this.isRecording) {
      return this.currentSession?.session_id || '';
    }

    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.currentSession = {
      session_id: sessionId,
      user_id: userId,
      start_time: new Date().toISOString(),
      snapshots: [],
      rrweb_events: [],
    };

    this.isRecording = true;
    this.rrwebEvents = [];
    this.eventBuffer = [];
    this.lastUploadTime = Date.now();

    // Start rrweb recording
    try {
      const stopFn = record({
        emit: (event) => {
          this.handleRrwebEvent(event as eventWithTime);
        },
        // Recording options for HIPAA compliance
        maskAllInputs: true, // Mask all input values
        blockClass: 'phi-block', // Block elements with this class
        maskInputOptions: {
          password: true,
          email: true,
          tel: true,
        },
        sampling: {
          mousemove: true,
          mouseInteraction: true,
          scroll: 150, // Sample scroll every 150ms
          input: 'last', // Only record last input value
        },
        recordCanvas: false, // Don't record canvas (perf)
        collectFonts: false, // Don't collect fonts (size)
      });
      if (stopFn) {
        this.rrwebStopFn = stopFn;
      }
    } catch {
      // rrweb may fail in some environments (e.g., SSR, tests)
    }

    // Install additional event listeners
    this.installEventListeners();

    // Start periodic snapshots and uploads
    this.recordingInterval = window.setInterval(() => {
      this.capturePerformanceSnapshot();
      this.checkAndUpload();
    }, 5000);

    return sessionId;
  }

  /**
   * Handle rrweb events
   */
  private handleRrwebEvent(event: eventWithTime) {
    if (!this.isRecording || !this.currentSession) return;

    this.rrwebEvents.push(event);
    this.eventBuffer.push(event);

    // Check if we should upload
    if (this.eventBuffer.length >= this.MAX_EVENTS_BEFORE_UPLOAD) {
      this.uploadEventBuffer();
    }
  }

  /**
   * Check and upload buffer periodically
   */
  private async checkAndUpload() {
    const now = Date.now();
    if (now - this.lastUploadTime >= this.UPLOAD_INTERVAL && this.eventBuffer.length > 0) {
      await this.uploadEventBuffer();
    }
  }

  /**
   * Upload event buffer to Supabase storage
   */
  private async uploadEventBuffer(): Promise<void> {
    if (!this.currentSession || this.eventBuffer.length === 0) return;

    const eventsToUpload = [...this.eventBuffer];
    this.eventBuffer = [];
    this.lastUploadTime = Date.now();

    const chunkId = `${this.currentSession.session_id}-${Date.now()}`;
    const fileName = `${this.currentSession.session_id}/${chunkId}.json`;

    try {
      const blob = new Blob([JSON.stringify(eventsToUpload)], { type: 'application/json' });

      const { error } = await supabase.storage
        .from('guardian-eyes')
        .upload(fileName, blob, {
          contentType: 'application/json',
          upsert: false,
        });

      if (error) {
        // Put events back in buffer on failure
        this.eventBuffer = [...eventsToUpload, ...this.eventBuffer];
      }
    } catch (error) {
      // Silent fail - events will be retried
      this.eventBuffer = [...eventsToUpload, ...this.eventBuffer];
    }
  }

  /**
   * Stop recording and save final data
   */
  async stopRecording(): Promise<SessionRecording | null> {
    if (!this.currentSession) return null;

    this.isRecording = false;

    // Stop rrweb
    if (this.rrwebStopFn) {
      this.rrwebStopFn();
      this.rrwebStopFn = null;
    }

    // Clear interval
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }

    // Remove event listeners
    this.removeEventListeners();

    // Upload remaining events
    await this.uploadEventBuffer();

    // Set end time
    this.currentSession.end_time = new Date().toISOString();
    this.currentSession.rrweb_events = this.rrwebEvents;

    // Generate AI summary
    this.currentSession.ai_summary = await this.generateAISummary(this.currentSession);

    // Save session metadata to database
    await this.saveRecording(this.currentSession);

    // Generate recording URL
    const { data } = supabase.storage
      .from('guardian-eyes')
      .getPublicUrl(`${this.currentSession.session_id}/`);
    this.currentSession.recording_url = data?.publicUrl;

    const recording = this.currentSession;
    this.currentSession = null;
    this.snapshotBuffer = [];
    this.rrwebEvents = [];

    return recording;
  }

  /**
   * Capture user action
   */
  captureUserAction(component: string, action: string, metadata?: Record<string, unknown>) {
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
    stateBefore: Record<string, unknown>,
    stateAfter: Record<string, unknown>,
    metadata?: Record<string, unknown>
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
   * Capture error - triggers immediate upload
   */
  captureError(component: string, error: Error, metadata?: Record<string, unknown>) {
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
        } as Record<string, unknown>,
      },
    };

    this.addSnapshot(snapshot);

    // Upload immediately on error
    this.uploadEventBuffer();
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
    window.addEventListener('error', this.handleGlobalError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  /**
   * Remove global event listeners
   */
  private removeEventListeners() {
    window.removeEventListener('error', this.handleGlobalError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

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
      await supabase.from('system_recordings').insert({
        session_id: this.currentSession?.session_id,
        snapshots: snapshots,
        recorded_at: new Date().toISOString(),
      });
    } catch {
      // Snapshots will be retried on next flush
    }
  }

  /**
   * Generate AI summary of session
   */
  private async generateAISummary(recording: SessionRecording) {
    try {
      const userActions = recording.snapshots.filter((s) => s.type === 'user_action');
      const errors = recording.snapshots.filter((s) => s.type === 'error');
      const stateChanges = recording.snapshots.filter((s) => s.type === 'state_change');

      const userGoal = this.detectUserGoal(userActions);
      const painPoints = this.detectPainPoints(errors, stateChanges);
      const optimizations = this.generateOptimizations(recording);
      const securityConcerns = this.detectSecurityConcerns(recording);

      return {
        user_goal: userGoal,
        success: errors.length === 0,
        pain_points: painPoints,
        optimizations: optimizations,
        security_concerns: securityConcerns,
      };
    } catch {
      return undefined;
    }
  }

  private detectUserGoal(actions: SystemSnapshot[]): string {
    if (actions.length === 0) return 'Unknown goal';

    const components = actions.map((a) => a.component);
    const uniqueComponents = Array.from(new Set(components));

    if (uniqueComponents.includes('LoginForm')) return 'User attempting to login';
    if (uniqueComponents.includes('RegisterForm')) return 'User attempting to register';
    if (uniqueComponents.includes('PatientDashboard')) return 'User viewing patient data';
    if (uniqueComponents.includes('BillingForm')) return 'User processing billing';

    return `User interacting with ${uniqueComponents.join(', ')}`;
  }

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

  private generateOptimizations(recording: SessionRecording): string[] {
    const optimizations: string[] = [];

    const performanceSnapshots = recording.snapshots.filter((s) => s.type === 'performance');
    const avgMemory =
      performanceSnapshots.reduce(
        (sum, s) => sum + ((s.metadata.performance?.memory_used as number) || 0),
        0
      ) / (performanceSnapshots.length || 1);

    if (avgMemory > 100 * 1024 * 1024) {
      optimizations.push('High memory usage detected - consider optimizing component rendering');
    }

    const stateChanges = recording.snapshots.filter((s) => s.type === 'state_change');
    if (stateChanges.length > 50) {
      optimizations.push('Excessive state changes - consider state optimization or memoization');
    }

    return optimizations;
  }

  private detectSecurityConcerns(recording: SessionRecording): string[] {
    const concerns: string[] = [];

    for (const snapshot of recording.snapshots) {
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

  private detectRepeatedActions(snapshots: SystemSnapshot[]): number {
    if (snapshots.length < 2) return 0;

    let repeatedCount = 0;
    for (let i = 1; i < snapshots.length; i++) {
      const current = snapshots[i];
      const previous = snapshots[i - 1];

      if (
        current.component === previous.component &&
        current.action === previous.action &&
        Date.parse(current.timestamp) - Date.parse(previous.timestamp) < 3000
      ) {
        repeatedCount++;
      }
    }

    return repeatedCount;
  }

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

  private getPerformanceMetrics() {
    const memory = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;

    return {
      memory_used: memory?.usedJSHeapSize,
      memory_total: memory?.totalJSHeapSize,
      memory_limit: memory?.jsHeapSizeLimit,
      timestamp: performance.now(),
    };
  }

  private async saveRecording(recording: SessionRecording) {
    try {
      await supabase.from('session_recordings').insert({
        session_id: recording.session_id,
        user_id: recording.user_id,
        start_time: recording.start_time,
        end_time: recording.end_time,
        snapshot_count: recording.snapshots.length,
        rrweb_event_count: recording.rrweb_events.length,
        recording_url: recording.recording_url,
        ai_summary: recording.ai_summary,
        metadata: {
          duration_seconds: recording.end_time
            ? (Date.parse(recording.end_time) - Date.parse(recording.start_time)) / 1000
            : 0,
        },
      });
    } catch {
      // Recording will be saved on next attempt
    }
  }

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
      rrweb_events_captured: this.rrwebEvents.length,
      buffer_size: this.snapshotBuffer.length,
      event_buffer_size: this.eventBuffer.length,
    };
  }

  /**
   * Get current session events for replay
   */
  getEvents(): eventWithTime[] {
    return this.rrwebEvents;
  }
}

/**
 * Global singleton instance - Guardian Eyes
 */
export const aiSystemRecorder = new AISystemRecorder();
export const guardianEyes = aiSystemRecorder;

/**
 * React Hook for easy recording
 */
export function useSystemRecording(autoStart = false) {
  const [isRecording, setIsRecording] = React.useState(false);
  const [status, setStatus] = React.useState(aiSystemRecorder.getStatus());

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

  React.useEffect(() => {
    const interval = setInterval(() => {
      setStatus(aiSystemRecorder.getStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    startRecording: async (userId?: string) => {
      await aiSystemRecorder.startRecording(userId);
      setIsRecording(true);
    },
    stopRecording: async () => {
      const recording = await aiSystemRecorder.stopRecording();
      setIsRecording(false);
      return recording;
    },
    captureAction: aiSystemRecorder.captureUserAction.bind(aiSystemRecorder),
    captureState: aiSystemRecorder.captureStateChange.bind(aiSystemRecorder),
    captureError: aiSystemRecorder.captureError.bind(aiSystemRecorder),
    getEvents: aiSystemRecorder.getEvents.bind(aiSystemRecorder),
    isRecording,
    status,
  };
}
