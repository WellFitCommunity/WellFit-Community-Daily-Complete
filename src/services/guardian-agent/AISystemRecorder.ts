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
import { resolveTenantId } from './tenantResolver';
import {
  persistSnapshotBatch,
  openSessionRecording,
  finalizeSessionRecording,
  sendSnapshotToGuardian,
} from './recorderPersistence';
import { generateAISummary } from './recordingSummarizer';

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
  tenant_id?: string;
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
  async startRecording(userId?: string, tenantId?: string): Promise<string> {
    if (this.isRecording) {
      return this.currentSession?.session_id || '';
    }

    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Tenant scoping is required by RLS on the recording tables — resolve it
    // from the signed-in user's profile when the caller doesn't provide it.
    const resolvedTenantId = tenantId ?? (await resolveTenantId()) ?? undefined;

    this.currentSession = {
      session_id: sessionId,
      tenant_id: resolvedTenantId,
      user_id: userId,
      start_time: new Date().toISOString(),
      snapshots: [],
      rrweb_events: [],
    };

    this.isRecording = true;
    this.rrwebEvents = [];
    this.eventBuffer = [];
    this.lastUploadTime = Date.now();

    // Open the session row FIRST — system_recordings batches carry a foreign key
    // to session_recordings(session_id) and are rejected until this row exists.
    await openSessionRecording(this.currentSession);

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
    const tenantPrefix = this.currentSession.tenant_id ? `${this.currentSession.tenant_id}/` : '';
    const fileName = `${tenantPrefix}${this.currentSession.session_id}/${chunkId}.json`;

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
    } catch {
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
    this.currentSession.ai_summary = generateAISummary(this.currentSession);

    // Generate recording URL (tenant-scoped storage path) BEFORE persisting so
    // session_recordings.recording_url is populated on the saved row.
    const tenantPrefix = this.currentSession.tenant_id ? `${this.currentSession.tenant_id}/` : '';
    const { data } = supabase.storage
      .from('guardian-eyes')
      .getPublicUrl(`${tenantPrefix}${this.currentSession.session_id}/`);
    this.currentSession.recording_url = data?.publicUrl;

    // Finalize the session row opened at startRecording (counts, summary, URL)
    await finalizeSessionRecording(this.currentSession);

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

    // Feed the edge Guardian Eyes store (guardian_eyes_recordings) so the daily
    // analyze cron sees errors — fire-and-forget, failures logged inside.
    void sendSnapshotToGuardian(snapshot, 'high');
  }

  /**
   * Capture performance metrics
   */
  private capturePerformanceSnapshot() {
    if (!this.isRecording) return;

    const performanceMetrics = this.getPerformanceMetrics();

    const snapshot: SystemSnapshot = {
      id: this.generateSnapshotId(),
      timestamp: new Date().toISOString(),
      type: 'performance',
      component: 'system',
      metadata: {
        ...this.getContextMetadata(),
        performance: performanceMetrics,
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
    if (!this.currentSession || this.snapshotBuffer.length === 0) return;

    const snapshots = [...this.snapshotBuffer];
    this.snapshotBuffer = [];

    const persisted = await persistSnapshotBatch(this.currentSession.session_id, snapshots);
    if (!persisted) {
      // Re-buffer so the batch is retried on the next flush
      this.snapshotBuffer = [...snapshots, ...this.snapshotBuffer];
    }
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
    const memory = (performance as {
      memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
    }).memory;

    return {
      memory_used: memory?.usedJSHeapSize,
      memory_total: memory?.totalJSHeapSize,
      memory_limit: memory?.jsHeapSizeLimit,
      timestamp: performance.now(),
    };
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
      if (autoStart && isRecording) {
        aiSystemRecorder.stopRecording();
        setIsRecording(false);
      }
    };
  }, [autoStart, isRecording]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setStatus(aiSystemRecorder.getStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    startRecording: async (userId?: string, tenantId?: string) => {
      await aiSystemRecorder.startRecording(userId, tenantId);
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
