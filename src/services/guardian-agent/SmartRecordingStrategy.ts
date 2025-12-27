/**
 * Smart Recording Strategy
 *
 * Cost-Effective AI Recording that only stores:
 * 1. Critical errors
 * 2. Security events
 * 3. PHI exposure attempts
 * 4. System failures
 * 5. Random sampling for learning (1% of sessions)
 *
 * This saves 99% of storage costs while capturing what matters!
 */

import React from 'react';
import { aiSystemRecorder } from './AISystemRecorder';
import type { SystemSnapshot } from './AISystemRecorder';
import { auditLogger } from '../auditLogger';

export interface RecordingConfig {
  // What triggers recording
  recordOnError: boolean;
  recordOnSecurityEvent: boolean;
  recordOnPHIExposure: boolean;
  recordOnSystemFailure: boolean;

  // Sampling (for learning)
  samplingRate: number; // 0.01 = 1% of sessions

  // Storage limits
  maxSnapshotsPerSession: number;
  maxSessionDurationMinutes: number;

  // What to keep
  keepSuccessfulSessions: boolean;
  keepErrorSessions: boolean;
  retentionDays: number;
}

const DEFAULT_CONFIG: RecordingConfig = {
  // Only record important events
  recordOnError: true,
  recordOnSecurityEvent: true,
  recordOnPHIExposure: true,
  recordOnSystemFailure: true,

  // 1% random sampling for learning
  samplingRate: 0.01,

  // Limits
  maxSnapshotsPerSession: 100, // Max 100 snapshots per session
  maxSessionDurationMinutes: 30, // Auto-stop after 30 min

  // Retention
  keepSuccessfulSessions: false, // Don't keep successful sessions
  keepErrorSessions: true, // Always keep error sessions
  retentionDays: 30, // Keep for 30 days
};

type SmartRecordingStats = {
  is_recording: boolean;
  is_manual_recording: boolean;
  manual_recording_tag: string | null;
  error_count: number;
  security_event_count: number;
  session_duration_minutes: number;
  // Guardian Eyes: last snapshot captured (if recorder provides it)
  last_snapshot?: SystemSnapshot;
};

export class SmartRecordingStrategy {
  private config: RecordingConfig;
  private shouldRecordThisSession: boolean = false;
  private sessionStartTime: Date | null = null;
  private errorCount: number = 0;
  private securityEventCount: number = 0;
  private manualRecordingActive: boolean = false;
  private manualRecordingTag: string | null = null;

  // Guardian Eyes: track the most recent snapshot we captured (type-safe)
  private lastSnapshot: SystemSnapshot | undefined;

  constructor(config?: Partial<RecordingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Decide if we should record this session
   */
  shouldStartRecording(): boolean {
    // Random sampling (1% chance)
    this.shouldRecordThisSession = Math.random() < this.config.samplingRate;

    return this.shouldRecordThisSession;
  }

  /**
   * Start recording only if criteria met
   */
  async startSmartRecording(userId?: string): Promise<string | null> {
    this.sessionStartTime = new Date();

    // Only record 1% of sessions by default
    if (!this.shouldStartRecording()) {
      return null;
    }

    return await aiSystemRecorder.startRecording(userId);
  }

  /**
   * Trigger recording on critical event (even if not initially sampled)
   */
  async triggerRecordingOnEvent(
    eventType: 'error' | 'security' | 'phi' | 'failure',
    userId?: string
  ): Promise<string | null> {
    // If already recording, just increment counter
    if (this.shouldRecordThisSession) {
      if (eventType === 'error') this.errorCount++;
      if (eventType === 'security' || eventType === 'phi') this.securityEventCount++;
      return null;
    }

    // Not recording yet, but this is important - start now!
    this.shouldRecordThisSession = true;
    this.sessionStartTime = new Date();

    if (eventType === 'error') this.errorCount++;
    if (eventType === 'security' || eventType === 'phi') this.securityEventCount++;

    return await aiSystemRecorder.startRecording(userId);
  }

  /**
   * Should we keep this recording?
   */
  async shouldKeepRecording(): Promise<boolean> {
    // Always keep if there were errors or security events
    if (this.errorCount > 0) {
      return true;
    }

    if (this.securityEventCount > 0) {
      return true;
    }

    // Keep 1% of successful sessions for learning
    if (this.config.samplingRate > 0 && Math.random() < this.config.samplingRate) {
      return true;
    }

    // Otherwise, discard
    return false;
  }

  /**
   * Stop recording with smart retention
   */
  async stopSmartRecording(): Promise<void> {
    if (!this.shouldRecordThisSession) {
      return; // Never started recording
    }

    // Check if we should keep this recording
    const shouldKeep = await this.shouldKeepRecording();

    if (shouldKeep) {
      // Save the recording
      const recording = await aiSystemRecorder.stopRecording();

      // ✅ Use 'recording' to satisfy lint and keep audit/telemetry intent
      // Also attempt to capture last snapshot if recorder exposes one.
      // (We do not assume recorder shape—safe optional chaining.)
      if (recording) {
        const maybeSnapshot = (recording as { lastSnapshot?: SystemSnapshot }).lastSnapshot;
        if (maybeSnapshot) {
          this.lastSnapshot = maybeSnapshot;
        }

        auditLogger.info('[SmartRecording] Recording kept', {
          hasRecording: true,
          manual: this.manualRecordingActive,
          tag: this.manualRecordingTag,
          errorCount: this.errorCount,
          securityEventCount: this.securityEventCount,
        });
      }
    } else {
      // Discard the recording (don't save to database)
      await aiSystemRecorder.stopRecording();

      auditLogger.info('[SmartRecording] Recording discarded', {
        manual: this.manualRecordingActive,
        tag: this.manualRecordingTag,
        errorCount: this.errorCount,
        securityEventCount: this.securityEventCount,
      });
    }

    // Reset counters
    this.errorCount = 0;
    this.securityEventCount = 0;
    this.shouldRecordThisSession = false;
    this.sessionStartTime = null;
  }

  /**
   * Check if session should be auto-stopped (exceeded duration limit)
   */
  shouldAutoStop(): boolean {
    if (!this.sessionStartTime) return false;

    const durationMinutes = (Date.now() - this.sessionStartTime.getTime()) / 1000 / 60;
    return durationMinutes > this.config.maxSessionDurationMinutes;
  }

  /**
   * 🎯 MANUAL RECORDING - Start recording on demand to test a feature
   */
  async startManualRecording(
    tag: string,
    durationMinutes: number = 5,
    userId?: string
  ): Promise<string> {
    this.manualRecordingActive = true;
    this.manualRecordingTag = tag;
    this.shouldRecordThisSession = true;
    this.sessionStartTime = new Date();

    // Start recording immediately
    const sessionId = await aiSystemRecorder.startRecording(userId);

    // Auto-stop after duration
    setTimeout(() => {
      if (this.manualRecordingActive) {
        this.stopManualRecording();
      }
    }, durationMinutes * 60 * 1000);

    return sessionId || `manual-${Date.now()}`;
  }

  /**
   * Stop manual recording
   */
  async stopManualRecording(): Promise<void> {
    if (!this.manualRecordingActive) {
      return;
    }

    this.manualRecordingActive = false;

    // Always keep manual recordings
    const recording = await aiSystemRecorder.stopRecording();

    // ✅ use recording and capture snapshot if present
    if (recording && this.manualRecordingTag) {
      const maybeSnapshot = (recording as { lastSnapshot?: SystemSnapshot }).lastSnapshot;
      if (maybeSnapshot) {
        this.lastSnapshot = maybeSnapshot;
      }

      auditLogger.info('[SmartRecording] Manual recording kept', { tag: this.manualRecordingTag });

      // Add tag to recording metadata via a final snapshot
      aiSystemRecorder.captureUserAction('SmartRecording', 'manual_recording_tagged', {
        tag: this.manualRecordingTag,
        session_id: recording.session_id,
        recording_type: 'manual',
        snapshots_count: recording.snapshots?.length || 0,
        events_count: recording.rrweb_events?.length || 0,
      });
    }

    this.manualRecordingTag = null;
    this.shouldRecordThisSession = false;
    this.sessionStartTime = null;
  }

  /**
   * Get recording statistics
   */
  getStats(): SmartRecordingStats {
    return {
      is_recording: this.shouldRecordThisSession,
      is_manual_recording: this.manualRecordingActive,
      manual_recording_tag: this.manualRecordingTag,
      error_count: this.errorCount,
      security_event_count: this.securityEventCount,
      session_duration_minutes: this.sessionStartTime
        ? (Date.now() - this.sessionStartTime.getTime()) / 1000 / 60
        : 0,
      last_snapshot: this.lastSnapshot,
    };
  }
}

/**
 * Global instance with cost-effective defaults
 */
export const smartRecordingStrategy = new SmartRecordingStrategy({
  samplingRate: 0.01, // Only 1% of sessions
  maxSnapshotsPerSession: 50, // Limit snapshot count
  maxSessionDurationMinutes: 15, // Auto-stop after 15 min
  keepSuccessfulSessions: false, // Don't keep successful sessions
  keepErrorSessions: true, // Always keep error sessions
  retentionDays: 30, // 30 day retention
});

/**
 * React Hook for smart recording
 */
export function useSmartRecording() {
  const [isRecording, setIsRecording] = React.useState(false);

  const startRecording = async (userId?: string) => {
    const sessionId = await smartRecordingStrategy.startSmartRecording(userId);
    setIsRecording(sessionId !== null);
    return sessionId;
  };

  const stopRecording = async () => {
    await smartRecordingStrategy.stopSmartRecording();
    setIsRecording(false);
  };

  const triggerOnError = async (error: Error, userId?: string) => {
    await smartRecordingStrategy.triggerRecordingOnEvent('error', userId);
    aiSystemRecorder.captureError('ErrorBoundary', error);
  };

  const triggerOnSecurity = async (userId?: string) => {
    await smartRecordingStrategy.triggerRecordingOnEvent('security', userId);
  };

  const startManualRecording = async (tag: string, durationMinutes?: number, userId?: string) => {
    const sessionId = await smartRecordingStrategy.startManualRecording(tag, durationMinutes, userId);
    setIsRecording(true);
    return sessionId;
  };

  const stopManualRecording = async () => {
    await smartRecordingStrategy.stopManualRecording();
    setIsRecording(false);
  };

  return {
    isRecording,
    startRecording,
    stopRecording,
    triggerOnError,
    triggerOnSecurity,
    startManualRecording,
    stopManualRecording,
    stats: smartRecordingStrategy.getStats(),
  };
}

/**
 * 💰 Cost Analysis (Using Claude Haiku 3.5 for AI Analysis):
 * (unchanged)
 */
